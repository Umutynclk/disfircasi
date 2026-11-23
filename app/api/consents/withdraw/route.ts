import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin'
import { KvkkDocumentType } from '@/lib/kvkk/types'

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
 * GET /api/consents/withdraw — Kullanıcının mevcut açık rıza ve ticari ileti tercihlerini getirir.
 */
export async function GET(req: NextRequest) {
  const user = await verifyAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Oturum doğrulaması gerekli.' }, { status: 401 })
  }

  try {
    const db = getAdminFirestore()
    const userDoc = await db.collection('users').doc(user.uid).get()
    const prefs = userDoc.exists ? (userDoc.data()?.consentPreferences || {}) : {}

    return NextResponse.json({
      success: true,
      preferences: {
        acik_riza: prefs.acik_riza || { granted: false },
        ticari_ileti: prefs.ticari_ileti || { granted: false },
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'İzin tercihleri okunamadı.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/consents/withdraw — Kullanıcının açık rıza veya ticari ileti iznini geri çekmesini sağlar.
 * Eski kayıtları silmez; yeni immutable 'consent_withdrawn' kaydı ekler ve kullanıcı tercihini kapatır.
 */
export async function POST(req: NextRequest) {
  const user = await verifyAuthenticatedUser(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Oturum doğrulaması gerekli.' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const docType = body.docType as KvkkDocumentType
    if (docType !== 'acik_riza' && docType !== 'ticari_ileti') {
      return NextResponse.json(
        { success: false, error: 'Yalnızca açık rıza veya ticari ileti izni geri çekilebilir.' },
        { status: 400 }
      )
    }

    const db = getAdminFirestore()
    const now = new Date().toISOString()
    const recordRef = db.collection(CONSENTS_COLLECTION).doc()

    const batch = db.batch()
    batch.set(recordRef, {
      id: recordRef.id,
      subjectType: 'user',
      userId: user.uid,
      email: user.email || '',
      eventType: 'consent_withdrawn',
      docType,
      docVersion: Number(body.docVersion) || 1,
      stage: 'profile',
      purpose: docType === 'acik_riza' ? 'personalized_marketing' : 'commercial_electronic_message',
      channel: 'web',
      status: 'withdrawn',
      createdAt: now,
      withdrawnAt: now,
    })

    const userRef = db.collection('users').doc(user.uid)
    batch.set(
      userRef,
      {
        consentPreferences: {
          [docType]: {
            granted: false,
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
      docType,
      withdrawnAt: now,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'İzin geri çekilemedi.' },
      { status: 500 }
    )
  }
}
