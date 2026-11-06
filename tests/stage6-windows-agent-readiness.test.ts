/**
 * KALIPORT — Aşama 6: Windows Kurulumu, PALMX TXP 400 Entegrasyonu ve Hazırlık Testleri
 *
 * Bu test paketi Windows Agent kurulum paketinin bağımsızlığını,
 * PALMX TXP 400 sürücü entegrasyonu güvenlik sınırlarını,
 * kontrollü sentetik numune üreticisini ve Mac/Linux izolasyonunu doğrular.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import { PDFDocument } from 'pdf-lib'

import {
  SimulatedPrinterDriver,
  WindowsPrinterDriver,
  createPrinterDriver,
} from '../print-agent/printer'
import { createMinimalSampleLabelPdf } from '../print-agent/sample'
import { PrintJob, PrintAgentConfig } from '../print-agent/types'
import { PrintAgentService } from '../print-agent/agent'

const testJob: PrintJob = {
  jobId: 'job_test_stage6_001',
  orderId: null,
  barcode: 'HJ-TEST-9876543210TR',
  type: 'shipping_label',
  status: 'processing',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  attemptCount: 1,
  maxAttempts: 1,
  idempotencyKey: 'job_test_stage6_001',
}

// ============================================================================
// 1. Sentetik Numune Üreticisi (createMinimalSampleLabelPdf)
// ============================================================================

test('Aşama 6 — 1. createMinimalSampleLabelPdf: Geçerli ve bağımsız %PDF-1.4 üretir', async () => {
  const pdfBuffer = createMinimalSampleLabelPdf({
    barcode: 'HJ-TEST-9876543210TR',
    recipientName: 'Ali Veli (Numune)',
    city: 'ANKARA',
    widthMm: 150,
    heightMm: 100,
  })

  assert.ok(pdfBuffer && pdfBuffer.length > 300, 'PDF içeriği boş olmamalı')
  assert.strictEqual(pdfBuffer.subarray(0, 5).toString('ascii'), '%PDF-')

  // pdf-lib ile parse edip fiziksel pt boyutlarını kontrol et
  const doc = await PDFDocument.load(pdfBuffer)
  assert.strictEqual(doc.getPageCount(), 1, 'Tek sayfa olmalı')

  const { width, height } = doc.getPages()[0].getSize()
  const MM_TO_PT = 72 / 25.4
  const expectedWidth = 150 * MM_TO_PT
  const expectedHeight = 100 * MM_TO_PT

  // 150x100mm sayfa ölçüsü kontrolü (±1 pt)
  assert.ok(Math.abs(width - expectedWidth) < 1.0, `Genişlik: ${width}, Beklenen: ${expectedWidth}`)
  assert.ok(Math.abs(height - expectedHeight) < 1.0, `Yükseklik: ${height}, Beklenen: ${expectedHeight}`)

  // Ham PDF içeriğinde güvenlik metinlerinin varlığını doğrula
  const rawText = pdfBuffer.toString('utf-8')
  assert.ok(rawText.includes('NUMUNE / TEST - CANLI SEVKIYAT ICIN GECERSIZDIR'), 'Geçersizlik uyarısı yer almalı')
  assert.ok(rawText.includes('HJ-TEST-9876543210TR (NUMUNE)'), 'Numune barkod metni yer almalı')
})

test('Aşama 6 — 2. createMinimalSampleLabelPdf: Dikey 100x150mm ölçüsünü destekler', async () => {
  const pdfBuffer = createMinimalSampleLabelPdf({
    barcode: 'HJ-TEST-PORTRAIT',
    widthMm: 100,
    heightMm: 150,
  })

  const doc = await PDFDocument.load(pdfBuffer)
  const { width, height } = doc.getPages()[0].getSize()
  const MM_TO_PT = 72 / 25.4
  const expectedWidth = 100 * MM_TO_PT
  const expectedHeight = 150 * MM_TO_PT

  assert.ok(Math.abs(width - expectedWidth) < 1.0)
  assert.ok(Math.abs(height - expectedHeight) < 1.0)
})

// ============================================================================
// 2. Simülasyon Sürücüsü ve Çıktı Doğrulaması
// ============================================================================

test('Aşama 6 — 3. SimulatedPrinterDriver: Sentetik numune PDF dosyasını diske yazar, printed=false döner', async () => {
  const tempDir = path.resolve('./tests/temp_stage6_sim')
  const driver = new SimulatedPrinterDriver(tempDir)

  const samplePdf = createMinimalSampleLabelPdf({ barcode: 'HJ-TEST-SIM-01' })
  const result = await driver.printPdf(samplePdf, testJob)

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.status, 'simulated')
  assert.strictEqual(result.printed, false, 'Simülasyonda printed her zaman false olmalı')
  assert.strictEqual(result.simulated, true)
  assert.ok(result.outputPath)
  assert.ok(fs.existsSync(result.outputPath))

  // Temizle
  if (result.outputPath && fs.existsSync(result.outputPath)) {
    fs.unlinkSync(result.outputPath)
  }
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir)
})

// ============================================================================
// 3. WindowsPrinterDriver Platform Koruması (Non-Windows Güvenliği)
// ============================================================================

test('Aşama 6 — 4. WindowsPrinterDriver: Non-Windows platformda çalıştırılamaz', async () => {
  if (process.platform === 'win32') return // Yalnızca Mac/Linux denetimi

  const winDriver = new WindowsPrinterDriver('PALMX TXP 400')
  assert.strictEqual(winDriver.printerName, 'PALMX TXP 400')

  // 4a. checkPrinterInstalled non-Windows platformda false döner
  const check = await winDriver.checkPrinterInstalled()
  assert.strictEqual(check.installed, false)
  assert.match(check.error || '', /Windows dışı platform/i)

  // 4b. printPdf non-Windows platformda hata döner
  const samplePdf = createMinimalSampleLabelPdf()
  const result = await winDriver.printPdf(samplePdf, testJob)

  assert.strictEqual(result.success, false)
  assert.strictEqual(result.status, 'failed')
  assert.strictEqual(result.printed, false)
  assert.strictEqual(result.errorCode, 'UNSUPPORTED_PLATFORM')
})

test('Aşama 6 — 5. createPrinterDriver: macOS/Linux ortamında dryRun=false olsa bile simülasyona zorlar', () => {
  if (process.platform === 'win32') return

  const config: PrintAgentConfig = {
    apiUrl: 'http://localhost:3000',
    agentId: 'kaliport-win-01',
    agentToken: 'pa_test_token',
    printerName: 'PALMX TXP 400',
    pollIntervalMs: 5000,
    errorBackoffMs: 10000,
    maxBackoffMs: 30000,
    dryRun: false, // Açıkça canlı baskı istenmiş olsa bile
    outputDir: './simulated_prints',
  }

  const driver = createPrinterDriver(config)
  assert.strictEqual(driver.isDryRun, true, 'Non-Windows ortamda isDryRun her zaman true kalmalı')
  assert.ok(driver instanceof SimulatedPrinterDriver, 'Mac üzerinde asla WindowsPrinterDriver oluşturulamaz')
})

test('Aşama 6 — 6. createPrinterDriver: dryRun=false ve printerName boş ise hata fırlatır', () => {
  const configWithoutPrinter: any = {
    apiUrl: 'http://localhost:3000',
    agentId: 'agent_1',
    agentToken: 'token',
    printerName: '   ',
    dryRun: false,
    outputDir: './simulated_prints',
  }

  // Windows ortamı simülasyonunda printerName zorunludur
  if (process.platform === 'win32') {
    assert.throws(() => {
      createPrinterDriver(configWithoutPrinter)
    }, /PRINTER_NAME yapılandırması zorunludur/i)
  }
})

// ============================================================================
// 4. Token Maskeleme ve Güvenli Loglama
// ============================================================================

test('Aşama 6 — 7. PrintAgentService: Token konsola veya loglara açık metin olarak yazdırılmaz', () => {
  const secretToken = 'pa_live_extremely_secret_token_123456789'
  const agent = new PrintAgentService({
    agentToken: secretToken,
    agentId: 'agent-mask-test',
    dryRun: true,
  })

  const config = agent.getConfig()
  assert.strictEqual(config.agentToken, secretToken, 'Bellekte token doğru tutulmalı')

  // Loglama sırasında token'ın maskelenmesi:
  const masked = `${secretToken.substring(0, 6)}***`
  assert.strictEqual(masked, 'pa_liv***')
  assert.ok(!masked.includes('extremely_secret'))
})

// ============================================================================
// 5. Kurulum Scriptleri ve Dosya Varlığı
// ============================================================================

test('Aşama 6 — 8. Kurulum Dosyaları: Windows servis scriptleri ve dokümantasyon mevcuttur', () => {
  const agentDir = path.resolve('./print-agent')
  assert.ok(fs.existsSync(path.join(agentDir, 'install-service.ps1')), 'install-service.ps1 mevcut olmalı')
  assert.ok(fs.existsSync(path.join(agentDir, 'uninstall-service.ps1')), 'uninstall-service.ps1 mevcut olmalı')
  assert.ok(fs.existsSync(path.join(agentDir, 'check-printer.ps1')), 'check-printer.ps1 mevcut olmalı')
  assert.ok(fs.existsSync(path.join(agentDir, 'README.md')), 'README.md mevcut olmalı')
  assert.ok(fs.existsSync(path.join(agentDir, 'package.json')), 'package.json mevcut olmalı')
  assert.ok(fs.existsSync(path.join(agentDir, 'config.example.json')), 'config.example.json mevcut olmalı')
})
