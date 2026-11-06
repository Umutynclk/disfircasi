import { NextRequest, NextResponse } from 'next/server'
import { verifyPrintAgentRequest } from '@/lib/printing/agentAuth'
import { claimNextPrintJobServer } from '@/lib/printing/queue'

/**
 * Windows Agent için Sıradaki İşi Talep Etme Uç Noktası (Poll / Claim)
 * POST /api/print-agent/jobs/poll
 */
export async function POST(req: NextRequest) {
  // 1. Agent Kimlik Doğrulaması (Token Hash Kontrolü)
  const auth = await verifyPrintAgentRequest(req)
  if (!auth.isAuthorized || !auth.agent) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Yetkisiz erişim.' },
      { status: 401 }
    )
  }

  try {
    const body = await req.json().catch(() => ({}))
    const printerId = body.printerId || auth.agent.printerId

    // Agent'ın çevrimiçi (online) olduğunu doğrula ve son sinyal zamanını güncelle
    try {
      const { getAdminFirestore } = await import('@/lib/firebase/admin')
      const db = getAdminFirestore()
      await db.collection('print_agents').doc(auth.agent.agentId).set(
        {
          lastHeartbeatAt: new Date().toISOString(),
          printerId: printerId || '4BARCODE 4B-2054TG',
          online: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )
    } catch (heartbeatErr) {
      console.warn('Heartbeat update warning:', heartbeatErr)
    }

    // 2. Atomik Kilit ile Sıradaki İşi Rezerve Et
    const job = await claimNextPrintJobServer(auth.agent.agentId, printerId)

    if (!job) {
      return NextResponse.json({
        success: true,
        job: null,
        message: 'Kuyrukta bekleyen yazdırma işi bulunamadı.',
      })
    }

    return NextResponse.json({
      success: true,
      job,
      message: `İş başarıyla rezerve edildi (${job.type}).`,
    })
  } catch (error: any) {
    console.error('Print agent poll error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Kuyruk sorgulanırken bir hata oluştu.' },
      { status: 500 }
    )
  }
}
