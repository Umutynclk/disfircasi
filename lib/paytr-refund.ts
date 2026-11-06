/**
 * SONRAKAM.COM – PayTR İade (Refund) API Servisi
 *
 * PayTR resmî iade endpointi: https://www.paytr.com/odeme/iade
 *
 * Token Hesaplama:
 *   hashStr = merchant_id + merchant_oid + return_amount
 *   paytr_token = base64(hmac_sha256(hashStr + merchant_salt, merchant_key))
 *
 * POST parametreleri:
 *   merchant_id, merchant_oid, return_amount, paytr_token, (opsiyonel) reference_no
 *
 * Yanıt (JSON):
 *   { status: 'success' | 'error', err_no?: string, err_msg?: string }
 */

import crypto from 'crypto'
import { getPayTRConfig } from './paytr'

// ─── Tipler ─────────────────────────────────────────────

export interface PayTRRefundRequest {
  /** Orijinal sipariş numarası (merchant_oid) */
  merchantOid: string
  /** İade tutarı TL cinsinden (ör: 150.50). Kuruşa çevrilmeden gönderilir. */
  returnAmountTRY: number
  /** Opsiyonel referans numarası (PayTR durum sorgulama servisi) */
  referenceNo?: string
}

export interface PayTRRefundResponse {
  status: 'success' | 'error'
  errNo?: string
  errMsg?: string
  /** Ham API yanıtı */
  raw?: Record<string, unknown>
}

// ─── İade Token Hesaplama ───────────────────────────────

function generateRefundToken(
  merchantId: string,
  merchantOid: string,
  returnAmount: string,
  merchantKey: string,
  merchantSalt: string,
): string {
  const hashStr = `${merchantId}${merchantOid}${returnAmount}`
  return crypto
    .createHmac('sha256', merchantKey)
    .update(`${hashStr}${merchantSalt}`)
    .digest('base64')
}

// ─── PayTR İade API Çağrısı ─────────────────────────────

export async function requestPayTRRefund(
  params: PayTRRefundRequest,
): Promise<PayTRRefundResponse> {
  const config = getPayTRConfig()

  if (!config.merchantId || !config.merchantKey || !config.merchantSalt) {
    return {
      status: 'error',
      errMsg: 'PayTR mağaza anahtarları (PAYTR_MERCHANT_ID/KEY/SALT) yapılandırılmamış.',
    }
  }

  // ─── returnAmount format: noktayla ayrılmış, 2 ondalık ───
  const returnAmountStr = params.returnAmountTRY.toFixed(2)

  if (Number(returnAmountStr) <= 0) {
    return {
      status: 'error',
      errMsg: 'İade tutarı sıfır veya negatif olamaz.',
    }
  }

  // ─── PayTR güvenlik tokenı ───
  const paytrToken = generateRefundToken(
    config.merchantId,
    params.merchantOid,
    returnAmountStr,
    config.merchantKey,
    config.merchantSalt,
  )

  // ─── POST body ───
  const postData = new URLSearchParams()
  postData.append('merchant_id', config.merchantId)
  postData.append('merchant_oid', params.merchantOid)
  postData.append('return_amount', returnAmountStr)
  postData.append('paytr_token', paytrToken)

  if (params.referenceNo) {
    postData.append('reference_no', params.referenceNo.slice(0, 64))
  }

  // ─── AbortController ile Timeout koruması (15 sn) ───
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const response = await fetch('https://www.paytr.com/odeme/iade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: postData.toString(),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      return {
        status: 'error',
        errMsg: `PayTR iade API HTTP ${response.status} hatası döndü.`,
      }
    }

    const data = await response.json()

    if (data.status === 'success') {
      return { status: 'success', raw: data }
    }

    return {
      status: 'error',
      errNo: data.err_no || '',
      errMsg: data.err_msg || 'PayTR iade talebi reddedildi.',
      raw: data,
    }
  } catch (err: unknown) {
    clearTimeout(timeout)

    if (err instanceof Error && err.name === 'AbortError') {
      return {
        status: 'error',
        errMsg: 'PayTR iade API yanıt vermedi (timeout). Çift iade riski nedeniyle tekrar denenmedi.',
      }
    }

    return {
      status: 'error',
      errMsg: err instanceof Error ? err.message : 'PayTR iade isteğinde ağ hatası oluştu.',
    }
  }
}

// ─── İade Uygunluk Kontrolü (idempotency + tutar doğrulama) ────────────

export interface RefundEligibility {
  eligible: boolean
  reason?: string
  /** Sipariş toplamı (TRY) */
  orderTotalTRY?: number
  /** Daha önce iade edilmiş toplam tutar (TRY) */
  previouslyRefundedTRY?: number
  /** Bu iadede gönderilecek tutar (TRY) */
  refundableAmountTRY?: number
}

export function checkRefundEligibility(orderData: Record<string, any>): RefundEligibility {
  // Sipariş durumu kontrolü
  if (orderData.status !== 'cancelled') {
    return { eligible: false, reason: 'Yalnızca iptal edilmiş siparişlere iade yapılabilir.' }
  }

  // Ödeme durumu kontrolü
  const paymentStatus = orderData.paymentStatus
  if (paymentStatus !== 'PAID' && paymentStatus !== 'paid') {
    return { eligible: false, reason: 'Ödemesi alınmamış siparişlere iade yapılamaz.' }
  }

  // Zaten iade edilmiş mi?
  const refundStatus = orderData.refundStatus
  if (refundStatus === 'refunded') {
    return { eligible: false, reason: 'Bu sipariş için iade zaten tamamlanmıştır.' }
  }

  // İade işlemi devam ediyor mu? (idempotency – timeout koruması)
  if (refundStatus === 'processing_refund') {
    const lockTime = orderData.refundLockTimestamp || 0
    const fiveMinutes = 5 * 60 * 1000
    if (Date.now() - lockTime < fiveMinutes) {
      return { eligible: false, reason: 'Bu sipariş için iade işlemi şu anda devam ediyor. Lütfen bekleyiniz.' }
    }
    // 5 dakikayı geçmiş processing kilit: timeout olmuş, tekrar denemeye izin ver
  }

  // Toplam tutar kontrolü
  const orderTotal = Number(orderData.total || orderData.totalAmountTRY || 0)
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) {
    return { eligible: false, reason: 'Sipariş tutarı geçersiz veya sıfır.' }
  }

  // Daha önce iade edilmiş tutar (kısmi iadeler için)
  const previouslyRefunded = Number(orderData.refundedAmountTRY || 0)
  const refundable = Math.round((orderTotal - previouslyRefunded) * 100) / 100

  if (refundable <= 0) {
    return { eligible: false, reason: 'Siparişin tamamı daha önce iade edilmiştir.' }
  }

  // merchant_oid kontrolü
  const merchantOid = orderData.merchant_oid || orderData.orderNumber || orderData.id
  if (!merchantOid) {
    return { eligible: false, reason: 'Sipariş numarası (merchant_oid) bulunamadı.' }
  }

  return {
    eligible: true,
    orderTotalTRY: orderTotal,
    previouslyRefundedTRY: previouslyRefunded,
    refundableAmountTRY: refundable,
  }
}
