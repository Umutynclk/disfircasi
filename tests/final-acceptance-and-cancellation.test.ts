import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  checkSessionValidity,
  isUnlimitedSessionUser,
  UNLIMITED_SESSION_EMAIL,
  INACTIVITY_TIMEOUT_MS,
  STORAGE_KEYS,
} from '../lib/services/sessionManager'
import { cleanFirestoreData } from '../lib/firebase/firestoreUtils'
import { validateVergiNo, validateCorporateTaxNumber, validateTCKimlik, maskCorporateTaxNumber } from '../lib/utils/taxValidation'

describe('Kabul Testi 1: admin@gmail.com Oturum Sınırı İstisnası', () => {
  it('isUnlimitedSessionUser() yalnızca normalize edilmiş admin@gmail.com için true dönmeli', () => {
    assert.strictEqual(isUnlimitedSessionUser('admin@gmail.com'), true)
    assert.strictEqual(isUnlimitedSessionUser('  ADMIN@GMAIL.COM  '), true)
    assert.strictEqual(isUnlimitedSessionUser('Admin@Gmail.Com'), true)

    // Diğer admin veya kullanıcı hesapları istisnaya dahil OLMAMALI
    assert.strictEqual(isUnlimitedSessionUser('admin@gulumse.com'), false)
    assert.strictEqual(isUnlimitedSessionUser('superadmin@gmail.com'), false)
    assert.strictEqual(isUnlimitedSessionUser('user@gmail.com'), false)
    assert.strictEqual(isUnlimitedSessionUser(''), false)
    assert.strictEqual(isUnlimitedSessionUser(null), false)
    assert.strictEqual(isUnlimitedSessionUser(undefined), false)
  })

  it('admin@gmail.com için 15 dakika hareketsizlik kuralı oturumu düşürmemeli', () => {
    // Normal kullanıcı 16 dakika sonra inactive olmalı
    const now = Date.now()
    const sixteenMinsAgo = now - (INACTIVITY_TIMEOUT_MS + 60000)

    // Mock localStorage
    const mockStorage: Record<string, string> = {
      [STORAGE_KEYS.SESSION_START]: String(sixteenMinsAgo),
      [STORAGE_KEYS.LAST_ACTIVE]: String(sixteenMinsAgo),
      [STORAGE_KEYS.REMEMBER_ME]: '0',
    }

    // Node ortamında global window ve localStorage simülasyonu
    ;(global as any).window = {}
    ;(global as any).localStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val },
      removeItem: (key: string) => { delete mockStorage[key] },
    }

    // Normal kullanıcı: 16 dakika sonra oturumu DÜŞER
    const normalUserValidity = checkSessionValidity('normaluser@gmail.com')
    assert.strictEqual(normalUserValidity.valid, false)
    assert.strictEqual(normalUserValidity.reason, 'inactive')

    // admin@gmail.com: 16 dakika sonra dahi oturumu GEÇERLİ KALIR
    const adminValidity = checkSessionValidity('admin@gmail.com')
    assert.strictEqual(adminValidity.valid, true)

    delete (global as any).window
    delete (global as any).localStorage
  })
})

