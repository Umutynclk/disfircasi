import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin'
import { findAvailableDeliveryDatesV2 } from '@/lib/hepsijet/client'
import { ReturnRequest } from '@/lib/returns/types'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Randevu tarihleri için oturum açmanız gerekmektedir.' },
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
      { success: false, error: 'Oturumunuz geçersiz veya süresi dolmuş.' },
      { status: 401 }
    )
  }

  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('orderId')
  const returnId = searchParams.get('returnId')

  if (!orderId || !returnId) {
    return NextResponse.json(
      { success: false, error: 'orderId ve returnId parametreleri zorunludur.' },
      { status: 400 }
    )
  }

  try {
    const db = getAdminFirestore()
    const orderDoc = await db.collection('orders').doc(orderId).get()

    if (!orderDoc.exists) {
      return NextResponse.json({ success: false, error: 'Sipariş bulunamadı.' }, { status: 404 })
    }

    const orderData = orderDoc.data() || {}

    // Sahiplik kontrolü
    const orderUserId = orderData.userId || ''
    const orderUserEmail = (orderData.userEmail || orderData.customer?.email || '').toLowerCase().trim()
    const isOwner =
      (callerUid && orderUserId === callerUid) ||
      (callerEmail && orderUserEmail === callerEmail)

    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 403 })
    }

    // İade talebini bul
    const returnRequests: ReturnRequest[] = Array.isArray(orderData.returnRequests) ? orderData.returnRequests : []
    const targetReturn = returnRequests.find((r) => r.id === returnId)

    if (!targetReturn) {
      return NextResponse.json({ success: false, error: 'İade talebi bulunamadı.' }, { status: 404 })
    }

    const allowedStatuses = ['auto_preapproved', 'approved', 'awaiting_pickup_date', 'pickup_scheduled']
    if (!allowedStatuses.includes(targetReturn.status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Bu iade talebi henüz randevu seçimi için uygun durumda değildir (Yönetici onayı bekliyor olabilir).',
        },
        { status: 400 }
      )
    }

    const address = orderData.shippingAddress || {}
    const city = address.city || 'KONYA'
    const town = address.district || address.town || 'SELÇUKLU'

    // Yarından başlayarak önümüzdeki 7 günlük aralık
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    const sevenDaysLater = new Date()
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 8)

    const startDate = tomorrow.toISOString().split('T')[0]
    const endDate = sevenDaysLater.toISOString().split('T')[0]

    const dates = await findAvailableDeliveryDatesV2({
      startDate,
      endDate,
      deliveryType: 'RETURNED',
      city,
      town,
    })

    return NextResponse.json({
      success: true,
      dates,
      city,
      town,
      returnId: targetReturn.id,
    })
  } catch (err: any) {
    console.error('Randevu tarihi sorgulama hatası:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Randevu tarihleri alınırken bir hata oluştu.' },
      { status: 500 }
    )
  }
}

