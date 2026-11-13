import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin'
import { deleteDeliveryOrder, HepsiJetTimeoutError, trackHepsiJetShipment, sanitizeLogMessage } from '@/lib/hepsijet/client'
import { OrderCancellationRecord, OrderShippingData } from '@/lib/hepsijet/types'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'
import { requestPayTRRefund, checkRefundEligibility } from '@/lib/paytr-refund'

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
      // Alternatif alan araması (orderNumber veya merchant_oid)
      const qNum = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get()
      if (!qNum.empty) {
        orderRef = qNum.docs[0].ref
      } else {
        const qOid = await db.collection('orders').where('merchant_oid', '==', orderId).limit(1).get()
        if (!qOid.empty) {
          orderRef = qOid.docs[0].ref
        } else {
          return NextResponse.json(
            { success: false, error: 'Sipariş bulunamadı.' },
            { status: 404 }
          )
        }
      }
    }

    // 2. ATOMİK KONTROL VE SAHİPLİK DOĞRULAMASI
    let orderData: any = null
    let targetBarcode = ''
    let targetCustomerDeliveryNo = ''
    let hasHepsiJetShipment = false

    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(orderRef)
      if (!docSnap.exists) {
        throw new Error('Sipariş bulunamadı.')
      }

      const data = docSnap.data()
      if (!data) {
        throw new Error('Sipariş verisi okunamadı.')
      }

      // Sahiplik Kontrolü (Sipariş bu kullanıcıya mı ait?)
      const orderUserId = data.userId || ''
      const orderUserEmail = (data.userEmail || data.customer?.email || '').toLowerCase().trim()

      const isOwner =
        (callerUid && orderUserId === callerUid) ||
        (callerEmail && orderUserEmail === callerEmail)

      if (!isOwner) {
        throw new Error('FORBIDDEN: Bu siparişi iptal etme yetkiniz bulunmamaktadır.')
      }

      // Sipariş Durumu Kontrolü
      if (data.status === 'cancelled') {
        throw new Error('Bu sipariş zaten iptal edilmiştir.')
      }

      const nonCancellableStatuses = ['shipped', 'completed', 'delivered']
      if (nonCancellableStatuses.includes(data.status)) {
        throw new Error('Kargoya verilmiş veya teslim edilmiş siparişler sistem üzerinden iptal edilemez. İade için lütfen destek ekibimizle iletişime geçiniz.')
      }

      const shipping = data.shipping as OrderShippingData | undefined
      targetBarcode = shipping?.barcode || ''
      targetCustomerDeliveryNo = shipping?.customerDeliveryNo || ''

      if (shipping && (shipping.status === 'created' || targetBarcode || targetCustomerDeliveryNo)) {
        hasHepsiJetShipment = true

        // Kargo dağıtımda / yolda kilit kontrolü
        if (shipping.status === 'cancel_pending') {
          const lockTime = shipping.cancelLockTimestamp || 0
          if (Date.now() - lockTime < 5 * 60 * 1000) {
            throw new Error('Bu sipariş için iptal işlemi şu anda işleniyor. Lütfen bekleyiniz.')
          }
        }

        // Kilit koy
        transaction.update(orderRef, cleanFirestoreData({
          'shipping.status': 'cancel_pending',
          'shipping.cancelLockTimestamp': Date.now(),
          'shipping.updatedAt': new Date().toISOString(),
        }))
      }

      orderData = data
    })

    // 3. HEPSIJET KARGO İPTALİ (Eğer kargo kaydı oluşturulmuşsa)
    if (hasHepsiJetShipment && targetBarcode) {
      // Canlı kargo takip kontrolü
      if (process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true') {
        try {
          const trackRes = await trackHepsiJetShipment([targetBarcode])
          const latestStatus = (trackRes?.data?.status || '').toUpperCase()
          const unchangeableStatuses = ['DAGITIMDA', 'TESLIM_EDILDI', 'YOLDA', 'IN_TRANSIT', 'DELIVERED', 'OUT_FOR_DELIVERY']
          if (unchangeableStatuses.includes(latestStatus)) {
            await orderRef.update(cleanFirestoreData({
              'shipping.status': 'cancel_failed',
              'shipping.cancelFailedReason': `Kargo dağıtıma çıkmıştır (${latestStatus}).`,
              'shipping.updatedAt': new Date().toISOString(),
            }))
            return NextResponse.json(
              {
                success: false,
                error: 'Siparişiniz kurye dağıtım sürecine girdiği için iptal edilememektedir. Ürünü teslim alırken iade talebinde bulunabilirsiniz.',
              },
              { status: 422 }
            )
          }
        } catch (tErr: any) {
          console.warn('Müşteri iptali kargo takip kontrolü uyarısı:', tErr?.message || tErr)
        }
      }

      // HepsiJET API silme çağrısı (Resmi DELETE/POST deleteDeliveryOrder)
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
        console.error('HepsiJET gönderi silme hatası:', hErr?.message || hErr)
        // Kargo iptali başarısız olduğunda sipariş yanlışlıkla iptal edilmiş gösterilmez
        await orderRef.update(cleanFirestoreData({
          'shipping.status': 'cancel_failed',
          'shipping.cancelFailedReason': hErr?.message || 'HepsiJET kargo iptal servisi başarısız oldu.',
          'shipping.updatedAt': new Date().toISOString(),
        }))

        return NextResponse.json(
          {
            success: false,
            error: `Kargo gönderisi iptal edilemedi (${hErr?.message || 'HepsiJET kargo durumu uygun değil'}). Paketiniz kurye tarafından teslim alınmış olabilir; teslimat sonrası iade talebi oluşturabilirsiniz.`,
          },
          { status: 422 }
        )
      }
    }

    // 4. PAYTR PARA İADESİ (Yalnızca tahsil edilmiş siparişler için otomatik tetiklenir)
    let refundStatusText = 'no_refund_needed'
    let refundErrorMsg: string | undefined = undefined
    let refundDetails: any = null
    let newlyRefundedTRY = 0

    const isPaid = orderData?.paymentStatus === 'PAID' || orderData?.paymentStatus === 'paid'

    if (isPaid) {
      const eligibility = checkRefundEligibility({
        ...orderData,
        status: 'cancelled',
      })

      if (!eligibility.eligible) {
        refundStatusText = 'refund_failed'
        refundErrorMsg = eligibility.reason || 'İade şartları sağlanamadı.'
      } else {
        // İdempotency kilidi: eşzamanlı çift iade talebini engelle
        await orderRef.update(cleanFirestoreData({
          refundStatus: 'processing_refund',
          refundLockTimestamp: Date.now(),
        }))

        const merchantOid = orderData?.merchant_oid || orderData?.orderNumber || orderRef.id
        const refundRes = await requestPayTRRefund({
          merchantOid,
          returnAmountTRY: eligibility.refundableAmountTRY!,
        })

        if (refundRes.status === 'success') {
          refundStatusText = 'refunded'
          newlyRefundedTRY = eligibility.refundableAmountTRY!
          refundDetails = {
            refundedAt: new Date().toISOString(),
            amountTRY: newlyRefundedTRY,
            raw: refundRes.raw,
          }
        } else {
          refundStatusText = 'refund_failed'
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

    // 5. BAŞARILI İPTAL KAYDI VE FIRESTORE GÜNCELLEMESİ
    const cancelRecord: OrderCancellationRecord = {
      orderId: orderRef.id,
      reason: cancelReason,
      cancelledBy: {
        uid: callerUid,
        email: callerEmail,
      },
      cancelledAt: new Date().toISOString(),
      shipmentBarcode: targetBarcode || '',
      shipmentCustomerDeliveryNo: targetCustomerDeliveryNo || '',
      httpStatus: 200,
      firestoreUpdateStatus: 'SUCCESS',
      cancellationResult: 'SUCCESS',
      requiresAdminReview: refundStatusText === 'refund_failed',
    }

    const existingHistory: OrderCancellationRecord[] = Array.isArray(orderData?.cancellationHistory)
      ? orderData.cancellationHistory
      : []

    const previousRefunded = Number(orderData?.refundedAmountTRY || 0)
    const totalRefundedTRY = refundStatusText === 'refunded' ? previousRefunded + newlyRefundedTRY : previousRefunded

    await orderRef.update(cleanFirestoreData({
      status: 'cancelled',
      cancellationReason: cancelReason,
      cancelledAt: new Date().toISOString(),
      cancelledByCustomer: true,
      refundStatus: refundStatusText,
      refundError: refundErrorMsg || undefined,
      refundDetail: refundDetails || undefined,
      refundedAmountTRY: totalRefundedTRY > 0 ? totalRefundedTRY : undefined,
      refundUpdatedAt: new Date().toISOString(),
      'shipping.status': hasHepsiJetShipment ? 'cancelled' : (orderData?.shipping?.status || 'none'),
      'shipping.updatedAt': new Date().toISOString(),
      cancellationHistory: cleanFirestoreData([...existingHistory, cancelRecord]),
      updatedAt: new Date().toISOString(),
    }))

    let messageText = 'Siparişiniz başarıyla iptal edilmiştir.'
    let refundNoteText: string | undefined = undefined

    if (refundStatusText === 'refunded') {
      messageText = 'Siparişiniz iptal edildi ve ödemeniz PayTR üzerinden kartınıza otomatik olarak iade edildi.'
      refundNoteText = 'İade tutarı bankanızın süreçlerine bağlı olarak 1-3 iş günü içerisinde kartınıza yansıyacaktır.'
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
    })
  } catch (err: any) {
    const errorMsg = err?.message || 'Sipariş iptali sırasında bir hata meydana geldi.'
    const isForbidden = errorMsg.startsWith('FORBIDDEN')

    return NextResponse.json(
      {
        success: false,
        error: errorMsg.replace('FORBIDDEN: ', ''),
      },
      { status: isForbidden ? 403 : 400 }
    )
  }
}
