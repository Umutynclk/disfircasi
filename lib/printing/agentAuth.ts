import crypto from 'crypto'
import { NextRequest } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { PrintAgent, PrintAgentAuthResult } from './types'

const AGENTS_COLLECTION = 'print_agents'

/**
 * Token ve salt'tan SHA-256 hash hesaplar.
 */
export function hashAgentToken(token: string, salt: string): string {
  return crypto.createHash('sha256').update(`${salt}:${token.trim()}`).digest('hex')
}

/**
 * Sabit zamanlı güvenli string karşılaştırması (Timing Attack koruması).
 */
export function safeCompareHashes(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

/**
 * Yönetici tarafından yeni bir Print Agent oluşturur ve ham token üretir.
 * Ham token yalnızca oluşturma anında bir kez döner; veritabanında yalnızca hash saklanır.
 */
export async function createPrintAgentServer(options: {
  agentId: string
  name: string
  printerId?: string
  description?: string
}): Promise<{ agent: PrintAgent; rawToken: string }> {
  const db = getAdminFirestore()
  const cleanId = options.agentId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
  if (!cleanId || cleanId.length < 3) {
    throw new Error('Geçersiz agentId. En az 3 alfanümerik karakter olmalıdır.')
  }

  const salt = crypto.randomBytes(16).toString('hex')
  const rawToken = `pa_${crypto.randomBytes(24).toString('hex')}`
  const tokenHash = hashAgentToken(rawToken, salt)

  const agent: PrintAgent = {
    agentId: cleanId,
    name: options.name.trim() || cleanId,
    tokenHash,
    salt,
    status: 'active',
    printerId: options.printerId || '4BARCODE 4B-2054TG',
    createdAt: new Date().toISOString(),
    description: options.description || 'PALMX TXP 400 Termal Yazıcı Windows Servisi',
  }

  await db.collection(AGENTS_COLLECTION).doc(cleanId).set(agent)
  return { agent, rawToken }
}

/**
 * Bir Print Agent'ın durumunu günceller veya yetkisini iptal eder (Revoke).
 */
export async function updatePrintAgentStatusServer(
  agentId: string,
  status: 'active' | 'revoked'
): Promise<void> {
  const db = getAdminFirestore()
  const docRef = db.collection(AGENTS_COLLECTION).doc(agentId)
  const snap = await docRef.get()
  if (!snap.exists) {
    throw new Error('Agent bulunamadı.')
  }
  await docRef.update({
    status,
    updatedAt: new Date().toISOString(),
  })
}

/**
 * HTTP İsteğindeki X-Print-Agent-Id ve Authorization Bearer başlığını doğrular.
 */
export async function verifyPrintAgentRequest(
  req: Request | NextRequest
): Promise<PrintAgentAuthResult> {
  const headers = req.headers
  const agentId = headers.get('x-print-agent-id') || headers.get('X-Print-Agent-Id')
  const authHeader = headers.get('authorization') || headers.get('Authorization')

  if (!agentId || !authHeader) {
    return {
      isAuthorized: false,
      error: 'Eksik kimlik bilgisi. X-Print-Agent-Id ve Authorization: Bearer <token> başlıkları zorunludur.',
    }
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!match) {
    return {
      isAuthorized: false,
      error: 'Geçersiz Authorization başlık formatı. "Bearer <token>" bekleniyor.',
    }
  }
  const rawToken = match[1].trim()

  try {
    const db = getAdminFirestore()
    const docSnap = await db.collection(AGENTS_COLLECTION).doc(agentId.trim()).get()

    if (!docSnap.exists) {
      return {
        isAuthorized: false,
        error: 'Kayıtlı yazdırma agentı bulunamadı veya yetkisi silinmiş.',
      }
    }

    const agent = docSnap.data() as PrintAgent

    if (agent.status !== 'active') {
      return {
        isAuthorized: false,
        error: 'Bu yazdırma agentının erişim yetkisi iptal edilmiştir (status: revoked).',
      }
    }

    const expectedHash = hashAgentToken(rawToken, agent.salt)
    const isTokenValid = safeCompareHashes(expectedHash, agent.tokenHash)

    if (!isTokenValid) {
      return {
        isAuthorized: false,
        error: 'Geçersiz agent token.',
      }
    }

    // Son görülme zamanını güncelle (fire and forget)
    docSnap.ref.update({ lastSeenAt: new Date().toISOString() }).catch(() => null)

    return {
      isAuthorized: true,
      agent,
    }
  } catch (error: any) {
    console.error('verifyPrintAgentRequest error:', error?.message)
    return {
      isAuthorized: false,
      error: 'Agent yetkilendirmesi sırasında bir sistem hatası oluştu.',
    }
  }
}

/**
 * Varolan bir Print Agent'ın tokenını yeniler (Rotate / Regenerate).
 * Yeni ham token yalnızca bir kez döner ve veritabanına yeni salt ile hashlenerek yazılır.
 */
export async function regenerateAgentTokenServer(agentId: string): Promise<{ agentId: string; rawToken: string }> {
  const db = getAdminFirestore()
  const docRef = db.collection(AGENTS_COLLECTION).doc(agentId)
  const snap = await docRef.get()
  if (!snap.exists) {
    throw new Error('Agent bulunamadı.')
  }

  const salt = crypto.randomBytes(16).toString('hex')
  const rawToken = `pa_${crypto.randomBytes(24).toString('hex')}`
  const tokenHash = hashAgentToken(rawToken, salt)

  await docRef.update({
    tokenHash,
    salt,
    status: 'active',
    updatedAt: new Date().toISOString(),
  })

  return { agentId, rawToken }
}

/**
 * Print Agent kaydını veritabanından tamamen siler.
 */
export async function deletePrintAgentServer(agentId: string): Promise<void> {
  const db = getAdminFirestore()
  await db.collection(AGENTS_COLLECTION).doc(agentId).delete()
}

