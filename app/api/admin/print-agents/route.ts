import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import {
  createPrintAgentServer,
  updatePrintAgentStatusServer,
  regenerateAgentTokenServer,
  deletePrintAgentServer,
} from '@/lib/printing/agentAuth'
import { getPrintQueueStatsServer } from '@/lib/printing/queue'
import { PrintAgent } from '@/lib/printing/types'

const AGENTS_COLLECTION = 'print_agents'

/**
 * Yönetici için Print Agent Listeleme Uç Noktası
 * GET /api/admin/print-agents
 */
export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const db = getAdminFirestore()
    const snap = await db.collection(AGENTS_COLLECTION).orderBy('createdAt', 'desc').get()
    const now = Date.now()

    const agents = snap.docs.map((doc) => {
      const data = doc.data() as PrintAgent & { lastHeartbeatAt?: string; online?: boolean }
      
      const lastHbMs = data.lastHeartbeatAt ? new Date(data.lastHeartbeatAt).getTime() : 0
      const lastSeenMs = data.lastSeenAt ? new Date(data.lastSeenAt).getTime() : 0
      const mostRecentTime = Math.max(lastHbMs, lastSeenMs)
      // 90 saniye içinde sinyal vermişse online kabul edilir
      const isOnline = Boolean(data.status === 'active' && mostRecentTime > 0 && (now - mostRecentTime < 90000))

      // Hassas hash ve salt istemciye ASLA gönderilmez
      return {
        agentId: data.agentId,
        name: data.name,
        status: data.status,
        printerId: data.printerId || '4BARCODE 4B-2054TG',
        createdAt: data.createdAt,
        lastSeenAt: data.lastSeenAt || null,
        lastHeartbeatAt: data.lastHeartbeatAt || null,
        isOnline,
        description: data.description || '',
      }
    })

    const queueStats = await getPrintQueueStatsServer().catch(() => ({
      pending: 0,
      processing: 0,
      printed: 0,
      simulated: 0,
      failed: 0,
      total: 0,
    }))

    return NextResponse.json({ success: true, agents, queueStats })
  } catch (error: any) {
    console.error('List print agents error:', error)
    return NextResponse.json({ success: false, error: 'Agent listesi alınamadı.' }, { status: 500 })
  }
}

/**
 * Yönetici için Yeni Print Agent Oluşturma Uç Noktası
 * POST /api/admin/print-agents
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { agentId, name, printerId, description } = body

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json({ success: false, error: 'agentId zorunludur.' }, { status: 400 })
    }

    const { agent, rawToken } = await createPrintAgentServer({
      agentId,
      name: name || agentId,
      printerId: printerId || '4BARCODE 4B-2054TG',
      description,
    })

    return NextResponse.json({
      success: true,
      agent: {
        agentId: agent.agentId,
        name: agent.name,
        status: agent.status,
        printerId: agent.printerId,
        createdAt: agent.createdAt,
        description: agent.description,
      },
      rawToken,
      message:
        'Yazdırma agentı başarıyla oluşturuldu. Verilen agent tokenı yalnızca bir kez gösterilmektedir; lütfen Windows Agent yapılandırma dosyasına güvenli şekilde kaydediniz.',
    })
  } catch (error: any) {
    console.error('Create print agent error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Agent oluşturulamadı.' }, { status: 400 })
  }
}

/**
 * Yönetici için Print Agent Durumunu Güncelleme (Revoke / Activate) veya Token Yenileme
 * PATCH /api/admin/print-agents
 */
export async function PATCH(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { agentId, status, action } = body

    if (!agentId || typeof agentId !== 'string') {
      return NextResponse.json({ success: false, error: 'agentId zorunludur.' }, { status: 400 })
    }

    // Token Yenileme Eylemi (Regenerate / Rotate)
    if (action === 'regenerate_token') {
      const { rawToken } = await regenerateAgentTokenServer(agentId)
      return NextResponse.json({
        success: true,
        agentId,
        rawToken,
        message: 'Agent güvenlik tokenı başarıyla yenilendi. Yeni tokenı Windows config.json dosyasına yapıştırın.',
      })
    }

    // Durum Değiştirme (active / revoked)
    if (status && ['active', 'revoked'].includes(status)) {
      await updatePrintAgentStatusServer(agentId, status)
      return NextResponse.json({
        success: true,
        message: `Agent durumu başarıyla güncellendi: ${status}`,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Geçersiz istek. action="regenerate_token" veya status="active"|"revoked" belirtilmelidir.' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Update print agent error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Agent güncellenemedi.' }, { status: 400 })
  }
}

/**
 * Yönetici için Print Agent Silme Uç Noktası
 * DELETE /api/admin/print-agents
 */
export async function DELETE(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    let agentId = searchParams.get('agentId')

    if (!agentId) {
      const body = await req.json().catch(() => ({}))
      agentId = body.agentId
    }

    if (!agentId) {
      return NextResponse.json({ success: false, error: 'agentId zorunludur.' }, { status: 400 })
    }

    await deletePrintAgentServer(agentId)
    return NextResponse.json({
      success: true,
      message: `Agent kaydı (${agentId}) başarıyla silindi.`,
    })
  } catch (error: any) {
    console.error('Delete print agent error:', error)
    return NextResponse.json({ success: false, error: error.message || 'Agent silinemedi.' }, { status: 400 })
  }
}

