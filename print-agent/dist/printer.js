"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WindowsPrinterDriver = exports.SimulatedPrinterDriver = void 0;
exports.createPrinterDriver = createPrinterDriver;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
/**
 * 1. Simülasyon Yazıcı Sürücüsü (Dry Run)
 * Fiziksel yazıcıya hiçbir veri göndermez; PDF'i simüle edilmiş çıktı klasörüne yazar.
 */
class SimulatedPrinterDriver {
    name = 'PALMX TXP 400 (Simülasyon Modu)';
    isDryRun = true;
    outputDir;
    constructor(outputDir = './simulated_prints') {
        this.outputDir = path_1.default.resolve(outputDir);
        if (!fs_1.default.existsSync(this.outputDir)) {
            fs_1.default.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    async printPdf(pdfBuffer, job) {
        // 1. PDF Bütünlük Doğrulaması (%PDF-)
        if (!pdfBuffer || pdfBuffer.length < 5) {
            return {
                success: false,
                status: 'failed',
                printed: false,
                simulated: true,
                error: 'PDF verisi boş veya geçersiz boyutta.',
                errorCode: 'INVALID_PDF_DATA',
            };
        }
        const header = pdfBuffer.subarray(0, 5).toString('ascii');
        if (header !== '%PDF-') {
            return {
                success: false,
                status: 'failed',
                printed: false,
                simulated: true,
                error: 'İndirilen dosya geçerli bir PDF formatında değil (%PDF- başlığı eksik).',
                errorCode: 'CORRUPTED_PDF_HEADER',
            };
        }
        // 2. Simülasyon Çıktı Dosyası Oluştur
        const safeJobId = (job.jobId || 'job_sample').replace(/[^a-zA-Z0-9_-]/g, '_');
        const fileName = `${safeJobId}.pdf`;
        const filePath = path_1.default.join(this.outputDir, fileName);
        try {
            fs_1.default.writeFileSync(filePath, pdfBuffer);
            // Gerçekçi termal baskı süresi simülasyonu (100ms)
            await new Promise((resolve) => setTimeout(resolve, 100));
            // KRİTİK GÜVENLİK: Simülasyon başarılı olsa da printed=false kalır.
            // PDF diske yazıldı ama fiziksel kâğıda çıkmadı.
            // Agent bu sonucu sunucuya 'simulated' olarak bildirmelidir, 'printed' DEĞİL.
            return {
                success: true,
                status: 'simulated',
                printed: false,
                simulated: true,
                outputPath: filePath,
            };
        }
        catch (err) {
            return {
                success: false,
                status: 'failed',
                printed: false,
                simulated: true,
                error: `Simülasyon dosyası yazılamadı: ${err.message}`,
                errorCode: 'FILE_WRITE_ERROR',
            };
        }
    }
}
exports.SimulatedPrinterDriver = SimulatedPrinterDriver;
/**
 * 2. Gerçek Windows Termal Yazıcı Sürücüsü (PALMX TXP 400)
 * Yalnızca Windows ortamında ve DRY_RUN=false iken devreye girer.
 */
class WindowsPrinterDriver {
    name;
    isDryRun = false;
    printerName;
    constructor(printerName = '4BARCODE 4B-2054TG') {
        this.printerName = printerName.trim();
        this.name = `${this.printerName} (Windows Sürücüsü)`;
    }
    /**
     * Windows işletim sisteminde yazıcının kurulu olup olmadığını denetler.
     */
    async checkPrinterInstalled() {
        if (process.platform !== 'win32') {
            return { installed: false, error: 'Windows dışı platformda yazıcı denetlenemez.' };
        }
        try {
            const psCommand = `Get-Printer -Name '${this.printerName.replace(/'/g, "''")}' | Select-Object -Property Name, PrinterStatus, PortName, DriverName | ConvertTo-Json -Compress`;
            const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], { timeout: 10000 });
            if (!stdout || stdout.trim().length === 0) {
                return { installed: false, error: `Yazıcı bulunamadı: '${this.printerName}'` };
            }
            return { installed: true, status: 'OK' };
        }
        catch (err) {
            return {
                installed: false,
                error: `Windows yazıcı sorgusu başarısız: '${this.printerName}' bulunamadı veya erişilemedi (${err.message})`,
            };
        }
    }
    async printPdf(pdfBuffer, job) {
        if (process.platform !== 'win32') {
            return {
                success: false,
                status: 'failed',
                printed: false,
                simulated: false,
                error: `WindowsPrinterDriver yalnızca Windows işletim sisteminde çalışır. Mevcut platform: ${process.platform}`,
                errorCode: 'UNSUPPORTED_PLATFORM',
            };
        }
        // 1. PDF Bütünlük Doğrulaması
        if (!pdfBuffer || pdfBuffer.length < 5 || pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
            return {
                success: false,
                status: 'failed',
                printed: false,
                simulated: false,
                error: 'Geçersiz veya bozuk PDF verisi.',
                errorCode: 'INVALID_PDF_DATA',
            };
        }
        // Geçici PDF dosyası oluştur
        const tempDir = os_1.default.tmpdir();
        const tempPdfPath = path_1.default.join(tempDir, `print_${job.jobId || 'job'}_${Date.now()}.pdf`);
        try {
            fs_1.default.writeFileSync(tempPdfPath, pdfBuffer);
            // Windows Spooler / PDF Yazdırma Seçenekleri Sırasıyla:
            // 1. SumatraPDF.exe -print-to "<printerName>" -print-settings "shrink" -silent "<pdfPath>"
            // 2. PDFtoPrinter.exe "<pdfPath>" "<printerName>"
            // 3. PowerShell Fallback: Start-Process -Verb PrintTo
            let printedOk = false;
            let lastErrMsg = '';
            // A. SumatraPDF kontrolü (Varsa en stabil ve sessiz çalışan termal yazdırma aracı)
            try {
                await execFileAsync('SumatraPDF.exe', [
                    '-print-to',
                    this.printerName,
                    '-print-settings',
                    'shrink',
                    '-silent',
                    tempPdfPath,
                ], { timeout: 30000 });
                printedOk = true;
            }
            catch (sumatraErr) {
                lastErrMsg = `SumatraPDF: ${sumatraErr.message}`;
            }
            // B. PDFtoPrinter kontrolü (Sumatra yoksa)
            if (!printedOk) {
                try {
                    await execFileAsync('PDFtoPrinter.exe', [
                        tempPdfPath,
                        this.printerName,
                    ], { timeout: 30000 });
                    printedOk = true;
                }
                catch (pdfToPrinterErr) {
                    lastErrMsg = `PDFtoPrinter: ${pdfToPrinterErr.message}`;
                }
            }
            // C. PowerShell Fallback (Yerel PDF ilişkilendiricisi ile)
            if (!printedOk) {
                try {
                    const psCommand = `Start-Process -FilePath '${tempPdfPath.replace(/'/g, "''")}' -Verb PrintTo -ArgumentList '${this.printerName.replace(/'/g, "''")}' -PassThru | Wait-Process -Timeout 30`;
                    await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], { timeout: 35000 });
                    printedOk = true;
                }
                catch (psErr) {
                    lastErrMsg = `PowerShell Fallback: ${psErr.message}`;
                }
            }
            if (!printedOk) {
                return {
                    success: false,
                    status: 'failed',
                    printed: false,
                    simulated: false,
                    error: `Yazıcıya gönderme başarısız oldu (${this.printerName}). Hata: ${lastErrMsg}. Lütfen SumatraPDF.exe veya PDFtoPrinter.exe aracının kurulu ve PATH üzerinde olduğunu teyit edin.`,
                    errorCode: 'PRINT_SPOOLER_ERROR',
                };
            }
            // ÖNEMLİ TEKNİK NOT (Spooler vs Fiziksel Çıktı):
            // Windows spooler'ın baskı isteğini başarıyla kabul etmesi (printedOk=true),
            // kâğıdın fiziksel olarak termal yazıcıdan çıktığını garanti etmez.
            // Yazıcıda kâğıt bitmiş, kapak açık veya USB kablosu temassız olabilir.
            // Bu, Windows yazdırma mimarisinin (GDI Spooler) genel bir doğasıdır.
            return {
                success: true,
                status: 'printed',
                printed: true,
                simulated: false,
            };
        }
        catch (err) {
            return {
                success: false,
                status: 'failed',
                printed: false,
                simulated: false,
                error: `Yazdırma işlemi sırasında beklenmeyen hata: ${err.message}`,
                errorCode: 'PRINT_EXECUTION_ERROR',
            };
        }
        finally {
            // Geçici dosyayı diskten temizle
            if (fs_1.default.existsSync(tempPdfPath)) {
                try {
                    fs_1.default.unlinkSync(tempPdfPath);
                }
                catch {
                    // Yoksay
                }
            }
        }
    }
}
exports.WindowsPrinterDriver = WindowsPrinterDriver;
/**
 * Konfigürasyona ve ortama göre uygun yazıcı sürücüsünü fabrikalar.
 */
function createPrinterDriver(config) {
    // Zorunlu Simülasyon Koruması: DRY_RUN=true veya Windows dışı platform
    if (config.dryRun || process.platform !== 'win32') {
        return new SimulatedPrinterDriver(config.outputDir);
    }
    // KRİTİK GÜVENLİK: dryRun=false + win32 iken PRINTER_NAME zorunludur
    const printerName = (config.printerName || '').trim();
    if (!printerName) {
        throw new Error('Gerçek baskı modu (dryRun=false) için PRINTER_NAME yapılandırması zorunludur. Agent başlatılamaz.');
    }
    return new WindowsPrinterDriver(printerName);
}
