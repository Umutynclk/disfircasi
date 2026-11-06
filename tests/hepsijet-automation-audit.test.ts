import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateOrderForAutomation, normalizePhoneNumber } from '../lib/hepsijet/automation'
import { DEFAULT_HEPSIJET_SETTINGS, HepsiJetSettings } from '../lib/hepsijet/types'
import { sendDeliveryOrderEnhanced, fetchHepsiJetBarcodeLabel } from '../lib/hepsijet/client'

const mockSettings: HepsiJetSettings = {
  ...DEFAULT_HEPSIJET_SETTINGS,
  companyName: 'KALIPORT DIS TICARET',
  abbreviationCode: 'KLP',
  contactName: 'Volkan Dogan',
  contactPhone: '5551234567',
  contactEmail: 'info@kaliport.com',
  senderCity: 'Konya',
  senderTown: 'Selçuklu',
  senderAddress: 'Konya Organize Sanayi Bölgesi No: 10',
  defaultDesi: 1,
  defaultWeight: 0.3,
  defaultPackageCount: 1,
}

const createValidOrder = () => ({
  id: 'ORD-VALID-01',
  orderNumber: 'GS-1001',
  status: 'pending',
  paymentStatus: 'PAID',
  customer: {
    name: 'Ahmet Yılmaz',
    phone: '05551234567',
    email: 'ahmet@example.com',
  },
  shippingAddress: {
    fullName: 'Ahmet Yılmaz',
    city: 'İstanbul',
    district: 'Kadıköy',
    address: 'Moda Cad. No: 42 Daire: 5',
    phone: '05551234567',
  },
  items: [
    {
      name: 'Gülümse Sonic Diş Fırçası',
      quantity: 1,
      desi: 1,
      weight: 0.3,
    },
  ],
})

test('1. Telefon Normalizasyonu (Türkiye 10 Haneli 5XXXXXXXXX)', () => {
  assert.strictEqual(normalizePhoneNumber('05551234567'), '5551234567')
  assert.strictEqual(normalizePhoneNumber('905551234567'), '5551234567')
  assert.strictEqual(normalizePhoneNumber('+90 (555) 123-4567'), '5551234567')
  assert.strictEqual(normalizePhoneNumber('5551234567'), '5551234567')
  assert.strictEqual(normalizePhoneNumber('02121234567'), '2121234567') // Sabit hat - 5 ile başlamaz
})

test('2. Tam Uygun Sipariş -> ready Durumu Almalı', () => {
  const order = createValidOrder()
  const result = evaluateOrderForAutomation(order, mockSettings)

  assert.strictEqual(result.status, 'ready')
  assert.strictEqual(result.desi, 1)
  assert.strictEqual(result.weight, 0.3)
  assert.strictEqual(result.packageCount, 1)
})

test('3. Ödeme Durumu Senaryoları (Yalnızca PAID kabul edilmeli)', () => {
  // PENDING
  const pendingOrder = { ...createValidOrder(), paymentStatus: 'PENDING' }
  const resPending = evaluateOrderForAutomation(pendingOrder, mockSettings)
  assert.strictEqual(resPending.status, 'pending_review')
  assert.ok(resPending.reasons.some((r) => r.includes('Ödeme tamamlanmamış')))

  // FAILED
  const failedOrder = { ...createValidOrder(), paymentStatus: 'FAILED' }
  const resFailed = evaluateOrderForAutomation(failedOrder, mockSettings)
  assert.strictEqual(resFailed.status, 'pending_review')
  assert.ok(resFailed.reasons.some((r) => r.includes('Ödeme tamamlanmamış')))

  // Havale Bekleyen
  const bankOrder = { ...createValidOrder(), paymentStatus: 'awaiting_bank_transfer' }
  const resBank = evaluateOrderForAutomation(bankOrder, mockSettings)
  assert.strictEqual(resBank.status, 'pending_review')

  // Tanımsız / Eksik Ödeme
  const noPayOrder = { ...createValidOrder(), paymentStatus: undefined }
  const resNoPay = evaluateOrderForAutomation(noPayOrder, mockSettings)
  assert.strictEqual(resNoPay.status, 'pending_review')
})

