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

// ----------------------------------------------------
// HOMEPAGE DUAL SALES SHOWCASE DATA STRUCTURE & HELPER
// ----------------------------------------------------

export interface ShowcaseItem {
  id: string
  productId: string
  overrideTitle?: string
  overrideSubtitle?: string
  overrideDescription?: string
  overrideImage?: string
  overrideBadge?: string
  overrideCtaText?: string
  overrideCtaUrl?: string
  features?: string[]
  order: number
  active: boolean
}

export interface ShowcaseSideConfig {
  badge?: string
  title?: string
  subtitle?: string
  description?: string
  ctaText?: string
  ctaUrl?: string
  colorTheme?: string
  items: ShowcaseItem[]
}

export interface HomepageShowcaseConfig {
  active: boolean
  autoplay: boolean
  autoplaySeconds: number
  left: ShowcaseSideConfig
  right: ShowcaseSideConfig
  updatedAt?: string
}

export const DEFAULT_HOMEPAGE_SHOWCASE: HomepageShowcaseConfig = {
  active: true,
  autoplay: true,
  autoplaySeconds: 5,
  left: {
    badge: 'DÜNYANIN İLK',
    title: '360° DÖNEBİLEN DİŞ FIRÇASI',
    subtitle: 'Otomatik Diş Fırçası',
    description: '360° sonic dönebilen ve mikro titreşim teknolojisiyle dişlerinizi ve diş etlerinizi zahmetsizce derinlemesine temizleyin.',
    ctaText: 'Satın Al',
    ctaUrl: '/urunler?kategori=otomatik',
    colorTheme: 'blue',
    items: [],
  },
  right: {
    badge: 'DÜNYANIN İLK',
    title: 'BAŞLIK DEĞİŞMELİ DİŞ FIRÇASI',
    subtitle: 'Kullan At Diş Fırçası',
    description: 'Seyahat, ofis ve günlük yaşam için ultra hijyenik, pratik ve başlığı kolayca değiştirilebilir yeni nesil fırça.',
    ctaText: 'Satın Al',
    ctaUrl: '/urunler?kategori=kullan-at',
    colorTheme: 'green',
    items: [],
  },
}

export const subscribeToHomepageShowcase = (
  callback: (data: HomepageShowcaseConfig) => void
): Unsubscribe => {
  const db = getFirestoreDB()
  const ref = doc(db, 'siteContent', 'homepageShowcase')

  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const raw = snap.data() as any
        const sanitizeSide = (side: any, defaultSide: ShowcaseSideConfig): ShowcaseSideConfig => {
          if (!side) return defaultSide
          const items = (side.items || [])
            .map((item: any, idx: number) => ({
              id: item.id || `showcase_item_${idx}_${Date.now()}`,
              productId: item.productId || '',
              overrideTitle: item.overrideTitle || '',
              overrideSubtitle: item.overrideSubtitle || '',
              overrideDescription: item.overrideDescription || '',
              overrideImage: item.overrideImage || '',
              overrideBadge: item.overrideBadge || '',
              overrideCtaText: item.overrideCtaText || '',
              overrideCtaUrl: item.overrideCtaUrl || '',
              features: Array.isArray(item.features) ? item.features.filter(Boolean) : [],
              order: item.order !== undefined ? item.order : idx + 1,
              active: item.active !== undefined ? item.active : true,
            }))
            .sort((a: ShowcaseItem, b: ShowcaseItem) => (a.order || 0) - (b.order || 0))

          return {
            badge: side.badge !== undefined ? side.badge : defaultSide.badge,
            title: side.title !== undefined ? side.title : defaultSide.title,
            subtitle: side.subtitle !== undefined ? side.subtitle : defaultSide.subtitle,
            description: side.description !== undefined ? side.description : defaultSide.description,
            ctaText: side.ctaText !== undefined ? side.ctaText : defaultSide.ctaText,
            ctaUrl: side.ctaUrl !== undefined ? side.ctaUrl : defaultSide.ctaUrl,
            colorTheme: side.colorTheme || defaultSide.colorTheme,
            items,
          }
        }

        callback({
          active: raw.active !== undefined ? raw.active : DEFAULT_HOMEPAGE_SHOWCASE.active,
          autoplay: raw.autoplay !== undefined ? raw.autoplay : DEFAULT_HOMEPAGE_SHOWCASE.autoplay,
          autoplaySeconds: raw.autoplaySeconds || DEFAULT_HOMEPAGE_SHOWCASE.autoplaySeconds,
          left: sanitizeSide(raw.left, DEFAULT_HOMEPAGE_SHOWCASE.left),
          right: sanitizeSide(raw.right, DEFAULT_HOMEPAGE_SHOWCASE.right),
          updatedAt: raw.updatedAt,
        })
      } else {
        callback(DEFAULT_HOMEPAGE_SHOWCASE)
      }
    },
    (err) => {
      console.warn('subscribeToHomepageShowcase error, using default:', err)
      callback(DEFAULT_HOMEPAGE_SHOWCASE)
    }
  )
}

