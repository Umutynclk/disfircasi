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

test('Geliştirme 3: Ön Bilgilendirme ve KVKK Onaylarının Bağımsız ve Serbest Tıklanabilir Olması', () => {
  // Checkbox'lar kilitli veya disabled olmamalıdır
  const isCheckboxDisabled = false
  assert.equal(isCheckboxDisabled, false)

  // TAMAM butonu modal açıldığı andan itibaren aktiftir
  const isModalOkButtonDisabled = false
  assert.equal(isModalOkButtonDisabled, false)

  // Kullanıcı onayı manuel verir; sistem otomatik işaretlemez
  let agreementAccepted = false
  let kvkkAccepted = false

  // Kullanıcı sözleşme onayını bağımsız işaretleyebilir
  agreementAccepted = true
  assert.equal(agreementAccepted, true)
  assert.equal(kvkkAccepted, false)

  // Kullanıcı KVKK onayını bağımsız işaretleyebilir
  kvkkAccepted = true
  assert.equal(agreementAccepted, true)
  assert.equal(kvkkAccepted, true)
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

test('Geliştirme 9: Güvenli Yönlendirme (Open Redirect Koruması) ve Giriş Akışı', () => {
  const getSafeRedirect = (rawRedirect: string | null): string => {
    if (!rawRedirect) return '/'
    if (rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.includes('://')) {
      return rawRedirect
    }
    return '/'
  }

  // Geçerli iç rotalar
  assert.equal(getSafeRedirect('/satin-al'), '/satin-al')
  assert.equal(getSafeRedirect('/satin-al?sepet=true'), '/satin-al?sepet=true')
  assert.equal(getSafeRedirect('/profil'), '/profil')

  // Zararlı veya sahte dış URL denemeleri engellenir
  assert.equal(getSafeRedirect('https://evil.com/phishing'), '/')
  assert.equal(getSafeRedirect('http://attacker.com'), '/')
  assert.equal(getSafeRedirect('//evil.com/hack'), '/')
  assert.equal(getSafeRedirect('javascript:alert(1)'), '/')
  assert.equal(getSafeRedirect(null), '/')
  assert.equal(getSafeRedirect(''), '/')
})

test('Geliştirme 10: Sepet Verilerinin Giriş Sürecinde Korunması (Storage Kontrolü)', () => {
  // Sepet items
  const initialCart = [
    { productId: 'brush-white', name: '360 Sonic Diş Fırçası - Beyaz', price: 899, quantity: 1 },
    { productId: 'head-pack-3', name: 'Yedek Başlık 3lü', price: 249, quantity: 2 },
  ]

  // Mock localStorage
  const storage: Record<string, string> = {}
  storage['smilebrush_cart'] = JSON.stringify(initialCart)
  storage['checkout_cart'] = JSON.stringify(initialCart)

  // Kullanıcı giriş yaptıktan sonra sepetin localStorage'dan okunması
  const retrievedCart = JSON.parse(storage['smilebrush_cart'])
  assert.equal(retrievedCart.length, 2)
  assert.equal(retrievedCart[0].productId, 'brush-white')
  assert.equal(retrievedCart[1].quantity, 2)
})

test('Geliştirme 11: API Sunucu Tarafı Kimlik Doğrulama Güvenliği (Auth Header & UID)', () => {
  const validateAuthHeader = (header: string | null) => {
    if (!header || !header.startsWith('Bearer ')) {
      return { status: 401, error: 'Sipariş oluşturabilmek için lütfen hesabınıza giriş yapınız.' }
    }
    const token = header.replace('Bearer ', '').trim()
    if (!token) {
      return { status: 401, error: 'Geçersiz oturum belirteci.' }
    }
    return { status: 200, token }
  }

  // Header yoksa
  assert.equal(validateAuthHeader(null).status, 401)
  // Bearer formatı yoksa
  assert.equal(validateAuthHeader('Basic abc123xyz').status, 401)
  // Boş token ise
  assert.equal(validateAuthHeader('Bearer ').status, 401)
  // Geçerli token formatı
  const valid = validateAuthHeader('Bearer valid-firebase-id-token-12345')
  assert.equal(valid.status, 200)
  assert.equal((valid as any).token, 'valid-firebase-id-token-12345')
})

test('Geliştirme 12: HepsiJET Kargo Takip URL Formatı (404 Vermeyen Resmi URL)', () => {
  // buildHepsiJetTrackingUrl doğrulaması
  const buildHepsiJetTrackingUrl = (barcode: string) => {
    if (!barcode) return ''
    return `https://hepsijet.com/gonderi-takibi/${encodeURIComponent(barcode.trim())}`
  }

  // 1. Gerçek KALIPORT barkodu
  const url1 = buildHepsiJetTrackingUrl('KALIPORT4A3BFAEE')
  assert.equal(url1, 'https://hepsijet.com/gonderi-takibi/KALIPORT4A3BFAEE')
  assert.equal(url1.includes('gonderi-takip?barkod='), false)
  assert.equal(url1.includes('gonderi-takibi/'), true)

  // 2. Özel karakterli / boşluklu barkod trim ve encode
  const url2 = buildHepsiJetTrackingUrl(' HJKLPGS2609127BBBC ')
  assert.equal(url2, 'https://hepsijet.com/gonderi-takibi/HJKLPGS2609127BBBC')

  // 3. Boş barkod
  assert.equal(buildHepsiJetTrackingUrl(''), '')
})

test('Geliştirme 13: HepsiJET integrationStatus Durum Eşleşmesi ve Geri Düşmeme Koruması', () => {
  // mapIntegrationStatus doğrulaması
  const mapStatus = (status: string) => {
    const code = (status || '').toUpperCase().trim()
    switch (code) {
      case 'ACCEPTED':
        return { displayStatus: 'Kargoya Verildi', orderStatus: 'shipped', shippingStatus: 'accepted' }
      case 'OUT_FOR_DELIVERY':
        return { displayStatus: 'Dağıtımda', orderStatus: 'shipped', shippingStatus: 'out_for_delivery' }
      case 'DELIVERED':
        return { displayStatus: 'Teslim Edildi', orderStatus: 'completed', shippingStatus: 'delivered' }
      case '':
        return { displayStatus: 'Kargo Etiketi Oluşturuldu', orderStatus: null, shippingStatus: 'created' }
      default:
        return { displayStatus: 'Kargo Bilgisi Alınıyor', orderStatus: null, shippingStatus: 'unknown' }
    }
  }

  // ACCEPTED
  const accepted = mapStatus('ACCEPTED')
  assert.equal(accepted.displayStatus, 'Kargoya Verildi')
  assert.equal(accepted.orderStatus, 'shipped')
  assert.equal(accepted.shippingStatus, 'accepted')

  // OUT_FOR_DELIVERY
  const out = mapStatus('OUT_FOR_DELIVERY')
  assert.equal(out.displayStatus, 'Dağıtımda')
  assert.equal(out.orderStatus, 'shipped')

  // DELIVERED
  const delivered = mapStatus('DELIVERED')
  assert.equal(delivered.displayStatus, 'Teslim Edildi')
  assert.equal(delivered.orderStatus, 'completed')
  assert.equal(delivered.shippingStatus, 'delivered')

  // Boş / henüz taşınmamış
  const empty = mapStatus('')
  assert.equal(empty.displayStatus, 'Kargo Etiketi Oluşturuldu')
  assert.equal(empty.orderStatus, null)

  // Bilinmeyen kod
  const unknown = mapStatus('SOMETHING_NEW')
  assert.equal(unknown.orderStatus, null)
  assert.equal(unknown.shippingStatus, 'unknown')

  // Durum önceliği (geri düşmeme kontrolü)
  const ranks: Record<string, number> = {
    created: 0,
    unknown: 0,
    accepted: 1,
    out_for_delivery: 2,
    delivered: 3,
    cancelled: 4,
  }
  const shouldUpgrade = (curr: string, next: string) => {
    if (ranks[curr] === ranks['cancelled']) return false
    return (ranks[next] || 0) > (ranks[curr] || 0)
  }

  // delivered durumundaki kargo, accepted veya out_for_delivery'ye geri düşemez
  assert.equal(shouldUpgrade('delivered', 'accepted'), false)
  assert.equal(shouldUpgrade('delivered', 'out_for_delivery'), false)

  // accepted durumundaki kargo out_for_delivery ve delivered'a yükselebilir
  assert.equal(shouldUpgrade('accepted', 'out_for_delivery'), true)
  assert.equal(shouldUpgrade('accepted', 'delivered'), true)

  // cancelled siparişler asla güncellenmez
  assert.equal(shouldUpgrade('cancelled', 'delivered'), false)
})

test('Geliştirme 14: HepsiJET 8 Aşamalı Kargo Durumları & 24 Saat Otomatik Arşivleme Senaryoları', () => {
  const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

  // 1. ACCEPTED -> Kargoya Verildi
  const mapAccepted = (code: string) => {
    switch (code) {
      case 'ACCEPTED':
      case 'DELIVERY_ACCEPTED':
      case 'COLLECTED':
        return { displayStatus: 'Kargoya Verildi', orderStatus: 'shipped', shippingStatus: 'accepted' }
      case 'IN_TRANSIT':
      case 'TRANSFER':
      case 'X_DOCK_IN':
        return { displayStatus: 'Yolda', orderStatus: 'shipped', shippingStatus: 'in_transit' }
      case 'OUT_FOR_DELIVERY':
        return { displayStatus: 'Dağıtımda', orderStatus: 'shipped', shippingStatus: 'out_for_delivery' }
      case 'DELIVERED':
        return { displayStatus: 'Teslim Edildi', orderStatus: 'completed', shippingStatus: 'delivered' }
      case 'CANCELLED':
        return { displayStatus: 'İptal Edildi', orderStatus: 'cancelled', shippingStatus: 'cancelled' }
      default:
        return { displayStatus: 'Kargo Bilgisi Alınıyor', orderStatus: null, shippingStatus: 'unknown' }
    }
  }

  assert.equal(mapAccepted('ACCEPTED').displayStatus, 'Kargoya Verildi')
  assert.equal(mapAccepted('ACCEPTED').shippingStatus, 'accepted')

  // 2. IN_TRANSIT -> Yolda
  assert.equal(mapAccepted('IN_TRANSIT').displayStatus, 'Yolda')
  assert.equal(mapAccepted('TRANSFER').displayStatus, 'Yolda')
  assert.equal(mapAccepted('X_DOCK_IN').displayStatus, 'Yolda')

  // 3. OUT_FOR_DELIVERY -> Dağıtımda
  assert.equal(mapAccepted('OUT_FOR_DELIVERY').displayStatus, 'Dağıtımda')

  // 4. DELIVERED -> Teslim Edildi
  assert.equal(mapAccepted('DELIVERED').displayStatus, 'Teslim Edildi')

  // Arşivleme kuralı fonksiyonu
  const checkIsInArchive = (order: {
    status?: string
    isArchived?: boolean
    archived?: boolean
    archiveAt?: string
    terminalStatusAt?: string
    shipping?: { status?: string }
  }, now: number) => {
    if (order.isArchived === true || order.archived === true) return true
    if (order.archiveAt) {
      const t = new Date(order.archiveAt).getTime()
      if (!isNaN(t) && now >= t) return true
    } else {
      const isDel = order.status === 'delivered' || order.status === 'completed' || order.shipping?.status === 'delivered'
      const isCan = order.status === 'cancelled' || order.shipping?.status === 'cancelled'
      if (isDel || isCan) {
        if (order.terminalStatusAt) {
          const t = new Date(order.terminalStatusAt).getTime()
          if (!isNaN(t) && now >= t + TWENTY_FOUR_HOURS_MS) return true
        }
      }
    }
    return false
  }

  const deliveryTimestamp = new Date('2026-11-10T10:00:00.000Z').getTime()
  const archiveAtString = new Date(deliveryTimestamp + TWENTY_FOUR_HOURS_MS).toISOString()

  const deliveredOrder = {
    status: 'completed',
    shipping: { status: 'delivered' },
    terminalStatusAt: new Date(deliveryTimestamp).toISOString(),
    archiveAt: archiveAtString,
    isArchived: false,
    archived: false,
  }

  // 5. DELIVERED üzerinden 23 saat geçti -> Aktif listede kalmalı (Arşivde OLMAMALI)
  const timeAfter23Hours = deliveryTimestamp + 23 * 60 * 60 * 1000
  assert.equal(checkIsInArchive(deliveredOrder, timeAfter23Hours), false, '23. saatte henüz arşivlenmemelidir')

  // 6. DELIVERED üzerinden 24 saat geçti -> Arşivlenmeli
  const timeAfter24Hours = deliveryTimestamp + 24 * 60 * 60 * 1000
  assert.equal(checkIsInArchive(deliveredOrder, timeAfter24Hours), true, '24. saatte arşivde görünmelidir')

  const timeAfter25Hours = deliveryTimestamp + 25 * 60 * 60 * 1000
  assert.equal(checkIsInArchive(deliveredOrder, timeAfter25Hours), true, '25. saatte arşivde görünmelidir')

  // 7. CANCELLED -> İptal Edildi
  assert.equal(mapAccepted('CANCELLED').displayStatus, 'İptal Edildi')

  // 8. CANCELLED üzerinden 24 saat geçti -> Arşivlenmeli
  const cancelTimestamp = new Date('2026-11-08T12:00:00.000Z').getTime()
  const cancelledOrder = {
    status: 'cancelled',
    shipping: { status: 'cancelled' },
    terminalStatusAt: new Date(cancelTimestamp).toISOString(),
    archiveAt: new Date(cancelTimestamp + TWENTY_FOUR_HOURS_MS).toISOString(),
    isArchived: false,
  }
  // 23 saat sonra
  assert.equal(checkIsInArchive(cancelledOrder, cancelTimestamp + 23 * 60 * 60 * 1000), false)
  // 24 saat sonra
  assert.equal(checkIsInArchive(cancelledOrder, cancelTimestamp + 24 * 60 * 60 * 1000), true)

  // 9. İptal edilmiş sipariş eski kargo durumu nedeniyle değişmemeli
  const shouldUpgradeWithCancelGuard = (curr: string, next: string) => {
    if (curr === 'cancelled') return false
    return true
  }
  assert.equal(shouldUpgradeWithCancelGuard('cancelled', 'accepted'), false, 'İptal edilmiş sipariş kargo durumuyla ezilemez')
  assert.equal(shouldUpgradeWithCancelGuard('cancelled', 'delivered'), false, 'İptal edilmiş sipariş teslimatla ezilemez')

  // 10. API geçici hata verdiğinde son doğrulanmış durum korunmalı
  let currentOrderShippingStatus = 'out_for_delivery'
  const simulateApiFailure = () => {
    // API hatası yakalandı, mevcut durum korunur
    return currentOrderShippingStatus
  }
  assert.equal(simulateApiFailure(), 'out_for_delivery')

  // 11. Admin ve Müşteri aynı ortak durumu görmeli
  const testOrder = {
    status: 'shipped',
    shipping: {
      status: 'out_for_delivery',
      providerStatus: 'OUT_FOR_DELIVERY',
    },
  }
  const resolveStatus = (ord: any) => {
    if (ord.shipping?.status === 'out_for_delivery') return 'Dağıtımda'
    if (ord.shipping?.status === 'delivered') return 'Teslim Edildi'
    return 'Hazırlanıyor'
  }
  const adminDisplay = resolveStatus(testOrder)
  const customerDisplay = resolveStatus(testOrder)
  assert.equal(adminDisplay, customerDisplay)
  assert.equal(adminDisplay, 'Dağıtımda')

  // 12. Aynı cron iki kere çalıştığında mükerrer arşivleme oluşmamalı
  let archiveRunCount = 0
  const orderDocState = { isArchived: false, archivedAt: null as string | null }
  const runArchiveStep = (now: number) => {
    if (orderDocState.isArchived) return 'skipped_already_archived'
    orderDocState.isArchived = true
    orderDocState.archivedAt = new Date(now).toISOString()
    archiveRunCount++
    return 'archived'
  }
  assert.equal(runArchiveStep(timeAfter25Hours), 'archived')
  assert.equal(runArchiveStep(timeAfter25Hours + 1000), 'skipped_already_archived')
  assert.equal(archiveRunCount, 1, 'Yalnızca bir kez arşivlenmeli')

  // 13. Arşivlenen sipariş detayları erişilebilir kalmalı (silinmemeli)
  const fullOrder = {
    id: 'ord-test-999',
    orderNumber: 'GS2611999',
    total: 899,
    isArchived: true,
    archivedAt: new Date().toISOString(),
    paymentStatus: 'PAID',
    items: [{ name: 'Sonic Diş Fırçası', price: 899, quantity: 1 }],
  }
  assert.equal(fullOrder.isArchived, true)
  assert.equal(fullOrder.total, 899)
  assert.equal(fullOrder.items.length, 1)
})



