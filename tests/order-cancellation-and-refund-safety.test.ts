import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  extractHepsiJetIntegrationStatus,
  evaluateCancellationEligibility,
  evaluateWithdrawalEligibility,
  getCustomerOrderActionMode,
} from '../lib/orders/cancellationPolicy'
import { checkRefundEligibility } from '../lib/paytr-refund'
import { validateOrderForPrintQueue } from '../lib/printing/queue'

const ROOT = path.resolve(__dirname, '..')
const read = (relPath: string) => fs.readFileSync(path.join(ROOT, relPath), 'utf8')

// =========================================================================
// 1. HEPSİJET TRACK RESPONSE PARSER (ARRAY + MULTI-BARCODE + EMPTY/UNKNOWN)
// =========================================================================

test('PARSER-1: HepsiJET dizi yanıtından doğru barkoda ait integrationStatus seçilir (başka siparişi seçmez)', () => {
  const multiResponse = {
    status: 'OK',
    data: [
      { barcode: 'HJ-OTHER-001', integrationStatus: 'DELIVERED' },
      { barcode: 'HJ-TARGET-002', integrationStatus: 'X_DOCK_IN' },
      { barcode: 'HJ-OTHER-003', integrationStatus: '' },
    ],
  }

  const res = extractHepsiJetIntegrationStatus(multiResponse, 'HJ-TARGET-002')
  assert.equal(res.matched, true)
  assert.equal(res.rawCode, 'X_DOCK_IN')
  assert.equal(res.category, 'handed_over')
  assert.equal(res.mappedShippingStatus, 'in_transit')

  // Eşleşmeyen barkod -> unknown (asla başka barkodu seçmez)
  const unmatched = extractHepsiJetIntegrationStatus(multiResponse, 'HJ-NONEXISTENT-999')
  assert.equal(unmatched.matched, false)
  assert.equal(unmatched.category, 'unknown')
})

test('PARSER-2: Boş integrationStatus (etiket var, kurye almamış) not_handed_over; bilinmeyen kod unknown döner', () => {
  const labelOnly = extractHepsiJetIntegrationStatus(
    { status: 'OK', data: [{ barcode: 'HJ-LBL-1', integrationStatus: '' }] },
    'HJ-LBL-1'
  )
  assert.equal(labelOnly.category, 'not_handed_over')
  assert.equal(labelOnly.mappedShippingStatus, 'created')

  const unknownCode = extractHepsiJetIntegrationStatus(
    { status: 'OK', data: [{ barcode: 'HJ-UNK-1', integrationStatus: 'MYSTERY_CODE_99' }] },
    'HJ-UNK-1'
  )
  assert.equal(unknownCode.category, 'unknown')
})

// =========================================================================
// 2. 10 ANA SENARYO + TAŞIYICI / TAKİP HATASI / CAYMA TALEBİ TESTLERİ
// =========================================================================

test('SCENARIO-1: PAID ama kargo oluşturulmamış sipariş iptal edilebilir', () => {
  const decision = evaluateCancellationEligibility(
    { status: 'processing', paymentStatus: 'PAID' },
    { liveDispatchEnabled: true, hasLiveShipment: false }
  )
  assert.equal(decision.allowed, true)
  assert.equal(decision.code, 'ALLOWED')
  assert.equal(getCustomerOrderActionMode({ status: 'processing', paymentStatus: 'PAID' }), 'cancel')
})