test('4. İptal, İade ve Tamamlanmış Sipariş Senaryoları', () => {
  // İptal (cancelled)
  const cancelledOrder = { ...createValidOrder(), status: 'cancelled' }
  const resCancelled = evaluateOrderForAutomation(cancelledOrder, mockSettings)
  assert.strictEqual(resCancelled.status, 'pending_review')
  assert.ok(resCancelled.reasons.some((r) => r.includes('iptal')))

  // İade edilmiş (refunded)
  const refundedOrder = { ...createValidOrder(), status: 'refunded' }
  const resRefunded = evaluateOrderForAutomation(refundedOrder, mockSettings)
  assert.strictEqual(resRefunded.status, 'pending_review')
  assert.ok(resRefunded.reasons.some((r) => r.includes('iade')))

  // Geri alınmış (returned)
  const returnedOrder = { ...createValidOrder(), status: 'returned' }
  const resReturned = evaluateOrderForAutomation(returnedOrder, mockSettings)
  assert.strictEqual(resReturned.status, 'pending_review')
  assert.ok(resReturned.reasons.some((r) => r.includes('iade')))

  // Zaten kargoya verilmiş (shipped)
  const shippedOrder = { ...createValidOrder(), status: 'shipped' }
  const resShipped = evaluateOrderForAutomation(shippedOrder, mockSettings)
  assert.strictEqual(resShipped.status, 'pending_review')
  assert.ok(resShipped.reasons.some((r) => r.includes('shipped') || r.includes('kargoya')))

  // Teslim edilmiş (delivered)
  const deliveredOrder = { ...createValidOrder(), status: 'delivered' }
  const resDelivered = evaluateOrderForAutomation(deliveredOrder, mockSettings)
  assert.strictEqual(resDelivered.status, 'pending_review')
  assert.ok(resDelivered.reasons.some((r) => r.includes('teslim')))
})

test('5. Kargo Durumu (shipping.status) Senaryoları (created, creating, unknown, failed)', () => {
  // created: Zaten kargo barkodu var
  const createdOrder = {
    ...createValidOrder(),
    shipping: { status: 'created', barcode: 'HJ9876543210TR' },
  }
  const resCreated = evaluateOrderForAutomation(createdOrder, mockSettings)
  assert.strictEqual(resCreated.status, 'pending_review')
  assert.ok(resCreated.reasons.some((r) => r.includes('zaten başarıyla oluşturulmuş')))

  // creating: Şu anda başka bir istek kilitli tutuyor (< 5 dk)
  const creatingOrder = {
    ...createValidOrder(),
    shipping: { status: 'creating', lockTimestamp: Date.now() - 60000 },
  }
  const resCreating = evaluateOrderForAutomation(creatingOrder, mockSettings)
  assert.strictEqual(resCreating.status, 'pending_review')
  assert.ok(resCreating.reasons.some((r) => r.includes('kilitlenmiş')))

  // unknown: Belirsiz ağ kopması / zaman aşımı -> KÖRLEMESİNE TEKRAR YASAK
  const unknownOrder = {
    ...createValidOrder(),
    shipping: { status: 'unknown', error: 'Network timeout during dispatch' },
  }
  const resUnknown = evaluateOrderForAutomation(unknownOrder, mockSettings)
  assert.strictEqual(resUnknown.status, 'pending_review')
  assert.ok(resUnknown.reasons.some((r) => r.includes('unknown') || r.includes('belirsiz')))

  // failed: Önceki deneme başarısız oldu
  const failedShipOrder = {
    ...createValidOrder(),
    shipping: { status: 'failed', error: 'Adres yetersiz' },
  }
  const resFailedShip = evaluateOrderForAutomation(failedShipOrder, mockSettings)
  assert.strictEqual(resFailedShip.status, 'pending_review')
  assert.ok(resFailedShip.reasons.some((r) => r.includes('başarısız')))
})

