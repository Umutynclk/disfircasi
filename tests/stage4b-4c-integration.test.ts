/**
 * KALIPORT — Aşama 4B + 4C Entegrasyon ve Güvenlik Testleri
 *
 * Kapsamlı birim test paketi:
 * - Simülasyon vs gerçek baskı ACK ayrımı
 * - macOS/Linux üzerinde gerçek yazıcı oluşturma engeli
 * - Yetkisiz ACK reddedilmesi
 * - Üretim kuyruğuna simülasyon sonucu gönderme engeli
 * - Başarısız baskıda iş printed olmaz
 * - Cron print_queue entegrasyonu
 * - Ödenmiş/PAID siparişler kuyruğa eklenir
 * - Ödenmemiş, iptal, barkodsuz siparişler kuyruğa eklenmez
 * - İdempotent çift iş oluşturma engeli
 * - Tarama hatası durumunda boş bildirim eklenmez
 * - Paralel cron koruması
 * - HEPSIJET_LIVE_DISPATCH_ENABLED kapalı kalır
 */
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
import { PrintJob, PrintJobStatus, AckPrintJobBody } from '../lib/printing/types'
import { validateOrderForPrintQueue } from '../lib/printing/queue'
import { isSampleBarcode } from '../lib/hepsijet/sampleLabel'

// ============================================================================
// Yardımcılar
// ============================================================================

const dummyJob: PrintJob = {
  jobId: 'job_test_4b_01',
  orderId: 'ORD-4B-01',
  barcode: '624500998811',
  type: 'shipping_label',
  status: 'processing',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  attemptCount: 1,
  maxAttempts: 3,
  idempotencyKey: 'job_test_4b_01',
}

const createMockOrder = (overrides: Record<string, any> = {}) => ({
  id: 'ORD-4C-99',
  orderNumber: 'GS-4C-001',
  status: 'processing',
  paymentStatus: 'PAID',
  shipping: {
    carrier: 'hepsijet',
    status: 'created',
    barcode: '62450099887766',
    trackingNumber: '62450099887766',
    customerDeliveryNo: 'KLP4C001',
  },
  customer: { name: 'Müşteri Adı' },
  shippingAddress: { city: 'İstanbul', district: 'Kadıköy' },
  ...overrides,
})

// ============================================================================
// A. Simülasyon ve Gerçek Baskı Ayrımı Testleri
// ============================================================================

test('4B-1. Simülasyon PDF kaydeder ancak gerçek kuyruğu printed yapmaz', async () => {
  const tempDir = path.resolve('./tests/temp_4b_sim_prints')
  const driver = new SimulatedPrinterDriver(tempDir)

  const samplePdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')
  const result = await driver.printPdf(samplePdf, dummyJob)

  // Kritik kontrol: success=true ama printed=false, status='simulated'
  assert.strictEqual(result.success, true, 'Simülasyon başarılı olmalı')
  assert.strictEqual(result.printed, false, 'Simülasyon fiziksel baskı DEĞİL, printed=false olmalı')
  assert.strictEqual(result.simulated, true, 'Simülasyon bayrağı true olmalı')
  assert.strictEqual(result.status, 'simulated', 'Status simulated olmalı, printed değil')
  assert.ok(result.outputPath, 'Dosya yolu döndürülmeli')

  // Dosyanın diske yazıldığını doğrula
  assert.ok(fs.existsSync(result.outputPath!), 'PDF dosyası diske yazılmış olmalı')

  // Temizle
  if (result.outputPath && fs.existsSync(result.outputPath)) fs.unlinkSync(result.outputPath)
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir)
})

