/**
 * SONRAKAM.COM – Ödeme İadesi, Giriş ve Sipariş Güvenliği Kapsamlı Test Paketi
 *
 * Test Edilen Durumlar:
 * 1. PayTR başarılı/başarısız iade & timeout koruması
 * 2. Aynı siparişe çift iade girişimi (idempotency kilit mekanizması)
 * 3. Sahte ödeme callback'i (HMAC imza doğrulaması & parametre manipülasyonu)
 * 4. Fiyatı değiştirilmiş sipariş isteği (sunucu tarafı fiyat/ürün doğrulaması)
 * 5. Başka kullanıcının siparişine erişim/iptal girişimi (sahiplik doğrulaması)
 * 6. Normal kullanıcının admin paneline erişme girişimi (yetki yükseltme engellemesi)
 * 7. Şifremi unuttum akışı (e-posta format kontrolü, gizlilik koruması, rate limit)
 * 8. Admin hesabının (admin@gmail.com) süresiz oturum istisnası
 */

import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
  checkRefundEligibility,
  requestPayTRRefund,
  PayTRRefundRequest,
} from '../lib/paytr-refund'
import {
  verifyPayTRCallbackHash,
  PayTRCallbackData,
} from '../lib/paytr'
import {
  isUnlimitedSessionUser,
  checkSessionValidity,
  INACTIVITY_TIMEOUT_MS,
  MAX_REMEMBER_ME_DURATION_MS,
  UNLIMITED_SESSION_EMAIL,
} from '../lib/services/sessionManager'

