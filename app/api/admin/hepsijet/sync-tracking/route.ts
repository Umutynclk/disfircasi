import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { syncOrderTrackingFromHepsiJet } from '@/lib/hepsijet/tracking'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/hepsijet/sync-tracking
 *
 * Yönetici tarafından HepsiJET takip durumlarının manuel olarak senkronize edilmesi.
 * İsteğe bağlı olarak tek bir sipariş veya tüm aktif siparişler senkronize edilebilir.
 *
 * Body (opsiyonel):
 * {
 *   "orderId": "GS...", // Tek bir sipariş için
 *   "orderIds": ["GS...", "..."], // Çoklu siparişler için
 *   "dryRun": false
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Admin yetki kontrolü
    const adminCheck = await verifyAdminRequest(request)
    if (!adminCheck.isAuthorized) {
      return NextResponse.json({ error: adminCheck.error || 'Yetkisiz erişim' }, { status: 401 })
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // Body boş olabilir
    }

    const db = getAdminFirestore()
    let targetOrderIds: string[] = []

    if (body.orderId) {
      targetOrderIds = [body.orderId]
    } else if (Array.isArray(body.orderIds) && body.orderIds.length > 0) {
      targetOrderIds = body.orderIds
    } else {
      // Tüm aktif kargo siparişlerini getir
      const snapshot = await db.collection('orders').get()
      snapshot.forEach((doc: any) => {
        const data = doc.data()
        const shipping = data.shipping || {}
        const barcode = shipping.barcode || ''
        const orderStatus = data.status || ''

        if (barcode && !/NUMUNE|SAMPLE|TEST/i.test(barcode) && !barcode.startsWith('SIM-')) {
          if (orderStatus !== 'cancelled') {
            targetOrderIds.push(doc.id)
          }
        }
      })
    }

    if (targetOrderIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Senkronize edilecek sipariş bulunamadı.',
        results: [],
      })
    }

    const results = await syncOrderTrackingFromHepsiJet(targetOrderIds, {
      dryRun: Boolean(body.dryRun),
    })

    const updatedCount = results.filter((r) => r.updated).length

    return NextResponse.json({
      success: true,
      message: `${results.length} siparişten ${updatedCount} tanesi güncellendi.`,
      dryRun: Boolean(body.dryRun),
      results,
    })
  } catch (error: any) {
    console.error('Admin HepsiJET takip senkronizasyonu hatası:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Bilinmeyen hata',
      },
      { status: 500 }
    )
  }
}
