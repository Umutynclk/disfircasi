import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { getFirebaseAuth, getFirestoreDB } from '@/firebase/config'

// Auth helper - client-side'da güvenli auth instance döndürür
const getAuthInstance = (): Auth => {
  return getFirebaseAuth();
}

// Default system admin emails (can also be expanded in Firestore settings/admins)
export const DEFAULT_ADMIN_EMAILS = [
  'info@gulumse.com',
  'admin@gulumse.com',
  'destek@gulumse.com',
  'admin@gmail.com',
]

const mapAuthError = (errorCode: string): string => {
  if (errorCode.includes('user-not-found') || errorCode.includes('invalid-credential')) {
    return 'E-posta veya şifre hatalı. Lütfen kontrol edin.'
  }
  if (errorCode.includes('wrong-password')) {
    return 'Girdiğiniz şifre hatalı.'
  }
  if (errorCode.includes('email-already-in-use')) {
    return 'Bu e-posta adresi ile zaten bir hesap var.'
  }
  if (errorCode.includes('weak-password')) {
    return 'Şifre çok zayıf. En az 6 karakter olmalıdır.'
  }
  if (errorCode.includes('invalid-email')) {
    return 'Geçersiz bir e-posta adresi girdiniz.'
  }
  if (errorCode.includes('too-many-requests')) {
    return 'Çok fazla başarısız deneme yapıldı. Lütfen biraz sonra tekrar deneyin.'
  }
  return 'Giriş yapılamadı: ' + errorCode
}

/**
 * Checks if the user is authorized to access the Admin Panel
 */
export const isUserAdmin = async (user: User | null): Promise<boolean> => {
  if (!user || !user.email) return false

  const userEmail = user.email.trim().toLowerCase()

  // 1. Varsayılan yetkili sistem admin listesi (admin@gmail.com dahil)
  if (DEFAULT_ADMIN_EMAILS.some((e) => e.toLowerCase() === userEmail)) {
    return true
  }

  try {
    const db = getFirestoreDB()

    // 2. Firestore settings/admins izin listesi
    const adminsDoc = await getDoc(doc(db, 'settings', 'admins'))
    if (adminsDoc.exists()) {
      const data = adminsDoc.data()
      const allowed: string[] = data?.allowedEmails || []
      if (allowed.some((e) => e.trim().toLowerCase() === userEmail)) {
        return true
      }
    }

    // 3. Firestore settings/site iletişim e-postası
    const siteDoc = await getDoc(doc(db, 'settings', 'site'))
    if (siteDoc.exists()) {
      const sData = siteDoc.data()
      if (sData?.contactEmail && sData.contactEmail.trim().toLowerCase() === userEmail) {
        return true
      }
    }
  } catch (err) {
    console.warn('Admin check warning:', err)
  }

  // Güvenlik: İzin listesinde bulunmayan hiçbir kullanıcı admin olarak kabul edilmez.
  // Kesinlikle varsayılan olarak false döndürülür.
  return false
}

export const loginAdmin = async (email: string, password: string) => {
  try {
    const authInstance = getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(authInstance, email.trim(), password)
    
    // Validate admin privilege strictly against backend allowlist
    const isAdmin = await isUserAdmin(userCredential.user)
    if (!isAdmin) {
      await signOut(authInstance)
      return {
        success: false,
        error: 'Bu e-posta adresi ile admin paneline giriş izni bulunmamaktadır. Yalnızca yetkili yönetici hesapları giriş yapabilir.'
      }
    }

    return { success: true, user: userCredential.user }
  } catch (error: any) {
    return { success: false, error: mapAuthError(error.code || error.message) }
  }
}

export const registerAdmin = async (_email: string, _password: string) => {
  // Güvenlik: İstemci üzerinden admin kaydı oluşturulması kesinlikle yasaklanmıştır.
  return {
    success: false,
    error: 'Yeni yönetici hesabı oluşturma yetkisi yalnızca sistem yöneticisine aittir. Lütfen mevcut yetkili hesabınızla giriş yapınız.',
  }
}

export const logoutAdmin = async () => {
  try {
    const authInstance = getAuthInstance();
    await signOut(authInstance)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve) => {
    try {
      const authInstance = getAuthInstance();
      const unsubscribe = onAuthStateChanged(authInstance, (user) => {
        unsubscribe()
        resolve(user)
      })
    } catch (error) {
      resolve(null)
    }
  })
}
