import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import {
  getHepsiJetAutomationSettingsServer,
  saveHepsiJetAutomationSettingsServer,
  validateDailyRunTime,
} from '@/lib/hepsijet/settings'
import { HepsiJetAutomationSettings } from '@/lib/hepsijet/types'

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const settings = await getHepsiJetAutomationSettingsServer()
    return NextResponse.json({
      success: true,
      settings,
      isLiveDispatchEnabled: process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true',
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Otomasyon ayarları alınamadı.' },
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
    const body = (await req.json()) as Partial<HepsiJetAutomationSettings>

    // Saat doğrulaması (HH:mm)
    if (body.dailyRunTime) {
      const timeVal = validateDailyRunTime(body.dailyRunTime)
      if (!timeVal.isValid) {
        return NextResponse.json({ success: false, error: timeVal.error }, { status: 400 })
      }
    }

    // Limit doğrulaması
    if (body.maxBatchSize !== undefined) {
      const size = Number(body.maxBatchSize)
      if (isNaN(size) || size < 1 || size > 200) {
        return NextResponse.json(
          { success: false, error: 'Bir çalıştırmada işlenecek azami sipariş sayısı 1 ile 200 arasında olmalıdır.' },
          { status: 400 }
        )
      }
    }

    const saved = await saveHepsiJetAutomationSettingsServer(body, auth.email)

    return NextResponse.json({
      success: true,
      message: 'HepsiJET otomasyon ayarları başarıyla güncellendi.',
      settings: saved,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Otomasyon ayarları kaydedilirken hata oluştu.' },
      { status: 500 }
    )
  }
}
