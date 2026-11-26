/**
 * lib/orders/cancellationPolicy.ts
 *
 * Müşteri ve admin sipariş iptali, HepsiJET canlı takip ayrıştırma,
 * taşıyıcıya teslim edilmiş paketlerin korunması ve yoldaki siparişler için
 * yasal cayma talebi (Mesafeli Sözleşmeler Yönetmeliği) ortak politika modülü.
 *
 * Not: Hem sunucu (API rotaları) hem istemci (profil/admin UI) tarafından kullanıldığı için
 * hiçbir sunucu-özel (firebase-admin vb.) bağımlılık içermez.
 */

function mapCarrierCodeToDisplayAndShipping(code: string): {
  displayStatus: string
  shippingStatus: string
} {
  switch (code) {
    case 'ACCEPTED':
    case 'DELIVERY_ACCEPTED':
    case 'COLLECTED':
    case 'KARGOYA_VERILDI':
      return { displayStatus: 'Kargoya Verildi', shippingStatus: 'accepted' }
    case 'IN_TRANSIT':
    case 'TRANSFER':
    case 'TRANSFER_MERKEZINDE':
    case 'X_DOCK_IN':
    case 'X_DOCK_OUT':
    case 'ON_WAY':
    case 'YOLDA':
    case 'SHIPPED':
      return { displayStatus: 'Yolda', shippingStatus: 'in_transit' }
    case 'OUT_FOR_DELIVERY':
    case 'ON_DISTRIBUTION':
    case 'COURIER_ASSIGNED':
    case 'DAGITIMDA':
      return { displayStatus: 'Dağıtımda', shippingStatus: 'out_for_delivery' }
    case 'DELIVERED':
    case 'TESLIM_EDILDI':
      return { displayStatus: 'Teslim Edildi', shippingStatus: 'delivered' }
    case 'UNDELIVERED':
    case 'DELIVERY_ATTEMPT_FAILED':
    case 'NOT_DELIVERED':
    case 'TESLIM_EDILEMEDI':
      return { displayStatus: 'Teslim Edilemedi', shippingStatus: 'failed' }
    case 'RETURN_STARTED':
    case 'RETURNED':
    case 'RETURN_DELIVERED':
    case 'IADE_EDILDI':
      return { displayStatus: 'İade Edildi', shippingStatus: 'returned' }
    default:
      return { displayStatus: 'Kargoya Teslim Edildi', shippingStatus: 'in_transit' }
  }
}

export const CARRIER_HANDED_OVER_HEPSIJET_CODES = new Set<string>([
  'ACCEPTED',
  'DELIVERY_ACCEPTED',
  'COLLECTED',
  'IN_TRANSIT',
  'TRANSFER',
  'TRANSFER_MERKEZINDE',
  'X_DOCK_IN',
  'X_DOCK_OUT',
  'ON_WAY',
  'YOLDA',
  'SHIPPED',
  'KARGOYA_VERILDI',
  'OUT_FOR_DELIVERY',
  'ON_DISTRIBUTION',
  'COURIER_ASSIGNED',
  'DAGITIMDA',
  'DELIVERED',
  'TESLIM_EDILDI',
  'UNDELIVERED',
  'DELIVERY_ATTEMPT_FAILED',
  'NOT_DELIVERED',
  'TESLIM_EDILEMEDI',
  'RETURN_STARTED',
  'RETURNED',
  'RETURN_DELIVERED',
  'IADE_EDILDI',
])

export const PRE_HANDOVER_HEPSIJET_CODES = new Set<string>([
  '',
  'CREATED',
  'NEW',
  'WAITING_FOR_PICKUP',
  'LABEL_CREATED',
  'PENDING',
  'READY_FOR_PICKUP',
  'OLUSTURULDU',
])

export const CANCELLED_HEPSIJET_CODES = new Set<string>([
  'CANCELLED',
  'DELETED',
  'IPTAL',
  'IPTAL_EDILDI',
])

