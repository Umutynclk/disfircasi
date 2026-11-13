/**
 * lib/returns/service.ts
 *
 * SONRAKAM / KALIPORT - İade ve İptal İş Mantığı ve Uygunluk Motoru
 *
 * Kurallar:
 * 1. Tam sipariş iadeleri (scope: 'full'): Her zaman yönetici manuel incelemesine ('pending_admin_review') gider.
 * 2. Kısmi iadeler (scope: 'partial'): Belirlenen 9 koşulun tamamı sağlanıyorsa 'auto_preapproved' alır;
 *    hasarlı, yanlış, eksik veya şüpheli durumlarda güvenli varsayılan olarak 'pending_admin_review'e yönlendirilir.
 * 3. İptal (cancellation) ile iade (return) kesin olarak ayrı süreçlerdir.
 * 4. Kargo teslim alınmadan önce (ACCEPTED öncesi) iptal edilebilir; teslim edildikten sonra yalnızca iade edilebilir.
 */

import { ReturnRequest, ReturnItem, ReturnReasonCode, ReturnScope, ReturnStatus, RETURN_REASONS } from './types'

export const RETURN_WINDOW_DAYS = 14
export const FOURTEEN_DAYS_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000

export interface ReturnEvaluationResult {
  eligible: boolean
  error?: string
  scope: ReturnScope
  initialStatus: ReturnStatus
  approvalType: 'automatic' | 'manual'
  items: ReturnItem[]
  totalRefundAmountTRY: number
  autoPreapprovalReasons?: string[]
  requiresAdminReasons?: string[]
}

/**
 * Siparişin kargoya verilmeden önceki iptal uygunluğunu değerlendirir.
 */
export function validateCancellationEligibility(order: any): { eligible: boolean; reason?: string; scenario: 'A' | 'B' | 'C' | 'D' | 'NONE' } {
  if (!order) {
    return { eligible: false, reason: 'Sipariş bilgisi bulunamadı.', scenario: 'NONE' }
  }

  const rawStatus = String(order.status || '').toLowerCase()
  if (rawStatus === 'cancelled' || order.isCancelled === true) {
    return { eligible: false, reason: 'Bu sipariş zaten iptal edilmiştir.', scenario: 'NONE' }
  }

  const shipping = order.shipping || {}
  const rawShippingStatus = String(shipping.status || '').toLowerCase()
  const providerStatus = String(shipping.providerStatus || '').toUpperCase()

  // Senaryo D: Ürün teslim edilmiş -> İptal edilemez, yalnızca iade edilebilir
  if (
    rawStatus === 'delivered' ||
    rawStatus === 'completed' ||
    rawShippingStatus === 'delivered' ||
    providerStatus === 'DELIVERED'
  ) {
    return {
      eligible: false,
      reason: 'Teslim edilmiş siparişler iptal edilemez. İade talebi oluşturabilirsiniz.',
      scenario: 'D',
    }
  }

  // Senaryo C: Kargo ACCEPTED, YOLDA veya DAĞITIMDA -> Normal iptal yapılamaz
  const inMotionStatuses = ['accepted', 'in_transit', 'out_for_delivery', 'shipped']
  const inMotionProviderStatuses = [
    'ACCEPTED',
    'DELIVERY_ACCEPTED',
    'COLLECTED',
    'IN_TRANSIT',
    'TRANSFER',
    'OUT_FOR_DELIVERY',
    'ON_DISTRIBUTION',
    'COURIER_ASSIGNED',
  ]

  if (
    inMotionStatuses.includes(rawShippingStatus) ||
    inMotionProviderStatuses.includes(providerStatus) ||
    rawStatus === 'shipped'
  ) {
    return {
      eligible: false,
      reason: 'Kargonuz HepsiJET tarafından teslim alınmış ve transfer sürecine girmiştir. Sipariş kargodan geri çağrılamaz; teslimat sonrası iade talebi oluşturabilirsiniz.',
      scenario: 'C',
    }
  }

  // İptal kilit kontrolü (çift tıklama / eşzamanlı işlem koruması)
  if (rawShippingStatus === 'cancel_pending') {
    const lockTime = shipping.cancelLockTimestamp || 0
    if (Date.now() - lockTime < 5 * 60 * 1000) {
      return { eligible: false, reason: 'Bu sipariş için iptal işlemi şu anda işlenmektedir. Lütfen bekleyiniz.', scenario: 'NONE' }
    }
  }

  // Senaryo B: HepsiJET gönderisi oluşturulmuş (barkod var) ancak henüz toplanmamış
  const hasBarcode = Boolean(shipping.barcode && !/NUMUNE|SAMPLE|TEST/i.test(shipping.barcode) && !shipping.barcode.startsWith('SIM-'))
  if (hasBarcode || rawShippingStatus === 'created') {
    return {
      eligible: true,
      scenario: 'B',
    }
  }

  // Senaryo A: HepsiJET gönderisi henüz oluşturulmamış (hazırlanıyor veya beklemede)
  return {
    eligible: true,
    scenario: 'A',
  }
}

