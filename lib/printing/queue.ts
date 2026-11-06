import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { isSampleBarcode } from '@/lib/hepsijet/sampleLabel'
import { PrintJob, PrintJobType, PrintJobStatus, AckPrintJobBody } from './types'

const QUEUE_COLLECTION = 'print_queue'
const LEASE_DURATION_MS = 5 * 60 * 1000 // 5 dakika kilit/lease süresi
const MAX_PRINT_ATTEMPTS = 3

/**
 * Bir siparişin gerçek kargo etiketi kuyruğuna alınmaya uygun olup olmadığını doğrular.
 */
export function validateOrderForPrintQueue(order: any): { isValid: boolean; error?: string } {
  if (!order) {
    return { isValid: false, error: 'Sipariş nesnesi tanımsız.' }
  }

  // 1. Ödeme Kontrolü
  if (order.paymentStatus !== 'PAID') {
    return {
      isValid: false,
      error: `Sipariş ödemesi tamamlanmamış (Mevcut: ${order.paymentStatus || 'BEKLİYOR'}). Yalnızca PAID siparişler basılabilir.`,
    }
  }

  // 2. İptal / İade Kontrolü
  if (order.status === 'cancelled') {
    return { isValid: false, error: 'İptal edilmiş sipariş için kargo etiketi basılamaz.' }
  }
  if (order.status === 'refunded' || order.status === 'returned') {
    return { isValid: false, error: 'İade edilmiş sipariş için kargo etiketi basılamaz.' }
  }

  // 3. Kargo Durumu Kontrolü
  const shipping = order.shipping
  if (shipping?.status !== 'created') {
    return {
      isValid: false,
      error: `Sipariş kargo gönderisi henüz oluşturulmamış (Mevcut kargo durumu: ${shipping?.status || 'yok'}). Yalnızca 'created' kargolar basılabilir.`,
    }
  }

  // 4. Gerçek Barkod Kontrolü
  const barcode = (shipping.barcode || shipping.trackingNumber || '').trim()
  if (!barcode) {
    return { isValid: false, error: 'Sipariş için kargo takip barkodu bulunamadı.' }
  }

  // 5. Simülasyon / Test Barkodu Güvenlik Engeli
  if (isSampleBarcode(barcode)) {
    return {
      isValid: false,
      error: `Bu barkod (${barcode}) bir test/simülasyon barkodudur. Gerçek baskı kuyruğuna test barkodu eklenemez!`,
    }
  }

  return { isValid: true }
}

/**
 * Gerçek bir kargo siparişinin birleşik etiketini atomik olarak yazdırma kuyruğuna ekler.
 * Mükerrer eklemeyi idempoten doküman anahtarı (`job_label_${orderId}_${barcode}`) ile önler.
 */
export async function queueShippingLabelJob(
  order: any,
  options?: { printerId?: string; retryIfFailed?: boolean }
): Promise<{ success: boolean; job: PrintJob; message: string }> {
  const validation = validateOrderForPrintQueue(order)
  if (!validation.isValid) {
    throw new Error(validation.error)
  }

  const barcode = (order.shipping.barcode || order.shipping.trackingNumber).trim()
  const idempotencyKey = `job_label_${order.id}_${barcode}`

  const db = getAdminFirestore()
  const jobRef = db.collection(QUEUE_COLLECTION).doc(idempotencyKey)

  return await db.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(jobRef)
    const now = new Date().toISOString()

    if (docSnap.exists) {
      const existing = docSnap.data() as PrintJob

      // Zaten başarıyla basılmışsa tekrar ekleme
      if (existing.status === 'printed') {
        return {
          success: true,
          job: existing,
          message: 'Bu siparişin etiketi zaten başarıyla yazdırılmış.',
        }
      }

      // Halihazırda kuyrukta veya işlemde ise tekrar ekleme
      if (existing.status === 'pending' || existing.status === 'processing') {
        return {
          success: true,
          job: existing,
          message: 'Bu sipariş etiketi zaten yazdırma kuyruğunda bekliyor.',
        }
      }

      // Önceden başarısız olmuşsa ve retry istenmişse sıfırla
      if (existing.status === 'failed' && options?.retryIfFailed) {
        const resetJob: PrintJob = {
          ...existing,
          status: 'pending',
          attemptCount: 0,
          updatedAt: now,
          lockedBy: undefined,
          lockedAt: undefined,
          leaseExpiresAt: undefined,
        }
        transaction.set(jobRef, resetJob)
        const orderRef = db.collection('orders').doc(order.id)
        transaction.update(orderRef, {
          'shipping.printStatus': 'queued',
          'shipping.printJobId': idempotencyKey,
          'shipping.printError': null,
          updatedAt: now,
        })
        return {
          success: true,
          job: resetJob,
          message: 'Başarısız olan yazdırma işi yeniden kuyruğa alındı.',
        }
      }

      return {
        success: false,
        job: existing,
        message: 'Bu sipariş etiketi daha önce başarısız olarak işaretlenmiş.',
      }
    }

    const newJob: PrintJob = {
      jobId: idempotencyKey,
      orderId: order.id,
      orderNumber: order.orderNumber || order.id,
      barcode,
      type: 'shipping_label',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      attemptCount: 0,
      maxAttempts: MAX_PRINT_ATTEMPTS,
      idempotencyKey,
      printerId: options?.printerId || '4BARCODE 4B-2054TG',
      metadata: {
        customerDeliveryNo: order.shipping?.customerDeliveryNo,
      },
    }

    transaction.set(jobRef, newJob)

    // Sipariş dokümanı üzerine de kuyruk bilgisini kaydet
    const orderRef = db.collection('orders').doc(order.id)
    transaction.update(orderRef, {
      'shipping.printStatus': 'queued',
      'shipping.printJobId': idempotencyKey,
      'shipping.printQueuedAt': now,
      updatedAt: now,
    })

    return {
      success: true,
      job: newJob,
      message: 'Kargo etiketi başarıyla yazdırma kuyruğuna eklendi.',
    }
  })
}

