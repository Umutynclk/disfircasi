import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { processOrderAutoDispatchAndPrint } from '@/lib/hepsijet/autoDispatch'

/**
 * Admin Havale / EFT Ödeme Onaylama Uç Noktası
 * POST /api/admin/orders/confirm-payment
 * 
 * Banka havalesi veya EFT ile gelen siparişin ödemesini yönetici onayladığında:
 * 1. Siparişi veritabanında atomik olarak PAID ve processing yapar.
 * 2. Anlık HepsiJET gönderisini oluşturur.
 * 3. Birleşik fiş + kargo barkodu PDF'sini Print Agent kuyruğuna ekler.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { orderId } = body

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Sipariş ID (orderId) zorunludur.' }, { status: 400 })
    }

    const db = getAdminFirestore()

    // 1. Siparişi bul
    let orderRef = db.collection('orders').doc(orderId)
    const docCheck = await orderRef.get()
    let resolvedOrderId = orderId

    if (!docCheck.exists) {
      const qNum = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get()
      if (!qNum.empty) {
        orderRef = qNum.docs[0].ref
        resolvedOrderId = qNum.docs[0].id
      } else {
        const qOid = await db.collection('orders').where('merchant_oid', '==', orderId).limit(1).get()
        if (!qOid.empty) {
          orderRef = qOid.docs[0].ref
          resolvedOrderId = qOid.docs[0].id
        } else {
          return NextResponse.json({ success: false, error: `Sipariş bulunamadı: ${orderId}` }, { status: 404 })
        }
      }
    }

    // 2. Atomik olarak PAID durumuna al
    const nowIso = new Date().toISOString()
    const updateResult = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(orderRef)
      if (!snap.exists) {
        throw new Error('Sipariş bulunamadı.')
      }

      const orderData = snap.data() || {}

      if (orderData.status === 'cancelled' || orderData.status === 'refunded') {
        throw new Error(`İptal edilmiş veya iade edilmiş sipariş onaylanamaz (${orderData.status}).`)
      }

      const wasAlreadyPaid = orderData.paymentStatus === 'PAID' || orderData.paymentStatus === 'paid'

      if (!wasAlreadyPaid) {
        transaction.update(orderRef, {
          paymentStatus: 'PAID',
          status: 'processing',
          paidAt: nowIso,
          paymentConfirmedBy: auth.email || 'admin',
          paymentConfirmedAt: nowIso,
          updatedAt: nowIso,
        })
      }

      return {
        wasAlreadyPaid,
        orderNumber: orderData.orderNumber || resolvedOrderId,
      }
    })

    // 3. Otomatik Kargo ve Baskı Kuyruğu Akışını Tetikle
    let dispatchResult = null
    try {
      dispatchResult = await processOrderAutoDispatchAndPrint(resolvedOrderId, {
        triggeredBy: 'admin_bank_transfer_confirm',
        bypassPause: true,
      })
    } catch (dispatchErr: any) {
      console.error('Auto dispatch error after payment confirmation:', dispatchErr)
    }

    return NextResponse.json({
      success: true,
      message: updateResult.wasAlreadyPaid
        ? 'Sipariş zaten ödenmiş durumdaydı. Kargo ve baskı süreci kontrol edildi.'
        : 'Havale/EFT ödemesi başarıyla onaylandı (PAID). Kargo ve etiket baskı süreci başlatıldı.',
      orderId: resolvedOrderId,
      orderNumber: updateResult.orderNumber,
      dispatch: dispatchResult,
    })
  } catch (err: any) {
    console.error('Confirm payment error:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Ödeme onaylanamadı.' },
      { status: 500 }
    )
  }
}