/**
 * Teslim edilmiş bir siparişin iadeye uygunluğunu ve hibrit onay kararını değerlendirir.
 */
export function evaluateReturnEligibility(
  order: any,
  requestedItemsInput: Array<{ orderItemId?: string; productId: string; quantity: number }>,
  reasonCode: ReturnReasonCode,
  scope: ReturnScope,
  customerNote?: string,
  nowMs: number = Date.now()
): ReturnEvaluationResult {
  if (!order) {
    return {
      eligible: false,
      error: 'Sipariş bulunamadı.',
      scope,
      initialStatus: 'rejected',
      approvalType: 'manual',
      items: [],
      totalRefundAmountTRY: 0,
    }
  }

  const rawStatus = String(order.status || '').toLowerCase()
  const shipping = order.shipping || {}
  const rawShippingStatus = String(shipping.status || '').toLowerCase()
  const providerStatus = String(shipping.providerStatus || '').toUpperCase()

  // 1. Sipariş teslim edilmiş mi?
  const isDelivered =
    rawStatus === 'delivered' ||
    rawStatus === 'completed' ||
    rawShippingStatus === 'delivered' ||
    providerStatus === 'DELIVERED'

  if (!isDelivered) {
    return {
      eligible: false,
      error: 'Yalnızca alıcıya teslim edilmiş siparişler için iade talebi oluşturulabilir.',
      scope,
      initialStatus: 'rejected',
      approvalType: 'manual',
      items: [],
      totalRefundAmountTRY: 0,
    }
  }

  // 2. Yasal 14 günlük iade süresi kontrolü
  const deliveryDateStr = order.completedAt || order.deliveredAt || shipping.deliveredAt || order.updatedAt || order.createdAt
  if (deliveryDateStr) {
    const deliveryTime = new Date(deliveryDateStr).getTime()
    if (!isNaN(deliveryTime) && nowMs - deliveryTime > FOURTEEN_DAYS_MS) {
      return {
        eligible: false,
        error: 'Siparişin teslim edilmesinin üzerinden 14 günden fazla süre geçtiği için yasal iade süresi dolmuştur.',
        scope,
        initialStatus: 'rejected',
        approvalType: 'manual',
        items: [],
        totalRefundAmountTRY: 0,
      }
    }
  }

  // 3. Ödeme durumu kontrolü
  const isPaid = String(order.paymentStatus || '').toUpperCase() === 'PAID'
  if (!isPaid) {
    return {
      eligible: false,
      error: 'Ödemesi tahsil edilmemiş siparişler için iade süreci başlatılamaz.',
      scope,
      initialStatus: 'rejected',
      approvalType: 'manual',
      items: [],
      totalRefundAmountTRY: 0,
    }
  }

  // 4. Sipariş ürünleri ve talep edilen ürün miktarlarının doğrulanması
  const orderItems: any[] = Array.isArray(order.items) ? order.items : []
  if (orderItems.length === 0) {
    return {
      eligible: false,
      error: 'Siparişe ait ürün kaydı bulunamadı.',
      scope,
      initialStatus: 'rejected',
      approvalType: 'manual',
      items: [],
      totalRefundAmountTRY: 0,
    }
  }

  // Mevcut açık veya tamamlanmış iadelerden kalan miktarları hesapla
  const existingReturns: ReturnRequest[] = Array.isArray(order.returnRequests) ? order.returnRequests : []
  const returnedQuantitiesByProductId: Record<string, number> = {}

  for (const ret of existingReturns) {
    // İptal edilmiş veya reddedilmiş iade talepleri kotayı bloklamaz
    if (ret.status === 'cancelled' || ret.status === 'rejected') continue

    for (const item of ret.items || []) {
      const pid = item.productId || item.orderItemId
      returnedQuantitiesByProductId[pid] = (returnedQuantitiesByProductId[pid] || 0) + (item.quantityRequested || 0)
    }
  }

  const validatedItems: ReturnItem[] = []
  let calculatedRefundTotal = 0

  if (scope === 'full') {
    // Tüm sipariş iadesi: Siparişteki tüm ürünler kalan miktarlarıyla eklenir
    for (const ordItem of orderItems) {
      const pId = ordItem.productId || ordItem.id || ordItem.name
      const qtyPurchased = Number(ordItem.quantity) || 1
      const alreadyReturned = returnedQuantitiesByProductId[pId] || 0
      const remainingQty = Math.max(0, qtyPurchased - alreadyReturned)

      if (remainingQty > 0) {
        const unitPrice = Number(ordItem.price) || 0
        const itemTotal = unitPrice * remainingQty
        calculatedRefundTotal += itemTotal

        validatedItems.push({
          orderItemId: ordItem.id || pId,
          productId: pId,
          productName: ordItem.name || 'Ürün',
          productImage: ordItem.image,
          sku: ordItem.sku,
          quantityPurchased: qtyPurchased,
          quantityRequested: remainingQty,
          unitPriceAtPurchase: unitPrice,
          totalPriceAtPurchase: itemTotal,
        })
      }
    }

    if (validatedItems.length === 0) {
      return {
        eligible: false,
        error: 'Siparişteki tüm ürünler için daha önce iade süreci başlatılmıştır.',
        scope,
        initialStatus: 'rejected',
        approvalType: 'manual',
        items: [],
        totalRefundAmountTRY: 0,
      }
    }
  } else {
    // Kısmi iade: Müşterinin seçtiği ürünler ve miktarlar doğrulanır
    if (!Array.isArray(requestedItemsInput) || requestedItemsInput.length === 0) {
      return {
        eligible: false,
        error: 'İade edilecek en az bir ürün seçilmelidir.',
        scope,
        initialStatus: 'rejected',
        approvalType: 'manual',
        items: [],
        totalRefundAmountTRY: 0,
      }
    }

    for (const reqItem of requestedItemsInput) {
      const requestedQty = Number(reqItem.quantity) || 0
      if (requestedQty <= 0) continue

      const foundOrderItem = orderItems.find(
        (oi) => (oi.productId && oi.productId === reqItem.productId) || (oi.id && oi.id === reqItem.orderItemId) || oi.name === reqItem.productId
      )

      if (!foundOrderItem) {
        return {
          eligible: false,
          error: `Seçilen ürün (${reqItem.productId}) bu siparişte bulunmamaktadır.`,
          scope,
          initialStatus: 'rejected',
          approvalType: 'manual',
          items: [],
          totalRefundAmountTRY: 0,
        }
      }

      const pId = foundOrderItem.productId || foundOrderItem.id || foundOrderItem.name
      const qtyPurchased = Number(foundOrderItem.quantity) || 1
      const alreadyReturned = returnedQuantitiesByProductId[pId] || 0
      const maxAvailable = Math.max(0, qtyPurchased - alreadyReturned)

      if (requestedQty > maxAvailable) {
        return {
          eligible: false,
          error: `"${foundOrderItem.name}" için iade edilebilecek azami miktar ${maxAvailable} adettir (Talep edilen: ${requestedQty}).`,
          scope,
          initialStatus: 'rejected',
          approvalType: 'manual',
          items: [],
          totalRefundAmountTRY: 0,
        }
      }

      const unitPrice = Number(foundOrderItem.price) || 0
      const itemTotal = unitPrice * requestedQty
      calculatedRefundTotal += itemTotal

      validatedItems.push({
        orderItemId: foundOrderItem.id || pId,
        productId: pId,
        productName: foundOrderItem.name || 'Ürün',
        productImage: foundOrderItem.image,
        sku: foundOrderItem.sku,
        quantityPurchased: qtyPurchased,
        quantityRequested: requestedQty,
        unitPriceAtPurchase: unitPrice,
        totalPriceAtPurchase: itemTotal,
      })
    }

    if (validatedItems.length === 0) {
      return {
        eligible: false,
        error: 'Geçerli bir iade miktarı girilmedi.',
        scope,
        initialStatus: 'rejected',
        approvalType: 'manual',
        items: [],
        totalRefundAmountTRY: 0,
      }
    }
  }

  // 5. Hibrit Onay Karar Mekanizması
  // KURAL A: Tam sipariş iadesi (scope: 'full') -> HER ZAMAN yönetici manuel incelemesi
  if (scope === 'full') {
    return {
      eligible: true,
      scope: 'full',
      initialStatus: 'pending_admin_review',
      approvalType: 'manual',
      items: validatedItems,
      totalRefundAmountTRY: calculatedRefundTotal,
      requiresAdminReasons: ['Tam sipariş iadesi yönetici onayı gerektirmektedir.'],
    }
  }

  // KURAL B: Kısmi iade (scope: 'partial')
  // 9 koşulun tamamı sağlanıyorsa otomatik ön onay ('auto_preapproved') verilir
  const requiresManualReasons: string[] = []

  // Neden kontrolü: 'not_wanted' (artık istemiyorum / cayma hakkı) dışındaki tartışmalı durumlar
  // (hasarlı, yanlış ürün, eksik ürün, açıklamadan farklı, diğer) fotoğraf/kanıt incelemesi için yöneticiye gitmeli
  if (reasonCode !== 'not_wanted') {
    requiresManualReasons.push(`"${RETURN_REASONS[reasonCode] || reasonCode}" gerekçeli talepler ürün/hasar kontrolü için yönetici incelemesine tabi tutulur.`)
  }

  // Müşteri notunda şüpheli/hasar bildirimleri varsa yöneticiye gönder
  if (customerNote && /(kırık|hasar|bozuk|çatlak|eksik|çalışmıyor|yırtık)/i.test(customerNote)) {
    requiresManualReasons.push('Müşteri açıklamasında ürün hasarı/arızası belirtildiği için yönetici incelemesi gerekmektedir.')
  }

  if (requiresManualReasons.length > 0) {
    return {
      eligible: true,
      scope: 'partial',
      initialStatus: 'pending_admin_review',
      approvalType: 'manual',
      items: validatedItems,
      totalRefundAmountTRY: calculatedRefundTotal,
      requiresAdminReasons: requiresManualReasons,
    }
  }

  // 9 koşulun tamamı sağlandı -> Otomatik Ön Onay
  return {
    eligible: true,
    scope: 'partial',
    initialStatus: 'auto_preapproved',
    approvalType: 'automatic',
    items: validatedItems,
    totalRefundAmountTRY: calculatedRefundTotal,
    autoPreapprovalReasons: [
      'Teslimat tarihi 14 günlük yasal süre içerisindedir.',
      'Sipariş ödemesi doğrulanmıştır.',
      'Seçilen ürün ve adetler satın alma kayıtlarıyla uyumludur.',
      'Standart cayma hakkı kapsamında otomatik ön onay verilmiştir.',
    ],
  }
}