export const saveHomepageShowcase = async (data: Partial<HomepageShowcaseConfig>): Promise<void> => {
  const db = getFirestoreDB()
  const ref = doc(db, 'siteContent', 'homepageShowcase')

  const sanitizeSideForSave = (side?: ShowcaseSideConfig) => {
    if (!side) return {}
    return {
      badge: side.badge || '',
      title: side.title || '',
      subtitle: side.subtitle || '',
      description: side.description || '',
      ctaText: side.ctaText || '',
      ctaUrl: side.ctaUrl || '',
      colorTheme: side.colorTheme || 'blue',
      items: (side.items || []).map((item, idx) => ({
        id: item.id || `item_${Date.now()}_${idx}`,
        productId: item.productId || '',
        overrideTitle: item.overrideTitle || '',
        overrideSubtitle: item.overrideSubtitle || '',
        overrideDescription: item.overrideDescription || '',
        overrideImage: item.overrideImage || '',
        overrideBadge: item.overrideBadge || '',
        overrideCtaText: item.overrideCtaText || '',
        overrideCtaUrl: item.overrideCtaUrl || '',
        features: (item.features || []).filter(Boolean),
        order: item.order !== undefined ? item.order : idx + 1,
        active: item.active !== undefined ? item.active : true,
      })),
    }
  }

  const payload = {
    active: data.active !== undefined ? data.active : true,
    autoplay: data.autoplay !== undefined ? data.autoplay : true,
    autoplaySeconds: Number(data.autoplaySeconds) || 5,
    left: sanitizeSideForSave(data.left),
    right: sanitizeSideForSave(data.right),
    updatedAt: new Date().toISOString(),
  }

  await setDoc(ref, payload, { merge: true })
}

// ----------------------------------------------------
// MULTI-LANGUAGE BRAND LOGO & SETTINGS HELPER
// ----------------------------------------------------

export interface BrandLogoConfig {
  tr: string
  en: string
  de: string
  fr: string
  it: string
  default?: string
}

export const subscribeToBrandLogos = (
  callback: (logos: BrandLogoConfig) => void
): Unsubscribe => {
  const db = getFirestoreDB()
  const ref = doc(db, 'settings', 'brand')

  return onSnapshot(
    ref,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any
        const logos: BrandLogoConfig = {
          tr: data.logoUrl?.tr || data.logoUrl || '',
          en: data.logoUrl?.en || data.logoUrl?.tr || '',
          de: data.logoUrl?.de || data.logoUrl?.tr || '',
          fr: data.logoUrl?.fr || data.logoUrl?.tr || '',
          it: data.logoUrl?.it || data.logoUrl?.tr || '',
        }
        callback(logos)
      } else {
        callback({ tr: '', en: '', de: '', fr: '', it: '' })
      }
    },
    (err) => {
      console.warn('subscribeToBrandLogos error:', err)
      callback({ tr: '', en: '', de: '', fr: '', it: '' })
    }
  )
}

export const saveBrandLogos = async (logos: BrandLogoConfig): Promise<void> => {
  const db = getFirestoreDB()
  const ref = doc(db, 'settings', 'brand')
  await setDoc(ref, { logoUrl: logos, updatedAt: new Date().toISOString() }, { merge: true })
}


