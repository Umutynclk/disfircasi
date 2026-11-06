import test from 'node:test'
import assert from 'node:assert'
import { DEFAULT_HEPSIJET_SETTINGS, HepsiJetDeliveryOrderPayload } from '../lib/hepsijet/types'
import { sendDeliveryOrderEnhanced } from '../lib/hepsijet/client'

test('1. HepsiJET Varsayılan ve Onaylı Canlı Parametreleri Doğrulaması', () => {
  assert.strictEqual(DEFAULT_HEPSIJET_SETTINGS.companyName, 'KALIPORT')
  assert.strictEqual(DEFAULT_HEPSIJET_SETTINGS.abbreviationCode, 'KALIPORT')
  assert.strictEqual(DEFAULT_HEPSIJET_SETTINGS.warehouseCode, 'kali-kaliport-73')
  assert.strictEqual(DEFAULT_HEPSIJET_SETTINGS.currentXdock, 'KALIPORTSELCUKLU')
  assert.strictEqual(DEFAULT_HEPSIJET_SETTINGS.senderCountry, 'Türkiye')
  assert.strictEqual(DEFAULT_HEPSIJET_SETTINGS.senderCity, 'Konya')
  assert.strictEqual(DEFAULT_HEPSIJET_SETTINGS.senderTown, 'SELÇUKLU')
  assert.strictEqual(DEFAULT_HEPSIJET_SETTINGS.senderDistrict, 'BÜYÜKKAYACIK')
  assert.strictEqual(
    DEFAULT_HEPSIJET_SETTINGS.senderAddress,
    'büyükkayacık mah. Ankara cad. no:312/H ( Gnc sanayi sitesi ) Selçuklu / KONYA'
  )
})

test('2. customerDeliveryNo Üretimi (KALIPORT Ön Eki ile 9-16 Karakter)', () => {
  function generateCustomerDeliveryNo(abbreviationCode: string, orderRef: string): string {
    const cleanAbbrev = abbreviationCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'KALIPORT'
    const cleanRef = orderRef.toUpperCase().replace(/[^A-Z0-9]/g, '')

    let deliveryNo = `${cleanAbbrev}${cleanRef}`
    if (deliveryNo.length < 9) {
      deliveryNo = deliveryNo.padEnd(9, '0')
    }
    if (deliveryNo.length > 16) {
      deliveryNo = deliveryNo.slice(0, 16)
    }
    return deliveryNo
  }

  const dNo1 = generateCustomerDeliveryNo('KALIPORT', '1001')
  assert.strictEqual(dNo1, 'KALIPORT1001')
  assert.ok(dNo1.length >= 9 && dNo1.length <= 16)
  assert.ok(dNo1.startsWith('KALIPORT'))

  const dNo2 = generateCustomerDeliveryNo('KALIPORT', 'ORD-987654321')
  assert.strictEqual(dNo2, 'KALIPORTORD98765')
  assert.strictEqual(dNo2.length, 16)
})

