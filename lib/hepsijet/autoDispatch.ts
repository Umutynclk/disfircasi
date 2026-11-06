import { getAdminFirestore } from '@/lib/firebase/admin'
import { getHepsiJetSettingsServer } from './settings'
import { sendDeliveryOrderEnhanced, isAmbiguousHepsiJetError } from './client'
import { queueShippingLabelJob } from '@/lib/printing/queue'
import {
  HepsiJetDeliveryOrderPayload,
  OrderShippingData,
} from './types'

export interface AutoDispatchResult {
  success: boolean
  status:
    | 'already_created'
    | 'created'
    | 'simulated'
    | 'print_queued'
    | 'locked'
    | 'ineligible'
    | 'failed'
    | 'paused'
    | 'requires_review'
  barcode?: string
  trackingNumber?: string
  printJobId?: string
  isSimulated?: boolean
  error?: string
  message: string
}

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

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = (fullName || '').trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length === 1) {
    return { firstName: parts[0] || 'Musteri', lastName: parts[0] || 'Musteri' }
  }
  const lastName = parts.pop() || 'Musteri'
  const firstName = parts.join(' ') || 'Musteri'
  return { firstName, lastName }
}

function generateCustomerDeliveryNo(abbreviationCode: string, orderRef: string): string {
  const cleanAbbrev = abbreviationCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'KALIPORT'
  const cleanRef = orderRef.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const available = 16 - cleanAbbrev.length
  const uniqueSuffix = cleanRef.length > available ? cleanRef.slice(-available) : cleanRef.padStart(available, '0')
  return `${cleanAbbrev}${uniqueSuffix}`
}

/**
 * Bir sipariş için anlık otomatik HepsiJET kargo gönderisi oluşturur ve etiketini anında yazdırma kuyruğuna aktarır.
 * 
 * İdempotency & Eşzamanlılık Koruması:
 * - Aynı sipariş için mükerrer gönderi açılmaz.
 * - Dağıtık işlem kilidi (lockTimestamp) ile yarış durumları (race condition) engellenir.
 * - Ödeme tamamlanmamış (PAID olmayan) veya iptal edilmiş siparişler için asla işlem başlatılmaz.
 */
