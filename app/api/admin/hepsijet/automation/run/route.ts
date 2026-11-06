import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { runHepsiJetDailyAutomation } from '@/lib/hepsijet/automation'

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const result = await runHepsiJetDailyAutomation({
      triggeredBy: auth.email || 'admin',
      forceManual: true, // Admin panelinden manuel test her zaman çalıştırılabilir
    })

    return NextResponse.json({
      success: true,
      summary: result,
      items: result.items,
    })
  } catch (error: any) {
    console.error('Automation run error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Otomasyon çalıştırılırken bir hata oluştu.' },
      { status: 500 }
    )
  }
}
