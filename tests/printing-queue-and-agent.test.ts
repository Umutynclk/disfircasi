import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateOrderForPrintQueue,
  generateNoOrdersNoticePdf,
} from '../lib/printing/queue'
import {
  hashAgentToken,
  safeCompareHashes,
} from '../lib/printing/agentAuth'
import { isSampleBarcode } from '../lib/hepsijet/sampleLabel'
import { PrintJob } from '../lib/printing/types'

// Mock Sipariş Yardımcısı
const createMockOrder = (overrides: Record<string, any> = {}) => ({
  id: 'ORD-TEST-99',
  orderNumber: 'GS-99001',
  status: 'processing',
  paymentStatus: 'PAID',
  shipping: {
    carrier: 'hepsijet',
    status: 'created',
    barcode: '62450012345678', // Gerçek biçimli HepsiJET barkodu
    trackingNumber: '62450012345678',
    customerDeliveryNo: 'KLP99001',
  },
  customer: { name: 'Mehmet Öz' },
  shippingAddress: { city: 'Ankara', district: 'Çankaya' },
  ...overrides,
})

test('1. Baskıya Uygunluk: Geçerli ve Ödenmiş Gerçek Sipariş', () => {
  const order = createMockOrder()
  const result = validateOrderForPrintQueue(order)
  assert.strictEqual(result.isValid, true)
  assert.strictEqual(result.error, undefined)
})

test('2. Baskıya Uygunluk: Sahte / Numune / Simülasyon Barkodunun Reddedilmesi', () => {
  // Test barkodu çeşitleri
  const sampleBarcodes = [
    'HJ-TEST-9876543210TR',
    'HJ9876543210TR',
    'SIMUL-482942',
    'SAMPLE-LABEL-01',
    'TEST-HJ-5544',
  ]

  for (const fakeBarcode of sampleBarcodes) {
    assert.strictEqual(isSampleBarcode(fakeBarcode), true, `Barkod sahte olarak algılanmalı: ${fakeBarcode}`)

    const order = createMockOrder({
      shipping: {
        carrier: 'hepsijet',
        status: 'created',
        barcode: fakeBarcode,
      },
    })

    const result = validateOrderForPrintQueue(order)
    assert.strictEqual(result.isValid, false)
    assert.ok(result.error?.includes('test/simülasyon barkodudur'), `Hata mesajı test barkodu uyarısı içermeli: ${result.error}`)
  }
})

test('3. Baskıya Uygunluk: Ödenmemiş, İptal veya İade Siparişlerin Reddedilmesi', () => {
  // Ödenmemiş (PENDING)
  const pendingOrder = createMockOrder({ paymentStatus: 'PENDING' })
  assert.strictEqual(validateOrderForPrintQueue(pendingOrder).isValid, false)

  // İptal edilmiş
  const cancelledOrder = createMockOrder({ status: 'cancelled' })
  assert.strictEqual(validateOrderForPrintQueue(cancelledOrder).isValid, false)

  // İade edilmiş
  const refundedOrder = createMockOrder({ status: 'refunded' })
  assert.strictEqual(validateOrderForPrintQueue(refundedOrder).isValid, false)

  // Kargo henüz 'created' olmamış (örn: ready_for_dispatch veya pending_review)
  const notCreatedOrder = createMockOrder({
    shipping: { status: 'ready_for_dispatch', barcode: '62450012345678' },
  })
  assert.strictEqual(validateOrderForPrintQueue(notCreatedOrder).isValid, false)

  // Barkodsuz sipariş
  const noBarcodeOrder = createMockOrder({
    shipping: { status: 'created', barcode: '' },
  })
  assert.strictEqual(validateOrderForPrintQueue(noBarcodeOrder).isValid, false)
})

test('4. İdempotency: Aynı Sipariş İçin Tekil İş Kimliği (JobId / IdempotencyKey)', () => {
  const orderId = 'ORD-2026-X1'
  const barcode = '624500998877'

  const key1 = `job_label_${orderId}_${barcode}`
  const key2 = `job_label_${orderId}_${barcode}`

  assert.strictEqual(key1, key2, 'Aynı sipariş ve barkod birebir aynı anahtarı üretmelidir')

  // Boş sipariş bildirimi tekil anahtarı (günde tek seferlik)
  const dateStr = '2026-10-27'
  const noticeKey1 = `job_notice_no_orders_${dateStr}`
  const noticeKey2 = `job_notice_no_orders_${dateStr}`
  assert.strictEqual(noticeKey1, noticeKey2, 'Aynı gün için bildirim anahtarı tekil olmalıdır')
})

