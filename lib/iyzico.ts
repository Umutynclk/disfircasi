import crypto from 'crypto'

export interface IyzicoConfig {
  apiKey: string
  secretKey: string
  baseUrl: string
}

export const getIyzicoConfig = (): IyzicoConfig => {
  return {
    apiKey: process.env.IYZICO_API_KEY || 'sandbox-apiKey-demo',
    secretKey: process.env.IYZICO_SECRET_KEY || 'sandbox-secretKey-demo',
    baseUrl: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com',
  }
}

export const isIyzicoConfigured = (): boolean => {
  const { apiKey, secretKey } = getIyzicoConfig()
  return (
    Boolean(apiKey) &&
    Boolean(secretKey) &&
    apiKey !== 'sandbox-apiKey-demo' &&
    secretKey !== 'sandbox-secretKey-demo' &&
    apiKey.trim().length > 5 &&
    secretKey.trim().length > 5
  )
}

// Generate Iyzico Authorization V2 Header (HMAC-SHA256)
export const generateIyzicoAuthV2 = (
  uri: string,
  apiKey: string,
  secretKey: string,
  randomString: string,
  requestBody: object
): string => {
  const bodyString = JSON.stringify(requestBody)
  const hashString = `apiKey:${apiKey}&randomKey:${randomString}&signature:${crypto
    .createHmac('sha256', secretKey)
    .update(randomString + uri + bodyString)
    .digest('hex')}`
  
  return `IYZWSv2 ${Buffer.from(hashString).toString('base64')}`
}

export interface IyzicoInitializeRequest {
  locale?: string
  conversationId: string
  price: string
  paidPrice: string
  currency: string
  basketId: string
  paymentGroup?: string
  callbackUrl: string
  enabledInstallments?: number[]
  buyer: {
    id: string
    name: string
    surname: string
    gsmNumber: string
    email: string
    identityNumber: string
    lastLoginDate?: string
    registrationDate?: string
    registrationAddress: string
    ip: string
    city: string
    country: string
    zipCode?: string
  }
  shippingAddress: {
    contactName: string
    city: string
    country: string
    address: string
    zipCode?: string
  }
  billingAddress: {
    contactName: string
    city: string
    country: string
    address: string
    zipCode?: string
  }
  basketItems: Array<{
    id: string
    name: string
    category1: string
    category2?: string
    itemType: 'PHYSICAL' | 'VIRTUAL'
    price: string
  }>
}

export interface IyzicoRetrieveRequest {
  locale?: string
  conversationId?: string
  token: string
}

export interface IyzicoRetrieveResponse {
  status: 'success' | 'failure'
  paymentStatus?: 'SUCCESS' | 'FAILURE' | 'INIT_THREEDS' | string
  paymentId?: string
  price?: number | string
  paidPrice?: number | string
  currency?: string
  basketId?: string
  conversationId?: string
  installment?: number
  fraudStatus?: number
  errorMessage?: string
  errorCode?: string
  cardType?: string
  cardAssociation?: string
  cardFamily?: string
  binNumber?: string
  lastFourDigits?: string
  itemTransactions?: any[]
  [key: string]: any
}

export async function initializeIyzicoCheckout(reqData: IyzicoInitializeRequest) {
  if (!isIyzicoConfigured()) {
    return {
      status: 'failure',
      errorMessage: 'iyzico API kimlik bilgileri yapılandırılmamış. Canlı/sandbox ortam değişkenleri (IYZICO_API_KEY, IYZICO_SECRET_KEY) gereklidir.',
    }
  }

  const config = getIyzicoConfig()
  const randomStr = Date.now().toString()
  const uri = '/payment/iyzipay/checkoutform/initialize/auth/ecom'

  try {
    const authHeader = generateIyzicoAuthV2(uri, config.apiKey, config.secretKey, randomStr, reqData)
    const response = await fetch(`${config.baseUrl}${uri}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'x-iyzi-rnd': randomStr,
        'x-iyzi-client-version': 'iyzipay-node-2.0.48',
      },
      body: JSON.stringify(reqData),
    })

    const data = await response.json()
    return data
  } catch (err: any) {
    console.error('Iyzico Initialize error:', err)
    return {
      status: 'failure',
      errorMessage: err?.message || 'İyzico bağlantı hatası',
    }
  }
}

/**
 * iyzico Checkout Form Sonuç Sorgulama (Retrieve Checkout Form Auth Detail)
 * Callback sonrası iyzico sunucusundan ödeme durumunu teyit eder.
 */
export async function retrieveIyzicoCheckoutForm(reqData: IyzicoRetrieveRequest): Promise<IyzicoRetrieveResponse> {
  if (!isIyzicoConfigured()) {
    return {
      status: 'failure',
      errorMessage: 'iyzico API kimlik bilgileri yapılandırılmamış.',
    }
  }

  const config = getIyzicoConfig()
  const randomStr = Date.now().toString()
  const uri = '/payment/iyzipay/checkoutform/auth/ecom/detail'
  const payload = {
    locale: reqData.locale || 'tr',
    conversationId: reqData.conversationId || '',
    token: reqData.token,
  }

  try {
    const authHeader = generateIyzicoAuthV2(uri, config.apiKey, config.secretKey, randomStr, payload)
    const response = await fetch(`${config.baseUrl}${uri}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
        'x-iyzi-rnd': randomStr,
        'x-iyzi-client-version': 'iyzipay-node-2.0.48',
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as IyzicoRetrieveResponse
    return data
  } catch (err: any) {
    console.error('Iyzico retrieveCheckoutForm error:', err)
    return {
      status: 'failure',
      errorMessage: err?.message || 'İyzico ödeme doğrulama bağlantı hatası',
    }
  }
}
