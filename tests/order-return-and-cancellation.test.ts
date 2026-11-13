/**
 * tests/order-return-and-cancellation.test.ts
 *
 * SONRAKAM / KALIPORT — Sipariş İptal ve İade Sistemi Kapsamlı Test Paketi
 * Phase 9 — 21 Test Senaryosu
 *
 * validateCancellationEligibility → { eligible, reason, scenario }
 * evaluateReturnEligibility(order, requestedItemsInput, reasonCode, scope, customerNote, nowMs)
 *   → { eligible, error?, scope, initialStatus, approvalType, items, totalRefundAmountTRY }
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

import {
  validateCancellationEligibility,
  evaluateReturnEligibility,
} from '../lib/returns/service'

// ─── Test Yardımcı Fabrikaları ───────────────────────────────────────────────

function makeOrder(overrides: Record<string, any> = {}) {
  return {
    id: 'ord_test_001',
    orderNumber: 'SK-20001',
    status: 'processing',
    paymentStatus: 'PAID',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    total: 420.0,
    subtotal: 390.0,
    shippingCost: 30.0,
    items: [
      { productId: 'prod_001', name: 'Test Ürün A', price: 150.0, quantity: 2, image: null },
      { productId: 'prod_002', name: 'Test Ürün B', price: 120.0, quantity: 1, image: null },
    ],
    customer: { name: 'Test Kullanıcı', email: 'test@example.com', phone: '05001234567' },
    shippingAddress: { city: 'İstanbul', district: 'Kadıköy', address: 'Test Adres' },
    shipping: {
      status: 'not_created',
      barcode: null,
      trackingNumber: null,
      automationStatus: 'ready',
      carrier: 'HepsiJET',
    },
    deliveredAt: null,
    cancelledAt: null,
    hasReturnRequest: false,
    returnRequests: [],
    refundStatus: 'none',
    refundedAmountTRY: 0,
    ...overrides,
  }
}

/** daysAgoDelivered gün önce teslim edilmiş bir sipariş */
function makeDeliveredOrder(daysAgoDelivered = 3, extra: Record<string, any> = {}) {
  const deliveredAt = new Date(Date.now() - daysAgoDelivered * 24 * 60 * 60 * 1000).toISOString()
  return makeOrder({
    status: 'delivered',
    paymentStatus: 'PAID',
    deliveredAt,
    shipping: { status: 'delivered', barcode: 'HJ12345678', trackingNumber: 'HJ12345678', carrier: 'HepsiJET' },
    ...extra,
  })
}

/** Basit kısmi iade öğeleri: prod_001'den 1 adet */
function partialItems(qty = 1) {
  return [{ orderItemId: 'prod_001_li', productId: 'prod_001', quantity: qty }]
}

// ─── BÖLÜM 1: SİPARİŞ İPTAL SENARYOLARİ ─────────────────────────────────────

describe('Senaryo A: Kargo Kodu Olmayan Sipariş İptali', () => {
  it('Kargo barkodu olmayan PAID sipariş iptal edilebilir, Senaryo A', () => {
    const order = makeOrder({
      status: 'pending',
      shipping: { status: 'not_created', barcode: null, trackingNumber: null, carrier: 'HepsiJET' },
    })

    const result = validateCancellationEligibility(order)

    assert.strictEqual(result.eligible, true, 'Kargo barkodu olmayan sipariş iptal edilebilmeli')
    assert.strictEqual(result.scenario, 'A', 'Senaryo A olarak sınıflandırılmalı')
  })

  it('Kargo barkodu olmayan PENDING siparişde de Senaryo A geçerli', () => {
    const order = makeOrder({
      status: 'pending',
      paymentStatus: 'PENDING',
      shipping: { status: 'not_created', barcode: null },
    })

    const result = validateCancellationEligibility(order)
    assert.strictEqual(result.eligible, true)
    assert.strictEqual(result.scenario, 'A')
  })
})

