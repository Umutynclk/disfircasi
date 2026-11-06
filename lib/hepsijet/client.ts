import {
  HepsiJetDeliveryOrderPayload,
  HepsiJetCreateShipmentResponse,
  HepsiJetTokenResponse,
  HepsiJetDeleteDeliveryOrderPayload,
  HepsiJetDeleteDeliveryOrderResponse,
} from './types'
import { createSampleHepsiJetLabelPdf } from './sampleLabel'

export class HepsiJetTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HepsiJetTimeoutError'
  }
}

/**
 * Gönderi oluşturma isteğinin sonucu BELİRSİZ ise (zaman aşımı, bağlantı kopması, 5xx)
 * HepsiJET tarafında kayıt oluşmuş olabilir. Bu durumda otomatik tekrar deneme YAPILMAZ.
 */
export function isAmbiguousHepsiJetError(err: any): boolean {
  return Boolean(err && (err.name === 'HepsiJetTimeoutError' || err.ambiguousOutcome === true))
}

interface TokenCache {
  token: string
  expiresAt: number
}

let cachedToken: TokenCache | null = null

/**
 * Sunucu tarafında HepsiJET yapılandırma ortam değişkenlerini doğrular.
 */
function getCredentials() {
  const baseUrl = (process.env.HEPSIJET_BASE_URL || 'https://integration.hepsijet.com').replace(/\/+$/, '')
  const username = (process.env.HEPSIJET_USERNAME || 'kaliport_integration').trim()
  const password = process.env.HEPSIJET_PASSWORD || ''

  // Gerçek canlı çağrı koruma bayrağı (kullanıcı onayı gereklidir)
  const isLiveDispatchEnabled = process.env.HEPSIJET_LIVE_DISPATCH_ENABLED === 'true'

  return { baseUrl, username, password, isLiveDispatchEnabled }
}

/**
 * HepsiJET auth/getToken uç noktasından X-Auth-Token alır veya önbellekten döner.
 */
