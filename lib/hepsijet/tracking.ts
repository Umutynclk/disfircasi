/**
 * lib/hepsijet/tracking.ts
 *
 * HepsiJET kargo takip yardımcı modülü.
 * Doğru takip URL'i ve integrationStatus → Türkçe durum eşleşmesini tek noktadan yönetir.
 * 24 saatlik otomatik arşivleme (delivered & cancelled) işlemlerini yürütür.
 */

import { trackHepsiJetShipment } from './client'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { buildHepsiJetTrackingUrl } from './tracking-url'

export { buildHepsiJetTrackingUrl }

// ---------------------------------------------------------------------------
// 1. integrationStatus → Firestore durum eşleşmesi
// ---------------------------------------------------------------------------

export interface StatusMapping {
  /** Müşteriye ve admine gösterilecek Türkçe metin */
  displayStatus: string
  /** Firestore order.status güncellenecekse yeni değer; null = değişme */
  orderStatus: 'shipped' | 'delivered' | 'completed' | 'cancelled' | null
  /** Firestore shipping.status */
  shippingStatus:
    | 'created'
    | 'accepted'
    | 'in_transit'
    | 'out_for_delivery'
    | 'delivered'
    | 'failed'
    | 'returned'
    | 'cancelled'
    | 'unknown'
  /** Ham API kodu */
  providerStatus: string
}

/**
 * HepsiJET API'sinden gelen integrationStatus kodunu Firestore alanlarına dönüştürür.
 * Resmi doküman ve sahadaki tüm olası durum kodlarını kapsar.
 */
export function mapIntegrationStatus(integrationStatus: string | undefined | null): StatusMapping {
  const code = (integrationStatus || '').toUpperCase().trim()

  switch (code) {
    case 'ACCEPTED':
    case 'DELIVERY_ACCEPTED':
    case 'COLLECTED':
      return {
        displayStatus: 'Kargoya Verildi',
        orderStatus: 'shipped',
        shippingStatus: 'accepted',
        providerStatus: code,
      }

    case 'IN_TRANSIT':
    case 'TRANSFER':
    case 'X_DOCK_IN':
    case 'X_DOCK_OUT':
    case 'ON_WAY':
    case 'SHIPPED':
      return {
        displayStatus: 'Yolda',
        orderStatus: 'shipped',
        shippingStatus: 'in_transit',
        providerStatus: code,
      }

    case 'OUT_FOR_DELIVERY':
    case 'ON_DISTRIBUTION':
    case 'COURIER_ASSIGNED':
      return {
        displayStatus: 'Dağıtımda',
        orderStatus: 'shipped',
        shippingStatus: 'out_for_delivery',
        providerStatus: code,
      }

    case 'DELIVERED':
      return {
        displayStatus: 'Teslim Edildi',
        orderStatus: 'completed',
        shippingStatus: 'delivered',
        providerStatus: 'DELIVERED',
      }

    case 'UNDELIVERED':
    case 'DELIVERY_ATTEMPT_FAILED':
    case 'NOT_DELIVERED':
      return {
        displayStatus: 'Teslim Edilemedi',
        orderStatus: 'shipped',
        shippingStatus: 'failed',
        providerStatus: code,
      }

    case 'RETURN_STARTED':
    case 'RETURNED':
    case 'RETURN_DELIVERED':
      return {
        displayStatus: 'İade Edildi',
        orderStatus: null, // Kargo iadesi ana siparişi iptal ('cancelled') yapmaz, mevcut durum korunur.
        shippingStatus: 'returned',
        providerStatus: code,
      }

    case 'CANCELLED':
    case 'DELETED':
      return {
        displayStatus: 'İptal Edildi',
        orderStatus: 'cancelled',
        shippingStatus: 'cancelled',
        providerStatus: code,
      }

    case '':
      // Barkod oluşturulmuş ancak HepsiJET henüz harekete geçirmemiş
      return {
        displayStatus: 'Kargo Etiketi Oluşturuldu',
        orderStatus: null,
        shippingStatus: 'created',
        providerStatus: '',
      }

    default:
      // Bilinmeyen kod — güvenli geri dönüş, mevcut durumu bozma
      return {
        displayStatus: 'Kargo Bilgisi Alınıyor',
        orderStatus: null,
        shippingStatus: 'unknown',
        providerStatus: code,
      }
  }
}

// ---------------------------------------------------------------------------
// 2. Durum öncelik sıralaması — asla geri düşme
// ---------------------------------------------------------------------------

const STATUS_RANK: Record<string, number> = {
  created: 0,
  unknown: 0,
  accepted: 1,
  in_transit: 2,
  out_for_delivery: 3,
  delivered: 4,
  returned: 4,
  cancelled: 5,
}

function getStatusRank(status: string): number {
  return STATUS_RANK[status?.toLowerCase()] ?? -1
}

