"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintAgentService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
const printer_1 = require("./printer");
/**
 * KALIPORT PALMX TXP 400 Windows Print Agent Servisi (v2.0.0)
 * - 5 saniyelik polling, tek yazıcı tek iş sırası (FIFO)
 * - SumatraPDF sessiz baskı + Windows spooler doğrulama
 * - Yerel sent_jobs defteri ile ACK kaybında mükerrer baskı engelleme
 * - ACK retry mekanizması
 */
class PrintAgentService {
    config;
    driver;
    isRunning = false;
    isProcessing = false;
    pollTimer = null;
    currentBackoffMs;
    sentJobsMap = new Map();
    stateFilePath;
    constructor(config = {}, customDriver) {
        this.config = {
            apiUrl: (config.apiUrl || process.env.PRINT_AGENT_API_URL || 'https://sonrakam.com').replace(/\/+$/, ''),
            agentId: config.agentId || process.env.PRINT_AGENT_ID || 'kaliport-win-01',
            agentToken: config.agentToken || process.env.PRINT_AGENT_TOKEN || '',
            printerName: config.printerName || process.env.PRINT_PRINTER_NAME || '4BARCODE 4B-2054TG',
            pollIntervalMs: config.pollIntervalMs || Number(process.env.PRINT_POLL_INTERVAL_MS) || 5000,
            errorBackoffMs: config.errorBackoffMs || 10000,
            maxBackoffMs: config.maxBackoffMs || 30000,
            dryRun: config.dryRun !== undefined ? config.dryRun : process.env.DRY_RUN !== 'false',
            outputDir: config.outputDir || process.env.PRINT_OUTPUT_DIR || './simulated_prints',
            sumatraPdfPath: config.sumatraPdfPath || process.env.SUMATRA_PDF_PATH,
            printSettings: config.printSettings || process.env.PRINT_SETTINGS || 'noscale',
            stateFilePath: config.stateFilePath || process.env.PRINT_STATE_FILE_PATH,
        };
        this.stateFilePath =
            this.config.stateFilePath || path_1.default.resolve(process.cwd(), 'logs', 'sent_jobs.json');
        this.loadLocalSentLedger();
        this.currentBackoffMs = this.config.errorBackoffMs;
        this.driver = customDriver || (0, printer_1.createPrinterDriver)(this.config);
    }
    getConfig() {
        return { ...this.config };
    }
    getDriver() {
        return this.driver;
    }
    loadLocalSentLedger() {
        try {
            if (fs_1.default.existsSync(this.stateFilePath)) {
                const raw = fs_1.default.readFileSync(this.stateFilePath, 'utf-8');
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    for (const rec of parsed) {
                        if (rec?.jobId)
                            this.sentJobsMap.set(rec.jobId, rec);
                    }
                }
            }
        }
        catch {
            // İlk kurulum veya okunamayan yerel dosya: temiz başla
        }
    }
    recordJobSentLocally(record) {
        this.sentJobsMap.set(record.jobId, record);
        try {
            const dir = path_1.default.dirname(this.stateFilePath);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            // Son 500 kaydı sakla
            const entries = Array.from(this.sentJobsMap.values()).slice(-500);
            fs_1.default.writeFileSync(this.stateFilePath, JSON.stringify(entries, null, 2), 'utf-8');
        }
        catch {
            // Disk yazma hatası baskıyı bloklamasın
        }
    }
    /**
     * Güvenli log yardımcısı: Token veya kişisel verileri maskeler.
     */
    log(message, level = 'info') {
        const time = new Date().toLocaleTimeString('tr-TR');
        const prefix = `[PRINT-AGENT v${types_1.PRINT_AGENT_VERSION} ${time}]`;
        if (level === 'error') {
            console.error(`${prefix} ❌ ${message}`);
        }
        else if (level === 'warn') {
            console.warn(`${prefix} ⚠️ ${message}`);
        }
        else {
            console.log(`${prefix} ℹ️ ${message}`);
        }
    }
    getHeaders() {
        return {
            'X-Print-Agent-Id': this.config.agentId,
            Authorization: `Bearer ${this.config.agentToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };
    }
    /**
     * Tek bir yoklama (poll) döngüsü çalıştırır.
     */
    async pollOnce() {
        if (this.isProcessing) {
            return { handledJob: false };
        }
        this.isProcessing = true;
        try {
            // 1. Sıradaki İşi Talep Et (Claim)
            const pollRes = await fetch(`${this.config.apiUrl}/api/print-agent/jobs/poll`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify({
                    printerId: this.config.printerName,
                    agentVersion: types_1.PRINT_AGENT_VERSION,
                }),
            });
            if (!pollRes.ok) {
                if (pollRes.status === 401) {
                    this.log(`Kimlik doğrulama başarısız (HTTP 401). Agent ID veya token geçersiz.`, 'error');
                    return { handledJob: false, error: 'UNAUTHORIZED' };
                }
                const errText = await pollRes.text().catch(() => '');
                throw new Error(`Poll endpoint hatası (HTTP ${pollRes.status}): ${errText}`);
            }
            const pollData = (await pollRes.json());
            const job = pollData.job;
            if (!job) {
                this.currentBackoffMs = this.config.errorBackoffMs;
                return { handledJob: false };
            }
            this.log(`Yeni iş alındı: ${job.jobId} (Tür: ${job.type}, Deneme: ${job.attemptCount})`);
            // 1.5. MÜKERRER BASKI KORUMASI (Yerel Spooler Defteri):
            // Eğer bu job daha önce bu agent tarafından fiziksel yazıcıya başarıyla gönderildiyse
            // ama ACK kaybolduğu için lease düşüp tekrar geldiyse ASLA ikinci kez basma -> manual_review!
            if (!this.driver.isDryRun && this.sentJobsMap.has(job.jobId)) {
                const prev = this.sentJobsMap.get(job.jobId);
                this.log(`Mükerrer baskı engellendi: ${job.jobId} daha önce ${prev.submittedAt} tarihinde yazıcıya gönderilmiş (spoolerJobId=${prev.spoolerJobId || 'N/A'}). manual_review bildiriliyor.`, 'warn');
                await this.ackJobWithRetry(job.jobId, {
                    status: 'manual_review',
                    isDryRun: false,
                    errorCode: 'DUPLICATE_PRINT_PREVENTED_LOCAL_LEDGER',
                    errorMessage: `Bu iş daha önce (${prev.submittedAt}) yazıcıya gönderildi ancak ACK ulaşmamıştı. Çift baskıyı önlemek için yönetici incelemesine alındı.`,
                    spoolerJobId: prev.spoolerJobId,
                    printerName: prev.printerName,
                    agentVersion: types_1.PRINT_AGENT_VERSION,
                });
                return { handledJob: true, jobId: job.jobId, error: 'DUPLICATE_PRINT_PREVENTED' };
            }
            // 2. İş PDF'sini İndir
            const pdfRes = await fetch(`${this.config.apiUrl}/api/print-agent/jobs/${encodeURIComponent(job.jobId)}/pdf`, {
                method: 'GET',
                headers: {
                    'X-Print-Agent-Id': this.config.agentId,
                    Authorization: `Bearer ${this.config.agentToken}`,
                },
            });
            if (!pdfRes.ok) {
                const errBody = await pdfRes.text().catch(() => '');
                this.log(`İş PDF'i indirilemedi (${job.jobId}): HTTP ${pdfRes.status} ${errBody}`, 'error');
                await this.ackJobWithRetry(job.jobId, {
                    status: 'failed',
                    isDryRun: this.driver.isDryRun,
                    errorCode: `PDF_FETCH_HTTP_${pdfRes.status}`,
                    errorMessage: 'PDF indirme isteği başarısız oldu.',
                    printerName: this.config.printerName,
                    agentVersion: types_1.PRINT_AGENT_VERSION,
                });
                return { handledJob: true, jobId: job.jobId, error: 'PDF_DOWNLOAD_FAILED' };
            }
            const arrayBuffer = await pdfRes.arrayBuffer();
            const pdfBuffer = Buffer.from(arrayBuffer);
            this.log(`PDF downloaded: ${job.jobId} (${pdfBuffer.length} bytes)`);
            // 3. Yazıcı Sürücüsüne Gönder
            this.log(`Print process started: ${job.jobId} -> ${this.config.printerName}`);
            const printResult = await this.driver.printPdf(pdfBuffer, job);
            this.log(`Print process result: ${job.jobId} success=${printResult.success} status=${printResult.status} spoolerJobId=${printResult.spoolerJobId || 'N/A'}`);
            // 4. Sonucu Sunucuya Bildir (Ack + Retry)
            if (printResult.success) {
                if (printResult.simulated) {
                    await this.ackJobWithRetry(job.jobId, {
                        status: 'simulated',
                        isDryRun: true,
                        simulatedOutputPath: printResult.outputPath,
                        printerName: this.config.printerName,
                        agentVersion: types_1.PRINT_AGENT_VERSION,
                    });
                    this.log(`ACK sent (simulated): ${job.jobId}`);
                }
                else {
                    // Gerçek baskı spooler'a iletildi -> yerel deftere kaydet (ACK kaybolursa çift baskıyı önler)
                    this.recordJobSentLocally({
                        jobId: job.jobId,
                        printerName: printResult.printerName || this.config.printerName,
                        spoolerJobId: printResult.spoolerJobId,
                        submittedAt: printResult.submittedToSpoolerAt || new Date().toISOString(),
                    });
                    await this.ackJobWithRetry(job.jobId, {
                        status: 'printed',
                        isDryRun: false,
                        spoolerJobId: printResult.spoolerJobId,
                        printerName: printResult.printerName || this.config.printerName,
                        agentVersion: types_1.PRINT_AGENT_VERSION,
                        submittedToSpoolerAt: printResult.submittedToSpoolerAt,
                    });
                    this.log(`ACK sent (printed): ${job.jobId} (spoolerJobId=${printResult.spoolerJobId || 'N/A'})`);
                }
                return { handledJob: true, jobId: job.jobId };
            }
            else {
                await this.ackJobWithRetry(job.jobId, {
                    status: 'failed',
                    isDryRun: this.driver.isDryRun,
                    errorCode: printResult.errorCode || 'PRINT_FAILED',
                    errorMessage: printResult.error || 'Baskı işlemi başarısız oldu.',
                    printerName: this.config.printerName,
                    agentVersion: types_1.PRINT_AGENT_VERSION,
                });
                this.log(`ACK sent (failed): ${job.jobId} (${printResult.errorCode}: ${printResult.error})`, 'warn');
                return { handledJob: true, jobId: job.jobId, error: printResult.error };
            }
        }
        catch (err) {
            this.log(`Yoklama sırasında bağlantı veya ağ hatası: ${err.message}`, 'warn');
            return { handledJob: false, error: err.message };
        }
        finally {
            this.isProcessing = false;
        }
    }
    /**
     * Sunucuya işin sonucunu (Ack) 3 denemeye kadar retry ile bildirir.
     */
    async ackJobWithRetry(jobId, result) {
        const maxAckAttempts = 3;
        for (let attempt = 1; attempt <= maxAckAttempts; attempt++) {
            try {
                const res = await fetch(`${this.config.apiUrl}/api/print-agent/jobs/${encodeURIComponent(jobId)}/ack`, {
                    method: 'POST',
                    headers: this.getHeaders(),
                    body: JSON.stringify(result),
                });
                if (res.ok) {
                    return true;
                }
                const text = await res.text().catch(() => '');
                this.log(`Ack bildirim hatası (${jobId}, deneme ${attempt}/${maxAckAttempts}): HTTP ${res.status} ${text}`, 'warn');
            }
            catch (err) {
                this.log(`Ack sunucu bağlantı hatası (${jobId}, deneme ${attempt}/${maxAckAttempts}): ${err.message}`, 'error');
            }
            if (attempt < maxAckAttempts) {
                await new Promise((r) => setTimeout(r, attempt * 1000));
            }
        }
        return false;
    }
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        const maskedToken = this.config.agentToken
            ? `${this.config.agentToken.substring(0, 6)}***`
            : '(TANIMSIZ)';
        this.log(`====================================================`);
        this.log(`KALIPORT PALMX TXP 400 Print Agent v${types_1.PRINT_AGENT_VERSION} Başlatılıyor`);
        this.log(`Hedef API: ${this.config.apiUrl}`);
        this.log(`Agent ID : ${this.config.agentId} (Token: ${maskedToken})`);
        this.log(`Yazıcı   : ${this.config.printerName}`);
        this.log(`Çalışma  : ${this.driver.isDryRun ? 'DRY_RUN (ZORUNLU SİMÜLASYON MODU)' : 'CANLI YAZICI MODU (SumatraPDF Sessiz)'}`);
        if (this.driver.isDryRun) {
            this.log(`Simülasyon Çıktı Klasörü: ${this.config.outputDir}`);
        }
        this.log(`Yoklama Aralığı: ${this.config.pollIntervalMs} ms`);
        this.log(`====================================================`);
        const scheduleNext = (delay) => {
            if (!this.isRunning)
                return;
            this.pollTimer = setTimeout(async () => {
                const { error } = await this.pollOnce();
                if (error) {
                    const nextDelay = this.currentBackoffMs;
                    this.currentBackoffMs = Math.min(this.currentBackoffMs * 1.5, this.config.maxBackoffMs);
                    scheduleNext(nextDelay);
                }
                else {
                    this.currentBackoffMs = this.config.errorBackoffMs;
                    scheduleNext(this.config.pollIntervalMs);
                }
            }, delay);
        };
        scheduleNext(100);
    }
    async stop() {
        this.log(`Kapatma sinyali alındı, agent durduruluyor...`);
        this.isRunning = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        let waitCount = 0;
        while (this.isProcessing && waitCount < 100) {
            await new Promise((r) => setTimeout(r, 100));
            waitCount++;
        }
        this.log(`Agent güvenli şekilde durduruldu.`);
    }
}
exports.PrintAgentService = PrintAgentService;