export async function processOrderAutoDispatchAndPrint(
  orderIdOrNumber: string,
  options?: {
    triggeredBy?: string
    force?: boolean
    bypassPause?: boolean
  }
): Promise<AutoDispatchResult> {
  const db = getAdminFirestore()
  const triggeredAt = new Date().toISOString()
  const triggeredBy = options?.triggeredBy || 'system_auto'

  try {
    // 1. Ayarları Getir
    const settings = await getHepsiJetSettingsServer()

    // Otomatik gönderi duraklatılmış mı kontrol et (Yönetici geçici olarak kapatabilir)
    const autoDispatchPaused = (settings as any).autoDispatchPaused === true
    if (autoDispatchPaused && !options?.bypassPause) {
      return {
        success: false,
        status: 'paused',
        message: 'Anlık otomatik HepsiJET gönderi oluşturma yönetici tarafından geçici olarak duraklatılmıştır.',
      }
    }

    // 2. Sipariş Doküman Referansını Bul
    let orderRef = db.collection('orders').doc(orderIdOrNumber)
    const docCheck = await orderRef.get()
    if (!docCheck.exists) {
      const qNum = await db.collection('orders').where('orderNumber', '==', orderIdOrNumber).limit(1).get()
      if (!qNum.empty) {
        orderRef = qNum.docs[0].ref
      } else {
        const qOid = await db.collection('orders').where('merchant_oid', '==', orderIdOrNumber).limit(1).get()
        if (!qOid.empty) {
          orderRef = qOid.docs[0].ref
        } else {
          return {
            success: false,
            status: 'failed',
            error: `Sipariş bulunamadı: ${orderIdOrNumber}`,
            message: 'İşlenecek sipariş veritabanında tespit edilemedi.',
          }
        }
      }
    }

    // 3. Atomik Kilit ve Uygunluk Kontrolü (Firestore Transaction)
    let orderData: any = null
    const lockAcquired = await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(orderRef)
      if (!snap.exists) {
        throw new Error('Sipariş bulunamadı.')
      }

      const data = snap.data() || {}
      orderData = { ...data, id: snap.id }

      // A. Ödeme Kontrolü
      if (data.paymentStatus !== 'PAID') {
        return {
          action: 'ineligible' as const,
          reason: `Sipariş ödemesi tamamlanmamış (Mevcut: ${data.paymentStatus || 'BEKLIYOR'}). Yalnızca PAID siparişler sevk edilebilir.`,
        }
      }

      // B. İptal / İade Kontrolü
      if (data.status === 'cancelled' || data.status === 'refunded' || data.status === 'returned') {
        return {
          action: 'ineligible' as const,
          reason: `Sipariş ${data.status} durumundadır. Gönderi oluşturulamaz.`,
        }
      }

      const existingShipping = (data.shipping || {}) as OrderShippingData

      // C. Zaten Başarıyla Oluşturulmuş Gönderi Kontrolü
      if (existingShipping.status === 'created' || Boolean(existingShipping.barcode)) {
        return {
          action: 'already_created' as const,
          barcode: existingShipping.barcode || existingShipping.trackingNumber || existingShipping.customerDeliveryNo,
          trackingNumber: existingShipping.trackingNumber,
          printStatus: (existingShipping as any).printStatus,
        }
      }

      // D0. Sonucu belirsiz (timeout vb.) gönderi: HepsiJET'te kayıt oluşmuş olabilir.
      // Yönetici HepsiJET panelinden doğrulayıp barkodu elle girene kadar yeniden oluşturma YASAK (force dahil).
      if (
        existingShipping.status === ('unknown' as any) ||
        existingShipping.autoDispatchStatus === ('requires_review' as any)
      ) {
        return {
          action: 'review' as const,
          reason:
            'Önceki gönderi isteğinin sonucu belirsiz. HepsiJET panelinde kayıt kontrol edilmeden yeni gönderi oluşturulamaz.',
        }
      }

      // D. Devam Eden Kilit Kontrolü
      if (existingShipping.status === 'creating') {
        const lockTime = existingShipping.lockTimestamp || 0
        const fiveMinutes = 5 * 60 * 1000
        if (Date.now() - lockTime < fiveMinutes) {
          return {
            action: 'locked' as const,
            reason: 'Sipariş için şu anda devam eden başka bir kargo oluşturma işlemi mevcuttur.',
          }
        }
        // Kilit eskimiş: işlem istek gönderdikten sonra çökmüş olabilir -> belirsiz, inceleme gerekir.
        transaction.update(orderRef, {
          'shipping.status': 'unknown',
          'shipping.autoDispatchStatus': 'requires_review',
          'shipping.error': 'Kilit zaman aşımına uğradı; gönderi oluşmuş olabilir. Yönetici doğrulaması gerekli.',
          'shipping.lockTimestamp': null,
          updatedAt: triggeredAt,
        })
        return {
          action: 'review' as const,
          reason: 'Önceki gönderi işlemi yarım kaldı; HepsiJET panelinde doğrulama gerekli.',
        }
      }

      // E. Kilidi Al: Durumu 'creating' yap
      transaction.update(orderRef, {
        'shipping.status': 'creating',
        'shipping.lockTimestamp': Date.now(),
        'shipping.autoDispatchStatus': 'creating',
        'shipping.autoDispatchTriggeredBy': triggeredBy,
        'shipping.autoDispatchTriggeredAt': triggeredAt,
        updatedAt: triggeredAt,
      })

      return { action: 'proceed' as const }
    })

    if (lockAcquired.action === 'ineligible') {
      return {
        success: false,
        status: 'ineligible',
        message: lockAcquired.reason,
        error: lockAcquired.reason,
      }
    }

    if (lockAcquired.action === 'review') {
      return {
        success: false,
        status: 'requires_review',
        message: lockAcquired.reason,
        error: lockAcquired.reason,
      }
    }

    if (lockAcquired.action === 'locked') {
      return {
        success: false,
        status: 'locked',
        message: lockAcquired.reason,
      }
    }

    if (lockAcquired.action === 'already_created') {
      // Gönderi zaten var. Ancak etiket yazdırma kuyruğuna alınmış mı kontrol et!
      let printJobId = (orderData?.shipping as any)?.printJobId
      let printQueued = false

      const isPrintQueuedOrDone =
        lockAcquired.printStatus === 'queued' ||
        lockAcquired.printStatus === 'printed' ||
        lockAcquired.printStatus === 'simulated' ||
        lockAcquired.printStatus === 'processing'

      if (!isPrintQueuedOrDone || (options?.force && lockAcquired.printStatus === 'failed')) {
        try {
          const queueRes = await queueShippingLabelJob(orderData, {
            retryIfFailed: Boolean(options?.force),
          })
          if (queueRes.success) {
            printJobId = queueRes.job.jobId
            printQueued = true
          }
        } catch (queueErr: any) {
          console.warn('Existing shipment print queue warning:', queueErr?.message)
        }
      }

      return {
        success: true,
        status: 'already_created',
        barcode: lockAcquired.barcode,
        trackingNumber: lockAcquired.trackingNumber,
        printJobId,
        message: printQueued
          ? `Mevcut gönderi (${lockAcquired.barcode}) doğrulandı ve yazdırma kuyruğuna eklendi.`
          : `Bu sipariş için zaten aktif bir kargo gönderisi mevcuttur (Barkod: ${lockAcquired.barcode}).`,
      }
    }

    // 4. Veri Doğrulama ve Gönderi Parametrelerini Hazırlama
    const orderNumberRef = orderData.orderNumber || orderData.id
    const customerDeliveryNo = generateCustomerDeliveryNo(
      settings.abbreviationCode || 'KALIPORT',
      orderNumberRef
    )

    const recipientName = (orderData.shippingAddress?.fullName || orderData.customer?.name || '').trim()
    const { firstName, lastName } = splitFullName(recipientName)
    const normalizedPhone = normalizePhoneNumber(orderData.shippingAddress?.phone || orderData.customer?.phone || '')

    const city = (orderData.shippingAddress?.city || '').trim()
    const town = (orderData.shippingAddress?.district || orderData.shippingAddress?.town || '').trim()
    const addressLine = (orderData.shippingAddress?.address || '').trim()

    // 5. Desi & Ağırlık Hesaplama
    let totalDesi = orderData.desi || 0
    let totalWeight = orderData.weight || 0
    let packageCount = orderData.packageCount || 0

    if (totalDesi <= 0 || totalWeight <= 0) {
      const items = Array.isArray(orderData.items) ? orderData.items : []
      let calcDesi = 0
      let calcWeight = 0
      for (const it of items) {
        const qty = it.quantity || 1
        if (typeof it.desi === 'number') calcDesi += it.desi * qty
        if (typeof it.weight === 'number') calcWeight += it.weight * qty
      }
      if (totalDesi <= 0) totalDesi = calcDesi
      if (totalWeight <= 0) totalWeight = calcWeight
    }

    if (totalDesi <= 0) totalDesi = settings.defaultDesi || 1
    if (totalWeight <= 0) totalWeight = settings.defaultWeight || 0.3
    if (packageCount <= 0) packageCount = settings.defaultPackageCount || 1

    const items = Array.isArray(orderData.items) ? orderData.items : []
    const deliveryContent = items.map((it: any) => ({
      productCode: it.sku || it.barcode || 'GLM-PRD',
      productDescription: it.name || it.title || 'Urun',
      quantity: it.quantity || 1,
    }))

    // 6. HepsiJET Payload Oluşturma
    const payload: HepsiJetDeliveryOrderPayload = {
      company: {
        name: settings.companyName || 'KALIPORT',
        abbreviationCode: settings.abbreviationCode || 'KALIPORT',
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
        deliveryTotalPrice: 0,
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

    // 7. HEPSIJET API ÇAĞRISI (Simülasyon veya Canlı)
    let apiResponse: any
    try {
      apiResponse = await sendDeliveryOrderEnhanced(payload)
    } catch (apiError: any) {
      console.error('AutoDispatch HepsiJET API Hatası:', apiError?.message)
      const errorMsg = apiError?.message || 'HepsiJET servisine ulaşılamadı.'
      const isTimeout =
        isAmbiguousHepsiJetError(apiError) ||
        errorMsg.toLowerCase().includes('timeout') ||
        errorMsg.toLowerCase().includes('econnreset') ||
        errorMsg.toLowerCase().includes('timed out') ||
        errorMsg.toLowerCase().includes('belirsiz')

      const failStatus = isTimeout ? 'unknown' : 'failed'

      await orderRef.update({
        'shipping.status': failStatus,
        'shipping.autoDispatchStatus': isTimeout ? 'requires_review' : 'failed',
        'shipping.error': errorMsg,
        'shipping.lastErrorAt': new Date().toISOString(),
        'shipping.lockTimestamp': null,
        updatedAt: new Date().toISOString(),
      })

      return {
        success: false,
        status: isTimeout ? 'requires_review' : 'failed',
        error: errorMsg,
        message: isTimeout
          ? 'Kargo servisi zaman aşımına uğradı. Çift gönderi oluşmaması için yönetici incelemesi bekleniyor.'
          : `Kargo gönderisi oluşturulamadı: ${errorMsg}`,
      }
    }

    // 8. SIMÜLASYON MODU KONTROLÜ
    if (apiResponse?.data?.isSimulated || apiResponse?.isSimulated) {
      const simulatedBarcode = apiResponse.data?.barcode || `HJ${customerDeliveryNo}`
      const simulatedShipping: OrderShippingData = {
        carrier: 'hepsijet',
        status: 'created',
        barcode: simulatedBarcode,
        trackingNumber: simulatedBarcode,
        customerDeliveryNo,
        trackingUrl: '',
        desi: totalDesi,
        weight: totalWeight,
        packageCount,
        senderCity: settings.senderCity,
        createdAt: triggeredAt,
        updatedAt: triggeredAt,
        liveRequestMade: false,
        autoDispatchStatus: 'created',
      }

      await orderRef.set(
        {
          shipping: simulatedShipping,
          status: 'processing',
          updatedAt: triggeredAt,
        },
        { merge: true }
      )

      // Kuyruğa Ekle
      let printJobId = ''
      try {
        const queueRes = await queueShippingLabelJob({
          ...orderData,
          shipping: simulatedShipping,
        })
        if (queueRes.success) {
          printJobId = queueRes.job.jobId
        }
      } catch (qErr: any) {
        console.warn('AutoDispatch print queue warning (simulated):', qErr?.message)
      }

      return {
        success: true,
        status: 'simulated',
        isSimulated: true,
        barcode: simulatedBarcode,
        trackingNumber: simulatedBarcode,
        printJobId,
        message: 'Gönderi simülasyon modunda başarıyla oluşturuldu ve kuyruğa aktarıldı.',
      }
    }

    // 9. GERÇEK CANLI BAŞARILI YANIT
    if (apiResponse?.status !== 'OK') {
      const errMsg = apiResponse?.message || 'HepsiJET servisi gönderi kaydını onaylamadı.'
      await orderRef.update({
        'shipping.status': 'failed',
        'shipping.autoDispatchStatus': 'failed',
        'shipping.error': errMsg,
        'shipping.lastErrorAt': new Date().toISOString(),
        'shipping.lockTimestamp': null,
        updatedAt: new Date().toISOString(),
      })

      return {
        success: false,
        status: 'failed',
        error: errMsg,
        message: `HepsiJET onay vermedi: ${errMsg}`,
      }
    }

    const barcode =
      apiResponse.data?.barcode ||
      apiResponse.data?.trackingNumber ||
      apiResponse.data?.customerDeliveryNo ||
      customerDeliveryNo

    const trackingNumber =
      apiResponse.data?.trackingNumber ||
      apiResponse.data?.barcode ||
      barcode

    const trackingUrl = `https://hepsijet.com/gonderi-takip/${encodeURIComponent(trackingNumber)}`

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
      createdAt: triggeredAt,
      updatedAt: triggeredAt,
      liveRequestMade: true,
      autoDispatchStatus: 'created',
    }

    await orderRef.set(
      {
        shipping: shippingRecord,
        status: 'processing',
        updatedAt: triggeredAt,
      },
      { merge: true }
    )

    // 10. ANINDA TERMAL YAZDIRMA KUYRUĞUNA EKLE
    let printJobId = ''
    try {
      const queueRes = await queueShippingLabelJob({
        ...orderData,
        shipping: shippingRecord,
      })
      if (queueRes.success) {
        printJobId = queueRes.job.jobId
        await orderRef.update({
          'shipping.autoDispatchStatus': 'print_queued',
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (qErr: any) {
      console.warn('AutoDispatch instant print queue warning:', qErr?.message)
    }

    return {
      success: true,
      status: 'created',
      barcode,
      trackingNumber,
      printJobId,
      isSimulated: false,
      message: `HepsiJET gönderisi otomatik olarak oluşturuldu (Barkod: ${barcode}) ve yazdırma kuyruğuna aktarıldı.`,
    }
  } catch (error: any) {
    console.error('processOrderAutoDispatchAndPrint unhandled error:', error)
    return {
      success: false,
      status: 'failed',
      error: error?.message || 'Bilinmeyen sistem hatası.',
      message: `Otomatik gönderi işlemi sırasında bir hata oluştu: ${error?.message || 'Bilinmeyen hata'}`,
    }
  }
}