/** Mevcut durum yeni durumdan daha yüksek öncelikliyse güncelleme yapma. */
export function shouldUpgradeStatus(
  currentShippingStatus: string | undefined,
  newShippingStatus: string
): boolean {
  const currentRank = getStatusRank(currentShippingStatus || '')
  const newRank = getStatusRank(newShippingStatus)
  // İptal edilmiş siparişlere asla kargo durumu ile müdahale edilemez
  if (currentRank === STATUS_RANK['cancelled']) return false
  return newRank > currentRank
}

// ---------------------------------------------------------------------------
// 3. 24 Saat Sonra Arşivleme Yardımcısı
// ---------------------------------------------------------------------------

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/**
 * Teslim veya iptal tarihinden itibaren 24 saat ekleyerek archiveAt ISO string üretir.
 */
export function calculateArchiveAt(terminalDateStr?: string | null): string {
  const baseTime = terminalDateStr ? new Date(terminalDateStr).getTime() : Date.now()
  const validBase = isNaN(baseTime) ? Date.now() : baseTime
  return new Date(validBase + TWENTY_FOUR_HOURS_MS).toISOString()
}

// ---------------------------------------------------------------------------
// 4. Çekirdek senkronizasyon fonksiyonu
// ---------------------------------------------------------------------------

export interface SyncResult {
  orderId: string
  barcode: string
  previousOrderStatus?: string
  previousShippingStatus?: string
  newOrderStatus?: string
  newShippingStatus?: string
  displayStatus?: string
  trackingUrl?: string
  archived?: boolean
  archiveAt?: string
  updated: boolean
  skipped: boolean
  skipReason?: string
  error?: string
}

/**
 * Verilen sipariş ID'leri için HepsiJET'ten gerçek takip durumunu sorgular,
 * Firestore'u günceller ve 24 saati dolmuş siparişleri otomatik arşivler.
 *
 * @param orderIds  Güncellenecek Firestore sipariş doküman ID'leri
 * @param options   dryRun: true ise Firestore'u yazma, sadece ne olacağını raporla
 */
