import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  WAITING_FOR_TRACKING_MESSAGE,
  calculateScheduledShippedAt,
  hasRealHepsiJetTracking,
  isScheduledShippedDue,
} from '../lib/orders/shippingSchedule'
import {
  evaluateCancellationEligibility,
  evaluateWithdrawalEligibility,
  getCustomerOrderActionMode,
} from '../lib/orders/cancellationPolicy'
import { getCommonOrderDisplayStatus } from '../lib/hepsijet/status-display'
import { mapIntegrationStatus, shouldUpgradeStatus } from '../lib/hepsijet/tracking'
import { validateOrderForPrintQueue } from '../lib/printing/queue'

const ROOT = path.resolve(__dirname, '..')
const read = (relPath: string) => fs.readFileSync(path.join(ROOT, relPath), 'utf8')

// Helper: build UTC ISO from an Europe/Istanbul (+03:00) wall-clock timestamp
const ist = (isoLocalWithOffset: string) => new Date(isoLocalWithOffset).toISOString()

// =========================================================================
// 1. EUROPE/ISTANBUL ZAMANLAMA SINIR TESTLERİ (Senaryo 1–7)
// =========================================================================

test('SCHED-1..7: Europe/Istanbul tüm gündüz/gece/sınır saatleri kesin kurallara uyar', () => {
  // 1. 08:50 -> aynı gün 09:00
  const s1 = calculateScheduledShippedAt(ist('2026-11-27T08:50:00+03:00'))
  assert.equal(s1.rule, 'morning_same_day_0900')
  assert.equal(s1.statusDueAt, ist('2026-11-27T09:00:00+03:00'))

  // 2. 09:00 -> gündüz kuralı: 09:30
  const s2 = calculateScheduledShippedAt(ist('2026-11-27T09:00:00+03:00'))
  assert.equal(s2.rule, 'daytime_plus_30m')
  assert.equal(s2.statusDueAt, ist('2026-11-27T09:30:00+03:00'))

  // 3. 12:00 -> 12:30
  const s3 = calculateScheduledShippedAt(ist('2026-11-27T12:00:00+03:00'))
  assert.equal(s3.rule, 'daytime_plus_30m')
  assert.equal(s3.statusDueAt, ist('2026-11-27T12:30:00+03:00'))

  // 4. 16:45 -> 17:15
  const s4 = calculateScheduledShippedAt(ist('2026-11-27T16:45:00+03:00'))
  assert.equal(s4.rule, 'daytime_plus_30m')
  assert.equal(s4.statusDueAt, ist('2026-11-27T17:15:00+03:00'))

  // 5. 17:00 -> gece kuralı: ertesi gün 09:00
  const s5 = calculateScheduledShippedAt(ist('2026-11-27T17:00:00+03:00'))
  assert.equal(s5.rule, 'overnight_next_0900')
  assert.equal(s5.statusDueAt, ist('2026-11-28T09:00:00+03:00'))

  // 6. 23:59 -> ertesi gün 09:00
  const s6 = calculateScheduledShippedAt(ist('2026-11-27T23:59:00+03:00'))
  assert.equal(s6.rule, 'overnight_next_0900')
  assert.equal(s6.statusDueAt, ist('2026-11-28T09:00:00+03:00'))

  // 7. 00:00 -> aynı gün 09:00
  const s7 = calculateScheduledShippedAt(ist('2026-11-28T00:00:00+03:00'))
  assert.equal(s7.rule, 'morning_same_day_0900')
  assert.equal(s7.statusDueAt, ist('2026-11-28T09:00:00+03:00'))
})

// =========================================================================
// 2. UYGUNLUK, İDEMPOTENCY VE SUNUCU KESİNTİSİ TELAFİSİ (Senaryo 8–10)
// =========================================================================