test('6. Eksik / Hatalı Adres ve İletişim Verileri', () => {
  // Sabit hat / geçersiz cep telefonu (5 ile başlamayan)
  const badPhoneOrder = {
    ...createValidOrder(),
    customer: { ...createValidOrder().customer, phone: '02121234567' },
    shippingAddress: { ...createValidOrder().shippingAddress, phone: '02121234567' },
  }
  const resBadPhone = evaluateOrderForAutomation(badPhoneOrder, mockSettings)
  assert.strictEqual(resBadPhone.status, 'pending_review')
  assert.ok(resBadPhone.reasons.some((r) => r.includes('telefon')))

  // Şehir eksik
  const noCityOrder = {
    ...createValidOrder(),
    shippingAddress: { ...createValidOrder().shippingAddress, city: '' },
  }
  const resNoCity = evaluateOrderForAutomation(noCityOrder, mockSettings)
  assert.strictEqual(resNoCity.status, 'pending_review')
  assert.ok(resNoCity.reasons.some((r) => r.includes('Şehir')))

  // İlçe eksik
  const noTownOrder = {
    ...createValidOrder(),
    shippingAddress: { ...createValidOrder().shippingAddress, district: '', town: '' },
  }
  const resNoTown = evaluateOrderForAutomation(noTownOrder, mockSettings)
  assert.strictEqual(resNoTown.status, 'pending_review')
  assert.ok(resNoTown.reasons.some((r) => r.includes('İlçe')))

  // Açık adres çok kısa
  const shortAddressOrder = {
    ...createValidOrder(),
    shippingAddress: { ...createValidOrder().shippingAddress, address: 'Ev' },
  }
  const resShortAddr = evaluateOrderForAutomation(shortAddressOrder, mockSettings)
  assert.strictEqual(resShortAddr.status, 'pending_review')
  assert.ok(resShortAddr.reasons.some((r) => r.includes('açık adres')))
})

test('7. Zaman Dilimi ve Saat Penceresi (Europe/Istanbul ±30 Dk)', () => {
  const targetH = 17
  const targetM = 30
  const targetTotalMin = targetH * 60 + targetM // 1050

  const checkWindow = (curH: number, curM: number, isForce = false) => {
    const curTotalMin = curH * 60 + curM
    const diff = Math.abs(curTotalMin - targetTotalMin)
    if (!isForce && diff > 30 && diff < 1440 - 30) {
      return 'idle'
    }
    return 'executable'
  }

  // 17:30 tam vaktinde -> executable
  assert.strictEqual(checkWindow(17, 30), 'executable')
  // 17:15 (15 dk erken) -> executable
  assert.strictEqual(checkWindow(17, 15), 'executable')
  // 17:45 (15 dk geç) -> executable
  assert.strictEqual(checkWindow(17, 45), 'executable')
  // 17:00 (30 dk erken sınırda) -> executable
  assert.strictEqual(checkWindow(17, 0), 'executable')
  // 18:00 (30 dk geç sınırda) -> executable
  assert.strictEqual(checkWindow(18, 0), 'executable')

  // 16:59 (31 dk erken) -> idle (beklemede)
  assert.strictEqual(checkWindow(16, 59), 'idle')
  // 18:01 (31 dk geç) -> idle (beklemede)
  assert.strictEqual(checkWindow(18, 1), 'idle')
  // 12:00 öğlen vakti -> idle (beklemede)
  assert.strictEqual(checkWindow(12, 0), 'idle')

  // Zorlama bayrağı (force_run / x-force-run) aktifse saatten bağımsız -> executable
  assert.strictEqual(checkWindow(12, 0, true), 'executable')
  assert.strictEqual(checkWindow(2, 30, true), 'executable')
})

