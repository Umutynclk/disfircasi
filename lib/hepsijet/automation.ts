import { getAdminFirestore } from '@/lib/firebase/admin'
import {
  HepsiJetSettings,
  HepsiJetAutomationSettings,
  HepsiJetAutomationRunSummary,
  AutomationOrderItemResult,
  AutomationDecisionStatus,
} from './types'
import {
  getHepsiJetSettingsServer,
  getHepsiJetAutomationSettingsServer,
  saveHepsiJetAutomationSettingsServer,
} from './settings'

/**
 * Telefon numarasını Türkiye 10 haneli (5XXXXXXXXX) formatına normalize eder.
 */
export function normalizePhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return ''
  let cleaned = rawPhone.replace(/\D/g, '')

  if (cleaned.startsWith('90') && cleaned.length === 12) {
    cleaned = cleaned.substring(2)
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1)
  }

  return cleaned
}

/**
 * Bir siparişi HepsiJET hibrit otomasyon kurallarına göre değerlendirir.
 * Kesinlikle hiçbir canlı API çağrısı yapmaz.
 */
export function evaluateOrderForAutomation(
  order: any,
  settings: HepsiJetSettings
): {
  status: AutomationDecisionStatus
  reasons: string[]
  desi: number
  weight: number
  packageCount: number
} {
  const reasons: string[] = []

  // 1. Ödeme Durumu Kontrolü
  if (order.paymentStatus !== 'PAID') {
    reasons.push(
      `Ödeme tamamlanmamış (Mevcut ödeme durumu: ${order.paymentStatus || 'BEKLİYOR'}). Yalnızca ödenmiş siparişler sevk edilebilir.`
    )
  }

  // 2. Sipariş Durumu Kontrolü (İptal, İade, Sevkiyat Tamamlanmış)
  if (order.status === 'cancelled') {
    reasons.push('Sipariş iptal edilmiş durumda. Gönderi oluşturulamaz.')
  } else if (order.status === 'refunded') {
    reasons.push('Sipariş iade edilmiş (refunded) durumda. Gönderi oluşturulamaz.')
  } else if (order.status === 'returned') {
    reasons.push('Sipariş geri iade alınmış (returned) durumda. Gönderi oluşturulamaz.')
  } else if (order.status === 'shipped') {
    reasons.push('Sipariş zaten kargoya verilmiş (shipped) durumda.')
  } else if (order.status === 'delivered') {
    reasons.push('Sipariş müşteriye teslim edilmiş durumda.')
  }

  // 3. Mevcut Gönderi Durumu & İdempotency
  const shipping = order.shipping
  if (shipping?.status === 'created') {
    reasons.push(
      `Bu sipariş için zaten başarıyla oluşturulmuş bir HepsiJET gönderisi mevcuttur (Barkod: ${shipping.barcode || shipping.trackingNumber || '-'}).`
    )
  }

  if (shipping?.status === 'cancelled') {
    reasons.push('Bu siparişin kargo gönderisi iptal edilmiştir. Yeni gönderi oluşturulamaz.')
  }

  if (shipping?.status === 'cancel_pending') {
    reasons.push('Bu siparişin kargo gönderisi için şu anda iptal işlemi işlenmektedir.')
  }

  if (shipping?.status === 'cancel_failed') {
    reasons.push('Kargo iptal işlemi başarısız olmuştur veya yönetici incelemesi gerekmektedir.')
  }

  if (shipping?.status === 'creating') {
    const lockTime = shipping.lockTimestamp || 0
    const fiveMinutes = 5 * 60 * 1000
    if (Date.now() - lockTime < fiveMinutes) {
      reasons.push('Sipariş şu anda başka bir işlem tarafından kilitlenmiş ve işleniyor.')
    }
  }

  if (shipping?.status === 'unknown') {
    reasons.push('Önceki gönderim denemesi belirsiz (unknown) sonuçlandı. Körlemesine tekrar yasaktır; yönetici incelemesi gereklidir.')
  }

  if (shipping?.status === 'failed') {
    reasons.push(`Önceki kargo gönderim denemesi başarısız oldu (${shipping.error || 'Bilinmeyen hata'}). Yönetici kontrolü gereklidir.`)
  }

  // 4. Müşteri & Alıcı İsim Kontrolü
  const recipientName = (
    order.shippingAddress?.fullName ||
    order.customer?.name ||
    ''
  ).trim()

  if (!recipientName || recipientName.length < 2) {
    reasons.push('Alıcı adı soyadı bilgisi eksik veya çok kısa.')
  }

  // 5. Telefon Numarası Kontrolü
  const rawPhone = order.customer?.phone || order.shippingAddress?.phone || ''
  const normalizedPhone = normalizePhoneNumber(rawPhone)

  if (!normalizedPhone || normalizedPhone.length !== 10 || !normalizedPhone.startsWith('5')) {
    reasons.push(
      `Alıcı telefon numarası geçersiz ("${rawPhone || '-'}"). Türkiye için başında 0 olmadan 10 haneli (5XXXXXXXXX) geçerli cep telefonu gereklidir.`
    )
  }

  // 6. Teslimat Adresi Kontrolü
  const city = (order.shippingAddress?.city || '').trim()
  const town = (order.shippingAddress?.district || order.shippingAddress?.town || '').trim()
  const addressLine = (order.shippingAddress?.address || '').trim()

  if (!city) reasons.push('Teslimat adresi Şehir (İl) bilgisi eksik.')
  if (!town) reasons.push('Teslimat adresi İlçe bilgisi eksik.')
  if (!addressLine || addressLine.length < 5) reasons.push('Teslimat açık adresi eksik veya yetersiz.')

  // 7. Gönderici / Depo Ayarları Kontrolü
  if (!settings.companyName?.trim()) {
    reasons.push('HepsiJET gönderici firma adı ayarlarda tanımlanmamış.')
  }
  if (!settings.abbreviationCode?.trim()) {
    reasons.push('HepsiJET firma kısaltma kodu (örn: KALIPORT) ayarlarda tanımlanmamış.')
  }
  if (!settings.warehouseCode?.trim()) {
    reasons.push('HepsiJET çıkış depo kodu (companyAddressId, örn: kali-kaliport-73) ayarlarda tanımlanmamış.')
  }
  if (!settings.currentXdock?.trim()) {
    reasons.push('HepsiJET aktarma merkezi kodu (CurrentXdock, örn: KALIPORTSELCUKLU) ayarlarda tanımlanmamış.')
  }
  if (!settings.senderCity?.trim()) {
    reasons.push('HepsiJET çıkış şehri (Konya) ayarlarda tanımlanmamış.')
  }
  if (!settings.senderTown?.trim()) {
    reasons.push('HepsiJET çıkış ilçesi ayarlarda tanımlanmamış.')
  }
  if (!settings.senderAddress?.trim()) {
    reasons.push('HepsiJET çıkış depo adresi ayarlarda tanımlanmamış.')
  }

  // 8. Paket, Desi ve Ağırlık Hesaplama
  let totalDesi = order.desi || 0
  let totalWeight = order.weight || 0
  let packageCount = order.packageCount || 0

  if (totalDesi <= 0 || totalWeight <= 0) {
    const items = Array.isArray(order.items) ? order.items : []
    let calculatedDesi = 0
    let calculatedWeight = 0

    for (const item of items) {
      const qty = item.quantity || 1
      if (item.desi && typeof item.desi === 'number') calculatedDesi += item.desi * qty
      if (item.weight && typeof item.weight === 'number') calculatedWeight += item.weight * qty
    }

    if (totalDesi <= 0) totalDesi = calculatedDesi
    if (totalWeight <= 0) totalWeight = calculatedWeight
  }

  if (totalDesi <= 0) totalDesi = settings.defaultDesi || 1
  if (totalWeight <= 0) totalWeight = settings.defaultWeight || 0.3
  if (packageCount <= 0) packageCount = settings.defaultPackageCount || 1

  if (totalDesi <= 0) reasons.push('Kargo desi değeri 0 veya negatif olamaz.')
  if (totalWeight <= 0) reasons.push('Kargo ağırlık değeri 0 veya negatif olamaz.')
  if (packageCount <= 0) reasons.push('Paket sayısı en az 1 olmalıdır.')

  // 9. Kalemler Kontrolü
  const items = Array.isArray(order.items) ? order.items : []
  if (items.length === 0) {
    reasons.push('Siparişe ait ürün/kalem içeriği bulunamadı.')
  }

  // Karar: Hata veya eksik varsa pending_review, tümü geçerliyse ready
  if (reasons.length > 0) {
    return {
      status: 'pending_review',
      reasons,
      desi: Number(totalDesi.toFixed(2)),
      weight: Number(totalWeight.toFixed(2)),
      packageCount,
    }
  }

  return {
    status: 'ready',
    reasons: ['Tüm güvenlik ve veri kontrolleri başarıyla tamamlandı. Otomatik gönderim için hazır.'],
    desi: Number(totalDesi.toFixed(2)),
    weight: Number(totalWeight.toFixed(2)),
    packageCount,
  }
}