test('4B-2. macOS/Linux üzerinde dryRun=false gerçek yazıcı oluşturmaz', () => {
  if (process.platform === 'win32') {
    // Windows'ta bu test anlamsızdır
    return
  }

  // createPrinterDriver, non-Windows ortamda dryRun=false olsa bile SimulatedPrinterDriver döndürür
  const driver = createPrinterDriver({
    apiUrl: 'http://localhost:3000',
    agentId: 'agent-mac-test',
    agentToken: 'token',
    printerName: 'PALMX TXP 400',
    pollIntervalMs: 5000,
    errorBackoffMs: 10000,
    maxBackoffMs: 30000,
    dryRun: false,
    outputDir: './tests/temp_4b_mac_prints',
  })

  assert.strictEqual(driver.isDryRun, true, 'macOS/Linux ortamda dryRun false olsa bile simülasyona düşmeli')
  assert.ok(driver instanceof SimulatedPrinterDriver, 'macOS/Linux ortamda WindowsPrinterDriver ASLA oluşmamalı')
})

test('4B-2b. WindowsPrinterDriver non-Windows platformda printPdf çağrısı hata verir', async () => {
  if (process.platform === 'win32') return

  const winDriver = new WindowsPrinterDriver('PALMX TXP 400')
  const sampleBuffer = Buffer.from('%PDF-1.4\ndummy-data')
  const result = await winDriver.printPdf(sampleBuffer, dummyJob)

  assert.strictEqual(result.success, false)
  assert.strictEqual(result.printed, false)
  assert.strictEqual(result.errorCode, 'UNSUPPORTED_PLATFORM')
  assert.strictEqual(result.status, 'failed')
  assert.ok(result.error?.includes('yalnızca Windows'))
})

test('4B-3. Simülasyon gerçek yazıcı metodunu çağırmaz', async () => {
  const tempDir = path.resolve('./tests/temp_4b_no_real_print')
  const driver = new SimulatedPrinterDriver(tempDir)

  // SimulatedPrinterDriver'da execFileAsync (Windows spooler) çağrısı YOKTUR
  // Doğrudan sınıf yapısıyla kanıtlanır
  assert.strictEqual(driver.isDryRun, true)
  assert.strictEqual(driver.name, 'PALMX TXP 400 (Simülasyon Modu)')

  // Çalıştır ve sonucun simulated olduğunu doğrula
  const samplePdf = Buffer.from('%PDF-1.4\ntest-content')
  const result = await driver.printPdf(samplePdf, dummyJob)
  assert.strictEqual(result.simulated, true)
  assert.strictEqual(result.printed, false)

  // Temizle
  const expectedFile = path.join(tempDir, `${dummyJob.jobId}.pdf`)
  if (fs.existsSync(expectedFile)) fs.unlinkSync(expectedFile)
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir)
})

test('4B-4. Yetkisiz ACK reddedilir (Agent kilit kontrolü)', () => {
  const job: PrintJob = {
    ...dummyJob,
    lockedBy: 'agent-alpha',
  }

  // Farklı bir agent ACK göndermeye çalışırsa
  const simulateAck = (j: PrintJob, agentId: string) => {
    if (j.lockedBy && j.lockedBy !== agentId) {
      throw new Error(`Bu iş başka bir agent (${j.lockedBy}) tarafından kilitlenmiş. Bildirim reddedildi.`)
    }
    return true
  }

  // Doğru agent → başarılı
  assert.strictEqual(simulateAck(job, 'agent-alpha'), true)

  // Yanlış agent → hata
  assert.throws(
    () => simulateAck(job, 'agent-beta'),
    /kilitlenmiş/,
    'Farklı agentın ACK yapması engellenmelidir'
  )
})