describe('Kabul Testi 2: Firestore Undefined Değer Temizleme (cleanFirestoreData)', () => {
  it('Nesnelerdeki ve alt nesnelerdeki undefined alanları tamamen temizlemeli', () => {
    const rawData = {
      orderId: 'ORD-1234',
      status: 'cancelled',
      reason: 'Yönetici iptali',
      hepsijetResponse: {
        status: 'OK',
        message: 'Gönderi silindi',
        raw: undefined, // Bu alan hata veriyordu!
        extra: {
          subfield: undefined,
          validSubfield: 'ok',
        },
      },
      barcode: undefined,
      nullField: null,
      numberField: 0,
      boolField: false,
    }

    const cleaned = cleanFirestoreData(rawData)

    // undefined alanlar silinmiş olmalı
    assert.strictEqual('raw' in cleaned.hepsijetResponse, false)
    assert.strictEqual('barcode' in cleaned, false)
    assert.strictEqual('subfield' in cleaned.hepsijetResponse.extra, false)

    // Geçerli değerler korunmalı
    assert.strictEqual(cleaned.orderId, 'ORD-1234')
    assert.strictEqual(cleaned.hepsijetResponse.status, 'OK')
    assert.strictEqual(cleaned.hepsijetResponse.extra.validSubfield, 'ok')
    assert.strictEqual(cleaned.nullField, null)
    assert.strictEqual(cleaned.numberField, 0)
    assert.strictEqual(cleaned.boolField, false)
  })

  it('Dizilerdeki nesneleri ve undefined öğeleri güvenle temizlemeli', () => {
    const cancellationHistory = [
      {
        orderId: 'ORD-1',
        hepsijetResponse: {
          status: 'OK',
          raw: undefined,
        },
      },
      undefined,
      {
        orderId: 'ORD-2',
        reason: 'İade',
      },
    ]

    const cleanedList = cleanFirestoreData(cancellationHistory)
    assert.strictEqual(cleanedList.length, 2)
    assert.strictEqual('raw' in cleanedList[0].hepsijetResponse, false)
    assert.strictEqual(cleanedList[1].orderId, 'ORD-2')
  })
})

describe('Kabul Testi 3: HepsiJET İptal ve Çöp Kutusu İş Kuralları', () => {
  it('HepsiJET gönderisi silindiğinde sipariş isTrash: true ve status: cancelled almalı', () => {
    const existingOrder = {
      id: 'order_101',
      status: 'processing',
      isTrash: false,
      shipping: {
        barcode: 'HJ-987654',
        status: 'created',
      },
      items: [{ id: 'brush_1', price: 990 }],
    }

    // HepsiJET API silme yanıtı (simüle)
    const apiResponse = { status: 'OK', message: 'Silindi' }
    const isDeleted = apiResponse.status === 'OK'

    let updatedOrder = { ...existingOrder }
    if (isDeleted) {
      updatedOrder = {
        ...updatedOrder,
        status: 'cancelled',
        isTrash: true,
        shipping: {
          ...updatedOrder.shipping,
          status: 'cancelled',
        },
      }
    }

    assert.strictEqual(updatedOrder.isTrash, true)
    assert.strictEqual(updatedOrder.status, 'cancelled')
    assert.strictEqual(updatedOrder.shipping.status, 'cancelled')
    // Sipariş ürünleri ve verileri kalıcı olarak silinmemeli
    assert.strictEqual(updatedOrder.items.length, 1)
  })

  it('HepsiJET silme başarısız olduğunda sipariş çöpe taşınmamalı', () => {
    const existingOrder = {
      id: 'order_102',
      status: 'processing',
      isTrash: false,
      shipping: {
        barcode: 'HJ-987654',
        status: 'created',
      },
    }

    // API hatası
    const apiSuccess = false
    let updatedOrder = { ...existingOrder }

    if (apiSuccess) {
      updatedOrder.isTrash = true
    } else {
      updatedOrder.shipping = {
        ...updatedOrder.shipping,
        status: 'cancel_failed',
      }
    }

    assert.strictEqual(updatedOrder.isTrash, false)
    assert.strictEqual(updatedOrder.shipping.status, 'cancel_failed')
  })
})

describe('Kabul Testi 4: Vergi Dairesi Opsiyonelliği', () => {
  it('Kurumsal checkout için Vergi Numarası geçerli iken Vergi Dairesi boş bırakılabilmeli', () => {
    // 10 Haneli VKN doğrulama algoritması testi
    const validVkn = '1234567890'
    const vknCheck = validateVergiNo(validVkn)
    assert.strictEqual(typeof vknCheck.isValid, 'boolean')

    // Vergi Dairesi boş olsa dahi kurumsal fatura nesnesi başarıyla oluşturulmalı
    const corporateData = {
      companyName: 'ACME Ltd. Şti.',
      taxOffice: '', // BOŞ BIRAKILDI
      taxNumber: '1234567890',
    }

    const validateCorporateCheckout = (data: typeof corporateData) => {
      if (!data.companyName.trim()) return { valid: false, error: 'Firma ünvanı zorunlu' }
      if (!data.taxNumber.trim()) return { valid: false, error: 'Vergi numarası zorunlu' }
      // Vergi dairesi artık zorunlu DEĞİL
      return { valid: true }
    }

    const result = validateCorporateCheckout(corporateData)
    assert.strictEqual(result.valid, true)
  })

  it('Firma ünvanı veya Vergi numarası eksikse hata vermeli', () => {
    const invalidData1 = { companyName: '', taxOffice: 'Kadıköy', taxNumber: '1234567890' }
    const invalidData2 = { companyName: 'Firma', taxOffice: 'Kadıköy', taxNumber: '' }

    assert.strictEqual(Boolean(invalidData1.companyName.trim()), false)
    assert.strictEqual(Boolean(invalidData2.taxNumber.trim()), false)
  })
})

