import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
  getPayTRToken,
  PayTRBasketItem,
} from '@/lib/paytr'
import { getAdminFirestore, getAdminAuth } from '@/lib/firebase/admin'
import { validateTCKimlik, validateVergiNo, validateCorporateTaxNumber } from '@/lib/utils/taxValidation'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

const MAX_ITEMS = 100
const MAX_QUANTITY_PER_ITEM = 1000

function errorResponse(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status },
  )
}

function normalizeEmail(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
}

function isValidEmail(email: string): boolean {
  if (!email || email.length > 100) {
    return false
  }

  if (/[çğıöşüÇĞİÖŞÜ]/.test(email)) {
    return false
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizePhone(value: unknown): string {
  return String(value || '').replace(/\D/g, '')
}

function formatPhone(phone: string): string {
  if (phone.startsWith('90')) {
    return `+${phone}`
  }

  if (phone.startsWith('0')) {
    return `+9${phone}`
  }

  return `+90${phone}`
}

function getClientIp(req: NextRequest): string {
  const forwardedFor =
    req.headers.get('x-forwarded-for')

  let ip = forwardedFor
    ? forwardedFor.split(',')[0].trim()
    : req.headers.get('x-real-ip')?.trim() ||
    '127.0.0.1'

  if (
    ip === '::1' ||
    ip === '::ffff:127.0.0.1'
  ) {
    ip = '127.0.0.1'
  }

  if (!ip || ip.length > 39) {
    return '127.0.0.1'
  }

  return ip
}

function generateMerchantOid(): string {
  const datePrefix = new Date()
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, '')

  const randomSuffix = crypto
    .randomBytes(8)
    .toString('hex')
    .toUpperCase()

  return `GS${datePrefix}${randomSuffix}`
}

export async function POST(
  req: NextRequest,
) {
  try {
    // --------------------------------------------------
    // 0. AUTHENTICATION VALIDATION (Zorunlu Kullanıcı Girişi)
    // --------------------------------------------------
    const authHeader = req.headers.get('authorization') || ''
    if (!authHeader.startsWith('Bearer ')) {
      return errorResponse('Sipariş oluşturabilmek için lütfen hesabınıza giriş yapınız.', 401)
    }

    const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return errorResponse('Geçersiz oturum belirteci.', 401)
    }

    let verifiedUid = ''
    let verifiedEmail = ''
    try {
      const adminAuth = getAdminAuth()
      const decoded = await adminAuth.verifyIdToken(token)
      verifiedUid = decoded.uid
      verifiedEmail = (decoded.email || '').toLowerCase().trim()
    } catch (authErr: any) {
      console.warn('PayTR initialize auth error:', authErr?.message || authErr)
      return errorResponse('Oturumunuzun süresi dolmuş veya geçersiz. Lütfen tekrar giriş yapınız.', 401)
    }

    if (!verifiedUid) {
      return errorResponse('Yetkilendirilmiş kullanıcı bulunamadı.', 401)
    }

    const body = await req.json()

    const {
      customer,
      shippingAddress,
      billingInfo,
      customerType,
      items,
      userId,
      notes,
    } = body || {}

    // --------------------------------------------------
    // 1. CUSTOMER VALIDATION
    // --------------------------------------------------

    const customerName =
      String(customer?.name || '').trim()

    const customerEmail =
      normalizeEmail(customer?.email)

    const rawPhone =
      normalizePhone(customer?.phone)

    if (
      !customerName ||
      customerName.length < 2 ||
      customerName.length > 100
    ) {
      return errorResponse(
        'Lütfen geçerli bir ad-soyad giriniz.',
      )
    }

    if (!isValidEmail(customerEmail)) {
      return errorResponse(
        'Lütfen geçerli bir e-posta adresi giriniz.',
      )
    }

    if (
      rawPhone.length < 10 ||
      rawPhone.length > 15
    ) {
      return errorResponse(
        'Lütfen geçerli bir telefon numarası giriniz.',
      )
    }

    const formattedPhone =
      formatPhone(rawPhone)

    // --------------------------------------------------
    // 2. SHIPPING ADDRESS VALIDATION
    // --------------------------------------------------

    const address =
      String(
        shippingAddress?.address || '',
      ).trim()

    const city =
      String(
        shippingAddress?.city || '',
      ).trim()

    const district =
      String(
        shippingAddress?.district || '',
      ).trim()

    const zipCode =
      String(
        shippingAddress?.zipCode || '',
      ).trim()

    const fullName =
      String(
        shippingAddress?.fullName ||
        customerName,
      ).trim()

    if (
      !address ||
      address.length < 5 ||
      address.length > 500
    ) {
      return errorResponse(
        'Lütfen geçerli bir teslimat adresi giriniz.',
      )
    }

    if (
      !city ||
      city.length > 100
    ) {
      return errorResponse(
        'Lütfen geçerli bir şehir giriniz.',
      )
    }

    if (
      !district ||
      district.length > 100
    ) {
      return errorResponse(
        'Lütfen geçerli bir ilçe giriniz.',
      )
    }

    if (zipCode.length > 20) {
      return errorResponse(
        'Posta kodu geçersiz.',
      )
    }

    // --------------------------------------------------
    // 2.1 CUSTOMER TYPE & BILLING INFO VALIDATION
    // --------------------------------------------------
    const resolvedCustomerType: 'individual' | 'corporate' =
      String(customerType || billingInfo?.type || 'individual').toLowerCase() === 'corporate'
        ? 'corporate'
        : 'individual'

    let cleanBillingInfo: any = null

    if (resolvedCustomerType === 'corporate') {
      const companyName = String(billingInfo?.companyName || '').trim()
      const taxOffice = String(billingInfo?.taxOffice || '').trim()
      const taxNumber = String(billingInfo?.taxNumber || '').trim()
      const authFirstName = String(billingInfo?.authorizedPerson?.firstName || customerName.split(' ')[0] || '').trim()
      const authLastName = String(billingInfo?.authorizedPerson?.lastName || customerName.split(' ').slice(1).join(' ') || '').trim()
      const bAddress = String(billingInfo?.address || address).trim()
      const bCity = String(billingInfo?.city || city).trim()
      const bDistrict = String(billingInfo?.district || district).trim()

      if (!companyName) {
        return errorResponse('Kurumsal fatura için Firma Ünvanı zorunludur.')
      }
      if (!taxNumber) {
        return errorResponse('Kurumsal fatura için Vergi Numarası zorunludur.')
      }
      const vknValidation = validateCorporateTaxNumber(taxNumber)
      if (!vknValidation.isValid) {
        return errorResponse(vknValidation.error || 'Geçersiz Vergi Numarası.')
      }

      cleanBillingInfo = {
        type: 'corporate',
        companyName,
        taxOffice,
        taxNumber,
        authorizedPerson: {
          firstName: authFirstName,
          lastName: authLastName,
        },
        address: bAddress,
        city: bCity,
        district: bDistrict,
        phone: formattedPhone,
        email: customerEmail,
      }
    } else {
      const tcKimlikNo = String(billingInfo?.tcKimlikNo || '').trim()
      if (tcKimlikNo) {
        const tcValidation = validateTCKimlik(tcKimlikNo)
        if (!tcValidation.isValid) {
          return errorResponse(tcValidation.error || 'Geçersiz T.C. Kimlik Numarası.')
        }
      }
      const bAddress = String(billingInfo?.address || address).trim()
      const bCity = String(billingInfo?.city || city).trim()
      const bDistrict = String(billingInfo?.district || district).trim()

      cleanBillingInfo = {
        type: 'individual',
        fullName: customerName,
        tcKimlikNo: tcKimlikNo || '',
        address: bAddress,
        city: bCity,
        district: bDistrict,
        phone: formattedPhone,
        email: customerEmail,
      }
    }

    // --------------------------------------------------
    // 3. CART VALIDATION
    // --------------------------------------------------

    if (
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return errorResponse(
        'Sepetinizde geçerli ürün bulunamadı.',
      )
    }

    if (items.length > MAX_ITEMS) {
      return errorResponse(
        'Sepette çok fazla ürün bulunuyor.',
      )
    }

    const db = getAdminFirestore()

    let subtotalKurus = 0

    const verifiedOrderItems: any[] = []

    const paytrBasketItems: PayTRBasketItem[] =
      []

    // --------------------------------------------------
    // 4. SERVER-SIDE PRODUCT / PRICE VALIDATION
    // --------------------------------------------------

    for (const clientItem of items) {
      const productId =
        typeof clientItem?.productId === 'string'
          ? clientItem.productId.trim()
          : ''

      if (
        !productId ||
        productId.length > 200
      ) {
        return errorResponse(
          'Sepette geçersiz ürün kimliği tespit edildi.',
        )
      }

      const rawQuantity =
        Number(clientItem?.quantity)

      if (
        !Number.isSafeInteger(
          rawQuantity,
        ) ||
        rawQuantity < 1 ||
        rawQuantity >
        MAX_QUANTITY_PER_ITEM
      ) {
        return errorResponse(
          'Ürün miktarı geçersiz.',
        )
      }

      const quantity = rawQuantity

      const productDoc =
        await db
          .collection('products')
          .doc(productId)
          .get()

      if (!productDoc.exists) {
        return errorResponse(
          'Sepetteki ürün veritabanında bulunamadı.',
        )
      }

      const productData =
        productDoc.data() as any

      // ------------------------------------------------
      // PRODUCT NAME
      // ------------------------------------------------

      const productName =
        String(
          productData?.name || '',
        ).trim()

      if (!productName) {
        return errorResponse(
          'Ürün bilgilerinde geçersiz ürün adı bulundu.',
        )
      }

      // ------------------------------------------------
      // COLOR / VARIANT VALIDATION
      // ------------------------------------------------

      const clientColorName =
        typeof clientItem?.selectedColor
          ?.name === 'string'
          ? clientItem.selectedColor.name.trim()
          : ''

      let matchedColor: any = null

      if (clientColorName) {
        if (
          !Array.isArray(
            productData?.colors,
          )
        ) {
          return errorResponse(
            `Seçilen ürün rengi geçersiz: ${productName}`,
          )
        }

        matchedColor =
          productData.colors.find(
            (color: any) =>
              String(
                color?.name || '',
              ).trim() ===
              clientColorName,
          )

        if (!matchedColor) {
          return errorResponse(
            `Seçilen ürün rengi geçersiz: ${productName}`,
          )
        }
      }

      // ------------------------------------------------
      // SERVER-SIDE PRICE
      // ------------------------------------------------

      const rawPrice =
        matchedColor
          ? (
            matchedColor.discountPrice ??
            matchedColor.price
          )
          : (
            productData.discountPrice ??
            productData.price
          )

      const price =
        Number(rawPrice)

      if (
        !Number.isFinite(price) ||
        price <= 0
      ) {
        return errorResponse(
          `Ürün fiyatı geçersiz: ${productName}`,
        )
      }

      const priceKurus =
        Math.round(price * 100)

      if (
        !Number.isSafeInteger(
          priceKurus,
        ) ||
        priceKurus <= 0
      ) {
        return errorResponse(
          `Ürün fiyatı geçersiz: ${productName}`,
        )
      }

      const itemTotalKurus =
        priceKurus * quantity

      if (
        !Number.isSafeInteger(
          itemTotalKurus,
        )
      ) {
        return errorResponse(
          'Sipariş tutarı hesaplanamadı.',
          400,
        )
      }

      subtotalKurus +=
        itemTotalKurus

      if (
        !Number.isSafeInteger(
          subtotalKurus,
        )
      ) {
        return errorResponse(
          'Sipariş toplamı geçersiz.',
          400,
        )
      }

      // ------------------------------------------------
      // VERIFIED IMAGE
      // ------------------------------------------------

      const verifiedImage =
        matchedColor?.image ||
        productData?.image ||
        ''

      // ------------------------------------------------
      // VERIFIED COLOR
      // ------------------------------------------------

      const verifiedSelectedColor =
        matchedColor
          ? {
            name: String(
              matchedColor.name,
            ).trim(),
            ...(matchedColor.image
              ? {
                image:
                  String(
                    matchedColor.image,
                  ),
              }
              : {}),
          }
          : null

      // ------------------------------------------------
      // ORDER ITEM
      // ------------------------------------------------

      verifiedOrderItems.push({
        productId,
        name: productName,
        price: priceKurus / 100,
        quantity,
        image: verifiedImage,
        selectedColor:
          verifiedSelectedColor,
      })

      // ------------------------------------------------
      // PAYTR BASKET
      // ------------------------------------------------

      paytrBasketItems.push({
        name: productName,
        price: priceKurus / 100,
        quantity,
      })
    }

    if (
      subtotalKurus <= 0 ||
      !Number.isSafeInteger(
        subtotalKurus,
      )
    ) {
      return errorResponse(
        'Sepet toplam tutarı geçersiz.',
      )
    }

    // --------------------------------------------------
    // 5. SERVER-SIDE SHIPPING FEE
    // --------------------------------------------------

    let shippingKurus = 0

    try {
      const shippingDoc =
        await db
          .collection('siteContent')
          .doc('shipping')
          .get()

      if (shippingDoc.exists) {
        const shippingData =
          shippingDoc.data()

        const standardFee = Number(shippingData?.shippingFee ?? 0)
        const freeThreshold = Number(shippingData?.freeShippingThreshold ?? 0)
        const subtotalTRY = subtotalKurus / 100

        if (freeThreshold > 0 && subtotalTRY >= freeThreshold) {
          shippingKurus = 0
        } else if (standardFee > 0) {
          shippingKurus = Math.round(standardFee * 100)
        } else {
          shippingKurus = 0
        }
      }
    } catch (error) {
      console.error(
        '❌ Shipping fee lookup error:',
        error,
      )

      return errorResponse(
        'Kargo bilgileri alınamadı. Lütfen daha sonra tekrar deneyiniz.',
        500,
      )
    }

    if (shippingKurus > 0) {
      paytrBasketItems.push({
        name: 'Kargo Ücreti',
        price: shippingKurus / 100,
        quantity: 1,
      })
    }

    // --------------------------------------------------
    // 6. FINAL TOTAL
    // --------------------------------------------------

    const totalKurus =
      subtotalKurus +
      shippingKurus

    if (
      totalKurus <= 0 ||
      !Number.isSafeInteger(
        totalKurus,
      )
    ) {
      return errorResponse(
        'Sipariş toplamı geçersiz.',
      )
    }

    const totalTRY =
      totalKurus / 100

    // --------------------------------------------------
    // 7. CURRENCY
    // --------------------------------------------------
    //
    // Bu mağazada ödeme para birimini
    // istemciden almıyoruz.
    //
    // Firestore / frontend ne gönderirse
    // göndersin PayTR'ye TL gönderiyoruz.
    //

    const currency = 'TRY'

    // --------------------------------------------------
    // 8. MERCHANT OID
    // --------------------------------------------------

    const merchantOid =
      generateMerchantOid()

    // PayTR merchant_oid:
    // sadece alphanumeric
    if (
      !/^[A-Za-z0-9]{1,64}$/.test(
        merchantOid,
      )
    ) {
      throw new Error(
        'Geçersiz merchant_oid oluşturuldu.',
      )
    }

    // --------------------------------------------------
    // 9. APPLICATION URL
    // --------------------------------------------------

    const configuredAppUrl =
      (
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.APP_URL ||
        ''
      ).replace(/\/$/, '')

    const host =
      req.headers.get(
        'x-forwarded-host',
      ) ||
      req.headers.get('host') ||
      'localhost:3000'

    const protocol =
      req.headers.get(
        'x-forwarded-proto',
      ) ||
      (host.includes('localhost')
        ? 'http'
        : 'https')

    const appUrl =
      configuredAppUrl ||
      `${protocol}://${host}`

    if (
      process.env.NODE_ENV ===
      'production' &&
      !appUrl.startsWith(
        'https://',
      )
    ) {
      throw new Error(
        'Production ortamında HTTPS APP URL zorunludur.',
      )
    }

    const merchantOkUrl =
      `${appUrl}/satin-al?odeme=basarili&oid=${merchantOid}`

    const merchantFailUrl =
      `${appUrl}/satin-al?odeme=hata&oid=${merchantOid}`

    // --------------------------------------------------
    // 10. CLIENT IP
    // --------------------------------------------------

    const userIp =
      getClientIp(req)

    // --------------------------------------------------
    // 11. ADDRESS
    // --------------------------------------------------

    const fullAddress =
      `${district}, ${address}, ${city}`

    // --------------------------------------------------
    // 12. NOTES
    // --------------------------------------------------

    const orderNotes =
      String(
        notes || '',
      ).trim().slice(0, 1000)

    // --------------------------------------------------
    // 13. CREATE PENDING ORDER
    // --------------------------------------------------

    const orderRef =
      db
        .collection('orders')
        .doc(merchantOid)

    const createdAt =
      new Date().toISOString()

    await orderRef.create(cleanFirestoreData({
      id: merchantOid,

      orderNumber:
        merchantOid,

      merchant_oid:
        merchantOid,

      userId: verifiedUid,

      // Sunucu tarafından doğrulanmış e-posta veya checkout e-postası
      userEmail: verifiedEmail || customerEmail,

      customer: {
        name: customerName,
        email: customerEmail,
        phone: formattedPhone,
      },

      shippingAddress: {
        fullName:
          fullName || customerName,
        address,
        city,
        district,
        zipCode,
        country: 'Türkiye',
      },

      items:
        verifiedOrderItems,

      subtotal:
        subtotalKurus / 100,

      shippingCost:
        shippingKurus / 100,

      total:
        totalTRY,

      totalAmountTRY:
        totalTRY,

      // Callback tarafında tutar
      // doğrulaması için kritik.
      paymentAmountKurus:
        totalKurus,

      currency,

      notes:
        orderNotes,

      paymentMethod:
        'paytr_iframe',

      status:
        'pending',

      paymentStatus:
        'PENDING',

      paymentInitStatus:
        'PENDING',

      customerType: resolvedCustomerType,
      billingInfo: cleanBillingInfo,
      createdAt,

      updatedAt:
        createdAt,
    }))

    // --------------------------------------------------
    // 14. PAYTR TOKEN
    // --------------------------------------------------

    const tokenResult =
      await getPayTRToken({
        merchantOid,

        userIp,

        email:
          customerEmail,

        paymentAmount:
          totalKurus,

        userName:
          customerName,

        userAddress:
          fullAddress,

        userPhone:
          formattedPhone,

        merchantOkUrl,

        merchantFailUrl,

        userBasket:
          paytrBasketItems,

        currency:
          'TL',

        noInstallment:
          '0',

        maxInstallment:
          '0',

        lang:
          'tr',
      })

    // --------------------------------------------------
    // 15. TOKEN FAILURE
    // --------------------------------------------------

    if (
      tokenResult.status !==
      'success' ||
      !tokenResult.token
    ) {
      const failedAt =
        new Date().toISOString()

      await orderRef.update({
        paymentInitStatus:
          'FAILED',

        paymentStatus:
          'INIT_FAILED',

        status:
          'payment_init_failed',

        paymentInitError:
          tokenResult.reason ||
          'PayTR ödeme oturumu başlatılamadı.',

        updatedAt:
          failedAt,
      })

      return NextResponse.json(
        {
          success: false,
          error:
            tokenResult.reason ||
            'PayTR ödeme oturumu başlatılamadı. Lütfen tekrar deneyiniz.',
        },
        { status: 502 },
      )
    }

    // --------------------------------------------------
    // 16. TOKEN READY
    // --------------------------------------------------

    await orderRef.update({
      paymentInitStatus:
        'READY',

      updatedAt:
        new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,

      token:
        tokenResult.token,

      orderNumber:
        merchantOid,

      iframeUrl:
        `https://www.paytr.com/odeme/guvenli/${tokenResult.token}`,
    })
  } catch (error: unknown) {
    console.error(
      '❌ PayTR Init Error:',
      error,
    )

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Sunucu hatası oluştu. Lütfen tekrar deneyiniz.',
      },
      { status: 500 },
    )
  }
}