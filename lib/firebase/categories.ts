import {
  collection,
  doc,
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { removeUndefined } from '@/lib/utils/firestoreSanitize'

export interface CategoryFeaturedConfig {
  badge?: string
  subtitle?: string
  title?: string
  description?: string
  ctaLabel?: string
  image?: string
}

export interface Category {
  id: string
  name: string
  slug: string
  description?: string
  image?: string
  order: number
  active: boolean
  parentId?: string | null
  isFeatured?: boolean
  featuredOrder?: number
  featured?: CategoryFeaturedConfig
  createdAt?: string
  updatedAt?: string
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Otomatik Diş Fırçası', slug: 'otomatik', description: '360° Sonic teknoloji', order: 1, active: true },
  { name: 'Kullan At Diş Fırçası', slug: 'kullan-at', description: 'Hijyenik ve pratik', order: 2, active: true },
  { name: 'Yedek Fırça Başlıkları', slug: 'yedek-firca-basliklari', description: 'Uyumlu yedek başlıklar', order: 3, active: true },
]

/**
 * Bir kategorinin ürün listeleme URL'sini mevcut query parametresi (?kategori=...) ile güvenli şekilde üretir.
 */
export function buildCategoryUrl(
  category: Pick<Category, 'id' | 'slug'>,
  productsBasePath = '/urunler'
): string {
  const key = (category.slug || category.id || '').trim()
  if (!key) return productsBasePath
  const separator = productsBasePath.includes('?') ? '&' : '?'
  return `${productsBasePath}${separator}kategori=${encodeURIComponent(key)}`
}

/**
 * Aktif kategorileri (active !== false) `order` alanına göre artan sırada döndürür.
 */
export function getActiveCategories(categories: Category[]): Category[] {
  return categories
    .filter((cat) => cat && cat.active !== false)
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999))
}

/**
 * Ana sayfa vitrininde gösterilecek aktif kategorileri tekilleştirip `featuredOrder` (sonra `order`)
 * sırasına göre döndürür.
 */
export function getFeaturedShowcaseCategories(categories: Category[]): Category[] {
  const seenIds = new Set<string>()
  const seenSlugs = new Set<string>()

  const filtered = categories.filter((cat) => {
    if (!cat || cat.active === false || cat.isFeatured !== true) return false
    const idKey = (cat.id || '').trim()
    const slugKey = (cat.slug || '').trim().toLowerCase()
    if (idKey && seenIds.has(idKey)) return false
    if (slugKey && seenSlugs.has(slugKey)) return false
    if (idKey) seenIds.add(idKey)
    if (slugKey) seenSlugs.add(slugKey)
    return true
  })

  return filtered.sort((a, b) => {
    const orderA = typeof a.featuredOrder === 'number' && !Number.isNaN(a.featuredOrder) ? a.featuredOrder : (a.order ?? 999)
    const orderB = typeof b.featuredOrder === 'number' && !Number.isNaN(b.featuredOrder) ? b.featuredOrder : (b.order ?? 999)
    if (orderA !== orderB) return orderA - orderB
    return (a.order ?? 999) - (b.order ?? 999)
  })
}

export function validateFeaturedCategoryInput(cat: Partial<Category>): { valid: boolean; error?: string } {
  if (!cat.name || !cat.name.trim()) {
    return { valid: false, error: 'Kategori adı zorunludur.' }
  }
  if (!cat.slug || !cat.slug.trim()) {
    return { valid: false, error: 'URL slug alanı zorunludur.' }
  }
  if (cat.isFeatured) {
    const title = (cat.featured?.title || '').trim()
    const ctaLabel = (cat.featured?.ctaLabel || '').trim()
    if (!title) {
      return { valid: false, error: 'Ana Sayfa Vitrininde Göster seçiliyken "Büyük Başlık" alanı zorunludur.' }
    }
    if (!ctaLabel) {
      return { valid: false, error: 'Ana Sayfa Vitrininde Göster seçiliyken "CTA Buton Yazısı" alanı zorunludur.' }
    }
  }
  return { valid: true }
}

function sanitizeCategoryPayload(data: Partial<Category>): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...data }

  if (typeof payload.name === 'string') payload.name = payload.name.trim()
  if (typeof payload.slug === 'string') payload.slug = payload.slug.trim()
  if (typeof payload.description === 'string') payload.description = payload.description.trim()
  if (typeof payload.image === 'string') payload.image = payload.image.trim()

  if (data.featured && typeof data.featured === 'object') {
    const cleanFeatured: CategoryFeaturedConfig = {}
    if (typeof data.featured.badge === 'string' && data.featured.badge.trim()) {
      cleanFeatured.badge = data.featured.badge.trim()
    }
    if (typeof data.featured.subtitle === 'string' && data.featured.subtitle.trim()) {
      cleanFeatured.subtitle = data.featured.subtitle.trim()
    }
    if (typeof data.featured.title === 'string' && data.featured.title.trim()) {
      cleanFeatured.title = data.featured.title.trim()
    }
    if (typeof data.featured.description === 'string' && data.featured.description.trim()) {
      cleanFeatured.description = data.featured.description.trim()
    }
    if (typeof data.featured.ctaLabel === 'string' && data.featured.ctaLabel.trim()) {
      cleanFeatured.ctaLabel = data.featured.ctaLabel.trim()
    }
    if (typeof data.featured.image === 'string' && data.featured.image.trim()) {
      cleanFeatured.image = data.featured.image.trim()
    }
    payload.featured = cleanFeatured
  }

  return removeUndefined(payload)
}

export const subscribeToCategories = (callback: (cats: Category[]) => void): Unsubscribe => {
  const db = getFirestoreDB()
  const q = query(collection(db, 'categories'), orderBy('order', 'asc'))
  return onSnapshot(
    q,
    (snap) => {
      const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category))
      callback(cats)
    },
    (err) => {
      console.error('Categories subscription error:', err)
      callback([])
    }
  )
}

export const getCategories = async (): Promise<Category[]> => {
  const db = getFirestoreDB()
  const q = query(collection(db, 'categories'), orderBy('order', 'asc'))
  const snap = await getDocs(q)
  const cats = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Category))
  return cats
}

export const createCategory = async (data: Omit<Category, 'id'>): Promise<string> => {
  const db = getFirestoreDB()
  const now = new Date().toISOString()
  const payload = sanitizeCategoryPayload({
    ...data,
    createdAt: now,
    updatedAt: now,
  })
  const ref = await addDoc(collection(db, 'categories'), payload)
  return ref.id
}

export const updateCategory = async (id: string, data: Partial<Category>): Promise<void> => {
  if (!id) throw new Error('Category ID is required for update')
  const db = getFirestoreDB()
  const payload = sanitizeCategoryPayload({
    ...data,
    updatedAt: new Date().toISOString(),
  })
  delete payload.id
  await setDoc(doc(db, 'categories', id), payload, { merge: true })
}

export const deleteCategory = async (id: string): Promise<void> => {
  if (!id) throw new Error('Category ID is required for deletion')
  const db = getFirestoreDB()
  await deleteDoc(doc(db, 'categories', id))
}

export const seedDefaultCategories = async (): Promise<void> => {
  const db = getFirestoreDB()
  for (const cat of DEFAULT_CATEGORIES) {
    await addDoc(collection(db, 'categories'), {
      ...cat,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }
}
