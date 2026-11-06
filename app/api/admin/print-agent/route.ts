import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { getAdminFirestore } from '@/lib/firebase/admin'
import {
  createPrintAgentServer,
  updatePrintAgentStatusServer,
  regenerateAgentTokenServer,
  deletePrintAgentServer,
} from '@/lib/printing/agentAuth'
import { getPrintQueueStatsServer } from '@/lib/printing/queue'

/**
 * KALIPORT / SONRAKAM.COM - Admin Print Agent Yönetimi
 * GET: Kayıtlı yazdırma cihazlarını, son sinyal durumlarını ve kuyruk istatistiklerini listeler.
 * POST: Yeni Windows Print Agent cihazı ve güvenli kimlik doğrulama tokenı üretir.
 * PATCH: Token yenileme (regenerate_token) veya durum değiştirme (active/revoked).
 * DELETE: Agent kaydını siler.
 */

export async function GET(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const db = getAdminFirestore()
    const snapshot = await db.collection('print_agents').orderBy('createdAt', 'desc').get()
    const now = Date.now()

    const agents = snapshot.docs.map((doc) => {
      const data = doc.data()
      const lastHbMs = data.lastHeartbeatAt ? new Date(data.lastHeartbeatAt).getTime() : 0
      const lastSeenMs = data.lastSeenAt ? new Date(data.lastSeenAt).getTime() : 0
      const mostRecentTime = Math.max(lastHbMs, lastSeenMs)
      // 90 saniye içinde sinyal vermişse online kabul edilir
      const isOnline = Boolean(data.status === 'active' && mostRecentTime > 0 && now - mostRecentTime < 90000)

      return {
        agentId: data.agentId || doc.id,
        name: data.name || doc.id,
        printerId: data.printerId || '4BARCODE 4B-2054TG',
        status: data.status || 'active',
        isOnline,
        lastHeartbeatAt: data.lastHeartbeatAt || null,
        lastSeenAt: data.lastSeenAt || null,
        createdAt: data.createdAt || null,
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const agentId = (body.agentId || 'kaliport-win-01').trim()
    const name = (body.name || 'Windows Palmx TXP-400').trim()
    const printerId = (body.printerId || '4BARCODE 4B-2054TG').trim()
    const description = (body.description || 'PALMX TXP 400 Termal Yazıcı Windows Servisi').trim()

    const result = await createPrintAgentServer({
      agentId,
      name,
      printerId,
      description,
    })

    return NextResponse.json({
      success: true,
      agent: {
        agentId: result.agent.agentId,
        name: result.agent.name,
        printerId: result.agent.printerId,
        status: result.agent.status,
      },
      rawToken: result.rawToken,
      message: 'Windows Print Agent cihazı ve güvenli token başarıyla oluşturuldu.',
    })
  } catch (error: any) {
    console.error('Create print agent error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

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

    if (action === 'regenerate_token') {
      const { rawToken } = await regenerateAgentTokenServer(agentId)
      return NextResponse.json({
        success: true,
        agentId,
        rawToken,
        message: 'Agent güvenlik tokenı başarıyla yenilendi.',
      })
    }

    if (status && ['active', 'revoked'].includes(status)) {
      await updatePrintAgentStatusServer(agentId, status)
      return NextResponse.json({
        success: true,
        message: `Agent durumu başarıyla güncellendi: ${status}`,
      })
    }

    return NextResponse.json(
      { success: false, error: 'Geçersiz istek parametreleri.' },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Update print agent error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

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
    return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  }
}