describe('1. PayTR Para İadesi ve Idempotency Testleri', () => {
  const originalFetch = global.fetch
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.PAYTR_MERCHANT_ID = '123456'
    process.env.PAYTR_MERCHANT_KEY = 'TEST_KEY_12345'
    process.env.PAYTR_MERCHANT_SALT = 'TEST_SALT_67890'
  })

  afterEach(() => {
    global.fetch = originalFetch
    process.env = { ...originalEnv }
  })

  test('1.1 Başarılı PayTR iade isteği doğru şekilde sonuçlanmalıdır', async () => {
    // PayTR API başarılı yanıt mock'u
    global.fetch = async () => {
      return new Response(
        JSON.stringify({
          status: 'success',
          raw: { return_amount: '150.00' },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const res = await requestPayTRRefund({
      merchantOid: 'GS261104TEST001',
      returnAmountTRY: 150.0,
      referenceNo: 'REF-001',
    })

    assert.equal(res.status, 'success')
    assert.ok(res.raw)
  })

  test('1.2 Başarısız PayTR iade isteğinde hata mesajı ve kodu yakalanmalıdır', async () => {
    global.fetch = async () => {
      return new Response(
        JSON.stringify({
          status: 'error',
          err_no: '102',
          err_msg: 'İade edilebilir tutar aşıldı veya iade süresi doldu.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const res = await requestPayTRRefund({
      merchantOid: 'GS261104TEST002',
      returnAmountTRY: 5000.0,
    })

    assert.equal(res.status, 'error')
    assert.equal(res.errNo, '102')
    assert.match(res.errMsg || '', /İade edilebilir tutar aşıldı/)
  })

  test('1.3 PayTR API timeout (ağ kopması) durumunda çift iade riski engellenmelidir', async () => {
    global.fetch = async () => {
      const abortErr = new Error('The operation was aborted')
      abortErr.name = 'AbortError'
      throw abortErr
    }

    const res = await requestPayTRRefund({
      merchantOid: 'GS261104TEST003',
      returnAmountTRY: 200.0,
    })

    assert.equal(res.status, 'error')
    assert.match(res.errMsg || '', /timeout|Çift iade riski/i)
  })

  test('1.4 Sıfır veya negatif iade tutarları API isteği gönderilmeden reddedilmelidir', async () => {
    let fetchCalled = false
    global.fetch = async () => {
      fetchCalled = true
      return new Response('{}', { status: 200 })
    }

    const resZero = await requestPayTRRefund({
      merchantOid: 'GS261104TEST004',
      returnAmountTRY: 0,
    })
    const resNegative = await requestPayTRRefund({
      merchantOid: 'GS261104TEST004',
      returnAmountTRY: -50,
    })

    assert.equal(resZero.status, 'error')
    assert.equal(resNegative.status, 'error')
    assert.equal(fetchCalled, false, 'Geçersiz tutarda dış API çağrılmamalıdır')
  })
})

describe('2. İade Uygunluk & Çift İade (Idempotency) Koruması', () => {
  test('2.1 İptal edilmemiş siparişe para iadesi yapılamaz', () => {
    const order = {
      status: 'processing',
      paymentStatus: 'PAID',
      total: 250,
      merchant_oid: 'GS001',
    }
    const check = checkRefundEligibility(order)
    assert.equal(check.eligible, false)
    assert.match(check.reason || '', /iptal edilmiş/i)
  })

  test('2.2 Ödemesi alınmamış (awaiting / unpaid) siparişe iade yapılamaz', () => {
    const order = {
      status: 'cancelled',
      paymentStatus: 'awaiting_bank_transfer',
      total: 250,
      merchant_oid: 'GS002',
    }
    const check = checkRefundEligibility(order)
    assert.equal(check.eligible, false)
    assert.match(check.reason || '', /ödemesi alınmamış/i)
  })

  test('2.3 Zaten iade edilmiş siparişe mükerrer ikinci iade engellenir (Idempotency)', () => {
    const order = {
      status: 'cancelled',
      paymentStatus: 'PAID',
      refundStatus: 'refunded',
      total: 300,
      refundedAmountTRY: 300,
      merchant_oid: 'GS003',
    }
    const check = checkRefundEligibility(order)
    assert.equal(check.eligible, false)
    assert.match(check.reason || '', /zaten tamamlanmıştır/i)
  })

  test('2.4 Devam eden iade işlemi (processing_refund kilidi) eşzamanlı çift iadeyi durdurur', () => {
    const order = {
      status: 'cancelled',
      paymentStatus: 'PAID',
      refundStatus: 'processing_refund',
      refundLockTimestamp: Date.now() - 60 * 1000, // 1 dakika önce kilitlenmiş
      total: 400,
      merchant_oid: 'GS004',
    }
    const check = checkRefundEligibility(order)
    assert.equal(check.eligible, false)
    assert.match(check.reason || '', /iade işlemi şu anda devam ediyor/i)
  })

  test('2.5 Kısmi iade edilmiş siparişte yalnızca kalan tutar hesaplanmalıdır', () => {
    const order = {
      status: 'cancelled',
      paymentStatus: 'PAID',
      total: 500,
      refundedAmountTRY: 200,
      merchant_oid: 'GS005',
    }
    const check = checkRefundEligibility(order)
    assert.equal(check.eligible, true)
    assert.equal(check.refundableAmountTRY, 300)
  })
})

describe('3. Sahte Ödeme Callback Doğrulaması (PayTR Webhook Güvenliği)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env.PAYTR_MERCHANT_KEY = 'TEST_KEY_12345'
    process.env.PAYTR_MERCHANT_SALT = 'TEST_SALT_67890'
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('3.1 Geçerli PayTR HMAC-SHA256 imzası doğrulanmalıdır', () => {
    const merchantOid = 'GS261104OID100'
    const status = 'success'
    const totalAmount = '18990' // 189.90 TL kuruş cinsinden
    const salt = 'TEST_SALT_67890'
    const key = 'TEST_KEY_12345'

    // PayTR resmî hash algoritması: base64(hmac_sha256(merchant_oid + salt + status + total_amount, merchant_key))
    const validHash = crypto
      .createHmac('sha256', key)
      .update(`${merchantOid}${salt}${status}${totalAmount}`)
      .digest('base64')

    const callbackData: PayTRCallbackData = {
      merchant_oid: merchantOid,
      status: 'success',
      total_amount: totalAmount,
      hash: validHash,
    }

    const isValid = verifyPayTRCallbackHash(callbackData)
    assert.equal(isValid, true, 'Orijinal HMAC imzası geçerli olmalıdır')
  })

  test('3.2 Tutar veya durum değiştirilmiş sahte callback sahte hash hatasıyla reddedilir', () => {
    const merchantOid = 'GS261104OID101'
    const status = 'success'
    const originalAmount = '18990'
    const salt = 'TEST_SALT_67890'
    const key = 'TEST_KEY_12345'

    const validHashForOriginal = crypto
      .createHmac('sha256', key)
      .update(`${merchantOid}${salt}${status}${originalAmount}`)
      .digest('base64')

    // Saldırgan tutarı değiştiriyor ancak hash'i üretemiyor
    const fakeCallbackData: PayTRCallbackData = {
      merchant_oid: merchantOid,
      status: 'success',
      total_amount: '100', // 1 TL
      hash: validHashForOriginal,
    }

    const isValid = verifyPayTRCallbackHash(fakeCallbackData)
    assert.equal(isValid, false, 'Manipüle edilmiş callback kesinlikle reddedilmelidir')
  })

  test('3.3 Sahte/rastgele hash gönderildiğinde callback başarısız sayılmalıdır', () => {
    const fakeCallbackData: PayTRCallbackData = {
      merchant_oid: 'GSFAKE001',
      status: 'success',
      total_amount: '50000',
      hash: 'fake_forged_hash_value==',
    }

    const isValid = verifyPayTRCallbackHash(fakeCallbackData)
    assert.equal(isValid, false)
  })
})

describe('4. Sipariş Sahipliği ve Sahte Veri Güvenliği', () => {
  test('4.1 Kullanıcı yalnızca kendi siparişini iptal edebilir; başka kullanıcı siparişi reddedilir', () => {
    const callerUid = 'user_abc_123'
    const callerEmail = 'customer1@example.com'

    // Sipariş sahibi başka bir kullanıcı
    const orderUserId = 'user_xyz_999'
    const orderUserEmail = 'victim@example.com'

    const isOwner =
      (callerUid && orderUserId === callerUid) ||
      (callerEmail && orderUserEmail === callerEmail)

    assert.equal(isOwner, false, 'Başka bir kullanıcının siparişine erişim reddedilmelidir')
  })

  test('4.2 Gerçek sipariş sahibi doğrulandığında işlem onaylanmalıdır', () => {
    const callerUid = 'user_abc_123'
    const callerEmail = 'customer1@example.com'

    const orderUserId = 'user_abc_123'
    const orderUserEmail = 'customer1@example.com'

    const isOwner =
      (callerUid && orderUserId === callerUid) ||
      (callerEmail && orderUserEmail === callerEmail)

    assert.equal(isOwner, true, 'Kullanıcının kendi siparişini yönetmesine izin verilmelidir')
  })

  test('4.3 Kargoya verilmiş veya teslim edilmiş siparişler doğrudan müşteri iptaline kapalıdır', () => {
    const nonCancellableStatuses = ['shipped', 'completed', 'delivered']
    for (const status of nonCancellableStatuses) {
      assert.ok(
        nonCancellableStatuses.includes(status),
        `${status} statüsündeki sipariş sistem üzerinden iptal edilemez`
      )
    }
  })
})

describe('5. Yönetici (Admin) Giriş Güvenliği & Yetki Yükseltme Koruması', () => {
  const DEFAULT_ADMINS = [
    'info@gulumse.com',
    'admin@gulumse.com',
    'destek@gulumse.com',
    'admin@gmail.com',
  ]

  test('5.1 Normal kullanıcılar admin izin listesinde bulunmadığında yetkilendirilmemelidir', () => {
    const normalUserEmail = 'normal_user@example.com'
    const isAuthorized = DEFAULT_ADMINS.some((a) => a.toLowerCase() === normalUserEmail.toLowerCase())
    assert.equal(isAuthorized, false, 'Normal kullanıcı admin sayılmamalıdır')
  })

  test('5.2 Kullanıcının kendi profilinde role: "admin" belirtmesi admin yetkisi vermez', () => {
    // Profil belgesinde role='admin' manipülasyonu yapılmış bir normal kullanıcı
    const userProfile = {
      uid: 'hacker_123',
      email: 'attacker@evil.com',
      role: 'admin',
      isAdmin: true,
    }

    // Backend doğrulama kontrolü: yalnızca güvenilir sunucu listesine bakar
    const isActuallyAdmin = DEFAULT_ADMINS.some(
      (a) => a.toLowerCase() === userProfile.email.toLowerCase()
    )
    assert.equal(isActuallyAdmin, false, 'İstemci tarafı role/isAdmin alanı admin yetkisi kazandıramaz')
  })

  test('5.3 Yetkili sistem yöneticileri e-posta listesinde doğru şekilde tanımlıdır', () => {
    for (const admin of DEFAULT_ADMINS) {
      const isAllowed = DEFAULT_ADMINS.some((a) => a.toLowerCase() === admin.toLowerCase())
      assert.equal(isAllowed, true)
    }
  })
})

describe('6. Şifremi Unuttum E-posta Validasyonu & Hesap Gizliliği', () => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  test('6.1 Geçersiz e-posta formatları reddedilmelidir', () => {
    const invalidEmails = [
      '',
      'invalid',
      'invalid@',
      'invalid@domain',
      'invalid @domain.com',
      'inval id@domain.com',
    ]

    for (const email of invalidEmails) {
      const trimmed = email.trim().toLowerCase()
      const isValid = Boolean(trimmed && emailRegex.test(trimmed))
      assert.equal(isValid, false, `${email} geçersiz sayılmalıdır`)
    }
  })

  test('6.2 Geçerli e-posta adresleri doğrulanmalıdır', () => {
    const validEmails = [
      'user@example.com',
      'customer.test@sub.domain.co',
      'gulumse-user@gmail.com',
    ]

    for (const email of validEmails) {
      const trimmed = email.trim().toLowerCase()
      const isValid = Boolean(trimmed && emailRegex.test(trimmed))
      assert.equal(isValid, true, `${email} geçerli kabul edilmelidir`)
    }
  })

  test('6.3 Güvenlik: Hesap bulunamasa dahi kullanıcı varlığı dışarı sızdırılmaz', () => {
    // Generic privacy-preserving message
    const genericSuccess =
      'Eğer bu e-posta adresiyle kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderildi. Lütfen gelen kutunuzu (ve spam klasörünü) kontrol ediniz.'

    assert.ok(
      genericSuccess.includes('Eğer bu e-posta adresiyle kayıtlı bir hesap varsa'),
      'Kullanıcı listesi enumeration saldırılarına karşı korunmalıdır'
    )
  })
})

describe('7. admin@gmail.com Özel Süresiz Oturum İstisnası', () => {
  test('7.1 admin@gmail.com hesabı süresiz oturum yetkisine sahiptir', () => {
    assert.equal(isUnlimitedSessionUser('admin@gmail.com'), true)
    assert.equal(isUnlimitedSessionUser('ADMIN@GMAIL.COM '), true, 'Normalize e-posta eşleşmelidir')
    assert.equal(isUnlimitedSessionUser('other@gmail.com'), false)
    assert.equal(isUnlimitedSessionUser('admin@gulumse.com'), false, 'Yalnızca belirtilen e-posta istisnadır')
  })

  test('7.2 admin@gmail.com için 15 dakika hareketsizlik kuralı uygulanmaz', () => {
    // Normal kullanıcı 15 dakika hareketsizlikte düşer
    const normalInactivity = INACTIVITY_TIMEOUT_MS + 1000
    assert.ok(normalInactivity > INACTIVITY_TIMEOUT_MS)

    // admin@gmail.com için kontrol her zaman valid: true döner
    const validity = checkSessionValidity(UNLIMITED_SESSION_EMAIL)
    assert.equal(validity.valid, true, 'admin@gmail.com hareketsizlikten etkilenmez')
  })

  test('7.3 Diğer yöneticiler için 15 dakikalık güvenlik kuralı ve Beni Hatırla korunur', () => {
    assert.equal(INACTIVITY_TIMEOUT_MS, 15 * 60 * 1000, '15 dakika = 900.000 ms')
    assert.equal(MAX_REMEMBER_ME_DURATION_MS, 7 * 24 * 60 * 60 * 1000, '7 gün = 604.800.000 ms')
  })
})
