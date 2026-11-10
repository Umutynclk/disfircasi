import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { getHepsiJetSettingsServer } from '@/lib/hepsijet/settings'
import { sendDeliveryOrderEnhanced } from '@/lib/hepsijet/client'
import { queueShippingLabelJob } from '@/lib/printing/queue'
import { sendShippingTrackingNotification } from '@/lib/hepsijet/notifications'
import { HepsiJetDeliveryOrderPayload, OrderShippingData } from '@/lib/hepsijet/types'
import { buildHepsiJetTrackingUrl } from '@/lib/hepsijet/tracking'

interface CreateShipmentRequestBody {
  orderId: string
  desi?: number
  weight?: number
  packageCount?: number
  packagingNote?: string
}

/**
 * Telefon numarasını Türkiye 10 haneli (5XXXXXXXXX) formatına normalize eder.
 */
function normalizePhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return ''
  let cleaned = rawPhone.replace(/\D/g, '')

  if (cleaned.startsWith('90') && cleaned.length === 12) {
    cleaned = cleaned.substring(2)
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1)
  }

  return cleaned
}

/**
 * Ad soyadı ilk ve son isim olarak ayırır.
 */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] }
  }
  const lastName = parts.pop() || ''
  const firstName = parts.join(' ')
  return { firstName, lastName }
}

/**
 * HepsiJET customerDeliveryNo oluşturur (9-16 karakter alfanumerik).
 * Format: [Şirket Kodu][Sipariş Referansı]
 */
function generateCustomerDeliveryNo(abbreviationCode: string, orderRef: string): string {
  const cleanAbbrev = abbreviationCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'KALIPORT'
  const cleanRef = orderRef.toUpperCase().replace(/[^A-Z0-9]/g, '')

  const available = 16 - cleanAbbrev.length // 8 karakter
  // Benzersizliği korumak için referansın sonundaki tekil kısmı al (aynı gün açılan siparişlerde tarih başlığından kaynaklı çakışmayı önler)
  const uniqueSuffix = cleanRef.length > available ? cleanRef.slice(-available) : cleanRef.padStart(available, '0')
  return `${cleanAbbrev}${uniqueSuffix}`
}