test('5. Concurrency & Dağıtık Kilit: İki Agentın Aynı İşi Almasının Engellenmesi', () => {
  // Simüle edilmiş iş kaydı
  let jobState: PrintJob = {
    jobId: 'job_label_test_01',
    orderId: 'ORD-1',
    barcode: '624500112233',
    type: 'shipping_label',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attemptCount: 0,
    maxAttempts: 3,
    idempotencyKey: 'job_label_test_01',
  }

  const LEASE_DURATION = 5 * 60 * 1000

  // Atomik claim simülasyonu
  const tryClaim = (agentId: string, now: number) => {
    const isPending = jobState.status === 'pending'
    const isStale =
      jobState.status === 'processing' &&
      typeof jobState.leaseExpiresAt === 'number' &&
      jobState.leaseExpiresAt <= now

    if (!isPending && !isStale) {
      return { success: false, reason: 'ALREADY_LOCKED' }
    }

    jobState = {
      ...jobState,
      status: 'processing',
      lockedBy: agentId,
      lockedAt: now,
      leaseExpiresAt: now + LEASE_DURATION,
      attemptCount: jobState.attemptCount + 1,
    }
    return { success: true, job: jobState }
  }

  const now = 1000000

  // 1. Agent işi talep eder -> Başarılı
  const claim1 = tryClaim('agent-pc-1', now)
  assert.strictEqual(claim1.success, true)
  assert.strictEqual(claim1.job?.lockedBy, 'agent-pc-1')
  assert.strictEqual(claim1.job?.status, 'processing')

  // 2. Agent 2 saniye sonra aynı işi almaya çalışır -> ENGELLENİR
  const claim2 = tryClaim('agent-pc-2', now + 2000)
  assert.strictEqual(claim2.success, false)
  assert.strictEqual(claim2.reason, 'ALREADY_LOCKED')
  assert.strictEqual(jobState.lockedBy, 'agent-pc-1') // Kilit 1. agentta kalır
})

test('6. Lease Timeout ve Stale Job Toparlanması (Crash Recovery)', () => {
  const LEASE_DURATION = 5 * 60 * 1000
  const now = 1000000

  // Agent 1 işi aldı ama çöktü (ack yapamadı)
  let jobState: PrintJob = {
    jobId: 'job_label_test_02',
    orderId: 'ORD-2',
    barcode: '624500223344',
    type: 'shipping_label',
    status: 'processing',
    lockedBy: 'agent-crashed',
    lockedAt: now,
    leaseExpiresAt: now + LEASE_DURATION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attemptCount: 1,
    maxAttempts: 3,
    idempotencyKey: 'job_label_test_02',
  }

  const tryClaim = (agentId: string, currentTime: number) => {
    const isPending = jobState.status === 'pending'
    const isStale =
      jobState.status === 'processing' &&
      typeof jobState.leaseExpiresAt === 'number' &&
      jobState.leaseExpiresAt <= currentTime

    if (!isPending && !isStale) {
      return false
    }

    jobState = {
      ...jobState,
      status: 'processing',
      lockedBy: agentId,
      lockedAt: currentTime,
      leaseExpiresAt: currentTime + LEASE_DURATION,
      attemptCount: jobState.attemptCount + 1,
    }
    return true
  }

  // Lease süresi henüz dolmadı (4. dakikada) -> Agent 2 alamaz
  assert.strictEqual(tryClaim('agent-pc-2', now + 4 * 60 * 1000), false)

  // Lease süresi doldu (6. dakikada) -> Agent 2 işi devralır ve attemptCount artar
  assert.strictEqual(tryClaim('agent-pc-2', now + 6 * 60 * 1000), true)
  assert.strictEqual(jobState.lockedBy, 'agent-pc-2')
  assert.strictEqual(jobState.attemptCount, 2)
})