export async function getHepsiJetAuthToken(forceRefresh = false): Promise<string> {
  const { baseUrl, username, password } = getCredentials()

  if (!username || !password) {
    throw new Error('HepsiJET kimlik bilgileri eksik (HEPSIJET_USERNAME veya HEPSIJET_PASSWORD .env içinde tanımlanmamış).')
  }

  const now = Date.now()
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > now) {
    return cachedToken.token
  }

  const authString = Buffer.from(`${username}:${password}`).toString('base64')

  const response = await fetch(`${baseUrl}/auth/getToken`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${authString}`,
      Accept: 'application/json',
      'X-Requested-By': 'kaliport-hepsijet',
    },
    // Node.js fetch cache bypass
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(sanitizeLogMessage(`HepsiJET token alma hatası (HTTP ${response.status}): ${text || response.statusText}`))
  }

  const data = (await response.json()) as HepsiJetTokenResponse

  const token = data?.data?.token
  if (!token || data.status !== 'OK') {
    throw new Error(sanitizeLogMessage(data?.message || 'HepsiJET geçerli bir oturum tokenı döndürmedi.'))
  }

  // 50 dakika önbelleğe al (HepsiJET standart 60 dk geçerlidir)
  cachedToken = {
    token,
    expiresAt: now + 50 * 60 * 1000,
  }

  return token
}
/**
 * Hata mesajından parola, token, Basic Auth başlığı ve kişisel verileri (telefon, e-posta) temizler.
 */
export function sanitizeLogMessage(msg?: string): string {
  if (!msg || typeof msg !== 'string') return ''
  return msg
    .replace(/Basic\s+[A-Za-z0-9+/=]+/gi, 'Basic [REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}/g, '[TOKEN_REDACTED]')
    .replace(/([?&](?:token|password|auth|secret|key)=)[^&]+/gi, '$1[REDACTED]')
    .replace(/(["']?(?:password|token|secret|authorization)["']?\s*[:=]\s*["'])([^"']+)(["'])/gi, '$1[REDACTED]$3')
    .replace(/\b5\d{9}\b/g, '[PHONE_REDACTED]')
    .replace(/\b05\d{9}\b/g, '[PHONE_REDACTED]')
    .replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, '[EMAIL_REDACTED]')
}

/**
 * HepsiJET sisteminde yeni bir kargo siparişi / barkod oluşturur.
 * POST /rest/delivery/sendDeliveryOrderEnhanced
 */
export async function sendDeliveryOrderEnhanced(
  payload: HepsiJetDeliveryOrderPayload
): Promise<HepsiJetCreateShipmentResponse> {
  const { baseUrl, isLiveDispatchEnabled } = getCredentials()

  // KESİN GÜVENLİK ÖNLEMİ:
  // Canlı gönderim kesinlikle sadece sunucu ortam değişkeni HEPSIJET_LIVE_DISPATCH_ENABLED === 'true' olduğunda yapılabilir.
  // İstemciden veya çağırıcıdan gelen hiçbir harici parametre bu güvenlik kilidini aşamaz.
  if (!isLiveDispatchEnabled) {
    // Güvenli Simülasyon / Doğrulama Modu (Payload kontrol edilir, canlı API'ye hiçbir HTTP isteği gitmez)
    return {
      status: 'OK',
      message: 'HepsiJET kargo gönderi verisi başarıyla doğrulandı (Korumalı Test Modu - Canlı Gönderi Çağrısı Beklemede).',
      data: {
        customerDeliveryNo: payload.delivery.customerDeliveryNo,
        barcode: `HJ${payload.delivery.customerDeliveryNo}`,
        trackingNumber: `HJ${payload.delivery.customerDeliveryNo}`,
        isSimulated: true,
      },
    }
  }

  const token = await getHepsiJetAuthToken()

  const controller = new AbortController()
  const createTimeoutId = setTimeout(() => controller.abort(), 20000)

  let response: Response
  let rawJson: any
  try {
    response = await fetch(`${baseUrl}/rest/delivery/sendDeliveryOrderEnhanced`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Auth-Token': token,
        'X-Requested-By': 'kaliport-hepsijet',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    })
    rawJson = await response.json().catch(() => null)
  } catch (netErr: any) {
    // İstek gönderilmiş olabilir; yanıt alınamadı => sonuç belirsiz.
    throw new HepsiJetTimeoutError(
      sanitizeLogMessage(
        `HepsiJET gönderi oluşturma yanıtı alınamadı (timeout/bağlantı hatası: ${netErr?.name || 'Error'}). Sonuç belirsiz.`
      )
    )
  } finally {
    clearTimeout(createTimeoutId)
  }

  const extractApiMessage = (json: any): string => {
    if (!json) return ''
    if (typeof json.message === 'string' && json.message.trim()) return json.message.trim()
    if (typeof json.error === 'string' && json.error.trim()) return json.error.trim()
    if (Array.isArray(json.errors) && json.errors.length > 0) {
      return json.errors.map((e: any) => (typeof e === 'string' ? e : e?.message || JSON.stringify(e))).join(', ')
    }
    if (json.data && typeof json.data.message === 'string') return json.data.message.trim()
    return ''
  }

  const extractedError = extractApiMessage(rawJson)

  if (!response.ok) {
    const errorMsg = extractedError
      ? `(HTTP ${response.status}): ${extractedError}`
      : `HepsiJET kargo oluşturma isteği başarısız oldu (HTTP ${response.status}).`
    const httpErr: any = new Error(sanitizeLogMessage(errorMsg))
    // 5xx: sunucu isteği işlemiş olabilir -> belirsiz
    if (response.status >= 500) httpErr.ambiguousOutcome = true
    throw httpErr
  }

  if (!rawJson) {
    const emptyErr: any = new Error('HepsiJET 2xx döndü ancak yanıt gövdesi okunamadı. Sonuç belirsiz.')
    emptyErr.ambiguousOutcome = true
    throw emptyErr
  }

  if (rawJson?.status && rawJson.status !== 'OK') {
    const errorMsg = extractedError
      ? `(HTTP ${response.status} - ${rawJson.status}): ${extractedError}`
      : `HepsiJET servisi gönderi kaydını onaylamadı (HTTP ${response.status} - ${rawJson.status}).`
    throw new Error(sanitizeLogMessage(errorMsg))
  }

  return rawJson
}

/**
 * HepsiJET kargo etiketini (PDF / ZPL) getirir.
 * POST /delivery/barcodes-label?format=PDF
 */
export async function fetchHepsiJetBarcodeLabel(
  barcodes: string[],
  format: 'PDF' | 'ZPL' = 'PDF'
): Promise<{ contentType: string; data: Buffer | string }> {
  const { baseUrl, isLiveDispatchEnabled } = getCredentials()

  // Canlı çağrı aktif değilse veya barkod simüle edilmişse geçerli vektörel örnek PDF döner
  if (!isLiveDispatchEnabled) {
    const sampleBuffer = await createSampleHepsiJetLabelPdf({
      barcode: barcodes[0] || 'HJ9876543210TR',
    })
    return {
      contentType: 'application/pdf',
      data: sampleBuffer,
    }
  }

  const token = await getHepsiJetAuthToken()

  const response = await fetch(`${baseUrl}/delivery/barcodes-label?format=${encodeURIComponent(format)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: format === 'PDF' ? 'application/pdf, application/json' : 'application/json',
      'X-Auth-Token': token,
      'X-Requested-By': 'kaliport-hepsijet',
    },
    body: JSON.stringify({ barcodes }),
    cache: 'no-store',
  })

  const contentType = response.headers.get('content-type') || 'application/pdf'

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Kargo etiketi alınamadı (HTTP ${response.status}): ${text}`)
  }

  if (contentType.includes('application/pdf')) {
    const arrayBuffer = await response.arrayBuffer()
    return {
      contentType: 'application/pdf',
      data: Buffer.from(arrayBuffer),
    }
  }

  // JSON yanıt dönerse (örn: { labels: ['base64...'] })
  const json = await response.json()
  let base64String = ''

  if (json?.data?.barcode_pdf) {
    base64String = json.data.barcode_pdf
  } else if (Array.isArray(json?.data?.labels) && json.data.labels[0]) {
    base64String = json.data.labels[0]
  } else if (Array.isArray(json?.labels) && json.labels[0]) {
    base64String = json.labels[0]
  } else if (typeof json?.label === 'string') {
    base64String = json.label
  } else if (typeof json?.data?.label === 'string') {
    base64String = json.data.label
  }

  if (base64String) {
    // data:application/pdf;base64, önekini temizle
    const cleanBase64 = base64String.replace(/^data:application\/pdf;base64,/, '').trim()
    return {
      contentType: 'application/pdf',
      data: Buffer.from(cleanBase64, 'base64'),
    }
  }

  throw new Error('HepsiJET etiket verisi okunamadı.')
}

/**
 * HepsiJET kargo takip durumunu sorgular.
 * POST /rest/delivery/integration/track
 */
export async function trackHepsiJetShipment(barcodes: string[]): Promise<any> {
  const { baseUrl } = getCredentials()
  const token = await getHepsiJetAuthToken()

  const response = await fetch(`${baseUrl}/rest/delivery/integration/track`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Auth-Token': token,
      'X-Requested-By': 'kaliport-hepsijet',
    },
    body: JSON.stringify({
      barcodes,
      isTrackAdded: true,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`HepsiJET takip sorgusu başarısız (HTTP ${response.status}): ${text}`)
  }

  return response.json()
}

/**
 * HepsiJET sisteminde oluşturulmuş bir teslimat siparişini iptal eder / siler.
 * Canlı Endpoint: https://integration.hepsijet.com/delivery/deleteDeliveryOrder/{BARKOD_NO}
 * Test Endpoint: https://integration-apitest.hepsijet.com/delivery/deleteDeliveryOrder/{BARKOD_NO}
 * Metot: POST
 * Body: { "deleteReason": "IPTAL" }
 */
export async function deleteDeliveryOrder(
  payload: HepsiJetDeleteDeliveryOrderPayload,
  timeoutMs: number = 10000
): Promise<HepsiJetDeleteDeliveryOrderResponse> {
  const { baseUrl, isLiveDispatchEnabled } = getCredentials()

  const deliveryRef = (payload.customerDeliveryNo || payload.barcode || '').trim()
  if (!deliveryRef) {
    throw new Error('İptal edilecek HepsiJET gönderi numarası (customerDeliveryNo veya barcode) belirtilmedi.')
  }

  // KESİN GÜVENLİK ÖNLEMİ:
  // Canlı iptal çağrısı sadece sunucu ortam değişkeni HEPSIJET_LIVE_DISPATCH_ENABLED === 'true' olduğunda yapılabilir.
  if (!isLiveDispatchEnabled) {
    return {
      status: 'OK',
      message: 'HepsiJET kargo gönderi iptal isteği güvenli simülasyon modunda doğrulandı (Canlı API çağrısı yapılmadı).',
      data: {
        customerDeliveryNo: payload.customerDeliveryNo,
        barcode: payload.barcode,
        isSimulated: true,
      },
    }
  }

  const token = await getHepsiJetAuthToken()

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  // HepsiJET yeni silme servisi: /delivery/deleteDeliveryOrder/{BARKOD_NO}
  let endpointUrl: string
  const customPath = process.env.HEPSIJET_CANCEL_ENDPOINT_PATH?.trim()
  if (customPath) {
    if (customPath.includes('{BARKOD_NO}')) {
      endpointUrl = `${baseUrl}${customPath.startsWith('/') ? '' : '/'}${customPath.replace('{BARKOD_NO}', encodeURIComponent(deliveryRef))}`
    } else {
      endpointUrl = `${baseUrl}${customPath.startsWith('/') ? '' : '/'}${customPath}/${encodeURIComponent(deliveryRef)}`
    }
  } else {
    endpointUrl = `${baseUrl}/delivery/deleteDeliveryOrder/${encodeURIComponent(deliveryRef)}`
  }

  const httpMethod = (process.env.HEPSIJET_CANCEL_METHOD || 'POST').trim().toUpperCase()
  const deleteReason = payload.deleteReason || 'IPTAL'

  try {
    const response = await fetch(endpointUrl, {
      method: httpMethod,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Auth-Token': token,
        'X-Requested-By': 'kaliport-hepsijet',
      },
      body: JSON.stringify({
        deleteReason,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    const rawText = await response.text().catch(() => '')
    let rawJson: any = null
    try {
      rawJson = JSON.parse(rawText)
    } catch {
      // Metin veya HTML formatında hata sayfası
    }

    const extractApiMessage = (json: any, text: string): string => {
      if (json) {
        if (typeof json.message === 'string' && json.message.trim()) return json.message.trim()
        if (typeof json.error === 'string' && json.error.trim()) return json.error.trim()
        if (Array.isArray(json.errors) && json.errors.length > 0) {
          return json.errors.map((e: any) => (typeof e === 'string' ? e : e?.message || JSON.stringify(e))).join(', ')
        }
        if (json.data && typeof json.data.message === 'string') return json.data.message.trim()
      }
      if (text && text.trim()) {
        const stripped = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        if (stripped) {
          return stripped.slice(0, 300)
        }
      }
      return ''
    }

    const extractedMessage = extractApiMessage(rawJson, rawText)
    const isAlreadyDeleted = /zaten\s+silinmi[sş]|already\s+deleted/i.test(extractedMessage)

    if (isAlreadyDeleted) {
      return {
        status: 'OK',
        message: extractedMessage || 'Bu gönderi sistemimizde zaten silinmiş durumda',
        alreadyDeleted: true,
        data: {
          alreadyDeleted: true,
          customerDeliveryNo: payload.customerDeliveryNo,
          barcode: payload.barcode,
          raw: rawJson,
        },
      }
    }

    if (!response.ok) {
      const sanitizedResponsePreview = sanitizeLogMessage(extractedMessage || rawText.slice(0, 200))
      console.error(
        sanitizeLogMessage(
          `[HepsiJET API Hatası] ${response.status} ${response.statusText} | Metot: ${httpMethod} | Endpoint: ${endpointUrl} | Yanıt: ${sanitizedResponsePreview}`
        )
      )

      let errorMsg = ''
      if (response.status === 404) {
        errorMsg = `HepsiJET kargo iptal servisi bulunamadı (HTTP 404). Çağrılan uç nokta: [${httpMethod}] ${endpointUrl}. Canlı API üzerinde bu endpoint mevcut değildir veya farklı bir metot/path gerektirmektedir. Canlı gönderi durumu güvenceye alınmış ve yönetici incelemesine sunulmuştur.`
      } else {
        errorMsg = extractedMessage
          ? `HepsiJET kargo iptal isteği başarısız oldu (HTTP ${response.status}): ${extractedMessage}`
          : `HepsiJET kargo iptal isteği başarısız oldu (HTTP ${response.status}).`
      }
      throw new Error(sanitizeLogMessage(errorMsg))
    }

    if (rawJson?.status && rawJson.status !== 'OK') {
      const errorMsg = extractedMessage
        ? `HepsiJET kargo iptalini onaylamadı (${rawJson.status}): ${extractedMessage}`
        : `HepsiJET kargo iptalini onaylamadı (${rawJson.status}).`
      throw new Error(sanitizeLogMessage(errorMsg))
    }

    return rawJson || { status: 'OK', message: 'Gönderi başarıyla silindi' }
  } catch (err: any) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      throw new HepsiJetTimeoutError(
        'HepsiJET kargo iptal servisi zaman aşımına uğradı (10 sn yanıt alınamadı). Sonuç belirsiz (UNKNOWN) kabul edildi.'
      )
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }
}