test('SCHED-8..10: Başarısız/iptal siparişe zamanlama yok, çift çalışmada tek geçiş, geç açılan scheduler telafi eder', () => {
  const dueIso = ist('2026-11-27T10:30:00+03:00')
  const afterDueMs = Date.parse(ist('2026-11-27T11:45:00+03:00')) // 1 saat 15 dk gecikmeli telafi

  // Ödemesi başarısız veya bekleyen sipariş -> false
  assert.equal(
    isScheduledShippedDue({ status: 'failed', paymentStatus: 'FAILED', statusDueAt: dueIso }, afterDueMs),
    false
  )
  assert.equal(
    isScheduledShippedDue({ status: 'pending', paymentStatus: 'PENDING', statusDueAt: dueIso }, afterDueMs),
    false
  )
  // İptal edilmiş sipariş -> false (tekrar aktif edilmez!)
  assert.equal(
    isScheduledShippedDue({ status: 'cancelled', paymentStatus: 'PAID', statusDueAt: dueIso }, afterDueMs),
    false
  )

  // Zamanı geçmiş PAID processing sipariş -> true (telafi çalışır)
  assert.equal(
    isScheduledShippedDue(
      { status: 'processing', paymentStatus: 'PAID', statusDueAt: dueIso, scheduledShippedApplied: false },
      afterDueMs
    ),
    true
  )

  // Aynı iş ikinci kez çalışırsa (scheduledShippedApplied: true) -> false (tek geçiş)
  assert.equal(
    isScheduledShippedDue(
      { status: 'shipped', paymentStatus: 'PAID', statusDueAt: dueIso, scheduledShippedApplied: true },
      afterDueMs
    ),
    false
  )
})

// =========================================================================
// 3. ZAMANLANMIŞ KARGODA İPTAL KİLİDİ & GERÇEK TAKİP AYRIMI (Senaryo 11–20)
// =========================================================================

test('SCHED-13..15: Kargoda zamanından önce iptal açık, Kargoda zamanından sonra normal iptal kesin engelli ve cayma açık', () => {
  // Zamanından önce (processing, etiket yok) -> normal iptal açık
  const beforeOrder = {
    status: 'processing',
    paymentStatus: 'PAID',
    scheduledShippedApplied: false,
  }
  assert.equal(evaluateCancellationEligibility(beforeOrder).allowed, true)
  assert.equal(getCustomerOrderActionMode(beforeOrder), 'cancel')

  // Zamanlanmış Kargoda'ya geçmiş (HepsiJET kabulü henüz gelmemiş olsa bile!) -> normal iptal KESİN engelli
  const scheduledShippedOrder = {
    status: 'shipped',
    paymentStatus: 'PAID',
    scheduledShippedApplied: true,
    cancelLockedBySchedule: true,
    shipping: { status: 'created' },
  }
  const decision = evaluateCancellationEligibility(scheduledShippedOrder)
  assert.equal(decision.allowed, false)
  assert.equal(decision.allowWithdrawalRequest, true)
  assert.equal(getCustomerOrderActionMode(scheduledShippedOrder), 'withdrawal')
  assert.equal(evaluateWithdrawalEligibility(scheduledShippedOrder).eligible, true)
})

test('TRACK-UX: Zamanlanmış Kargoda ama gerçek HepsiJET barkodu yoksa sahte takip yok, doğru bekleme mesajı var', () => {
  const orderWithoutRealTracking = {
    status: 'shipped',
    paymentStatus: 'PAID',
    scheduledShippedApplied: true,
    shipping: { status: 'created', barcode: 'SIM-12345' },
  }
  assert.equal(hasRealHepsiJetTracking(orderWithoutRealTracking), false)
  assert.equal(getCommonOrderDisplayStatus(orderWithoutRealTracking).text, 'Kargoda')
  assert.equal(
    WAITING_FOR_TRACKING_MESSAGE,
    'Siparişiniz kargoda aşamasına alındı. HepsiJET takip bilgileriniz oluşturulduğunda burada görüntüleyebileceksiniz. En kısa sürede kargo bilgilerinizi paylaşacağız.'
  )

  const orderWithRealTracking = {
    status: 'shipped',
    paymentStatus: 'PAID',
    scheduledShippedApplied: true,
    shipping: { status: 'created', barcode: 'HJ900123456' },
  }
  assert.equal(hasRealHepsiJetTracking(orderWithRealTracking), true)
})

