import fs from 'fs'
import path from 'path'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { PrintJob, PrinterDriver, PrinterResult, PrintAgentConfig } from './types'

const execFileAsync = promisify(execFile)

/**
 * 1. Simülasyon Yazıcı Sürücüsü (Dry Run)
 * Fiziksel yazıcıya hiçbir veri göndermez; PDF'i simüle edilmiş çıktı klasörüne yazar.
 */
export class SimulatedPrinterDriver implements PrinterDriver {
  name = 'PALMX TXP 400 (Simülasyon Modu)'
  isDryRun = true
  private outputDir: string

  constructor(outputDir: string = './simulated_prints') {
    this.outputDir = path.resolve(outputDir)
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true })
    }
  }

  async printPdf(pdfBuffer: Buffer, job: PrintJob): Promise<PrinterResult> {
    if (!pdfBuffer || pdfBuffer.length < 5) {
      return {
        success: false,
        status: 'failed',
        printed: false,
        simulated: true,
        error: 'PDF verisi boş veya geçersiz boyutta.',
        errorCode: 'INVALID_PDF_DATA',
      }
    }

    const header = pdfBuffer.subarray(0, 5).toString('ascii')
    if (header !== '%PDF-') {
      return {
        success: false,
        status: 'failed',
        printed: false,
        simulated: true,
        error: 'İndirilen dosya geçerli bir PDF formatında değil (%PDF- başlığı eksik).',
        errorCode: 'CORRUPTED_PDF_HEADER',
      }
    }

    const safeJobId = (job.jobId || 'job_sample').replace(/[^a-zA-Z0-9_-]/g, '_')
    const fileName = `${safeJobId}.pdf`
    const filePath = path.join(this.outputDir, fileName)

    try {
      fs.writeFileSync(filePath, pdfBuffer)
      await new Promise((resolve) => setTimeout(resolve, 100))

      return {
        success: true,
        status: 'simulated',
        printed: false,
        simulated: true,
        outputPath: filePath,
      }
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        printed: false,
        simulated: true,
        error: `Simülasyon dosyası yazılamadı: ${err.message}`,
        errorCode: 'FILE_WRITE_ERROR',
      }
    }
  }
}

/**
 * Windows ortamında SumatraPDF.exe ikilisini öncelik sırasıyla arar.
 * Asla GUI açan Start-Process -Verb PrintTo fallback'i kullanılmaz.
 */
