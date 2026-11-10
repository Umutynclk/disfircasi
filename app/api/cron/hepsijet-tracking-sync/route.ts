import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { syncOrderTrackingFromHepsiJet } from '@/lib/hepsijet/tracking'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/hepsijet-tracking-sync
 *
 * Periyodik HepsiJET kargo takip senkronizasyonu.
 * Henüz teslim edilmemiş veya iptal edilmemiş, aktif HepsiJET barkodu olan
 * tüm siparişlerin durumunu sorgular ve Firestore'u günceller.
 */
export async function GET(request: NextRequest) {
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

      // Kargo zaten teslim edilmiş ve durumu da güncellenmiş mi?
      if (['cancelled', 'completed', 'delivered'].includes(orderStatus) && shippingStatus === 'delivered') {
        return
      }

      // İptal edilmiş siparişlere dokunma
      if (orderStatus === 'cancelled' || shippingStatus === 'cancelled') {
        return
      }

      activeOrderIds.push(doc.id)
    })

    if (activeOrderIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Senkronize edilecek aktif kargo bulunamadı.',
        totalChecked: snapshot.size,
        activeOrdersCount: 0,
        results: [],
      })
    }

    // 3. Çekirdek senkronizasyon fonksiyonunu çalıştır
    const results = await syncOrderTrackingFromHepsiJet(activeOrderIds)

    const updatedCount = results.filter((r) => r.updated).length
    const deliveredCount = results.filter((r) => r.newShippingStatus === 'delivered').length

    return NextResponse.json({
      success: true,
      message: `${results.length} siparişten ${updatedCount} tanesi güncellendi (${deliveredCount} teslim edildi).`,
      totalChecked: snapshot.size,
      activeOrdersCount: activeOrderIds.length,
      updatedCount,
      deliveredCount,
      results,
    })
  } catch (error: any) {
    console.error('HepsiJET cron takip hatası:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Bilinmeyen senkronizasyon hatası',
      },
      { status: 500 }
    )
  }
}
