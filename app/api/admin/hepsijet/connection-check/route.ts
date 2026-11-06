import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'

/**
 * HepsiJET Canlı API Bağlantı Kontrolü
 *
 * Sadece /auth/getToken endpoint'ini çağırarak API bağlantısını ve kimlik bilgilerini doğrular.
 * - Gönderi oluşturma endpoint'i (sendDeliveryOrderEnhanced) ÇAĞRILMAZ.
 * - Kullanıcı adı, parola, Basic Auth başlığı ve token değeri loglanmaz veya API yanıtında gösterilmez.
 * - HEPSIJET_LIVE_DISPATCH_ENABLED değerine dokunmaz.
 */
export async function POST(req: NextRequest) {
  // 1. Admin yetkilendirmesi
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Yetkisiz erişim.' },
      { status: 401 }
    )
  }

  // 2. Ortam değişkenlerinin varlık kontrolü (değerleri göstermeden)
  const baseUrl = (process.env.HEPSIJET_BASE_URL || 'https://integration.hepsijet.com').replace(/\/+$/, '')
  const username = (process.env.HEPSIJET_USERNAME || 'kaliport_integration').trim()
  const hasUsername = Boolean(username)
  const hasPassword = Boolean(process.env.HEPSIJET_PASSWORD?.trim())
  const isLiveDispatchEnabled = process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true'

  if (!hasUsername || !hasPassword) {
    return NextResponse.json({
      success: false,
      checks: {
        baseUrl,
        hasUsername,
        hasPassword,
        isLiveDispatchEnabled,
        tokenAcquired: false,
      },
      error: 'HEPSIJET_PASSWORD ortam değişkeni/gizli anahtarı tanımlanmamış veya boş.',
    })
  }

  // 3. Token alma denemesi — sadece /auth/getToken çağrılır
  try {
    const password = process.env.HEPSIJET_PASSWORD!.trim()
    const authString = Buffer.from(`${username}:${password}`).toString('base64')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000) // 15 saniye zaman aşımı

    const response = await fetch(`${baseUrl}/auth/getToken`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${authString}`,
        Accept: 'application/json',
        'X-Requested-By': 'kaliport-hepsijet-connection-check',
      },
      cache: 'no-store',
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      // Hassas bilgi içerebilecek yanıt gövdesini kırparak sadece ilk 200 karakteri al
      const rawText = await response.text().catch(() => '')
      const safeErrorSnippet = rawText.length > 200 ? rawText.substring(0, 200) + '…' : rawText

      return NextResponse.json({
        success: false,
        checks: {
          baseUrl,
          hasUsername: true,
          hasPassword: true,
          isLiveDispatchEnabled,
          tokenAcquired: false,
          httpStatus: response.status,
          httpStatusText: response.statusText,
        },
        error: `HepsiJET token isteği başarısız (HTTP ${response.status} ${response.statusText}).`,
        detail: safeErrorSnippet || undefined,
      })
    }

    const data = await response.json()

    const hasToken = Boolean(data?.data?.token)
    const apiStatus = data?.status || 'UNKNOWN'

    if (!hasToken || apiStatus !== 'OK') {
      return NextResponse.json({
        success: false,
        checks: {
          baseUrl,
          hasUsername: true,
          hasPassword: true,
          isLiveDispatchEnabled,
          tokenAcquired: false,
          apiStatus,
        },
        error: data?.message || 'HepsiJET API geçerli bir token döndürmedi.',
      })
    }

    // 4. Başarılı — token değerini KESİNLİKLE döndürmüyoruz
    return NextResponse.json({
      success: true,
      checks: {
        baseUrl,
        hasUsername: true,
        hasPassword: true,
        isLiveDispatchEnabled,
        tokenAcquired: true,
        apiStatus: 'OK',
        tokenExpiresIn: data?.data?.expireDate || null,
      },
      message: 'HepsiJET API bağlantısı ve kimlik doğrulaması başarılı.',
    })
  } catch (err: any) {
    // Zaman aşımı veya ağ hatası
    const isTimeout = err?.name === 'AbortError'
    return NextResponse.json({
      success: false,
      checks: {
        baseUrl,
        hasUsername: true,
        hasPassword: true,
        isLiveDispatchEnabled,
        tokenAcquired: false,
      },
      error: isTimeout
        ? `HepsiJET API bağlantısı zaman aşımına uğradı (15 saniye). API adresi: ${baseUrl}`
        : `HepsiJET API bağlantı hatası: ${err?.message || 'Bilinmeyen hata'}`,
    })
  }
}
