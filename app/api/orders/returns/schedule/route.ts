import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin'
import { createHepsiJetReturnShipment } from '@/lib/hepsijet/client'
import { ReturnRequest } from '@/lib/returns/types'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

interface ScheduleReturnBody {
  orderId: string
  returnId: string
  appointmentDate: string // YYYY-MM-DD
  appointmentSlot?: number
  appointmentSlotDescription?: string
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: 'Oturum açmanız gerekmektedir.' },
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

  try {
    const body = (await req.json()) as ScheduleReturnBody
    const { orderId, returnId, appointmentDate, appointmentSlot = 1, appointmentSlotDescription } = body

    if (!orderId || !returnId || !appointmentDate) {
      return NextResponse.json(
        { success: false, error: 'orderId, returnId ve appointmentDate zorunludur.' },
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

    // Sahiplik kontrolü
    const orderUserId = orderData.userId || ''
    const orderUserEmail = (orderData.userEmail || orderData.customer?.email || '').toLowerCase().trim()
    const isOwner =
      (callerUid && orderUserId === callerUid) ||
      (callerEmail && orderUserEmail === callerEmail)

    if (!isOwner) {
      return NextResponse.json({ success: false, error: 'Yetkisiz erişim.' }, { status: 403 })
    }

    const returnRequests: ReturnRequest[] = Array.isArray(orderData.returnRequests) ? orderData.returnRequests : []
    const targetIndex = returnRequests.findIndex((r) => r.id === returnId)

    if (targetIndex === -1) {
      return NextResponse.json({ success: false, error: 'İade talebi bulunamadı.' }, { status: 404 })
    }

    const currentReturn = returnRequests[targetIndex]

    // İdempotency Kontrolü: Eğer bu iade talebi için zaten kargo barkodu oluşturulmuşsa mükerrer gönderi yaratma
    if (currentReturn.returnShipment?.barcode && currentReturn.returnShipment.status === 'created') {
      return NextResponse.json({
        success: true,
        alreadyScheduled: true,
        message: 'Bu iade talebi için kargo kodu zaten oluşturulmuştur.',
        barcode: currentReturn.returnShipment.barcode,
        trackingUrl: currentReturn.returnShipment.trackingUrl,
        appointmentDate: currentReturn.returnShipment.appointmentDate,
      })
    }

    // Durum kontrolü: auto_preapproved, approved veya awaiting_pickup_date olmalı
    const cancellableOrSchedulable = ['auto_preapproved', 'approved', 'awaiting_pickup_date', 'pickup_scheduled']
    if (!cancellableOrSchedulable.includes(currentReturn.status)) {
      return NextResponse.json(
        { success: false, error: `Bu iade talebi randevu seçimine uygun değildir (Mevcut durum: ${currentReturn.status}).` },
        { status: 400 }
      )
    }

    const customerAddress = orderData.shippingAddress || {}
    const pickupAddress = {
      address: customerAddress.address || 'Adres belirtilmemiş',
      city: customerAddress.city || 'KONYA',
      town: customerAddress.district || customerAddress.town || 'SELÇUKLU',
      district: customerAddress.neighborhood || customerAddress.district,
    }

    // HepsiJET RETURNED Gönderisi Oluştur
    const shipmentRes = await createHepsiJetReturnShipment({
      orderId: orderRef.id,
      orderNumber: orderData.orderNumber || orderRef.id,
      returnRequestId: currentReturn.id,
      appointmentDate,
      appointmentSlot,
      appointmentSlotDescription,
      customer: {
        fullName: orderData.customer?.name || customerAddress.fullName || 'Müşteri',
        phone: orderData.customer?.phone || customerAddress.phone || '05555555555',
        email: orderData.customer?.email || callerEmail,
      },
      pickupAddress,
      items: (currentReturn.items || []).map((it) => ({
        name: it.productName,
        sku: it.sku,
        quantity: it.quantityRequested,
        price: it.unitPriceAtPurchase,
      })),
      desi: 1,
      weight: 1,
    })

    const nowIso = new Date().toISOString()
    const updatedReturn: ReturnRequest = {
      ...currentReturn,
      status: 'return_shipment_created',
      updatedAt: nowIso,
      returnShipment: {
        carrier: 'HepsiJET',
        customerDeliveryNo: shipmentRes.customerDeliveryNo,
        barcode: shipmentRes.barcode,
        trackingUrl: shipmentRes.trackingUrl,
        appointmentDate,
        appointmentSlot,
        appointmentSlotDescription: appointmentSlotDescription || (appointmentSlot === 1 ? '09:00 - 13:00' : '13:00 - 18:00'),
        status: 'created',
        createdAt: nowIso,
      },
      history: [
        ...(currentReturn.history || []),
        {
          status: 'return_shipment_created',
          action: `HepsiJET randevulu toplama tarihi (${appointmentDate}) belirlendi ve ${shipmentRes.barcode} iade barkodu oluşturuldu.`,
          actor: 'customer',
          actorEmail: callerEmail,
          timestamp: nowIso,
        },
      ],
    }

    returnRequests[targetIndex] = updatedReturn

    // Atomik güncelleme (hem subcollection hem ana doküman)
    await db.runTransaction(async (transaction) => {
      const subDocRef = orderRef.collection('returnRequests').doc(returnId)
      transaction.set(subDocRef, cleanFirestoreData(updatedReturn), { merge: true })

      transaction.update(orderRef, cleanFirestoreData({
        returnRequests: cleanFirestoreData(returnRequests),
        lastReturnStatus: 'return_shipment_created',
        lastReturnBarcode: shipmentRes.barcode,
        lastReturnTrackingUrl: shipmentRes.trackingUrl,
        lastReturnAppointmentDate: appointmentDate,
        updatedAt: nowIso,
      }))
    })

    return NextResponse.json({
      success: true,
      message: 'İade kargo kodunuz başarıyla oluşturulmuştur. HepsiJET kuryesi belirtilen tarihte adresinizden paketi teslim alacaktır.',
      barcode: shipmentRes.barcode,
      trackingUrl: shipmentRes.trackingUrl,
      appointmentDate,
      appointmentSlot,
      returnRequest: updatedReturn,
    })
  } catch (err: any) {
    console.error('İade randevu planlama hatası:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'İade kargo kaydı oluşturulurken bir hata oluştu.' },
      { status: 500 }
    )
  }
}