/**
 * Günlük taramada hiç sevk edilecek sipariş bulunamadığında, günde tek seferlik
 * bilgilendirme fişi işini atomik olarak kuyruğa ekler.
 */
export async function queueNoOrdersNoticeJob(
  dateStr: string,
  options?: { totalChecked?: number; printerId?: string }
): Promise<{ success: boolean; job: PrintJob; message: string }> {
  const cleanDate = dateStr.trim().replace(/[^0-9-]/g, '')
  if (!cleanDate || cleanDate.length !== 10) {
    throw new Error('Geçersiz bildirim tarihi (YYYY-MM-DD bekleniyor).')
  }

  const idempotencyKey = `job_notice_no_orders_${cleanDate}`
  const db = getAdminFirestore()
  const jobRef = db.collection(QUEUE_COLLECTION).doc(idempotencyKey)

  return await db.runTransaction(async (transaction) => {
    const docSnap = await transaction.get(jobRef)
    const now = new Date().toISOString()

    if (docSnap.exists) {
      const existing = docSnap.data() as PrintJob
      return {
        success: true,
        job: existing,
        message: `Bugün (${cleanDate}) için boş sipariş bildirimi zaten kuyrukta mevcut.`,
      }
    }

    const newJob: PrintJob = {
      jobId: idempotencyKey,
      orderId: null,
      type: 'no_orders_notice',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      attemptCount: 0,
      maxAttempts: MAX_PRINT_ATTEMPTS,
      idempotencyKey,
      printerId: options?.printerId || '4BARCODE 4B-2054TG',
      metadata: {
        noticeDate: cleanDate,
        totalChecked: options?.totalChecked || 0,
      },
    }

    transaction.set(jobRef, newJob)

    return {
      success: true,
      job: newJob,
      message: `Boş sipariş bildirimi kuyruğa eklendi (${cleanDate}).`,
    }
  })
}

/**
 * Windows Agent için sıradaki bekleyen işi atomik olarak talep eder ve kilitler (Claim / Lease).
 * Eşzamanlı iki agent'ın aynı işi almasını Firestore transaction ile kesinlikle engeller.
 */
export async function claimNextPrintJobServer(
  agentId: string,
  printerId?: string
): Promise<PrintJob | null> {
  const db = getAdminFirestore()
  const now = Date.now()

  // 1. Önce bekleyen veya zaman aşımına uğramış aday işleri sorgula
  const pendingSnap = await db
    .collection(QUEUE_COLLECTION)
    .where('status', '==', 'pending')
    .orderBy('createdAt', 'asc')
    .limit(5)
    .get()

  let candidateDocs = pendingSnap.docs

  // Eğer bekleyen yoksa, lease'i dolmuş processing işleri tara (Recover stale processing jobs)
  if (candidateDocs.length === 0) {
    const staleSnap = await db
      .collection(QUEUE_COLLECTION)
      .where('status', '==', 'processing')
      .where('leaseExpiresAt', '<=', now)
      .limit(5)
      .get()
    candidateDocs = staleSnap.docs
  }

  if (candidateDocs.length === 0) {
    return null
  }

  // 2. İlk uygun adayı transaction ile atomik olarak kilitle
  for (const doc of candidateDocs) {
    const jobRef = doc.ref
    try {
      const claimedJob = await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(jobRef)
        if (!snap.exists) return null

        const data = snap.data() as PrintJob
        const currentNow = Date.now()

        // İşi hala alabilir durumda mıyız?
        const isPending = data.status === 'pending'
        const isStaleProcessing =
          data.status === 'processing' &&
          typeof data.leaseExpiresAt === 'number' &&
          data.leaseExpiresAt <= currentNow

        if (!isPending && !isStaleProcessing) {
          // Başka bir agent almış
          return null
        }

        const newAttemptCount = (data.attemptCount || 0) + 1
        const leaseExpiresAt = currentNow + LEASE_DURATION_MS

        const updatedJob: PrintJob = {
          ...data,
          status: 'processing',
          lockedBy: agentId,
          lockedAt: currentNow,
          leaseExpiresAt,
          attemptCount: newAttemptCount,
          updatedAt: new Date(currentNow).toISOString(),
        }

        transaction.set(jobRef, updatedJob)
        return updatedJob
      })

      if (claimedJob) {
        return claimedJob
      }
    } catch (err) {
      console.warn(`claimNextPrintJob candidate ${doc.id} transaction race, retrying next:`, err)
    }
  }

  return null
}

