import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'fs'
import path from 'path'
import {
  SimulatedPrinterDriver,
  WindowsPrinterDriver,
  createPrinterDriver,
} from '../print-agent/printer'
import { PrintAgentService } from '../print-agent/agent'
import { PrintJob } from '../lib/printing/types'

const dummyJob: PrintJob = {
  jobId: 'job_test_sim_01',
  orderId: 'ORD-SIM-01',
  barcode: '624500998811',
  type: 'shipping_label',
  status: 'processing',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  attemptCount: 1,
  maxAttempts: 3,
  idempotencyKey: 'job_test_sim_01',
}

test('1. SimulatedPrinterDriver: Geçerli PDF Verisini Simülasyon Klasörüne Kaydeder', async () => {
  const testDir = path.resolve('./tests/temp_simulated_prints')
  const driver = new SimulatedPrinterDriver(testDir)

  assert.strictEqual(driver.isDryRun, true)

  // Geçerli PDF başlığı içeren örnek buffer
  const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')

  const result = await driver.printPdf(samplePdfBuffer, dummyJob)

  assert.strictEqual(result.success, true)
  assert.strictEqual(result.printed, false, 'Simülasyon fiziksel baskı değil, printed=false olmalı')
  assert.strictEqual(result.simulated, true)
  assert.ok(result.outputPath && fs.existsSync(result.outputPath), 'Simüle edilen dosya diske yazılmalı')

  // Temizle
  if (result.outputPath && fs.existsSync(result.outputPath)) {
    fs.unlinkSync(result.outputPath)
  }
  if (fs.existsSync(testDir)) {
    fs.rmdirSync(testDir)
  }
})

test('2. SimulatedPrinterDriver: Bozuk / Boş PDF Verisini Reddeder', async () => {
  const driver = new SimulatedPrinterDriver('./tests/temp_prints_invalid')

  // Boş buffer
  const emptyRes = await driver.printPdf(Buffer.alloc(0), dummyJob)
  assert.strictEqual(emptyRes.success, false)
  assert.strictEqual(emptyRes.errorCode, 'INVALID_PDF_DATA')

  // Bozuk format (%PDF- içermeyen veri)
  const badBuffer = Buffer.from('BU BIR PDF DEGILDIR')
  const badRes = await driver.printPdf(badBuffer, dummyJob)
  assert.strictEqual(badRes.success, false)
  assert.strictEqual(badRes.errorCode, 'CORRUPTED_PDF_HEADER')

  const tempDir = path.resolve('./tests/temp_prints_invalid')
  if (fs.existsSync(tempDir)) {
    fs.rmdirSync(tempDir)
  }
})

test('3. WindowsPrinterDriver: Non-Windows Platform Koruması', async () => {
  if (process.platform !== 'win32') {
    const winDriver = new WindowsPrinterDriver('PALMX TXP 400')
    const sampleBuffer = Buffer.from('%PDF-1.4\nvalid-dummy-pdf')
    const result = await winDriver.printPdf(sampleBuffer, dummyJob)

    assert.strictEqual(result.success, false)
    assert.strictEqual(result.errorCode, 'UNSUPPORTED_PLATFORM')
    assert.ok(result.error?.includes('yalnızca Windows'), 'Non-Windows koruma uyarısı içermeli')
  }
})

test('4. createPrinterDriver Fabrikası: DRY_RUN Koruması', () => {
  // dryRun: true ise mutlaka SimulatedPrinterDriver döner
  const simDriver = createPrinterDriver({
    apiUrl: 'http://localhost:3000',
    agentId: 'agent-1',
    agentToken: 'token',
    printerName: 'PALMX TXP 400',
    pollIntervalMs: 5000,
    errorBackoffMs: 10000,
    maxBackoffMs: 30000,
    dryRun: true,
    outputDir: './simulated_prints',
  })

  assert.strictEqual(simDriver.isDryRun, true)
  assert.ok(simDriver instanceof SimulatedPrinterDriver)

  // Mac/Linux ortamında dryRun: false verilse dahi donanım çökmesini önlemek için Simulated döner
  if (process.platform !== 'win32') {
    const fallbackDriver = createPrinterDriver({
      apiUrl: 'http://localhost:3000',
      agentId: 'agent-1',
      agentToken: 'token',
      printerName: 'PALMX TXP 400',
      pollIntervalMs: 5000,
      errorBackoffMs: 10000,
      maxBackoffMs: 30000,
      dryRun: false,
      outputDir: './simulated_prints',
    })
    assert.strictEqual(fallbackDriver.isDryRun, true, 'Non-windows ortamda dryRun false olsa bile simülasyona düşmelidir')
  }
})

