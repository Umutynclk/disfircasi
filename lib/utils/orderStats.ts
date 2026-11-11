/**
 * lib/utils/orderStats.ts
 *
 * Admin Kontrol Paneli (Dashboard) ve Admin Siparişler ekranı için
 * ORTAK sipariş istatistik hesaplama yardımcısı.
 *
 * Her iki ekranda da:
 * - Aynı Firestore sipariş listesini esas alır.
 * - getCommonOrderDisplayStatus ile tutarlı durum eşleştirmesi yapar.
 * - isInArchive ile arşivlenmiş ve isTrash ile çöpe atılmış siparişleri aktif sayımlardan ayırır.
 * - Gelir hesaplamasında yalnızca PAID (ödenmiş) siparişleri sayar (iptal ve iadeler hariç).
 * - Gün dönümü ve zaman filtrelerinde Europe/Istanbul (Türkiye saati, UTC+3) saat dilimini kullanır.
 * - RETURNED (kargo iadesi) ile CANCELLED (sipariş iptali) durumlarını kesin olarak ayırır.
 */

import { isInArchive } from './orderLifecycle'
import { getCommonOrderDisplayStatus } from '../hepsijet/status-display'

export interface OrderStats {
  /** Toplam tüm siparişler (aktif + arşiv + çöp) */
  totalAll: number
  /** Aktif siparişler toplamı (arşiv ve çöp hariç) */
  total: number
  /** total ile eşdeğer aktif sipariş sayısı */
  active: number
  /** Arşivdeki sipariş sayısı (isInArchive kuralı) */
  archived: number
  /** Çöp kutusundaki sipariş sayısı (isTrash === true) */
  trash: number

  // Aktif siparişlerin durum dağılımı
  /** Bekleyen / Sipariş Alındı */
  pending: number
  /** Hazırlanıyor (ödenmiş / processing) */
  processing: number
  /** Kargoda olan toplam sipariş (etiket oluşturuldu, kargoya verildi, yolda, dağıtımda) */
  shipped: number
  /** HepsiJET kargoya kabul etti (ACCEPTED) */
  accepted: number
  /** Kargo yolda / transfer sürecinde (IN_TRANSIT) */
  inTransit: number
  /** Kurye dağıtımda (OUT_FOR_DELIVERY) */
  outForDelivery: number
  /** Kargo etiketi/barkodu oluşturuldu (LABEL_CREATED) */
  labelCreated: number
  /** Teslim edildi (24 saatlik otomatik arşiv öncesi aktif listede) */
  delivered: number
  /** İptal edildi (24 saatlik otomatik arşiv öncesi aktif listede; İADE DEĞİL) */
  cancelled: number
  /** Kargo İade Edildi (RETURNED / RETURN_STARTED; İPTAL DEĞİL) */
  returned: number

  // Gelir İstatistikleri (YALNIZCA PAID siparişler)
  /** Aktif ödenmiş siparişlerin toplam geliri */
  revenue: number
  /** Tüm ödenmiş siparişlerin toplam geliri (arşiv dahil, çöp ve iptal hariç) */
  totalPaidRevenue: number
  /** Bugün (Europe/Istanbul) verilen ödenmiş siparişlerin toplam geliri */
  todayRevenue: number

  // Zaman Bazlı Sipariş Sayıları (Europe/Istanbul)
  /** Bugün verilen sipariş sayısı (çöp hariç) */
  todayOrders: number
  /** Bu hafta verilen sipariş sayısı (Pazartesi-Pazar, çöp hariç) */
  weekOrders: number
  /** Bu ay verilen sipariş sayısı (çöp hariç) */
  monthOrders: number
}

/**
 * Bir siparişin ödemesinin tamamlanıp tamamlanmadığını kontrol eder.
 */
export function isOrderPaid(order: any): boolean {
  if (!order) return false
  const ps = String(order.paymentStatus || '').toUpperCase()
  return ps === 'PAID'
}

/**
 * Verilen tarihin Europe/Istanbul saat dilimindeki YYYY-MM-DD değerini döndürür.
 */
export function getIstanbulDateString(dateInput: Date | number | string): string {
  if (!dateInput) return ''
  const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * Verilen tarihin Europe/Istanbul saat dilimindeki YYYY-MM değerini döndürür.
 */
export function getIstanbulMonthString(dateInput: Date | number | string): string {
  if (!dateInput) return ''
  const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput)
  if (isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
  }).format(d)
}

/**
 * Siparişin bugün (Europe/Istanbul gün dönümüne göre) verilip verilmediğini doğrular.
 */
export function isTodayInIstanbul(dateInput: Date | number | string, nowMs: number = Date.now()): boolean {
  const orderDay = getIstanbulDateString(dateInput)
  const currentDay = getIstanbulDateString(nowMs)
  return Boolean(orderDay && currentDay && orderDay === currentDay)
}

/**
 * Siparişin bu ay (Europe/Istanbul takvimine göre) verilip verilmediğini doğrular.
 */
export function isThisMonthInIstanbul(dateInput: Date | number | string, nowMs: number = Date.now()): boolean {
  const orderMonth = getIstanbulMonthString(dateInput)
  const currentMonth = getIstanbulMonthString(nowMs)
  return Boolean(orderMonth && currentMonth && orderMonth === currentMonth)
}

/**
 * Europe/Istanbul saat dilimine göre mevcut haftanın (Pazartesi 00:00 - Pazar 23:59:59)
 * zaman aralığını (timestamp ms) hesaplar.
 */