/**
 * Windows Agent tarafından baskı sonucunu (printed veya failed) bildirir.
 */
export async function ackPrintJobServer(
  jobId: string,
  agentId: string,
  result: AckPrintJobBody
): Promise<{ success: boolean; job: PrintJob; message: string }> {
  const db = getAdminFirestore()
  const jobRef = db.collection(QUEUE_COLLECTION).doc(jobId)

  return await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(jobRef)
    if (!snap.exists) {
      throw new Error(`Yazdırma işi bulunamadı: ${jobId}`)
    }

    const job = snap.data() as PrintJob
    const now = new Date().toISOString()

    // Kilidi alan agent ile bildirim yapan agent aynı olmalı (veya lease dolmamış olmalı)
    if (job.lockedBy && job.lockedBy !== agentId) {
      throw new Error(`Bu iş başka bir agent (${job.lockedBy}) tarafından kilitlenmiş. Bildirim reddedildi.`)
    }

    // GÜVENLİK KURALI: Simülasyon (dry-run) modundaki agent ASLA 'printed' bildiremez
    if (result.isDryRun && result.status === 'printed') {
      throw new Error(
        "Güvenlik ihlali: Simülasyon (dry-run) modundaki bir agent 'printed' bildirimi yapamaz. Lütfen 'simulated' durumunu kullanın."
      )
    }

    // 1. SİMÜLASYON TAMAMLANDI BİLDİRİMİ
    if (result.status === 'simulated') {
      const updatedJob: PrintJob = {
        ...job,
        status: 'simulated',
        simulatedAt: now,
        isDryRun: true,
        updatedAt: now,
        lockedBy: undefined,
        lockedAt: undefined,
        leaseExpiresAt: undefined,
        metadata: {
          ...(job.metadata || {}),
          ...(result.simulatedOutputPath ? { simulatedOutputPath: result.simulatedOutputPath } : {}),
        },
      }

      transaction.set(jobRef, updatedJob)

      // KESİN GÜVENLİK KURALI: Sipariş asla 'printed' yapılmaz!
      if (job.orderId) {
        const orderRef = db.collection('orders').doc(job.orderId)
        transaction.update(orderRef, {
          'shipping.printStatus': 'simulated',
          'shipping.simulatedAt': now,
          updatedAt: now,
        })
      }

      return {
        success: true,
        job: updatedJob,
        message: 'İş simülasyon olarak tamamlandı. Gerçek sipariş printed yapılmadı.',
      }
    }

    // 2. GERÇEK FİZİKSEL BASKI BİLDİRİMİ (Yalnızca Windows ve dryRun=false)
    if (result.status === 'printed') {
      const updatedJob: PrintJob = {
        ...job,
        status: 'printed',
        printedAt: now,
        isDryRun: false,
        updatedAt: now,
        lockedBy: undefined,
        lockedAt: undefined,
        leaseExpiresAt: undefined,
      }

      transaction.set(jobRef, updatedJob)

      // İlgili siparişi de güncelle
      if (job.orderId) {
        const orderRef = db.collection('orders').doc(job.orderId)
        transaction.update(orderRef, {
          'shipping.printStatus': 'printed',
          'shipping.printedAt': now,
          updatedAt: now,
        })
      }

      return {
        success: true,
        job: updatedJob,
        message: 'Yazdırma başarıyla tamamlandı olarak kaydedildi.',
      }
    } else {
      // Hata durumu
      const attempts = job.attemptCount || 1
      const isPermanentlyFailed = attempts >= (job.maxAttempts || MAX_PRINT_ATTEMPTS)

      const updatedJob: PrintJob = {
        ...job,
        status: isPermanentlyFailed ? 'failed' : 'pending', // Yeniden denenebilir mi?
        updatedAt: now,
        lockedBy: undefined,
        lockedAt: undefined,
        leaseExpiresAt: undefined,
        lastError: {
          code: result.errorCode || 'PRINT_FAILED',
          message: result.errorMessage || 'Yazıcı çıktısı alınamadı.',
          timestamp: now,
        },
      }

      transaction.set(jobRef, updatedJob)

      if (job.orderId && isPermanentlyFailed) {
        const orderRef = db.collection('orders').doc(job.orderId)
        transaction.update(orderRef, {
          'shipping.printStatus': 'failed',
          'shipping.printError': result.errorMessage || 'Yazdırma başarısız',
          updatedAt: now,
        })
      }

      return {
        success: true,
        job: updatedJob,
        message: isPermanentlyFailed
          ? 'Azami deneme sınırına ulaşıldı, iş failed durumuna alındı.'
          : 'Hata kaydedildi, iş daha sonra yeniden denemek üzere beklemeye alındı.',
      }
    }
  })
}