test('SCENARIO-2: HepsiJET etiketi oluşturulmuş ama kargo teslim alınmamış sipariş kontrollü iptal edilebilir', () => {
  const liveTrack = extractHepsiJetIntegrationStatus(
    { status: 'OK', data: [{ barcode: 'HJ-100', integrationStatus: '' }] },
    'HJ-100'
  )
  const decision = evaluateCancellationEligibility(
    { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ-100' } },
    { liveTrackStatus: liveTrack, liveDispatchEnabled: true, hasLiveShipment: true }
  )
  assert.equal(decision.allowed, true)
  assert.equal(decision.code, 'ALLOWED')
})

test('SCENARIO-3 & 4: Taşıyıcı teslim almış (ACCEPTED) veya transfer merkezindeki (X_DOCK_IN/TRANSFER) siparişte iptal engellenir, cayma talebi açılır', () => {
  for (const code of ['ACCEPTED', 'DELIVERY_ACCEPTED', 'COLLECTED', 'IN_TRANSIT', 'TRANSFER', 'X_DOCK_IN', 'X_DOCK_OUT', 'ON_WAY', 'SHIPPED', 'OUT_FOR_DELIVERY', 'ON_DISTRIBUTION']) {
    const liveTrack = extractHepsiJetIntegrationStatus(
      { status: 'OK', data: [{ barcode: 'HJ-200', integrationStatus: code }] },
      'HJ-200'
    )
    const decision = evaluateCancellationEligibility(
      { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ-200' } },
      { liveTrackStatus: liveTrack, liveDispatchEnabled: true, hasLiveShipment: true }
    )
    assert.equal(decision.allowed, false, `${code} durumunda normal iptal engellenmeli`)
    assert.equal(decision.code, 'CARRIER_HANDED_OVER')
    assert.equal(decision.allowWithdrawalRequest, true)
    assert.equal(decision.firestoreMismatch, true, 'Firestore created iken canlı taşıyıcı uyuşmazlığı raporlanmalı')
  }

  // Firestore shipping.status='in_transit' iken müşteri aksiyonu 'withdrawal' olmalı
  const inTransitOrder = { status: 'shipped', paymentStatus: 'PAID', shipping: { status: 'in_transit', barcode: 'HJ-200' } }
  assert.equal(getCustomerOrderActionMode(inTransitOrder), 'withdrawal')
  assert.equal(evaluateWithdrawalEligibility(inTransitOrder).eligible, true)
})

test('SCENARIO-5 & 6: Teslim edilmiş sipariş iptal edilemez (iade akışı kullanılır); mükerrer cayma talebi engellenir', () => {
  const deliveredOrder = { status: 'delivered', paymentStatus: 'PAID', shipping: { status: 'delivered' } }
  const cancelDecision = evaluateCancellationEligibility(deliveredOrder)
  assert.equal(cancelDecision.allowed, false)
  assert.equal(cancelDecision.code, 'DELIVERED_USE_RETURN')
  assert.equal(getCustomerOrderActionMode(deliveredOrder), 'return')
  assert.equal(evaluateWithdrawalEligibility(deliveredOrder).eligible, false)

  // Aktif cayma talebi zaten varsa ikinci cayma talebi reddedilir
  const withExistingWithdrawal = {
    status: 'shipped',
    shipping: { status: 'in_transit' },
    withdrawalRequest: { id: 'CAY-1', status: 'pending_review' },
  }
  assert.equal(evaluateWithdrawalEligibility(withExistingWithdrawal).eligible, false)
})

test('EDGE-1: HepsiJET takip API ulaşılamadığında veya durum belirsizse otomatik iptal ve iade engellenir', () => {
  const apiDown = evaluateCancellationEligibility(
    { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ-300' } },
    { liveTrackingError: 'ECONNRESET', liveDispatchEnabled: true, hasLiveShipment: true }
  )
  assert.equal(apiDown.allowed, false)
  assert.equal(apiDown.code, 'TRACKING_UNAVAILABLE')
  assert.equal(apiDown.requiresAdminReview, true)

  const unknownStatus = evaluateCancellationEligibility(
    { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ-300' } },
    {
      liveTrackStatus: extractHepsiJetIntegrationStatus(
        { status: 'OK', data: [{ barcode: 'HJ-300', integrationStatus: 'UNKNOWN_STATE' }] },
        'HJ-300'
      ),
      liveDispatchEnabled: true,
      hasLiveShipment: true,
    }
  )
  assert.equal(unknownStatus.allowed, false)
  assert.equal(unknownStatus.code, 'TRACKING_UNAVAILABLE')
  assert.equal(unknownStatus.requiresAdminReview, true)
})

// =========================================================================
// 3. PAYTR / IYZICO İADE GÜVENLİĞİ & TIMEOUT (refund_unknown) TESTLERİ
// =========================================================================

test('SCENARIO-7 & 8: PayTR iadesi tamamlanmış, processing_refund, refund_unknown ve iyzico siparişlerinde mükerrer/yanlış iade engellenir', () => {
  // Tamamlanmış iade
  assert.equal(
    checkRefundEligibility({ status: 'cancelled', paymentStatus: 'PAID', refundStatus: 'refunded', total: 500 }).eligible,
    false
  )

  // Timeout sonrası refund_unknown -> PayTR panelinden doğrulanmadan yeniden iade YASAK
  const timeoutCheck = checkRefundEligibility({
    status: 'cancelled',
    paymentStatus: 'PAID',
    refundStatus: 'refund_unknown',
    total: 500,
    merchant_oid: 'GS123',
  })
  assert.equal(timeoutCheck.eligible, false)
  assert.ok(timeoutCheck.reason?.includes('refund_unknown'))

  // Eşzamanlı işlem kilidi
  assert.equal(
    checkRefundEligibility({
      status: 'cancelled',
      paymentStatus: 'PAID',
      refundStatus: 'processing_refund',
      refundLockTimestamp: Date.now() - 10_000,
      total: 500,
      merchant_oid: 'GS123',
    }).eligible,
    false
  )

  // iyzico ile ödenmiş sipariş PayTR iadesine gönderilemez
  const iyzicoCheck = checkRefundEligibility({
    status: 'cancelled',
    paymentStatus: 'PAID',
    paymentMethod: 'iyzico',
    total: 500,
    merchant_oid: 'GS123',
  })
  assert.equal(iyzicoCheck.eligible, false)
  assert.ok(iyzicoCheck.reason?.includes('iyzico'))
})

// =========================================================================
// 4. PRINT QUEUE, GECİKMİŞ CALLBACK, AUTO-DISPATCH VE KAYNAK KOD KONTROLLERİ
// =========================================================================

test('SCENARIO-9 & 10: İptal edilmiş sipariş Print Queue ve auto-dispatch tarafından reddedilir; tüm rotalar eski parser bugını içermez', () => {
  // İptal edilmiş sipariş baskı kuyruğuna giremez
  const printCheck = validateOrderForPrintQueue({
    id: 'ord-1',
    status: 'cancelled',
    paymentStatus: 'PAID',
    shipping: { status: 'created', barcode: 'HJ-REAL-123' },
  })
  assert.equal(printCheck.isValid, false)

  // Üç iptal API'sinde de yanlış `trackRes?.data?.status` kaldırılmış ve ortak parser kullanılmış olmalı
  for (const rel of [
    'app/api/orders/cancel/route.ts',
    'app/api/admin/orders/cancel/route.ts',
    'app/api/admin/hepsijet/cancel-shipment/route.ts',
  ]) {
    const src = read(rel)
    assert.ok(!src.includes('trackRes?.data?.status'), `${rel} içinde hatalı trackRes?.data?.status kalmamalı`)
    assert.ok(src.includes('extractHepsiJetIntegrationStatus'), `${rel} ortak HepsiJET parser kullanmalı`)
    assert.ok(src.includes('evaluateCancellationEligibility'), `${rel} ortak iptal politikası kullanmalı`)
    assert.ok(src.includes('cancelPendingPrintJobsForOrder'), `${rel} iptalde pending Print Queue işini iptal etmeli`)
    assert.ok(src.includes('cancellationRequest'), `${rel} iptal talebini ayrı cancellationRequest alanında tutmalı`)
  }

  // Print Queue claim sırasında sipariş durumunu doğrular
  const queueSrc = read('lib/printing/queue.ts')
  assert.ok(queueSrc.includes('ORDER_INELIGIBLE_AT_CLAIM'), 'claimNextPrintJobServer iptal edilmiş siparişi yazıcıya vermemeli')
  assert.ok(queueSrc.includes('physicalPrintMayHaveStarted'), 'processing/printed işlerde fiziksel baskı uyarısı kaydedilmeli')

  // PayTR callback gecikmiş ödemede iptal edilmiş siparişi tekrar processing/auto-dispatch yapmaz
  const callbackSrc = read('app/api/paytr/callback/route.ts')
  assert.ok(callbackSrc.includes('paid_but_cancelled'), 'Gecikmiş PayTR callback iptal edilmiş siparişi yeniden kargoya vermemeli')
  assert.ok(callbackSrc.includes('delayedPaymentAfterCancel: true'))

  // Admin refund & customer cancel atomik transaction kullanır ve refund_unknown kaydeder
  const adminRefundSrc = read('app/api/admin/orders/refund/route.ts')
  assert.ok(adminRefundSrc.includes('db.runTransaction'), 'Admin refund atomik transaction kilidi kullanmalı')
  assert.ok(adminRefundSrc.includes("refundStatus: 'refund_unknown'"), 'Timeout durumunda refund_unknown kaydedilmeli')

  // Cayma talebi API'si yeni kargo ve otomatik iade başlatmaz
  const withdrawalSrc = read('app/api/orders/withdrawal/route.ts')
  assert.ok(!withdrawalSrc.includes('requestPayTRRefund'), 'Cayma talebi otomatik PayTR iadesi başlatmamalı')
  assert.ok(!withdrawalSrc.includes('processOrderAutoDispatchAndPrint'), 'Cayma talebi yeni kargo oluşturmamalı')
  assert.ok(withdrawalSrc.includes('withdrawal_requests'), 'Cayma talebi ayrı koleksiyonda saklanmalı')
})

// =========================================================================
// 5. GERÇEKÇİ HEPSİJET TRACK FİXTURE'LARI & 4 SON KONTROL TESTLERİ
// =========================================================================

const REALISTIC_HEPSIJET_MULTI_FIXTURE = {
  status: 'OK',
  message: 'SUCCESS',
  data: [
    {
      barcode: 'HJ900000001',
      customerDeliveryNo: 'KALIPORT00000001',
      integrationStatus: 'DELIVERED',
      trackingUrl: 'https://www.hepsijet.com/gonderi-takibi/HJ900000001',
      transactions: [
        { date: '2026-11-24T10:00:00Z', status: 'ACCEPTED', location: 'Konya Selçuklu' },
        { date: '2026-11-25T14:30:00Z', status: 'DELIVERED', location: 'İstanbul Kadıköy' },
      ],
    },
    {
      barcode: 'HJ900000002',
      customerDeliveryNo: 'KALIPORT00000002',
      integrationStatus: '',
      trackingUrl: 'https://www.hepsijet.com/gonderi-takibi/HJ900000002',
      transactions: [],
    },
    {
      barcode: 'HJ900000003',
      customerDeliveryNo: 'KALIPORT00000003',
      integrationStatus: 'X_DOCK_OUT',
      trackingUrl: 'https://www.hepsijet.com/gonderi-takibi/HJ900000003',
      transactions: [{ date: '2026-11-25T08:15:00Z', status: 'X_DOCK_OUT', location: 'Ankara TM' }],
    },
  ],
}

test('FIXTURE-1: Gerçekçi HepsiJET çoklu barkod, eşleşmeyen barkod, boş dizi, bilinmeyen durum ve API hatası', () => {
  // 1) Çoklu barkoddan sadece etiketli olanı (HJ900000002) doğru seçer
  const labelOnly = extractHepsiJetIntegrationStatus(REALISTIC_HEPSIJET_MULTI_FIXTURE, 'HJ900000002')
  assert.equal(labelOnly.matched, true)
  assert.equal(labelOnly.category, 'not_handed_over')
  assert.equal(
    evaluateCancellationEligibility(
      { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ900000002' } },
      { liveTrackStatus: labelOnly, liveDispatchEnabled: true, hasLiveShipment: true }
    ).allowed,
    true
  )

  // 2) Aynı yanıt içindeki transferdeki barkod (HJ900000003) iptali engeller
  const inTransfer = extractHepsiJetIntegrationStatus(REALISTIC_HEPSIJET_MULTI_FIXTURE, 'HJ900000003')
  assert.equal(inTransfer.matched, true)
  assert.equal(inTransfer.category, 'handed_over')
  assert.equal(inTransfer.mappedShippingStatus, 'in_transit')
  assert.equal(
    evaluateCancellationEligibility(
      { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ900000003' } },
      { liveTrackStatus: inTransfer, liveDispatchEnabled: true, hasLiveShipment: true }
    ).allowed,
    false
  )

  // 3) Eşleşmeyen barkod -> unknown -> iptal engellenir
  const unmatched = extractHepsiJetIntegrationStatus(REALISTIC_HEPSIJET_MULTI_FIXTURE, 'HJ999999999')
  assert.equal(unmatched.matched, false)
  assert.equal(unmatched.category, 'unknown')
  assert.equal(
    evaluateCancellationEligibility(
      { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ999999999' } },
      { liveTrackStatus: unmatched, liveDispatchEnabled: true, hasLiveShipment: true }
    ).allowed,
    false
  )

  // 4) Boş dizi ({ status: 'OK', data: [] }) -> unknown -> güvenli engel
  const emptyArray = extractHepsiJetIntegrationStatus({ status: 'OK', data: [] }, 'HJ900000002')
  assert.equal(emptyArray.matched, false)
  assert.equal(emptyArray.category, 'unknown')
  assert.equal(
    evaluateCancellationEligibility(
      { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ900000002' } },
      { liveTrackStatus: emptyArray, liveDispatchEnabled: true, hasLiveShipment: true }
    ).allowed,
    false
  )

  // 5) Bilinmeyen durum kodu -> unknown -> güvenli engel
  const unknownStatus = extractHepsiJetIntegrationStatus(
    { status: 'OK', data: [{ barcode: 'HJ900000004', integrationStatus: 'CUSTOM_HOLD_99' }] },
    'HJ900000004'
  )
  assert.equal(unknownStatus.category, 'unknown')
  assert.equal(
    evaluateCancellationEligibility(
      { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ900000004' } },
      { liveTrackStatus: unknownStatus, liveDispatchEnabled: true, hasLiveShipment: true }
    ).allowed,
    false
  )

  // 6) API hatası (network/500) -> TRACKING_UNAVAILABLE -> güvenli engel + admin review
  const apiFailure = evaluateCancellationEligibility(
    { status: 'processing', paymentStatus: 'PAID', shipping: { status: 'created', barcode: 'HJ900000002' } },
    { liveTrackingError: 'HTTP 503 Service Unavailable', liveDispatchEnabled: true, hasLiveShipment: true }
  )
  assert.equal(apiFailure.allowed, false)
  assert.equal(apiFailure.code, 'TRACKING_UNAVAILABLE')
  assert.equal(apiFailure.requiresAdminReview, true)
})

test('CHECK-1..3: Atomik refund transaction paritesi, fiziksel baskı öncesi PDF koruması ve admin cayma inceleme API', () => {
  // 1) Üç PayTR iade noktasının tamamı Firestore transaction + refund_unknown kullanır
  for (const rel of [
    'app/api/orders/cancel/route.ts',
    'app/api/admin/orders/refund/route.ts',
    'app/api/admin/returns/refund/route.ts',
  ]) {
    const src = read(rel)
    assert.ok(src.includes('db.runTransaction'), `${rel} atomik Firestore transaction kilidi kullanmalı`)
    assert.ok(src.includes('refund_unknown'), `${rel} timeout durumunda refund_unknown yazmalı`)
  }

  // 2) Print Agent PDF indirme uç noktası fiziksel baskı öncesi sipariş durumunu tekrar doğrular
  const pdfRouteSrc = read('app/api/print-agent/jobs/[id]/pdf/route.ts')
  assert.ok(pdfRouteSrc.includes('ORDER_CANCELLED_BEFORE_PRINT'), 'PDF route iptal edilmiş siparişin PDF indirmesini engellemeli')
  assert.ok(pdfRouteSrc.includes('submittedToSpoolerAt'), 'Fiziksel baskısı başlamış işlerin durumu bozulmamalı')
  assert.ok(pdfRouteSrc.includes('physicalPrintMayHaveStarted'), 'Fiziksel baskı uyarısı korunmalı')

  // 3) Admin cayma talebi inceleme & sonuçlandırma API'si yetki, geçmiş ve müşteri bildirimi içerir
  const reviewApiSrc = read('app/api/admin/withdrawals/review/route.ts')
  assert.ok(reviewApiSrc.includes('verifyAdminRequest'), 'Admin cayma inceleme API yetki kontrolü yapmalı')
  assert.ok(reviewApiSrc.includes('withdrawal_requests'), 'withdrawal_requests koleksiyonu güncellenmeli')
  assert.ok(reviewApiSrc.includes('customerNotification'), 'Müşteri bilgilendirmesi kaydedilmeli')
  assert.ok(reviewApiSrc.includes("collection('notifications')"), 'Müşteri bildirim kaydı oluşturulmalı')
  assert.ok(!reviewApiSrc.includes('requestPayTRRefund'), 'Cayma incelemesi körü körüne otomatik PayTR iadesi yapmamalı')
})