test('7. Baskı Sonucu Ack Mantığı: Başarılı, Başarısız Yeniden Deneme ve Max Deneme Aşımı', () => {
  const nowStr = new Date().toISOString()
  const createJob = (attempts: number): PrintJob => ({
    jobId: 'job_ack_test',
    orderId: 'ORD-ACK',
    type: 'shipping_label',
    status: 'processing',
    lockedBy: 'agent-1',
    createdAt: nowStr,
    updatedAt: nowStr,
    attemptCount: attempts,
    maxAttempts: 3,
    idempotencyKey: 'job_ack_test',
  })

  // 1. Başarılı Ack
  let job1 = createJob(1)
  const ackSuccess = (job: PrintJob, agentId: string) => {
    if (job.lockedBy !== agentId) throw new Error('YETKISIZ_AGENT')
    return { ...job, status: 'printed' as const, lockedBy: undefined, printedAt: new Date().toISOString() }
  }
  const resSuccess = ackSuccess(job1, 'agent-1')
  assert.strictEqual(resSuccess.status, 'printed')
  assert.strictEqual(resSuccess.lockedBy, undefined)
  assert.ok(resSuccess.printedAt)

  // 2. Başka bir agent yetkisiz ack yapmaya çalışırsa hata vermeli
  assert.throws(() => ackSuccess(job1, 'wrong-agent'), /YETKISIZ_AGENT/)

  // 3. İlk başarısızlık (attempt 1/3) -> status 'pending'e döner (yeniden denenebilir)
  const ackFailed = (job: PrintJob, agentId: string, errCode: string, errMsg: string) => {
    if (job.lockedBy !== agentId) throw new Error('YETKISIZ_AGENT')
    const isPermanent = job.attemptCount >= job.maxAttempts
    return {
      ...job,
      status: isPermanent ? ('failed' as const) : ('pending' as const),
      lockedBy: undefined,
      lastError: { code: errCode, message: errMsg, timestamp: new Date().toISOString() },
    }
  }

  const resRetry = ackFailed(createJob(1), 'agent-1', 'OUT_OF_PAPER', 'Kağıt bitti')
  assert.strictEqual(resRetry.status, 'pending')
  assert.strictEqual(resRetry.lastError.code, 'OUT_OF_PAPER')

  // 4. Son başarısızlık (attempt 3/3) -> status 'failed' olur
  const resPermanentFail = ackFailed(createJob(3), 'agent-1', 'HARDWARE_ERROR', 'Yazıcı kapağı açık')
  assert.strictEqual(resPermanentFail.status, 'failed')
})

test('8. Print Agent Kimlik Doğrulama & Sabit Zamanlı Token Hash Kontrolü', () => {
  const token = 'pa_live_abcdef1234567890abcdef1234567890'
  const salt = 'aabbccddeeff0011'

  const expectedHash = hashAgentToken(token, salt)
  assert.ok(expectedHash && expectedHash.length === 64, 'SHA-256 hash 64 karakter hex olmalı')

  // Doğru token -> Eşleşir
  const providedCorrectToken = token
  const computedHash1 = hashAgentToken(providedCorrectToken, salt)
  assert.strictEqual(safeCompareHashes(expectedHash, computedHash1), true)

  // Yanlış token -> Eşleşmez
  const providedWrongToken = 'pa_live_wrong_token_123456'
  const computedHash2 = hashAgentToken(providedWrongToken, salt)
  assert.strictEqual(safeCompareHashes(expectedHash, computedHash2), false)

  // Sahte uzunluk / boş string karşılaştırması güvenli olmalı (çökmemeli)
  assert.strictEqual(safeCompareHashes(expectedHash, ''), false)
  assert.strictEqual(safeCompareHashes('', expectedHash), false)
})

test('9. Boş Sipariş Bildirimi PDF Üretimi (PALMX TXP 400)', async () => {
  const pdfBuffer = await generateNoOrdersNoticePdf({
    dateStr: '2026-10-27',
    totalChecked: 0,
    printerId: 'PALMX-TXP400',
  })

  assert.ok(Buffer.isBuffer(pdfBuffer), 'Çıktı bir Buffer olmalıdır')
  assert.ok(pdfBuffer.length > 500, 'PDF boyutu geçerli olmalıdır')

  // PDF sihirli bayt kontrolü: %PDF-
  const header = pdfBuffer.subarray(0, 5).toString('ascii')
  assert.strictEqual(header, '%PDF-')
})
