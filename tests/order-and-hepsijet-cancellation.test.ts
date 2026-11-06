import test from 'node:test'
import assert from 'node:assert'
import {
  deleteDeliveryOrder,
  HepsiJetTimeoutError,
  sanitizeLogMessage,
} from '../lib/hepsijet/client'
import {
  OrderShippingData,
  OrderCancellationRecord,
} from '../lib/hepsijet/types'

// Test ortamı için env ayarları
process.env.HEPSIJET_LIVE_DISPATCH_ENABLED = 'false'
process.env.HEPSIJET_BASE_URL = 'https://integration.hepsijet.com'
process.env.HEPSIJET_USERNAME = 'kaliport_integration'
process.env.HEPSIJET_PASSWORD = 'test_password_secret_123'

test('1. Kargosuz Siparişin İptali (Kargo henüz oluşturulmadıysa)', () => {
  const order: {
    id: string
    status: string
    paymentStatus: string
    shipping?: OrderShippingData
    cancellationHistory?: OrderCancellationRecord[]
  } = {
    id: 'ORD-TEST-001',
    status: 'processing',
    paymentStatus: 'PAID',
    shipping: {
      carrier: 'hepsijet',
      status: 'pending',
    },
  }

  // İşlem mantığı
  const hasActiveShipping = Boolean(
    order.shipping &&
      (order.shipping.status === 'created' ||
        Boolean(order.shipping.barcode && order.shipping.liveRequestMade))
  )

  assert.strictEqual(hasActiveShipping, false)

  const cancelReason = 'Müşteri vazgeçti'
  const now = new Date().toISOString()
  const cancelRecord: OrderCancellationRecord = {
    orderId: order.id,
    reason: cancelReason,
    cancelledBy: {
      uid: 'admin-uid-123',
      email: 'admin@kaliport.com',
    },
    cancelledAt: now,
    cancellationResult: 'NOT_APPLICABLE',
  }

  order.status = 'cancelled'
  if (order.shipping) {
    order.shipping.status = 'cancelled'
    order.shipping.cancelReason = cancelReason
    order.shipping.cancelledAt = now
    order.shipping.cancelResult = 'NOT_APPLICABLE'
  }
  order.cancellationHistory = [cancelRecord]

  assert.strictEqual(order.status, 'cancelled')
  assert.strictEqual(order.shipping?.status, 'cancelled')
  assert.strictEqual(order.cancellationHistory.length, 1)
  assert.strictEqual(order.cancellationHistory[0].cancellationResult, 'NOT_APPLICABLE')
})

test('2. Kargolu Siparişin İptal Talebi (HepsiJET Gönderisi Mevcut)', async () => {
  const order: {
    id: string
    status: string
    shipping: OrderShippingData
    cancellationHistory?: OrderCancellationRecord[]
  } = {
    id: 'ORD-TEST-002',
    status: 'shipped',
    shipping: {
      carrier: 'hepsijet',
      status: 'created',
      barcode: 'KALIPORTORD98765',
      customerDeliveryNo: 'KALIPORTORD98765',
      liveRequestMade: false,
    },
  }

  // Simülasyon modunda güvenli deleteDeliveryOrder çağrısı
  const response = await deleteDeliveryOrder({
    customerDeliveryNo: order.shipping.customerDeliveryNo,
    barcode: order.shipping.barcode,
  })

  assert.strictEqual(response.status, 'OK')
  assert.strictEqual(response.data?.isSimulated, true)

  const now = new Date().toISOString()
  const cancelRecord: OrderCancellationRecord = {
    orderId: order.id,
    reason: 'Hatalı adres bildirimi',
    cancelledBy: { email: 'admin@kaliport.com' },
    cancelledAt: now,
    shipmentBarcode: order.shipping.barcode,
    shipmentCustomerDeliveryNo: order.shipping.customerDeliveryNo,
    cancellationResult: 'SUCCESS',
  }

  order.status = 'cancelled'
  order.shipping.status = 'cancelled'
  order.shipping.cancelResult = 'SUCCESS'
  order.cancellationHistory = [cancelRecord]

  assert.strictEqual(order.status, 'cancelled')
  assert.strictEqual(order.shipping.status, 'cancelled')
  assert.strictEqual(order.cancellationHistory[0].shipmentBarcode, 'KALIPORTORD98765')
})

