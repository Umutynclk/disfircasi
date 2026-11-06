import { NextRequest, NextResponse } from 'next/server'
import { verifyPrintAgentRequest } from '@/lib/printing/agentAuth'
import { ackPrintJobServer } from '@/lib/printing/queue'

/**
 * Windows Agent için Baskı Sonucu Bildirim Uç Noktası (Ack / Result)
 * POST /api/print-agent/jobs/[id]/ack
 */
export async function POST(
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
    const body = await req.json().catch(() => ({}))
    const rawStatus = body.status
    let status: 'printed' | 'simulated' | 'failed'
    if (rawStatus === 'simulated') {
      status = 'simulated'
    } else if (rawStatus === 'printed') {
      status = 'printed'
    } else {
      status = 'failed'
    }

    const isDryRun = Boolean(body.isDryRun)
    const simulatedOutputPath = body.simulatedOutputPath ? String(body.simulatedOutputPath) : undefined
    const errorCode = body.errorCode ? String(body.errorCode) : undefined
    const errorMessage = body.errorMessage ? String(body.errorMessage) : undefined

    // 2. Baskı Sonucunu Atomik Olarak Kaydet
    const ackResult = await ackPrintJobServer(jobId, auth.agent.agentId, {
      status,
      isDryRun,
      simulatedOutputPath,
      errorCode,
      errorMessage,
    })

    return NextResponse.json({
      success: true,
      job: ackResult.job,
      message: ackResult.message,
    })
  } catch (error: any) {
    console.error(`Print agent ack error for job ${jobId}:`, error?.message)
    return NextResponse.json(
      { success: false, error: error.message || 'Sonuç bildirimi kaydedilemedi.' },
      { status: 500 }
    )
  }
}