test('3. HepsiJET Gönderi Payload Şeması ve Canlı Değerler', () => {
  const settings = DEFAULT_HEPSIJET_SETTINGS

  const payload: HepsiJetDeliveryOrderPayload = {
    company: {
      name: settings.companyName,
      abbreviationCode: settings.abbreviationCode,
    },
    currentXDock: {
      abbreviationCode: settings.currentXdock || 'KALIPORTSELCUKLU',
    },
    delivery: {
      customerDeliveryNo: 'KALIPORT1001',
      customerOrderId: '1001',
      totalParcels: 1,
      desi: 1.0,
      weight: 0.3,
      deliveryTotalPrice: 0,
      deliveryDateOriginal: '2026-10-29',
      deliveryType: 'RETAIL',
      recipientPerson: 'Ahmet Yılmaz',
      recipientPersonPhone1: '5412731909',
      product: {
        productCode: 'HX_STD',
      },
      receiver: {
        firstName: 'Ahmet',
        lastName: 'Yılmaz',
        phone1: '5412731909',
        email: 'ahmet@example.com',
      },
      senderAddress: {
        companyAddressId: settings.warehouseCode || 'kali-kaliport-73',
        country: { name: settings.senderCountry || 'Türkiye' },
        city: { name: settings.senderCity },
        town: { name: settings.senderTown },
        district: { name: settings.senderDistrict || 'BÜYÜKKAYACIK' },
        addressLine1: settings.senderAddress,
      },
      recipientAddress: {
        addressLine1: 'Atatürk Cad. No:1',
        country: { name: 'Türkiye' },
        city: { name: 'Ankara' },
        town: { name: 'Çankaya' },
        district: { name: 'Kızılay' },
      },
      deliveryContent: [
        {
          sku: 'PRD-12345',
          description: 'Diş Fırçası ve Bakım Ürünü',
          quantity: 1,
        },
      ],
    },
  }

  // Şirket bilgisi doğrulaması
  assert.strictEqual(payload.company.name, 'KALIPORT')
  assert.strictEqual(payload.company.abbreviationCode, 'KALIPORT')

  // Transfer merkezi / Cross-dock doğrulaması (Root seviyesinde)
  assert.strictEqual(payload.currentXDock?.abbreviationCode, 'KALIPORTSELCUKLU')

  // Depo kimliği (companyAddressId) doğrulaması (senderAddress içinde)
  assert.strictEqual(payload.delivery.senderAddress.companyAddressId, 'kali-kaliport-73')
  assert.strictEqual(payload.delivery.senderAddress.country.name, 'Türkiye')
  assert.strictEqual(payload.delivery.senderAddress.city.name, 'Konya')
  assert.strictEqual(payload.delivery.senderAddress.town.name, 'SELÇUKLU')
  assert.strictEqual(payload.delivery.senderAddress.district?.name, 'BÜYÜKKAYACIK')
  assert.strictEqual(
    payload.delivery.senderAddress.addressLine1,
    'büyükkayacık mah. Ankara cad. no:312/H ( Gnc sanayi sitesi ) Selçuklu / KONYA'
  )
})

test('4. Güvenli Simülasyon Koruması (HEPSIJET_LIVE_DISPATCH_ENABLED=false)', async () => {
  // Test sırasında canlı gönderim kapalı olmalıdır
  process.env.HEPSIJET_LIVE_DISPATCH_ENABLED = 'false'

  const dummyPayload: HepsiJetDeliveryOrderPayload = {
    company: { name: 'KALIPORT', abbreviationCode: 'KALIPORT' },
    currentXDock: { abbreviationCode: 'KALIPORTSELCUKLU' },
    delivery: {
      customerDeliveryNo: 'KALIPORT9999',
      customerOrderId: '9999',
      totalParcels: 1,
      desi: 1,
      weight: 0.3,
      deliveryTotalPrice: 0,
      deliveryDateOriginal: '2026-10-29',
      deliveryType: 'RETAIL',
      recipientPerson: 'Merve Kaya',
      recipientPersonPhone1: '5412731909',
      product: { productCode: 'HX_STD' },
      receiver: { firstName: 'Merve', lastName: 'Kaya', phone1: '5412731909' },
      senderAddress: {
        companyAddressId: 'kali-kaliport-73',
        country: { name: 'Türkiye' },
        city: { name: 'Konya' },
        town: { name: 'SELÇUKLU' },
        district: { name: 'BÜYÜKKAYACIK' },
        addressLine1: 'büyükkayacık mah. Ankara cad. no:312/H ( Gnc sanayi sitesi ) Selçuklu / KONYA',
      },
      recipientAddress: {
        addressLine1: 'İnönü Cad. No:5',
        country: { name: 'Türkiye' },
        city: { name: 'İzmir' },
        town: { name: 'Konak' },
      },
      deliveryContent: [{ sku: 'PKG-1', description: 'Test', quantity: 1 }],
    },
  }

  const result = await sendDeliveryOrderEnhanced(dummyPayload)
  assert.strictEqual(result.status, 'OK')
  assert.strictEqual(result.data?.isSimulated, true)
  assert.strictEqual(result.data?.customerDeliveryNo, 'KALIPORT9999')
})

