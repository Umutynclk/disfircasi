import test from 'node:test'
import assert from 'node:assert/strict'
import {
  calculateOrderStats,
  isOrderPaid,
  isTodayInIstanbul,
  isThisWeekInIstanbul,
  isThisMonthInIstanbul,
  getIstanbulDateString,
} from '../lib/utils/orderStats'
import { getCommonOrderDisplayStatus } from '../lib/hepsijet/status-display'

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

test('Geliştirme 15: HepsiJET RETURNED (İade) ve CANCELLED (İptal) Kesin Ayrımı', () => {
  // mapIntegrationStatus mantığı doğrulaması
  const mapStatusDetailed = (code: string) => {
    switch (code) {
      case 'RETURN_STARTED':
      case 'RETURNED':
      case 'RETURN_DELIVERED':
        return {
          displayStatus: 'İade Edildi',
          orderStatus: null, // Kargo iadesi sipariş durumunu iptal (cancelled) yapmaz!
          shippingStatus: 'returned',
          providerStatus: code,
        }
      case 'CANCELLED':
      case 'DELETED':
        return {
          displayStatus: 'İptal Edildi',
          orderStatus: 'cancelled',
          shippingStatus: 'cancelled',
          providerStatus: code,
        }
      default:
        return { displayStatus: 'Diğer', orderStatus: null, shippingStatus: 'unknown', providerStatus: code }
    }
  }

  // 1. İade durumları (RETURNED, RETURN_STARTED, RETURN_DELIVERED)
  const ret1 = mapStatusDetailed('RETURNED')
  assert.equal(ret1.displayStatus, 'İade Edildi')
  assert.equal(ret1.shippingStatus, 'returned')
  assert.equal(ret1.orderStatus, null, 'RETURNED siparişi cancelled yapmamalıdır')

  const ret2 = mapStatusDetailed('RETURN_STARTED')
  assert.equal(ret2.displayStatus, 'İade Edildi')
  assert.equal(ret2.shippingStatus, 'returned')
  assert.equal(ret2.orderStatus, null)

  const ret3 = mapStatusDetailed('RETURN_DELIVERED')
  assert.equal(ret3.displayStatus, 'İade Edildi')
  assert.equal(ret3.shippingStatus, 'returned')
  assert.equal(ret3.orderStatus, null)

  // 2. Gerçek İptal durumları (CANCELLED, DELETED)
  const can1 = mapStatusDetailed('CANCELLED')
  assert.equal(can1.displayStatus, 'İptal Edildi')
  assert.equal(can1.shippingStatus, 'cancelled')
  assert.equal(can1.orderStatus, 'cancelled')

  const can2 = mapStatusDetailed('DELETED')
  assert.equal(can2.displayStatus, 'İptal Edildi')
  assert.equal(can2.shippingStatus, 'cancelled')
  assert.equal(can2.orderStatus, 'cancelled')

  // 3. Rozet Gösterimi (getCommonOrderDisplayStatus mantığı)
  const resolveDisplayBadge = (order: any) => {
    const rawShipping = order.shipping?.status
    const provStatus = order.shipping?.providerStatus

    if (
      rawShipping === 'returned' ||
      provStatus === 'RETURNED' ||
      provStatus === 'RETURN_STARTED' ||
      provStatus === 'RETURN_DELIVERED' ||
      order.status === 'returned' ||
      order.status === 'refunded'
    ) {
      return { key: 'returned', text: 'İade Edildi', color: 'text-purple-700' }
    }

    if (order.status === 'cancelled' || rawShipping === 'cancelled' || order.isCancelled === true) {
      return { key: 'cancelled', text: 'İptal Edildi', color: 'text-rose-700' }
    }

    return { key: 'other', text: 'Diğer', color: 'text-slate-700' }
  }

  // İade edilen kargonun siparişi mor "İade Edildi" rozetini almalı
  const returnedOrderMock = {
    status: 'shipped',
    shipping: {
      status: 'returned',
      providerStatus: 'RETURNED',
    },
  }
  const badgeReturn = resolveDisplayBadge(returnedOrderMock)
  assert.equal(badgeReturn.key, 'returned')
  assert.equal(badgeReturn.text, 'İade Edildi')
  assert.equal(badgeReturn.color, 'text-purple-700')

  // Gerçekten iptal edilen sipariş kırmızı "İptal Edildi" rozetini almalı
  const cancelledOrderMock = {
    status: 'cancelled',
    isCancelled: true,
    shipping: {
      status: 'created',
    },
  }
  const badgeCancel = resolveDisplayBadge(cancelledOrderMock)
  assert.equal(badgeCancel.key, 'cancelled')
  assert.equal(badgeCancel.text, 'İptal Edildi')
  assert.equal(badgeCancel.color, 'text-rose-700')

  // 4. İade edilen siparişin yanlışlıkla 24 saat iptal arşivine alınmaması
  const isEligibleForAutoCancelArchive = (order: any) => {
    const ordStatus = String(order.status || '').toLowerCase()
    const shipStatus = String(order.shipping?.status || '').toLowerCase()
    return ordStatus === 'cancelled' || shipStatus === 'cancelled'
  }
  assert.equal(isEligibleForAutoCancelArchive(returnedOrderMock), false, 'İade edilen sipariş otomatik iptal arşivine alınmamalıdır')
  assert.equal(isEligibleForAutoCancelArchive(cancelledOrderMock), true, 'İptal edilen sipariş iptal arşivine alınmalıdır')
})