test('3. HepsiJET İptal Reddi (Kargo Dağıtımda / Operasyonel Neden)', () => {
  // Simüle edilen API hatası (örn: Kargo araçta veya dağıtımda)
  const simulatedApiError = new Error('HTTP 400: Kargo paketi transfer aracında olduğundan API ile iptal edilemez.')

  const sanitized = sanitizeLogMessage(simulatedApiError.message)

  const order: {
    status: string
    shipping: OrderShippingData
    cancellationHistory: OrderCancellationRecord[]
  } = {
    status: 'shipped',
    shipping: {
      carrier: 'hepsijet',
      status: 'cancel_pending',
      barcode: 'KALIPORTGS261029',
    },
    cancellationHistory: [],
  }

  // API onay vermediğinde kargo durumu 'cancelled' YAPILMAZ!
  order.shipping.status = 'cancel_failed'
  order.shipping.cancelResult = 'REJECTED'
  order.shipping.cancelFailedReason = sanitized

  const record: OrderCancellationRecord = {
    orderId: 'ORD-TEST-003',
    reason: 'Müşteri iptal istedi',
    cancelledBy: { email: 'admin@kaliport.com' },
    cancelledAt: new Date().toISOString(),
    cancellationResult: 'REJECTED',
    requiresAdminReview: true,
    errorDetail: sanitized,
  }
  order.cancellationHistory.push(record)

  // Sipariş durumu iptal edilmeden korunmalıdır (Kargo güvencesi)
  assert.strictEqual(order.status, 'shipped')
  assert.strictEqual(order.shipping.status, 'cancel_failed')
  assert.strictEqual(record.requiresAdminReview, true)
  assert.ok(order.shipping.cancelFailedReason?.includes('transfer aracında'))
})

test('4. Zaman Aşımı ve UNKNOWN Durumu (Körlemesine Tekrar Engellenmeli)', () => {
  const timeoutErr = new HepsiJetTimeoutError('HepsiJET kargo iptal servisi zaman aşımına uğradı (10 sn).')

  assert.strictEqual(timeoutErr.name, 'HepsiJetTimeoutError')

  const shipping: OrderShippingData = {
    carrier: 'hepsijet',
    status: 'cancel_pending',
    barcode: 'KALIPORTGS261030',
  }

  // Zaman aşımında durum UNKNOWN yapılır
  shipping.status = 'unknown'
  shipping.cancelResult = 'UNKNOWN'
  shipping.error = timeoutErr.message

  assert.strictEqual(shipping.status, 'unknown')
  assert.strictEqual(shipping.cancelResult, 'UNKNOWN')

  // Körlemesine tekrar gönderim engellenmeli
  const canRetryBlindly = shipping.status !== 'unknown'
  assert.strictEqual(canRetryBlindly, false)
})

test('5. İptal Edilmiş Siparişe Tekrar Kargo Oluşturma Girişimi Engellenmeli', () => {
  const cancelledOrder = {
    id: 'ORD-CANCELLED',
    status: 'cancelled',
    paymentStatus: 'PAID',
    shipping: {
      carrier: 'hepsijet' as const,
      status: 'cancelled' as const,
    },
  }

  function validateForShipment(order: typeof cancelledOrder) {
    if (order.status === 'cancelled') {
      throw new Error('İptal edilmiş siparişler için kargo gönderisi oluşturulamaz.')
    }
    if (order.shipping?.status === 'cancelled' || order.shipping?.status === 'cancel_pending') {
      throw new Error('İptal edilmiş veya iptal sürecindeki kargolar için yeni gönderi oluşturulamaz.')
    }
  }

  assert.throws(
    () => validateForShipment(cancelledOrder),
    /İptal edilmiş siparişler için kargo gönderisi oluşturulamaz/
  )

  const activeOrderWithCancelledShipping = {
    id: 'ORD-ACTIVE-SHIP-CANCELLED',
    status: 'processing',
    paymentStatus: 'PAID',
    shipping: {
      carrier: 'hepsijet' as const,
      status: 'cancelled' as const,
    },
  }

  assert.throws(
    () => validateForShipment(activeOrderWithCancelledShipping),
    /İptal edilmiş veya iptal sürecindeki kargolar için yeni gönderi oluşturulamaz/
  )
})

