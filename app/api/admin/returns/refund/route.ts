import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { ReturnRequest } from '@/lib/returns/types'
import { requestPayTRRefund } from '@/lib/paytr-refund'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

interface ReturnRefundBody {
  orderId: string
  returnId: string
  amountTRY?: number
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Yönetici yetkisi gereklidir.' },
      { status: 401 }
    )
  }

  try {
    const body = (await req.json()) as ReturnRefundBody
    const { orderId, returnId, amountTRY } = body

    if (!orderId || !returnId) {
      return NextResponse.json(
        { success: false, error: 'orderId ve returnId alanları zorunludur.' },
        { status: 400 }
      )
    }

    const db = getAdminFirestore()
    const orderRef = db.collection('orders').doc(orderId)
    const orderDoc = await orderRef.get()

    if (!orderDoc.exists) {
      return NextResponse.json({ success: false, error: 'Sipariş bulunamadı.' }, { status: 404 })
    }

    const orderData = orderDoc.data() || {}
    const returnRequests: ReturnRequest[] = Array.isArray(orderData.returnRequests) ? orderData.returnRequests : []
    const targetIdx = returnRequests.findIndex((r) => r.id === returnId)

    if (targetIdx === -1) {
      return NextResponse.json({ success: false, error: 'İade talebi bulunamadı.' }, { status: 404 })
    }

    const targetReturn = returnRequests[targetIdx]

    // İdempotency Kontrolü: Bu talep için zaten para iadesi yapılmış mı?
    if (targetReturn.refund?.status === 'refunded') {
      return NextResponse.json({
        success: true,
        alreadyRefunded: true,
        message: 'Bu iade talebinin para iadesi zaten tamamlanmıştır.',
        refundAmountTRY: targetReturn.refund.amountTRY,
      })
    }

    // İade edilecek tutarın hesaplanması
    const orderTotal = Number(orderData.total || 0)
    const previouslyRefunded = Number(orderData.refundedAmountTRY || 0)
    const remainingRefundableMax = Math.max(0, Math.round((orderTotal - previouslyRefunded) * 100) / 100)

    const calculatedReturnAmount = Number(targetReturn.refund?.amountTRY) ||
      targetReturn.items.reduce((s, it) => s + (it.unitPriceAtPurchase * it.quantityRequested), 0)

    const finalRefundAmount = typeof amountTRY === 'number' && amountTRY > 0
      ? Math.min(amountTRY, remainingRefundableMax)
      : Math.min(calculatedReturnAmount, remainingRefundableMax)

    if (finalRefundAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'İade edilebilir tutar sıfır veya sipariş tutarından daha önce tamamen iade edilmiş.' },
        { status: 400 }
      )
    }

    const merchantOid = orderData.merchant_oid || orderData.orderNumber || orderRef.id
    const nowIso = new Date().toISOString()
    const adminEmail = auth.email || 'admin'

    // Kilit koy
    targetReturn.refund = {
      ...targetReturn.refund,
      status: 'processing',
    }

    // PayTR Refund Çağrısı
    let refundRes: any
    try {
      refundRes = await requestPayTRRefund({
        merchantOid,
        returnAmountTRY: finalRefundAmount,
        referenceNo: `RET-${Date.now().toString(36).toUpperCase()}`,
      })
    } catch (payErr: any) {
      refundRes = { status: 'error', errMsg: payErr?.message || 'PayTR iade servisi hatası' }
    }

    if (refundRes.status !== 'success') {
      targetReturn.refund = {
        ...targetReturn.refund,
        status: 'failed',
        error: refundRes.errMsg || 'PayTR iade talebi reddedildi.',
      }

      await orderRef.collection('returnRequests').doc(returnId).set(cleanFirestoreData(targetReturn), { merge: true })
      returnRequests[targetIdx] = targetReturn
      await orderRef.update(cleanFirestoreData({ returnRequests }))

      return NextResponse.json(
        { success: false, error: `PayTR para iadesi başarısız oldu: ${refundRes.errMsg || 'Bilinmeyen hata'}` },
        { status: 422 }
      )
    }

    // Başarılı Para İadesi
    const newTotalRefundedOnOrder = Math.round((previouslyRefunded + finalRefundAmount) * 100) / 100
    const isOrderFullyRefunded = newTotalRefundedOnOrder >= orderTotal

    const updatedReturn: ReturnRequest = {
      ...targetReturn,
      status: 'completed',
      updatedAt: nowIso,
      refund: {
        status: 'refunded',
        amountTRY: finalRefundAmount,
        provider: 'paytr',
        completedAt: nowIso,
        transactionId: merchantOid,
        refundDetails: refundRes.raw,
      },
      history: [
        ...(targetReturn.history || []),
        {
          status: 'completed',
          action: `${finalRefundAmount.toFixed(2)} TL tutarındaki para iadesi PayTR üzerinden kartına aktarıldı (${adminEmail}). İade süreci başarıyla tamamlandı.`,
          actor: 'admin',
          actorEmail: adminEmail,
          timestamp: nowIso,
        },
      ],
    }

    returnRequests[targetIdx] = updatedReturn

    await db.runTransaction(async (transaction) => {
      const subDocRef = orderRef.collection('returnRequests').doc(returnId)
      transaction.set(subDocRef, cleanFirestoreData(updatedReturn), { merge: true })

      transaction.update(orderRef, cleanFirestoreData({
        returnRequests: cleanFirestoreData(returnRequests),
        lastReturnStatus: 'completed',
        refundStatus: isOrderFullyRefunded ? 'refunded' : 'partial_refunded',
        refundedAmountTRY: newTotalRefundedOnOrder,
        refundUpdatedAt: nowIso,
        updatedAt: nowIso,
      }))
    })

    return NextResponse.json({
      success: true,
      message: `${finalRefundAmount.toFixed(2)} TL tutarındaki para iadesi PayTR üzerinden başarıyla gerçekleştirildi.`,
      refundAmountTRY: finalRefundAmount,
      totalRefundedOnOrder: newTotalRefundedOnOrder,
      returnRequest: updatedReturn,
    })
  } catch (err: any) {
    console.error('İade para ödeme hatası:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Para iadesi sırasında bir hata meydana geldi.' },
      { status: 500 }
    )
  }
}

