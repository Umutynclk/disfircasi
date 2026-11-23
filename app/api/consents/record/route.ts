import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { removeUndefined } from '@/lib/utils/firestoreSanitize'
import {
  ConsentChannel,
  ConsentEventType,
  ConsentRecord,
  ConsentStage,
  KVKK_DOCUMENT_TYPES,
  KvkkDocumentType,
} from '@/lib/kvkk/types'

const CONSENTS_COLLECTION = 'consent_records'

/**
 * POST /api/consents/record
 * Aydınlatma gösterimi, sözleşme teyidi veya isteğe bağlı açık rıza / ticari ileti kayıtlarını
 * sunucu zaman damgasıyla immutable (sonradan değiştirilemez) olarak kaydeder.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const recordsInput = Array.isArray(body.records) ? body.records : [body]

    if (recordsInput.length === 0 || recordsInput.length > 20) {
      return NextResponse.json(
        { success: false, error: 'Geçerli kayıt listesi gereklidir.' },
        { status: 400 }
      )
    }

    const db = getAdminFirestore()
    const now = new Date().toISOString()
    const savedIds: string[] = []
    const batch = db.batch()

    let userIdToUpdate: string | null = null
    const userConsentUpdates: Record<string, any> = {}

    for (const item of recordsInput) {
      const docType = item.docType as KvkkDocumentType
      if (!docType || !KVKK_DOCUMENT_TYPES.includes(docType)) {
        continue
      }

      const eventType = (item.eventType || 'notice_shown') as ConsentEventType
      const stage = (item.stage || 'checkout') as ConsentStage
      const channel = (item.channel || 'web') as ConsentChannel
      const subjectType = item.userId ? 'user' : 'guest'
      const recordRef = db.collection(CONSENTS_COLLECTION).doc()

      const record: ConsentRecord = removeUndefined({
        id: recordRef.id,
        subjectType,
        userId: item.userId ? String(item.userId) : undefined,
        guestOrderRef: item.guestOrderRef ? String(item.guestOrderRef) : undefined,
        email: item.email ? String(item.email).trim().toLowerCase() : undefined,
        eventType,
        docType,
        docVersion: Number(item.docVersion) || 1,
        docTitle: item.docTitle ? String(item.docTitle) : undefined,
        stage,
        purpose: String(item.purpose || docType),
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
      }) as ConsentRecord

      batch.set(recordRef, record)
      savedIds.push(recordRef.id)

      if (item.userId && (docType === 'acik_riza' || docType === 'ticari_ileti')) {
        userIdToUpdate = String(item.userId)
        if (eventType === 'consent_granted') {
          userConsentUpdates[`consentPreferences.${docType}`] = {
            granted: true,
            docVersion: record.docVersion,
            channel,
            purpose: record.purpose,
            updatedAt: now,
            recordId: recordRef.id,
          }
        }
      }
    }

    if (userIdToUpdate && Object.keys(userConsentUpdates).length > 0) {
      const userRef = db.collection('users').doc(userIdToUpdate)
      batch.set(userRef, { ...userConsentUpdates, updatedAt: now }, { merge: true })
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
