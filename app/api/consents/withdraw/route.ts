import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin'
import {
  CONSENT_PREFERENCE_KEYS,
  CONSENT_PREFERENCE_META,
  ConsentPreferenceKey,
  resolveConsentPreferenceKey,
  resolveUserConsentPreferences,
} from '@/lib/kvkk/consents'

const CONSENTS_COLLECTION = 'consent_records'

async function verifyAuthenticatedUser(req: NextRequest): Promise<{ uid: string; email?: string } | null> {
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
 * GET /api/consents/withdraw
 * Kullanıcının gerçek güncel KVKK açık rıza ve kanal bazlı (SMS, E-posta, Telefon) ticari ileti
 * izin durumunu `users/{uid}` + `consent_records` denetim geçmişiyle uzlaştırarak döndürür.
 */
export async function GET(req: NextRequest) {
  const user = await verifyAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Oturum doğrulaması gerekli.' }, { status: 401 })
  }

  try {
    const db = getAdminFirestore()
    const [userDoc, recordsSnap] = await Promise.all([
      db.collection('users').doc(user.uid).get(),
      db.collection(CONSENTS_COLLECTION).where('userId', '==', user.uid).get(),
    ])

    const userData = userDoc.exists ? (userDoc.data() as Record<string, any>) : null
    const auditRecords = recordsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))

    const preferences = resolveUserConsentPreferences(userData, auditRecords)

    return NextResponse.json({
      success: true,
      preferences,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'İzin tercihleri okunamadı.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/consents/withdraw
 * Belirtilen tek bir izni (acik_riza, ticari_ileti_sms, ticari_ileti_email veya ticari_ileti_phone)
 * diğer izinleri etkilemeden geri çeker; immutable 'consent_withdrawn' denetim kaydı oluşturur.
 */
export async function POST(req: NextRequest) {
  const user = await verifyAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Oturum doğrulaması gerekli.' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const consentKey = resolveConsentPreferenceKey(
      body.docType || '',
      body.channel,
      body.consentKey
    )

    if (!consentKey || !CONSENT_PREFERENCE_KEYS.includes(consentKey)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Geçerli bir izin türü belirtilmelidir (Açık Rıza, E-posta, SMS veya Telefon).',
        },
        { status: 400 }
      )
    }

    const meta = CONSENT_PREFERENCE_META[consentKey]
    const db = getAdminFirestore()
    const now = new Date().toISOString()
    const recordRef = db.collection(CONSENTS_COLLECTION).doc()

    const batch = db.batch()
    batch.set(recordRef, {
      id: recordRef.id,
      subjectType: 'user',
      userId: user.uid,
      email: (user.email || '').toLowerCase(),
      eventType: 'consent_withdrawn',
      docType: meta.docType,
      consentKey,
      docVersion: Number(body.docVersion) || 1,
      stage: 'profile',
      purpose: meta.defaultPurpose,
      channel: meta.channel,
      status: 'withdrawn',
      createdAt: now,
      withdrawnAt: now,
    })

    const userRef = db.collection('users').doc(user.uid)
    // Yalnızca ilgili anahtar güncellenir; diğer kanallar kesinlikle etkilenmez
    batch.set(
      userRef,
      {
        consentPreferences: {
          [consentKey]: {
            granted: false,
            docType: meta.docType,
            channel: meta.channel,
            purpose: meta.defaultPurpose,
            docVersion: Number(body.docVersion) || 1,
            withdrawnAt: now,
            updatedAt: now,
            recordId: recordRef.id,
          },
        },
        updatedAt: now,
      },
      { merge: true }
    )

    await batch.commit()

    return NextResponse.json({
      success: true,
      recordId: recordRef.id,
      consentKey: consentKey as ConsentPreferenceKey,
      docType: meta.docType,
      channel: meta.channel,
      withdrawnAt: now,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'İzin geri çekilemedi.' },
      { status: 500 }
    )
  }
}
