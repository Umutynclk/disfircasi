import test from 'node:test'
import assert from 'node:assert'
import {
  isUnprocessed24h,
  isInArchive,
  isOverdueButBlocked,
  getArchiveBlockers,
} from '../lib/utils/orderLifecycle'
import {
  sendDeliveryOrderEnhanced,
  deleteDeliveryOrder,
  isAmbiguousHepsiJetError,
} from '../lib/hepsijet/client'

/**
 * Canlıya geçiş öncesi denetim testleri (UNIT, mock fetch).
 * Gerçek HepsiJET API'sine HİÇBİR istek gitmez: global fetch tamamen mock'lanır.
 */

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.now()
const ago = (ms: number) => new Date(NOW - ms).toISOString()

// ───────────── 24 saat bildirimi ─────────────

test('A1. Ödeme bekleyen sipariş 24 saati aşsa da operasyon uyarısına girmez', () => {
  const o = { status: 'pending', paymentStatus: 'PENDING', createdAt: ago(2 * DAY) }
  assert.strictEqual(isUnprocessed24h(o, NOW), false)
  const havale = { status: 'pending', paymentStatus: 'awaiting_bank_transfer', createdAt: ago(3 * DAY) }
  assert.strictEqual(isUnprocessed24h(havale, NOW), false)
})

test('A2. PAID + barkod yok + 24 saat geçti => uyarı (status "processing" olsa bile)', () => {
  const o = { status: 'processing', paymentStatus: 'PAID', createdAt: ago(25 * 60 * 60 * 1000) }
  assert.strictEqual(isUnprocessed24h(o, NOW), true)
  const failedShip = { status: 'pending', paymentStatus: 'PAID', createdAt: ago(2 * DAY), shipping: { status: 'failed' } }
  assert.strictEqual(isUnprocessed24h(failedShip, NOW), true)
})

test('A3. PAID + barkod var => uyarı yok (barkod/fiş baskısı bu uyarıyı beklemez)', () => {
  const o = { status: 'processing', paymentStatus: 'PAID', createdAt: ago(2 * DAY), shipping: { status: 'created', barcode: 'HJ1' } }
  assert.strictEqual(isUnprocessed24h(o, NOW), false)
})

test('A4. 24 saatten yeni PAID sipariş uyarıya girmez; iptal edilen girmez', () => {
  assert.strictEqual(isUnprocessed24h({ status: 'pending', paymentStatus: 'PAID', createdAt: ago(5 * 60 * 60 * 1000) }, NOW), false)
  assert.strictEqual(isUnprocessed24h({ status: 'cancelled', paymentStatus: 'PAID', createdAt: ago(3 * DAY) }, NOW), false)
})

// ───────────── 15 gün arşiv ─────────────

test('B1. 15 günü geçmiş teslim edilmiş / iptal edilmiş sipariş arşivde', () => {
  assert.strictEqual(isInArchive({ status: 'delivered', paymentStatus: 'PAID', createdAt: ago(16 * DAY) }, NOW), true)
  assert.strictEqual(isInArchive({ status: 'cancelled', paymentStatus: 'PAID', createdAt: ago(16 * DAY) }, NOW), true)
})

test('B2. 15 günü geçmiş ama ödenmemiş sipariş arşive gitmez, uyarı alır', () => {
  const o = { status: 'pending', paymentStatus: 'PENDING', createdAt: ago(20 * DAY) }
  assert.strictEqual(isInArchive(o, NOW), false)
  assert.strictEqual(isOverdueButBlocked(o, NOW), true)
  assert.ok(getArchiveBlockers(o).includes('payment_pending'))
})

test('B3. 15 günü geçmiş, PAID ama barkodsuz veya kargo hatalı sipariş arşive gitmez', () => {
  const noBarcode = { status: 'processing', paymentStatus: 'PAID', createdAt: ago(20 * DAY) }
  assert.strictEqual(isInArchive(noBarcode, NOW), false)
  assert.strictEqual(isOverdueButBlocked(noBarcode, NOW), true)
  const unknownShip = { status: 'processing', paymentStatus: 'PAID', createdAt: ago(20 * DAY), shipping: { status: 'unknown' } }
  assert.ok(getArchiveBlockers(unknownShip).includes('shipping_problem'))
})

test('B4. 15 günü geçmiş, kargolanmış (barkodlu) sipariş arşive taşınır', () => {
  const o = { status: 'shipped', paymentStatus: 'PAID', createdAt: ago(16 * DAY), shipping: { status: 'created', barcode: 'HJ1' } }
  assert.strictEqual(isInArchive(o, NOW), true)
})

test('B5. 15 günden yeni sipariş arşive gitmez; elle arşivlenen her zaman arşivde; çöp kutusu arşiv değil', () => {
  assert.strictEqual(isInArchive({ status: 'delivered', paymentStatus: 'PAID', createdAt: ago(3 * DAY) }, NOW), false)
  assert.strictEqual(isInArchive({ status: 'pending', createdAt: ago(1 * DAY), isArchived: true }, NOW), true)
  assert.strictEqual(isInArchive({ status: 'delivered', createdAt: ago(40 * DAY), isTrash: true }, NOW), false)
})

// ───────────── HepsiJET create: belirsiz sonuç ─────────────