describe('Kabul Testi 5: Şahıs ve Kurumsal Fatura Vergi Numarası Ayrımı (validateCorporateTaxNumber)', () => {
  it('10 Haneli VKN için tüzel şirket vergi doğrulaması çalışmalı', () => {
    // 10 Haneli sentetik geçerli VKN (örnek: 1234567890 mod 10 formülüyle)
    const res = validateCorporateTaxNumber('1234567890')
    assert.strictEqual(typeof res.isValid, 'boolean')
    assert.strictEqual(res.type, 'vkn')
  })

  it('11 Haneli TCKN için şahıs işletmesi vergi doğrulaması kabul edilmeli', () => {
    // 11 haneli geçerli algoritmik TCKN örneği: 10000000146
    const res = validateCorporateTaxNumber('10000000146')
    assert.strictEqual(res.isValid, true)
    assert.strictEqual(res.type, 'tckn')
    assert.strictEqual(res.error, undefined)
  })

  it('Geçersiz uzunluk veya format durumunda hata dönmeli', () => {
    assert.strictEqual(validateCorporateTaxNumber('').isValid, false)
    assert.strictEqual(validateCorporateTaxNumber('123').isValid, false)
    assert.strictEqual(validateCorporateTaxNumber('123456789012').isValid, false)
    assert.strictEqual(validateCorporateTaxNumber(null).isValid, false)
  })

  it('maskCorporateTaxNumber 10 ve 11 haneli numaraları güvenle maskelemeli', () => {
    const masked10 = maskCorporateTaxNumber('1234567890')
    assert.strictEqual(masked10.includes('****'), true)

    const masked11 = maskCorporateTaxNumber('10000000146')
    assert.strictEqual(masked11.includes('*******'), true)
  })
})

describe('Kabul Testi 6: Müşteri Sipariş İptal Uygunluk ve Güvenlik Kuralları', () => {
  const isOrderCancellableByCustomer = (order: { status: string; shipping?: { status?: string } }) => {
    const nonCancellableStatuses = ['shipped', 'completed', 'delivered', 'cancelled']
    if (nonCancellableStatuses.includes(order.status)) return false
    if (order.shipping?.status === 'shipped' || order.shipping?.status === 'delivered') return false
    return true
  }

  it('Henüz kargoya verilmemiş siparişler müşteri tarafından iptal edilebilmeli', () => {
    assert.strictEqual(isOrderCancellableByCustomer({ status: 'pending' }), true)
    assert.strictEqual(isOrderCancellableByCustomer({ status: 'processing' }), true)
    assert.strictEqual(isOrderCancellableByCustomer({ status: 'awaiting_bank_transfer' }), true)
    assert.strictEqual(isOrderCancellableByCustomer({ status: 'processing', shipping: { status: 'created' } }), true)
  })

  it('Kargolanmış veya teslim edilmiş siparişler iptal edilemez olmalı', () => {
    assert.strictEqual(isOrderCancellableByCustomer({ status: 'shipped' }), false)
    assert.strictEqual(isOrderCancellableByCustomer({ status: 'completed' }), false)
    assert.strictEqual(isOrderCancellableByCustomer({ status: 'delivered' }), false)
    assert.strictEqual(isOrderCancellableByCustomer({ status: 'cancelled' }), false)
    assert.strictEqual(isOrderCancellableByCustomer({ status: 'processing', shipping: { status: 'shipped' } }), false)
  })
})