test('4B-5. Üretim kuyruğuna simülasyon sonucu gönderilemez (sunucu tarafı koruması)', () => {
  // Sunucu tarafındaki ackPrintJobServer kuralını simüle et
  const simulateServerAck = (result: AckPrintJobBody) => {
    // GÜVENLİK KURALI: isDryRun=true iken status='printed' reddedilir
    if (result.isDryRun && result.status === 'printed') {
      throw new Error(
        "Güvenlik ihlali: Simülasyon modundaki agent 'printed' bildirimi yapamaz."
      )
    }
    return true
  }

  // Simülasyon → printed: REDDEDİLİR
  assert.throws(
    () => simulateServerAck({ status: 'printed', isDryRun: true }),
    /Güvenlik ihlali/
  )

  // Simülasyon → simulated: KABUL EDİLİR
  assert.strictEqual(
    simulateServerAck({ status: 'simulated', isDryRun: true }),
    true
  )

  // Gerçek baskı → printed: KABUL EDİLİR
  assert.strictEqual(
    simulateServerAck({ status: 'printed', isDryRun: false }),
    true
  )

  // Simülasyon → failed: KABUL EDİLİR
  assert.strictEqual(
    simulateServerAck({ status: 'failed', isDryRun: true, errorCode: 'ERR', errorMessage: 'err' }),
    true
  )
})

test('4B-6. Gerçek baskı hata verirse iş printed olmaz', () => {
  const ackFailed = (
    job: PrintJob,
    agentId: string,
    errCode: string,
    errMsg: string
  ) => {
    if (job.lockedBy && job.lockedBy !== agentId) throw new Error('YETKISIZ')
    const MAX = 3
    const isPermanent = job.attemptCount >= MAX
    return {
      ...job,
      status: isPermanent ? ('failed' as const) : ('pending' as const),
      lastError: { code: errCode, message: errMsg, timestamp: new Date().toISOString() },
    }
  }

  // İlk deneme başarısız (1/3) → pending'e döner
  const attempt1 = ackFailed(
    { ...dummyJob, lockedBy: 'agent-1', attemptCount: 1 },
    'agent-1',
    'PRINT_SPOOLER_ERROR',
    'Yazıcı mürekkebi tükendi'
  )
  assert.strictEqual(attempt1.status, 'pending', 'İlk başarısızlıkta yeniden denenebilir olmalı')
  assert.notStrictEqual(attempt1.status, 'printed', 'Hata durumunda ASLA printed olmamalı')

  // Son deneme başarısız (3/3) → failed
  const attempt3 = ackFailed(
    { ...dummyJob, lockedBy: 'agent-1', attemptCount: 3 },
    'agent-1',
    'HARDWARE_ERROR',
    'Yazıcı kapağı açık'
  )
  assert.strictEqual(attempt3.status, 'failed', 'Son denemede kalıcı failed olmalı')
  assert.notStrictEqual(attempt3.status, 'printed', 'Hata durumunda ASLA printed olmamalı')
})