test('5. PrintAgentService: Yaşam Döngüsü ve Graceful Shutdown', async () => {
  const agent = new PrintAgentService({
    apiUrl: 'http://localhost:3000',
    agentId: 'test-agent',
    agentToken: 'pa_test_secret',
    pollIntervalMs: 10000,
    dryRun: true,
  })

  // Başlat
  agent.start()

  // Kısa bekleme
  await new Promise((r) => setTimeout(r, 50))

  // Güvenli durdur
  await agent.stop()

  assert.ok(true, 'Agent temiz ve takılmadan durduruldu')
})

test('6. PrintAgentService: Mock API ile Başarılı Simülasyon İşleme Döngüsü (Poll -> PDF -> Simulate -> Ack)', async () => {
  // Global fetch'i geçici olarak mockla
  const originalFetch = globalThis.fetch
  let ackCalledWith: any = null

  const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf data')

  globalThis.fetch = async (url: any, init: any) => {
    const urlStr = String(url)

    // 1. Poll çağrısı
    if (urlStr.includes('/api/print-agent/jobs/poll')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          job: { ...dummyJob, jobId: 'job_mock_full_flow' },
        }),
      } as any
    }

    // 2. PDF indirme çağrısı
    if (urlStr.includes('/pdf')) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array(mockPdfBuffer).buffer,
      } as any
    }

    // 3. Ack çağrısı
    if (urlStr.includes('/ack')) {
      ackCalledWith = JSON.parse(init.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true, message: 'Ack alındı' }),
      } as any
    }

    return originalFetch(url, init)
  }

  try {
    const tempOutputDir = path.resolve('./tests/temp_agent_flow')
    const agent = new PrintAgentService({
      apiUrl: 'http://localhost:3000',
      agentId: 'mock-agent-01',
      agentToken: 'pa_mock_token_123',
      dryRun: true,
      outputDir: tempOutputDir,
    })

    const result = await agent.pollOnce()

    assert.strictEqual(result.handledJob, true)
    assert.strictEqual(result.jobId, 'job_mock_full_flow')
    assert.strictEqual(result.error, undefined)

    // Ack sunucuya başarıyla iletildi mi?
    assert.ok(ackCalledWith, 'Ack çağrısı yapılmış olmalıdır')
    // KRİTİK GÜVENLİK DEĞİŞİKLİĞİ: Simülasyon modunda 'simulated' gönderilir, 'printed' DEĞİL
    assert.strictEqual(ackCalledWith.status, 'simulated', 'Simülasyonda ACK status simulated olmalı')
    assert.strictEqual(ackCalledWith.isDryRun, true, 'isDryRun true olmalı')

    // Temizle
    const expectedFile = path.join(tempOutputDir, 'job_mock_full_flow.pdf')
    if (fs.existsSync(expectedFile)) fs.unlinkSync(expectedFile)
    if (fs.existsSync(tempOutputDir)) fs.rmdirSync(tempOutputDir)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('7. PrintAgentService: 401 Yetkisiz Erişimde Kontrollü Hata Yakalama', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = async (url: any) => {
    const urlStr = String(url)
    if (urlStr.includes('/api/print-agent/jobs/poll')) {
      return {
        ok: false,
        status: 401,
        text: async () => 'Yetkisiz erişim.',
      } as any
    }
    return originalFetch(url)
  }

  try {
    const agent = new PrintAgentService({
      apiUrl: 'http://localhost:3000',
      agentId: 'unauthorized-agent',
      agentToken: 'pa_bad_token',
      dryRun: true,
    })

    const result = await agent.pollOnce()
    assert.strictEqual(result.handledJob, false)
    assert.strictEqual(result.error, 'UNAUTHORIZED')
  } finally {
    globalThis.fetch = originalFetch
  }
})
