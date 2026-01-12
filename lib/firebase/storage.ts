import { ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from 'firebase/storage'
import { getFirebaseStorage } from '@/firebase/config'

// Storage helper - client-side'da güvenli storage instance döndürür
const getStorageInstance = (): FirebaseStorage => {
  return getFirebaseStorage();
}

export const uploadImage = async (file: File, path: string): Promise<string> => {
  try {
    const storageInstance = getStorageInstance();
    const storageRef = ref(storageInstance, `images/${path}/${Date.now()}_${file.name}`)
    const snapshot = await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(snapshot.ref)
    return downloadURL
  } catch (error) {
    console.error('Resim yüklenirken hata:', error)
    throw error
  }
}

export const uploadVideo = async (file: File, path: string): Promise<string> => {
  try {
    const storageInstance = getStorageInstance();
    const storageRef = ref(storageInstance, `videos/${path}/${Date.now()}_${file.name}`)
    const snapshot = await uploadBytes(storageRef, file)
    const downloadURL = await getDownloadURL(snapshot.ref)
    return downloadURL
  } catch (error) {
    console.error('Video yüklenirken hata:', error)
    throw error
  }
}

export const deleteFile = async (url: string): Promise<void> => {
  try {
    const storageInstance = getStorageInstance();
    const fileRef = ref(storageInstance, url)
    await deleteObject(fileRef)
  } catch (error) {
    console.error('Dosya silinirken hata:', error)
    throw error
  }
}

