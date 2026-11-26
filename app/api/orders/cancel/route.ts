import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin'
import { deleteDeliveryOrder, trackHepsiJetShipment } from '@/lib/hepsijet/client'
import { OrderCancellationRecord, OrderShippingData } from '@/lib/hepsijet/types'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'
import { requestPayTRRefund, checkRefundEligibility } from '@/lib/paytr-refund'
import {
  extractHepsiJetIntegrationStatus,
  evaluateCancellationEligibility,
} from '@/lib/orders/cancellationPolicy'
import { cancelPendingPrintJobsForOrder } from '@/lib/printing/queue'

interface CustomerCancelRequestBody {
  orderId: string
  reason?: string
}

export async function POST(req: NextRequest) {
  // 1. Müşteri Kimlik Doğrulaması (Bearer ID Token)
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Sipariş iptali için kullanıcı girişi gereklidir.' },
      { status: 401 }
    )
  }

  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Oturum belirteci (token) bulunamadı.' },
      { status: 401 }
    )
  }

  let callerUid = ''
  let callerEmail = ''

  try {
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)
    callerUid = decoded.uid
    callerEmail = (decoded.email || '').toLowerCase().trim()
  } catch (authErr: any) {
    console.error('Customer cancel auth verification error:', authErr?.message || authErr)
    return NextResponse.json(
      { success: false, error: 'Oturumunuzun süresi dolmuş veya geçersiz. Lütfen tekrar giriş yapınız.' },
      { status: 401 }
    )
  }

  try {
    const body = (await req.json()) as CustomerCancelRequestBody
    const { orderId, reason } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Sipariş numarası (orderId) zorunludur.' },
        { status: 400 }
      )
    }

    const cancelReason = (reason || '').trim() || 'Müşteri talebiyle sipariş iptal edildi.'

    const db = getAdminFirestore()
    let orderRef = db.collection('orders').doc(orderId)
    const initialCheck = await orderRef.get()

    if (!initialCheck.exists) {
      const qNum = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get()
      if (!qNum.empty) {
        orderRef = qNum.docs[0].ref
      } else {
        const qOid = await db.collection('orders').where('merchant_oid', '==', orderId).limit(1).get()
        if (!qOid.empty) {
          orderRef = qOid.docs[0].ref
        } else {
          return NextResponse.json({ success: false, error: 'Sipariş bulunamadı.' }, { status: 404 })
        }
      }
    }

    // 2. ATOMİK KONTROL, SAHİPLİK VE TAŞIYICI ÖN DOĞRULAMASI
    let orderData: any = null
    let targetBarcode = ''
    let targetCustomerDeliveryNo = ''
    let hasHepsiJetShipment = false
    let previousShippingStatus = 'none'

    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(orderRef)
      if (!docSnap.exists) {
        throw new Error('Sipariş bulunamadı.')
      }

      const data = docSnap.data()
      if (!data) {
        throw new Error('Sipariş verisi okunamadı.')
      }

      const orderUserId = data.userId || ''
      const orderUserEmail = (data.userEmail || data.customer?.email || '').toLowerCase().trim()

      const isOwner =
        (callerUid && orderUserId === callerUid) ||
        (callerEmail && orderUserEmail === callerEmail)

      if (!isOwner) {
        throw new Error('FORBIDDEN: Bu siparişi iptal etme yetkiniz bulunmamaktadır.')
      }

      // Ortak iptal politikası (Firestore order.status + shipping.status kontrolü)
      const preCheck = evaluateCancellationEligibility(data, { liveDispatchEnabled: false })
      if (!preCheck.allowed) {
        if (preCheck.code === 'CARRIER_HANDED_OVER') {
          throw new Error(`WITHDRAWAL_REQUIRED:${preCheck.reason}`)
        }
        throw new Error(preCheck.reason || 'Bu sipariş iptal edilemez.')
      }

      const shipping = data.shipping as OrderShippingData | undefined
      targetBarcode = shipping?.barcode || ''
      targetCustomerDeliveryNo = shipping?.customerDeliveryNo || ''
      previousShippingStatus = shipping?.status || 'none'

      if (shipping && (shipping.status === 'created' || targetBarcode || targetCustomerDeliveryNo)) {
        hasHepsiJetShipment = true

        if (shipping.status === 'cancel_pending') {
          const lockTime = shipping.cancelLockTimestamp || 0
          if (Date.now() - lockTime < 5 * 60 * 1000) {
            throw new Error('Bu sipariş için iptal işlemi şu anda işleniyor. Lütfen bekleyiniz.')
          }
        }

        transaction.update(
          orderRef,
          cleanFirestoreData({
            'shipping.status': 'cancel_pending',
            'shipping.cancelLockTimestamp': Date.now(),
            'shipping.updatedAt': new Date().toISOString(),
          })
        )
      }

      orderData = data
    })

    // 3. HEPSIJET CANLI TAKİP DOĞRULAMASI VE GÖNDERİ SİLME
    const liveDispatchEnabled = process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true'
    if (hasHepsiJetShipment && targetBarcode) {
      let liveTrackStatus = null
      let liveTrackingError: string | null = null

      if (liveDispatchEnabled) {
        try {
          const trackRes = await trackHepsiJetShipment([targetBarcode])
          liveTrackStatus = extractHepsiJetIntegrationStatus(trackRes, targetBarcode)
        } catch (tErr: any) {
          liveTrackingError = tErr?.message || 'HepsiJET takip servisi yanıt vermedi.'
          console.warn('Müşteri iptali canlı HepsiJET takip hatası:', liveTrackingError)
        }
      }

      const liveDecision = evaluateCancellationEligibility(orderData, {
        liveTrackStatus,
        liveTrackingError,
        liveDispatchEnabled,
        hasLiveShipment: true,
      })

      if (!liveDecision.allowed) {
        const nowIso = new Date().toISOString()
        // KRİTİK: Gerçek kargo durumunu (in_transit vb.) 'cancel_failed' ile EZME!
        const restoredShippingStatus =
          liveDecision.code === 'CARRIER_HANDED_OVER' && liveDecision.mappedShippingStatus
            ? liveDecision.mappedShippingStatus
            : previousShippingStatus

        await orderRef.update(
          cleanFirestoreData({
            'shipping.status': restoredShippingStatus,
            'shipping.lastStatusText': liveDecision.carrierDisplayStatus || orderData?.shipping?.lastStatusText,
            'shipping.updatedAt': nowIso,
            cancellationRequest: {
              status:
                liveDecision.code === 'CARRIER_HANDED_OVER'
                  ? 'rejected_carrier_handed_over'
                  : 'pending_admin_review',
              code: liveDecision.code,
              reason: cancelReason,
              detail: liveDecision.reason,
              carrierStatusCode: liveDecision.carrierStatusCode || null,
              carrierDisplayStatus: liveDecision.carrierDisplayStatus || null,
              firestoreMismatch: Boolean(liveDecision.firestoreMismatch),
              allowWithdrawalRequest: Boolean(liveDecision.allowWithdrawalRequest),
              requiresAdminReview: Boolean(liveDecision.requiresAdminReview),
              requestedBy: callerEmail || callerUid,
              requestedAt: nowIso,
            },
            requiresAdminReview: liveDecision.requiresAdminReview ? true : orderData?.requiresAdminReview,
            updatedAt: nowIso,
          })
        )

        return NextResponse.json(
          {
            success: false,
            code: liveDecision.code,
            allowWithdrawalRequest: Boolean(liveDecision.allowWithdrawalRequest),
            requiresAdminReview: Boolean(liveDecision.requiresAdminReview),
            error: liveDecision.reason,
          },
          { status: 422 }
        )
      }

      // HepsiJET API silme çağrısı (yalnızca taşıyıcıya teslim edilmediği doğrulandıktan sonra)
      try {
        const deleteRes = await deleteDeliveryOrder({
          customerDeliveryNo: targetCustomerDeliveryNo,
          barcode: targetBarcode,
          deleteReason: `Müşteri İptali: ${cancelReason}`,
        })

        if (deleteRes.status !== 'OK') {
          throw new Error(deleteRes.message || 'HepsiJET kargo iptal servisi onay vermedi.')
        }
      } catch (hErr: any) {
        const nowIso = new Date().toISOString()
        console.error('HepsiJET gönderi silme hatası:', hErr?.message || hErr)

        await orderRef.update(
          cleanFirestoreData({
            'shipping.status': previousShippingStatus,
            'shipping.updatedAt': nowIso,
            cancellationRequest: {
              status: 'failed_hepsijet_delete',
              reason: cancelReason,
              detail: hErr?.message || 'HepsiJET kargo iptal servisi başarısız oldu.',
              requiresAdminReview: true,
              requestedBy: callerEmail || callerUid,
              requestedAt: nowIso,
            },
            requiresAdminReview: true,
            updatedAt: nowIso,
          })
        )

        return NextResponse.json(
          {
            success: false,
            requiresAdminReview: true,
            allowWithdrawalRequest: true,
            error: `Kargo gönderisi iptal edilemedi (${hErr?.message || 'HepsiJET kargo durumu uygun değil'}). Paketiniz kurye tarafından teslim alınmış olabilir; cayma talebi iletebilirsiniz.`,
          },
          { status: 422 }
        )
      }
    }

    // 4. BASKI KUYRUĞU (PRINT QUEUE) GÜVENLİĞİ: Henüz basılmamış pending işi iptal et
    const printCancelResult = await cancelPendingPrintJobsForOrder(
      orderRef.id,
      `Müşteri iptali: ${cancelReason}`
    ).catch((err) => {
      console.warn('Print queue cancel warning:', err?.message)
      return { cancelledCount: 0, inProgressOrPrintedCount: 0, physicalPrintMayHaveStarted: false }
    })

    // 5. PAYTR PARA İADESİ (Atomik Firestore Transaction Kilidi + Timeout 'refund_unknown' Koruması)
    let refundStatusText: string = 'no_refund_needed'
    let refundErrorMsg: string | undefined = undefined
    let refundDetails: any = null
    let newlyRefundedTRY = 0
    let refundRequiresAdminReview = false

    const isPaid = orderData?.paymentStatus === 'PAID' || orderData?.paymentStatus === 'paid'

    if (isPaid) {
      let acquiredAmountTRY = 0
      let lockReason: string | null = null
      let observedRefundStatus: string | undefined = undefined

      await db.runTransaction(async (transaction) => {
        const freshSnap = await transaction.get(orderRef)
        const freshData = freshSnap.exists ? freshSnap.data() || {} : {}
        observedRefundStatus = freshData.refundStatus
        const eligibility = checkRefundEligibility({ ...freshData, status: 'cancelled' })
        if (!eligibility.eligible) {
          lockReason = eligibility.reason || 'İade şartları sağlanamadı.'
          return
        }
        acquiredAmountTRY = eligibility.refundableAmountTRY!
        transaction.update(
          orderRef,
          cleanFirestoreData({
            refundStatus: 'processing_refund',
            refundLockTimestamp: Date.now(),
          })
        )
      })

      if (lockReason || acquiredAmountTRY <= 0) {
        refundStatusText =
          observedRefundStatus === 'refunded'
            ? 'refunded'
            : observedRefundStatus === 'refund_unknown'
            ? 'refund_unknown'
            : observedRefundStatus === 'processing_refund'
            ? 'processing_refund'
            : 'refund_failed'
        refundErrorMsg = lockReason || 'İade şartları sağlanamadı.'
        refundRequiresAdminReview = refundStatusText !== 'refunded' && refundStatusText !== 'processing_refund'
      } else {
        const merchantOid = orderData?.merchant_oid || orderData?.orderNumber || orderRef.id
        const refundRes = await requestPayTRRefund({
          merchantOid,
          returnAmountTRY: acquiredAmountTRY,
        })

        if (refundRes.status === 'success') {
          refundStatusText = 'refunded'
          newlyRefundedTRY = acquiredAmountTRY
          refundDetails = {
            refundedAt: new Date().toISOString(),
            amountTRY: newlyRefundedTRY,
            raw: refundRes.raw,
          }
        } else if (refundRes.isTimeout) {
          refundStatusText = 'refund_unknown'
          refundRequiresAdminReview = true
          refundErrorMsg =
            refundRes.errMsg ||
            'PayTR iade servisi zaman aşımına uğradı. Çift iade riskini önlemek için sonuç yönetici doğrulamasına alındı.'
          refundDetails = {
            timeoutAt: new Date().toISOString(),
            status: 'refund_unknown',
            errMsg: refundErrorMsg,
          }
        } else {
          refundStatusText = 'refund_failed'
          refundRequiresAdminReview = true
          refundErrorMsg = refundRes.errMsg || 'PayTR iade talebi reddedildi.'
          refundDetails = {
            failedAt: new Date().toISOString(),
            errNo: refundRes.errNo,
            errMsg: refundRes.errMsg,
            raw: refundRes.raw,
          }
        }
      }
    }

    // 6. BAŞARILI İPTAL KAYDI VE FIRESTORE GÜNCELLEMESİ
    const nowIso = new Date().toISOString()
    const cancelRecord: OrderCancellationRecord = {
      orderId: orderRef.id,
      reason: cancelReason,
      cancelledBy: {
        uid: callerUid,
        email: callerEmail,
      },
      cancelledAt: nowIso,
      shipmentBarcode: targetBarcode || '',
      shipmentCustomerDeliveryNo: targetCustomerDeliveryNo || '',
      httpStatus: 200,
      firestoreUpdateStatus: 'SUCCESS',
      cancellationResult: 'SUCCESS',
      requiresAdminReview: refundRequiresAdminReview || printCancelResult.physicalPrintMayHaveStarted,
    }

    const existingHistory: OrderCancellationRecord[] = Array.isArray(orderData?.cancellationHistory)
      ? orderData.cancellationHistory
      : []

    const previousRefunded = Number(orderData?.refundedAmountTRY || 0)
    const totalRefundedTRY = refundStatusText === 'refunded' ? previousRefunded + newlyRefundedTRY : previousRefunded

    await orderRef.update(
      cleanFirestoreData({
        status: 'cancelled',
        cancellationReason: cancelReason,
        cancelledAt: nowIso,
        cancelledByCustomer: true,
        refundStatus: refundStatusText,
        refundRequiresAdminReview,
        requiresAdminReview: refundRequiresAdminReview || printCancelResult.physicalPrintMayHaveStarted || undefined,
        refundError: refundErrorMsg || undefined,
        refundDetail: refundDetails || undefined,
        refundedAmountTRY: totalRefundedTRY > 0 ? totalRefundedTRY : undefined,
        refundUpdatedAt: nowIso,
        'shipping.status': hasHepsiJetShipment ? 'cancelled' : orderData?.shipping?.status || 'none',
        'shipping.printStatus':
          printCancelResult.cancelledCount > 0 ? 'cancelled' : orderData?.shipping?.printStatus,
        'shipping.updatedAt': nowIso,
        cancellationRequest: {
          status: 'completed',
          reason: cancelReason,
          requestedBy: callerEmail || callerUid,
          completedAt: nowIso,
          printJobsCancelled: printCancelResult.cancelledCount,
          physicalPrintMayHaveStarted: printCancelResult.physicalPrintMayHaveStarted,
        },
        cancellationHistory: cleanFirestoreData([...existingHistory, cancelRecord]),
        updatedAt: nowIso,
      })
    )

    let messageText = 'Siparişiniz başarıyla iptal edilmiştir.'
    let refundNoteText: string | undefined = undefined

    if (refundStatusText === 'refunded') {
      messageText = 'Siparişiniz iptal edildi ve ödemeniz PayTR üzerinden kartınıza otomatik olarak iade edildi.'
      refundNoteText = 'İade tutarı bankanızın süreçlerine bağlı olarak 1-3 iş günü içerisinde kartınıza yansıyacaktır.'
    } else if (refundStatusText === 'refund_unknown') {
      messageText = 'Siparişiniz iptal edildi; ödeme iadesi banka/PayTR doğrulaması için incelemeye alındı.'
      refundNoteText = 'Çift iade riskini önlemek amacıyla iade durumu ekibimizce PayTR panelinden doğrulanarak sonuçlandırılacaktır.'
    } else if (refundStatusText === 'refund_failed') {
      messageText = 'Siparişiniz iptal edildi ancak kartınıza otomatik para iadesi yapılırken bir sorun oluştu.'
      refundNoteText = `İade durumu: ${refundErrorMsg}. Sipariş incelemeye alınmıştır, en kısa sürede manuel olarak tamamlanacaktır.`
    }

    return NextResponse.json({
      success: true,
      message: messageText,
      orderId: orderRef.id,
      refundStatus: refundStatusText,
      refundError: refundErrorMsg || undefined,
      refundNote: refundNoteText,
      printJobsCancelled: printCancelResult.cancelledCount,
    })
  } catch (err: any) {
    const errorMsg = err?.message || 'Sipariş iptali sırasında bir hata meydana geldi.'
    const isForbidden = errorMsg.startsWith('FORBIDDEN')
    const isWithdrawalRequired = errorMsg.startsWith('WITHDRAWAL_REQUIRED:')

    return NextResponse.json(
      {
        success: false,
        allowWithdrawalRequest: isWithdrawalRequired,
        error: errorMsg.replace('FORBIDDEN: ', '').replace('WITHDRAWAL_REQUIRED:', ''),
      },
      { status: isForbidden ? 403 : isWithdrawalRequired ? 422 : 400 }
    )
  }
}