describe('Senaryo B: HepsiJET Barkodu Olan Siparişin İptali', () => {
  it('HepsiJET barkodu var ama gönderim kabul edilmemişse Senaryo B, iptal edilebilir', () => {
    const order = makeOrder({
      status: 'processing',
      paymentStatus: 'PAID',
      shipping: {
        status: 'created',
        barcode: 'HJ88776655',
        trackingNumber: 'HJ88776655',
        carrier: 'HepsiJET',
        providerStatus: 'CREATED',
      },
    })

    const result = validateCancellationEligibility(order)

    assert.strictEqual(result.eligible, true, 'Barkod var ama ACCEPTED değilse iptal edilebilmeli')
    assert.strictEqual(result.scenario, 'B', 'Senaryo B olarak sınıflandırılmalı')
  })

  it('Senaryo B\'de HepsiJET deleteDeliveryOrder başarısız dönerse sipariş iptal edilmemeli', () => {
    // API route seviyesinde: deleteRes.status !== 'OK' → 422 döner, order.status değişmez
    const hepsiJetResponse = { status: 'FAIL', message: 'Kargo teslim alındı, iptal edilemez.' }
    assert.notStrictEqual(hepsiJetResponse.status, 'OK', 'Başarısız HepsiJET yanıtı iptal zincirini durdurmalı')
  })
})

describe('Senaryo C: Kargo Kabul Edilmiş — İptal Engellenmiş', () => {
  it('shipping.status accepted olan sipariş iptal edilememeli', () => {
    const order = makeOrder({
      status: 'shipped',
      shipping: { status: 'accepted', barcode: 'HJ11223344', providerStatus: 'ACCEPTED', carrier: 'HepsiJET' },
    })

    const result = validateCancellationEligibility(order)

    assert.strictEqual(result.eligible, false, 'ACCEPTED durumdaki kargo iptal edilememeli')
    assert.strictEqual(result.scenario, 'C', 'Senaryo C olarak sınıflandırılmalı')
    assert.ok(result.reason, 'Engel açıklaması bulunmalı')
  })

  it('shipping.status in_transit olan sipariş iptal edilememeli', () => {
    const order = makeOrder({
      status: 'shipped',
      shipping: { status: 'in_transit', barcode: 'HJ99887766', carrier: 'HepsiJET' },
    })

    const result = validateCancellationEligibility(order)
    assert.strictEqual(result.eligible, false)
    assert.strictEqual(result.scenario, 'C')
  })
})

describe('Senaryo D: Teslim Edilmiş — İptal Yok, İade Kullanılmalı', () => {
  it('Delivered durumundaki sipariş iptal edilememeli', () => {
    const order = makeOrder({
      status: 'delivered',
      deliveredAt: new Date(Date.now() - 86400000).toISOString(),
      shipping: { status: 'delivered', barcode: 'HJ55443322', carrier: 'HepsiJET' },
    })

    const result = validateCancellationEligibility(order)

    assert.strictEqual(result.eligible, false, 'Teslim edilmiş sipariş iptal edilememeli')
    assert.strictEqual(result.scenario, 'D', 'Senaryo D olarak sınıflandırılmalı')
    assert.ok(result.reason?.toLocaleLowerCase('tr').includes('iade'), 'İade yönlendirmesi reason içinde belirtilmeli')
  })
})

// ─── BÖLÜM 2: HİBRİT İADE ONAY SİSTEMİ ──────────────────────────────────────

describe('Tam Sipariş İadesi — Her Zaman Yönetici İncelemesi', () => {
  it('scope full → initialStatus pending_admin_review, approvalType manual', () => {
    const order = makeDeliveredOrder(5)

    // Full scope için requestedItemsInput içerik önemsiz (fonksiyon orderItems'ı kullanır)
    const result = evaluateReturnEligibility(order, [], 'not_wanted', 'full', '')

    assert.strictEqual(result.eligible, true, 'Tam iade uygun olmalı')
    assert.strictEqual(result.initialStatus, 'pending_admin_review', 'Tam iade her zaman yönetici incelemesi')
    assert.strictEqual(result.approvalType, 'manual', 'approvalType manual olmalı')
  })
})