export const CARRIER_HANDED_OVER_SHIPPING_STATUSES = new Set<string>([
  'accepted',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'returned',
  'failed',
])

export type HepsiJetCarrierCategory =
  | 'not_handed_over'
  | 'handed_over'
  | 'cancelled'
  | 'unknown'

export interface ExtractedHepsiJetStatus {
  matched: boolean
  barcode: string
  rawCode: string
  category: HepsiJetCarrierCategory
  displayStatus: string
  mappedShippingStatus: string
}

/**
 * HepsiJET POST /rest/delivery/integration/track yanıtını güvenli şekilde ayrıştırır.
 *
 * HepsiJET canlı yanıtı `response.data` içinde dizi döndürür:
 *   { status: 'OK', data: [{ barcode: '...', integrationStatus: 'IN_TRANSIT', ... }] }
 *
 * Birden fazla gönderi varsa YALNIZCA istenen barkoda ait kaydı seçer;
 * barkod eşleşmezse veya durum tanınmazsa `unknown` döner (asla başka siparişi seçmez).
 */
export function extractHepsiJetIntegrationStatus(
  trackRes: any,
  barcode: string
): ExtractedHepsiJetStatus {
  const targetBarcode = String(barcode || '').trim().toUpperCase()

  if (!trackRes || typeof trackRes !== 'object') {
    return {
      matched: false,
      barcode: targetBarcode,
      rawCode: '',
      category: 'unknown',
      displayStatus: 'Kargo Bilgisi Alınamadı',
      mappedShippingStatus: 'unknown',
    }
  }

  let matchedItem: any = null

  if (Array.isArray(trackRes.data)) {
    matchedItem = trackRes.data.find((item: any) => {
      const itemBarcode = String(item?.barcode || item?.customerDeliveryNo || '').trim().toUpperCase()
      return Boolean(targetBarcode) && itemBarcode === targetBarcode
    })
  } else if (trackRes.data && typeof trackRes.data === 'object') {
    // Tekil obje yanıtı dönen test/mock veya alternatif yapılar için yalnızca barkod eşleşiyorsa (veya barkod alanı yoksa tekil kayıt) kabul et
    const itemBarcode = String(trackRes.data.barcode || trackRes.data.customerDeliveryNo || '').trim().toUpperCase()
    if (!itemBarcode || itemBarcode === targetBarcode) {
      matchedItem = trackRes.data
    }
  }

  if (!matchedItem) {
    return {
      matched: false,
      barcode: targetBarcode,
      rawCode: '',
      category: 'unknown',
      displayStatus: 'Kargo Kaydı Eşleştirilemedi',
      mappedShippingStatus: 'unknown',
    }
  }

  const rawCode = String(
    matchedItem.integrationStatus ??
      matchedItem.deliveryStatus ??
      matchedItem.lastStatus ??
      matchedItem.status ??
      ''
  )
    .trim()
    .toUpperCase()

  if (CANCELLED_HEPSIJET_CODES.has(rawCode)) {
    return {
      matched: true,
      barcode: targetBarcode,
      rawCode,
      category: 'cancelled',
      displayStatus: 'İptal Edildi',
      mappedShippingStatus: 'cancelled',
    }
  }

  if (CARRIER_HANDED_OVER_HEPSIJET_CODES.has(rawCode)) {
    const mapped = mapCarrierCodeToDisplayAndShipping(rawCode)
    return {
      matched: true,
      barcode: targetBarcode,
      rawCode,
      category: 'handed_over',
      displayStatus: mapped.displayStatus,
      mappedShippingStatus: mapped.shippingStatus,
    }
  }

  if (PRE_HANDOVER_HEPSIJET_CODES.has(rawCode)) {
    return {
      matched: true,
      barcode: targetBarcode,
      rawCode,
      category: 'not_handed_over',
      displayStatus: 'Kargo Etiketi Oluşturuldu',
      mappedShippingStatus: 'created',
    }
  }

  // Tanınmayan ham kod -> güvenlik gereği belirsiz kabul edilir (otomatik iptal yapılmaz)
  return {
    matched: true,
    barcode: targetBarcode,
    rawCode,
    category: 'unknown',
    displayStatus: `Bilinmeyen Kargo Durumu (${rawCode})`,
    mappedShippingStatus: 'unknown',
  }
}

