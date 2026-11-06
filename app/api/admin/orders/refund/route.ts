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

    const orderData = orderSnap.data() || {}

    // İade uygunluk kontrolü
    const eligibility = checkRefundEligibility(orderData)
    if (!eligibility.eligible) {
      return NextResponse.json(
        { success: false, error: eligibility.reason || 'Sipariş iadeye uygun değil.' },
        { status: 400 }
      )
    }

    const refundAmount = typeof amountTRY === 'number' && amountTRY > 0
      ? Math.min(amountTRY, eligibility.refundableAmountTRY!)
      : eligibility.refundableAmountTRY!

    if (refundAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'İade edilebilir tutar sıfır veya negatif olamaz.' },
        { status: 400 }
      )
    }

    // İdempotency kilidi koy
    await orderRef.update(cleanFirestoreData({
      refundStatus: 'processing_refund',
      refundLockTimestamp: Date.now(),
      refundAttemptedBy: auth.email || 'admin',
    }))

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
