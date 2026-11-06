import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { fetchHepsiJetBarcodeLabel } from '@/lib/hepsijet/client'
import { getAdminFirestore } from '@/lib/firebase/admin'

export async function GET(req: NextRequest) {
  // 1. Yönetici Yetki Doğrulaması
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const barcode = searchParams.get('barcode')
  const orderId = searchParams.get('orderId')

  if (!barcode && !orderId) {
    return NextResponse.json({ success: false, error: 'Barkod veya Sipariş Kimliği (orderId) gereklidir.' }, { status: 400 })
  }

  try {
    let targetBarcode = barcode

    // Eğer barcode doğrudan verilmediyse orderId üzerinden Firestore'dan getir
    if (!targetBarcode && orderId) {
      const db = getAdminFirestore()
      let docSnap = await db.collection('orders').doc(orderId).get()
      if (!docSnap.exists) {
        const qNum = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get()
        if (!qNum.empty) {
          docSnap = qNum.docs[0]
        } else {
          const qOid = await db.collection('orders').where('merchant_oid', '==', orderId).limit(1).get()
          if (!qOid.empty) {
            docSnap = qOid.docs[0]
          } else {
            const qId = await db.collection('orders').where('id', '==', orderId).limit(1).get()
            if (!qId.empty) {
              docSnap = qId.docs[0]
            }
          }
        }
      }
      if (!docSnap.exists) {
        return NextResponse.json({ success: false, error: 'Sipariş bulunamadı.' }, { status: 404 })
      }
      const data = docSnap.data()
      if (
        (data?.shipping?.status === 'simulated' || data?.shipping?.liveRequestMade !== true) &&
        (data?.shipping?.barcode?.startsWith('HJKLP') || data?.shipping?.barcode?.startsWith('HJTEST'))
      ) {
        return NextResponse.json(
          { success: false, error: 'Bu sipariş simülasyon modunda oluşturulmuştur; canlı HepsiJET ortamında simülasyon barkodu ile etiket alınamaz.' },
          { status: 400 }
        )
      }
      targetBarcode = data?.shipping?.barcode || data?.shipping?.customerDeliveryNo
      if (!targetBarcode) {
        return NextResponse.json(
          { success: false, error: 'Bu siparişe ait HepsiJET API tarafından döndürülmüş geçerli bir gerçek kargo barkodu bulunamadı.' },
          { status: 400 }
        )
      }
    }

    if (!targetBarcode) {
      return NextResponse.json({ success: false, error: 'Geçerli bir barkod numarası bulunamadı.' }, { status: 400 })
    }

    if (targetBarcode.startsWith('HJKLP') || targetBarcode.startsWith('HJTEST')) {
      return NextResponse.json(
        { success: false, error: 'Belirtilen barkod simülasyon amaçlıdır, canlı HepsiJET sisteminde bulunamaz.' },
        { status: 400 }
      )
    }

    const { contentType, data } = await fetchHepsiJetBarcodeLabel([targetBarcode], 'PDF')

    // Binary PDF Yanıtı
    return new NextResponse(data as any, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'application/pdf',
        'Content-Disposition': `inline; filename="hepsijet-etiket-${targetBarcode}.pdf"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('HepsiJET Label fetch error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Kargo etiketi getirilemedi.' },
      { status: 500 }
    )
  }
}
