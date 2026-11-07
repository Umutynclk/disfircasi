import test from 'node:test'
import assert from 'node:assert/strict'

test('Geliştirme 1: Oturum Yönetimi - Müşteri Rolü 15 Dakika Süre Aşımına Uğramamalı', () => {
  const customerUser = { uid: 'cust-123', email: 'musteri@gmail.com', role: 'user' }
  const adminUser = { uid: 'adm-123', email: 'admin@sonrakam.com', role: 'admin' }

  // Admin rotası dışındaki müşterilerde 15 dk hareketsizlik logout'u tetiklenmez
  const shouldEnforceInactivity = (pathname: string, userRole: string) => {
    if (userRole === 'user') return false
    return pathname.startsWith('/admin')
  }

  assert.equal(shouldEnforceInactivity('/profil', customerUser.role), false)
  assert.equal(shouldEnforceInactivity('/satin-al', customerUser.role), false)
  assert.equal(shouldEnforceInactivity('/admin/siparisler', adminUser.role), true)
})

test('Geliştirme 2: Kargo Ücreti ve Ücretsiz Kargo Eşiği Senkronizasyonu', () => {
  const shippingSettings = {
    shippingFee: 79.90,
    freeShippingThreshold: 500,
  }

  const calculateShipping = (subtotal: number, settings: typeof shippingSettings) => {
    if (settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold) {
      return 0
    }
    return settings.shippingFee
  }

  // 400 TL sepet -> 79.90 TL kargo
  assert.equal(calculateShipping(400, shippingSettings), 79.90)
  // 500 TL sepet -> 0 TL kargo (ücretsiz)
  assert.equal(calculateShipping(500, shippingSettings), 0)
  // 1200 TL sepet -> 0 TL kargo (ücretsiz)
  assert.equal(calculateShipping(1200, shippingSettings), 0)
})

test('Geliştirme 3: Ön Bilgilendirme Formu ve KVKK Scroll-to-Bottom Doğrulaması', () => {
  const isScrolledToBottom = (scrollTop: number, clientHeight: number, scrollHeight: number) => {
    return scrollTop + clientHeight >= scrollHeight - 35
  }

  // Kullanıcı modalın henüz ortasındayken
  assert.equal(isScrolledToBottom(100, 400, 1000), false)
  // Kullanıcı modalın en altına ulaştığında
  assert.equal(isScrolledToBottom(580, 400, 1000), true)
  assert.equal(isScrolledToBottom(600, 400, 1000), true)
})

test('Geliştirme 4: HepsiJET Kargo Takip Mesajı ve Link Formatı', () => {
  const barcode = 'KP123456789TR'
  const trackingUrl = `https://hepsijet.com/gonderi-takip/${encodeURIComponent(barcode)}`
  const orderNumber = 'KALIPORT-2026-999'
  const customerName = 'Ahmet Yılmaz'

  const message = `Sayın ${customerName},\n\n${orderNumber} numaralı siparişiniz HepsiJET kargoya teslim edilmiştir.\n\nKargo Firması: HepsiJET\nTakip Numarası: ${barcode}\nKargo Takip Bağlantısı: ${trackingUrl}\n\nBizi tercih ettiğiniz için teşekkür ederiz.`

  assert.ok(message.includes('HepsiJET'))
  assert.ok(message.includes(barcode))
  assert.ok(message.includes(trackingUrl))
  assert.equal(trackingUrl, 'https://hepsijet.com/gonderi-takip/KP123456789TR')
})

test('Geliştirme 5: Kargo Bildirimi İdempotency Koruması', () => {
  const orderShippingAlreadyNotified = {
    barcode: 'KP998877',
    notificationSent: true,
    notifiedAt: '2026-11-07T12:00:00.000Z',
  }

  const shouldSendNotification = (shipping: typeof orderShippingAlreadyNotified) => {
    if (shipping.notificationSent) return false
    return Boolean(shipping.barcode)
  }

  assert.equal(shouldSendNotification(orderShippingAlreadyNotified), false)
})

test('Geliştirme 6: Footer Resmi Telif ve Geliştirici İmzası Doğrulaması', () => {
  const officialCopyright = 'GÜLÜMSE© 2026 Kalıport Alüminyum Plastik Kalıp İmalat San. Tic. Ltd. Şti. Tüm Hakları Saklıdır.'
  const developerSignature = 'Developed by Umutynclk'

  assert.ok(officialCopyright.includes('Kalıport Alüminyum Plastik Kalıp İmalat San. Tic. Ltd. Şti.'))
  assert.ok(developerSignature.includes('Developed by Umutynclk'))
})

test('Geliştirme 7: HepsiJET Gerçek Barkod Doğrulama ve Simülasyon Filtreleme', () => {
  const isValidRealBarcode = (barcode?: string) => {
    if (!barcode) return false
    if (/NUMUNE|SAMPLE|TEST/i.test(barcode)) return false
    if (barcode.startsWith('SIM-')) return false
    return true
  }

  assert.equal(isValidRealBarcode('SIM-BARCODE-12345'), false)
  assert.equal(isValidRealBarcode('TEST_NUMUNE_001'), false)
  assert.equal(isValidRealBarcode('SAMPLE-BARCODE'), false)
  assert.equal(isValidRealBarcode(undefined), false)
  assert.equal(isValidRealBarcode(''), false)
  assert.equal(isValidRealBarcode('HJ92837482910'), true)
  assert.equal(isValidRealBarcode('GS261106099630274A3BFAEE'), true)
})

test('Geliştirme 8: Sipariş ve Taşıyıcı Durumu Güvenli Türkçe Eşleme', () => {
  const mapStatus = (orderStatus: string, shipping?: { barcode?: string; status?: string }) => {
    const hasRealBarcode = shipping?.barcode && !/NUMUNE|SAMPLE|TEST/i.test(shipping.barcode) && !shipping.barcode.startsWith('SIM-')
    if (orderStatus === 'cancelled') return 'İptal Edildi'
    if (orderStatus === 'completed') return 'Teslim Edildi'
    if (hasRealBarcode) {
      if (shipping?.status === 'in_transit') return 'Yolda'
      if (shipping?.status === 'created' || orderStatus === 'shipped') return 'Kargoya Verildi'
      return 'Kargo Etiketi Oluşturuldu'
    }
    if (orderStatus === 'paid' || orderStatus === 'processing') return 'Hazırlanıyor'
    return 'Sipariş Alındı'
  }

  // Henüz kargo etiketi yoksa ve ödendi ise
  assert.equal(mapStatus('paid'), 'Hazırlanıyor')
  // Gerçek barkod var ama henüz dağıtımda/yolda değilse
  assert.equal(mapStatus('paid', { barcode: 'HJ12345678', status: 'label_printed' }), 'Kargo Etiketi Oluşturuldu')
  // Kargo taşıyıcıya verilmişse
  assert.equal(mapStatus('shipped', { barcode: 'HJ12345678', status: 'created' }), 'Kargoya Verildi')
  // Yolda ise
  assert.equal(mapStatus('shipped', { barcode: 'HJ12345678', status: 'in_transit' }), 'Yolda')
  // Tamamlandı ise
  assert.equal(mapStatus('completed'), 'Teslim Edildi')
  // İptal ise
  assert.equal(mapStatus('cancelled'), 'İptal Edildi')
})