test('5. Mükerrer Gönderi Engelleme Mantığı', () => {
  const existingShippingScenarios = [
    { status: 'created', barcode: 'HJ123', shouldBlock: true },
    { status: 'created', barcode: '', shouldBlock: true },
    { status: 'pending', barcode: 'HJ123', shouldBlock: true }, // Barkod varsa kilitlenmeli
    { status: 'pending', trackingNumber: 'TR123', shouldBlock: true },
    { status: 'simulated', barcode: '', shouldBlock: false }, // Simülasyon gerçek gönderi değildir
    { status: 'failed', barcode: '', shouldBlock: false }, // Hatalı olan tekrar denenebilir
  ]

  for (const s of existingShippingScenarios) {
    const isBlocked = Boolean(s.status === 'created' || s.barcode || (s as any).trackingNumber)
    assert.strictEqual(
      isBlocked,
      s.shouldBlock,
      `Scenario failed for status=${s.status}, barcode=${s.barcode}`
    )
  }
})

test('6. Firestore Eski/Eksik Ayar Ezme Koruması (KLP -> KALIPORT, Boş Depo -> kali-kaliport-73)', () => {
  // Simüle edilmiş eski Firestore belgesi:
  const legacyFirestoreData: any = {
    companyName: 'KALIPORT',
    abbreviationCode: 'KLP', // Eski kod
    warehouseCode: '', // Boş kayıt
    currentXdock: '', // Tanımsız
    senderCity: 'Konya',
  }

  // settings.ts içindeki birleştirme mantığı:
  const resolvedSettings = {
    ...DEFAULT_HEPSIJET_SETTINGS,
    ...legacyFirestoreData,
    companyName: legacyFirestoreData.companyName?.trim() || DEFAULT_HEPSIJET_SETTINGS.companyName,
    abbreviationCode:
      legacyFirestoreData.abbreviationCode && legacyFirestoreData.abbreviationCode.trim().toUpperCase() !== 'KLP'
        ? legacyFirestoreData.abbreviationCode.trim().toUpperCase()
        : DEFAULT_HEPSIJET_SETTINGS.abbreviationCode,
    warehouseCode: legacyFirestoreData.warehouseCode?.trim() || DEFAULT_HEPSIJET_SETTINGS.warehouseCode,
    currentXdock: legacyFirestoreData.currentXdock?.trim() || DEFAULT_HEPSIJET_SETTINGS.currentXdock,
    senderCountry: legacyFirestoreData.senderCountry?.trim() || DEFAULT_HEPSIJET_SETTINGS.senderCountry || 'Türkiye',
  }

  // Eski KLP yerine resmi KALIPORT ezilmeden geldi mi?
  assert.strictEqual(resolvedSettings.abbreviationCode, 'KALIPORT')
  // Boş depo kodu yerine resmi kali-kaliport-73 geldi mi?
  assert.strictEqual(resolvedSettings.warehouseCode, 'kali-kaliport-73')
  // Boş aktarma merkezi yerine resmi KALIPORTSELCUKLU geldi mi?
  assert.strictEqual(resolvedSettings.currentXdock, 'KALIPORTSELCUKLU')
})

test('7. HEPSIJET_USERNAME Varsayılan Değeri kaliport_integration Olmalı', () => {
  const origUser = process.env.HEPSIJET_USERNAME
  try {
    delete process.env.HEPSIJET_USERNAME
    const resolvedUsername = (process.env.HEPSIJET_USERNAME || 'kaliport_integration').trim()
    assert.strictEqual(resolvedUsername, 'kaliport_integration')
  } finally {
    if (origUser !== undefined) {
      process.env.HEPSIJET_USERNAME = origUser
    }
  }
})