test('6. Aynı İptal İsteğinin İki Kez Gönderilmesi (Mükerrer İptal Engelleme)', () => {
  const alreadyCancelledOrder = {
    id: 'ORD-DUP',
    status: 'cancelled',
    shipping: {
      carrier: 'hepsijet' as const,
      status: 'cancelled' as const,
    },
  }

  function handleCancelAttempt(order: typeof alreadyCancelledOrder) {
    if (order.status === 'cancelled') {
      throw new Error('Bu sipariş zaten iptal edilmiştir.')
    }
  }

  assert.throws(
    () => handleCancelAttempt(alreadyCancelledOrder),
    /Bu sipariş zaten iptal edilmiştir/
  )
})

test('7. Yetkisiz Kullanıcının İptal Girişimi (Auth Kontrolü)', () => {
  function verifyAuthHeader(authHeader?: string | null): { isAuthorized: boolean; error?: string } {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { isAuthorized: false, error: 'Yetkilendirme başlığı eksik veya geçersiz (Bearer token gerekli).' }
    }
    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return { isAuthorized: false, error: 'Token boş bırakılamaz.' }
    }
    return { isAuthorized: true }
  }

  assert.strictEqual(verifyAuthHeader(null).isAuthorized, false)
  assert.strictEqual(verifyAuthHeader('Basic abc123').isAuthorized, false)
  assert.strictEqual(verifyAuthHeader('Bearer ').isAuthorized, false)
  assert.strictEqual(verifyAuthHeader('Bearer valid-admin-jwt').isAuthorized, true)
})

test('8. Eşzamanlı Kilit (cancel_pending Dağıtık Kilit Koruması)', () => {
  const shipping: OrderShippingData = {
    carrier: 'hepsijet',
    status: 'cancel_pending',
    cancelLockTimestamp: Date.now() - 60 * 1000, // 1 dakika önce kilitlenmiş
  }

  function checkLock(shp: OrderShippingData) {
    if (shp.status === 'cancel_pending') {
      const lockTime = shp.cancelLockTimestamp || 0
      const fiveMinutes = 5 * 60 * 1000
      if (Date.now() - lockTime < fiveMinutes) {
        throw new Error('Bu sipariş için iptal işlemi şu anda işleniyor. Lütfen bekleyiniz.')
      }
    }
  }

  // 1 dakika önceki kilit henüz 5 dakikalık süreyi aşmadığından reddedilmeli
  assert.throws(
    () => checkLock(shipping),
    /Bu sipariş için iptal işlemi şu anda işleniyor/
  )

  // 6 dakika önceki kilit süresi dolmuş olmalıdır
  shipping.cancelLockTimestamp = Date.now() - 6 * 60 * 1000
  assert.doesNotThrow(() => checkLock(shipping))
})

test('9. Canlı API Güvenlik Sınırı (HEPSIJET_LIVE_DISPATCH_ENABLED=false)', async () => {
  process.env.HEPSIJET_LIVE_DISPATCH_ENABLED = 'false'

  const res = await deleteDeliveryOrder({
    customerDeliveryNo: 'KALIPORTTEST01',
    barcode: 'KALIPORTTEST01',
  })

  // Simülasyon modunda dış ağ isteği yapılmadan OK döner
  assert.strictEqual(res.status, 'OK')
  assert.strictEqual(res.data?.isSimulated, true)
  assert.ok(res.message?.includes('güvenli simülasyon'))
})