export function resolveSumatraPdfExecutable(customPath?: string): string | null {
  const candidates: string[] = []
  if (customPath && customPath.trim()) {
    candidates.push(path.resolve(customPath.trim()))
  }

  candidates.push(
    path.join(process.cwd(), 'SumatraPDF.exe'),
    path.join(__dirname, 'SumatraPDF.exe'),
    path.join(__dirname, '..', 'SumatraPDF.exe'),
    'C:\\KaliportPrintAgent\\SumatraPDF.exe'
  )

  if (process.env.LOCALAPPDATA) {
    candidates.push(path.join(process.env.LOCALAPPDATA, 'SumatraPDF', 'SumatraPDF.exe'))
  }
  candidates.push(
    'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
    'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe'
  )

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

/**
 * SumatraPDF CLI argümanlarını güvenli şekilde oluşturur.
 * -print-to-default ASLA kullanılmaz; her zaman hedef yazıcı adı açıkça verilir.
 */
export function buildSumatraPrintArgs(
  printerName: string,
  pdfPath: string,
  printSettings: string = 'noscale'
): string[] {
  const cleanPrinter = printerName.trim()
  if (!cleanPrinter) {
    throw new Error('Hedef yazıcı adı boş olamaz.')
  }
  const args = ['-print-to', cleanPrinter, '-silent']
  if (printSettings && printSettings.trim()) {
    args.push('-print-settings', printSettings.trim())
  }
  args.push(pdfPath)
  return args
}

/**
 * 2. Gerçek Windows Termal Yazıcı Sürücüsü (PALMX TXP 400 / Windows adı: 4BARCODE 4B-2054TG)
 * Yalnızca Windows ortamında ve DRY_RUN=false iken SumatraPDF.exe CLI ile sessiz baskı yapar.
 * GUI / Print Dialog açabilen Start-Process -Verb PrintTo fallback'i kesinlikle KALDIRILMIŞTIR.
 */
export class WindowsPrinterDriver implements PrinterDriver {
  name: string
  isDryRun = false
  public printerName: string
  public sumatraPdfPath?: string
  public printSettings: string

  constructor(
    printerName: string = '4BARCODE 4B-2054TG',
    options?: { sumatraPdfPath?: string; printSettings?: string }
  ) {
    this.printerName = printerName.trim()
    this.sumatraPdfPath = options?.sumatraPdfPath
    this.printSettings = options?.printSettings || 'noscale'
    this.name = `${this.printerName} (Windows SumatraPDF Sessiz Sürücü)`
  }

  /**
   * Windows işletim sisteminde yazıcının kurulu ve çevrimiçi (offline değil) olduğunu denetler.
   */
  async checkPrinterInstalled(): Promise<{
    installed: boolean
    offline?: boolean
    status?: string
    error?: string
  }> {
    if (process.platform !== 'win32') {
      return { installed: false, error: 'Windows dışı platformda yazıcı denetlenemez.' }
    }

    try {
      const escapedName = this.printerName.replace(/'/g, "''")
      const psCommand = `Get-Printer -Name '${escapedName}' | Select-Object -Property Name, PrinterStatus, WorkOffline, PortName, DriverName | ConvertTo-Json -Compress`
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], {
        timeout: 10000,
      })
      if (!stdout || stdout.trim().length === 0) {
        return { installed: false, error: `Yazıcı bulunamadı: '${this.printerName}'` }
      }

      try {
        const parsed = JSON.parse(stdout.trim())
        const printerStatus = String(parsed.PrinterStatus || '')
        const isOffline =
          parsed.WorkOffline === true ||
          printerStatus.toLowerCase().includes('offline') ||
          printerStatus.toLowerCase().includes('error')
        return {
          installed: true,
          offline: isOffline,
          status: printerStatus || 'Normal',
          ...(isOffline ? { error: `Yazıcı çevrimdışı veya hata durumunda (${printerStatus}).` } : {}),
        }
      } catch {
        return { installed: true, offline: false, status: 'OK' }
      }
    } catch (err: any) {
      return {
        installed: false,
        error: `Windows yazıcı sorgusu başarısız: '${this.printerName}' bulunamadı veya erişilemedi (${err.message})`,
      }
    }
  }

  /**
   * Baskı gönderildikten sonra Windows Spooler kuyruğundaki son iş ID'sini sorgular (best-effort).
   */
  async queryLatestSpoolerJobId(): Promise<string | undefined> {
    if (process.platform !== 'win32') return undefined
    try {
      const escapedName = this.printerName.replace(/'/g, "''")
      const psCommand = `Get-PrintJob -PrinterName '${escapedName}' -ErrorAction SilentlyContinue | Sort-Object -Property SubmittedTime -Descending | Select-Object -First 1 -Property Id, JobStatus | ConvertTo-Json -Compress`
      const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', psCommand], {
        timeout: 8000,
      })
      if (!stdout || !stdout.trim()) return undefined
      const parsed = JSON.parse(stdout.trim())
      if (parsed && parsed.Id !== undefined && parsed.Id !== null) {
        return String(parsed.Id)
      }
      return undefined
    } catch {
      return undefined
    }
  }

  async printPdf(pdfBuffer: Buffer, job: PrintJob): Promise<PrinterResult> {
    if (process.platform !== 'win32') {
      return {
        success: false,
        status: 'failed',
        printed: false,
        simulated: false,
        printerName: this.printerName,
        error: `WindowsPrinterDriver yalnızca Windows işletim sisteminde çalışır. Mevcut platform: ${process.platform}`,
        errorCode: 'UNSUPPORTED_PLATFORM',
      }
    }

    // 1. PDF Bütünlük Doğrulaması
    if (!pdfBuffer || pdfBuffer.length < 5 || pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return {
        success: false,
        status: 'failed',
        printed: false,
        simulated: false,
        printerName: this.printerName,
        error: 'Geçersiz veya bozuk PDF verisi.',
        errorCode: 'INVALID_PDF_DATA',
      }
    }

    // 2. Yazıcı Varlık & Çevrimiçi Kontrolü
    const printerCheck = await this.checkPrinterInstalled()
    if (!printerCheck.installed) {
      return {
        success: false,
        status: 'failed',
        printed: false,
        simulated: false,
        printerName: this.printerName,
        error: printerCheck.error || `Hedef yazıcı bulunamadı: ${this.printerName}`,
        errorCode: 'PRINTER_NOT_FOUND',
      }
    }
    if (printerCheck.offline) {
      return {
        success: false,
        status: 'failed',
        printed: false,
        simulated: false,
        printerName: this.printerName,
        error: printerCheck.error || `Hedef yazıcı çevrimdışı: ${this.printerName}`,
        errorCode: 'PRINTER_OFFLINE',
      }
    }

    // 3. SumatraPDF.exe Tespiti (GUI açan PrintTo fallback KESİNLİKLE YOK)
    const sumatraExe = resolveSumatraPdfExecutable(this.sumatraPdfPath) || 'SumatraPDF.exe'

    const tempDir = os.tmpdir()
    const safeId = (job.jobId || 'job').replace(/[^a-zA-Z0-9_-]/g, '_')
    const tempPdfPath = path.join(tempDir, `print_${safeId}_${Date.now()}.pdf`)

    try {
      fs.writeFileSync(tempPdfPath, pdfBuffer)

      const args = buildSumatraPrintArgs(this.printerName, tempPdfPath, this.printSettings)
      console.log(
        `[PRINT-DRIVER] Print process started: "${sumatraExe}" -print-to "${this.printerName}" -silent -print-settings "${this.printSettings}"`
      )

      try {
        await execFileAsync(sumatraExe, args, { timeout: 30000 })
      } catch (sumatraErr: any) {
        const isNotFound =
          sumatraErr?.code === 'ENOENT' ||
          String(sumatraErr?.message || '').toLowerCase().includes('enoent')

        return {
          success: false,
          status: 'failed',
          printed: false,
          simulated: false,
          printerName: this.printerName,
          error: isNotFound
            ? `SumatraPDF.exe bulunamadı (${sumatraExe}). Sessiz yazdırma için SumatraPDF.exe C:\\KaliportPrintAgent\\SumatraPDF.exe konumuna yerleştirilmelidir. GUI açan PrintTo fallback güvenlik gereği devre dışıdır.`
            : `SumatraPDF sessiz baskı başarısız (${this.printerName}): ${sumatraErr.message}`,
          errorCode: isNotFound ? 'SUMATRA_NOT_FOUND' : 'SUMATRA_PRINT_ERROR',
        }
      }

      const submittedToSpoolerAt = new Date().toISOString()
      const spoolerJobId = await this.queryLatestSpoolerJobId()

      console.log(
        `[PRINT-DRIVER] Submitted to Windows spooler: printer="${this.printerName}" spoolerJobId=${spoolerJobId || 'N/A'}`
      )

      return {
        success: true,
        status: 'printed',
        printed: true,
        simulated: false,
        printerName: this.printerName,
        spoolerJobId,
        submittedToSpoolerAt,
      }
    } catch (err: any) {
      return {
        success: false,
        status: 'failed',
        printed: false,
        simulated: false,
        printerName: this.printerName,
        error: `Yazdırma işlemi sırasında beklenmeyen hata: ${err.message}`,
        errorCode: 'PRINT_EXECUTION_ERROR',
      }
    } finally {
      if (fs.existsSync(tempPdfPath)) {
        try {
          fs.unlinkSync(tempPdfPath)
        } catch {
          // Yoksay
        }
      }
    }
  }
}

/**
 * Konfigürasyona ve ortama göre uygun yazıcı sürücüsünü fabrikalar.
 */
export function createPrinterDriver(config: PrintAgentConfig): PrinterDriver {
  if (config.dryRun || process.platform !== 'win32') {
    return new SimulatedPrinterDriver(config.outputDir)
  }

  const printerName = (config.printerName || '').trim()
  if (!printerName) {
    throw new Error(
      'Gerçek baskı modu (dryRun=false) için PRINTER_NAME yapılandırması zorunludur. Agent başlatılamaz.'
    )
  }

  return new WindowsPrinterDriver(printerName, {
    sumatraPdfPath: config.sumatraPdfPath,
    printSettings: config.printSettings || 'noscale',
  })
}
