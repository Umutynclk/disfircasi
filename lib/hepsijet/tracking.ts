/**
 * lib/hepsijet/tracking.ts
 *
 * HepsiJET kargo takip yardımcı modülü.
 * Doğru takip URL'i ve integrationStatus → Türkçe durum eşleşmesini tek noktadan yönetir.
 * Tüm dosyalar bu modülü kullanmalı, URL'i kendisi üretmemeli.
 */

import { trackHepsiJetShipment } from './client'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { buildHepsiJetTrackingUrl } from './tracking-url'

export { buildHepsiJetTrackingUrl }

// ---------------------------------------------------------------------------
// 2. integrationStatus → Firestore durum eşleşmesi
// ---------------------------------------------------------------------------

export interface StatusMapping {
  /** Müşteriye gösterilecek Türkçe metin */
  displayStatus: string
  /** Firestore order.status güncellenecekse yeni değer; null = değişme */
  orderStatus: 'shipped' | 'completed' | null
  /** Firestore shipping.status (providerStatus yerine kullanılan iç alan) */
  shippingStatus:
    | 'created'
    | 'accepted'
    | 'out_for_delivery'
    | 'delivered'
    | 'cancelled'
    | 'unknown'
  /** Ham API kodu */
  providerStatus: string
}

/**
 * HepsiJET API'sinden gelen integrationStatus kodunu Firestore alanlarına dönüştürür.
 * Bilinmeyen kodlar için güvenli geri dönüş: mevcut durumu bozmaz.
 */
export function mapIntegrationStatus(integrationStatus: string | undefined | null): StatusMapping {
  const code = (integrationStatus || '').toUpperCase().trim()

  switch (code) {
    case 'ACCEPTED':
      return {
        displayStatus: 'Kargoya Verildi',
        orderStatus: 'shipped',
        shippingStatus: 'accepted',
        providerStatus: 'ACCEPTED',
      }

    case 'OUT_FOR_DELIVERY':
      return {
        displayStatus: 'Dağıtımda',
        orderStatus: 'shipped',
        shippingStatus: 'out_for_delivery',
        providerStatus: 'OUT_FOR_DELIVERY',
      }

    case 'DELIVERED':
      return {
        displayStatus: 'Teslim Edildi',
        orderStatus: 'completed',
        shippingStatus: 'delivered',
        providerStatus: 'DELIVERED',
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
// 3. Durum öncelik sıralaması — asla geri düşme
// ---------------------------------------------------------------------------

const STATUS_RANK: Record<string, number> = {
  created: 0,
  unknown: 0,
  accepted: 1,
  out_for_delivery: 2,
  delivered: 3,
  cancelled: 4,
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
  // İptal edilmiş siparişlere dokunma
  if (currentRank === STATUS_RANK['cancelled']) return false
  return newRank > currentRank
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
  updated: boolean
  skipped: boolean
  skipReason?: string
  error?: string
}

/**
 * Verilen sipariş ID'leri için HepsiJET'ten gerçek takip durumunu sorgular ve
 * Firestore'u günceller. Hiçbir koşulda durumu geri düşürmez.
 *
 * @param orderIds  Güncellenecek Firestore sipariş doküman ID'leri
 * @param options   dryRun: true ise Firestore'u yazma, sadece ne olacağını raporla
 */
export async function syncOrderTrackingFromHepsiJet(
  orderIds: string[],
  options?: { dryRun?: boolean }
): Promise<SyncResult[]> {
  if (!orderIds.length) return []

  const db = getAdminFirestore()
  const dryRun = options?.dryRun ?? false

  // 1. Sipariş dokümanlarını Firestore'dan oku
  const orderDocs = await Promise.all(
    orderIds.map((id) => db.collection('orders').doc(id).get())
  )

  // 2. Barkodları topla (boş veya iptal edilmiş siparişleri atla)
  const barcodeToOrderId: Record<string, string> = {}
  const results: SyncResult[] = []

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
    // Teslim edilmiş veya iptal edilmiş siparişleri tekrar sorgulama
    if (['cancelled', 'completed', 'delivered'].includes(currentOrderStatus)) {
      // Sadece trackingUrl'i düzeltmemiz gerekiyorsa yine de devam et
      const currentUrl: string = shipping.trackingUrl || ''
      const correctUrl = buildHepsiJetTrackingUrl(barcode)
      if (currentUrl === correctUrl) {
        results.push({
          orderId: snap.id,
          barcode,
          skipped: true,
          updated: false,
          skipReason: `Sipariş zaten ${currentOrderStatus}`,
        })
        continue
      }
      // Sadece URL'i düzelt
      if (!dryRun) {
        await db.collection('orders').doc(snap.id).update({
          'shipping.trackingUrl': correctUrl,
          'shipping.trackingUrlUpdatedAt': new Date().toISOString(),
        })
      }
      results.push({
        orderId: snap.id,
        barcode,
        previousOrderStatus: currentOrderStatus,
        newOrderStatus: currentOrderStatus,
        trackingUrl: correctUrl,
        skipped: false,
        updated: true,
      })
      continue
    }

    barcodeToOrderId[barcode] = snap.id
  }

  const barcodesToTrack = Object.keys(barcodeToOrderId)
  if (!barcodesToTrack.length) return results

  // 3. HepsiJET API'sini sorgula (max 20 barkod/istek — batch)
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
      // API hatası — bu batch'teki siparişleri hatalı olarak işaretle
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
    // Hata zaten eklendiyse atla
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
      // API yanıt verdi ama bu barkod döndürülmedi — sadece URL düzelt
      const updateData: Record<string, any> = {
        'shipping.trackingUrl': correctUrl,
        'shipping.lastTrackingAttemptAt': new Date().toISOString(),
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
      'shipping.lastTrackingAt': new Date().toISOString(),
      'shipping.lastTrackingAttemptAt': new Date().toISOString(),
    }

    if (willUpgrade) {
      updateData['shipping.status'] = mapping.shippingStatus
      updateData['shipping.providerStatus'] = mapping.providerStatus
      updateData['shipping.displayStatus'] = mapping.displayStatus
      updateData['shipping.syncStatus'] = 'synced'

      if (needsStatusUpdate) {
        updateData['status'] = mapping.orderStatus
        if (mapping.orderStatus === 'completed') {
          updateData['completedAt'] = new Date().toISOString()
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
      skipped: false,
      updated: true,
    })
  }

  return results
}

