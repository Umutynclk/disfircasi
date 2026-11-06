import { NextRequest } from 'next/server'
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin'
import { DEFAULT_ADMIN_EMAILS } from '@/lib/firebase/auth'

export interface ServerAuthResult {
  isAuthorized: boolean
  uid?: string
  email?: string
  error?: string
}

/**
 * Route handler'a gelen yetkilendirme başlığını (Bearer ID Token) doğrular.
 * Kullanıcının gerçekten Firebase Admin üzerinde geçerli bir yönetici hesabı olduğunu teyit eder.
 */
export async function verifyAdminRequest(req: NextRequest): Promise<ServerAuthResult> {
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      isAuthorized: false,
      error: 'Yetkilendirme başlığı eksik veya geçersiz (Bearer token gerekli).',
    }
  }

  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return {
      isAuthorized: false,
      error: 'Token boş bırakılamaz.',
    }
  }

  try {
    const adminAuth = getAdminAuth()
    const decoded = await adminAuth.verifyIdToken(token)
    const email = decoded.email?.trim().toLowerCase()

    if (!email) {
      return {
        isAuthorized: false,
        error: 'Token e-posta bilgisi içermiyor.',
      }
    }

    // 1. Varsayılan sistem admin e-posta listesi ve env tanımları
    const envAdminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    const allowedAdmins = [...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()), ...envAdminEmails]

    if (allowedAdmins.some((e) => e === email)) {
      return { isAuthorized: true, uid: decoded.uid, email }
    }

    // 2. Firestore settings/admins beyaz listesi
    const db = getAdminFirestore()
    const adminsDoc = await db.collection('settings').doc('admins').get()
    if (adminsDoc.exists) {
      const allowed: string[] = adminsDoc.data()?.allowedEmails || []
      if (allowed.some((e) => e.trim().toLowerCase() === email)) {
        return { isAuthorized: true, uid: decoded.uid, email }
      }
    }

    // 3. (KALDIRILDI) users/{uid}.role / isAdmin kontrolü: kullanıcı kendi users/{uid} belgesini
    //    yazabildiği için bu alan güvenilir değildir (yetki yükseltme riski).

    // 4. Firestore settings/site contactEmail
    const siteDoc = await db.collection('settings').doc('site').get()
    if (siteDoc.exists) {
      const contactEmail = siteDoc.data()?.contactEmail
      if (contactEmail && contactEmail.trim().toLowerCase() === email) {
        return { isAuthorized: true, uid: decoded.uid, email }
      }
    }

    // Yetkili yönetici listesinde bulunmayan tüm kullanıcılar kesinlikle reddedilir
    return {
      isAuthorized: false,
      error: 'Bu işlem için yetkili yönetici (Admin) hesabı gereklidir.',
    }
  } catch (err: any) {
    console.error('verifyAdminRequest error:', err?.message || err)
    return {
      isAuthorized: false,
      error: 'Oturum kimlik doğrulaması başarısız veya süresi dolmuş.',
    }
  }
}
