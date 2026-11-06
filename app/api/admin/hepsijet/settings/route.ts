import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { getHepsiJetSettingsServer, saveHepsiJetSettingsServer } from '@/lib/hepsijet/settings'
import { HepsiJetSettings } from '@/lib/hepsijet/types'

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const settings = await getHepsiJetSettingsServer()
    return NextResponse.json({
      success: true,
      settings,
      hasEnvCredentials: Boolean(process.env.HEPSIJET_USERNAME && process.env.HEPSIJET_PASSWORD),
      isLiveDispatchEnabled: process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true',
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Ayarlar alınırken hata oluştu.' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as Partial<HepsiJetSettings>

    // Zorunlu alan doğrulamaları
    if (!body.companyName?.trim()) {
      return NextResponse.json({ success: false, error: 'Firma adı boş bırakılamaz.' }, { status: 400 })
    }
    if (!body.abbreviationCode?.trim()) {
      return NextResponse.json({ success: false, error: 'Firma kısaltma kodu (örn: KLP) zorunludur.' }, { status: 400 })
    }
    if (!body.senderCity?.trim()) {
      return NextResponse.json({ success: false, error: 'Gönderici şehir (Konya) zorunludur.' }, { status: 400 })
    }
    if (!body.senderTown?.trim()) {
      return NextResponse.json({ success: false, error: 'Gönderici ilçe zorunludur.' }, { status: 400 })
    }
    if (!body.senderAddress?.trim()) {
      return NextResponse.json({ success: false, error: 'Açık çıkış deposu adresi zorunludur.' }, { status: 400 })
    }

    const saved = await saveHepsiJetSettingsServer(body, auth.email)

    return NextResponse.json({
      success: true,
      message: 'HepsiJET entegrasyon ayarları başarıyla kaydedildi.',
      settings: saved,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Ayarlar kaydedilirken hata oluştu.' },
      { status: 500 }
    )
  }
}