const realFetch = globalThis.fetch
function mockFetch(handler: (url: string, init?: any) => Promise<Response> | Response) {
  ;(globalThis as any).fetch = async (url: any, init?: any) => handler(String(url), init)
}
function restoreFetch() {
  ;(globalThis as any).fetch = realFetch
}
function enableMockLive() {
  process.env.HEPSIJET_LIVE_DISPATCH_ENABLED = 'true'
  process.env.HEPSIJET_BASE_URL = 'https://mock.hepsijet.invalid'
  process.env.HEPSIJET_USERNAME = 'mock'
  process.env.HEPSIJET_PASSWORD = 'mock-pass'
}
const tokenResponse = () =>
  new Response(JSON.stringify({ status: 'OK', data: { token: 'MOCKTOKEN' } }), { status: 200 })

const payload: any = { delivery: { customerDeliveryNo: 'KALIPORT0001' } }

test('C1. Create: bağlantı kopması/timeout => belirsiz (otomatik tekrar YOK)', async () => {
  enableMockLive()
  mockFetch(async (url) => {
    if (url.includes('/auth/getToken')) return tokenResponse()
    const e: any = new Error('The operation was aborted')
    e.name = 'AbortError'
    throw e
  })
  try {
    await assert.rejects(sendDeliveryOrderEnhanced(payload), (err: any) => isAmbiguousHepsiJetError(err))
  } finally {
    restoreFetch()
  }
})

test('C2. Create: HTTP 502 => belirsiz; HTTP 400 => kesin hata (belirsiz DEĞİL)', async () => {
  enableMockLive()
  let status = 502
  mockFetch(async (url) => {
    if (url.includes('/auth/getToken')) return tokenResponse()
    return new Response(JSON.stringify({ message: 'x' }), { status })
  })
  try {
    await assert.rejects(sendDeliveryOrderEnhanced(payload), (err: any) => isAmbiguousHepsiJetError(err))
    status = 400
    await assert.rejects(sendDeliveryOrderEnhanced(payload), (err: any) => !isAmbiguousHepsiJetError(err))
  } finally {
    restoreFetch()
  }
})

test('C3. Create: 200 ama gövde okunamıyor => belirsiz', async () => {
  enableMockLive()
  mockFetch(async (url) => {
    if (url.includes('/auth/getToken')) return tokenResponse()
    return new Response('not json', { status: 200 })
  })
  try {
    await assert.rejects(sendDeliveryOrderEnhanced(payload), (err: any) => isAmbiguousHepsiJetError(err))
  } finally {
    restoreFetch()
  }
})

test('C4. LIVE kapalıyken (varsayılan) hiçbir HTTP isteği gitmez', async () => {
  process.env.HEPSIJET_LIVE_DISPATCH_ENABLED = 'false'
  let calls = 0
  mockFetch(async () => {
    calls++
    return new Response('{}', { status: 200 })
  })
  try {
    const res: any = await sendDeliveryOrderEnhanced(payload)
    assert.strictEqual(res.data.isSimulated, true)
    assert.strictEqual(calls, 0)
  } finally {
    restoreFetch()
  }
})

// ───────────── HepsiJET iptal servisi ─────────────

test('D1. Silme: POST + {"deleteReason":"IPTAL"} + X-Auth-Token + /delivery/deleteDeliveryOrder/{no}', async () => {
  enableMockLive()
  delete process.env.HEPSIJET_CANCEL_METHOD
  delete process.env.HEPSIJET_CANCEL_ENDPOINT_PATH
  let captured: any = null
  mockFetch(async (url, init) => {
    if (url.includes('/auth/getToken')) return tokenResponse()
    captured = { url, init }
    return new Response(JSON.stringify({ status: 'OK', message: 'ok' }), { status: 200 })
  })
  try {
    const res = await deleteDeliveryOrder({ customerDeliveryNo: 'KALIPORT0001', deleteReason: 'IPTAL' })
    assert.strictEqual(res.status, 'OK')
    assert.ok(captured.url.endsWith('/delivery/deleteDeliveryOrder/KALIPORT0001'))
    assert.strictEqual(captured.init.method, 'POST')
    assert.strictEqual(captured.init.body, JSON.stringify({ deleteReason: 'IPTAL' }))
    assert.strictEqual(captured.init.headers['X-Auth-Token'], 'MOCKTOKEN')
  } finally {
    restoreFetch()
  }
})

test('D2. Silme başarısız (HTTP 404/500, status!=OK) => hata fırlatır (iptal edilmiş gösterilmez)', async () => {
  enableMockLive()
  let mode = 'http500'
  mockFetch(async (url) => {
    if (url.includes('/auth/getToken')) return tokenResponse()
    if (mode === 'http500') return new Response(JSON.stringify({ message: 'hata' }), { status: 500 })
    if (mode === 'http404') return new Response('Not Found', { status: 404 })
    return new Response(JSON.stringify({ status: 'ERROR', message: 'reddedildi' }), { status: 200 })
  })
  try {
    for (const m of ['http500', 'http404', 'statusError']) {
      mode = m
      await assert.rejects(deleteDeliveryOrder({ customerDeliveryNo: 'KALIPORT0001' }))
    }
  } finally {
    restoreFetch()
  }
})

test('D3. "Zaten silinmiş" yanıtı güvenle alreadyDeleted olarak işlenir', async () => {
  enableMockLive()
  mockFetch(async (url) => {
    if (url.includes('/auth/getToken')) return tokenResponse()
    return new Response(JSON.stringify({ status: 'ERROR', message: 'Bu gönderi sistemimizde zaten silinmiş durumda' }), { status: 400 })
  })
  try {
    const res: any = await deleteDeliveryOrder({ customerDeliveryNo: 'KALIPORT0001' })
    assert.strictEqual(res.alreadyDeleted, true)
  } finally {
    restoreFetch()
  }
})
