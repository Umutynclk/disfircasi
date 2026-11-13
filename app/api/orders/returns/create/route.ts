import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin'
import { evaluateReturnEligibility } from '@/lib/returns/service'
import { ReturnRequest, ReturnScope, ReturnReasonCode, RETURN_REASONS } from '@/lib/returns/types'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

interface CreateReturnRequestBody {
  orderId: string
  scope: ReturnScope
  reasonCode: ReturnReasonCode
  customerNote?: string
  items?: Array<{
    productId: string
    orderItemId?: string
    quantity: number
  }>
}

export async function POST(req: NextRequest) {
  // 1. Müşteri Kimlik Doğrulaması
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'İade talebi oluşturmak için giriş yapmanız gerekmektedir.' },
      { status: 401 }
    )
  }

  const token = authHeader.replace('Bearer ', '').trim()
  let callerUid = ''
  let callerEmail = ''

  try {
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)
    callerUid = decoded.uid
    callerEmail = (decoded.email || '').toLowerCase().trim()
  } catch (authErr: any) {
    return NextResponse.json(
      { success: false, error: 'Oturumunuz geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapınız.' },
      { status: 401 }
    )
  }

  try {
    const body = (await req.json()) as CreateReturnRequestBody
    const { orderId, scope = 'partial', reasonCode = 'not_wanted', customerNote, items = [] } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Sipariş ID (orderId) zorunludur.' },
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
        return NextResponse.json(
          { success: false, error: 'Sipariş bulunamadı.' },
          { status: 404 }
        )
      }
    }

    const orderData = orderDoc.data() || {}

    // Sahiplik doğrulaması
    const orderUserId = orderData.userId || ''
    const orderUserEmail = (orderData.userEmail || orderData.customer?.email || '').toLowerCase().trim()
    const isOwner =
      (callerUid && orderUserId === callerUid) ||
      (callerEmail && orderUserEmail === callerEmail)

    if (!isOwner) {
      return NextResponse.json(
        { success: false, error: 'Bu siparişe ait iade talebi oluşturma yetkiniz bulunmamaktadır.' },
        { status: 403 }
      )
    }

    // İade uygunluk ve hibrit onay değerlendirmesi
    const evaluation = evaluateReturnEligibility(
      orderData,
      items,
      reasonCode,
      scope,
      customerNote
    )

    if (!evaluation.eligible) {
      return NextResponse.json(
        { success: false, error: evaluation.error || 'İade talebi oluşturulamadı.' },
        { status: 400 }
      )
    }

    const nowIso = new Date().toISOString()
    const cleanOrderNum = (orderData.orderNumber || orderRef.id).replace(/[^A-Za-z0-9]/g, '')
    const returnId = `RET-${cleanOrderNum}-${Date.now().toString(36).toUpperCase()}`

    const newReturnRequest: ReturnRequest = {
      id: returnId,
      orderId: orderRef.id,
      orderNumber: orderData.orderNumber || orderRef.id,
      userId: callerUid,
      userEmail: callerEmail,
      customerName: orderData.customer?.name || orderData.shippingAddress?.fullName || 'Müşteri',
      customerPhone: orderData.customer?.phone || orderData.shippingAddress?.phone,
      scope: evaluation.scope,
      status: evaluation.initialStatus,
      reasonCode,
      reason: RETURN_REASONS[reasonCode] || 'İade Talebi',
      customerNote: customerNote || '',
      items: evaluation.items,
      approval: {
        type: evaluation.approvalType,
        status: evaluation.initialStatus === 'auto_preapproved' ? 'approved' : 'pending',
        reviewedAt: evaluation.initialStatus === 'auto_preapproved' ? nowIso : null,
        reviewedBy: evaluation.initialStatus === 'auto_preapproved' ? 'system_auto' : null,
        notes: evaluation.autoPreapprovalReasons?.join('; ') || null,
      },
      returnShipment: {
        carrier: 'HepsiJET',
        status: 'not_created',
      },
      inspection: {
        status: 'not_started',
      },
      refund: {
        status: 'not_started',
        amountTRY: evaluation.totalRefundAmountTRY,
      },
      createdAt: nowIso,
      updatedAt: nowIso,
      history: [
        {
          status: evaluation.initialStatus,
          action: evaluation.initialStatus === 'auto_preapproved'
            ? 'İade talebi oluşturuldu ve otomatik ön onay verildi.'
            : 'İade talebi oluşturuldu, yönetici incelemesine alındı.',
          actor: evaluation.initialStatus === 'auto_preapproved' ? 'system' : 'customer',
          actorEmail: callerEmail,
          timestamp: nowIso,
        },
      ],
    }

    // Hem subcollection'a hem de sipariş ana belgesine atomik kaydet
    const existingReturns: ReturnRequest[] = Array.isArray(orderData.returnRequests)
      ? orderData.returnRequests
      : []

    await db.runTransaction(async (transaction) => {
      // Subcollection kaydı
      const subDocRef = orderRef.collection('returnRequests').doc(returnId)
      transaction.set(subDocRef, cleanFirestoreData(newReturnRequest))

      // Ana sipariş güncellemesi
      transaction.update(orderRef, cleanFirestoreData({
        returnRequests: cleanFirestoreData([...existingReturns, newReturnRequest]),
        hasReturnRequest: true,
        lastReturnStatus: evaluation.initialStatus,
        lastReturnId: returnId,
        updatedAt: nowIso,
      }))
    })

    let messageText = 'İade talebiniz başarıyla alınmıştır.'
    if (evaluation.initialStatus === 'auto_preapproved') {
      messageText = 'İade talebiniz otomatik olarak ön onaylandı. Şimdi HepsiJET toplama randevusu seçebilirsiniz.'
    } else {
      messageText = 'İade talebiniz incelenmek üzere yöneticimize iletilmiştir. Onaylandığında randevu seçimi açılacaktır.'
    }

    return NextResponse.json({
      success: true,
      message: messageText,
      returnRequest: newReturnRequest,
      isAutoPreapproved: evaluation.initialStatus === 'auto_preapproved',
    })
  } catch (err: any) {
    console.error('İade talebi oluşturma hatası:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'İade talebi işlenirken beklenmeyen bir hata oluştu.' },
      { status: 500 }
    )
  }
}