export type CancellationDecisionCode =
  | 'ALLOWED'
  | 'ALREADY_CANCELLED'
  | 'DELIVERED_USE_RETURN'
  | 'CARRIER_HANDED_OVER'
  | 'TRACKING_UNAVAILABLE'
  | 'CANCEL_IN_PROGRESS'

export interface CancellationEligibilityResult {
  allowed: boolean
  code: CancellationDecisionCode
  reason?: string
  allowWithdrawalRequest?: boolean
  requiresAdminReview?: boolean
  carrierStatusCode?: string
  carrierDisplayStatus?: string
  mappedShippingStatus?: string
  firestoreMismatch?: boolean
}

/**
 * Müşteri ve admin iptal akışlarının tamamı için tek merkezî uygunluk değerlendirmesi.
 */
export function evaluateCancellationEligibility(
  orderData: Record<string, any>,
  options?: {
    liveTrackStatus?: ExtractedHepsiJetStatus | null
    liveTrackingError?: string | null
    liveDispatchEnabled?: boolean
    hasLiveShipment?: boolean
  }
): CancellationEligibilityResult {
  const orderStatus = String(orderData?.status || '').toLowerCase()
  const shipping = orderData?.shipping || {}
  const shippingStatus = String(shipping.status || '').toLowerCase()

  if (orderStatus === 'cancelled') {
    return {
      allowed: false,
      code: 'ALREADY_CANCELLED',
      reason: 'Bu sipariş zaten iptal edilmiştir.',
    }
  }

  if (orderStatus === 'delivered' || orderStatus === 'completed' || shippingStatus === 'delivered') {
    return {
      allowed: false,
      code: 'DELIVERED_USE_RETURN',
      reason: 'Teslim edilmiş siparişler iptal edilemez. Teslimat sonrası iade talebi oluşturabilirsiniz.',
    }
  }

  // Firestore'da kayıtlı taşıyıcı teslim durumu
  if (orderStatus === 'shipped' || CARRIER_HANDED_OVER_SHIPPING_STATUSES.has(shippingStatus)) {
    return {
      allowed: false,
      code: 'CARRIER_HANDED_OVER',
      allowWithdrawalRequest: true,
      carrierDisplayStatus: shipping.lastStatusText || 'Kargoya Teslim Edildi',
      mappedShippingStatus: shippingStatus || 'in_transit',
      reason:
        'Siparişiniz kargo firmasına teslim edildiği için anlık iptal ve otomatik iade yapılamaz. Yasal cayma hakkınızı kullanmak için "Cayma Talebi İlet" seçeneğini kullanabilirsiniz.',
    }
  }

  // Canlı HepsiJET gönderisi varsa canlı takip sonucunu zorunlu doğrula
  const liveEnabled = Boolean(options?.liveDispatchEnabled)
  const hasLiveShipment = Boolean(options?.hasLiveShipment)

  if (liveEnabled && hasLiveShipment) {
    if (options?.liveTrackingError) {
      return {
        allowed: false,
        code: 'TRACKING_UNAVAILABLE',
        requiresAdminReview: true,
        reason:
          'HepsiJET canlı kargo durumu şu anda doğrulanamadığı için otomatik iptal ve iade güvenlik nedeniyle durduruldu. Talep yönetici incelemesine yönlendirildi.',
      }
    }

    const liveStatus = options?.liveTrackStatus
    if (!liveStatus || liveStatus.category === 'unknown') {
      return {
        allowed: false,
        code: 'TRACKING_UNAVAILABLE',
        requiresAdminReview: true,
        carrierStatusCode: liveStatus?.rawCode,
        carrierDisplayStatus: liveStatus?.displayStatus,
        reason:
          'HepsiJET gönderisinin güncel taşıyıcı durumu kesinleştirilemedi. Paket kuryeye teslim edilmiş olabileceğinden otomatik iptal engellendi ve yönetici incelemesine alındı.',
      }
    }

    if (liveStatus.category === 'handed_over') {
      const firestoreMismatch = shippingStatus === 'created' || shippingStatus === '' || shippingStatus === 'none'
      return {
        allowed: false,
        code: 'CARRIER_HANDED_OVER',
        allowWithdrawalRequest: true,
        requiresAdminReview: firestoreMismatch,
        carrierStatusCode: liveStatus.rawCode,
        carrierDisplayStatus: liveStatus.displayStatus,
        mappedShippingStatus: liveStatus.mappedShippingStatus,
        firestoreMismatch,
        reason: `Siparişiniz HepsiJET tarafından teslim alınmıştır (${liveStatus.displayStatus}). Normal iptal ve otomatik ödeme iadesi yapılamaz; yasal cayma talebi iletebilirsiniz.`,
      }
    }
  }

  return {
    allowed: true,
    code: 'ALLOWED',
  }
}

