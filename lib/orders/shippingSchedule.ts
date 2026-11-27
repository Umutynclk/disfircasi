/**
 * lib/orders/shippingSchedule.ts
 *
 * Türkiye yerel saati (Europe/Istanbul, UTC+3) esaslı otomatik KARGODA zamanlama kuralları.
 *
 * Kurallar:
 * - Yalnızca sunucu tarafından doğrulanmış `paidAt` zamanı esas alınır (order.paymentStatus === 'PAID').
 * - 09:00 – 16:59:59 (gündüz): paidAt + 30 dakika → Kargoda.
 * - 17:00 – 23:59:59 (akşam/gece): ertesi gün 09:00:00 (Europe/Istanbul) → Kargoda.
 * - 00:00 – 08:59:59 (sabah erken): aynı gün 09:00:00 (Europe/Istanbul) → Kargoda.
 * - Hafta sonu ayrımı yoktur; her takvim günü aynı kural uygulanır.
 *
 * Not: Hem sunucu (API/cron) hem istemci (profil/admin) tarafından kullanılır;
 * bu nedenle hiçbir sunucu-özel (firebase-admin vb.) bağımlılık içermez.
 */

export const ISTANBUL_TIMEZONE = 'Europe/Istanbul'

export const WAITING_FOR_TRACKING_MESSAGE =
  'Siparişiniz kargoda aşamasına alındı. HepsiJET takip bilgileriniz oluşturulduğunda burada görüntüleyebileceksiniz. En kısa sürede kargo bilgilerinizi paylaşacağız.'

export type ShippingScheduleRule =
  | 'daytime_plus_30m'
  | 'overnight_next_0900'
  | 'morning_same_day_0900'

export interface ScheduledShippingCalculation {
  paidAt: string
  statusDueAt: string
  rule: ShippingScheduleRule
  istanbulPaidDisplay: string
  istanbulDueDisplay: string
}

interface IstanbulParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function getIstanbulParts(date: Date): IstanbulParts {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: ISTANBUL_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const pick = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0)
  const rawHour = pick('hour')
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour: rawHour === 24 ? 0 : rawHour,
    minute: pick('minute'),
    second: pick('second'),
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function formatIstanbulDisplay(p: IstanbulParts): string {
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)} +03:00`
}

/**
 * Verilen Europe/Istanbul yerel tarih-saat bileşenlerini (UTC+3) ISO UTC string'ine dönüştürür.
 * Türkiye'de 2016'dan bu yana kalıcı UTC+3 (+03:00) uygulanmaktadır.
 */
function istanbulLocalToUtcDate(year: number, month: number, day: number, hour: number, minute: number, second = 0): Date {
  // Date.UTC ile tarih taşmalarını (ay/yıl sonu) otomatik normalize edip 3 saat geri alıyoruz.
  const utcMs = Date.UTC(year, month - 1, day, hour - 3, minute, second, 0)
  return new Date(utcMs)
}

/**
 * PAID olmuş bir siparişin `paidAt` zamanından planlanan KARGODA geçiş zamanını (`statusDueAt`) hesaplar.
 */
export function calculateScheduledShippedAt(paidAtInput: string | Date): ScheduledShippingCalculation {
  const paidDate = paidAtInput instanceof Date ? paidAtInput : new Date(paidAtInput)
  if (!Number.isFinite(paidDate.getTime())) {
    throw new Error('Geçersiz paidAt tarihi.')
  }

  const p = getIstanbulParts(paidDate)
  let dueDate: Date
  let rule: ShippingScheduleRule

  if (p.hour >= 9 && p.hour < 17) {
    // A. Gündüz kuralı (09:00:00 – 16:59:59): +30 dakika
    dueDate = new Date(paidDate.getTime() + 30 * 60 * 1000)
    rule = 'daytime_plus_30m'
  } else if (p.hour >= 17) {
    // B1. Akşam/Gece kuralı (17:00:00 – 23:59:59): ertesi gün 09:00:00 (Europe/Istanbul)
    dueDate = istanbulLocalToUtcDate(p.year, p.month, p.day + 1, 9, 0, 0)
    rule = 'overnight_next_0900'
  } else {
    // B2. Sabah erken kuralı (00:00:00 – 08:59:59): aynı gün 09:00:00 (Europe/Istanbul)
    dueDate = istanbulLocalToUtcDate(p.year, p.month, p.day, 9, 0, 0)
    rule = 'morning_same_day_0900'
  }

  return {
    paidAt: paidDate.toISOString(),
    statusDueAt: dueDate.toISOString(),
    rule,
    istanbulPaidDisplay: formatIstanbulDisplay(p),
    istanbulDueDisplay: formatIstanbulDisplay(getIstanbulParts(dueDate)),
  }
}

/**
 * Bir siparişin zamanlanmış Kargoda geçişine uygun ve vaktinin gelmiş olup olmadığını kontrol eder.
 */
export function isScheduledShippedDue(
  order: Record<string, any> | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!order) return false

  // Yalnızca PAID siparişler
  if (order.paymentStatus !== 'PAID') return false

  // Daha önce uygulanmışsa tekrar çalışmaz (idempotency)
  if (order.scheduledShippedApplied === true) return false

  const rawStatus = String(order.status || '').toLowerCase()
  const rawShipStatus = String(order.shipping?.status || '').toLowerCase()

  // İptal, iade, teslim edilmiş veya zaten shipped siparişlere dokunulmaz
  if (
    ['cancelled', 'refunded', 'returned', 'delivered', 'completed', 'shipped', 'failed'].includes(rawStatus) ||
    ['cancelled', 'delivered', 'returned'].includes(rawShipStatus)
  ) {
    return false
  }

  const dueIso = order.statusDueAt || order.shipping?.statusScheduledAt
  if (!dueIso) return false

  const dueMs = Date.parse(String(dueIso))
  if (!Number.isFinite(dueMs)) return false

  return dueMs <= nowMs
}

/**
 * Gerçek (sahte/numune/simülasyon olmayan) HepsiJET takip barkodunun mevcut olup olmadığını döndürür.
 */
export function hasRealHepsiJetTracking(order: Record<string, any> | null | undefined): boolean {
  const shipping = order?.shipping
  if (!shipping) return false
  if (String(shipping.status || '').toLowerCase() === 'cancelled') return false
  const barcode = String(shipping.barcode || shipping.trackingNumber || '').trim()
  if (!barcode) return false
  if (/NUMUNE|SAMPLE|TEST/i.test(barcode) || barcode.startsWith('SIM-')) return false
  return true
}
