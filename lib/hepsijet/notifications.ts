import { getAdminFirestore } from '@/lib/firebase/admin'
import { OrderShippingData } from './types'
import { buildHepsiJetTrackingUrl } from './tracking'

export interface TrackingNotificationResult {
  success: boolean
  alreadySent?: boolean
  trackingUrl?: string
  trackingNumber?: string
  message?: string
  error?: string
}

/**
 * HepsiJET kargo takip bildirimi oluşturur ve kaydeder.
 * İdempotency korumalıdır: Aynı sipariş için ikinci kez bildirim tetiklemez.
 */
export async function sendShippingTrackingNotification(
  orderId: string,
  orderData: Record<string, any>
): Promise<TrackingNotificationResult> {
  try {
    const shipping: OrderShippingData | undefined = orderData.shipping
    const trackingNumber =
      shipping?.trackingNumber ||
      shipping?.barcode ||
      orderData.shippingTrackingNumber ||
      ''

    if (!trackingNumber) {
      return {
        success: false,
        error: 'Kargo takip numarası veya barkod bulunamadı.',
      }
    }

    // 1. İdempotency Kontrolü: Daha önce bildirim gönderilmiş mi?
    if (shipping?.notificationSent) {
      return {
        success: true,
        alreadySent: true,
        trackingNumber,
        trackingUrl: shipping.trackingUrl || buildHepsiJetTrackingUrl(trackingNumber),
        message: 'Bildirim daha önce gönderilmiş, mükerrer gönderim engellendi.',
      }
    }

    const trackingUrl = buildHepsiJetTrackingUrl(trackingNumber)
    const orderNumber = orderData.orderNumber || orderId
    const customerName =
      orderData.shippingAddress?.fullName ||
      orderData.customer?.name ||
      orderData.customerName ||
      'Değerli Müşterimiz'
    const customerEmail =
      orderData.shippingAddress?.email ||
      orderData.customer?.email ||
      orderData.userEmail ||
      ''
    const customerPhone =
      orderData.shippingAddress?.phone ||
      orderData.customer?.phone ||
      ''

    const notificationMessage = `Sayın ${customerName},\n\n${orderNumber} numaralı siparişiniz HepsiJET kargoya teslim edilmiştir.\n\nKargo Firması: HepsiJET\nTakip Numarası: ${trackingNumber}\nKargo Takip Bağlantısı: ${trackingUrl}\n\nBizi tercih ettiğiniz için teşekkür ederiz.`

    const db = getAdminFirestore()
    const nowIso = new Date().toISOString()

    // 2. Sipariş dokümanını güncelle (Takip URL ve uygulama içi bildirim kaydı)
    const orderRef = db.collection('orders').doc(orderId)
    await orderRef.set(
      {
        shipping: {
          ...shipping,
          trackingUrl,
          notificationSent: true,
          notifiedAt: nowIso,
          notificationChannel: 'in_app',
        },
        updatedAt: nowIso,
      },
      { merge: true }
    )

    // 3. Bildirim log kaydı oluştur (uygulama içi takip denetim günlüğü)
    try {
      await db.collection('notifications').add({
        orderId,
        orderNumber,
        type: 'shipping_tracking_in_app',
        carrier: 'hepsijet',
        trackingNumber,
        trackingUrl,
        customerName,
        customerEmail,
        customerPhone,
        channel: 'in_app',
        message: `${orderNumber} siparişi için HepsiJET takip bağlantısı oluşturuldu (${trackingNumber}).`,
        status: 'ready',
        createdAt: nowIso,
      })
    } catch (logErr) {
      console.warn(`[TrackingNotification] Log kaydı yazılırken uyarı (kritik değil):`, logErr)
    }

    return {
      success: true,
      alreadySent: false,
      trackingNumber,
      trackingUrl,
      message: 'Kargo takip bağlantısı uygulama içi görünüm için başarıyla hazırlandı.',
    }
  } catch (error: any) {
    console.error(`[TrackingNotification] Hata (orderId: ${orderId}):`, error)
    return {
      success: false,
      error: error.message || 'Kargo takip bildirimi işlenirken beklenmedik hata oluştu.',
    }
  }
}

