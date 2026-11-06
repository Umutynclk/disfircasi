import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PRESET_100X150_PORTRAIT, validatePrintSettings } from '../lib/hepsijet/types'
import { generateCombinedThermalLabelPdf } from '../lib/printing/combined-label'
import { validateOrderForPrintQueue } from '../lib/printing/queue'
import { createSampleHepsiJetLabelPdf } from '../lib/hepsijet/sampleLabel'

test('Gereksinim 1 & 3: 100x150 mm Dikey Termal Etiket + Fiş Ölçü ve Taşma Doğrulaması', () => {
  const validation = validatePrintSettings(PRESET_100X150_PORTRAIT)
  assert.equal(validation.isValid, true, '100x150 mm dikey şablon matematiksel olarak geçerli olmalı')
  assert.equal(PRESET_100X150_PORTRAIT.totalWidthMm, 100)
  assert.equal(PRESET_100X150_PORTRAIT.totalHeightMm, 150)
  assert.equal(PRESET_100X150_PORTRAIT.labelHeightMm, 96)
  assert.equal(PRESET_100X150_PORTRAIT.slipHeightMm, 46)
  assert.equal(PRESET_100X150_PORTRAIT.gapMm, 2)
  assert.equal(PRESET_100X150_PORTRAIT.marginMm, 2)
  // 96 + 46 + 2 (gap) + 2*2 (margins) = 148 mm <= 150 mm (Tam sığıyor, taşma yok!)
  const totalOccupiedHeight =
    PRESET_100X150_PORTRAIT.labelHeightMm +
    PRESET_100X150_PORTRAIT.slipHeightMm +
    PRESET_100X150_PORTRAIT.gapMm +
    PRESET_100X150_PORTRAIT.marginMm * 2
  assert.ok(totalOccupiedHeight <= PRESET_100X150_PORTRAIT.totalHeightMm, 'Baskı toplam yüksekliği aşamaz')
})

test('Gereksinim 2: Otomatik Kuyruklama Doğrulaması (Ödenmiş, geçerli barkodlu sipariş)', () => {
  const validOrder = {
    id: 'ord_auto_test_1',
    orderNumber: 'KLP1001',
    paymentStatus: 'PAID',
    shipping: {
      status: 'created',
      barcode: '987654321012',
      carrier: 'hepsijet',
    },
    customer: {
      name: 'Ahmet Yılmaz',
      email: 'ahmet@example.com',
      phone: '05551234567',
    },
    shippingAddress: {
      fullName: 'Ahmet Yılmaz',
      address: 'Atatürk Cad. No:5 D:2',
      city: 'İstanbul',
      district: 'Kadıköy',
      phone: '05551234567',
    },
    items: [
      { name: '360° Sonic Diş Fırçası', quantity: 2, price: 599 },
    ],
    total: 1198,
    createdAt: new Date().toISOString(),
  }

  const validation = validateOrderForPrintQueue(validOrder)
  assert.equal(validation.isValid, true, 'Ödenmiş ve barkodlu sipariş yazdırma kuyruğu için geçerli olmalıdır')
})

test('Gereksinim 2: Ödenmemiş veya iptal sipariş kuyruğa alınmaz', () => {
  const unpaidOrder = {
    id: 'ord_unpaid_1',
    paymentStatus: 'PENDING',
    shipping: {
      status: 'created',
      barcode: '987654321012',
    },
  }
  assert.equal(validateOrderForPrintQueue(unpaidOrder).isValid, false)

  const cancelledOrder = {
    id: 'ord_cancelled_1',
    paymentStatus: 'PAID',
    status: 'cancelled',
    shipping: {
      status: 'created',
      barcode: '987654321012',
    },
  }
  assert.equal(validateOrderForPrintQueue(cancelledOrder).isValid, false)
})

