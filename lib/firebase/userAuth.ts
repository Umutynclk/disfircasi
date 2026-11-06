import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  User,
  Auth
} from 'firebase/auth'
import { getFirebaseAuth, getFirestoreDB } from '@/firebase/config'
import { doc, setDoc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore'

// Auth helper - client-side'da güvenli auth instance döndürür
const getAuthInstance = (): Auth => {
  return getFirebaseAuth();
}

const mapUserAuthError = (errorCode: string): string => {
  if (errorCode.includes('user-not-found') || errorCode.includes('invalid-credential') || errorCode.includes('wrong-password')) {
    return 'E-posta veya şifre hatalı. Lütfen kontrol edin.'
  }
  if (errorCode.includes('email-already-in-use')) {
    return 'Bu e-posta adresi ile kayıtlı bir hesap zaten var.'
  }
  if (errorCode.includes('weak-password')) {
    return 'Şifre çok zayıf. Lütfen en az 6 karakterli bir şifre belirleyin.'
  }
  if (errorCode.includes('invalid-email')) {
    return 'Lütfen geçerli bir e-posta adresi girin.'
  }
  if (errorCode.includes('too-many-requests')) {
    return 'Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.'
  }
  return 'İşlem başarısız: ' + errorCode
}

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

// Kullanıcı kayıt
export const registerUser = async (
  email: string,
  password: string,
  firstName: string,
  lastName: string = ''
) => {
  try {
    const authInstance = getAuthInstance();
    const userCredential = await createUserWithEmailAndPassword(authInstance, email.trim(), password)
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim()

    // Auth profile display name güncelle
    try {
      await updateProfile(userCredential.user, {
        displayName: fullName,
      })
    } catch (profileErr) {
      console.warn('Profile displayName update warning:', profileErr)
    }
    
    // Firestore'da users/{uid} dokümanı oluştur
    const db = getFirestoreDB()
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      uid: userCredential.user.uid,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      name: fullName,
      email: email.trim(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      role: 'user',
    }, { merge: true })
    
    return { success: true, user: userCredential.user }
  } catch (error: any) {
    return { success: false, error: mapUserAuthError(error.code || error.message) }
  }
}

// Kullanıcı giriş
export const loginUser = async (email: string, password: string) => {
  try {
    const authInstance = getAuthInstance();
    const userCredential = await signInWithEmailAndPassword(authInstance, email.trim(), password)
    return { success: true, user: userCredential.user }
  } catch (error: any) {
    return { success: false, error: mapUserAuthError(error.code || error.message) }
  }
}

