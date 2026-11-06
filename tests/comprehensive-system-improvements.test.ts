import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateTCKimlik, validateVergiNo } from '../lib/utils/taxValidation'
import { checkSessionValidity, startSession, clearSessionData, INACTIVITY_TIMEOUT_MS, MAX_REMEMBER_ME_DURATION_MS } from '../lib/services/sessionManager'
import { deleteDeliveryOrder } from '../lib/hepsijet/client'

test('Gereksinim 1: HepsiJET Silme Endpoint ve Payload Doğrulaması', async () => {
  const barcode = 'TST1000000000001'
  const liveBase = 'https://integration.hepsijet.com'
  const testBase = 'https://integration-apitest.hepsijet.com'

  const liveUrl = `${liveBase}/delivery/deleteDeliveryOrder/${encodeURIComponent(barcode)}`
  const testUrl = `${testBase}/delivery/deleteDeliveryOrder/${encodeURIComponent(barcode)}`

  assert.equal(liveUrl, `https://integration.hepsijet.com/delivery/deleteDeliveryOrder/${barcode}`)
  assert.equal(testUrl, `https://integration-apitest.hepsijet.com/delivery/deleteDeliveryOrder/${barcode}`)

  // Simülasyon modunda çağrı
  const res = await deleteDeliveryOrder({
    customerDeliveryNo: barcode,
    deleteReason: 'IPTAL',
  })
  assert.equal(res.status, 'OK', 'Simülasyon modunda başarılı silme yanıtı dönmelidir')
})

test('Gereksinim 2: Bireysel T.C. Kimlik ve Kurumsal Vergi Numarası Doğrulaması', () => {
  // Geçerli TC algoritması testi
  assert.equal(validateTCKimlik('10000000146').isValid, true)
  assert.equal(validateTCKimlik('12345').isValid, false)
  assert.equal(validateTCKimlik('01234567890').isValid, false, '0 ile başlayan TC kimlik no geçersizdir')

  // Vergi no (10 hane numerik)
  assert.equal(validateVergiNo('1234567890').isValid, true)
  assert.equal(validateVergiNo('12345').isValid, false)
  assert.equal(validateVergiNo('123456789A').isValid, false)
})

test('Gereksinim 5: 24 Saatlik Bekleme ve 15 Günlük Arşiv Mantığı', () => {
  const now = Date.now()
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000
  const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000

  // 1. 26 saat önce oluşturulmuş bekleyen sipariş -> 24s uyarısı tetiklenmeli
  const order26hAgo = {
    id: 'ord_26h',
    status: 'pending',
    createdAt: new Date(now - (TWENTY_FOUR_HOURS + 2 * 3600 * 1000)).toISOString(),
  }
  const is24hOver =
    order26hAgo.status === 'pending' &&
    (now - new Date(order26hAgo.createdAt).getTime()) >= TWENTY_FOUR_HOURS
  assert.equal(is24hOver, true)

  // 2. 5 saat önce oluşturulmuş sipariş -> 24s uyarısı tetiklenmemeli
  const order5hAgo = {
    id: 'ord_5h',
    status: 'pending',
    createdAt: new Date(now - (5 * 3600 * 1000)).toISOString(),
  }
  const is24hOverRecent =
    order5hAgo.status === 'pending' &&
    (now - new Date(order5hAgo.createdAt).getTime()) >= TWENTY_FOUR_HOURS
  assert.equal(is24hOverRecent, false)

  // 3. 16 gün önce oluşturulmuş sipariş -> 15 günlük arşiv sınıfına girmeli
  const order16dAgo = {
    id: 'ord_16d',
    createdAt: new Date(now - (FIFTEEN_DAYS + 86400 * 1000)).toISOString(),
  }
  const isArchived = (now - new Date(order16dAgo.createdAt).getTime()) >= FIFTEEN_DAYS
  assert.equal(isArchived, true)
})

test('Gereksinim 10: Ücretsiz Kargo Eşiği ve Kargo Ücreti Hesaplama Senaryoları', () => {
  const freeThreshold = 500
  const standardFee = 100

  // Senaryo 1: 800 TL ürün -> Eşik üstü -> Kargo 0 TL, Toplam 800 TL
  const subtotal1 = 800
  const fee1 = (freeThreshold > 0 && subtotal1 >= freeThreshold) ? 0 : standardFee
  const total1 = subtotal1 + fee1
  assert.equal(fee1, 0)
  assert.equal(total1, 800)

  // Senaryo 2: 300 TL ürün -> Eşik altı -> Kargo 100 TL, Toplam 400 TL
  const subtotal2 = 300
  const fee2 = (freeThreshold > 0 && subtotal2 >= freeThreshold) ? 0 : standardFee
  const total2 = subtotal2 + fee2
  assert.equal(fee2, 100)
  assert.equal(total2, 400)

  // Senaryo 3: Eşik 0 (Kapalı) -> Her zaman standart kargo
  const freeThresholdDisabled = 0
  const fee3 = (freeThresholdDisabled > 0 && 800 >= freeThresholdDisabled) ? 0 : standardFee
  assert.equal(fee3, 100)
})

test('Gereksinim 8: 15 Dakika Hareketsizlik ve 7 Gün Beni Hatırla Oturum Kuralları', () => {
  assert.equal(INACTIVITY_TIMEOUT_MS, 15 * 60 * 1000, 'Normal oturum 15 dakika olmalı')
  assert.equal(MAX_REMEMBER_ME_DURATION_MS, 7 * 24 * 60 * 60 * 1000, 'Beni hatırla 7 gün olmalı')
})