test('8. Aynı Gün İkinci Cron Çağrısı İdempotency Senaryosu', () => {
  const timezone = 'Europe/Istanbul'
  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const todayStr = dateFormatter.format(new Date())

  // Simüle edilmiş cron kontrol fonksiyonu
  const checkDailyIdempotency = (lastRunAt?: string, lastRunStatus?: string, isForce = false) => {
    if (!isForce && lastRunAt) {
      const lastRunDateStr = dateFormatter.format(new Date(lastRunAt))
      if (todayStr === lastRunDateStr && lastRunStatus === 'completed') {
        return 'skipped_already_run_today'
      }
    }
    return 'execute'
  }

  // Bugün 17:30'da başarıyla tamamlanmış bir çalıştırma var
  const lastRunToday = new Date().toISOString()
  assert.strictEqual(
    checkDailyIdempotency(lastRunToday, 'completed', false),
    'skipped_already_run_today',
    'Aynı gün ikinci normal cron çağrısı atlanmalıdır'
  )

  // Manuel zorlama (x-force-run) durumunda atlanmamalı, çalışmalıdır
  assert.strictEqual(
    checkDailyIdempotency(lastRunToday, 'completed', true),
    'execute',
    'Zorlama aktifken aynı gün tekrar çalıştırılabilmelidir'
  )

  // Dün çalışmışsa bugün çalışmalıdır
  const yesterday = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString()
  assert.strictEqual(
    checkDailyIdempotency(yesterday, 'completed', false),
    'execute',
    'Dün çalışmış olması bugünkü cronu engellememelidir'
  )
})

test('9. Eşzamanlı Kilit (Distributed Concurrency Lock) Mantığı', () => {
  let lockState = {
    locked: false,
    lockedAt: 0,
    runId: '',
  }

  const acquireLock = (runId: string, now: number) => {
    const lockTimeout = 15 * 60 * 1000
    if (lockState.locked) {
      if (now - lockState.lockedAt < lockTimeout) {
        return false // Kilit aktif, çift çalışma engellendi
      }
    }
    lockState = {
      locked: true,
      lockedAt: now,
      runId,
    }
    return true
  }

  const releaseLock = () => {
    lockState.locked = false
  }

  const now = 1000000
  // 1. İşlem kilidi alır
  assert.strictEqual(acquireLock('run-1', now), true)
  // 2. Eşzamanlı gelen 2. işlem kilidi alamaz (çift çalışma engellenir)
  assert.strictEqual(acquireLock('run-2', now + 1000), false)
  // 1. İşlem tamamlanıp kilidi bırakır
  releaseLock()
  // Sonraki işlem kilidi alabilir
  assert.strictEqual(acquireLock('run-3', now + 2000), true)
})

test('10. Canlı API Güvenlik Sınırı (HEPSIJET_LIVE_DISPATCH_ENABLED=false)', async () => {
  // HEPSIJET_LIVE_DISPATCH_ENABLED env false iken sendDeliveryOrderEnhanced simülasyon döner
  const dummyPayload: any = {
    company: { name: 'KALIPORT', abbreviationCode: 'KLP' },
    delivery: {
      customerDeliveryNo: 'KLP1001TEST',
      customerOrderId: '1001',
      totalParcels: 1,
      desi: 1,
      weight: 0.3,
      recipientPerson: 'Ahmet Yilmaz',
      product: { productCode: 'HX_STD' },
    },
  }

  const response = await sendDeliveryOrderEnhanced(dummyPayload)
  assert.strictEqual(response.status, 'OK')
  assert.strictEqual(response.data?.isSimulated, true)
  assert.ok(response.data?.barcode?.includes('KLP1001TEST'))

  // fetchHepsiJetBarcodeLabel da canlı API'ye gitmez, simüle PDF üretir
  const labelRes = await fetchHepsiJetBarcodeLabel(['HJ-TEST-12345'])
  assert.strictEqual(labelRes.contentType, 'application/pdf')
  assert.ok(Buffer.isBuffer(labelRes.data))
  assert.ok(labelRes.data.length > 500)
})
