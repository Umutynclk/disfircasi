import fs from 'fs'
import path from 'path'
import { PrintAgentService } from './agent'
import { PrintAgentConfig, PrintJob } from './types'
import { createPrinterDriver, WindowsPrinterDriver } from './printer'
import { createMinimalSampleLabelPdf } from './sample'

function loadConfig(): Partial<PrintAgentConfig> {
  const configPath = path.resolve(process.cwd(), 'print-agent/config.json')
  const localConfigPath = path.resolve(process.cwd(), 'config.json')
  let fileConfig: Partial<PrintAgentConfig> = {}

  const targetPath = fs.existsSync(configPath) ? configPath : fs.existsSync(localConfigPath) ? localConfigPath : null

  if (targetPath) {
    try {
      const content = fs.readFileSync(targetPath, 'utf-8')
      fileConfig = JSON.parse(content)
      console.log(`[BAŞLANGIÇ] Konfigürasyon yüklendi: ${targetPath}`)
    } catch (e: any) {
      console.warn(`[UYARI] config.json okunamadı, ortam değişkenleri kullanılacak: ${e.message}`)
    }
  }

  return {
    apiUrl: process.env.PRINT_AGENT_API_URL || fileConfig.apiUrl,
    agentId: process.env.PRINT_AGENT_ID || fileConfig.agentId,
    agentToken: process.env.PRINT_AGENT_TOKEN || fileConfig.agentToken,
    printerName: process.env.PRINT_PRINTER_NAME || fileConfig.printerName,
    pollIntervalMs: process.env.PRINT_POLL_INTERVAL_MS ? Number(process.env.PRINT_POLL_INTERVAL_MS) : fileConfig.pollIntervalMs,
    dryRun: process.env.DRY_RUN !== undefined ? process.env.DRY_RUN !== 'false' : fileConfig.dryRun,
    outputDir: process.env.PRINT_OUTPUT_DIR || fileConfig.outputDir,
  }
}

/**
 * Kontrollü Numune Baskı Testi (CLI Modu: --test-sample)
 * Canlı sunucuya bağlanmaz, üretim kuyruğuna dokunmaz.
 * Yalnızca tek bir numune etiket üretir ve mevcut sürücüye (Simülasyon veya Windows) gönderir.
 */
async function runSampleTest(config: Partial<PrintAgentConfig>) {
  console.log('====================================================')
  console.log('🧪 KALIPORT PALMX TXP 400 KONTROLLÜ NUMUNE BASKI TESTİ')
  console.log('====================================================')

  const fullConfig: PrintAgentConfig = {
    apiUrl: config.apiUrl || process.env.PRINT_AGENT_API_URL || 'https://sonrakam.com',
    agentId: config.agentId || 'test-sample-agent',
    agentToken: config.agentToken || '',
    printerName: config.printerName || '4BARCODE 4B-2054TG',
    pollIntervalMs: 5000,
    errorBackoffMs: 10000,
    maxBackoffMs: 30000,
    dryRun: config.dryRun !== undefined ? config.dryRun : true,
    outputDir: config.outputDir || './simulated_prints',
  }

  console.log(`Mod      : ${fullConfig.dryRun ? 'SİMÜLASYON (DRY_RUN=true)' : 'CANLI YAZICI BASKISI (DRY_RUN=false)'}`)
  console.log(`Yazıcı   : ${fullConfig.printerName}`)
  console.log(`Platform : ${process.platform}`)

  // Windows'ta canlı moddaysa yazıcı varlığını kontrol et
  if (!fullConfig.dryRun && process.platform === 'win32') {
    const winDriver = new WindowsPrinterDriver(fullConfig.printerName)
    const check = await winDriver.checkPrinterInstalled()
    if (!check.installed) {
      console.error(`❌ YAZICI BULUNAMADI: ${check.error}`)
      console.error('Lütfen Windows Aygıtlar ve Yazıcılar altındaki yazıcı adının birebir eşleştiğini kontrol edin.')
      process.exit(1)
    }
    console.log(`✅ Yazıcı Windows üzerinde başarıyla tespit edildi (${fullConfig.printerName}).`)
  }

  // 1. Sentetik Numune PDF Oluştur
  const samplePdf = createMinimalSampleLabelPdf({
    barcode: 'HJ-TEST-9876543210TR',
    recipientName: 'Test Alici (Numune)',
    city: 'ISTANBUL',
    widthMm: 150,
    heightMm: 100,
  })

  const dummyJob: PrintJob = {
    jobId: `job_sample_manual_${Date.now()}`,
    orderId: null,
    barcode: 'HJ-TEST-9876543210TR',
    type: 'shipping_label',
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attemptCount: 1,
    maxAttempts: 1,
    idempotencyKey: 'job_sample_manual',
    printerId: fullConfig.printerName,
  }

  // 2. Sürücüyü Başlat ve Yazdır
  const driver = createPrinterDriver(fullConfig)
  console.log(`Sürücü   : ${driver.name}`)
  console.log('Numune baskı gönderiliyor...')

  const result = await driver.printPdf(samplePdf, dummyJob)

  console.log('====================================================')
  if (result.success) {
    if (result.simulated) {
      console.log('✅ SİMÜLASYON BAŞARILI!')
      console.log(`📁 PDF Dosyası Diske Yazıldı: ${result.outputPath}`)
      console.log('ℹ️ Fiziksel yazıcıya hiçbir veri gönderilmedi (DRY_RUN koruması aktif).')
    } else {
      console.log('🖨️ FİZİKSEL BASKI BAŞARIYLA WINDOWS SPOOLER\'A GÖNDERİLDİ!')
      console.log('ℹ️ Lütfen PALMX TXP 400 yazıcısından kâğıt çıktısını kontrol edin.')
      console.log('Kontrol Listesi:')
      console.log(' - Etiket boyutu 150x100mm veya 100x150mm mi?')
      console.log(' - Barkod ve (NUMUNE) yazısı net mi?')
      console.log(' - Taşan veya eksik kenar var mı?')
    }
  } else {
    console.error(`❌ NUMUNE BASKI BAŞARISIZ: ${result.error} (Kod: ${result.errorCode})`)
    process.exit(1)
  }
  console.log('====================================================')
}

async function main() {
  const config = loadConfig()
  const args = process.argv.slice(2)

  // 1. Numune Testi Komutu: --test-sample
  if (args.includes('--test-sample')) {
    await runSampleTest(config)
    return
  }

  // 2. Standart Daemon Modu (Yoklama ve kuyruk işleme)
  const agent = new PrintAgentService(config)

  const shutdown = async (signal: string) => {
    console.log(`\n[SİNYAL] ${signal} alındı. Agent kapatılıyor...`)
    await agent.stop()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  agent.start()
}

if (require.main === module || process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js')) {
  main().catch((err) => {
    console.error('[FATAL] Print Agent başlatılamadı:', err)
    process.exit(1)
  })
}
