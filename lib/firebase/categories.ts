// Firebase Category Management Utilities
import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  order: number
  active: boolean
  createdAt?: string
  updatedAt?: string
}

const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Otomatik Diş Fırçası', slug: 'otomatik', description: '360° Sonic teknoloji', order: 1, active: true },
  { name: 'Kullan At Diş Fırçası', slug: 'kullan-at', description: 'Hijyenik ve pratik', order: 2, active: true },
  { name: 'Yedek Fırça Başlıkları', slug: 'yedek-firca-basliklari', description: 'Uyumlu yedek başlıklar', order: 3, active: true },
]

export const subscribeToCategories = (callback: (cats: Category[]) => void): Unsubscribe => {
  const db = getFirestoreDB()
  const q = query(collection(db, 'categories'), orderBy('order', 'asc'))
  return onSnapshot(q, (snap) => {
    const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category))
    callback(cats.length > 0 ? cats : DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: String(i) })))
  })
}

export const getCategories = async (): Promise<Category[]> => {
  const db = getFirestoreDB()
  const q = query(collection(db, 'categories'), orderBy('order', 'asc'))
  const snap = await getDocs(q)
  const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category))
  return cats.length > 0 ? cats : DEFAULT_CATEGORIES.map((c, i) => ({ ...c, id: String(i) }))
}

export const createCategory = async (data: Omit<Category, 'id'>): Promise<string> => {
  const db = getFirestoreDB()
  const ref = await addDoc(collection(db, 'categories'), {
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  return ref.id
}

export const updateCategory = async (id: string, data: Partial<Category>): Promise<void> => {
  const db = getFirestoreDB()
  await updateDoc(doc(db, 'categories', id), {
    ...data,
    updatedAt: new Date().toISOString(),
  })
}

export const deleteCategory = async (id: string): Promise<void> => {
  const db = getFirestoreDB()
  await deleteDoc(doc(db, 'categories', id))
}