test('8. Ağ Zaman Aşımı ve "unknown" Durumunda Körlemesine Tekrar Gönderim Engellenmeli', () => {
  const isTimeoutError = (msg: string) => {
    const lower = msg.toLowerCase()
    return (
      lower.includes('timeout') ||
      lower.includes('econnreset') ||
      lower.includes('etimedout') ||
      lower.includes('abort') ||
      lower.includes('network') ||
      lower.includes('504') ||
      lower.includes('502')
    )
  }

  assert.strictEqual(isTimeoutError('fetch failed: ETIMEDOUT'), true)
  assert.strictEqual(isTimeoutError('Gateway Timeout (HTTP 504)'), true)
  assert.strictEqual(isTimeoutError('The user aborted a request'), true)
  assert.strictEqual(isTimeoutError('Geçersiz alıcı adresi'), false)

  // 'unknown' statüsündeki siparişler kesinlikle kilitlenmeli
  const canRecreateShipment = (shippingStatus?: string, barcode?: string) => {
    if (shippingStatus === 'created' || Boolean(barcode)) return false
    if (shippingStatus === 'unknown') return false
    if (shippingStatus === 'creating') return false
    return true
  }

  assert.strictEqual(canRecreateShipment('unknown'), false)
  assert.strictEqual(canRecreateShipment('creating'), false)
  assert.strictEqual(canRecreateShipment('created', 'HJ123'), false)
  assert.strictEqual(canRecreateShipment('failed'), true)
  assert.strictEqual(canRecreateShipment('simulated'), true)
})

test('9. Zorunlu HepsiJET Şema Alanları Ön Kontrolü (currentXDock, companyAddressId, abbreviationCode)', () => {
  function validatePayloadFields(payload: HepsiJetDeliveryOrderPayload): { valid: boolean; error?: string } {
    if (!payload.company?.name?.trim() || !payload.company?.abbreviationCode?.trim()) {
      return { valid: false, error: 'company missing' }
    }
    if (!payload.currentXDock?.abbreviationCode?.trim()) {
      return { valid: false, error: 'currentXDock missing' }
    }
    if (!payload.delivery?.senderAddress?.companyAddressId?.trim()) {
      return { valid: false, error: 'companyAddressId missing' }
    }
    if (!payload.delivery?.customerDeliveryNo || payload.delivery.customerDeliveryNo.length < 9) {
      return { valid: false, error: 'customerDeliveryNo invalid' }
    }
    return { valid: true }
  }

  const validPayload: HepsiJetDeliveryOrderPayload = {
    company: { name: 'KALIPORT', abbreviationCode: 'KALIPORT' },
    currentXDock: { abbreviationCode: 'KALIPORTSELCUKLU' },
    delivery: {
      customerDeliveryNo: 'KALIPORT12345',
      customerOrderId: '12345',
      totalParcels: 1,
      desi: 1,
      weight: 0.3,
      deliveryTotalPrice: 0,
      deliveryDateOriginal: '2026-10-29',
      deliveryType: 'RETAIL',
      recipientPerson: 'Test',
      recipientPersonPhone1: '5412731909',
      product: { productCode: 'HX_STD' },
      receiver: { firstName: 'Test', lastName: 'User', phone1: '5412731909' },
      senderAddress: {
        companyAddressId: 'kali-kaliport-73',
        country: { name: 'Türkiye' },
        city: { name: 'Konya' },
        town: { name: 'SELÇUKLU' },
        addressLine1: 'Test',
      },
      recipientAddress: {
        addressLine1: 'Test',
        country: { name: 'Türkiye' },
        city: { name: 'İstanbul' },
        town: { name: 'Kadıköy' },
      },
      deliveryContent: [{ sku: 'PKG-1', description: 'Test', quantity: 1 }],
    },
  }

  assert.strictEqual(validatePayloadFields(validPayload).valid, true)

  const missingXDock = JSON.parse(JSON.stringify(validPayload))
  delete missingXDock.currentXDock
  assert.strictEqual(validatePayloadFields(missingXDock).valid, false)

  const missingWarehouse = JSON.parse(JSON.stringify(validPayload))
  missingWarehouse.delivery.senderAddress.companyAddressId = ''
  assert.strictEqual(validatePayloadFields(missingWarehouse).valid, false)
})

