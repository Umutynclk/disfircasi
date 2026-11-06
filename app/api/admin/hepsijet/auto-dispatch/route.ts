import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { processOrderAutoDispatchAndPrint } from '@/lib/hepsijet/autoDispatch'
import { getHepsiJetSettingsServer } from '@/lib/hepsijet/settings'

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { orderId, force } = body

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Sipariş ID (orderId) zorunludur.' }, { status: 400 })
    }

    const result = await processOrderAutoDispatchAndPrint(orderId, {
      triggeredBy: 'admin_manual_trigger',
      force: Boolean(force),
      bypassPause: true,
    })

    return NextResponse.json({
      success: result.success,
      status: result.status,
      barcode: result.barcode,
      trackingNumber: result.trackingNumber,
      printJobId: result.printJobId,
      message: result.message,
      error: result.error,
    })
  } catch (err: any) {
    console.error('Admin auto-dispatch error:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'İşlem yürütülemedi.' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const settings = await getHepsiJetSettingsServer()
    const isPaused = (settings as any).autoDispatchPaused === true

    return NextResponse.json({
      success: true,
      autoDispatchPaused: isPaused,
      mode: settings.mode,
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const { paused } = body

    if (typeof paused !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Geçersiz parametre (paused boolean bekleniyor).' }, { status: 400 })
    }

    const db = getAdminFirestore()
    await db.collection('settings').doc('hepsijet').set(
      {
        autoDispatchPaused: paused,
        autoDispatchPausedAt: paused ? new Date().toISOString() : null,
        autoDispatchPausedBy: 'admin',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )

    return NextResponse.json({
      success: true,
      autoDispatchPaused: paused,
      message: paused
        ? 'Otomatik HepsiJET gönderi oluşturma ve yazdırma geçici olarak duraklatıldı.'
        : 'Otomatik HepsiJET gönderi oluşturma ve yazdırma yeniden aktif edildi.',
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 })
  }
}