export interface WithdrawalEligibilityResult {
  eligible: boolean
  reason?: string
}

/**
 * Kargoya teslim edilmiş / transfer sürecindeki siparişler için
 * Mesafeli Sözleşmeler Yönetmeliği kapsamındaki yasal cayma talebi uygunluk kontrolü.
 */
export function evaluateWithdrawalEligibility(orderData: Record<string, any>): WithdrawalEligibilityResult {
  const orderStatus = String(orderData?.status || '').toLowerCase()
  const shippingStatus = String(orderData?.shipping?.status || '').toLowerCase()

  if (orderStatus === 'cancelled') {
    return { eligible: false, reason: 'Bu sipariş zaten iptal edilmiştir.' }
  }

  if (orderStatus === 'delivered' || orderStatus === 'completed' || shippingStatus === 'delivered') {
    return {
      eligible: false,
      reason: 'Teslim edilmiş siparişler için doğrudan "İade Talebi Oluştur" akışını kullanabilirsiniz.',
    }
  }

  if (orderData?.withdrawalRequest && orderData.withdrawalRequest.status !== 'cancelled') {
    return {
      eligible: false,
      reason: 'Bu sipariş için zaten aktif bir cayma talebiniz bulunmaktadır.',
    }
  }

  const isInCarrierHands =
    orderStatus === 'shipped' ||
    ['accepted', 'in_transit', 'out_for_delivery', 'failed'].includes(shippingStatus)

  if (!isInCarrierHands) {
    return {
      eligible: false,
      reason: 'Siparişiniz henüz kargo firmasına teslim edilmemiştir; doğrudan "Siparişi İptal Et" seçeneğini kullanabilirsiniz.',
    }
  }

  return { eligible: true }
}

/**
 * Müşteri arayüzünde bir sipariş için hangi aksiyonun gösterileceğini belirler.
 */
export function getCustomerOrderActionMode(order: Record<string, any>): 'cancel' | 'withdrawal' | 'return' | 'none' {
  const rawStatus = String(order?.status || '').toLowerCase()
  const rawShipStatus = String(order?.shipping?.status || '').toLowerCase()

  if (rawStatus === 'cancelled' || rawShipStatus === 'cancelled' || order?.isCancelled === true) {
    return 'none'
  }

  if (rawStatus === 'delivered' || rawStatus === 'completed' || rawShipStatus === 'delivered') {
    return 'return'
  }

  if (rawStatus === 'shipped' || CARRIER_HANDED_OVER_SHIPPING_STATUSES.has(rawShipStatus)) {
    return 'withdrawal'
  }

  if (rawShipStatus === 'cancel_pending') {
    return 'none'
  }

  return 'cancel'
}
