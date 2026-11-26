import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { requestPayTRRefund, checkRefundEligibility } from '@/lib/paytr-refund'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

interface AdminRefundRequestBody {
  orderId: string
  amountTRY?: number
  reason?: string
}

export async function POST(req: NextRequest) {
  // 1. Yönetici Yetki Doğrulaması
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Yetkisiz erişim. Yönetici yetkisi gereklidir.' },
      { status: 401 }
    )
  }

  try {
    const body = (await req.json()) as AdminRefundRequestBody
    const { orderId, amountTRY, reason } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Sipariş ID (orderId) zorunludur.' },
        { status: 400 }
      )
    }

    const db = getAdminFirestore()
    let orderRef = db.collection('orders').doc(orderId)
    let orderSnap = await orderRef.get()

    if (!orderSnap.exists) {
      const qNum = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get()
      if (!qNum.empty) {
        orderRef = qNum.docs[0].ref
        orderSnap = qNum.docs[0]
      } else {
        const qOid = await db.collection('orders').where('merchant_oid', '==', orderId).limit(1).get()
        if (!qOid.empty) {
          orderRef = qOid.docs[0].ref
          orderSnap = qOid.docs[0]
        } else {
          return NextResponse.json(
            { success: false, error: 'Sipariş bulunamadı.' },
            { status: 404 }
          )
        }
      }
    }

    // Atomik İdempotency Kilidi ve Uygunluk Kontrolü (Firestore Transaction)
    let orderData: Record<string, any> = {}
    let refundAmount = 0

    try {
      await db.runTransaction(async (transaction) => {
        const freshSnap = await transaction.get(orderRef)
        if (!freshSnap.exists) {
          throw new Error('NOT_FOUND:Sipariş bulunamadı.')
        }
        const freshData = freshSnap.data() || {}
        const eligibility = checkRefundEligibility(freshData)
        if (!eligibility.eligible) {
          throw new Error(`INELIGIBLE:${eligibility.reason || 'Sipariş iadeye uygun değil.'}`)
        }

        const calculated =
          typeof amountTRY === 'number' && amountTRY > 0
            ? Math.min(amountTRY, eligibility.refundableAmountTRY!)
            : eligibility.refundableAmountTRY!

        if (calculated <= 0) {
          throw new Error('INELIGIBLE:İade edilebilir tutar sıfır veya negatif olamaz.')
        }

        transaction.update(
          orderRef,
          cleanFirestoreData({
            refundStatus: 'processing_refund',
            refundLockTimestamp: Date.now(),
            refundAttemptedBy: auth.email || 'admin',
            updatedAt: new Date().toISOString(),
          })
        )

        orderData = freshData
        refundAmount = calculated
      })
    } catch (txErr: any) {
      const msg = String(txErr?.message || '')
      if (msg.startsWith('NOT_FOUND:')) {
        return NextResponse.json({ success: false, error: msg.slice(10) }, { status: 404 })
      }
      if (msg.startsWith('INELIGIBLE:')) {
        return NextResponse.json({ success: false, error: msg.slice(11) }, { status: 400 })
      }
      throw txErr
    }

    const merchantOid = orderData.merchant_oid || orderData.orderNumber || orderRef.id
    const refundRes = await requestPayTRRefund({
      merchantOid,
      returnAmountTRY: refundAmount,
      referenceNo: `ADM-${Date.now().toString(36).toUpperCase()}`,
    })

    const previousRefunded = Number(orderData.refundedAmountTRY || 0)
    const now = new Date().toISOString()

    if (refundRes.status === 'success') {
      const newTotalRefunded = Math.round((previousRefunded + refundAmount) * 100) / 100
      const isFullyRefunded = newTotalRefunded >= Number(orderData.total || orderData.totalAmountTRY || 0)

      await orderRef.update(cleanFirestoreData({
        refundStatus: 'refunded',
        refundedAmountTRY: newTotalRefunded,
        refundError: null,
        refundRequiresAdminReview: false,
        refundUpdatedAt: now,
        refundDetail: {
          lastRefundedAt: now,
          lastRefundedAmountTRY: refundAmount,
          totalRefundedTRY: newTotalRefunded,
          isFull: isFullyRefunded,
          adminEmail: auth.email,
          reason: reason || 'Yönetici tarafından iade başlatıldı',
          raw: refundRes.raw,
        },
        updatedAt: now,
      }))

      return NextResponse.json({
        success: true,
        message: `${refundAmount.toFixed(2)} TL tutarındaki PayTR para iadesi başarıyla gerçekleştirildi.`,
        refundStatus: 'refunded',
        refundedAmountTRY: newTotalRefunded,
      })
    } else if (refundRes.isTimeout) {
      const timeoutMsg =
        refundRes.errMsg ||
        'PayTR iade isteği zaman aşımına uğradı. Çift iade riski nedeniyle sonuç belirsiz (refund_unknown) olarak işaretlendi; PayTR panelinden doğrulama gereklidir.'

      await orderRef.update(cleanFirestoreData({
        refundStatus: 'refund_unknown',
        refundRequiresAdminReview: true,
        requiresAdminReview: true,
        refundError: timeoutMsg,
        refundUpdatedAt: now,
        refundDetail: {
          timeoutAt: now,
          attemptedAmountTRY: refundAmount,
          adminEmail: auth.email,
          status: 'refund_unknown',
          errMsg: timeoutMsg,
        },
        updatedAt: now,
      }))

      return NextResponse.json(
        {
          success: false,
          error: timeoutMsg,
          refundStatus: 'refund_unknown',
          requiresAdminReview: true,
        },
        { status: 504 }
      )
    } else {
      const errorMsg = refundRes.errMsg || 'PayTR iade talebi reddedildi.'

      await orderRef.update(cleanFirestoreData({
        refundStatus: 'refund_failed',
        refundError: errorMsg,
        refundUpdatedAt: now,
        refundDetail: {
          failedAt: now,
          attemptedAmountTRY: refundAmount,
          adminEmail: auth.email,
          errNo: refundRes.errNo,
          errMsg: errorMsg,
          raw: refundRes.raw,
        },
        updatedAt: now,
      }))

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
          errNo: refundRes.errNo,
          refundStatus: 'refund_failed',
        },
        { status: 400 }
      )
    }
  } catch (err: any) {
    console.error('Admin refund API error:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'İade işlemi sırasında sunucu hatası oluştu.' },
      { status: 500 }
    )
  }
}
