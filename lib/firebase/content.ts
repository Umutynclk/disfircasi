import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

export interface DynamicSectionItem {
  id: string
  title: string
  subtitle?: string
  badge?: string
  description?: string
  image?: string
  secondaryImage?: string
  bullets?: string[]
  ctaText?: string
  ctaUrl?: string
  order: number
  active: boolean
  extra?: Record<string, any>
}

export interface DynamicSectionConfig {
  sectionKey: string
  title?: string
  subtitle?: string
  badge?: string
  items: DynamicSectionItem[]
  extra?: Record<string, any>
  updatedAt?: string
}

/**
 * Subscribe in real-time to a dynamic section in siteContent
 */
export const subscribeToSection = (
  sectionKey: string,
  onData: (data: DynamicSectionConfig) => void,
  defaultData?: Partial<DynamicSectionConfig>
): Unsubscribe => {
  const db = getFirestoreDB()
  const sectionRef = doc(db, 'siteContent', sectionKey)

  return onSnapshot(sectionRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data() as DynamicSectionConfig
      const items = (data.items || [])
        .map((item, idx) => ({
          ...item,
          id: item.id || `item_${idx}_${Date.now()}`,
          order: item.order !== undefined ? item.order : idx + 1,
          active: item.active !== undefined ? item.active : true,
        }))
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      onData({
        ...data,
        sectionKey,
        items,
      })
    } else if (defaultData) {
      onData({
        sectionKey,
        title: defaultData.title || '',
        subtitle: defaultData.subtitle || '',
        badge: defaultData.badge || '',
        items: (defaultData.items || []).map((item, idx) => ({
          ...item,
          id: item.id || `item_${idx}_${Date.now()}`,
          order: item.order !== undefined ? item.order : idx + 1,
          active: item.active !== undefined ? item.active : true,
        })),
        extra: defaultData.extra || {},
      })
    }
  })
}

/**
 * Save section data with sanitized values (no undefined)
 */
export const saveSectionData = async (
  sectionKey: string,
  data: Partial<DynamicSectionConfig>
): Promise<void> => {
  const db = getFirestoreDB()
  const sectionRef = doc(db, 'siteContent', sectionKey)

  const cleanItems = (data.items || []).map((item, idx) => {
    const cleanItem: any = {
      id: item.id || `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      title: item.title || '',
      subtitle: item.subtitle || '',
      badge: item.badge || '',
      description: item.description || '',
      image: item.image || '',
      secondaryImage: item.secondaryImage || '',
      bullets: (item.bullets || []).filter((b) => b && b.trim() !== ''),
      ctaText: item.ctaText || '',
      ctaUrl: item.ctaUrl || '',
      order: item.order !== undefined ? item.order : idx + 1,
      active: item.active !== undefined ? item.active : true,
      extra: item.extra || {},
    }
    return cleanItem
  })

  const payload: any = {
    sectionKey,
    title: data.title || '',
    subtitle: data.subtitle || '',
    badge: data.badge || '',
    items: cleanItems,
    extra: data.extra || {},
    updatedAt: new Date().toISOString(),
  }

  await setDoc(sectionRef, payload, { merge: true })
}
