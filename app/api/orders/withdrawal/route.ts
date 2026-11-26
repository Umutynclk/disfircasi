import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin'
import { evaluateWithdrawalEligibility } from '@/lib/orders/cancellationPolicy'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

interface WithdrawalRequestBody {
  orderId: string
  reason?: string
  note?: string
}

/**
 * POST /api/orders/withdrawal
 *
 * Kargo firmasına teslim edilmiş veya transfer/dağıtım sürecindeki siparişler için
 * Mesafeli Sözleşmeler Yönetmeliği kapsamındaki yasal cayma talebi uç noktası.
 *
 * KURALLAR:
 * - Normal sipariş iptalinden ayrı tutulur (`withdrawalRequest` + `withdrawal_requests`).
 * - Yeni HepsiJET gönderisi OLUŞTURMAZ.
 * - Otomatik PayTR/iyzico para iadesi BAŞLATMAZ.
 * - Mevcut `shipping.status`, `order.status` ve `paymentStatus` değerlerini bozmaz.
 * - Admin panelinde incelenmek üzere kayıt altına alınır.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Cayma talebi iletmek için giriş yapmanız gerekmektedir.' },
      { status: 401 }
    )
  }

  const token = authHeader.replace('Bearer ', '').trim()
  let callerUid = ''
  let callerEmail = ''

  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    callerUid = decoded.uid
    callerEmail = (decoded.email || '').toLowerCase().trim()
  } catch {
    return NextResponse.json(
      { success: false, error: 'Oturumunuz geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapınız.' },
      { status: 401 }
    )
  }

  try {
    const body = (await req.json()) as WithdrawalRequestBody
    const { orderId, reason, note } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Sipariş numarası (orderId) zorunludur.' },
        { status: 400 }
      )
    }

    const db = getAdminFirestore()
    let orderRef = db.collection('orders').doc(orderId)
    let orderDoc = await orderRef.get()

    if (!orderDoc.exists) {
      const qNum = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get()
      if (!qNum.empty) {
        orderRef = qNum.docs[0].ref
        orderDoc = qNum.docs[0]
      } else {
        const qOid = await db.collection('orders').where('merchant_oid', '==', orderId).limit(1).get()
        if (!qOid.empty) {
          orderRef = qOid.docs[0].ref
          orderDoc = qOid.docs[0]
        } else {
          return NextResponse.json({ success: false, error: 'Sipariş bulunamadı.' }, { status: 404 })
        }
      }
    }

    const orderData = orderDoc.data() || {}
    const orderUserId = orderData.userId || ''
    const orderUserEmail = (orderData.userEmail || orderData.customer?.email || '').toLowerCase().trim()
    const isOwner =
      (callerUid && orderUserId === callerUid) ||
      (callerEmail && orderUserEmail === callerEmail)

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Bu sipariş için cayma talebi iletme yetkiniz bulunmamaktadır.' },
        { status: 403 }
      )
    }

    const eligibility = evaluateWithdrawalEligibility(orderData)
    if (!eligibility.eligible) {
      return NextResponse.json(
        { success: false, error: eligibility.reason || 'Bu sipariş için cayma talebi oluşturulamaz.' },
        { status: 400 }
      )
    }

    const nowIso = new Date().toISOString()
    const cleanOrderRef = String(orderData.orderNumber || orderRef.id).replace(/[^A-Za-z0-9]/g, '')
    const withdrawalId = `CAY-${cleanOrderRef}-${Date.now().toString(36).toUpperCase()}`

    const withdrawalRecord = cleanFirestoreData({
      id: withdrawalId,
      orderId: orderRef.id,
      orderNumber: orderData.orderNumber || orderRef.id,
      userId: callerUid,
      userEmail: callerEmail,
      status: 'pending_review',
      reason: (reason || '').trim() || 'Mesafeli Sözleşmeler Yönetmeliği kapsamında cayma hakkı bildirimi',
      customerNote: (note || '').trim() || '',
      carrierStatusAtRequest: orderData.shipping?.status || 'in_transit',
      carrierBarcode: orderData.shipping?.barcode || '',
      requestedAt: nowIso,
      updatedAt: nowIso,
      requiresAdminReview: true,
    })

    const batch = db.batch()
    // Ayrı koleksiyonda denetlenebilir cayma talebi kaydı
    batch.set(db.collection('withdrawal_requests').doc(withdrawalId), withdrawalRecord)
    // Sipariş üzerinde mevcut status / shipping.status / paymentStatus BOZULMADAN ayrı alan olarak kaydet
    batch.update(
      orderRef,
      cleanFirestoreData({
        withdrawalRequest: withdrawalRecord,
        hasWithdrawalRequest: true,
        updatedAt: nowIso,
      })
    )
    await batch.commit()

    return NextResponse.json({
      success: true,
      withdrawalId,
      withdrawalRequest: withdrawalRecord,
      message:
        'Cayma talebiniz kaydedildi. Paket kargo sürecinde olduğundan otomatik iptal yapılmamıştır; teslimat sırasında paketi teslim almayabilir veya teslim sonrası iade sürecini başlatabilirsiniz. Talebiniz ekibimizce incelenmektedir.',
    })
  } catch (err: any) {
    console.error('POST /api/orders/withdrawal error:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Cayma talebi kaydedilirken bir hata oluştu.' },
      { status: 500 }
    )
  }
}