test('TRACK-16..28: Gerçek HepsiJET yaşam döngüsü, geri düşmeme koruması, Print Queue bağımsızlığı ve Cron güvenliği', () => {
  // HepsiJET durum geçişleri
  assert.equal(mapIntegrationStatus('ACCEPTED').shippingStatus, 'accepted')
  assert.equal(mapIntegrationStatus('IN_TRANSIT').shippingStatus, 'in_transit')
  assert.equal(mapIntegrationStatus('OUT_FOR_DELIVERY').shippingStatus, 'out_for_delivery')
  assert.equal(mapIntegrationStatus('DELIVERED').shippingStatus, 'delivered')

  // Gecikmiş eski webhook yeni durumu geriye alamaz
  assert.equal(shouldUpgradeStatus('delivered', 'in_transit'), false)
  assert.equal(shouldUpgradeStatus('out_for_delivery', 'accepted'), false)
  assert.equal(shouldUpgradeStatus('accepted', 'out_for_delivery'), true)

  // Print Queue PAID + created gerçek barkodlu siparişi hemen kuyruğa alabilir (30 dk beklemez)
  assert.equal(
    validateOrderForPrintQueue({
      id: 'ord-print-1',
      status: 'processing',
      paymentStatus: 'PAID',
      shipping: { status: 'created', barcode: 'HJ900999888' },
    }).isValid,
    true
  )

  // Cron scheduler CRON_SECRET doğrulaması yapar ve carrierStatus/carrierAcceptedAt'e dokunmaz
  const cronSrc = read('app/api/cron/order-status-scheduler/route.ts')
  assert.ok(cronSrc.includes('verifyCronSecret'), 'Scheduler endpoint CRON_SECRET doğrulaması yapmalı')
  assert.ok(cronSrc.includes('db.runTransaction'), 'Scheduler atomik Firestore transaction kullanmalı')
  assert.ok(cronSrc.includes('cancelLockedBySchedule: true'), 'Scheduler iptal kilidini atomik etkinleştirmeli')
  assert.ok(!cronSrc.includes("'shipping.carrierAcceptedAt':"), 'Scheduler sahte taşıyıcı kabul zamanı yazmamalı')
  assert.ok(!cronSrc.includes("'shipping.carrierStatus':"), 'Scheduler sahte taşıyıcı durumu yazmamalı')

  // PayTR, iyzico ve Havale PAID noktalarının tamamı statusDueAt hesaplar
  for (const rel of [
    'app/api/paytr/callback/route.ts',
    'app/api/iyzico/callback/route.ts',
    'app/api/admin/orders/confirm-payment/route.ts',
  ]) {
    const src = read(rel)
    assert.ok(src.includes('calculateScheduledShippedAt'), `${rel} PAID anında statusDueAt hesaplamalı`)
  }

  // Müşteri profili bekleme mesajı ve gerçek takip butonunu içerir
  const profileSrc = read('app/profil/page.tsx')
  assert.ok(profileSrc.includes('WAITING_FOR_TRACKING_MESSAGE'))
  assert.ok(profileSrc.includes('Kargo Takibini Görüntüle'))

  // HepsiJET iade randevu sorgusu (findAvailableDeliveryDatesV2) ile iade gönderi oluşturma (createHepsiJetReturnShipment) ayrıdır
  const returnScheduleSrc = read('app/api/orders/returns/schedule/route.ts')
  assert.ok(returnScheduleSrc.includes('createHepsiJetReturnShipment'))
  assert.ok(!returnScheduleSrc.includes('findAvailableDeliveryDatesV2'))
})
