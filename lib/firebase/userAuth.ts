import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  Auth
} from 'firebase/auth'
import { getFirebaseAuth, getFirestoreDB } from '@/firebase/config'
import { doc, setDoc, getDoc } from 'firebase/firestore'

// Auth state listener - kullanıcı durum değişikliklerini dinler
export const onUserAuthStateChanged = (callback: (user: User | null) => void) => {
  try {
    const authInstance = getAuthInstance();
    return onAuthStateChanged(authInstance, callback)
  } catch (error) {
    callback(null)
    return () => {}
  }
}

// Auth helper - client-side'da güvenli auth instance döndürür
const getAuthInstance = (): Auth => {
  return getFirebaseAuth();
}

// Kullanıcı kayıt
export const registerUser = async (email: string, password: string, name: string) => {
  try {
    const authInstance = getAuthInstance();
    const userCredential = await createUserWithEmailAndPassword(authInstance, email, password)
    
    // Firestore'da kullanıcı bilgilerini kaydet
    const db = getFirestoreDB()
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      email: email,
      name: name,
      createdAt: new Date(),
      role: 'user' // Normal kullanıcı
    })
    
    return { success: true, user: userCredential.user }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Kullanıcı giriş
export const loginUser = async (email: string, password: string) => {
  try {
    const authInstance = getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(authInstance, email, password)
    return { success: true, user: userCredential.user }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Kullanıcı çıkış
export const logoutUser = async () => {
  try {
    const authInstance = getAuthInstance();
    await signOut(authInstance)
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Mevcut kullanıcıyı al
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

// Kullanıcı bilgilerini Firestore'dan al
export const getUserData = async (userId: string) => {
  try {
    const db = getFirestoreDB()
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() }
    }
    return { success: false, error: 'User not found' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