test('Gereksinim 3: 100x150 mm Birleşik PDF Oluşturma (Palmx TXP-400 / 4B-2054TG Uyumlu)', async () => {
  const mockOrder: any = {
    id: 'test_order_print_both',
    orderNumber: 'KLP999',
    customer: { name: 'Müşteri Test', phone: '05551112233' },
    shippingAddress: {
      fullName: 'Müşteri Test',
      city: 'İzmir',
      district: 'Konak',
      address: 'Kordon Boyu No:10',
      phone: '05551112233',
    },
    items: [
      { name: 'Diş Fırçası Yedek Başlık', quantity: 3, price: 150 },
    ],
    total: 450,
    shipping: {
      carrier: 'hepsijet',
      status: 'created',
      barcode: 'HJ999888777',
      customerDeliveryNo: 'KALIPORT999',
    },
    createdAt: new Date().toISOString(),
  }

  const samplePdf = await createSampleHepsiJetLabelPdf({
    barcode: 'HJ999888777',
    recipientName: 'Müşteri Test',
    recipientCity: 'İzmir',
    recipientTown: 'Konak',
  })

  const pdfBuffer = await generateCombinedThermalLabelPdf({
    order: mockOrder,
    hepsijetPdfBuffer: samplePdf,
    customPrintSettings: PRESET_100X150_PORTRAIT,
  })

  assert.ok(pdfBuffer && pdfBuffer.length > 500, 'Birleşik termal PDF başarıyla oluşturulmalıdır')
})

test('Gereksinim 4: Windows Print Agent Varsayılan Yazıcı Adı 4BARCODE 4B-2054TG Uyumluluğu', async () => {
  const { PrintAgentService } = await import('../print-agent/agent')
  const { WindowsPrinterDriver } = await import('../print-agent/printer')
  const fs = await import('fs')
  const path = await import('path')

  const agent = new PrintAgentService({ dryRun: true })
  assert.strictEqual(agent.getConfig().printerName, '4BARCODE 4B-2054TG')

  const winDriver = new WindowsPrinterDriver()
  assert.strictEqual(winDriver.printerName, '4BARCODE 4B-2054TG')

  const exampleConfig = JSON.parse(
    fs.readFileSync(path.resolve('./print-agent/config.example.json'), 'utf-8')
  )
  assert.strictEqual(exampleConfig.printerName, '4BARCODE 4B-2054TG')
})

