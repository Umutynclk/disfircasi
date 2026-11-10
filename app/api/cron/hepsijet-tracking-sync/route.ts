import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { syncOrderTrackingFromHepsiJet } from '@/lib/hepsijet/tracking'

export const dynamic = 'force-dynamic'

async function handleTrackingSync(request: NextRequest) {
  try {
    // 1. Cron secret doğrulaması (güvenlik)
    const expectedSecret = process.env.CRON_SECRET
    if (expectedSecret) {
      const authHeader = request.headers.get('authorization')
      const cronHeader = request.headers.get('x-cron-secret')
      const token = cronHeader || (authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null)

      if (token !== expectedSecret) {
        return NextResponse.json(
          { error: 'Yetkisiz erişim (geçersiz cron secret)' },
          { status: 401 }
        )
      }
    }

    const db = getAdminFirestore()

    // 2. Aktif barkoda sahip siparişleri sorgula
    const snapshot = await db.collection('orders').get()

    const activeOrderIds: string[] = []

    snapshot.forEach((doc: any) => {
      const data = doc.data()
      const shipping = data.shipping || {}
      const barcode = shipping.barcode || ''
      const orderStatus = data.status || ''
      const shippingStatus = shipping.status || ''

      // Gerçek bir HepsiJET barkodu var mı?
      if (!barcode || /NUMUNE|SAMPLE|TEST/i.test(barcode) || barcode.startsWith('SIM-')) {
        return
      }

      // Kargo zaten teslim edilmiş ve archiveAt yazılmış mı?
      if (['cancelled', 'completed', 'delivered'].includes(orderStatus) && shippingStatus === 'delivered' && data.archiveAt) {
        return
      }

      // İptal edilmiş ve archiveAt yazılmış mı?
      if ((orderStatus === 'cancelled' || shippingStatus === 'cancelled') && data.archiveAt) {
        return
      }

      activeOrderIds.push(doc.id)
    })

    // 3. Çekirdek senkronizasyon fonksiyonunu çalıştır (arşivleme adımı dahil)
    const results = await syncOrderTrackingFromHepsiJet(activeOrderIds)

    const updatedCount = results.filter((r) => r.updated).length
    const deliveredCount = results.filter((r) => r.newShippingStatus === 'delivered').length
    const archivedCount = results.filter((r) => r.archived).length

    return NextResponse.json({
      success: true,
      message: `${results.length} sipariş sorgulandı/işlendi. (${updatedCount} güncellendi, ${deliveredCount} teslim edildi, ${archivedCount} arşivlendi).`,
      totalOrdersChecked: snapshot.size,
      activeOrdersCount: activeOrderIds.length,
      updatedCount,
      deliveredCount,
      archivedCount,
      results,
    })
  } catch (error: any) {
    console.error('HepsiJET cron takip ve arşivleme hatası:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Bilinmeyen senkronizasyon hatası',
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  return handleTrackingSync(request)
}

export async function POST(request: NextRequest) {
  return handleTrackingSync(request)
}
