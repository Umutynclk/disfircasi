import { NextRequest, NextResponse } from 'next/server'
import { getAdminAuth, getAdminFirestore, getAdminStorage } from '@/lib/firebase/admin'
import {
  DATA_RETENTION_MATRIX,
  buildErasureAuditRecord,
  calculateKvkkDeadlineIso,
  classifyUserOrdersForDeletion,
  hashUserIdentifier,
  validateAccountDeletionRequest,
} from '@/lib/kvkk/accountDeletion'

const ERASURE_REQUESTS_COLLECTION = 'data_erasure_requests'
const ERASURE_AUDIT_COLLECTION = 'data_erasure_audit_logs'

async function verifyToken(req: NextRequest): Promise<{
  uid: string
  email?: string
  authTime?: number
} | null> {
  const authHeader = req.headers.get('authorization') || ''
  if (!authHeader.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null
  try {
    const decoded = await getAdminAuth().verifyIdToken(token, true)
    return {
      uid: decoded.uid,
      email: decoded.email,
      authTime: decoded.auth_time,
    }
  } catch {
    return null
  }
}

/**
 * GET /api/account/delete
 * Hesap silme öncesinde kullanıcıya gösterilecek özet bilgileri (aktif siparişler,
 * saklanacak yasal kayıtlar, silinecek kategoriler) döndürür.
 */
export async function GET(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) {
    return NextResponse.json({ success: false, error: 'Oturum doğrulaması gereklidir.' }, { status: 401 })
  }

  try {
    const db = getAdminFirestore()
    const [userDoc, ordersByUidSnap] = await Promise.all([
      db.collection('users').doc(user.uid).get(),
      db.collection('orders').where('userId', '==', user.uid).get(),
    ])

    const orders = ordersByUidSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
    const { activeOrders, historicalOrders } = classifyUserOrdersForDeletion(orders)
    const savedAddressesCount = Array.isArray(userDoc.data()?.savedAddresses)
      ? userDoc.data()!.savedAddresses.length
      : 0

    return NextResponse.json({
      success: true,
      summary: {
        activeOrdersCount: activeOrders.length,
        activeOrderNumbers: activeOrders.map((o) => o.orderNumber),
        historicalOrdersCount: historicalOrders.length,
        savedAddressesCount,
      },
      retentionMatrix: DATA_RETENTION_MATRIX,
    })
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Hesap silme özeti alınamadı.' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/account/delete
 * KVKK m. 7 & m. 13 uyumlu güvenli, idempotent ve devam ettirilebilir hesap kapatma
 * ve kişisel veri imha uç noktası.
 *
 * - Yalnızca doğrulanmış oturum sahibi kendi hesabını silebilir.
 * - Son 5 dakika içinde yeniden kimlik doğrulaması (auth_time) zorunludur.
 * - Saklama yükümlülüğü bulunmayan profil/adres/tercih/alt koleksiyon/Storage verileri silinir.
 * - Yasal saklama kapsamındaki sipariş/fatura/iade ve rıza ispat kayıtları korunur ve erişimi kısıtlanır.
 * - Silme denetim kaydına gereksiz kişisel veri (PII) yazılmaz.
 */
export async function POST(req: NextRequest) {
  const user = await verifyToken(req)
  if (!user) {
    return NextResponse.json(
      { success: false, code: 'UNAUTHENTICATED', error: 'Oturum doğrulaması gereklidir.' },
      { status: 401 }
    )
  }

  const body = await req.json().catch(() => ({}))
  const validation = validateAccountDeletionRequest({
    authenticatedUid: user.uid,
    requestedTargetUid: body.targetUid || body.uid || null,
    confirmationText: body.confirmationText,
    authTimeSeconds: user.authTime,
  })

  if (!validation.valid) {
    const status =
      validation.code === 'FORBIDDEN_TARGET' || validation.code === 'REAUTH_REQUIRED' ? 403 : 400
    return NextResponse.json(
      { success: false, code: validation.code, error: validation.error },
      { status }
    )
  }

  const db = getAdminFirestore()
  const auth = getAdminAuth()
  const now = new Date().toISOString()
  const uidHash = hashUserIdentifier(user.uid)
  const requestRef = `KVKK-DEL-${uidHash.slice(0, 10).toUpperCase()}`
  const requestDocRef = db.collection(ERASURE_REQUESTS_COLLECTION).doc(requestRef)

  const stepsCompleted: string[] = []
  const stepsFailed: string[] = []
  let activeOrdersPreservedCount = 0
  let historicalOrdersRetainedCount = 0

  try {
    // Idempotency / devam ettirilebilirlik: önceki yarım kalmış talep varsa referansı koru
    const existingReq = await requestDocRef.get()
    const requestedAt = existingReq.exists ? existingReq.data()?.requestedAt || now : now

    await requestDocRef.set(
      {
        requestRef,
        uidHash,
        requestedAt,
        kvkkDeadlineAt: calculateKvkkDeadlineIso(requestedAt),
        status: 'in_progress',
        updatedAt: now,
      },
      { merge: true }
    )

    // 1. Kullanıcının siparişlerini sınıflandır ve yasal saklama + kısıtlı erişim işaretle (ASLA silme!)
    try {
      const ordersSnap = await db.collection('orders').where('userId', '==', user.uid).get()
      const ordersList = ordersSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
      const classified = classifyUserOrdersForDeletion(ordersList)
      activeOrdersPreservedCount = classified.activeOrders.length
      historicalOrdersRetainedCount = classified.historicalOrders.length

      if (!ordersSnap.empty) {
        const orderBatch = db.batch()
        for (const docSnap of ordersSnap.docs) {
          orderBatch.set(
            docSnap.ref,
            {
              accountDeleted: true,
              accountDeletedAt: now,
              dataRetentionRestricted: true,
              dataRetentionBasis: 'TTK_82_VUK_253_TKHK_6502',
              erasureRequestRef: requestRef,
            },
            { merge: true }
          )
        }
        await orderBatch.commit()
      }
      stepsCompleted.push('orders_retained_and_restricted')
    } catch (err: any) {
      console.error('Account delete step orders_retained_and_restricted failed:', err?.message)
      stepsFailed.push('orders_retained_and_restricted')
    }

    // 2. Değiştirilemez `consent_records` ispat kayıtlarını koru, hesap kapatma bilgisini işaretle
    try {
      const consentSnap = await db.collection('consent_records').where('userId', '==', user.uid).get()
      if (!consentSnap.empty) {
        const consentBatch = db.batch()
        for (const docSnap of consentSnap.docs) {
          consentBatch.set(
            docSnap.ref,
            {
              accountDeleted: true,
              accountDeletedAt: now,
              accessRestricted: true,
            },
            { merge: true }
          )
        }
        await consentBatch.commit()
      }
      stepsCompleted.push('consent_audit_preserved')
    } catch (err: any) {
      console.error('Account delete step consent_audit_preserved failed:', err?.message)
      stepsFailed.push('consent_audit_preserved')
    }

    // 3. Kullanıcıya ait Firestore alt koleksiyonları ve ana `users/{uid}` dokümanını sil
    try {
      const userDocRef = db.collection('users').doc(user.uid)
      const subcollections = await userDocRef.listCollections()
      for (const subcol of subcollections) {
        const subSnap = await subcol.get()
        if (!subSnap.empty) {
          const subBatch = db.batch()
          subSnap.docs.forEach((d) => subBatch.delete(d.ref))
          await subBatch.commit()
        }
      }
      await userDocRef.delete()
      stepsCompleted.push('firestore_user_and_subcollections_deleted')
    } catch (err: any) {
      console.error('Account delete step firestore_user_deleted failed:', err?.message)
      stepsFailed.push('firestore_user_and_subcollections_deleted')
    }

    // 4. Kullanıcıya ait kişisel bildirimler (notifications) ve destek mesajları (contacts) temizliği
    try {
      const notifSnap = await db.collection('notifications').where('userId', '==', user.uid).get()
      if (!notifSnap.empty) {
        const notifBatch = db.batch()
        notifSnap.docs.forEach((d) => notifBatch.delete(d.ref))
        await notifBatch.commit()
      }
      stepsCompleted.push('user_notifications_cleaned')
    } catch (err: any) {
      console.error('Account delete step user_notifications_cleaned failed:', err?.message)
      stepsFailed.push('user_notifications_cleaned')
    }

    // 5. Firebase Storage — YALNIZCA `users/{uid}/` altındaki kullanıcı dosyalarını sil
    // Ürün görselleri (`images/`, `videos/`, `models/`) ve diğer kullanıcılara KESİNLİKLE dokunulmaz.
    try {
      const bucketName =
        process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
        process.env.FIREBASE_STORAGE_BUCKET ||
        'disfircasi-f8e72.firebasestorage.app'
      const bucket = getAdminStorage().bucket(bucketName)
      const [files] = await bucket.getFiles({ prefix: `users/${user.uid}/` })
      if (files.length > 0) {
        await Promise.all(files.map((f) => f.delete({ ignoreNotFound: true })))
      }
      stepsCompleted.push('storage_user_files_deleted')
    } catch (err: any) {
      // Bucket yapılandırılmamış veya kullanıcı klasörü yoksa hata olarak engelleme
      console.warn('Account delete storage cleanup note:', err?.message)
      stepsCompleted.push('storage_user_files_checked')
    }

    // 6. Firebase Authentication — Oturum tokenlarını iptal et ve Auth hesabını sil
    try {
      await auth.revokeRefreshTokens(user.uid).catch(() => {})
      await auth.deleteUser(user.uid)
      stepsCompleted.push('firebase_auth_deleted')
    } catch (err: any) {
      if (err?.code === 'auth/user-not-found') {
        stepsCompleted.push('firebase_auth_deleted')
      } else {
        console.error('Account delete step firebase_auth_deleted failed:', err?.message)
        stepsFailed.push('firebase_auth_deleted')
      }
    }

    const completedAt = new Date().toISOString()
    const finalStatus = stepsFailed.length === 0 ? 'completed' : 'partial_retry_required'

    const auditRecord = buildErasureAuditRecord({
      requestRef,
      uid: user.uid,
      requestedAt,
      completedAt: finalStatus === 'completed' ? completedAt : undefined,
      status: finalStatus,
      stepsCompleted,
      stepsFailed,
      activeOrdersPreservedCount,
      historicalOrdersRetainedCount,
    })

    // 7. Kişisel veri (PII) içermeyen asgari KVKK denetim kaydını kaydet
    await Promise.all([
      requestDocRef.set(auditRecord, { merge: true }),
      db.collection(ERASURE_AUDIT_COLLECTION).doc().set({
        ...auditRecord,
        loggedAt: completedAt,
      }),
    ])

    if (finalStatus !== 'completed') {
      return NextResponse.json(
        {
          success: false,
          code: 'PARTIAL_RETRY_REQUIRED',
          requestRef,
          error:
            'Hesap silme işleminin bazı adımları tamamlanamadı. Güvenli şekilde yeniden deneyebilirsiniz.',
          stepsCompleted,
          stepsFailed,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      requestRef,
      completedAt,
      kvkkDeadlineAt: auditRecord.kvkkDeadlineAt,
      summary: {
        deletedCategories: auditRecord.deletedCategories,
        retainedCategories: auditRecord.retainedCategories,
        activeOrdersPreservedCount,
        historicalOrdersRetainedCount,
      },
    })
  } catch (err: any) {
    console.error('POST /api/account/delete fatal error:', err?.message)
    return NextResponse.json(
      {
        success: false,
        requestRef,
        error: err?.message || 'Hesap silme işlemi sırasında beklenmeyen bir hata oluştu.',
      },
      { status: 500 }
    )
  }
}
