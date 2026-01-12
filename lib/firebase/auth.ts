import { 
  signInWithEmailAndPassword, 
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

export const loginAdmin = async (email: string, password: string) => {
  try {
    const authInstance = getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(authInstance, email, password)
    return { success: true, user: userCredential.user }
  } catch (error: any) {
    return { success: false, error: error.message }
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