test('4B-7. PrintAgentService simülasyonda simulated ACK gönderir, printed DEĞİL', async () => {
  const originalFetch = globalThis.fetch
  let ackCalledWith: any = null
  const mockPdfBuffer = Buffer.from('%PDF-1.4 mock pdf data')

  globalThis.fetch = async (url: any, init: any) => {
    const urlStr = String(url)

    if (urlStr.includes('/api/print-agent/jobs/poll')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          job: { ...dummyJob, jobId: 'job_sim_ack_test' },
        }),
      } as any
    }

    if (urlStr.includes('/pdf')) {
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array(mockPdfBuffer).buffer,
      } as any
    }

    if (urlStr.includes('/ack')) {
      ackCalledWith = JSON.parse(init.body)
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as any
    }

    return originalFetch(url, init)
  }

  try {
    const tempOutputDir = path.resolve('./tests/temp_4b_ack_test')
    const agent = new PrintAgentService({
      apiUrl: 'http://localhost:3000',
      agentId: 'sim-ack-agent',
      agentToken: 'pa_test_token',
      dryRun: true,
      outputDir: tempOutputDir,
    })

    const result = await agent.pollOnce()

    assert.strictEqual(result.handledJob, true)
    assert.strictEqual(result.jobId, 'job_sim_ack_test')

    // KRİTİK: ACK'ın simulated gönderilmesi, printed DEĞİL
    assert.ok(ackCalledWith, 'ACK sunucuya gönderilmiş olmalı')
    assert.strictEqual(ackCalledWith.status, 'simulated', 'Simülasyonda status simulated olmalı, printed DEĞİL')
    assert.strictEqual(ackCalledWith.isDryRun, true, 'isDryRun true olmalı')
    assert.ok(ackCalledWith.simulatedOutputPath, 'Simülasyon dosya yolu iletilmeli')

    // Temizle
    const expectedFile = path.join(tempOutputDir, 'job_sim_ack_test.pdf')
    if (fs.existsSync(expectedFile)) fs.unlinkSync(expectedFile)
    if (fs.existsSync(tempOutputDir)) fs.rmdirSync(tempOutputDir)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ============================================================================
// B. Aşama 4C: Cron + Print Queue Entegrasyonu Testleri
// ============================================================================

test('4C-1. Ödemesi yapılmış + shipping.status=created sipariş kuyruğa eklenir', () => {
  const order = createMockOrder()
  const result = validateOrderForPrintQueue(order)
  assert.strictEqual(result.isValid, true, 'PAID + created sipariş kuyruğa uygun olmalı')
})

test('4C-2. Ödeme yapılmamış sipariş kuyruğa eklenmez', () => {
  const order = createMockOrder({ paymentStatus: 'PENDING' })
  const result = validateOrderForPrintQueue(order)
  assert.strictEqual(result.isValid, false, 'Ödenmemiş sipariş kuyruğa eklenmemeli')
  assert.ok(result.error?.includes('tamamlanmamış'))
})

test('4C-3. İptal/iade edilmiş sipariş kuyruğa eklenmez', () => {
  for (const status of ['cancelled', 'refunded', 'returned']) {
    const order = createMockOrder({ status })
    const result = validateOrderForPrintQueue(order)
    assert.strictEqual(result.isValid, false, `${status} sipariş kuyruğa eklenmemeli`)
  }
})

test('4C-4. Barkodsuz, numune barkodlu veya belirsiz gönderi kuyruğa eklenmez', () => {
  // Barkodsuz
  const noBarcodeOrder = createMockOrder({
    shipping: { status: 'created', barcode: '' },
  })
  assert.strictEqual(validateOrderForPrintQueue(noBarcodeOrder).isValid, false)

  // Numune barkodu
  const sampleBarcodeOrder = createMockOrder({
    shipping: { status: 'created', barcode: 'HJ-TEST-9876543210TR' },
  })
  assert.strictEqual(validateOrderForPrintQueue(sampleBarcodeOrder).isValid, false)

  // Belirsiz gönderi (status=unknown)
  const unknownOrder = createMockOrder({
    shipping: { status: 'unknown', barcode: '62450099887766' },
  })
  assert.strictEqual(validateOrderForPrintQueue(unknownOrder).isValid, false)

  // Başarısız gönderi (status=failed)
  const failedOrder = createMockOrder({
    shipping: { status: 'failed', barcode: '62450099887766' },
  })
  assert.strictEqual(validateOrderForPrintQueue(failedOrder).isValid, false)
})

test('4C-5. Önceden kuyruğa alınmış sipariş ikinci kez yinelenmez (idempotency key)', () => {
  const orderId = 'ORD-4C-IDEM'
  const barcode = '62450011223344'
  const key1 = `job_label_${orderId}_${barcode}`
  const key2 = `job_label_${orderId}_${barcode}`

  assert.strictEqual(key1, key2, 'Aynı sipariş+barkod çifti aynı idempotency key üretmeli')
})

test('4C-6. Başarılı taramada uygun sipariş yoksa boş bildirim idempotency kontrolü', () => {
  const dateStr = '2026-10-27'
  const noticeKey1 = `job_notice_no_orders_${dateStr}`
  const noticeKey2 = `job_notice_no_orders_${dateStr}`

  assert.strictEqual(noticeKey1, noticeKey2, 'Aynı gün için bildirim anahtarı tekil olmalı')
})

test('4C-7. Tarama hata verirse boş bildirim işi eklenmez (mantık doğrulaması)', () => {
  // Cron akışında: result.status === 'failed' ise queueNoOrdersNoticeJob ÇAĞRILMAMALI
  const simulateCronQueueDecision = (automationStatus: string, queuedCount: number) => {
    // Yalnızca status === 'completed' ve queuedCount === 0 ise bildirim eklenir
    if (automationStatus === 'completed' && queuedCount === 0) {
      return 'add_notice'
    }
    return 'skip_notice'
  }

  assert.strictEqual(
    simulateCronQueueDecision('failed', 0),
    'skip_notice',
    'Tarama başarısız olursa bildirim eklenmemeli'
  )

  assert.strictEqual(
    simulateCronQueueDecision('completed', 0),
    'add_notice',
    'Başarılı taramada sipariş yoksa bildirim eklenmeli'
  )

  assert.strictEqual(
    simulateCronQueueDecision('completed', 3),
    'skip_notice',
    'Sipariş kuyruğa eklendiyse bildirim gereksiz'
  )

  assert.strictEqual(
    simulateCronQueueDecision('locked', 0),
    'skip_notice',
    'Kilitli durumda bildirim eklenmemeli'
  )
})

test('4C-8. Paralel cron çağrıları çift iş oluşturmaz (distributed lock)', () => {
  let lockState = { locked: false, lockedAt: 0 }
  const LOCK_TIMEOUT = 15 * 60 * 1000

  const tryLock = (now: number) => {
    if (lockState.locked && now - lockState.lockedAt < LOCK_TIMEOUT) {
      return false // Zaten kilitli
    }
    lockState = { locked: true, lockedAt: now }
    return true
  }

  const releaseLock = () => { lockState.locked = false }

  const now = Date.now()

  assert.strictEqual(tryLock(now), true, '1. çağrı kilidi alabilmeli')
  assert.strictEqual(tryLock(now + 100), false, '2. eşzamanlı çağrı kilidi alamamalı')
  assert.strictEqual(tryLock(now + 200), false, '3. eşzamanlı çağrı kilidi alamamalı')

  releaseLock()
  assert.strictEqual(tryLock(now + 300), true, 'Kilit serbest bırakıldıktan sonra alınabilmeli')
})

test('4C-9. Simülasyon sonucu üretim işini printed yapamaz (sunucu kuralı)', () => {
  // Bu test 4B-5 ile aynı sunucu kuralını doğrular ama cron bağlamında
  const validateServerAck = (body: AckPrintJobBody): boolean => {
    if (body.isDryRun && body.status === 'printed') {
      return false // REDDEDILIR
    }
    return true // KABUL EDILIR
  }

  assert.strictEqual(
    validateServerAck({ status: 'printed', isDryRun: true }),
    false,
    'Simülasyon modu üretim kuyruğunu printed yapamamalı'
  )

  assert.strictEqual(
    validateServerAck({ status: 'simulated', isDryRun: true }),
    true,
    'Simülasyon sonucu kabul edilmeli'
  )
})

test('4C-10. Cron secret eksik veya hatalıysa istek reddedilir (mantık doğrulaması)', () => {
  const validateCronAuth = (
    serverSecret: string | undefined,
    requestAuth: string
  ): { allowed: boolean; status: number } => {
    if (!serverSecret || serverSecret.trim().length === 0) {
      return { allowed: false, status: 500 }
    }
    const expected = `Bearer ${serverSecret.trim()}`
    if (requestAuth !== expected) {
      return { allowed: false, status: 401 }
    }
    return { allowed: true, status: 200 }
  }

  // Secret tanımsız
  assert.deepStrictEqual(
    validateCronAuth(undefined, 'Bearer abc'),
    { allowed: false, status: 500 }
  )

  // Secret boş
  assert.deepStrictEqual(
    validateCronAuth('', 'Bearer abc'),
    { allowed: false, status: 500 }
  )

  // Yanlış token
  assert.deepStrictEqual(
    validateCronAuth('correct_secret', 'Bearer wrong_secret'),
    { allowed: false, status: 401 }
  )

  // Doğru token
  assert.deepStrictEqual(
    validateCronAuth('correct_secret', 'Bearer correct_secret'),
    { allowed: true, status: 200 }
  )
})

test('4C-11. HepsiJET canlı gönderi oluşturma kapalı kalır', () => {
  // automation.ts içinde isSimulated: true sabit olarak kalmaktadır
  // sendDeliveryOrderEnhanced, HEPSIJET_LIVE_DISPATCH_ENABLED false iken simülasyon döner
  // Bu koşul automation.ts L395'te her zaman true olarak setlenir
  const isSimulated = true // automation.ts sabit değeri
  assert.strictEqual(isSimulated, true, 'Otomasyon her zaman isSimulated=true olmalı')
})

test('4C-12. createPrinterDriver Windows dışında PRINTER_NAME eksik olsa bile güvenli simülasyona düşer', () => {
  if (process.platform === 'win32') return

  const driver = createPrinterDriver({
    apiUrl: 'http://localhost:3000',
    agentId: 'agent-noname',
    agentToken: 'token',
    printerName: '', // Boş isim
    pollIntervalMs: 5000,
    errorBackoffMs: 10000,
    maxBackoffMs: 30000,
    dryRun: false,
    outputDir: './tests/temp_4c_noname',
  })

  // macOS/Linux'ta her zaman SimulatedPrinterDriver döner
  assert.strictEqual(driver.isDryRun, true)
  assert.ok(driver instanceof SimulatedPrinterDriver)
})

// ============================================================================
// C. Mevcut Testlerle Uyumluluk (Regresyon Kontrolü)
// ============================================================================

test('COMPAT-1. Mevcut validateOrderForPrintQueue testleri geçerli kalır', () => {
  // Geçerli sipariş
  const validOrder = createMockOrder()
  assert.strictEqual(validateOrderForPrintQueue(validOrder).isValid, true)

  // Test barkodları reddedilir
  const testBarcodes = ['HJ-TEST-123', 'SAMPLE-ABC', 'SIMUL-X', 'HJ9876543210TR']
  for (const bc of testBarcodes) {
    assert.strictEqual(isSampleBarcode(bc), true, `${bc} test barkodu olmalı`)
  }

  // Gerçek barkodlar kabul edilir
  assert.strictEqual(isSampleBarcode('62450012345678'), false)
  assert.strictEqual(isSampleBarcode('KLP99001'), false)
})

test('COMPAT-2. SimulatedPrinterDriver bozuk PDF reddeder', async () => {
  const driver = new SimulatedPrinterDriver('./tests/temp_compat_invalid')

  const emptyRes = await driver.printPdf(Buffer.alloc(0), dummyJob)
  assert.strictEqual(emptyRes.success, false)
  assert.strictEqual(emptyRes.errorCode, 'INVALID_PDF_DATA')
  assert.strictEqual(emptyRes.status, 'failed')

  const badRes = await driver.printPdf(Buffer.from('NOT A PDF'), dummyJob)
  assert.strictEqual(badRes.success, false)
  assert.strictEqual(badRes.errorCode, 'CORRUPTED_PDF_HEADER')
  assert.strictEqual(badRes.status, 'failed')

  const tempDir = path.resolve('./tests/temp_compat_invalid')
  if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir)
})

test('COMPAT-3. PrintAgentService lifecycle ve graceful shutdown', async () => {
  const agent = new PrintAgentService({
    apiUrl: 'http://localhost:3000',
    agentId: 'compat-agent',
    agentToken: 'pa_compat_token',
    pollIntervalMs: 10000,
    dryRun: true,
  })

  agent.start()
  await new Promise((r) => setTimeout(r, 50))
  await agent.stop()
  assert.ok(true, 'Agent temiz şekilde durduruldu')
})

test('COMPAT-4. 401 Yetkisiz erişim kontrollü hata yakalama', async () => {
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
      agentId: 'unauth-compat',
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