// Kullanıcı şifre sıfırlama (Şifremi Unuttum)
export const sendUserPasswordReset = async (
  email: string
): Promise<{ success: boolean; message: string; error?: string }> => {
  const trimmed = (email || '').trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!trimmed || !emailRegex.test(trimmed)) {
    return {
      success: false,
      message: '',
      error: 'Lütfen geçerli bir e-posta adresi giriniz.',
    }
  }

  try {
    const authInstance = getAuthInstance()
    await sendPasswordResetEmail(authInstance, trimmed)
  } catch (error: any) {
    const code = error?.code || error?.message || ''
    if (code.includes('too-many-requests')) {
      return {
        success: false,
        message: '',
        error: 'Çok fazla sıfırlama talebi yapıldı. Lütfen birkaç dakika sonra tekrar deneyiniz.',
      }
    }
    // Güvenlik kuralı: Hesap var/yok bilgisini dışarı sızdırmıyoruz.
    // user-not-found gelse bile saldırgana kullanıcı listesi sızdırılamaz.
    console.warn('Password reset notification (privacy-masked):', code)
  }

  return {
    success: true,
    message: 'Eğer bu e-posta adresiyle kayıtlı bir hesap varsa, şifre sıfırlama bağlantısı gönderildi. Lütfen gelen kutunuzu (ve spam klasörünü) kontrol ediniz.',
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

// Kullanıcı profil bilgilerini Firestore'dan al
export const getUserData = async (userId: string) => {
  try {
    const db = getFirestoreDB()
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (userDoc.exists()) {
      return { success: true, data: userDoc.data() }
    }
    return { success: false, error: 'Kullanıcı bulunamadı' }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// Kullanıcının kendi siparişlerini getir
export const getUserOrders = async (userId: string, userEmail?: string) => {
  try {
    const db = getFirestoreDB()
    const ordersRef = collection(db, 'orders')
    
    // 1. Query by userId
    const q1 = query(ordersRef, where('userId', '==', userId))
    const snap1 = await getDocs(q1)
    
    let ordersList = snap1.docs.map((d) => ({ id: d.id, ...d.data() }))

    // 2. If email provided, also match orders with customer.email
    if (userEmail) {
      const q2 = query(ordersRef, where('customer.email', '==', userEmail))
      const snap2 = await getDocs(q2)
      const emailOrders = snap2.docs.map((d) => ({ id: d.id, ...d.data() }))
      
      // Merge uniquely
      const existingIds = new Set(ordersList.map((o: any) => o.id))
      for (const ord of emailOrders) {
        if (!existingIds.has((ord as any).id)) {
          ordersList.push(ord)
        }
      }
    }

    // Sort by createdAt descending
    ordersList.sort((a: any, b: any) => {
      const tA = new Date(a.createdAt || 0).getTime()
      const tB = new Date(b.createdAt || 0).getTime()
      return tB - tA
    })

    return { success: true, orders: ordersList }
  } catch (error: any) {
    console.error('Error fetching user orders:', error)
    return { success: false, orders: [], error: error.message }
  }
}

export interface UserAddress {
  id: string
  title: string
  type?: 'delivery' | 'billing' | 'both'
  fullName: string
  phone: string
  city: string
  district: string
  neighborhood?: string
  address: string
  postalCode?: string
  country?: string
  isDefaultDelivery?: boolean
  isDefaultBilling?: boolean
  isCorporate?: boolean
  tcKimlikNo?: string
  companyName?: string
  taxOffice?: string
  taxNumber?: string
  authorizedPerson?: {
    firstName?: string
    lastName?: string
  } | null
  billingAddress?: {
    address: string
    city: string
    district: string
  }
  createdAt: string
  updatedAt: string
}

// Kullanıcının kayıtlı adreslerini getirir
export const getUserSavedAddresses = async (userId: string): Promise<{ success: boolean; addresses: UserAddress[]; error?: string }> => {
  try {
    const db = getFirestoreDB()
    const userDoc = await getDoc(doc(db, 'users', userId))
    if (!userDoc.exists()) {
      return { success: true, addresses: [] }
    }
    const data = userDoc.data() || {}
    const addresses: UserAddress[] = Array.isArray(data.savedAddresses) ? data.savedAddresses : []
    return { success: true, addresses }
  } catch (error: any) {
    console.error('Error fetching user addresses:', error)
    return { success: false, addresses: [], error: error.message }
  }
}

// Kullanıcı adresini ekler veya günceller
export const saveUserAddress = async (
  userId: string,
  addressData: Omit<Partial<UserAddress>, 'id' | 'createdAt' | 'updatedAt'>,
  addressId?: string
): Promise<{ success: boolean; address?: UserAddress; error?: string }> => {
  try {
    const db = getFirestoreDB()
    const userRef = doc(db, 'users', userId)
    const userDoc = await getDoc(userRef)
    const now = new Date().toISOString()
    
    let currentAddresses: UserAddress[] = []
    if (userDoc.exists()) {
      const data = userDoc.data() || {}
      if (Array.isArray(data.savedAddresses)) {
        currentAddresses = [...data.savedAddresses]
      }
    }

    const targetId = addressId || `addr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
    const isFirstAddress = currentAddresses.length === 0

    const willBeDefaultDelivery = addressData.isDefaultDelivery ?? isFirstAddress
    const willBeDefaultBilling = addressData.isDefaultBilling ?? isFirstAddress

    if (willBeDefaultDelivery) {
      currentAddresses = currentAddresses.map((a) => ({
        ...a,
        isDefaultDelivery: false,
      }))
    }
    if (willBeDefaultBilling) {
      currentAddresses = currentAddresses.map((a) => ({
        ...a,
        isDefaultBilling: false,
      }))
    }

    const existingIndex = currentAddresses.findIndex((a) => a.id === targetId)
    let savedAddress: UserAddress

    if (existingIndex >= 0) {
      savedAddress = {
        ...currentAddresses[existingIndex],
        ...addressData,
        id: targetId,
        isDefaultDelivery: willBeDefaultDelivery,
        isDefaultBilling: willBeDefaultBilling,
        updatedAt: now,
      }
      currentAddresses[existingIndex] = savedAddress
    } else {
      savedAddress = {
        id: targetId,
        title: addressData.title?.trim() || 'Ev Adresim',
        type: addressData.type || 'both',
        fullName: addressData.fullName?.trim() || '',
        phone: addressData.phone?.trim() || '',
        city: addressData.city?.trim() || '',
        district: addressData.district?.trim() || '',
        neighborhood: addressData.neighborhood?.trim() || '',
        address: addressData.address?.trim() || '',
        postalCode: addressData.postalCode?.trim() || '',
        isDefaultDelivery: willBeDefaultDelivery,
        isDefaultBilling: willBeDefaultBilling,
        isCorporate: Boolean(addressData.isCorporate),
        tcKimlikNo: addressData.tcKimlikNo?.trim() || '',
        companyName: addressData.companyName?.trim() || '',
        taxOffice: addressData.taxOffice?.trim() || '',
        taxNumber: addressData.taxNumber?.trim() || '',
        authorizedPerson: addressData.authorizedPerson || undefined,
        billingAddress: addressData.billingAddress || undefined,
        createdAt: now,
        updatedAt: now,
      }
      currentAddresses.push(savedAddress)
    }

    const defaultAddr = currentAddresses.find((a) => a.isDefaultDelivery) || currentAddresses[0]

    await setDoc(
      userRef,
      {
        savedAddresses: currentAddresses,
        ...(defaultAddr
          ? {
              address: defaultAddr.address,
              city: defaultAddr.city,
              district: defaultAddr.district,
              phone: defaultAddr.phone || addressData.phone || '',
            }
          : {}),
        updatedAt: now,
      },
      { merge: true }
    )

    return { success: true, address: savedAddress }
  } catch (error: any) {
    console.error('Error saving user address:', error)
    return { success: false, error: error.message }
  }
}

// Kullanıcı adresini siler
export const deleteUserAddress = async (
  userId: string,
  addressId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const db = getFirestoreDB()
    const userRef = doc(db, 'users', userId)
    const userDoc = await getDoc(userRef)
    if (!userDoc.exists()) {
      return { success: false, error: 'Kullanıcı bulunamadı.' }
    }
    const data = userDoc.data() || {}
    let addresses: UserAddress[] = Array.isArray(data.savedAddresses) ? data.savedAddresses : []
    const deletedAddress = addresses.find((a) => a.id === addressId)
    addresses = addresses.filter((a) => a.id !== addressId)

    if (deletedAddress?.isDefaultDelivery && addresses.length > 0) {
      addresses[0].isDefaultDelivery = true
    }
    if (deletedAddress?.isDefaultBilling && addresses.length > 0) {
      addresses[0].isDefaultBilling = true
    }

    const defaultAddr = addresses.find((a) => a.isDefaultDelivery) || addresses[0]

    await setDoc(
      userRef,
      {
        savedAddresses: addresses,
        address: defaultAddr?.address || '',
        city: defaultAddr?.city || '',
        district: defaultAddr?.district || '',
        phone: defaultAddr?.phone || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )

    return { success: true }
  } catch (error: any) {
    console.error('Error deleting user address:', error)
    return { success: false, error: error.message }
  }
}

// Belirli bir adresi varsayılan teslimat veya fatura adresi yapar
export const setDefaultUserAddress = async (
  userId: string,
  addressId: string,
  type: 'delivery' | 'billing'
): Promise<{ success: boolean; error?: string }> => {
  try {
    const db = getFirestoreDB()
    const userRef = doc(db, 'users', userId)
    const userDoc = await getDoc(userRef)
    if (!userDoc.exists()) {
      return { success: false, error: 'Kullanıcı bulunamadı.' }
    }
    const data = userDoc.data() || {}
    let addresses: UserAddress[] = Array.isArray(data.savedAddresses) ? data.savedAddresses : []

    addresses = addresses.map((a) => {
      if (type === 'delivery') {
        return { ...a, isDefaultDelivery: a.id === addressId }
      } else {
        return { ...a, isDefaultBilling: a.id === addressId }
      }
    })

    const defaultAddr = addresses.find((a) => a.isDefaultDelivery) || addresses[0]

    await setDoc(
      userRef,
      {
        savedAddresses: addresses,
        address: defaultAddr?.address || '',
        city: defaultAddr?.city || '',
        district: defaultAddr?.district || '',
        phone: defaultAddr?.phone || '',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )

    return { success: true }
  } catch (error: any) {
    console.error('Error setting default address:', error)
    return { success: false, error: error.message }
  }
}

// Kullanıcı profil bilgilerini günceller
export const updateUserProfileData = async (
  userId: string,
  profileData: {
    firstName?: string
    lastName?: string
    name?: string
    phone?: string
    email?: string
  }
): Promise<{ success: boolean; error?: string }> => {
  try {
    const db = getFirestoreDB()
    const userRef = doc(db, 'users', userId)
    await setDoc(
      userRef,
      {
        ...profileData,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    )
    return { success: true }
  } catch (error: any) {
    console.error('Error updating user profile data:', error)
    return { success: false, error: error.message }
  }
}



