import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth'
import { getFirebaseAuth } from '@/firebase/config'

// Auth helper - client-side'da güvenli auth instance döndürür
const getAuthInstance = (): Auth => {
  return getFirebaseAuth();
}

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

export const loginAdmin = async (email: string, password: string) => {
  try {
    const authInstance = getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(authInstance, email.trim(), password)
    return { success: true, user: userCredential.user }
  } catch (error: any) {
    return { success: false, error: mapAuthError(error.code || error.message) }
  }
}

export const registerAdmin = async (email: string, password: string) => {
  try {
    const authInstance = getAuthInstance();
    const userCredential = await createUserWithEmailAndPassword(authInstance, email.trim(), password)
    return { success: true, user: userCredential.user }
  } catch (error: any) {
    return { success: false, error: mapAuthError(error.code || error.message) }
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

