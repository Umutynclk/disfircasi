import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyPrintAgentRequest } from '@/lib/printing/agentAuth'
import { generateNoOrdersNoticePdf } from '@/lib/printing/queue'
import { PrintJob } from '@/lib/printing/types'
import { getHepsiJetSettingsServer } from '@/lib/hepsijet/settings'
import { fetchHepsiJetBarcodeLabel } from '@/lib/hepsijet/client'
import { generateCombinedThermalLabelPdf, OrderForCombinedLabel } from '@/lib/printing/combined-label'

const QUEUE_COLLECTION = 'print_queue'

/**
 * Windows Agent için İş PDF'sini Getirme Uç Noktası
 * GET /api/print-agent/jobs/[id]/pdf
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // 1. Agent Kimlik Doğrulaması
  const auth = await verifyPrintAgentRequest(req)
  if (!auth.isAuthorized || !auth.agent) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Yetkisiz erişim.' },
      { status: 401 }
    )
  }

  const { id: jobId } = await context.params

  if (!jobId) {
    return NextResponse.json(
      { success: false, error: 'İş ID (jobId) zorunludur.' },
      { status: 400 }
    )
  }

  try {
    const db = getAdminFirestore()
    const jobSnap = await db.collection(QUEUE_COLLECTION).doc(jobId).get()

    if (!jobSnap.exists) {
      return NextResponse.json(
        { success: false, error: 'Yazdırma işi bulunamadı.' },
        { status: 404 }
      )
    }

    const job = jobSnap.data() as PrintJob

    // 2. Yetki / Kilit Kontrolü
    // İş ya bu agent tarafından kilitlenmiş olmalı ya da processing/printed aşamasında olmalı
    if (job.lockedBy && job.lockedBy !== auth.agent.agentId && job.status === 'processing') {
      return NextResponse.json(
        {
          success: false,
          error: `Bu yazdırma işi başka bir agent (${job.lockedBy}) tarafından işlenmektedir.`,
        },
        { status: 403 }
      )
    }

    // 3. İŞ TÜRÜNE GÖRE PDF ÜRETİMİ
    if (job.type === 'no_orders_notice') {
      // Boş Sipariş Bildirim Fişi
      const dateStr = job.metadata?.noticeDate || new Date().toISOString().split('T')[0]
      const noticeBuffer = await generateNoOrdersNoticePdf({
        dateStr,
        totalChecked: job.metadata?.totalChecked,
        printerId: auth.agent.printerId,
      })

      return new NextResponse(noticeBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="notice-${dateStr}.pdf"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    if (job.status === 'cancelled') {
      return NextResponse.json(
        {
          success: false,
          code: 'PRINT_JOB_CANCELLED',
          error: 'Bu yazdırma işi iptal edildiği için PDF oluşturulamaz.',
        },
        { status: 409 }
      )
    }

    if (job.type === 'shipping_label') {
      // Kargo ve Sipariş Bilgi Fişi (Combined Label)
      if (!job.orderId) {
        return NextResponse.json(
          { success: false, error: 'Kargo etiketi işinde sipariş ID eksik.' },
          { status: 400 }
        )
      }

      const orderSnap = await db.collection('orders').doc(job.orderId).get()
      if (!orderSnap.exists) {
        return NextResponse.json(
          { success: false, error: 'Sipariş veritabanında bulunamadı.' },
          { status: 404 }
        )
      }

      const rawOrder = orderSnap.data() || {}
      const ordStatus = String(rawOrder.status || '').toLowerCase()
      const shipStatus = String(rawOrder.shipping?.status || '').toLowerCase()
      const payStatus = String(rawOrder.paymentStatus || '')

      // FİZİKSEL BASKI ÖNCESİ SON AN YARIŞ DURUMU KORUMASI:
      // Poll ile PDF indirme arasında sipariş iptal edildiyse PDF kesinlikle servis edilmez.
      const orderIneligibleBeforePrint =
        ordStatus === 'cancelled' ||
        ordStatus === 'refunded' ||
        ordStatus === 'returned' ||
        shipStatus === 'cancelled' ||
        payStatus !== 'PAID'

      if (orderIneligibleBeforePrint) {
        const nowIso = new Date().toISOString()
        const physicalAlreadyStarted =
          job.status === 'printed' || Boolean(job.metadata?.submittedToSpoolerAt)

        if (!physicalAlreadyStarted) {
          // Fiziksel baskı henüz başlamadıysa işi güvenle iptal et
          await db
            .collection(QUEUE_COLLECTION)
            .doc(jobId)
            .set(
              {
                status: 'cancelled',
                updatedAt: nowIso,
                lastError: {
                  code: 'ORDER_CANCELLED_BEFORE_PRINT',
                  message: `Fiziksel baskı öncesi sipariş durumu değişti (status=${ordStatus}, shipping=${shipStatus}, payment=${payStatus}). PDF engellendi.`,
                  timestamp: nowIso,
                },
              },
              { merge: true }
            )
        } else {
          // Fiziksel baskı başlamışsa mevcut 'printed' durumunu bozma, sadece denetim notu düş
          await db
            .collection(QUEUE_COLLECTION)
            .doc(jobId)
            .set(
              {
                updatedAt: nowIso,
                metadata: {
                  ...(job.metadata || {}),
                  physicalPrintMayHaveStarted: true,
                  orderCancelledDetectedAtPdfFetch: nowIso,
                },
              },
              { merge: true }
            )
        }

        return NextResponse.json(
          {
            success: false,
            code: 'ORDER_CANCELLED_BEFORE_PRINT',
            physicalPrintMayHaveStarted: physicalAlreadyStarted,
            error: 'Sipariş iptal edildiği veya baskı uygunluğunu kaybettiği için etiket PDF indirmesi engellendi.',
          },
          { status: 409 }
        )
      }

      const orderData = { ...rawOrder, id: orderSnap.id } as OrderForCombinedLabel
      const barcode = job.barcode || orderData.shipping?.barcode || orderData.shipping?.customerDeliveryNo

      if (!barcode) {
        return NextResponse.json(
          { success: false, error: 'Sipariş için kargo barkodu bulunamadı.' },
          { status: 400 }
        )
      }

      const settings = await getHepsiJetSettingsServer()

      // Kaynak HepsiJET barkod etiketini al
      const { data: labelData } = await fetchHepsiJetBarcodeLabel([barcode], 'PDF')
      const hepsijetBuffer = Buffer.isBuffer(labelData) ? labelData : Buffer.from(labelData as string)

      // Birleşik PDF üret (HepsiJET Etiketi + KALIPORT Sipariş Fişi)
      const combinedBuffer = await generateCombinedThermalLabelPdf({
        order: orderData,
        hepsijetPdfBuffer: hepsijetBuffer,
        settings,
      })

      const safeFilename = `etiket-${orderData.orderNumber || barcode}.pdf`

      return new NextResponse(combinedBuffer as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${safeFilename}"`,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      })
    }

    return NextResponse.json(
      { success: false, error: `Bilinmeyen iş türü: ${job.type}` },
      { status: 400 }
    )
  } catch (error: any) {
    console.error(`Print agent PDF generation error for job ${jobId}:`, error?.message)
    return NextResponse.json(
      {
        success: false,
        error: `Etiket PDF'i üretilirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`,
      },
      { status: 500 }
    )
  }
}