/**
 * Termal yazıcı için "Bugün Sevk Edilecek Sipariş Bulunamadı" bildirim fişi PDF'i üretir.
 */
export async function generateNoOrdersNoticePdf(options: {
  dateStr: string
  totalChecked?: number
  printerId?: string
}): Promise<Buffer> {
  // 100 × 150 mm (Dikey) Termal Boyut (283.46 pt × 425.20 pt)
  const MM_TO_PT = 72 / 25.4
  const widthPt = 100 * MM_TO_PT
  const heightPt = 150 * MM_TO_PT

  const doc = await PDFDocument.create()
  const page = doc.addPage([widthPt, heightPt])

  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica)

  // Dış Kesikli Çerçeve
  page.drawRectangle({
    x: 8,
    y: 8,
    width: widthPt - 16,
    height: heightPt - 16,
    borderColor: rgb(0.2, 0.2, 0.2),
    borderWidth: 1.5,
  })

  // Başlık Kutusu
  page.drawRectangle({
    x: 12,
    y: heightPt - 60,
    width: widthPt - 24,
    height: 44,
    color: rgb(0.1, 0.1, 0.1),
  })

  page.drawText('KALIPORT LOJISTIK', {
    x: 20,
    y: heightPt - 38,
    size: 15,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  page.drawText('GUNLUK SEVKIYAT BILDIRIMI', {
    x: 20,
    y: heightPt - 52,
    size: 9,
    font: fontRegular,
    color: rgb(0.9, 0.9, 0.9),
  })

  // Tarih ve Saat Bilgisi
  const dateText = `Tarih: ${options.dateStr}`
  const timeText = `Olusturma: ${new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })}`

  page.drawText(dateText, {
    x: 20,
    y: heightPt - 85,
    size: 10,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2),
  })

  page.drawText(timeText, {
    x: 20,
    y: heightPt - 100,
    size: 9,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  })

  // Ana Durum Mesajı Kutusu
  page.drawRectangle({
    x: 16,
    y: heightPt - 220,
    width: widthPt - 32,
    height: 105,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.96, 0.96, 0.96),
  })

  page.drawText('SEVKIYAT BULUNAMADI', {
    x: 24,
    y: heightPt - 135,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  })

  const lines = [
    'Bugun icin onaylanmis ve kargoya',
    'verilmeye hazir siparis kaydi',
    'tespit edilememistir.',
    `Incelenen Siparis: ${options.totalChecked ?? 0}`,
    'Yeni kargo olusturuldugunda',
    'etiketler otomatik kuyruga',
    'aktarilacaktir.',
  ]

  let textY = heightPt - 155
  for (const line of lines) {
    page.drawText(line, {
      x: 24,
      y: textY,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    })
    textY -= 11
  }

  // Alt Bilgi
  page.drawText(`Yazici: ${options.printerId || '4BARCODE 4B-2054TG'}`, {
    x: 20,
    y: 25,
    size: 8,
    font: fontRegular,
    color: rgb(0.5, 0.5, 0.5),
  })

  page.drawText('Sistem Otomatik Ciktisidir', {
    x: 20,
    y: 15,
    size: 7,
    font: fontRegular,
    color: rgb(0.6, 0.6, 0.6),
  })

  const pdfBytes = await doc.save()
  return Buffer.from(pdfBytes)
}

/**
 * Baskı kuyruğu durum istatistiklerini getirir.
 */
export async function getPrintQueueStatsServer(): Promise<{
  pending: number
  processing: number
  printed: number
  simulated: number
  failed: number
  total: number
}> {
  const db = getAdminFirestore()
  const snap = await db.collection(QUEUE_COLLECTION).get()
  const stats = {
    pending: 0,
    processing: 0,
    printed: 0,
    simulated: 0,
    failed: 0,
    total: snap.size,
  }

  snap.forEach((doc) => {
    const data = doc.data()
    const st = (data.status || 'pending') as PrintJobStatus
    if (st in stats) {
      stats[st as keyof typeof stats]++
    }
  })

  return stats
}

