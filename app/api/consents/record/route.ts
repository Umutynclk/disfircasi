import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin'
import { removeUndefined } from '@/lib/utils/firestoreSanitize'
import {
  ConsentChannel,
  ConsentEventType,
  ConsentRecord,
  ConsentStage,
  KVKK_DOCUMENT_TYPES,
  KvkkDocumentType,
} from '@/lib/kvkk/types'
import {
  CONSENT_PREFERENCE_META,
  ConsentPreferenceKey,
  resolveConsentPreferenceKey,
} from '@/lib/kvkk/consents'

const CONSENTS_COLLECTION = 'consent_records'

async function tryVerifyTokenUid(req: NextRequest): Promise<{ uid: string; email?: string } | null> {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null
  try {
    const decoded = await getAdminAuth().verifyIdToken(token)
    return { uid: decoded.uid, email: decoded.email }
  } catch {
    return null
  }
}

/**
 * POST /api/consents/record
 * Aydınlatma gösterimi, sözleşme teyidi veya açık rıza / ticari ileti izinlerini
 * sunucu zaman damgasıyla immutable (değiştirilemez) denetim kaydı olarak saklar
 * ve kullanıcının güncel `users/{uid}.consentPreferences` alanını DOĞRU nested yapıda günceller.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const recordsInput = Array.isArray(body.records) ? body.records : [body]

    if (recordsInput.length === 0 || recordsInput.length > 25) {
      return NextResponse.json(
        { success: false, error: 'Geçerli kayıt listesi gereklidir.' },
        { status: 400 }
      )
    }

    const verifiedUser = await tryVerifyTokenUid(req)
    const db = getAdminFirestore()
    const now = new Date().toISOString()
    const savedIds: string[] = []
    const batch = db.batch()

    let userIdToUpdate: string | null = verifiedUser?.uid || null
    const nestedConsentPrefs: Partial<Record<ConsentPreferenceKey, Record<string, any>>> = {}

    for (const item of recordsInput) {
      const docType = item.docType as KvkkDocumentType
      if (!docType || !KVKK_DOCUMENT_TYPES.includes(docType)) {
        continue
      }

      // Güvenlik: token doğrulanmışsa her zaman token'daki UID kullanılır (başkasının UID'si enjekte edilemez)
      const effectiveUid = verifiedUser?.uid || (item.userId ? String(item.userId) : undefined)
      const effectiveEmail =
        verifiedUser?.email?.toLowerCase() ||
        (item.email ? String(item.email).trim().toLowerCase() : undefined)

      const eventType = (item.eventType || 'notice_shown') as ConsentEventType
      const stage = (item.stage || 'checkout') as ConsentStage
      const channel = (item.channel || 'web') as ConsentChannel
      const subjectType = effectiveUid ? 'user' : 'guest'
      const recordRef = db.collection(CONSENTS_COLLECTION).doc()

      const prefKey = resolveConsentPreferenceKey(docType, channel, item.consentKey)

      const record: ConsentRecord & { consentKey?: ConsentPreferenceKey } = removeUndefined({
        id: recordRef.id,
        subjectType,
        userId: effectiveUid,
        guestOrderRef: item.guestOrderRef ? String(item.guestOrderRef) : undefined,
        email: effectiveEmail,
        eventType,
        docType,
        consentKey: prefKey || undefined,
        docVersion: Number(item.docVersion) || 1,
        docTitle: item.docTitle ? String(item.docTitle) : undefined,
        stage,
        purpose: String(item.purpose || (prefKey ? CONSENT_PREFERENCE_META[prefKey].defaultPurpose : docType)),
        channel,
        status:
          eventType === 'notice_shown'
            ? 'shown'
            : eventType === 'contract_confirmed'
            ? 'confirmed'
            : eventType === 'consent_granted'
            ? 'granted'
            : eventType === 'consent_withdrawn'
            ? 'withdrawn'
            : 'denied',
        createdAt: now,
      }) as ConsentRecord & { consentKey?: ConsentPreferenceKey }

      batch.set(recordRef, record)
      savedIds.push(recordRef.id)

      // Sadece gerçek `consent_granted` kayıtları aktif izin tercihini açar (notice_shown/contract_confirmed ASLA açmaz)
      if (effectiveUid && prefKey && eventType === 'consent_granted') {
        userIdToUpdate = effectiveUid
        nestedConsentPrefs[prefKey] = {
          granted: true,
          docType,
          docVersion: record.docVersion,
          channel,
          purpose: record.purpose,
          grantedAt: now,
          updatedAt: now,
          recordId: recordRef.id,
        }
      }
    }

    if (userIdToUpdate && Object.keys(nestedConsentPrefs).length > 0) {
      const userRef = db.collection('users').doc(userIdToUpdate)
      // KRİTİK DÜZELTME: set(..., { merge: true }) ile dot-key DEĞİL, gerçek nested obje yazılır!
      batch.set(
        userRef,
        {
          consentPreferences: nestedConsentPrefs,
          updatedAt: now,
        },
        { merge: true }
      )
    }

    await batch.commit()

    return NextResponse.json({
      success: true,
      count: savedIds.length,
      recordIds: savedIds,
    })
  } catch (err: any) {
    console.error('POST /api/consents/record error:', err?.message)
    return NextResponse.json(
      { success: false, error: err?.message || 'Rıza/bilgilendirme kaydı oluşturulamadı.' },
      { status: 500 }
    )
  }
}
