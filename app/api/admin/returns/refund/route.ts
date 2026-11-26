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
    // Atomik İdempotency Kilidi (Firestore Transaction — eşzamanlı çift iade engeli)
    const nowIso = new Date().toISOString()
    const adminEmail = auth.email || 'admin'
    let orderData: Record<string, any> = {}
    let returnRequests: ReturnRequest[] = []
    let targetIdx = -1
    let targetReturn!: ReturnRequest
    let orderTotal = 0
    let previouslyRefunded = 0
    let finalRefundAmount = 0
    let alreadyRefundedAmount: number | null = null

    try {
      await db.runTransaction(async (transaction) => {
        const freshOrderDoc = await transaction.get(orderRef)
        if (!freshOrderDoc.exists) {
          throw new Error('NOT_FOUND:Sipariş bulunamadı.')
        }
        const freshData = freshOrderDoc.data() || {}
        const freshReturns: ReturnRequest[] = Array.isArray(freshData.returnRequests) ? [...freshData.returnRequests] : []
        const idx = freshReturns.findIndex((r) => r.id === returnId)
        if (idx === -1) {
          throw new Error('NOT_FOUND:İade talebi bulunamadı.')
        }

        const ret = freshReturns[idx]
        if (ret.refund?.status === 'refunded') {
          alreadyRefundedAmount = Number(ret.refund.amountTRY || 0)
          return
        }
        if (ret.refund?.status === 'processing') {
          throw new Error('CONFLICT:Bu iade talebi için para iadesi şu anda işleniyor.')
        }
        if ((ret.refund as any)?.status === 'refund_unknown' || freshData.refundStatus === 'refund_unknown') {
          throw new Error(
            'CONFLICT:Önceki PayTR iade isteği zaman aşımına uğradı (refund_unknown). Çift iade riskini önlemek için PayTR panelinden doğrulama yapılmadan tekrar iade gönderilemez.'
          )
        }
        if (String(freshData.paymentMethod || '').toLowerCase() === 'iyzico') {
          throw new Error('BAD_REQUEST:Bu sipariş iyzico ile ödenmiştir; PayTR iade servisi üzerinden iade edilemez.')
        }

        const ordTotal = Number(freshData.total || 0)
        const prevRef = Number(freshData.refundedAmountTRY || 0)
        const remainingMax = Math.max(0, Math.round((ordTotal - prevRef) * 100) / 100)
        const calcAmount =
          Number(ret.refund?.amountTRY) ||
          ret.items.reduce((s, it) => s + it.unitPriceAtPurchase * it.quantityRequested, 0)
        const chosenAmount =
          typeof amountTRY === 'number' && amountTRY > 0
            ? Math.min(amountTRY, remainingMax)
            : Math.min(calcAmount, remainingMax)

        if (chosenAmount <= 0) {
          throw new Error('BAD_REQUEST:İade edilebilir tutar sıfır veya sipariş tutarından daha önce tamamen iade edilmiş.')
        }

        const lockedReturn: ReturnRequest = {
          ...ret,
          refund: {
            ...ret.refund,
            status: 'processing',
          },
          updatedAt: nowIso,
        }
        freshReturns[idx] = lockedReturn

        transaction.update(
          orderRef,
          cleanFirestoreData({
            returnRequests: cleanFirestoreData(freshReturns),
            refundStatus: 'processing_refund',
            refundLockTimestamp: Date.now(),
            updatedAt: nowIso,
          })
        )

        orderData = freshData
        returnRequests = freshReturns
        targetIdx = idx
        targetReturn = lockedReturn
        orderTotal = ordTotal
        previouslyRefunded = prevRef
        finalRefundAmount = chosenAmount
      })
    } catch (txErr: any) {
      const msg = String(txErr?.message || '')
      if (msg.startsWith('NOT_FOUND:')) {
        return NextResponse.json({ success: false, error: msg.slice(10) }, { status: 404 })
      }
      if (msg.startsWith('CONFLICT:')) {
        return NextResponse.json({ success: false, error: msg.slice(9) }, { status: 409 })
      }
      if (msg.startsWith('BAD_REQUEST:')) {
        return NextResponse.json({ success: false, error: msg.slice(12) }, { status: 400 })
      }
      throw txErr
    }

    if (alreadyRefundedAmount !== null) {
      return NextResponse.json({
        success: true,
        alreadyRefunded: true,
        message: 'Bu iade talebinin para iadesi zaten tamamlanmıştır.',
        refundAmountTRY: alreadyRefundedAmount,
      })
    }

    const merchantOid = orderData.merchant_oid || orderData.orderNumber || orderRef.id

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

    if (refundRes.isTimeout) {
      targetReturn.refund = {
        ...targetReturn.refund,
        status: 'refund_unknown' as any,
        error:
          refundRes.errMsg ||
          'PayTR iade servisi zaman aşımına uğradı. PayTR panelinden manuel doğrulama gereklidir.',
      }
      await orderRef.collection('returnRequests').doc(returnId).set(cleanFirestoreData(targetReturn), { merge: true })
      returnRequests[targetIdx] = targetReturn
      await orderRef.update(
        cleanFirestoreData({
          returnRequests,
          refundStatus: 'refund_unknown',
          refundRequiresAdminReview: true,
          requiresAdminReview: true,
          updatedAt: new Date().toISOString(),
        })
      )
      return NextResponse.json(
        {
          success: false,
          refundStatus: 'refund_unknown',
          requiresAdminReview: true,
          error: targetReturn.refund.error,
        },
        { status: 504 }
      )
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

