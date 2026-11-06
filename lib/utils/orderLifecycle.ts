/**
 * Sipariş yaşam döngüsü kuralları (arşiv + 24 saat operasyon uyarısı).
 *
 * Saf fonksiyonlardır; veri silmez/değiştirmez.
 * - Ödeme/onay durumu ile kargo işlem durumu AYRI değerlendirilir.
 * - Otomatik barkod/fiş baskısı bu uyarıyı beklemez (kargo durumu barkod ile belirlenir).
 */

export const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000
export const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

export interface LifecycleOrderLike {
  status?: string
  paymentStatus?: string
  createdAt?: string
  isTrash?: boolean
  isArchived?: boolean
  shipping?: {
    status?: string
    barcode?: string
    trackingNumber?: string
    autoDispatchStatus?: string
  }
}

const TERMINAL_STATUSES = ['delivered', 'cancelled', 'refunded', 'returned', 'failed']

function ageMs(order: LifecycleOrderLike, now: number): number | null {
  const t = new Date(order.createdAt || '').getTime()
  return isNaN(t) ? null : now - t
}

export function isTerminalOrder(order: LifecycleOrderLike): boolean {
  return TERMINAL_STATUSES.includes(String(order.status || ''))
}

/** Ödeme/onay durumu: ödeme bekleyen sipariş operasyonel uyarıya dahil edilmez. */
export function isPaymentPending(order: LifecycleOrderLike): boolean {
  if (isTerminalOrder(order)) return false
  return order.paymentStatus !== 'PAID'
}

/** Kargo hata/belirsizlik durumu (çözülmemiş kargo sorunu). */
export function hasShippingProblem(order: LifecycleOrderLike): boolean {
  const s = order.shipping
  if (!s) return false
  if (s.barcode || s.trackingNumber) return false
  return (
    s.status === 'failed' ||
    (s.status as string) === 'unknown' ||
    s.status === 'creating' ||
    (s.autoDispatchStatus as string) === 'requires_review' ||
    s.autoDispatchStatus === 'failed'
  )
}

/** Ödenmiş ve aktif olduğu halde henüz kargo barkodu oluşmamış sipariş. */
export function isAwaitingShipmentOperation(order: LifecycleOrderLike): boolean {
  if (order.isTrash || isTerminalOrder(order)) return false
  if (order.paymentStatus !== 'PAID') return false
  return !(order.shipping?.barcode || order.shipping?.trackingNumber)
}

/**
 * 24 saati aşmış, GERÇEKTEN operasyonel işlem bekleyen siparişler:
 * ödemesi onaylı (PAID) + kargo barkodu yok (bekliyor / hata / belirsiz).
 * Ödeme bekleyen siparişler dahil DEĞİLDİR.
 */
export function isUnprocessed24h(order: LifecycleOrderLike, now: number = Date.now()): boolean {
  if (!isAwaitingShipmentOperation(order)) return false
  const age = ageMs(order, now)
  return age !== null && age >= TWENTY_FOUR_HOURS_MS
}

export type ArchiveBlockReason =
  | 'payment_pending'
  | 'awaiting_shipment'
  | 'shipping_problem'

/**
 * 15 gün geçmiş olsa bile arşive TAŞINMAMASI gereken çözülmemiş durumlar.
 * Boş dizi = güvenle arşivlenebilir.
 */
export function getArchiveBlockers(order: LifecycleOrderLike): ArchiveBlockReason[] {
  if (isTerminalOrder(order)) return []
  const reasons: ArchiveBlockReason[] = []
  if (isPaymentPending(order)) reasons.push('payment_pending')
  if (isAwaitingShipmentOperation(order)) reasons.push('awaiting_shipment')
  if (hasShippingProblem(order)) reasons.push('shipping_problem')
  return reasons
}

export const ARCHIVE_BLOCK_LABELS: Record<ArchiveBlockReason, string> = {
  payment_pending: 'Ödeme bekleniyor',
  awaiting_shipment: 'Kargo işlemi bekliyor',
  shipping_problem: 'Kargo hatası/belirsiz',
}

/** Sipariş tarihinden 15 gün geçti mi? */
export function isOlderThan15Days(order: LifecycleOrderLike, now: number = Date.now()): boolean {
  const age = ageMs(order, now)
  return age !== null && age >= FIFTEEN_DAYS_MS
}

/**
 * Sipariş arşivde mi gösterilmeli?
 * - Elle arşivlenmişse (isArchived) her zaman evet.
 * - 15 gün geçmişse ve çözülmemiş operasyonel engel yoksa evet.
 */
export function isInArchive(order: LifecycleOrderLike, now: number = Date.now()): boolean {
  if (order.isTrash) return false
  if (order.isArchived === true) return true
  return isOlderThan15Days(order, now) && getArchiveBlockers(order).length === 0
}

/** 15 günü aşmış ama çözülmemiş olduğu için aktif listede tutulan sipariş. */
export function isOverdueButBlocked(order: LifecycleOrderLike, now: number = Date.now()): boolean {
  if (order.isTrash || order.isArchived === true) return false
  return isOlderThan15Days(order, now) && getArchiveBlockers(order).length > 0
}
