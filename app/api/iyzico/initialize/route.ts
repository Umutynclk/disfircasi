import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { initializeIyzicoCheckout, isIyzicoConfigured, IyzicoInitializeRequest } from '@/lib/iyzico'
import { getAdminFirestore } from '@/lib/firebase/admin'

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function generateIyzicoOrderNumber(): string {
  const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase()
  return `GS-IY${datePrefix}-${randomSuffix}`
}

function normalizePhone(value: unknown): string {
  return String(value || '').replace(/\D/g, '')
}

export async function POST(req: NextRequest) {
  try {
    if (!isIyzicoConfigured()) {
      return errorResponse(
        'iyzico ödeme altyapısı henüz yapılandırılmamış. Lütfen ortam değişkenlerini kontrol edin.',
        500
      )
    }

    const body = await req.json()
    const { customer, shippingAddress, items, userId, notes } = body

    // 1. Temel Müşteri & Adres Bilgisi Doğrulama
    if (!customer?.name?.trim()) {
      return errorResponse('Müşteri adı gereklidir.')
    }
    const customerEmail = String(customer.email || '').trim().toLowerCase()
    if (!customerEmail || !customerEmail.includes('@')) {
      return errorResponse('Geçerli bir e-posta adresi gereklidir.')
    }
    const rawPhone = normalizePhone(customer.phone)
    if (!rawPhone || rawPhone.length < 10) {
      return errorResponse('Geçerli bir telefon numarası gereklidir.')
    }

    if (!shippingAddress?.address?.trim()) {
      return errorResponse('Teslimat açık adresi gereklidir.')
    }
    const city = String(shippingAddress.city || '').trim()
    const district = String(shippingAddress.district || '').trim()
    if (!city || !district) {
      return errorResponse('İl ve ilçe bilgisi gereklidir.')
    }

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse('Sepetinizde geçerli ürün bulunamadı.')
    }

    // 2. Sunucu Taraflı Ürün & Fiyat Doğrulama (Firestore products)
    const db = getAdminFirestore()
    let subtotalKurus = 0
    const verifiedOrderItems: any[] = []
    const basketItems: IyzicoInitializeRequest['basketItems'] = []

    for (let i = 0; i < items.length; i++) {
      const clientItem = items[i]
      const productId = typeof clientItem?.productId === 'string' ? clientItem.productId.trim() : ''
      const quantity = Number(clientItem?.quantity)

      if (!productId) {
        return errorResponse('Sepette geçersiz ürün kimliği tespit edildi.')
      }
      if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100) {
        return errorResponse('Geçersiz ürün adedi.')
      }

      const productDoc = await db.collection('products').doc(productId).get()
      if (!productDoc.exists) {
        return errorResponse(`"${clientItem.name || productId}" adlı ürün mağazada bulunamadı.`)
      }

      const productData = productDoc.data() || {}
      if (productData.active === false || productData.isPublished === false) {
        return errorResponse(`"${productData.name || productId}" adlı ürün şu anda satışta değil.`)
      }

      // Varyant veya ana ürün fiyatı kontrolü
      let unitPrice = Number(productData.discountPrice || productData.price)
      const selectedColor = clientItem.selectedColor

      if (selectedColor && Array.isArray(productData.colors)) {
        const matchedColor = productData.colors.find(
          (c: any) =>
            c.name?.trim().toLowerCase() === selectedColor.name?.trim().toLowerCase() ||
            c.colorHex === selectedColor.colorHex
        )
        if (matchedColor && (matchedColor.price || matchedColor.discountPrice)) {
          unitPrice = Number(matchedColor.discountPrice || matchedColor.price)
        }
      }

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return errorResponse(`"${productData.name || productId}" için geçerli fiyat bulunamadı.`)
      }

      const itemTotalKurus = Math.round(unitPrice * 100) * quantity
      subtotalKurus += itemTotalKurus

      const verifiedItem = {
        productId,
        name: String(productData.name || clientItem.name || 'Ürün').slice(0, 100),
        price: unitPrice,
        quantity,
        image: clientItem.image || productData.images?.[0] || '',
        selectedColor: selectedColor || null,
        desi: Number(productData.desi || 1),
        weight: Number(productData.weight || 0.3),
      }
      verifiedOrderItems.push(verifiedItem)

      basketItems.push({
        id: productId,
        name: verifiedItem.name.slice(0, 50),
        category1: String(productData.category || 'Ağız ve Diş Bakımı').slice(0, 50),
        itemType: 'PHYSICAL',
        price: (itemTotalKurus / 100).toFixed(2),
      })
    }

    // 3. Kargo Ücreti Doğrulama (siteContent/shipping)
    let shippingKurus = 0
    try {
      const shippingDoc = await db.collection('siteContent').doc('shipping').get()
      if (shippingDoc.exists) {
        const shipData = shippingDoc.data() || {}
        const freeThreshold = Number(shipData.freeShippingThreshold || 0)
        const standardFee = Number(shipData.shippingFee || 0)
        const subtotalTRY = subtotalKurus / 100

        if (freeThreshold > 0 && subtotalTRY >= freeThreshold) {
          shippingKurus = 0
        } else if (standardFee > 0) {
          shippingKurus = Math.round(standardFee * 100)
        }
      }
    } catch (err) {
      console.warn('iyzico init: Kargo ayarı okuma uyarısı:', err)
    }

    if (shippingKurus > 0) {
      basketItems.push({
        id: 'shipping_fee',
        name: 'Kargo ve Teslimat Bedeli',
        category1: 'Kargo',
        itemType: 'VIRTUAL',
        price: (shippingKurus / 100).toFixed(2),
      })
    }

    // 4. Nihai Tutar & Sipariş Numarası
    const totalKurus = subtotalKurus + shippingKurus
    const totalTRY = totalKurus / 100
    const orderNumber = generateIyzicoOrderNumber()

    const host = req.headers.get('host') || 'localhost:3000'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const callbackUrl = `${protocol}://${host}/api/iyzico/callback`

    // İsim Soyisim ayrıştırma
    const nameParts = customer.name.trim().split(' ')
    const buyerName = nameParts.slice(0, -1).join(' ') || nameParts[0]
    const buyerSurname = nameParts.length > 1 ? nameParts[nameParts.length - 1] : 'Müşteri'

    const fullAddress = `${district ? `${district}, ` : ''}${shippingAddress.address}, ${city}`

    // 5. Firestore 'orders' Koleksiyonuna PENDING Sipariş Kaydı Açma
    const createdAt = new Date().toISOString()
    const orderRef = db.collection('orders').doc(orderNumber)

    await orderRef.create({
      id: orderNumber,
      orderNumber,
      merchant_oid: orderNumber,
      userId: typeof userId === 'string' && userId.trim() ? userId.trim() : 'guest',
      userEmail: customerEmail,
      customer: {
        name: customer.name.trim(),
        email: customerEmail,
        phone: rawPhone,
      },
      shippingAddress: {
        fullName: shippingAddress.fullName || customer.name.trim(),
        address: shippingAddress.address.trim(),
        city,
        district,
        zipCode: shippingAddress.zipCode?.trim() || '',
        country: 'Türkiye',
      },
      items: verifiedOrderItems,
      subtotal: subtotalKurus / 100,
      shippingCost: shippingKurus / 100,
      total: totalTRY,
      totalAmountTRY: totalTRY,
      paymentAmountKurus: totalKurus,
      currency: 'TRY',
      notes: String(notes || '').trim().slice(0, 1000),
      paymentMethod: 'iyzico_3d_secure',
      status: 'pending',
      paymentStatus: 'PENDING',
      paymentInitStatus: 'PENDING',
      createdAt,
      updatedAt: createdAt,
    })

    // 6. iyzico Checkout Form Initialize Çağrısı
    const iyzicoRequest: IyzicoInitializeRequest = {
      locale: 'tr',
      conversationId: orderNumber,
      price: (subtotalKurus / 100).toFixed(2),
      paidPrice: totalTRY.toFixed(2),
      currency: 'TRY',
      basketId: orderNumber,
      paymentGroup: 'PRODUCT',
      callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9, 12],
      buyer: {
        id: typeof userId === 'string' && userId.trim() ? userId.trim() : 'guest',
        name: buyerName,
        surname: buyerSurname,
        gsmNumber: rawPhone.startsWith('90') ? `+${rawPhone}` : `+90${rawPhone.replace(/^0/, '')}`,
        email: customerEmail,
        identityNumber: '11111111110', // E-ticaret siparişleri için standart kimlik kontrolü
        registrationAddress: fullAddress,
        ip: req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1',
        city,
        country: 'Turkey',
        zipCode: shippingAddress.zipCode?.trim() || '34000',
      },
      shippingAddress: {
        contactName: shippingAddress.fullName || customer.name.trim(),
        city,
        country: 'Turkey',
        address: fullAddress,
        zipCode: shippingAddress.zipCode?.trim() || '34000',
      },
      billingAddress: {
        contactName: shippingAddress.fullName || customer.name.trim(),
        city,
        country: 'Turkey',
        address: fullAddress,
        zipCode: shippingAddress.zipCode?.trim() || '34000',
      },
      basketItems,
    }

    const result = await initializeIyzicoCheckout(iyzicoRequest)

    if (result.status !== 'success' || !result.token) {
      await orderRef.update({
        paymentInitStatus: 'FAILED',
        status: 'failed',
        iyzicoInitError: result.errorMessage || 'Başlatma başarısız',
        updatedAt: new Date().toISOString(),
      })

      return errorResponse(result.errorMessage || 'iyzico ödeme formu başlatılamadı.', 400)
    }

    // 7. Token bilgisini siparişe işle
    await orderRef.update({
      iyzicoToken: result.token,
      updatedAt: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      orderNumber,
      data: result,
    })
  } catch (error: any) {
    console.error('API Iyzico Init Error:', error)
    return errorResponse(error?.message || 'iyzico başlatılırken bir sunucu hatası oluştu', 500)
  }
}
