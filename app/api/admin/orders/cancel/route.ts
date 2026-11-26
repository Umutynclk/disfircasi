import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { deleteDeliveryOrder, HepsiJetTimeoutError, trackHepsiJetShipment, sanitizeLogMessage } from '@/lib/hepsijet/client'
import { OrderCancellationRecord, OrderShippingData } from '@/lib/hepsijet/types'
import {
  extractHepsiJetIntegrationStatus,
  evaluateCancellationEligibility,
} from '@/lib/orders/cancellationPolicy'
import { cancelPendingPrintJobsForOrder } from '@/lib/printing/queue'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

interface CancelOrderRequestBody {
  orderId: string
  reason: string
}

export async function POST(req: NextRequest) {
  // 1. Yönetici Yetki Doğrulaması
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as CancelOrderRequestBody
    const { orderId, reason } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'Sipariş ID (orderId) zorunludur.' }, { status: 400 })
    }

    const trimmedReason = (reason || '').trim()
    if (!trimmedReason || trimmedReason.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Lütfen geçerli bir sipariş iptal nedeni belirtiniz (en az 3 karakter).' },
        { status: 400 }
      )
    }

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
          const qId = await db.collection('orders').where('id', '==', orderId).limit(1).get()
          if (!qId.empty) {
            orderRef = qId.docs[0].ref
          }
        }
      }
    }

    // 2. SİPARİŞİ VE KARGO DURUMUNU İNCELE
    let orderData: any = null
    let hasActiveShipping = false
    let targetBarcode = ''
    let targetCustomerDeliveryNo = ''
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

      // Ortak iptal politikası (Firestore order.status + shipping.status kontrolü)
      const preCheck = evaluateCancellationEligibility(data, { liveDispatchEnabled: false })
      if (!preCheck.allowed) {
        throw new Error(preCheck.reason || 'Bu sipariş doğrudan iptal edilemez.')
      }

      const shipping = data.shipping as OrderShippingData | undefined
      targetBarcode = shipping?.barcode || ''
      targetCustomerDeliveryNo = shipping?.customerDeliveryNo || ''
      previousShippingStatus = shipping?.status || 'none'

      hasActiveShipping = Boolean(
        shipping &&
          (shipping.status === 'created' ||
            (targetBarcode && !targetBarcode.startsWith('HJTEST') && shipping.liveRequestMade === true) ||
            targetCustomerDeliveryNo)
      )

      if (hasActiveShipping) {
        // Eşzamanlı Kilit Kontrolü
        if (shipping?.status === 'cancel_pending') {
          const lockTime = shipping.cancelLockTimestamp || shipping.lockTimestamp || 0
          const fiveMinutes = 5 * 60 * 1000
          if (Date.now() - lockTime < fiveMinutes) {
            throw new Error('Bu sipariş için iptal işlemi şu anda işleniyor. Lütfen bekleyiniz.')
          }
        }

        // Kargo iptali öncesi kilitle
        transaction.update(orderRef, {
          'shipping.status': 'cancel_pending',
          'shipping.cancelLockTimestamp': Date.now(),
          'shipping.updatedAt': new Date().toISOString(),
        })
      }

      orderData = data
    })

    // 3. SENARYO A: KARGO OLUŞTURULMAMIŞSA (veya aktif canlı kargo yoksa)
    if (!hasActiveShipping) {
      const now = new Date().toISOString()
      const cancelRecord: OrderCancellationRecord = {
        orderId: orderRef.id,
        reason: trimmedReason,
        cancelledBy: {
          uid: auth.uid,
          email: auth.email,
        },
        cancelledAt: now,
        cancellationResult: 'NOT_APPLICABLE',
      }

      const existingHistory: OrderCancellationRecord[] = Array.isArray(orderData.cancellationHistory)
        ? orderData.cancellationHistory
        : []

      await orderRef.update({
        status: 'cancelled',
        cancelReason: trimmedReason,
        cancelledAt: now,
        cancelledBy: auth.email || 'admin',
        updatedAt: now,
        'shipping.status': 'cancelled',
        'shipping.cancelReason': trimmedReason,
        'shipping.cancelledAt': now,
        'shipping.cancelledBy': auth.email || 'admin',
        'shipping.cancelResult': 'NOT_APPLICABLE',
        'shipping.updatedAt': now,
        cancellationHistory: [...existingHistory, cancelRecord],
      })

      return NextResponse.json({
        success: true,
        message: 'Sipariş başarıyla iptal edildi (kargo kaydı bulunmadığından kargo iptali gerekmedi).',
        orderStatus: 'cancelled',
        shippingStatus: 'cancelled',
        cancellationRecord: cancelRecord,
      })
    }

    // 4. SENARYO B: HEPSIJET GÖNDERİSİ MEVCUTSA
    // Önce canlı kargo durumunu ortak parser ile kontrol et
    const liveDispatchEnabled = process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true'
    if (targetBarcode && liveDispatchEnabled) {
      let liveTrackStatus = null
      let liveTrackingError: string | null = null

      try {
        const trackRes = await trackHepsiJetShipment([targetBarcode])
        liveTrackStatus = extractHepsiJetIntegrationStatus(trackRes, targetBarcode)
      } catch (trackErr: any) {
        liveTrackingError = trackErr?.message || 'HepsiJET takip servisi yanıt vermedi.'
        console.warn('Admin iptali canlı HepsiJET takip hatası:', liveTrackingError)
      }

      const liveDecision = evaluateCancellationEligibility(orderData, {
        liveTrackStatus,
        liveTrackingError,
        liveDispatchEnabled: true,
        hasLiveShipment: true,
      })

      if (!liveDecision.allowed) {
        const nowIso = new Date().toISOString()
        // Gerçek kargo durumunu (in_transit vb.) 'cancel_failed' ile EZME!
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
              reason: trimmedReason,
              detail: liveDecision.reason,
              carrierStatusCode: liveDecision.carrierStatusCode || null,
              carrierDisplayStatus: liveDecision.carrierDisplayStatus || null,
              firestoreMismatch: Boolean(liveDecision.firestoreMismatch),
              requiresAdminReview: true,
              requestedBy: auth.email || 'admin',
              requestedAt: nowIso,
            },
            requiresAdminReview: true,
            updatedAt: nowIso,
          })
        )

        return NextResponse.json(
          {
            success: false,
            code: liveDecision.code,
            error: liveDecision.reason,
            requiresAdminReview: true,
            shippingStatus: restoredShippingStatus,
          },
          { status: 422 }
        )
      }
    }

    // HepsiJET iptal servisini çağır
    try {
      const apiResponse = await deleteDeliveryOrder({
        customerDeliveryNo: targetCustomerDeliveryNo,
        barcode: targetBarcode,
        deleteReason: trimmedReason,
      })

      const isAlreadyDeleted = Boolean(apiResponse.alreadyDeleted || apiResponse.data?.alreadyDeleted)
      const now = new Date().toISOString()
      const cancelRecord: OrderCancellationRecord = {
        orderId: orderRef.id,
        reason: trimmedReason,
        cancelledBy: {
          uid: auth.uid,
          email: auth.email,
        },
        cancelledAt: now,
        shipmentBarcode: targetBarcode,
        shipmentCustomerDeliveryNo: targetCustomerDeliveryNo,
        hepsijetResponse: {
          status: apiResponse.status,
          message: apiResponse.message,
          raw: apiResponse.data,
        },
        cancellationResult: 'SUCCESS',
      }

      const existingHistory: OrderCancellationRecord[] = Array.isArray(orderData.cancellationHistory)
        ? orderData.cancellationHistory
        : []

      // Baskı kuyruğundaki bekleyen pending etiket işini iptal et
      const printCancelResult = await cancelPendingPrintJobsForOrder(
        orderRef.id,
        `Admin iptali: ${trimmedReason}`
      ).catch(() => ({ cancelledCount: 0, inProgressOrPrintedCount: 0, physicalPrintMayHaveStarted: false }))

      // API başarılı onay verdiğinde hem siparişi hem kargoyu iptal et
      await orderRef.update(cleanFirestoreData({
        status: 'cancelled',
        cancelReason: trimmedReason,
        cancelledAt: now,
        cancelledBy: auth.email || 'admin',
        updatedAt: now,
        'shipping.status': 'cancelled',
        'shipping.printStatus':
          printCancelResult.cancelledCount > 0 ? 'cancelled' : orderData?.shipping?.printStatus,
        'shipping.cancelReason': trimmedReason,
        'shipping.cancelledAt': now,
        'shipping.cancelledBy': auth.email || 'admin',
        'shipping.cancelResult': 'SUCCESS',
        'shipping.alreadyDeletedOnHepsiJet': isAlreadyDeleted,
        'shipping.updatedAt': now,
        'shipping.liveRequestMade': process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true',
        cancellationRequest: {
          status: 'completed',
          reason: trimmedReason,
          requestedBy: auth.email || 'admin',
          completedAt: now,
          printJobsCancelled: printCancelResult.cancelledCount,
          physicalPrintMayHaveStarted: printCancelResult.physicalPrintMayHaveStarted,
        },
        cancellationHistory: [...existingHistory, cancelRecord],
      }))

      return NextResponse.json({
        success: true,
        message: isAlreadyDeleted
          ? 'HepsiJET tarafında zaten silinmiş durumda olan kargo tespit edildi; sipariş ve kargo kaydı iptal edildi.'
          : 'Sipariş ve HepsiJET kargo gönderisi başarıyla iptal edildi.',
        orderStatus: 'cancelled',
        shippingStatus: 'cancelled',
        alreadyDeleted: isAlreadyDeleted,
        cancellationRecord: cancelRecord,
      })
    } catch (apiErr: any) {
      const isTimeout = apiErr instanceof HepsiJetTimeoutError || apiErr?.name === 'HepsiJetTimeoutError'
      const sanitizedError = sanitizeLogMessage(apiErr?.message || 'HepsiJET kargo iptali reddedildi.')

      const resultType = isTimeout ? 'UNKNOWN' : 'REJECTED'
      const finalShippingStatus = isTimeout ? 'unknown' : 'cancel_failed'

      const cancelRecord: OrderCancellationRecord = {
        orderId: orderRef.id,
        reason: trimmedReason,
        cancelledBy: {
          uid: auth.uid,
          email: auth.email,
        },
        cancelledAt: new Date().toISOString(),
        shipmentBarcode: targetBarcode,
        shipmentCustomerDeliveryNo: targetCustomerDeliveryNo,
        cancellationResult: resultType,
        requiresAdminReview: true,
        errorDetail: sanitizedError,
      }

      const existingHistory: OrderCancellationRecord[] = Array.isArray(orderData.cancellationHistory)
        ? orderData.cancellationHistory
        : []

      // API onay vermediğinde kargo durumunu "iptal edildi" OLARAK İŞARETLEME!
      // Sipariş durumunu da koru ve yönetici incelemesine sun
      await orderRef.update({
        'shipping.status': finalShippingStatus,
        'shipping.cancelResult': resultType,
        'shipping.cancelFailedReason': sanitizedError,
        'shipping.error': sanitizedError,
        'shipping.updatedAt': new Date().toISOString(),
        cancellationHistory: [...existingHistory, cancelRecord],
      })

      const httpStatus = isTimeout ? 504 : 400

      return NextResponse.json(
        {
          success: false,
          error: sanitizedError,
          requiresAdminReview: true,
          shippingStatus: finalShippingStatus,
          message:
            'Kargo iptal isteği HepsiJET tarafından onaylanamadı. Sipariş durumu kargo güvenliği nedeniyle iptal edilmedi ve yönetici incelemesine alındı.',
        },
        { status: httpStatus }
      )
    }
  } catch (error: any) {
    console.error('Cancel order top-level error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Sipariş iptal edilirken beklenmeyen bir hata oluştu.' },
      { status: 400 }
    )
  }
}