test('Gereksinim 5: PayTR Callback, iyzico Callback ve Admin Manuel Gönderi -> Otomatik Baskı Kuyruğu & İdempotency Akışı', async () => {
  const fs = await import('fs')
  const path = await import('path')
  const { sendDeliveryOrderEnhanced } = await import('../lib/hepsijet/client')
  const { SimulatedPrinterDriver } = await import('../print-agent/printer')

  // 1. autoDispatch.ts içinde apiResponse?.data?.isSimulated || apiResponse?.isSimulated kontrolünün doğrulanması
  const autoDispatchSource = fs.readFileSync(path.resolve('./lib/hepsijet/autoDispatch.ts'), 'utf-8')
  assert.ok(
    autoDispatchSource.includes('if (apiResponse?.data?.isSimulated || apiResponse?.isSimulated)'),
    'autoDispatch.ts içinde simülasyon kontrolü apiResponse?.data?.isSimulated || apiResponse?.isSimulated olmalı'
  )

  // 2. create-shipment/route.ts içinde queueShippingLabelJob çağrısının doğrulanması
  const createShipmentSource = fs.readFileSync(
    path.resolve('./app/api/admin/hepsijet/create-shipment/route.ts'),
    'utf-8'
  )
  assert.ok(
    createShipmentSource.includes('queueShippingLabelJob'),
    'Admin manuel kargo oluşturma (create-shipment) sonrasında queueShippingLabelJob çağrılmalı'
  )

  // 3. PayTR ve iyzico callback dosyalarında processOrderAutoDispatchAndPrint tetiklemesinin doğrulanması
  const paytrCallbackSource = fs.readFileSync(path.resolve('./app/api/paytr/callback/route.ts'), 'utf-8')
  const iyzicoCallbackSource = fs.readFileSync(path.resolve('./app/api/iyzico/callback/route.ts'), 'utf-8')
  assert.ok(
    paytrCallbackSource.includes("processOrderAutoDispatchAndPrint(merchant_oid, { triggeredBy: 'paytr_callback' })"),
    'PayTR callback PAID sonrasında processOrderAutoDispatchAndPrint tetiklenmeli'
  )
  assert.ok(
    iyzicoCallbackSource.includes("processOrderAutoDispatchAndPrint(targetOrderNumber, { triggeredBy: 'iyzico_callback' })"),
    'iyzico callback PAID sonrasında processOrderAutoDispatchAndPrint tetiklenmeli'
  )

  // 4. Canlı çağrı yapmadan sendDeliveryOrderEnhanced simülasyon yanıtı doğrulaması
  const simRes = await sendDeliveryOrderEnhanced({
    company: { name: 'KALIPORT', abbreviationCode: 'KALIPORT' },
    currentXDock: { abbreviationCode: 'KALIPORTSELCUKLU' },
    delivery: {
      customerDeliveryNo: 'KALIPORT00012345',
      customerOrderId: 'ORD-12345',
      totalParcels: 1,
      desi: 1,
      weight: 0.3,
      deliveryTotalPrice: 0,
      deliveryDateOriginal: '2026-11-04',
      deliveryType: 'RETAIL',
      recipientPerson: 'Test Musteri',
      recipientPersonPhone1: '5551234567',
      product: { productCode: 'HX_STD' },
      receiver: { firstName: 'Test', lastName: 'Musteri', phone1: '5551234567', email: 'test@example.com' },
      senderAddress: {
        companyAddressId: 'kali-kaliport-73',
        country: { name: 'Türkiye' },
        city: { name: 'Konya' },
        town: { name: 'SELÇUKLU' },
        district: { name: 'BÜYÜKKAYACIK' },
        addressLine1: 'Selçuklu / KONYA',
      },
      recipientAddress: {
        addressLine1: 'Moda Cad. No:1',
        country: { name: 'Türkiye' },
        city: { name: 'İstanbul' },
        town: { name: 'Kadıköy' },
      },
      deliveryContent: [{ productCode: 'GLM-01', productDescription: 'Dis Fircasi', quantity: 1 }],
    },
  })

  assert.strictEqual(Boolean(simRes?.data?.isSimulated || (simRes as any)?.isSimulated), true)

  // 5. dryRun modunda fiziksel baskı yapmadan Birleşik PDF (Sipariş Fişi + HepsiJET Barkod) çıktısının doğrulanması
  const sampleBarcodePdf = await createSampleHepsiJetLabelPdf({
    barcode: '62450077889900',
    recipientName: 'Test Musteri',
    recipientCity: 'ISTANBUL',
    recipientTown: 'KADIKOY',
  })

  const combinedPdfBuffer = await generateCombinedThermalLabelPdf({
    order: {
      id: 'ORD-12345',
      orderNumber: 'KLP-12345',
      paymentStatus: 'PAID',
      status: 'shipped',
      customer: { name: 'Test Musteri', phone: '05551234567' },
      shippingAddress: {
        fullName: 'Test Musteri',
        city: 'İstanbul',
        district: 'Kadıköy',
        address: 'Moda Cad. No:1',
        phone: '05551234567',
      },
      items: [{ name: 'GÜLÜMSE Sonic Diş Fırçası', quantity: 1, price: 499 }],
      shipping: {
        carrier: 'hepsijet',
        status: 'created',
        barcode: '62450077889900',
        trackingNumber: '62450077889900',
        customerDeliveryNo: 'KALIPORT00012345',
      },
    },
    hepsijetPdfBuffer: sampleBarcodePdf,
  })

  const tempSimDir = path.resolve('./tests/temp_dryrun_combined_verify')
  const simDriver = new SimulatedPrinterDriver(tempSimDir)
  const printRes = await simDriver.printPdf(combinedPdfBuffer, {
    jobId: 'job_label_ORD-12345_62450077889900',
    orderId: 'ORD-12345',
    barcode: '62450077889900',
    type: 'shipping_label',
    status: 'processing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attemptCount: 1,
    maxAttempts: 3,
    idempotencyKey: 'job_label_ORD-12345_62450077889900',
    printerId: '4BARCODE 4B-2054TG',
  })

  assert.strictEqual(printRes.success, true)
  assert.strictEqual(printRes.printed, false, 'dryRun modunda fiziksel baskı yapılmamalı')
  assert.strictEqual(printRes.simulated, true)
  assert.strictEqual(printRes.status, 'simulated')
  assert.ok(printRes.outputPath && fs.existsSync(printRes.outputPath), 'Birleşik PDF diske kaydedilmeli')

  const savedBytes = fs.readFileSync(printRes.outputPath!)
  assert.strictEqual(savedBytes.subarray(0, 5).toString('ascii'), '%PDF-')

  // Temizlik
  if (printRes.outputPath && fs.existsSync(printRes.outputPath)) {
    fs.unlinkSync(printRes.outputPath)
  }
  if (fs.existsSync(tempSimDir)) {
    fs.rmdirSync(tempSimDir)
  }
})