const LOCK_DOC = 'hepsijet_automation_lock'
const LOCKS_COLLECTION = 'settings'

/**
 * Hibrit HepsiJET günlük sipariş otomasyonunu çalıştırır.
 * KESİN GÜVENLİK KURALI:
 * Bu fonksiyon yalnızca siparişleri analiz eder, doğrular ve 'ready' veya 'pending_review'
 * durumlarına ayırır. Asla canlı HepsiJET API'sine kargo kaydı açmaz.
 */
export async function runHepsiJetDailyAutomation(options?: {
  triggeredBy?: string
  forceManual?: boolean
}): Promise<HepsiJetAutomationRunSummary & { items: AutomationOrderItemResult[] }> {
  const db = getAdminFirestore()
  const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
  const triggeredAt = new Date().toISOString()

  // 1. Ayarları Getir
  const automationSettings = await getHepsiJetAutomationSettingsServer()
  const hepsiJetSettings = await getHepsiJetSettingsServer()

  // Otomasyon kapalıysa ve manuel zorlama yoksa çık
  if (!automationSettings.enabled && !options?.forceManual) {
    const summary: HepsiJetAutomationRunSummary = {
      runId,
      triggeredAt,
      completedAt: new Date().toISOString(),
      status: 'completed',
      totalChecked: 0,
      readyCount: 0,
      pendingReviewCount: 0,
      failedCount: 0,
      unknownCount: 0,
      isSimulated: true,
      message: 'HepsiJET otomasyonu ayarlardan devre dışı bırakılmış.',
    }
    return { ...summary, items: [] }
  }

  // 2. Dağıtık Eşzamanlılık Kilidi (Concurrency Lock)
  const lockRef = db.collection(LOCKS_COLLECTION).doc(LOCK_DOC)
  const lockAcquired = await db.runTransaction(async (t) => {
    const snap = await t.get(lockRef)
    const now = Date.now()
    if (snap.exists) {
      const lockData = snap.data()
      if (lockData?.locked === true) {
        const lockedAt = lockData.lockedAt || 0
        const lockTimeout = 15 * 60 * 1000 // 15 dakika kilit aşımı
        if (now - lockedAt < lockTimeout) {
          return false
        }
      }
    }
    t.set(lockRef, {
      locked: true,
      lockedAt: now,
      runId,
      triggeredBy: options?.triggeredBy || 'system',
    })
    return true
  })

  if (!lockAcquired) {
    const summary: HepsiJetAutomationRunSummary = {
      runId,
      triggeredAt,
      completedAt: new Date().toISOString(),
      status: 'locked',
      totalChecked: 0,
      readyCount: 0,
      pendingReviewCount: 0,
      failedCount: 0,
      unknownCount: 0,
      isSimulated: true,
      message: 'Başka bir otomasyon görevi şu anda aktif olarak çalışıyor. Çift çalışma engellendi.',
    }
    return { ...summary, items: [] }
  }

  try {
    const maxBatch = automationSettings.maxBatchSize || 50

    // 3. İşlenecek Aday Siparişleri Getir
    // Henüz başarıyla oluşturulmamış siparişler
    const ordersSnap = await db
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(maxBatch * 2)
      .get()

    const candidateOrders: any[] = []
    ordersSnap.forEach((doc) => {
      const ord = { ...(doc.data() as any), id: doc.id }
      // Zaten kargoya verilmiş, iptal edilmiş veya işlemdeki siparişleri atla
      if (
        ord.shipping?.status === 'created' ||
        ord.shipping?.status === 'cancelled' ||
        ord.shipping?.status === 'cancel_pending'
      ) {
        return
      }
      // İptal edilmiş, iade edilmiş veya teslimatı tamamlanmış siparişleri aday havuzundan atla
      if (
        ord.status === 'cancelled' ||
        ord.status === 'refunded' ||
        ord.status === 'returned' ||
        ord.status === 'shipped' ||
        ord.status === 'delivered'
      ) {
        return
      }
      candidateOrders.push(ord)
    })

    const selectedOrders = candidateOrders.slice(0, maxBatch)
    const evaluatedItems: AutomationOrderItemResult[] = []

    let readyCount = 0
    let pendingReviewCount = 0
    let failedCount = 0
    let unknownCount = 0

    // 4. Her Siparişi Hibrit Kurallarla Değerlendir ve Durumu Kaydet
    for (const order of selectedOrders) {
      if (order.shipping?.status === 'unknown') {
        unknownCount++
      } else if (order.shipping?.status === 'failed') {
        failedCount++
      }

      const evaluation = evaluateOrderForAutomation(order, hepsiJetSettings)
      const orderRef = db.collection('orders').doc(order.id)

      if (evaluation.status === 'ready') {
        readyCount++
        // Siparişi güvenle 'ready_for_dispatch' ve 'automationStatus: ready' olarak işaretle
        await orderRef.set(
          {
            shipping: {
              ...(order.shipping || {}),
              carrier: 'hepsijet',
              status: 'ready_for_dispatch',
              automationStatus: 'ready',
              automationReasons: evaluation.reasons,
              automationRunId: runId,
              automationEvaluatedAt: new Date().toISOString(),
              desi: evaluation.desi,
              weight: evaluation.weight,
              packageCount: evaluation.packageCount,
              liveRequestMade: false,
            },
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      } else {
        pendingReviewCount++
        await orderRef.set(
          {
            shipping: {
              ...(order.shipping || {}),
              carrier: 'hepsijet',
              status: 'pending_review',
              automationStatus: 'pending_review',
              automationReasons: evaluation.reasons,
              automationRunId: runId,
              automationEvaluatedAt: new Date().toISOString(),
              desi: evaluation.desi,
              weight: evaluation.weight,
              packageCount: evaluation.packageCount,
              liveRequestMade: false,
            },
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        )
      }

      evaluatedItems.push({
        orderId: order.id,
        orderNumber: order.orderNumber || order.id,
        customerName: order.shippingAddress?.fullName || order.customer?.name || 'İsimsiz Müşteri',
        totalAmount: order.totalAmount || 0,
        status: evaluation.status,
        reasons: evaluation.reasons,
        desi: evaluation.desi,
        weight: evaluation.weight,
        packageCount: evaluation.packageCount,
        evaluatedAt: new Date().toISOString(),
      })
    }

    const completedAt = new Date().toISOString()
    const summaryMessage =
      selectedOrders.length === 0
        ? 'Kayıtlı uygun sipariş bulunamadı.'
        : `${selectedOrders.length} sipariş incelendi: ${readyCount} gönderime hazır, ${pendingReviewCount} yönetici onayı bekliyor.`

    const summary: HepsiJetAutomationRunSummary = {
      runId,
      triggeredAt,
      completedAt,
      status: 'completed',
      totalChecked: selectedOrders.length,
      readyCount,
      pendingReviewCount,
      failedCount,
      unknownCount,
      isSimulated: true, // Korumalı mod: Canlı gönderi yapılmadı
      message: summaryMessage,
    }

    // 5. Çalışma Kaydını Firestore'a Logla
    await db.collection('hepsijet_automation_logs').doc(runId).set({
      summary,
      items: evaluatedItems,
      triggeredBy: options?.triggeredBy || 'system',
      createdAt: completedAt,
    })

    // 6. Otomasyon Ayarlarında Son Çalışma ve Bir Sonraki Saati Güncelle
    await saveHepsiJetAutomationSettingsServer(
      {
        lastRunAt: completedAt,
        lastRunId: runId,
        lastRunSummary: summary,
      },
      options?.triggeredBy || 'system'
    )

    return {
      ...summary,
      items: evaluatedItems,
    }
  } catch (error: any) {
    console.error('runHepsiJetDailyAutomation error:', error)
    const completedAt = new Date().toISOString()
    const failedSummary: HepsiJetAutomationRunSummary = {
      runId,
      triggeredAt,
      completedAt,
      status: 'failed',
      totalChecked: 0,
      readyCount: 0,
      pendingReviewCount: 0,
      failedCount: 1,
      unknownCount: 0,
      isSimulated: true,
      message: `Otomasyon yürütülürken hata: ${error.message || 'Bilinmeyen sistem hatası'}`,
    }

    await saveHepsiJetAutomationSettingsServer({
      lastRunAt: completedAt,
      lastRunId: runId,
      lastRunSummary: failedSummary,
    }).catch(() => null)

    return { ...failedSummary, items: [] }
  } finally {
    // 7. Kilidi Serbest Bırak
    await lockRef.set({ locked: false, releasedAt: Date.now() }, { merge: true }).catch(() => null)
  }
}