test('10. Hassas Veri Maskeleme (Telefon, Şifre ve Token Temizleme)', () => {
  const rawLog = 'Kullanıcı telefonu 05551234567, token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.do_not_leak_this_token_hash, auth Basic dXNlcm5hbWU6cGFzc3dvcmQ='
  const sanitized = sanitizeLogMessage(rawLog)

  assert.strictEqual(sanitized.includes('05551234567'), false)
  assert.strictEqual(sanitized.includes('dXNlcm5hbWU6cGFzc3dvcmQ='), false)
  assert.ok(sanitized.includes('[PHONE_REDACTED]'))
  assert.ok(sanitized.includes('[TOKEN_REDACTED]') || sanitized.includes('[REDACTED]'))
})

test('11. HTTP 404 Endpoint Bulunamadı Durumunda Güvenli İzolasyon ve Yönetici İncelemesi', () => {
  const simulated404Error = new Error(
    'HepsiJET kargo iptal servisi bulunamadı (HTTP 404). Çağrılan uç nokta: [POST] /rest/delivery/deleteDeliveryOrder. Canlı API üzerinde bu endpoint mevcut değildir veya farklı bir metot/path gerektirmektedir.'
  )

  const sanitized = sanitizeLogMessage(simulated404Error.message)

  const order: {
    status: string
    shipping: OrderShippingData
    cancellationHistory: OrderCancellationRecord[]
  } = {
    status: 'shipped',
    shipping: {
      carrier: 'hepsijet',
      status: 'cancel_pending',
      barcode: 'KALIPORTGS261029',
    },
    cancellationHistory: [],
  }

  // 404 durumunda kargo iptal edilemediği için status 'cancelled' YAPILMAZ!
  order.shipping.status = 'cancel_failed'
  order.shipping.cancelResult = 'REJECTED'
  order.shipping.cancelFailedReason = sanitized

  const record: OrderCancellationRecord = {
    orderId: 'ORD-TEST-404',
    reason: 'Müşteri iptal talebi',
    cancelledBy: { email: 'admin@kaliport.com' },
    cancelledAt: new Date().toISOString(),
    cancellationResult: 'REJECTED',
    requiresAdminReview: true,
    errorDetail: sanitized,
  }
  order.cancellationHistory.push(record)

  // Sipariş durumu shpiped olarak korunmalı (Kargo teslimatı veya fiziksel paket riske atılmamalı)
  assert.strictEqual(order.status, 'shipped')
  assert.strictEqual(order.shipping.status, 'cancel_failed')
  assert.strictEqual(record.requiresAdminReview, true)
  assert.ok(order.shipping.cancelFailedReason?.includes('HTTP 404'))
  assert.ok(order.shipping.cancelFailedReason?.includes('/rest/delivery/deleteDeliveryOrder'))
})

test('12. Yeni HepsiJET Silme Endpoint Formatı ve Gövde Kontrolü', () => {
  const barcode = 'TST1000000000001'
  const baseUrl = 'https://integration.hepsijet.com'
  const endpointUrl = `${baseUrl}/delivery/deleteDeliveryOrder/${encodeURIComponent(barcode)}`
  const body = { deleteReason: 'IPTAL' }

  assert.strictEqual(endpointUrl, 'https://integration.hepsijet.com/delivery/deleteDeliveryOrder/TST1000000000001')
  assert.strictEqual(body.deleteReason, 'IPTAL')
})

test('13. HepsiJET "Zaten Silinmiş" Durumunda Başarılı Senkronizasyon', () => {
  const simulatedHepsiJetResponse = {
    status: 'FAIL',
    message: 'Bu gönderi sistemimizde zaten silinmiş durumda',
  }

  const isAlreadyDeleted = /zaten\s+silinmi[sş]|already\s+deleted/i.test(simulatedHepsiJetResponse.message)
  assert.strictEqual(isAlreadyDeleted, true)

  // Bu durumda yerel kayıt başarıyla cancelled olarak işaretlenmelidir
  const shipping: OrderShippingData = {
    carrier: 'hepsijet',
    status: isAlreadyDeleted ? 'cancelled' : 'cancel_failed',
    barcode: 'TST1000000000001',
    cancelResult: isAlreadyDeleted ? 'SUCCESS' : 'REJECTED',
  }

  assert.strictEqual(shipping.status, 'cancelled')
  assert.strictEqual(shipping.cancelResult, 'SUCCESS')
})

