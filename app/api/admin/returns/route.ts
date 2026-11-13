import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { ReturnRequest } from '@/lib/returns/types'

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Yönetici yetkisi gereklidir.' },
      { status: 401 }
    )
  }

  try {
    const db = getAdminFirestore()
    // hasReturnRequest == true olan siparişleri getir
    const ordersSnap = await db.collection('orders').where('hasReturnRequest', '==', true).get()
    const allReturns: ReturnRequest[] = []

    for (const doc of ordersSnap.docs) {
      const data = doc.data()
      if (Array.isArray(data.returnRequests)) {
        for (const ret of data.returnRequests) {
          allReturns.push({
            ...ret,
            orderId: doc.id,
            orderNumber: data.orderNumber || doc.id,
            customerName: data.customer?.name || data.shippingAddress?.fullName || 'Müşteri',
          })
        }
      }
    }

    // Tarihe göre yeniden eskiye sırala
    allReturns.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

    return NextResponse.json({
      success: true,
      returns: allReturns,
      totalCount: allReturns.length,
    })
  } catch (err: any) {
    console.error('Admin iade listesi hatası:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'İade listesi alınamadı.' },
      { status: 500 }
    )
  }
}