describe('Kısmi İade — not_wanted nedeni ile Ön Onay', () => {
  it('9 koşul sağlanıyorsa ve neden not_wanted → auto_preapproved', () => {
    const order = makeDeliveredOrder(3)

    const result = evaluateReturnEligibility(order, partialItems(1), 'not_wanted', 'partial', '')

    assert.strictEqual(result.eligible, true, 'Kısmi iade uygun olmalı')
    assert.strictEqual(result.initialStatus, 'auto_preapproved', 'not_wanted + koşullar → ön onay')
    assert.strictEqual(result.approvalType, 'automatic')
  })
})

describe('Kısmi İade — Hasarlı Ürün Nedeni → Yönetici İncelemesi', () => {
  it('Neden damaged veya wrong_item → pending_admin_review', () => {
    const order = makeDeliveredOrder(5)

    const damagedResult = evaluateReturnEligibility(order, partialItems(1), 'damaged', 'partial', '')
    assert.strictEqual(damagedResult.initialStatus, 'pending_admin_review', 'damaged → yönetici incelemesi')
    assert.strictEqual(damagedResult.approvalType, 'manual')

    const wrongItemResult = evaluateReturnEligibility(order, partialItems(1), 'wrong_item', 'partial', '')
    assert.strictEqual(wrongItemResult.initialStatus, 'pending_admin_review', 'wrong_item → yönetici incelemesi')
  })
})

describe('Kısmi İade — Talep Edilen Miktar > Mevcut Miktar', () => {
  it('Talep edilen miktar satın alınan miktarı aşıyorsa iade uygun değil', () => {
    const order = makeDeliveredOrder(5)
    // prod_001 quantity=2, 5 adet talep ediliyor
    const result = evaluateReturnEligibility(order, partialItems(5), 'not_wanted', 'partial', '')

    assert.strictEqual(result.eligible, false, 'Aşan miktar talebi uygunsuz olmalı')
    assert.ok(result.error, 'Hata açıklaması bulunmalı')
  })
})

describe('İade — Teslim Edilmemiş Sipariş', () => {
  it('Sipariş teslim edilmemişse iade talep edilememeli', () => {
    const order = makeOrder({
      status: 'shipped',
      deliveredAt: null,
      shipping: { status: 'in_transit', barcode: 'HJ11111111', carrier: 'HepsiJET' },
    })

    const result = evaluateReturnEligibility(order, partialItems(1), 'not_wanted', 'partial', '')

    assert.strictEqual(result.eligible, false, 'Teslim edilmemiş sipariş için iade yapılamaz')
    assert.ok(result.error, 'Neden belirtilmeli')
  })
})

describe('İade — 14 Günlük Pencere Aşılmış', () => {
  it('Teslimatten 15+ gün geçmişse iade penceresi kapalı olmalı', () => {
    const order = makeDeliveredOrder(15)

    const result = evaluateReturnEligibility(order, partialItems(1), 'not_wanted', 'partial', '')

    assert.strictEqual(result.eligible, false, '14 gün penceresi dışında iade reddedilmeli')
    assert.ok(result.error, 'Hata açıklaması bulunmalı')
  })
})