export async function POST(req: NextRequest) {
  // 1. Yönetici Yetki Doğrulaması
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = (await req.json()) as CreateShipmentRequestBody
    const { orderId } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'Sipariş ID (orderId) zorunludur.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    let orderRef = db.collection('orders').doc(orderId)
    const initialCheck = await orderRef.get()
    if (!initialCheck.exists) {
      const qNum = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get()
      if (!qNum.empty) {
        orderRef = qNum.docs[0].ref
      } else {
        const qOid = await db.collection('orders').where('merchant_oid', '==', orderId).limit(1).get()
        if (!qOid.empty) {
          orderRef = qOid.docs[0].ref
        } else {
          const qId = await db.collection('orders').where('id', '==', orderId).limit(1).get()
          if (!qId.empty) {
            orderRef = qId.docs[0].ref
          }
        }
      }
    }

    // 2. HepsiJET Ayarlarını Al (Konya Depo ve Varsayılan Desi/Ağırlık)
    const settings = await getHepsiJetSettingsServer()

    // 3. ATOMİK KİLİTLEME & DOĞRULAMA (Firestore Transaction)
    let orderData: any = null

    await db.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(orderRef)

      if (!docSnap.exists) {
        throw new Error('Sipariş bulunamadı.')
      }

      const data = docSnap.data()
      if (!data) {
        throw new Error('Sipariş verisi okunamadı.')
      }

      // Güvenlik: Ödeme ve İptal Kontrolleri
      if (data.paymentStatus !== 'PAID') {
        throw new Error(`Kargo gönderisi yalnızca ödemesi tamamlanmış (PAID) siparişler için oluşturulabilir. Mevcut durum: ${data.paymentStatus || 'BEKLİYOR'}`)
      }

      if (data.status === 'cancelled') {
        throw new Error('İptal edilmiş siparişler için kargo gönderisi oluşturulamaz.')
      }
      if (data.status === 'refunded' || data.status === 'returned') {
        throw new Error('İade edilmiş siparişler için kargo gönderisi oluşturulamaz.')
      }
      if (data.status === 'shipped' || data.status === 'delivered') {
        throw new Error('Bu sipariş zaten sevk edilmiş veya teslim edilmiştir.')
      }

      const existingShipping = data.shipping as OrderShippingData | undefined

      // İptal edilmiş kargo kontrolü
      if (existingShipping?.status === 'cancelled' || existingShipping?.status === 'cancel_pending') {
        throw new Error('İptal edilmiş veya iptal sürecindeki kargolar için yeni gönderi oluşturulamaz.')
      }

      // Yinelenen Gönderi Engelleme Kontrolleri
      if (existingShipping?.status === 'created' || existingShipping?.barcode || existingShipping?.trackingNumber) {
        throw new Error(
          `Bu sipariş için zaten aktif bir kargo gönderisi mevcuttur. Barkod / Takip No: ${existingShipping.barcode || existingShipping.trackingNumber || '-'}`
        )
      }

      // 'unknown' durumundaki siparişin körlemesine yeniden gönderimini engelle
      if (existingShipping?.status === 'unknown') {
        throw new Error(
          'Bu siparişin kargo durumu belirsiz (unknown) olarak işaretlenmiştir. Mükerrer kargo oluşmaması için körlemesine yeniden gönderim engellendi. Lütfen HepsiJET yönetim panelinden kontrol ediniz.'
        )
      }

      // Devam eden kilit kontrolü (5 dakika kilit aşımı)
      if (existingShipping?.status === 'creating') {
        const lockTime = existingShipping.lockTimestamp || 0
        const fiveMinutes = 5 * 60 * 1000
        if (Date.now() - lockTime < fiveMinutes) {
          throw new Error('Bu sipariş için kargo oluşturma işlemi şu anda başka bir istek tarafından işleniyor. Lütfen bekleyiniz.')
        }
      }

      // Atomik Kilit: Durumu 'creating' yap
      transaction.update(orderRef, {
        'shipping.status': 'creating',
        'shipping.carrier': 'hepsijet',
        'shipping.lockTimestamp': Date.now(),
        'shipping.updatedAt': new Date().toISOString(),
      })

      orderData = data
    })

    // 4. Müşteri & Teslimat Adresi Doğrulamaları
    const recipientName =
      orderData.shippingAddress?.fullName ||
      orderData.customer?.name ||
      ''

    if (!recipientName.trim()) {
      await orderRef.update({
        'shipping.status': 'failed',
        'shipping.error': 'Alıcı adı soyadı bulunamadı.',
        'shipping.updatedAt': new Date().toISOString(),
      })
      return NextResponse.json({ success: false, error: 'Alıcı adı soyadı bilgisi eksik.' }, { status: 400 })
    }

    const rawPhone = orderData.customer?.phone || ''
    const normalizedPhone = normalizePhoneNumber(rawPhone)

    if (!normalizedPhone || normalizedPhone.length < 10) {
      await orderRef.update({
        'shipping.status': 'failed',
        'shipping.error': 'Geçerli bir alıcı telefon numarası bulunamadı.',
        'shipping.updatedAt': new Date().toISOString(),
      })
      return NextResponse.json(
        { success: false, error: 'Alıcı telefon numarası geçersiz (10 haneli başında 0 olmadan girilmelidir).' },
        { status: 400 }
      )
    }

    const city = orderData.shippingAddress?.city?.trim()
    const town = orderData.shippingAddress?.district?.trim() || orderData.shippingAddress?.town?.trim() || ''
    const addressLine = orderData.shippingAddress?.address?.trim()

    if (!city || !town || !addressLine) {
      await orderRef.update({
        'shipping.status': 'failed',
        'shipping.error': 'Alıcı teslimat adresi (İl, İlçe ve Açık Adres) eksik.',
        'shipping.updatedAt': new Date().toISOString(),
      })
      return NextResponse.json(
        { success: false, error: 'Alıcı teslimat adresi (İl, İlçe ve Açık Adres) eksiksiz girilmelidir.' },
        { status: 400 }
      )
    }

    // 5. Paket, Desi ve Ağırlık Hiyerarşisi
    // Öncelik:
    // 1. Gönderi oluşturulurken açıkça girilen değerler (body.desi / body.weight / body.packageCount)
    // 2. Siparişte önceden kayıtlı değerler (orderData.desi / orderData.weight / orderData.packageCount)
    // 3. Ürünler üzerinden hesaplanan değerler
    // 4. Admin panelindeki varsayılan değerler
    let totalDesi = (body.desi && body.desi > 0) ? body.desi : (orderData.desi || 0)
    let totalWeight = (body.weight && body.weight > 0) ? body.weight : (orderData.weight || 0)
    let packageCount = (body.packageCount && body.packageCount > 0) ? body.packageCount : (orderData.packageCount || 0)

    if (totalDesi <= 0 || totalWeight <= 0) {
      const items = Array.isArray(orderData.items) ? orderData.items : []
      let calculatedDesi = 0
      let calculatedWeight = 0

      for (const item of items) {
        const qty = item.quantity || 1
        if (item.desi && typeof item.desi === 'number') {
          calculatedDesi += item.desi * qty
        }
        if (item.weight && typeof item.weight === 'number') {
          calculatedWeight += item.weight * qty
        }
      }

      if (totalDesi <= 0) totalDesi = calculatedDesi
      if (totalWeight <= 0) totalWeight = calculatedWeight
    }

    if (totalDesi <= 0) totalDesi = settings.defaultDesi || 1
    if (totalWeight <= 0) totalWeight = settings.defaultWeight || 0.3
    if (packageCount <= 0) packageCount = settings.defaultPackageCount || 1

    // 6. Alıcı Ad-Soyad Ayrıştırma
    const { firstName, lastName } = splitFullName(recipientName)

    // 7. HepsiJET Takip/Sipariş Numarası
    const orderNumberRef = orderData.orderNumber || orderData.id || orderId
    const customerDeliveryNo = generateCustomerDeliveryNo(settings.abbreviationCode, orderNumberRef)

    // 8. Kalemler / İçerik
    const deliveryContent = (orderData.items && orderData.items.length > 0)
      ? orderData.items.map((item: any, idx: number) => ({
        sku: item.productId ? `PRD-${item.productId.slice(0, 8)}` : `PKG-${idx + 1}`,
        description: item.name || 'Diş Fırçası ve Bakım Ürünü',
        quantity: item.quantity || 1,
      }))
      : [
        {
          sku: 'PKG-1',
          description: 'Diş Fırçası ve Bakım Ürünü',
          quantity: 1,
        },
      ]

    // 9. HEPSIJET API PAYLOAD OLUŞTURMA
    const payload: HepsiJetDeliveryOrderPayload = {
      company: {
        name: settings.companyName?.trim() || 'KALIPORT',
        abbreviationCode:
          settings.abbreviationCode && settings.abbreviationCode.trim().toUpperCase() !== 'KLP'
            ? settings.abbreviationCode.trim().toUpperCase()
            : 'KALIPORT',
      },
      currentXDock: {
        abbreviationCode: settings.currentXdock?.trim() || 'KALIPORTSELCUKLU',
      },
      delivery: {
        customerDeliveryNo,
        customerOrderId: orderNumberRef,
        totalParcels: packageCount,
        desi: Number(totalDesi.toFixed(2)),
        weight: Number(totalWeight.toFixed(2)),
        deliveryTotalPrice: 0, // Kredi kartı/Havale ile ödendi (Kapıda ödeme yok)
        deliveryDateOriginal: new Date().toISOString().split('T')[0],
        deliveryType: settings.deliveryType || 'RETAIL',
        recipientPerson: recipientName,
        recipientPersonPhone1: normalizedPhone,
        product: {
          productCode: settings.productCode || 'HX_STD',
        },
        receiver: {
          firstName,
          lastName,
          phone1: normalizedPhone,
          email: orderData.customer?.email || '',
        },
        senderAddress: {
          companyAddressId: settings.warehouseCode || 'kali-kaliport-73',
          country: { name: settings.senderCountry || 'Türkiye' },
          city: { name: settings.senderCity || 'Konya' },
          town: { name: settings.senderTown || 'SELÇUKLU' },
          district: { name: settings.senderDistrict || 'BÜYÜKKAYACIK' },
          addressLine1:
            settings.senderAddress ||
            'büyükkayacık mah. Ankara cad. no:312/H ( Gnc sanayi sitesi ) Selçuklu / KONYA',
        },
        recipientAddress: {
          addressLine1: addressLine,
          country: { name: 'Türkiye' },
          city: { name: city },
          town: { name: town },
          ...(orderData.shippingAddress?.neighborhood?.trim()
            ? { district: { name: orderData.shippingAddress.neighborhood.trim() } }
            : {}),
        },
        deliveryContent,
      },
    }

    // 10. HEPSIJET API İSTEĞİ ÖNCESİ ŞEMA VE ZORUNLU ALAN DOĞRULAMASI
    if (!payload.company?.name?.trim() || !payload.company?.abbreviationCode?.trim()) {
      await orderRef.update({ 'shipping.status': 'failed', 'shipping.error': 'Firma bilgileri eksik.', 'shipping.updatedAt': new Date().toISOString() })
      return NextResponse.json({ success: false, error: 'HepsiJET firma adı veya kısaltma kodu eksik.' }, { status: 400 })
    }
    if (!payload.currentXDock?.abbreviationCode?.trim()) {
      await orderRef.update({ 'shipping.status': 'failed', 'shipping.error': 'Aktarma merkezi kodu (currentXDock) eksik.', 'shipping.updatedAt': new Date().toISOString() })
      return NextResponse.json({ success: false, error: 'HepsiJET aktarma merkezi kodu (currentXDock.abbreviationCode) eksik.' }, { status: 400 })
    }
    if (!payload.delivery?.senderAddress?.companyAddressId?.trim()) {
      await orderRef.update({ 'shipping.status': 'failed', 'shipping.error': 'Çıkış depo kodu (companyAddressId) eksik.', 'shipping.updatedAt': new Date().toISOString() })
      return NextResponse.json({ success: false, error: 'HepsiJET çıkış depo kodu (companyAddressId) eksik.' }, { status: 400 })
    }
    if (!payload.delivery?.customerDeliveryNo || payload.delivery.customerDeliveryNo.length < 9 || payload.delivery.customerDeliveryNo.length > 16) {
      await orderRef.update({ 'shipping.status': 'failed', 'shipping.error': 'Geçersiz customerDeliveryNo formatı.', 'shipping.updatedAt': new Date().toISOString() })
      return NextResponse.json({ success: false, error: 'HepsiJET customerDeliveryNo 9-16 karakter aralığında olmalıdır.' }, { status: 400 })
    }

    // 11. HEPSIJET API İSTEĞİ (Sunucu ortam kilidiyle korunur)
    let apiResponse
    try {
      apiResponse = await sendDeliveryOrderEnhanced(payload)
    } catch (apiError: any) {
      console.error('HepsiJET sendDeliveryOrderEnhanced error:', apiError)
      const errMsg = (apiError?.message || '').toLowerCase()
      const isTimeoutOrNetworkDrop =
        errMsg.includes('timeout') ||
        errMsg.includes('econnreset') ||
        errMsg.includes('etimedout') ||
        errMsg.includes('abort') ||
        errMsg.includes('network') ||
        errMsg.includes('504') ||
        errMsg.includes('502')

      const finalStatus = isTimeoutOrNetworkDrop ? 'unknown' : 'failed'

      // Hata durumunu kaydet ve kilidi serbest bırak
      await orderRef.update({
        'shipping.status': finalStatus,
        'shipping.error': apiError.message || 'HepsiJET servisine ulaşılamadı.',
        'shipping.updatedAt': new Date().toISOString(),
      })
      return NextResponse.json(
        {
          success: false,
          error: isTimeoutOrNetworkDrop
            ? `HepsiJET servisine yapılan istek zaman aşımına uğradı veya ağ bağlantısı koptu. İstek kargo sistemine ulaşmış olabileceğinden durum 'unknown' (belirsiz) olarak kilitlendi: ${apiError.message}`
            : `HepsiJET kargo gönderisi oluşturulamadı: ${apiError.message}`,
          shippingStatus: finalStatus,
        },
        { status: 502 }
      )
    }

    // 11. SİMÜLASYON / GERÇEK AYIRIMI
    const isSimulated = apiResponse.data?.isSimulated === true

    if (isSimulated) {
      // SİMÜLASYON MODU: Gerçek gönderi oluşturulmadı.
      // Siparişi 'shipped' olarak İŞARETLEME, gerçek barkod yoktur.
      const simulatedRecord: OrderShippingData = {
        carrier: 'hepsijet',
        status: 'simulated',
        barcode: '',
        trackingNumber: '',
        customerDeliveryNo,
        trackingUrl: '',
        desi: totalDesi,
        weight: totalWeight,
        packageCount,
        senderCity: settings.senderCity,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        liveRequestMade: false,
      }

      // Sipariş durumunu 'processing' olarak bırak (shipped YAPMA!)
      await orderRef.set(
        {
          shipping: simulatedRecord,
          status: 'processing',
          updatedAt: new Date().toISOString(),
          ...(body.packagingNote ? { packagingNote: body.packagingNote } : {}),
        },
        { merge: true }
      )

      return NextResponse.json({
        success: true,
        isSimulated: true,
        message:
          'HepsiJET gönderi verisi doğrulandı (Simülasyon). Gerçek kargo gönderisi OLUŞTURULMADI. Canlı gönderi için HEPSIJET_LIVE_DISPATCH_ENABLED ayarının açılması gerekmektedir.',
        shipping: simulatedRecord,
      })
    }

    // 12. GERÇEK API YANITI DOĞRULAMA
    // HTTP başarılı olsa bile yanıtın beklenen yapıda olduğunu kontrol et
    if (apiResponse.status !== 'OK') {
      await orderRef.update({
        'shipping.status': 'failed',
        'shipping.error': `HepsiJET API başarılı HTTP yanıtı döndü ancak status '${apiResponse.status || 'UNKNOWN'}': ${apiResponse.message || 'Beklenmeyen yanıt.'}`,
        'shipping.updatedAt': new Date().toISOString(),
      })
      return NextResponse.json(
        {
          success: false,
          error: `HepsiJET servisi gönderi kaydını onaylamadı (status: ${apiResponse.status || 'UNKNOWN'}). Sipariş kargoya verilmiş olarak işaretlenmedi.`,
        },
        { status: 502 }
      )
    }

    // HepsiJET'te customerDeliveryNo kargonun ana barkod ve takip kimliğidir
    const barcode =
      apiResponse.data?.barcode ||
      apiResponse.data?.trackingNumber ||
      apiResponse.data?.customerDeliveryNo ||
      customerDeliveryNo

    const trackingNumber =
      apiResponse.data?.trackingNumber ||
      apiResponse.data?.barcode ||
      barcode

    // 13. BAŞARILI GERÇEK GÖNDERİ KAYDI
    const trackingUrl = buildHepsiJetTrackingUrl(barcode)

    const shippingRecord: OrderShippingData = {
      carrier: 'hepsijet',
      status: 'created',
      barcode,
      trackingNumber,
      customerDeliveryNo,
      trackingUrl,
      desi: totalDesi,
      weight: totalWeight,
      packageCount,
      senderCity: settings.senderCity,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      liveRequestMade: true,
    }

    // Sipariş belgesini güncelle (Mevcut paymentStatus asla değiştirilmez!)
    await orderRef.set(
      {
        shipping: shippingRecord,
        status: 'shipped',
        updatedAt: new Date().toISOString(),
        ...(body.packagingNote ? { packagingNote: body.packagingNote } : {}),
      },
      { merge: true }
    )

    // 14. ANINDA TERMAL YAZDIRMA KUYRUĞUNA EKLE
    let printJobId: string | undefined
    let printQueued = false
    try {
      const queueRes = await queueShippingLabelJob({
        ...orderData,
        id: orderRef.id,
        shipping: shippingRecord,
      })
      if (queueRes.success) {
        printJobId = queueRes.job.jobId
        printQueued = true
        shippingRecord.printStatus = 'queued'
        shippingRecord.printJobId = printJobId
      }
    } catch (queueErr: any) {
      console.warn('Create shipment print queue warning:', queueErr?.message)
    }

    // 15. MÜŞTERİYE KARGO TAKİP BİLDİRİMİ (IDEMPOTENT)
    try {
      await sendShippingTrackingNotification(orderRef.id, {
        ...orderData,
        id: orderRef.id,
        shipping: shippingRecord,
      })
    } catch (notifErr: any) {
      console.warn('Create shipment tracking notification warning (non-blocking):', notifErr?.message)
    }

    return NextResponse.json({
      success: true,
      isSimulated: false,
      printQueued,
      printJobId,
      message: printQueued
        ? 'HepsiJET kargo gönderisi başarıyla oluşturuldu ve otomatik yazdırma kuyruğuna eklendi.'
        : 'HepsiJET kargo gönderisi başarıyla oluşturuldu.',
      shipping: shippingRecord,
      apiResponse,
    })
  } catch (error: any) {
    console.error('Create shipment top-level error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Kargo gönderisi oluşturulurken beklenmeyen bir hata meydana geldi.' },
      { status: 500 }
    )
  }
}