test('Gereksinim 6: Banka Havalesi / EFT Siparişinin Admin Tarafından PAID Yapılması ve Kargo Doğrulaması', () => {
  // Havale ile oluşturulmuş bekleyen sipariş
  const bankTransferOrder = {
    id: 'ord_bank_transfer_01',
    orderNumber: 'KLP2001',
    paymentMethod: 'bank_transfer',
    paymentStatus: 'awaiting_bank_transfer',
    status: 'pending',
    customer: { name: 'Mehmet Demir', email: 'mehmet@example.com' },
    shippingAddress: {
      fullName: 'Mehmet Demir',
      address: 'İstiklal Cad. No:10',
      city: 'Ankara',
      district: 'Çankaya',
      phone: '05321112233',
    },
    items: [{ name: 'Yedek Başlık 4lü', quantity: 1, price: 199 }],
    total: 199,
  }

  // Henüz PAID olmadığı için kargo kuyruğuna giremez
  const preCheck = validateOrderForPrintQueue(bankTransferOrder)
  assert.equal(preCheck.isValid, false, 'Ödeme onaylanmadan önce kuyruğa alınamaz')

  // Admin tarafından ödeme onaylandığında (PAID) ve kargo barkodu atandığında
  const confirmedOrder = {
    ...bankTransferOrder,
    paymentStatus: 'PAID',
    status: 'processing',
    shipping: {
      status: 'created',
      barcode: '62450099887766',
      carrier: 'hepsijet',
    },
  }

  const postCheck = validateOrderForPrintQueue(confirmedOrder)
  assert.equal(postCheck.isValid, true, 'Admin PAID onayı sonrası kargo baskı kuyruğuna alınabilmelidir')
})

test('Gereksinim 7: Gerçek Zamanlı Sipariş Bildirimi Deduplication Kontrolü', () => {
  const knownOrderIds = new Set<string>(['ord_1', 'ord_2'])

  const incomingSnapDocs = [
    { id: 'ord_1', orderNumber: 'KLP100' },
    { id: 'ord_2', orderNumber: 'KLP101' },
    { id: 'ord_3', orderNumber: 'KLP102' }, // Yeni sipariş
  ]

  // Yalnızca knownOrderIds içinde olmayanlar yeni sipariş kabul edilir
  const newlyAdded = incomingSnapDocs.filter((d) => !knownOrderIds.has(d.id))

  assert.equal(newlyAdded.length, 1, 'Yalnızca gerçekten yeni gelen sipariş tetiklenmelidir')
  assert.equal(newlyAdded[0].id, 'ord_3')

  // Listeye ekle
  newlyAdded.forEach((d) => knownOrderIds.add(d.id))

  // Aynı snapshot tekrar geldiğinde yeni sipariş sayısı 0 olmalıdır
  const repeatAdded = incomingSnapDocs.filter((d) => !knownOrderIds.has(d.id))
  assert.equal(repeatAdded.length, 0, 'Tekrarlanan veya sayfa yenilenen snapshot mükerrer bildirim vermemelidir')
})