export async function syncOrderTrackingFromHepsiJet(
  orderIds: string[],
  options?: { dryRun?: boolean }
): Promise<SyncResult[]> {
  const db = getAdminFirestore()
  const dryRun = options?.dryRun ?? false
  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()

  const results: SyncResult[] = []

  // 1. Sipariş dokümanlarını Firestore'dan oku
  const orderDocs = orderIds.length > 0
    ? await Promise.all(orderIds.map((id) => db.collection('orders').doc(id).get()))
    : []

  // 2. Barkodları topla (boş veya iptal edilmiş siparişleri kargo API'sinden koru)
  const barcodeToOrderId: Record<string, string> = {}

  for (const snap of orderDocs) {
    if (!snap.exists) {
      results.push({
        orderId: snap.id,
        barcode: '',
        skipped: true,
        updated: false,
        skipReason: 'Sipariş bulunamadı',
      })
      continue
    }

    const data = snap.data()!
    const shipping = data.shipping || {}
    const barcode: string = shipping.barcode || ''

    if (!barcode) {
      results.push({
        orderId: snap.id,
        barcode: '',
        skipped: true,
        updated: false,
        skipReason: 'Barkod yok',
      })
      continue
    }

    if (/NUMUNE|SAMPLE|TEST/i.test(barcode) || barcode.startsWith('SIM-')) {
      results.push({
        orderId: snap.id,
        barcode,
        skipped: true,
        updated: false,
        skipReason: 'Test/simüle barkod',
      })
      continue
    }

    const currentOrderStatus = data.status || ''

    // İptal edilmiş sipariş: HepsiJET API'si bunu ezemez!
    if (currentOrderStatus === 'cancelled' || shipping.status === 'cancelled') {
      const correctUrl = buildHepsiJetTrackingUrl(barcode)
      const updates: Record<string, any> = {}
      let needsUpdate = false

      if (shipping.trackingUrl !== correctUrl) {
        updates['shipping.trackingUrl'] = correctUrl
        needsUpdate = true
      }

      // İptal edilen sipariş için archiveAt yoksa hesapla
      if (!data.archiveAt) {
        const cancelledTime = data.cancelledAt || data.updatedAt || data.createdAt || nowIso
        updates['archiveAt'] = calculateArchiveAt(cancelledTime)
        updates['terminalStatusAt'] = cancelledTime
        needsUpdate = true
      }

      if (needsUpdate && !dryRun) {
        await db.collection('orders').doc(snap.id).update(updates)
      }

      results.push({
        orderId: snap.id,
        barcode,
        previousOrderStatus: currentOrderStatus,
        newOrderStatus: currentOrderStatus,
        trackingUrl: correctUrl,
        archiveAt: data.archiveAt || updates['archiveAt'],
        skipped: !needsUpdate,
        updated: needsUpdate,
        skipReason: needsUpdate ? undefined : 'Sipariş zaten iptal edilmiş',
      })
      continue
    }

    // Zaten tamamlanmış / teslim edilmiş sipariş
    if (['completed', 'delivered'].includes(currentOrderStatus) && shipping.status === 'delivered') {
      const correctUrl = buildHepsiJetTrackingUrl(barcode)
      const updates: Record<string, any> = {}
      let needsUpdate = false

      if (shipping.trackingUrl !== correctUrl) {
        updates['shipping.trackingUrl'] = correctUrl
        needsUpdate = true
      }

      // archiveAt yoksa hesapla
      if (!data.archiveAt) {
        const deliveryTime = data.completedAt || shipping.lastTrackingAt || data.updatedAt || nowIso
        updates['archiveAt'] = calculateArchiveAt(deliveryTime)
        updates['terminalStatusAt'] = deliveryTime
        needsUpdate = true
      }

      if (needsUpdate && !dryRun) {
        await db.collection('orders').doc(snap.id).update(updates)
      }

      results.push({
        orderId: snap.id,
        barcode,
        previousOrderStatus: currentOrderStatus,
        newOrderStatus: currentOrderStatus,
        trackingUrl: correctUrl,
        archiveAt: data.archiveAt || updates['archiveAt'],
        skipped: !needsUpdate,
        updated: needsUpdate,
        skipReason: needsUpdate ? undefined : 'Sipariş zaten teslim edilmiş',
      })
      continue
    }

    barcodeToOrderId[barcode] = snap.id
  }

  const barcodesToTrack = Object.keys(barcodeToOrderId)

  // 3. HepsiJET API'sini sorgula (max 20 barkod/istek)
  if (barcodesToTrack.length > 0) {
    const BATCH_SIZE = 20
    const apiResults: Record<string, any> = {}

    for (let i = 0; i < barcodesToTrack.length; i += BATCH_SIZE) {
      const batch = barcodesToTrack.slice(i, i + BATCH_SIZE)
      try {
        const response = await trackHepsiJetShipment(batch)
        if (response?.status === 'OK' && Array.isArray(response?.data)) {
          for (const item of response.data) {
            if (item?.barcode) {
              apiResults[item.barcode] = item
            }
          }
        }
      } catch (err: any) {
        for (const bc of batch) {
          const ordId = barcodeToOrderId[bc]
          results.push({
            orderId: ordId,
            barcode: bc,
            skipped: false,
            updated: false,
            error: `HepsiJET API hatası: ${err?.message || 'Bilinmeyen hata'}`,
          })
        }
      }
    }

    // 4. Her sipariş için Firestore'u güncelle
    for (const [barcode, orderId] of Object.entries(barcodeToOrderId)) {
      if (results.find((r) => r.orderId === orderId)) continue

      const snap = orderDocs.find((s: any) => s.id === orderId)
      if (!snap?.exists) continue

      const data = snap.data()!
      const shipping = data.shipping || {}
      const currentOrderStatus: string = data.status || ''
      const currentShippingStatus: string = shipping.status || 'created'

      const apiItem = apiResults[barcode]
      const correctUrl = apiItem?.trackingUrl || buildHepsiJetTrackingUrl(barcode)

      if (!apiItem) {
        // API yanıt verdi ama bu barkod için detay dönmedi
        const updateData: Record<string, any> = {
          'shipping.trackingUrl': correctUrl,
          'shipping.lastTrackingAttemptAt': nowIso,
        }
        if (!dryRun) {
          await db.collection('orders').doc(orderId).update(updateData)
        }
        results.push({
          orderId,
          barcode,
          previousOrderStatus: currentOrderStatus,
          newOrderStatus: currentOrderStatus,
          trackingUrl: correctUrl,
          skipped: false,
          updated: true,
        })
        continue
      }

      // Son integrationStatus'u belirle
      const details: any[] = apiItem.details || []
      const lastDetail = details.length > 0 ? details[details.length - 1] : null
      const integrationStatus: string = lastDetail?.integrationStatus || ''
      const transactionDate: string = lastDetail?.transactionDate || nowIso

      const mapping = mapIntegrationStatus(integrationStatus)

      // Durum geri düşme koruması
      const willUpgrade = shouldUpgradeStatus(currentShippingStatus, mapping.shippingStatus)
      const needsUrlFix = (shipping.trackingUrl || '') !== correctUrl
      const needsStatusUpdate = willUpgrade && mapping.orderStatus !== null

      if (!willUpgrade && !needsUrlFix) {
        results.push({
          orderId,
          barcode,
          previousOrderStatus: currentOrderStatus,
          previousShippingStatus: currentShippingStatus,
          skipped: true,
          updated: false,
          skipReason: `Durum zaten güncel (${currentShippingStatus})`,
        })
        continue
      }

      const updateData: Record<string, any> = {
        'shipping.trackingUrl': correctUrl,
        'shipping.lastTrackingAt': nowIso,
        'shipping.lastTrackingAttemptAt': nowIso,
      }

      let calculatedArchiveAt: string | undefined

      if (willUpgrade) {
        updateData['shipping.status'] = mapping.shippingStatus
        updateData['shipping.providerStatus'] = mapping.providerStatus
        updateData['shipping.displayStatus'] = mapping.displayStatus
        updateData['shipping.syncStatus'] = 'synced'

        if (needsStatusUpdate) {
          updateData['status'] = mapping.orderStatus
          if (mapping.orderStatus === 'completed' || mapping.shippingStatus === 'delivered') {
            updateData['completedAt'] = transactionDate
            updateData['terminalStatusAt'] = transactionDate
            calculatedArchiveAt = calculateArchiveAt(transactionDate)
            updateData['archiveAt'] = calculatedArchiveAt
          }
        }
      }

      if (!dryRun) {
        try {
          await db.collection('orders').doc(orderId).update(updateData)
        } catch (err: any) {
          results.push({
            orderId,
            barcode,
            skipped: false,
            updated: false,
            error: `Firestore yazma hatası: ${err?.message}`,
          })
          continue
        }
      }

      results.push({
        orderId,
        barcode,
        previousOrderStatus: currentOrderStatus,
        previousShippingStatus: currentShippingStatus,
        newOrderStatus: needsStatusUpdate ? (mapping.orderStatus || currentOrderStatus) : currentOrderStatus,
        newShippingStatus: willUpgrade ? mapping.shippingStatus : currentShippingStatus,
        displayStatus: willUpgrade ? mapping.displayStatus : undefined,
        trackingUrl: correctUrl,
        archiveAt: calculatedArchiveAt,
        skipped: false,
        updated: true,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Otomatik 24 Saat Arşivleme Adımı (delivered & cancelled siparişler)
  // ---------------------------------------------------------------------------
  try {
    const allOrdersSnap = await db.collection('orders').get()
    const autoArchiveBatch = db.batch()
    let archiveBatchCount = 0

    allOrdersSnap.forEach((docSnap: any) => {
      const order = docSnap.data()
      if (!order) return

      // Zaten arşivlenmiş ise atla
      if (order.isArchived === true || order.archived === true) return
      // Çöp kutusundaki siparişi arşivleme
      if (order.isTrash === true) return

      const ordStatus = String(order.status || '').toLowerCase()
      const isDelivered = ordStatus === 'delivered' || ordStatus === 'completed' || order.shipping?.status === 'delivered'
      const isCancelled = ordStatus === 'cancelled' || order.shipping?.status === 'cancelled'

      // Yalnızca teslim edilmiş veya iptal edilmiş siparişler otomatik arşivlenir
      if (!isDelivered && !isCancelled) return

      let archiveTimeMs: number | null = null

      if (order.archiveAt) {
        const t = new Date(order.archiveAt).getTime()
        if (!isNaN(t)) archiveTimeMs = t
      } else {
        // archiveAt henüz yazılmamışsa, terminal tarihi bul
        const terminalDateStr =
          order.terminalStatusAt ||
          order.completedAt ||
          order.cancelledAt ||
          order.updatedAt ||
          order.createdAt
        if (terminalDateStr) {
          const t = new Date(terminalDateStr).getTime()
          if (!isNaN(t)) {
            archiveTimeMs = t + TWENTY_FOUR_HOURS_MS
          }
        }
      }

      // 24 saat dolmuş mu?
      if (archiveTimeMs !== null && nowMs >= archiveTimeMs) {
        const docRef = db.collection('orders').doc(docSnap.id)
        autoArchiveBatch.update(docRef, {
          isArchived: true,
          archived: true,
          archivedAt: nowIso,
          archiveReason: isCancelled ? 'cancelled' : 'delivered',
          updatedAt: nowIso,
        })
        archiveBatchCount++

        const existingRes = results.find((r) => r.orderId === docSnap.id)
        if (existingRes) {
          existingRes.archived = true
        } else {
          results.push({
            orderId: docSnap.id,
            barcode: order.shipping?.barcode || '',
            previousOrderStatus: ordStatus,
            newOrderStatus: ordStatus,
            archived: true,
            skipped: false,
            updated: true,
          })
        }
      }
    })

    if (archiveBatchCount > 0 && !dryRun) {
      await autoArchiveBatch.commit()
    }
  } catch (archiveErr: any) {
    console.error('Otomatik arşivleme hatası:', archiveErr)
  }

  return results
}