export function getIstanbulWeekRange(nowMs: number = Date.now()): { startMs: number; endMs: number } {
  const istDateStr = getIstanbulDateString(nowMs)
  const dayOfWeekStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Istanbul',
    weekday: 'short',
  }).format(new Date(nowMs))

  const dayMap: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  const currentDay = dayMap[dayOfWeekStr] || 1
  const daysFromMonday = currentDay - 1

  const istMidnight = new Date(`${istDateStr}T00:00:00+03:00`).getTime()
  const startMs = istMidnight - daysFromMonday * 24 * 60 * 60 * 1000
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000 - 1

  return { startMs, endMs }
}

/**
 * Siparişin bu hafta (Pazartesi-Pazar, Europe/Istanbul) verilip verilmediğini doğrular.
 */
export function isThisWeekInIstanbul(dateInput: Date | number | string, nowMs: number = Date.now()): boolean {
  if (!dateInput) return false
  const d = new Date(dateInput).getTime()
  if (isNaN(d)) return false

  const { startMs, endMs } = getIstanbulWeekRange(nowMs)
  return d >= startMs && d <= endMs
}

/**
 * Sipariş listesini analiz eder ve standart istatistik nesnesini döndürür.
 *
 * @param orders Firestore orders koleksiyonundan çekilen sipariş belgeleri
 * @param nowMs Karşılaştırma anı (varsayılan Date.now())
 */
export function calculateOrderStats(orders: any[], nowMs: number = Date.now()): OrderStats {
  const stats: OrderStats = {
    totalAll: orders.length,
    total: 0,
    active: 0,
    archived: 0,
    trash: 0,

    pending: 0,
    processing: 0,
    shipped: 0,
    accepted: 0,
    inTransit: 0,
    outForDelivery: 0,
    labelCreated: 0,
    delivered: 0,
    cancelled: 0,
    returned: 0,

    revenue: 0,
    totalPaidRevenue: 0,
    todayRevenue: 0,

    todayOrders: 0,
    weekOrders: 0,
    monthOrders: 0,
  }

  for (const order of orders) {
    if (!order) continue

    const isTrash = Boolean(order.isTrash)
    const isArchived = isInArchive(order, nowMs)
    const paid = isOrderPaid(order)
    const amount = Number(order.total) || 0

    const badge = getCommonOrderDisplayStatus(order)
    const isCancelled = badge.key === 'cancelled' || order.status === 'cancelled' || order.isCancelled === true
    const isRefunded = order.refundStatus === 'refunded' || badge.key === 'returned'

    // Çöp kutusu
    if (isTrash) {
      stats.trash++
      continue
    }

    // Zaman bazlı sayımlar (çöp hariç tüm siparişler)
    if (order.createdAt) {
      if (isTodayInIstanbul(order.createdAt, nowMs)) {
        stats.todayOrders++
      }
      if (isThisWeekInIstanbul(order.createdAt, nowMs)) {
        stats.weekOrders++
      }
      if (isThisMonthInIstanbul(order.createdAt, nowMs)) {
        stats.monthOrders++
      }
    }

    // Toplam ödenmiş ciro (arşiv dahil, iptal ve iade hariç)
    if (paid && !isCancelled && !isRefunded) {
      stats.totalPaidRevenue += amount
      if (isTodayInIstanbul(order.createdAt, nowMs)) {
        stats.todayRevenue += amount
      }
    }

    // Arşivdeki sipariş
    if (isArchived) {
      stats.archived++
      continue
    }

    // AKTİF SİPARİŞLER (arşiv ve çöp hariç)
    stats.total++
    stats.active++

    // Aktif ciro
    if (paid && !isCancelled && !isRefunded) {
      stats.revenue += amount
    }

    // Durum Dağılımı (Mutually exclusive - getCommonOrderDisplayStatus referansı)
    // 1. İade Edildi (RETURNED / RETURN_STARTED; İPTAL DEĞİL)
    if (badge.key === 'returned') {
      stats.returned++
    }
    // 2. İptal Edildi (CANCELLED; İADE DEĞİL)
    else if (badge.key === 'cancelled') {
      stats.cancelled++
    }
    // 3. Teslim Edildi
    else if (badge.key === 'delivered') {
      stats.delivered++
    }
    // 4. Dağıtımda
    else if (badge.key === 'out_for_delivery') {
      stats.outForDelivery++
      stats.shipped++
    }
    // 5. Yolda
    else if (badge.key === 'in_transit') {
      stats.inTransit++
      stats.shipped++
    }
    // 6. Kargoya Verildi
    else if (badge.key === 'accepted') {
      stats.accepted++
      stats.shipped++
    }
    // 7. Kargo Etiketi Oluşturuldu
    else if (badge.key === 'label_created') {
      stats.labelCreated++
      stats.shipped++
    }
    // 8. Hazırlanıyor
    else if (badge.key === 'processing') {
      stats.processing++
    }
    // 9. Bekliyor / Sipariş Alındı
    else if (badge.key === 'pending') {
      stats.pending++
    }
    // Fallback durum kontrolü (eğer badge bilinmiyorsa)
    else {
      const rawStatus = String(order.status || '').toLowerCase()
      if (rawStatus === 'shipped') {
        stats.shipped++
      } else if (rawStatus === 'delivered' || rawStatus === 'completed') {
        stats.delivered++
      } else if (rawStatus === 'cancelled') {
        stats.cancelled++
      } else if (rawStatus === 'processing' || rawStatus === 'paid') {
        stats.processing++
      } else {
        stats.pending++
      }
    }
  }

  return stats
}

