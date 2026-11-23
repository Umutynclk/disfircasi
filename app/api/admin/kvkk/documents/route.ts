import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { removeUndefined } from '@/lib/utils/firestoreSanitize'
import {
  KVKK_DOCUMENT_TYPES,
  KVKK_DOCUMENT_META,
  KvkkDocumentType,
  KvkkManagedDocument,
  buildDefaultKvkkDocuments,
  checkCompanyLegalCompleteness,
} from '@/lib/kvkk/types'

const DOCS_COLLECTION = 'kvkk_documents'
const VERSIONS_COLLECTION = 'kvkk_document_versions'

/**
 * GET /api/admin/kvkk/documents (public=true ile müşteri sayfaları yalnızca aktif yayındaki metinleri okur)
 */
export async function GET(req: NextRequest) {
  try {
    const db = getAdminFirestore()
    const isPublic = req.nextUrl.searchParams.get('public') === 'true'

    if (!isPublic) {
      const auth = await verifyAdminRequest(req)
      if (!auth.isAuthorized) {
        return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
      }
    }

    const legalSnap = await db.collection('settings').doc('legal').get()
    const companyInfo = legalSnap.exists ? (legalSnap.data()?.company || {}) : {}
    const completeness = checkCompanyLegalCompleteness(companyInfo)
    const defaults = buildDefaultKvkkDocuments(companyInfo)

    const snap = await db.collection(DOCS_COLLECTION).get()
    const storedMap: Partial<Record<KvkkDocumentType, KvkkManagedDocument>> = {}
    snap.docs.forEach((d) => {
      const data = d.data() as KvkkManagedDocument
      if (KVKK_DOCUMENT_TYPES.includes(d.id as KvkkDocumentType)) {
        storedMap[d.id as KvkkDocumentType] = {
          ...defaults[d.id as KvkkDocumentType],
          ...data,
          docType: d.id as KvkkDocumentType,
        }
      }
    })

    const documents: KvkkManagedDocument[] = KVKK_DOCUMENT_TYPES.map((dt) => {
      const merged = storedMap[dt] || defaults[dt]
      if (isPublic) {
        return {
          ...merged,
          draftTitle: merged.title,
          draftContent: merged.content,
        }
      }
      return merged
    })

    return NextResponse.json({
      success: true,
      documents,
      companyCompleteness: completeness,
      iysIntegrated: false,
    })
  } catch (err: any) {
    console.error('GET /api/admin/kvkk/documents error:', err?.message)
    return NextResponse.json(
      { success: false, error: err?.message || 'KVKK belgeleri yüklenemedi.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/kvkk/documents
 * Action: 'save_draft' | 'publish' | 'unpublish' | 'toggle_active'
 * Yayımlanan her değişiklik yeni bir versiyon oluşturur ve eski versiyonu immutable olarak arşivler.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json({ success: false, error: auth.error || 'Yetkisiz erişim.' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const docType = body.docType as KvkkDocumentType
    const action = body.action as 'save_draft' | 'publish' | 'unpublish' | 'toggle_active'

    if (!docType || !KVKK_DOCUMENT_TYPES.includes(docType)) {
      return NextResponse.json({ success: false, error: 'Geçersiz belge türü.' }, { status: 400 })
    }

    const db = getAdminFirestore()
    const legalSnap = await db.collection('settings').doc('legal').get()
    const companyInfo = legalSnap.exists ? (legalSnap.data()?.company || {}) : {}
    const completeness = checkCompanyLegalCompleteness(companyInfo)
    const defaults = buildDefaultKvkkDocuments(companyInfo)

    const docRef = db.collection(DOCS_COLLECTION).doc(docType)
    const now = new Date().toISOString()

    const resultDoc = await db.runTransaction(async (tx) => {
      const snap = await tx.get(docRef)
      const current: KvkkManagedDocument = snap.exists
        ? { ...defaults[docType], ...(snap.data() as Partial<KvkkManagedDocument>), docType }
        : defaults[docType]

      const nextTitle = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : current.draftTitle || current.title
      const nextContent = typeof body.content === 'string' ? body.content : current.draftContent || current.content

      if (action === 'save_draft') {
        const updated: KvkkManagedDocument = {
          ...current,
          draftTitle: nextTitle,
          draftContent: nextContent,
          status: current.status === 'published' ? 'published' : 'draft',
          updatedAt: now,
          updatedBy: auth.email || 'admin',
        }
        tx.set(docRef, removeUndefined(updated), { merge: true })
        return updated
      }

      if (action === 'publish') {
        if (!completeness.isComplete) {
          throw new Error(
            `Eksik firma bilgileri tamamlanmadan belge yayına alınamaz: ${completeness.missingFields.join(', ')}`
          )
        }
        if (!nextTitle.trim() || !nextContent.trim()) {
          throw new Error('Belge başlığı ve içeriği boş olamaz.')
        }

        const nextVersion = (current.version || 0) + 1
        const updated: KvkkManagedDocument = {
          ...current,
          label: KVKK_DOCUMENT_META[docType].label,
          category: KVKK_DOCUMENT_META[docType].category,
          title: nextTitle,
          content: nextContent,
          draftTitle: nextTitle,
          draftContent: nextContent,
          status: 'published',
          active: true,
          version: nextVersion,
          publishedAt: now,
          updatedAt: now,
          updatedBy: auth.email || 'admin',
        }

        // Eski onay kayıtlarının ispatı için versiyon anlık görüntüsünü immutable sakla
        const versionId = `${docType}_v${nextVersion}`
        const versionRef = db.collection(VERSIONS_COLLECTION).doc(versionId)
        tx.set(versionRef, {
          id: versionId,
          docType,
          version: nextVersion,
          title: nextTitle,
          content: nextContent,
          publishedAt: now,
          publishedBy: auth.email || 'admin',
        })

        tx.set(docRef, removeUndefined(updated), { merge: true })

        // Geriye dönük uyumluluk: settings/legal altındaki karşılıklarını da güncelle
        const legacyFieldMap: Partial<Record<KvkkDocumentType, string>> = {
          kvkk_aydinlatma: 'kvkkPolicy',
          on_bilgilendirme: 'preliminaryInfoForm',
          mesafeli_satis: 'distanceSalesAgreement',
        }
        const legacyField = legacyFieldMap[docType]
        if (legacyField) {
          const legacyRef = db.collection('settings').doc('legal')
          tx.set(
            legacyRef,
            {
              [legacyField]: {
                title: nextTitle,
                content: nextContent,
                updatedAt: new Date(now).toLocaleDateString('tr-TR', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                }),
                version: nextVersion,
              },
            },
            { merge: true }
          )
        }

        return updated
      }

      if (action === 'unpublish') {
        const updated: KvkkManagedDocument = {
          ...current,
          status: 'unpublished',
          active: false,
          updatedAt: now,
          updatedBy: auth.email || 'admin',
        }
        tx.set(docRef, removeUndefined(updated), { merge: true })
        return updated
      }

      if (action === 'toggle_active') {
        const nextActive = typeof body.active === 'boolean' ? body.active : !current.active
        const updated: KvkkManagedDocument = {
          ...current,
          active: nextActive,
          updatedAt: now,
          updatedBy: auth.email || 'admin',
        }
        tx.set(docRef, removeUndefined(updated), { merge: true })
        return updated
      }

      throw new Error('Geçersiz işlem türü.')
    })

    return NextResponse.json({
      success: true,
      document: resultDoc,
    })
  } catch (err: any) {
    console.error('POST /api/admin/kvkk/documents error:', err?.message)
    return NextResponse.json(
      { success: false, error: err?.message || 'Belge güncellenemedi.' },
      { status: 400 }
    )
  }
}
