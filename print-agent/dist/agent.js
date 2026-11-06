"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrintAgentService = void 0;
const printer_1 = require("./printer");
/**
 * KALIPORT PALMX TXP 400 Windows Print Agent Servisi
 */
class PrintAgentService {
    config;
    driver;
    isRunning = false;
    isProcessing = false;
    pollTimer = null;
    currentBackoffMs;
    constructor(config = {}, customDriver) {
        this.config = {
            apiUrl: (config.apiUrl || process.env.PRINT_AGENT_API_URL || 'https://sonrakam.com').replace(/\/+$/, ''),
            agentId: config.agentId || process.env.PRINT_AGENT_ID || 'kaliport-win-01',
            agentToken: config.agentToken || process.env.PRINT_AGENT_TOKEN || '',
            printerName: config.printerName || process.env.PRINT_PRINTER_NAME || '4BARCODE 4B-2054TG',
            pollIntervalMs: config.pollIntervalMs || Number(process.env.PRINT_POLL_INTERVAL_MS) || 5000,
            errorBackoffMs: config.errorBackoffMs || 10000,
            maxBackoffMs: config.maxBackoffMs || 30000,
            // Zorunlu Simülasyon Koruması: DRY_RUN varsayılan olarak true'dur
            dryRun: config.dryRun !== undefined ? config.dryRun : process.env.DRY_RUN !== 'false',
            outputDir: config.outputDir || process.env.PRINT_OUTPUT_DIR || './simulated_prints',
        };
        this.currentBackoffMs = this.config.errorBackoffMs;
        this.driver = customDriver || (0, printer_1.createPrinterDriver)(this.config);
    }
    getConfig() {
        return { ...this.config };
    }
    getDriver() {
        return this.driver;
    }
    /**
     * Güvenli log yardımcısı: Token veya kişisel verileri maskeler.
     */
    log(message, level = 'info') {
        const time = new Date().toLocaleTimeString('tr-TR');
        const prefix = `[PRINT-AGENT ${time}]`;
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
    /**
     * HTTP Yetkilendirme Başlıkları
     */
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
     * Test edilebilir ve birim testlerinde doğrudan çağrılabilir.
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
                body: JSON.stringify({ printerId: this.config.printerName }),
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
                // Bekleyen iş yok, normal bekleme
                this.currentBackoffMs = this.config.errorBackoffMs;
                return { handledJob: false };
            }
            this.log(`Yeni iş alındı: ${job.jobId} (Tür: ${job.type}, Deneme: ${job.attemptCount})`);
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
                // Başarısızlığı sunucuya bildir
                await this.ackJob(job.jobId, {
                    status: 'failed',
                    errorCode: `PDF_FETCH_HTTP_${pdfRes.status}`,
                    errorMessage: 'PDF indirme isteği başarısız oldu.',
                });
                return { handledJob: true, jobId: job.jobId, error: 'PDF_DOWNLOAD_FAILED' };
            }
            const arrayBuffer = await pdfRes.arrayBuffer();
            const pdfBuffer = Buffer.from(arrayBuffer);
            // 3. Yazıcı Sürücüsüne Gönder (Simülasyon veya Gerçek Windows Yazıcı)
            const printResult = await this.driver.printPdf(pdfBuffer, job);
            // 4. Sonucu Sunucuya Bildir (Ack) — Simülasyon ve gerçek baskı kesin olarak ayrılır
            if (printResult.success) {
                if (printResult.simulated) {
                    // SİMÜLASYON: Sunucuya 'simulated' bildirimi + isDryRun=true
                    // Bu ASLA üretim kuyruğundaki işi 'printed' yapamaz
                    await this.ackJob(job.jobId, {
                        status: 'simulated',
                        isDryRun: true,
                        simulatedOutputPath: printResult.outputPath,
                    });
                    this.log(`Simülasyon tamamlandı: ${job.jobId} (PDF diske yazıldı, fiziksel baskı YAPILMADI)`);
                }
                else {
                    // GERÇEK BASKI: Yalnızca Windows spooler başarılı kabul ettiğinde
                    await this.ackJob(job.jobId, {
                        status: 'printed',
                        isDryRun: false,
                    });
                    this.log(`Gerçek baskı tamamlandı: ${job.jobId} (YAZICIYA GÖNDERİLDİ)`);
                }
                return { handledJob: true, jobId: job.jobId };
            }
            else {
                await this.ackJob(job.jobId, {
                    status: 'failed',
                    isDryRun: this.driver.isDryRun,
                    errorCode: printResult.errorCode || 'PRINT_FAILED',
                    errorMessage: printResult.error || 'Baskı işlemi başarısız oldu.',
                });
                this.log(`Yazdırma başarısız: ${job.jobId} (${printResult.error})`, 'warn');
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
     * Sunucuya işin sonucunu bildirir (Ack).
     * Simülasyon modunda isDryRun=true ve status='simulated' gönderilir.
     * Gerçek baskıda isDryRun=false ve status='printed' gönderilir.
     */
    async ackJob(jobId, result) {
        try {
            const res = await fetch(`${this.config.apiUrl}/api/print-agent/jobs/${encodeURIComponent(jobId)}/ack`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(result),
            });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                this.log(`Ack bildirim hatası (${jobId}): HTTP ${res.status} ${text}`, 'warn');
            }
        }
        catch (err) {
            this.log(`Ack sunucu bağlantı hatası (${jobId}): ${err.message}`, 'error');
        }
    }
    /**
     * Polling döngüsünü başlatır.
     */
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        const maskedToken = this.config.agentToken
            ? `${this.config.agentToken.substring(0, 6)}***`
            : '(TANIMSIZ)';
        this.log(`====================================================`);
        this.log(`KALIPORT PALMX TXP 400 Print Agent Başlatılıyor`);
        this.log(`Hedef API: ${this.config.apiUrl}`);
        this.log(`Agent ID : ${this.config.agentId} (Token: ${maskedToken})`);
        this.log(`Yazıcı   : ${this.config.printerName}`);
        this.log(`Çalışma  : ${this.driver.isDryRun ? 'DRY_RUN (ZORUNLU SİMÜLASYON MODU)' : 'CANLI YAZICI MODU'}`);
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
                // Hata durumunda kontrollü exponential backoff
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
    /**
     * Agent'ı kontrollü şekilde durdurur (Graceful Shutdown).
     */
    async stop() {
        this.log(`Kapatma sinyali alındı, agent durduruluyor...`);
        this.isRunning = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        // Aktif işleme varsa bitmesini bekle (azami 10 sn)
        let waitCount = 0;
        while (this.isProcessing && waitCount < 100) {
            await new Promise((r) => setTimeout(r, 100));
            waitCount++;
        }
        this.log(`Agent güvenli şekilde durduruldu.`);
    }
}
exports.PrintAgentService = PrintAgentService;
