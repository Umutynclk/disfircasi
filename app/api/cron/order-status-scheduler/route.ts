import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { isScheduledShippedDue } from '@/lib/orders/shippingSchedule'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

export const dynamic = 'force-dynamic'

function verifyCronSecret(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET
  if (!expectedSecret) {
    // Güvenlik: Üretimde CRON_SECRET tanımlı değilse dış istekleri reddet
    return false
  }
  const authHeader = request.headers.get('authorization')
  const cronHeader = request.headers.get('x-cron-secret')
  const token = cronHeader || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null)
  return Boolean(token && token === expectedSecret)
}

/**
 * GET / POST /api/cron/order-status-scheduler
 *
 * Cloud Scheduler tarafından dakikada bir tetiklenir.
 * - `paymentStatus === 'PAID'` ve `statusDueAt <= now` olan siparişleri bulur
 *   (sunucu kapalıyken zamanı geçmiş siparişleri de otomatik telafi eder).
 * - Her siparişi Firestore Transaction içinde atomik olarak KARGODA (`status: 'shipped'`)
 *   durumuna geçirir ve normal iptal kilidini (`cancelLockedBySchedule: true`) etkinleştirir.
 * - Gerçek HepsiJET `carrierStatus` / `carrierAcceptedAt` / `deliveredAt` alanlarına DOKUNMAZ.
 * - Print Queue ve otomatik baskı akışına DOKUNMAZ.
 * - Aynı sipariş için ikinci kez geçiş veya mükerrer bildirim üretmez (idempotent).
 */
async function handleScheduledOrderTransitions(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json(
      { success: false, error: 'Yetkisiz erişim (geçersiz veya eksik cron secret).' },
      { status: 401 }
    )
  }

  try {
    const db = getAdminFirestore()
    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()

    // Mevcut tek alanlı indeksle uyumlu sorgu: yalnızca processing aşamasındaki siparişleri tara
    const snap = await db.collection('orders').where('status', '==', 'processing').get()

    const transitionedOrderIds: string[] = []
    const skippedOrderIds: string[] = []
    const errors: Array<{ orderId: string; error: string }> = []

    for (const docSnap of snap.docs) {
      const candidate = { id: docSnap.id, ...(docSnap.data() || {}) }
      if (!isScheduledShippedDue(candidate, nowMs)) {
        skippedOrderIds.push(docSnap.id)
        continue
      }

      try {
        const result = await db.runTransaction(async (transaction) => {
          const freshSnap = await transaction.get(docSnap.ref)
          if (!freshSnap.exists) return { transitioned: false }

          const freshData = { id: freshSnap.id, ...(freshSnap.data() || {}) } as Record<string, any>
          if (!isScheduledShippedDue(freshData, nowMs)) {
            return { transitioned: false }
          }

          const scheduledAt = freshData.statusDueAt || freshData.shipping?.statusScheduledAt || nowIso

          // ATOMİK GEÇİŞ: Uygulama durumu 'shipped' (Kargoda) + normal iptal kilidi
          // KRİTİK: shipping.carrierStatus ve shipping.carrierAcceptedAt alanlarına DOKUNULMAZ!
          transaction.update(
            docSnap.ref,
            cleanFirestoreData({
              status: 'shipped',
              scheduledShippedApplied: true,
              scheduledShippedAppliedAt: nowIso,
              cancelLockedBySchedule: true,
              'shipping.statusScheduledAt': scheduledAt,
              'shipping.statusChangedAt': nowIso,
              updatedAt: nowIso,
            })
          )

          // Tek seferlik idempotent müşteri bildirimi (deterministik doküman ID)
          const notifRef = db.collection('notifications').doc(`notif_shipped_${freshSnap.id}`)
          const existingNotif = await transaction.get(notifRef)
          if (!existingNotif.exists) {
            const orderNumber = freshData.orderNumber || freshSnap.id
            transaction.set(
              notifRef,
              cleanFirestoreData({
                id: notifRef.id,
                orderId: freshSnap.id,
                orderNumber,
                userId: freshData.userId || null,
                email: freshData.userEmail || freshData.customer?.email || '',
                type: 'order_shipped_scheduled',
                title: `Siparişiniz Kargoda (#${orderNumber})`,
                message:
                  'Siparişiniz kargoda aşamasına alındı. HepsiJET takip bilgileriniz oluşturulduğunda profilinizden görüntüleyebilirsiniz.',
                read: false,
                createdAt: nowIso,
              })
            )
          }

          return { transitioned: true }
        })

        if (result.transitioned) {
          transitionedOrderIds.push(docSnap.id)
        } else {
          skippedOrderIds.push(docSnap.id)
        }
      } catch (err: any) {
        console.error(`Scheduler transition error for order ${docSnap.id}:`, err?.message)
        errors.push({ orderId: docSnap.id, error: err?.message || 'Bilinmeyen hata' })
      }
    }

    return NextResponse.json({
      success: true,
      checkedAt: nowIso,
      checkedCount: snap.size,
      transitionedCount: transitionedOrderIds.length,
      transitionedOrderIds,
      skippedCount: skippedOrderIds.length,
      errors,
    })
  } catch (err: any) {
    console.error('Order status scheduler fatal error:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Zamanlayıcı çalıştırılırken hata oluştu.' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleScheduledOrderTransitions(request)
}

export async function POST(request: NextRequest) {
  return handleScheduledOrderTransitions(request)
}