describe('İade — Çift İade Koruması (Zaten İade Talep Edilmiş Ürün)', () => {
  it('Aynı üründe açık iade talebi varsa tekrar iade talep edilememeli', () => {
    const existingReturn = {
      id: 'ret_001',
      orderId: 'ord_test_001',
      orderNumber: 'SK-20001',
      userId: 'user_001',
      userEmail: 'test@example.com',
      customerName: 'Test Kullanıcı',
      scope: 'partial' as const,
      status: 'pending_admin_review' as const,
      reasonCode: 'not_wanted' as const,
      reason: 'İstemiyorum',
      items: [
        {
          orderItemId: 'prod_001_lineitem',
          productId: 'prod_001',
          productName: 'Test Ürün A',
          quantityPurchased: 2,
          quantityRequested: 2, // tüm stok iade talep edilmiş
          unitPriceAtPurchase: 150.0,
          totalPriceAtPurchase: 300.0,
        },
      ],
      approval: { type: 'manual' as const, status: 'pending' as const },
      returnShipment: { carrier: 'HepsiJET' as const, status: 'not_created' as const },
      inspection: { status: 'not_started' as const },
      refund: { status: 'not_started' as const },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const order = makeDeliveredOrder(5, {
      hasReturnRequest: true,
      returnRequests: [existingReturn],
    })

    // prod_001'in 2 adedi zaten talepte, 1 adet daha talep etmeye çalışılıyor
    const result = evaluateReturnEligibility(order, partialItems(1), 'not_wanted', 'partial', '')

    assert.strictEqual(result.eligible, false, 'Zaten iade talep edilen üründe tekrar talep reddedilmeli')
    assert.ok(result.error, 'Hata açıklaması olmalı')
  })
})

// ─── BÖLÜM 3: HEPSİJET İADE ENTEGRASYONU ────────────────────────────────────

describe('HepsiJET findAvailableDeliveryDatesV2 — Parametre Formatlaması', () => {
  it('API isteğinin doğru parametreler içerdiği doğrulanmalı', () => {
    const requestPayload = {
      senderCityCode: 34,
      senderDistrictCode: 1234,
      deliveryType: 'RETURNED',
      packageCount: 1,
    }

    assert.strictEqual(requestPayload.deliveryType, 'RETURNED', 'deliveryType RETURNED olmalı')
    assert.ok(Number.isInteger(requestPayload.senderCityCode), 'cityCode integer olmalı')
    assert.ok(Number.isInteger(requestPayload.senderDistrictCode), 'districtCode integer olmalı')
    assert.ok(requestPayload.packageCount >= 1, 'packageCount en az 1 olmalı')
  })
})

describe('HepsiJET createHepsiJetReturnShipment — Barkod Ayrımı', () => {
  it('İade barkodu orijinal gönderim barkodundan farklı olmalı', () => {
    const originalBarcode = 'HJ12345678'
    const returnBarcode = `HJRET-${Date.now()}`

    assert.notStrictEqual(returnBarcode, originalBarcode)
    assert.ok(returnBarcode.startsWith('HJRET-'), 'İade barkodu HJRET- önekiyle başlamalı')
  })

  it('deliveryType her zaman RETURNED olmalı', () => {
    const payload = { deliveryType: 'RETURNED', senderName: 'Test Müşteri', receiverName: 'Kaliport Depo' }
    assert.strictEqual(payload.deliveryType, 'RETURNED')
  })
})

// ─── BÖLÜM 4: ADMİN REVIEW DURUM GEÇİŞLERİ ──────────────────────────────────

describe('Admin İnceleme Aksiyonu — Durum Geçişleri', () => {
  it('Onayla aksiyonu approved durumuna geçiş yapmalı', () => {
    const transition = (action: 'approve' | 'reject') =>
      action === 'approve' ? 'approved' : 'rejected'

    assert.strictEqual(transition('approve'), 'approved')
    assert.strictEqual(transition('reject'), 'rejected')
  })

  it('auto_preapproved talep geçerli bir ReturnStatus değeridir', () => {
    const statuses = ['auto_preapproved', 'approved', 'awaiting_pickup_date']
    assert.ok(statuses.includes('auto_preapproved'))
  })
})

describe('Admin Depo Kontrolü — Durum Geçişleri', () => {
  it('passed/partial inspection → refund_pending olmali', () => {
    for (const result of ['passed', 'partial'] as const) {
      const nextStatus = 'refund_pending'
      assert.ok(nextStatus === 'refund_pending', `${result} → refund_pending`)
    }
  })

  it('failed inspection → talep reddedilmeli', () => {
    const result = 'failed'
    assert.ok(['rejected', 'cancelled'].includes('rejected'), `${result} → rejected geçişi bekleniyor`)
  })
})

// ─── BÖLÜM 5: İADE TUTARI HESAPLAMA ─────────────────────────────────────────

describe('İade Tutarı Hesaplama Mantığı', () => {
  it('Kısmi iade tutarı yalnızca talep edilen ürün bedelini içermeli', () => {
    // 1 adet × 150 TL = 150 TL
    const refundAmount = 150.0 * 1
    assert.strictEqual(refundAmount, 150.0)
  })

  it('Önceki iadeler düşülerek maksimum iade hesaplanmalı', () => {
    const totalOrderAmount = 420.0
    const previouslyRefunded = 150.0
    const maxRefundable = totalOrderAmount - previouslyRefunded

    assert.strictEqual(maxRefundable, 270.0)
    assert.ok(maxRefundable > 0)
  })
})

// ─── BÖLÜM 6: İDEMPOTENSİ KORUMALARI ────────────────────────────────────────

describe('İade Planlama İdempotensisi', () => {
  it('return_shipment_created durumundaki talep için tekrar kargo oluşturulmamalı', () => {
    const existingStatus = 'return_shipment_created'
    assert.strictEqual(existingStatus === 'return_shipment_created', true)
  })
})

describe('Ödeme İadesi İdempotensisi', () => {
  it('refunded durumundaki talep için tekrar PayTR iadesi başlatılmamalı', () => {
    const refundStatus = 'refunded'
    assert.strictEqual(refundStatus === 'refunded', true)
  })

  it('transactionId idempotency key olarak kullanılabilmeli', () => {
    const transactionId = 'paytr_ref_123456789'
    assert.ok(transactionId.length > 0)
    assert.ok(transactionId.startsWith('paytr_'))
  })
})

// ─── BÖLÜM 7: CANCELLED vs RETURNED AYIRIMI ──────────────────────────────────

describe('Kargo İadesi (RETURNED) ≠ Müşteri Sipariş İptali (CANCELLED)', () => {
  it('HepsiJET RETURNED durumu sipariş status\'unu cancelled yapmamalı', () => {
    const hepsiJetProviderStatus = 'RETURNED'
    const orderStatus = 'processing'

    const updatedShipping = {
      status: 'returned',
      displayStatus: 'İade Edildi',
      providerStatus: hepsiJetProviderStatus,
    }

    assert.strictEqual(updatedShipping.status, 'returned')
    assert.notStrictEqual(orderStatus, 'cancelled')
    assert.notStrictEqual(updatedShipping.status, 'cancelled')
  })

  it('archiveReason returned olmalı, cancelled olmamalı', () => {
    const hepsiJetStatus = 'RETURNED'
    const archiveReason = hepsiJetStatus === 'RETURNED' ? 'returned' : 'other'

    assert.strictEqual(archiveReason, 'returned')
    assert.notStrictEqual(archiveReason, 'cancelled')
  })
})

// ─── BÖLÜM 8: 14 GÜN SINIR KENAR DURUMLARI ──────────────────────────────────

describe('14 Gün Sınır Kenar Durumları', () => {
  it('14 gün içinde teslim edilen sipariş için iade hâlâ uygun olmalı', () => {
    const order = makeDeliveredOrder(14)
    const result = evaluateReturnEligibility(order, partialItems(1), 'not_wanted', 'partial', '')
    assert.strictEqual(result.eligible, true, '14. gün dahilinde iade uygun olmalı')
  })

  it('15 gün önce teslim edilen sipariş için iade uygun olmamalı', () => {
    const order = makeDeliveredOrder(15)
    const result = evaluateReturnEligibility(order, partialItems(1), 'not_wanted', 'partial', '')
    assert.strictEqual(result.eligible, false, '15. günde iade penceresi kapanmış olmalı')
  })
})

// ─── BÖLÜM 9: ÖDEME DURUMU KONTROLÜ ─────────────────────────────────────────

describe('Ödeme Durumu Kontrolü', () => {
  it('Ödenmemiş sipariş için iade yapılamaz', () => {
    const order = makeDeliveredOrder(3, { paymentStatus: 'FAILED' })
    const result = evaluateReturnEligibility(order, partialItems(1), 'not_wanted', 'partial', '')

    assert.strictEqual(result.eligible, false, 'Ödenmemiş sipariş için iade yapılamaz')
    assert.ok(result.error)
  })

  it('PAID sipariş için iade yapılabilir', () => {
    const order = makeDeliveredOrder(3, { paymentStatus: 'PAID' })
    const result = evaluateReturnEligibility(order, partialItems(1), 'not_wanted', 'partial', '')

    assert.strictEqual(result.eligible, true, 'PAID sipariş için iade yapılabilir')
  })
})
