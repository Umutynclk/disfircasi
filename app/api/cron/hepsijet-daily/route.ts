import { NextRequest, NextResponse } from 'next/server'

/**
 * Güvenli Cron Çalıştırıcı Uç Noktası (Arşiv / Bilgilendirme)
 *
 * GÜNCELLEME (Gereksinim 4):
 * Günlük belirli saatte çalışan toplu etiket cron'u devre dışı bırakılmıştır.
 * Bunun yerine sipariş ödendiği anda (PayTR webhook veya Havale admin onayı)
 * anlık otomatik HepsiJET gönderisi oluşturulmakta ve yazdırma kuyruğuna aktarılmaktadır.
 */
async function handleCron(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || cronSecret.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: 'Sunucu tarafında CRON_SECRET yapılandırması eksik.' },
      { status: 500 }
    )
  }

  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization') || ''
  const expectedAuth = `Bearer ${cronSecret.trim()}`

  if (authHeader !== expectedAuth) {
    return NextResponse.json(
      { success: false, error: 'Yetkisiz erişim (Geçersiz veya eksik Authorization Bearer başlığı).' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    success: true,
    status: 'retired',
    message: 'Günlük toplu etiket zamanlama görevi devre dışı bırakılmıştır. KALIPORT sistemi anlık sipariş bazlı otomatik gönderi ve yazdırma moduna geçirilmiştir.',
    instantMode: true,
  })
}

export async function GET(req: NextRequest) {
  return handleCron(req)
}

export async function POST(req: NextRequest) {
  return handleCron(req)
}