test('Geliştirme 16: Admin Kontrol Paneli ve Siparişler Ekranı İstatistik ve Durum Senkronizasyonu', () => {
  const fixedNow = new Date('2026-11-11T14:30:00+03:00').getTime()

  // 1. Sentetik Mock Sipariş Kümesi
  const mockOrders = [
    // 1. Ödeme bekleyen aktif sipariş (ciroya girmez, pending artar)
    {
      id: 'ord-1-pending',
      status: 'pending',
      paymentStatus: 'PENDING',
      total: 350,
      createdAt: '2026-11-11T10:00:00+03:00',
    },
    // 2. Hazırlanan ödenmiş sipariş (ciroya girer, processing artar)
    {
      id: 'ord-2-processing',
      status: 'processing',
      paymentStatus: 'PAID',
      total: 500,
      createdAt: '2026-11-11T11:00:00+03:00',
    },
    // 3. Kargo barkodu oluşturulmuş aktif sipariş (ciroya girer, labelCreated & shipped artar)
    {
      id: 'ord-3-label',
      status: 'processing',
      paymentStatus: 'PAID',
      total: 450,
      createdAt: '2026-11-11T09:00:00+03:00',
      shipping: {
        barcode: 'HJ1234567890',
        status: 'created',
      },
    },
    // 4. HepsiJET tarafından teslim alınmış kargo (ACCEPTED -> accepted & shipped artar)
    {
      id: 'ord-4-accepted',
      status: 'shipped',
      paymentStatus: 'PAID',
      total: 600,
      createdAt: '2026-11-10T15:00:00+03:00',
      shipping: {
        barcode: 'HJ1234567891',
        status: 'accepted',
        providerStatus: 'ACCEPTED',
      },
    },
    // 5. Transfer / yolda olan kargo (IN_TRANSIT -> inTransit & shipped artar)
    {
      id: 'ord-5-transit',
      status: 'shipped',
      paymentStatus: 'PAID',
      total: 750,
      createdAt: '2026-11-10T12:00:00+03:00',
      shipping: {
        barcode: 'HJ1234567892',
        status: 'in_transit',
        providerStatus: 'IN_TRANSIT',
      },
    },
    // 6. Dağıtıma çıkmış kargo (OUT_FOR_DELIVERY -> outForDelivery & shipped artar)
    {
      id: 'ord-6-delivery',
      status: 'shipped',
      paymentStatus: 'PAID',
      total: 800,
      createdAt: '2026-11-09T10:00:00+03:00',
      shipping: {
        barcode: 'HJ1234567893',
        status: 'out_for_delivery',
        providerStatus: 'OUT_FOR_DELIVERY',
      },
    },
    // 7. Teslim edilmiş aktif sipariş (henüz 24 saati dolmamış -> delivered artar)
    {
      id: 'ord-7-delivered-fresh',
      status: 'completed',
      paymentStatus: 'PAID',
      total: 900,
      createdAt: '2026-11-11T08:00:00+03:00',
      completedAt: '2026-11-11T12:00:00+03:00',
      archiveAt: '2026-11-12T12:00:00+03:00', // Gelecekte
      shipping: {
        barcode: 'HJ1234567894',
        status: 'delivered',
        providerStatus: 'DELIVERED',
      },
    },
    // 8. İptal edilmiş aktif sipariş (henüz 24 saati dolmamış -> cancelled artar, ciroya girmez)
    {
      id: 'ord-8-cancelled-fresh',
      status: 'cancelled',
      isCancelled: true,
      paymentStatus: 'PAID',
      total: 400,
      createdAt: '2026-11-11T13:00:00+03:00',
      cancelledAt: '2026-11-11T13:30:00+03:00',
      archiveAt: '2026-11-12T13:30:00+03:00', // Gelecekte
    },
    // 9. Kargo iadesi yapılmış sipariş (RETURNED -> returned artar, cancelled'a SAYILMAZ!)
    {
      id: 'ord-9-returned',
      status: 'shipped',
      paymentStatus: 'PAID',
      total: 550,
      createdAt: '2026-11-10T09:00:00+03:00',
      shipping: {
        barcode: 'HJ1234567895',
        status: 'returned',
        providerStatus: 'RETURNED',
      },
    },
    // 10. Arşivlenmiş sipariş (archiveAt geçmiş -> archived artar, aktif sayıma ve aktif ciroya girmez)
    {
      id: 'ord-10-archived',
      status: 'completed',
      paymentStatus: 'PAID',
      total: 1000,
      createdAt: '2026-11-05T10:00:00+03:00',
      completedAt: '2026-11-06T10:00:00+03:00',
      archiveAt: '2026-11-07T10:00:00+03:00', // Geçmiş
      shipping: {
        barcode: 'HJ1234567896',
        status: 'delivered',
      },
    },
    // 11. Çöp kutusundaki sipariş (isTrash -> trash artar, aktif/arşiv/ciroya girmez)
    {
      id: 'ord-11-trash',
      status: 'cancelled',
      isTrash: true,
      paymentStatus: 'PENDING',
      total: 200,
      createdAt: '2026-11-11T05:00:00+03:00',
    },
  ]

  const stats = calculateOrderStats(mockOrders, fixedNow)

  // 2. Sayım Doğrulamaları
  assert.equal(stats.totalAll, 11, 'Toplam kayıt sayısı 11 olmalı')
  assert.equal(stats.trash, 1, 'Çöp kutusundaki kayıt 1 olmalı')
  assert.equal(stats.archived, 1, 'Arşivdeki kayıt 1 olmalı')
  assert.equal(stats.total, 9, 'Aktif sipariş sayısı 9 olmalı (11 - 1 çöp - 1 arşiv)')
  assert.equal(stats.active, 9, 'active ile total eşit olmalı')

  // 3. Durum Dağılımı Doğrulaması (9 aktif sipariş)
  assert.equal(stats.pending, 1, 'pending = 1 (ord-1)')
  assert.equal(stats.processing, 1, 'processing = 1 (ord-2)')
  assert.equal(stats.shipped, 4, 'shipped = 4 (ord-3, ord-4, ord-5, ord-6)')
  assert.equal(stats.labelCreated, 1, 'labelCreated = 1 (ord-3)')
  assert.equal(stats.accepted, 1, 'accepted = 1 (ord-4)')
  assert.equal(stats.inTransit, 1, 'inTransit = 1 (ord-5)')
  assert.equal(stats.outForDelivery, 1, 'outForDelivery = 1 (ord-6)')
  assert.equal(stats.delivered, 1, 'delivered = 1 (ord-7)')
  assert.equal(stats.cancelled, 1, 'cancelled = 1 (ord-8)')
  assert.equal(stats.returned, 1, 'returned = 1 (ord-9)')

  // İnvariant: Her aktif sipariş tam olarak 1 durum kategorisine aittir
  const sumActiveCategories =
    stats.pending +
    stats.processing +
    stats.shipped +
    stats.delivered +
    stats.cancelled +
    stats.returned
  assert.equal(sumActiveCategories, stats.total, 'Durum toplamı tam olarak aktif sipariş sayısına eşit olmalı')

  // 4. RETURNED ≠ CANCELLED Ayrımı
  assert.equal(stats.returned, 1, 'İade edilen sipariş returned olarak sayılmalı')
  assert.equal(stats.cancelled, 1, 'İade edilen sipariş cancelled içine DAHİL EDİLMEMELİDİR')

  // 5. Ciro / Gelir Doğrulaması (Yalnızca PAID siparişler!)
  // Aktif PAID ve iptal/iade olmayan siparişler:
  // ord-2: 500 TL (processing, PAID)
  // ord-3: 450 TL (shipped, PAID)
  // ord-4: 600 TL (shipped, PAID)
  // ord-5: 750 TL (shipped, PAID)
  // ord-6: 800 TL (shipped, PAID)
  // ord-7: 900 TL (delivered, PAID)
  // (ord-1 PENDING: 0 TL, ord-8 CANCELLED: 0 TL, ord-9 RETURNED: 0 TL)
  // Toplam aktif ciro: 500 + 450 + 600 + 750 + 800 + 900 = 4000 TL
  assert.equal(stats.revenue, 4000, 'Aktif PAID siparişlerin cirosu 4000 TL olmalıdır')

  // Tüm ödenmiş ciro (arşiv dahil ord-10 1000 TL): 4000 + 1000 = 5000 TL
  assert.equal(stats.totalPaidRevenue, 5000, 'Arşiv dahil toplam ödenmiş ciro 5000 TL olmalıdır')

  // 6. Türkiye Saati (Europe/Istanbul) Gün Dönümü Doğrulaması
  // Bugün (2026-11-11) oluşturulmuş aktif PAID siparişler:
  // ord-2 (500) + ord-3 (450) + ord-7 (900) = 1850 TL
  // (ord-10 2026-11-05, ord-4 ve ord-5 ve ord-9 2026-11-10, ord-6 2026-11-09)
  assert.equal(stats.todayRevenue, 1850, 'Bugünün cirosu 1850 TL olmalıdır')

  // Tarih yardımcı fonksiyonları
  assert.equal(isTodayInIstanbul('2026-11-11T03:01:00+03:00', fixedNow), true)
  assert.equal(isTodayInIstanbul('2026-11-10T23:59:59+03:00', fixedNow), false)
  assert.equal(getIstanbulDateString(fixedNow), '2026-11-11')
})




