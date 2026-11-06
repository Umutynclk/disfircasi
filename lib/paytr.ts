import crypto from 'crypto'

export interface PayTRConfig {
  merchantId: string
  merchantKey: string
  merchantSalt: string
  testMode: '1' | '0'
  debugOn: '1' | '0'
  timeoutLimit: string
}

export interface PayTRBasketItem {
  name: string
  price: number
  quantity: number
}

export interface PayTRTokenRequest {
  merchantOid: string
  userIp: string
  email: string
  paymentAmount: number
  userName: string
  userAddress: string
  userPhone: string
  merchantOkUrl: string
  merchantFailUrl: string
  userBasket: PayTRBasketItem[]
  currency?: 'TL' | 'USD' | 'EUR' | 'GBP'
  noInstallment?: '0' | '1'
  maxInstallment?: string
  lang?: 'tr' | 'en'
}

export interface PayTRTokenResponse {
  status: 'success' | 'failed'
  token?: string
  reason?: string
}

export interface PayTRCallbackData {
  merchant_oid: string
  status: 'success' | 'failed'
  total_amount: string
  hash: string
  failed_reason_code?: string
  failed_reason_msg?: string
  payment_type?: string
  payment_amount?: string
  currency?: string
  test_mode?: string
}

export const getPayTRConfig = (): PayTRConfig => {
  return {
    merchantId: process.env.PAYTR_MERCHANT_ID || '',
    merchantKey: process.env.PAYTR_MERCHANT_KEY || '',
    merchantSalt: process.env.PAYTR_MERCHANT_SALT || '',
    testMode:
      process.env.PAYTR_TEST_MODE === '0' ? '0' : '1',
    debugOn:
      process.env.PAYTR_DEBUG_ON === '1' ? '1' : '0',
    timeoutLimit:
      process.env.PAYTR_TIMEOUT_LIMIT || '30',
  }
}

export function formatBasketForPayTR(
  items: PayTRBasketItem[],
): string {
  const basketArray = items.map((item) => [
    item.name.slice(0, 50),
    item.price.toFixed(2),
    item.quantity,
  ])

  return Buffer.from(
    JSON.stringify(basketArray),
  ).toString('base64')
}

export async function getPayTRToken(
  params: PayTRTokenRequest,
): Promise<PayTRTokenResponse> {
  const config = getPayTRConfig()

  if (
    !config.merchantId ||
    !config.merchantKey ||
    !config.merchantSalt
  ) {
    console.error(
      '❌ PayTR Merchant bilgileri eksik.',
    )

    return {
      status: 'failed',
      reason:
        'PayTR mağaza anahtarları yapılandırılmamış.',
    }
  }

  const userBasketBase64 =
    formatBasketForPayTR(params.userBasket)

  const noInstallment =
    params.noInstallment || '0'

  const maxInstallment =
    params.maxInstallment || '0'

  const currency =
    params.currency || 'TL'

  const testMode = config.testMode

  const hashStr =
    `${config.merchantId}` +
    `${params.userIp}` +
    `${params.merchantOid}` +
    `${params.email}` +
    `${params.paymentAmount}` +
    `${userBasketBase64}` +
    `${noInstallment}` +
    `${maxInstallment}` +
    `${currency}` +
    `${testMode}`

  const paytrToken = crypto
    .createHmac(
      'sha256',
      config.merchantKey,
    )
    .update(
      `${hashStr}${config.merchantSalt}`,
    )
    .digest('base64')

  const postData = new URLSearchParams()

  postData.append(
    'merchant_id',
    config.merchantId,
  )

  postData.append(
    'user_ip',
    params.userIp,
  )

  postData.append(
    'merchant_oid',
    params.merchantOid,
  )

  postData.append(
    'email',
    params.email,
  )

  postData.append(
    'payment_amount',
    params.paymentAmount.toString(),
  )

  postData.append(
    'paytr_token',
    paytrToken,
  )

  postData.append(
    'user_basket',
    userBasketBase64,
  )

  postData.append(
    'debug_on',
    config.debugOn,
  )

  postData.append(
    'no_installment',
    noInstallment,
  )

  postData.append(
    'max_installment',
    maxInstallment,
  )

  postData.append(
    'user_name',
    params.userName,
  )

  postData.append(
    'user_address',
    params.userAddress,
  )

  postData.append(
    'user_phone',
    params.userPhone,
  )

  postData.append(
    'merchant_ok_url',
    params.merchantOkUrl,
  )

  postData.append(
    'merchant_fail_url',
    params.merchantFailUrl,
  )

  postData.append(
    'timeout_limit',
    config.timeoutLimit,
  )

  postData.append(
    'currency',
    currency,
  )

  postData.append(
    'test_mode',
    testMode,
  )

  if (params.lang) {
    postData.append(
      'lang',
      params.lang,
    )
  }

  try {
    const response = await fetch(
      'https://www.paytr.com/odeme/api/get-token',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
        body: postData.toString(),
      },
    )

    if (!response.ok) {
      return {
        status: 'failed',
        reason:
          `PayTR HTTP ${response.status}`,
      }
    }

    const data = await response.json()

    if (
      data.status === 'success' &&
      data.token
    ) {
      return {
        status: 'success',
        token: data.token,
      }
    }

    console.error(
      '❌ PayTR Get-Token API Hata Yanıtı:',
      data.reason,
    )

    return {
      status: 'failed',
      reason:
        data.reason ||
        'PayTR ödeme tokenı alınamadı.',
    }
  } catch (error: unknown) {
    console.error(
      '❌ PayTR get-token fetch hatası:',
      error,
    )

    return {
      status: 'failed',
      reason:
        error instanceof Error
          ? error.message
          : 'PayTR sunucusuna bağlanırken ağ hatası oluştu.',
    }
  }
}

export function verifyPayTRCallbackHash(
  callbackData: PayTRCallbackData,
): boolean {
  const config = getPayTRConfig()

  if (
    !config.merchantKey ||
    !config.merchantSalt
  ) {
    console.error(
      '❌ PayTR Callback: Merchant Key/Salt eksik.',
    )

    return false
  }

  if (
    !callbackData.merchant_oid ||
    !callbackData.status ||
    !callbackData.total_amount ||
    !callbackData.hash
  ) {
    return false
  }

  const hashStr =
    `${callbackData.merchant_oid}` +
    `${config.merchantSalt}` +
    `${callbackData.status}` +
    `${callbackData.total_amount}`

  const calculatedHash = crypto
    .createHmac(
      'sha256',
      config.merchantKey,
    )
    .update(hashStr)
    .digest('base64')

  const expected = Buffer.from(
    calculatedHash,
    'utf8',
  )

  const received = Buffer.from(
    callbackData.hash,
    'utf8',
  )

  if (
    expected.length !== received.length
  ) {
    return false
  }

  return crypto.timingSafeEqual(
    expected,
    received,
  )
}