import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { deleteDeliveryOrder, HepsiJetTimeoutError, trackHepsiJetShipment, sanitizeLogMessage } from '@/lib/hepsijet/client'
import { OrderCancellationRecord, OrderShippingData } from '@/lib/hepsijet/types'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

interface CancelShipmentRequestBody {
  orderId: string
  reason?: string
}

export async function POST(req: NextRequest) {
  // 1. Yönetici Yetki Doğrulaması
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as CancelShipmentRequestBody
    const { orderId, reason } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'Sipariş ID (orderId) zorunludur.' }, { status: 400 })
    }

    const cancelReason = (reason || '').trim() || 'Yönetici tarafından kargo iptal edildi.'

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

    // 2. ATOMİK KİLİTLEME VE DURUM DOĞRULAMASI (Firestore Transaction)
    let orderData: any = null
    let targetBarcode = ''
    let targetCustomerDeliveryNo = ''

    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(orderRef)

      if (!docSnap.exists) {
        throw new Error('Sipariş bulunamadı.')
      }

      const data = docSnap.data()
      if (!data) {
        throw new Error('Sipariş verisi okunamadı.')
      }

      const shipping = data.shipping as OrderShippingData | undefined
      targetBarcode = shipping?.barcode || ''
      targetCustomerDeliveryNo = shipping?.customerDeliveryNo || ''

      // İptal edilecek kargo var mı kontrolü
      if (!shipping || (shipping.status !== 'created' && !targetBarcode && !targetCustomerDeliveryNo)) {
        throw new Error('Bu sipariş için iptal edilecek aktif bir HepsiJET kargo gönderisi bulunamadı.')
      }

      // Daha önce silinmiş ancak yerel senkronizasyon bekleyen durum
      if (shipping.syncStatus === 'hepsijet_deleted_firestore_pending') {
        orderData = data
        return
      }

      if (shipping.status === 'cancelled' && data.isTrash) {
        throw new Error('Bu siparişin HepsiJET kargo gönderisi zaten iptal edilmiş ve çöp kutusuna taşınmıştır.')
      }

      // Eşzamanlı Kilit Kontrolü (5 dakika aşım)
      if (shipping.status === 'cancel_pending') {
        const lockTime = shipping.cancelLockTimestamp || shipping.lockTimestamp || 0
        const fiveMinutes = 5 * 60 * 1000
        if (Date.now() - lockTime < fiveMinutes) {
          throw new Error('Bu sipariş için kargo iptal işlemi şu anda başka bir istek tarafından işleniyor. Lütfen bekleyiniz.')
        }
      }

      // Atomik Kilit: Durumu 'cancel_pending' yap
      transaction.update(orderRef, cleanFirestoreData({
        'shipping.status': 'cancel_pending',
        'shipping.cancelLockTimestamp': Date.now(),
        'shipping.updatedAt': new Date().toISOString(),
      }))

      orderData = data
    })

    // 3. KARGO GÜNCEL DURUM KONTROLÜ (Eğer kargo kuryede veya dağıtımda ise iptal engellenir)
    if (targetBarcode && process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true') {
      try {
        const trackRes = await trackHepsiJetShipment([targetBarcode])
        const latestStatus = (trackRes?.data?.status || '').toUpperCase()

        const nonCancellableStatuses = ['DAGITIMDA', 'TESLIM_EDILDI', 'YOLDA', 'IN_TRANSIT', 'DELIVERED', 'OUT_FOR_DELIVERY']
        if (nonCancellableStatuses.includes(latestStatus)) {
          const revertMsg = `Kargo paketi operasyonel sürece girmiştir (${latestStatus}). API üzerinden iptal edilemez.`
          await orderRef.update(cleanFirestoreData({
            'shipping.status': 'cancel_failed',
            'shipping.cancelFailedReason': revertMsg,
            'shipping.updatedAt': new Date().toISOString(),
          }))

          return NextResponse.json(
            {
              success: false,
              error: `${revertMsg} Lütfen HepsiJET operasyon birimi veya müşteri hizmetleri ile manuel iletişime geçiniz.`,
              requiresAdminReview: true,
              shippingStatus: 'cancel_failed',
            },
            { status: 422 }
          )
        }
      } catch (trackErr: any) {
        console.warn('HepsiJET takip kontrolü esnasında uyarı (iptal işlemine devam ediliyor):', trackErr?.message || trackErr)
      }
    }

    // 4. HEPSIJET DELETE DELIVERY ORDER API ÇAĞRISI
    let apiResponse: any = null
    try {
      apiResponse = await deleteDeliveryOrder({
        customerDeliveryNo: targetCustomerDeliveryNo,
        barcode: targetBarcode,
        deleteReason: cancelReason,
      })
    } catch (apiErr: any) {
      const isTimeout = apiErr instanceof HepsiJetTimeoutError || apiErr?.name === 'HepsiJetTimeoutError'
      const sanitizedError = sanitizeLogMessage(apiErr?.message || 'HepsiJET kargo iptali reddedildi.')

      const resultType = isTimeout ? 'UNKNOWN' : 'REJECTED'
      const finalStatus = isTimeout ? 'unknown' : 'cancel_failed'
      const httpCode = (apiErr as any)?.status || (isTimeout ? 504 : 400)

      const cancelRecord: OrderCancellationRecord = {
        orderId: orderRef.id,
        reason: cancelReason,
        cancelledBy: {
          uid: auth.uid || '',
          email: auth.email || 'admin',
        },
        cancelledAt: new Date().toISOString(),
        shipmentBarcode: targetBarcode || '',
        shipmentCustomerDeliveryNo: targetCustomerDeliveryNo || '',
        httpStatus: httpCode,
        firestoreUpdateStatus: 'SUCCESS',
        cancellationResult: resultType,
        requiresAdminReview: true,
        errorDetail: sanitizedError,
        hepsijetResponse: {
          status: resultType,
          message: sanitizedError,
          httpStatus: httpCode,
        },
      }

      const existingHistory: OrderCancellationRecord[] = Array.isArray(orderData?.cancellationHistory)
        ? orderData.cancellationHistory
        : []

      await orderRef.update(cleanFirestoreData({
        'shipping.status': finalStatus,
        'shipping.cancelResult': resultType,
        'shipping.cancelFailedReason': sanitizedError,
        'shipping.error': sanitizedError,
        'shipping.updatedAt': new Date().toISOString(),
        cancellationHistory: cleanFirestoreData([...existingHistory, cancelRecord]),
      }))

      return NextResponse.json(
        {
          success: false,
          error: sanitizedError,
          status: finalStatus,
          requiresAdminReview: true,
          shippingStatus: finalStatus,
          cancellationRecord: cancelRecord,
        },
        { status: httpCode }
      )
    }

    // 5. HEPSIJET BAŞARILI İPTALİ DOĞRULANDI — FIRESTORE GÜNCELLEMESİ VE ÇÖPE TAŞIMA
    const isAlreadyDeleted = Boolean(apiResponse?.alreadyDeleted || apiResponse?.data?.alreadyDeleted)

    const responsePayload: Record<string, any> = {
      status: apiResponse?.status || 'OK',
      message: apiResponse?.message || (isAlreadyDeleted ? 'Gönderi sistemimizde zaten silinmiş durumda' : 'Gönderi başarıyla silindi'),
      httpStatus: 200,
    }
    if (apiResponse?.data !== undefined) {
      responsePayload.raw = cleanFirestoreData(apiResponse.data)
    }

    const cancelRecord: OrderCancellationRecord = {
      orderId: orderRef.id,
      reason: cancelReason,
      cancelledBy: {
        uid: auth.uid || '',
        email: auth.email || 'admin',
      },
      cancelledAt: new Date().toISOString(),
      shipmentBarcode: targetBarcode || '',
      shipmentCustomerDeliveryNo: targetCustomerDeliveryNo || '',
      httpStatus: 200,
      firestoreUpdateStatus: 'SUCCESS',
      hepsijetResponse: responsePayload,
      cancellationResult: 'SUCCESS',
    }

    const existingHistory: OrderCancellationRecord[] = Array.isArray(orderData?.cancellationHistory)
      ? orderData.cancellationHistory
      : []

    try {
      // Doğrulanmış HepsiJET silme sonrası sipariş çöp kutusuna taşınır
      // isTrash: true, trashedAt ve iptal durumu atomik olarak güncellenir.
      await orderRef.update(cleanFirestoreData({
        'shipping.status': 'cancelled',
        'shipping.cancelReason': cancelReason,
        'shipping.cancelledAt': cancelRecord.cancelledAt,
        'shipping.cancelledBy': auth.email || 'admin',
        'shipping.cancelResult': 'SUCCESS',
        'shipping.alreadyDeletedOnHepsiJet': isAlreadyDeleted,
        'shipping.updatedAt': new Date().toISOString(),
        'shipping.liveRequestMade': process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true',
        'shipping.syncStatus': 'synced',
        status: 'cancelled',
        isTrash: true,
        trashedAt: new Date().toISOString(),
        trashedBy: auth.email || 'admin',
        cancellationHistory: cleanFirestoreData([...existingHistory, cancelRecord]),
      }))

      return NextResponse.json({
        success: true,
        message: isAlreadyDeleted
          ? 'HepsiJET tarafında zaten silinmiş durumda olan kargo gönderisi doğrulandı, sipariş başarıyla iptal edildi ve çöp kutusuna taşındı.'
          : 'HepsiJET kargo gönderisi başarıyla iptal edildi ve sipariş çöp kutusuna taşındı.',
        shippingStatus: 'cancelled',
        isTrash: true,
        alreadyDeleted: isAlreadyDeleted,
        cancellationRecord: cancelRecord,
      })
    } catch (firestoreErr: any) {
      console.error('Firestore güncelleme hatası (HepsiJET gönderisi silinmişti):', firestoreErr)

      // Uzlaştırma mekanizması: HepsiJET silme başarılı olduğu için sipariş durumunu senkronizasyon bekliyor olarak işaretle
      try {
        await orderRef.update(cleanFirestoreData({
          'shipping.status': 'cancelled',
          'shipping.syncStatus': 'hepsijet_deleted_firestore_pending',
          'shipping.alreadyDeletedOnHepsiJet': true,
          'shipping.updatedAt': new Date().toISOString(),
        }))
      } catch (fallbackErr) {
        console.error('Uzlaştırma bayrağı yazılamadı:', fallbackErr)
      }

      cancelRecord.firestoreUpdateStatus = 'FAILED'
      return NextResponse.json({
        success: false,
        hepsijetDeleted: true,
        firestoreUpdated: false,
        error: 'HepsiJET gönderisi silindi ancak siparişin yerel kaydı güncellenemedi. Sistem tekrar senkronizasyon bekliyor.',
        requiresReconciliation: true,
        cancellationRecord: cancelRecord,
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('Cancel shipment top-level error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Kargo iptal edilirken beklenmeyen bir hata oluştu.' },
      { status: 400 }
    )
  }
}
