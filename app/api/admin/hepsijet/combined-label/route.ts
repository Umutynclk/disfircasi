import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { getHepsiJetSettingsServer } from '@/lib/hepsijet/settings'
import { fetchHepsiJetBarcodeLabel } from '@/lib/hepsijet/client'
import { createSampleHepsiJetLabelPdf } from '@/lib/hepsijet/sampleLabel'
import { generateCombinedThermalLabelPdf, OrderForCombinedLabel } from '@/lib/printing/combined-label'
import {
  DEFAULT_PRINT_SETTINGS,
  PRESET_100X150_PORTRAIT,
  ThermalPrintSettings,
  ThermalPrintPreset,
  validatePrintSettings,
} from '@/lib/hepsijet/types'

export async function GET(req: NextRequest) {
  // 1. Yönetici Yetkilendirmesi (Bearer Token)
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const orderId = searchParams.get('orderId')
  const isDownload = searchParams.get('download') === 'true'
  const isSamplePreview = orderId === 'sample' || searchParams.get('sample') === 'true'
  const presetParam = searchParams.get('preset') as ThermalPrintPreset | null

  try {
    const settings = await getHepsiJetSettingsServer()

    // 2. TEST / ÖRNEK ÖNİZLEME MODU (Ayarlar sayfasından canlı test için)
    if (isSamplePreview) {
      const sampleOrder: OrderForCombinedLabel = {
        id: 'GS-TEST-SAMPLE',
        orderNumber: 'GS-SAMPLE-01',
        createdAt: new Date().toISOString(),
        status: 'shipped',
        paymentStatus: 'PAID',
        paymentMethod: 'credit_card',
        totalAmount: 499.0,
        customer: {
          name: 'Ahmet Yılmaz',
          phone: '05551234567',
          email: 'ahmet@example.com',
        },
        shippingAddress: {
          fullName: 'Ahmet Yılmaz',
          phone: '05551234567',
          city: 'İSTANBUL',
          district: 'Kadıköy',
          town: 'Kadıköy',
          address: 'Caferağa Mah. Moda Cad. No: 42 D: 5',
        },
        items: [
          {
            name: 'GÜLÜMSE 360° Sonic Otomatik Diş Fırçası',
            quantity: 1,
            selectedColor: { name: 'Mat Siyah' },
            sku: 'GLM-SNC-BLK',
            price: 399.0,
          },
          {
            name: 'Yedek Antibakteriyel Başlık (2 Adet)',
            quantity: 2,
            selectedColor: { name: 'Standart Beyaz' },
            sku: 'GLM-BASC-02',
            price: 50.0,
          },
        ],
        shipping: {
          carrier: 'hepsijet',
          barcode: 'HJ9876543210TR',
          trackingNumber: 'HJ9876543210TR',
          desi: settings.defaultDesi || 1,
          weight: settings.defaultWeight || 0.3,
          packageCount: settings.defaultPackageCount || 1,
        },
        notes: 'Lütfen kapıya bırakmayınız, zile basınız.',
      }

      // Preset'e göre önizleme baskı ayarlarını belirle (kaydedilmiş ayarları değiştirmez)
      let previewPrintOverride: Partial<ThermalPrintSettings> | undefined
      if (presetParam === '100x150_portrait') {
        previewPrintOverride = { ...PRESET_100X150_PORTRAIT }
      } else if (presetParam === '150x100_landscape') {
        previewPrintOverride = { ...DEFAULT_PRINT_SETTINGS }
      }
      // presetParam yoksa veya 'custom' ise → kaydedilmiş ayarlar kullanılır

      // Önizleme ölçülerini doğrula
      const previewPs = {
        ...(settings.printSettings || DEFAULT_PRINT_SETTINGS),
        ...(previewPrintOverride || {}),
      }
      const previewValidation = validatePrintSettings(previewPs)
      if (!previewValidation.isValid) {
        return NextResponse.json(
          { success: false, error: `Baskı ölçü hatası: ${previewValidation.error}` },
          { status: 400 }
        )
      }

      const sampleHepsiJetLabel = await createSampleHepsiJetLabelPdf({
        barcode: 'HJ9876543210TR',
        recipientName: sampleOrder.shippingAddress?.fullName,
        recipientCity: sampleOrder.shippingAddress?.city,
        recipientTown: sampleOrder.shippingAddress?.town,
        recipientAddress: sampleOrder.shippingAddress?.address,
        senderCompany: settings.companyName,
        senderCity: settings.senderCity,
        desi: sampleOrder.shipping?.desi,
        weight: sampleOrder.shipping?.weight,
      })

      const combinedBuffer = await generateCombinedThermalLabelPdf({
        order: sampleOrder,
        hepsijetPdfBuffer: sampleHepsiJetLabel,
        settings,
        customPrintSettings: previewPrintOverride,
      })

      return new NextResponse(combinedBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': isDownload
            ? 'attachment; filename="kaliport-hepsijet-ornek-etiket.pdf"'
            : 'inline; filename="kaliport-hepsijet-ornek-etiket.pdf"',
          'Cache-Control': 'no-store, must-revalidate',
        },
      })
    }

    // 3. GERÇEK SİPARİŞİ FIRESTORE'DAN GETİR
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Sipariş Kimliği (orderId) zorunludur.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    let docSnap = await db.collection('orders').doc(orderId).get()

    if (!docSnap.exists) {
      const qNum = await db.collection('orders').where('orderNumber', '==', orderId).limit(1).get()
      if (!qNum.empty) {
        docSnap = qNum.docs[0]
      } else {
        const qOid = await db.collection('orders').where('merchant_oid', '==', orderId).limit(1).get()
        if (!qOid.empty) {
          docSnap = qOid.docs[0]
        } else {
          const qId = await db.collection('orders').where('id', '==', orderId).limit(1).get()
          if (!qId.empty) {
            docSnap = qId.docs[0]
          }
        }
      }
    }

    if (!docSnap.exists) {
      return NextResponse.json({ success: false, error: 'Sipariş bulunamadı.' }, { status: 404 })
    }

    const orderData = { ...docSnap.data(), id: docSnap.id } as OrderForCombinedLabel
    const targetBarcode = orderData.shipping?.barcode || orderData.shipping?.customerDeliveryNo

    if (!targetBarcode || orderData.shipping?.status !== 'created') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Bu sipariş için henüz aktif ve onaylanmış bir HepsiJET kargo barkodu (status: created) bulunmamaktadır. Lütfen önce "HepsiJET Kargo Oluştur" adımını tamamlayın.',
        },
        { status: 400 }
      )
    }

    if (
      orderData.shipping?.liveRequestMade !== true &&
      (targetBarcode.startsWith('HJKLP') || targetBarcode.startsWith('HJTEST'))
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Bu sipariş simülasyon modunda oluşturulmuştur ve simülasyon barkodu taşımaktadır. Canlı HepsiJET sisteminde bu barkod mevcut olmadığından etiket alınamaz.',
        },
        { status: 400 }
      )
    }

    // 4. HEPSIJET KARGO ETİKETİNİ AL
    const { data: labelData } = await fetchHepsiJetBarcodeLabel([targetBarcode], 'PDF')
    const hepsijetBuffer = Buffer.isBuffer(labelData) ? labelData : Buffer.from(labelData as string)

    // 5. BİRLEŞİK TERMAL BASKI ETİKETİNİ ÜRET (Seçili preset veya kayıtlı ayarlar)
    let printOverride: Partial<ThermalPrintSettings> | undefined
    if (presetParam === '100x150_portrait') {
      printOverride = { ...PRESET_100X150_PORTRAIT }
    } else if (presetParam === '150x100_landscape') {
      printOverride = { ...DEFAULT_PRINT_SETTINGS }
    }

    const targetPrintSettings = {
      ...(settings.printSettings || DEFAULT_PRINT_SETTINGS),
      ...(printOverride || {}),
    }
    const validation = validatePrintSettings(targetPrintSettings)
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: `Baskı ölçü hatası: ${validation.error}` },
        { status: 400 }
      )
    }

    const combinedBuffer = await generateCombinedThermalLabelPdf({
      order: orderData,
      hepsijetPdfBuffer: hepsijetBuffer,
      settings,
      customPrintSettings: printOverride,
    })

    const safeFilename = `birlesik-etiket-${orderData.orderNumber || targetBarcode}.pdf`

    return new NextResponse(combinedBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': isDownload
          ? `attachment; filename="${safeFilename}"`
          : `inline; filename="${safeFilename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('Combined label generation error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Birleşik etiket üretilemedi.' },
      { status: 500 }
    )
  }
}
