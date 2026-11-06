'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiSave, FiImage, FiPlus, FiTrash2, FiCheck, FiCopy,
  FiArrowUp, FiArrowDown, FiEye, FiEyeOff, FiEdit3,
  FiLayout, FiLayers, FiGrid, FiCompass, FiShield,
  FiHelpCircle, FiTruck, FiRotateCcw, FiPhone, FiInfo, FiStar, FiUpload, FiShoppingBag, FiGlobe, FiZap
} from 'react-icons/fi'
import { uploadImage } from '@/lib/firebase/storage'
import {
  DynamicSectionItem,
  DynamicSectionConfig,
  saveSectionData,
  HomepageShowcaseConfig,
  DEFAULT_HOMEPAGE_SHOWCASE,
  saveHomepageShowcase,
  ShowcaseItem,
  subscribeToBrandLogos,
  saveBrandLogos,
  BrandLogoConfig,
  subscribeToSection,
} from '@/lib/firebase/content'
import { translateContent } from '@/lib/services/translation'
import MediaPickerModal from '@/components/admin/MediaPickerModal'
import ShowcaseProductPickerModal from '@/components/admin/ShowcaseProductPickerModal'
import { collection, getDocs } from 'firebase/firestore'

type ContentTab =
  | 'salesShowcase'
  | 'featuresBar'
  | 'brandLogos'
  | 'stories'
  | 'hero'
  | 'categories'
  | 'benefits'
  | 'cta'
  | 'productShowcase'
  | 'about'
  | 'faq'
  | 'shipping'
  | 'return'
  | 'contact'

export default function ContentStudioPage() {
  const [activeTab, setActiveTab] = useState<ContentTab>('salesShowcase')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  // Firebase Raw Products Cache for Resolving Product Info & Live Preview
  const [allProductsList, setAllProductsList] = useState<any[]>([])

  // Media Picker state
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false)
  const [mediaPickerTarget, setMediaPickerTarget] = useState<((url: string) => void) | null>(null)

  // Showcase Product Picker Modal state
  const [showcasePickerOpen, setShowcasePickerOpen] = useState(false)
  const [showcasePickerSide, setShowcasePickerSide] = useState<'left' | 'right'>('left')

  // 0. DUAL SALES SHOWCASE CONFIG (HERO REPLACEMENT)
  const [showcase, setShowcase] = useState<HomepageShowcaseConfig>(DEFAULT_HOMEPAGE_SHOWCASE)

  // 0b. BRAND LOGOS (5 language)
  const [brandLogos, setBrandLogos] = useState<BrandLogoConfig>({
    tr: '', en: '', de: '', fr: '', it: '', default: '',
  })

  // 0c. FEATURES BAR (Dynamic N items)
  const [featuresBarItems, setFeaturesBarItems] = useState<DynamicSectionItem[]>([
    { id: 'f1', title: 'Daha Sağlıklı Dişler', description: 'Klinik onaylı diş eti koruması.', extra: { icon: 'tooth' }, order: 1, active: true },
    { id: 'f2', title: 'Güvenli ve Doğal Temizlik', description: 'BPA içermeyen silikon kıllar.', extra: { icon: 'leaf' }, order: 2, active: true },
    { id: 'f3', title: 'Aile Boyu Kullanım', description: 'Yetişkin ve çocuklar için boyutlar.', extra: { icon: 'heart' }, order: 3, active: true },
    { id: 'f4', title: 'Seyahatler İçin İdeal', description: 'Hafif, taşınabilir ve hijyenik.', extra: { icon: 'airplane' }, order: 4, active: true },
    { id: 'f5', title: 'Daha Beyaz Bir Gülüş', description: 'Lekeleri gidermeye yardımcı.', extra: { icon: 'smile' }, order: 5, active: true },
  ])

  // Auto-translation state
  const [translating, setTranslating] = useState(false)

  // 1. UNLIMITED EDITORIAL STORIES
  const [stories, setStories] = useState<DynamicSectionItem[]>([
    {
      id: 'story_1',
      badge: 'Her 3 Ayda Bir Yenileyin',
      subtitle: 'Ağız Sağlığı Rutini',
      title: 'Fırçanı Düzenli Yenile, Maksimum Koruma Sağla.',
      description: 'Diş hekimleri, optimum plak temizliği ve bakteri birikimini önlemek için fırça başlıklarının en geç 3 ayda bir yenilenmesini tavsiye ediyor. Gülümse yedek başlıkları ile her zaman ilk günkü hijyeni koruyun.',
      bullets: ['%99.8 Plak Temizleme Verimi', 'Kolay Geçmeli Uyumlu Başlık', 'Bakteri Tutmayan Medikal Silikon'],
      ctaText: 'Yedek Başlıkları İncele',
      ctaUrl: '/urunler?kategori=yedek-firca-basliklari',
      image: '',
      order: 1,
      active: true,
    },
    {
      id: 'story_2',
      badge: 'Klinik Hassasiyet',
      subtitle: 'Nazik & Etkili Bakım',
      title: 'Hassas Diş Etlerine Özel Yumuşak Dokunuş.',
      description: 'Mikro incelikteki medikal fırça kılları, diş minenizi çizmeden ve diş etlerinize baskı yapmadan en zorlu aralıklara kadar ulaşır. Günlük kullanımda ferah ve acısız temizlik sağlar.',
      bullets: ['Hassas Diş Eti Dostu Yumuşak Kıllar', 'BPA İçermeyen Güvenli Malzeme', 'Diş Minesini Koruyan Mikro Titreşim'],
      ctaText: 'Hassas Seri Ürünleri Keşfet',
      ctaUrl: '/urunler',
      image: '',
      order: 2,
      active: true,
    },
  ])

  // 2. HERO SECTION
  const [hero, setHero] = useState({
    badge: 'Yeni Nesil Dental Teknoloji',
    title: 'Gülümsemenin',
    titleHighlight: 'yeni hali.',
    description: 'Günlük ağız bakımını daha pratik, hijyenik ve keyifli hale getiren 360° sonic otomatik ve kullan-at diş fırçalarını keşfedin.',
    primaryButtonText: 'Ürünleri Keşfet',
    primaryButtonUrl: '/urunler',
    secondaryButtonText: 'Kategorileri İncele',
    pill1: '360° Sonic Temizlik',
    pill2: 'Klinik Onaylı Koruma',
    pill3: '2 Yıl Resmi Garanti',
    image: '',
  })

  // 3. UNLIMITED BRAND BENEFITS (WHY GULUMSE)
  const [benefits, setBenefits] = useState<DynamicSectionItem[]>([
    { id: 'b_1', title: 'Daha Sağlıklı Dişler', description: 'Plağa karşı %99.4 daha etkili koruma ile diş eti sağlığınızı güçlendirin.', badge: '01', order: 1, active: true },
    { id: 'b_2', title: 'Güvenli ve Doğal Temizlik', description: 'BPA içermeyen medikal malzeme ve mikro aktif karbon kıl teknolojisi.', badge: '02', order: 2, active: true },
    { id: 'b_3', title: 'Aile Boyu Kullanım', description: 'Değiştirilebilir renkli başlıklar ve yetişkin/çocuk hassas modları.', badge: '03', order: 3, active: true },
    { id: 'b_4', title: 'Seyahatler İçin İdeal', description: 'Ultra hafif ergonomik kılıf, 45 günlük pil ve katlanabilir seçenekler.', badge: '04', order: 4, active: true },
    { id: 'b_5', title: 'Daha Beyaz Bir Gülüş', description: 'İlk haftadan itibaren çay, kahve ve lekelere karşı görünür parlatma.', badge: '05', order: 5, active: true },
  ])
  const [benefitsHeader, setBenefitsHeader] = useState({
    badge: 'Neden Gülümse?',
    title: 'Fark Yaratan 5 Marka Değeri.',
    subtitle: 'Ağız ve diş sağlığında en yüksek standartları estetikle buluşturuyoruz.',
  })

  // 4. UNLIMITED CATEGORY CHOICE CARDS
  const [categoryCards, setCategoryCards] = useState<DynamicSectionItem[]>([
    {
      id: 'cat_1',
      badge: 'Sonic Technology',
      title: 'OTOMATİK DİŞ FIRÇASI',
      description: '360° sonic titreşim teknolojisi ile dişlerinizi 45 saniyede zahmetsizce ve profesyonel standartta temizleyin.',
      bullets: ['360° Eşzamanlı Fırçalama', '45 Günlük Pil Ömrü', 'Hassas Diş Eti Masajı'],
      ctaText: 'Otomatik Modelleri İncele',
      ctaUrl: '/urunler?kategori=otomatik',
      image: '',
      order: 1,
      active: true,
    },
    {
      id: 'cat_2',
      badge: 'Everyday Hygiene',
      title: 'KULLAN AT DİŞ FIRÇASI',
      description: 'Seyahat, ofis ve misafirlikler için kendinden macunlu veya ultra hijyenik tek kullanımlık çözümler.',
      bullets: ['%100 Medikal Hijyen Paketi', 'Kendinden Macunlu Pratiklik', 'Çanta ve Seyahat Boyu'],
      ctaText: 'Kullan-At Serisini İncele',
      ctaUrl: '/urunler?kategori=kullan-at',
      image: '',
      order: 2,
      active: true,
    },
  ])
  const [categoryChoiceHeader, setCategoryChoiceHeader] = useState({
    sectionBadge: 'Seçimini Yap',
    sectionTitle: 'Gülüşün için doğru seçimi yap.',
    sectionSubtitle: 'İhtiyacınıza en uygun diş fırçası deneyimini seçin.',
  })

  // 5. PRODUCT SHOWCASE HEADER
  const [productShowcase, setProductShowcase] = useState({
    badge: 'Ürün Koleksiyonu',
    title: 'En Çok Tercih Edilenler',
    buttonText: 'Tüm Ürünleri İncele',
  })

  // 6. FINAL CTA
  const [cta, setCta] = useState({
    badge: 'HAYATA GÜLÜMSE',
    title: 'Gülümsemeye bugün başla.',
    titleHighlight: 'Sağlığı ve estetiği keşfet.',
    description: 'Hızlı kargo, 2 yıl resmi garanti ve %100 memnuniyet güvencesiyle sana en uygun ürünü hemen sipariş et.',
    primaryButtonText: 'Tüm Ürünleri İncele',
    secondaryButtonText: 'İletişime Geç',
    guarantee1: 'Aynı Gün Kargo Teslimatı',
    guarantee2: '2 Yıl Birebir Değişim Garantisi',
    guarantee3: '%100 Hijyen ve Müşteri Memnuniyeti',
  })

  // 7. CORPORATE PAGES
  const [about, setAbout] = useState({
    title: 'Hakkımızda',
    subtitle: 'Gülümse Dental Care Hikayemiz',
    storyTitle: 'Yeni Nesil Ağız Sağlığı Vizyonumuz',
    storyParagraphs: ['Gülümse olarak günlük ağız bakımını teknoloji ve konfor ile yeniden tanımlıyoruz.'],
  })

  const [faq, setFaq] = useState({
    title: 'Sıkça Sorulan Sorular',
    subtitle: 'Aklınıza takılan tüm soruların cevapları',
    items: [
      { question: 'Otomatik diş fırçası nasıl kullanılır?', answer: 'Cihazı ağzınıza yerleştirip açma tuşuna basın. 30-45 saniye içinde 360 derece sonic temizlik sağlar.' },
      { question: 'Kargo kaç günde teslim edilir?', answer: 'Siparişleriniz aynı gün kargoya verilir, 1-3 iş günü içinde teslim edilir.' },
      { question: 'Garantisi var mı?', answer: 'Tüm elektronik ürünlerimiz 2 yıl birebir değişim garantilidir.' },
    ],
  })

  const [shipping, setShipping] = useState({
    title: 'Kargo & Teslimat',
    subtitle: 'Hızlı ve güvenli kargo süreçlerimiz',
    shippingFee: 0,
    freeShippingThreshold: 500,
    deliveryTime: '1-3 İş Günü',
    content: 'Tüm siparişleriniz aynı gün özenle paketlenerek anlaşmalı kargo firmalarına teslim edilir.',
  })

  const [returnPolicy, setReturnPolicy] = useState({
    title: 'İade ve Değişim Koşulları',
    subtitle: '14 gün koşulsuz iade güvencesi',
    content: 'Kişisel hijyen ürünü olması sebebiyle ambalajı açılmamış ürünlerde 14 gün içinde iade hakkınız mevcuttur.',
  })

  const [contact, setContact] = useState({
    title: 'İletişime Geçin',
    subtitle: 'Sorularınız ve önerileriniz için bize ulaşın',
    phone: '+90 850 123 45 67',
    email: 'info@gulumse.com',
    address: 'İstanbul, Türkiye',
    workingHours: 'Hafta içi 09:00 - 18:00',
  })

  // Load all sections from Firestore
  useEffect(() => {
    // Subscribe to brand logos
    const unsubLogos = subscribeToBrandLogos((logos) => {
      setBrandLogos(logos)
    })

    // Subscribe to features bar
    const unsubFeatures = subscribeToSection(
      'homepageFeatures',
      (secData) => {
        if (secData.items && secData.items.length > 0) {
          setFeaturesBarItems(secData.items.sort((a, b) => (a.order || 0) - (b.order || 0)))
        }
      }
    )

    const loadAll = async () => {
      try {
        const db = getFirestoreDB()
        const [
          showcaseDoc, heroDoc, storiesDoc, catDoc, whyDoc, prodShowDoc, ctaDoc,
          aboutDoc, faqDoc, shipDoc, retDoc, contactDoc, productsSnap
        ] = await Promise.all([
          getDoc(doc(db, 'siteContent', 'homepageShowcase')),
          getDoc(doc(db, 'siteContent', 'hero')),
          getDoc(doc(db, 'siteContent', 'editorialPromo')),
          getDoc(doc(db, 'siteContent', 'categoryChoice')),
          getDoc(doc(db, 'siteContent', 'whyGulumse')),
          getDoc(doc(db, 'siteContent', 'productShowcase')),
          getDoc(doc(db, 'siteContent', 'cta')),
          getDoc(doc(db, 'siteContent', 'about')),
          getDoc(doc(db, 'siteContent', 'faq')),
          getDoc(doc(db, 'siteContent', 'shipping')),
          getDoc(doc(db, 'siteContent', 'return')),
          getDoc(doc(db, 'siteContent', 'contact')),
          getDocs(collection(db, 'products')),
        ])

        if (showcaseDoc.exists()) {
          const raw = showcaseDoc.data() as any
          setShowcase((prev) => ({
            ...prev,
            ...raw,
            left: {
              ...prev.left,
              ...(raw.left || {}),
              items: raw.left?.items || [],
            },
            right: {
              ...prev.right,
              ...(raw.right || {}),
              items: raw.right?.items || [],
            },
          }))
        }

        if (productsSnap && !productsSnap.empty) {
          setAllProductsList(productsSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
        }

        if (heroDoc.exists()) setHero((prev) => ({ ...prev, ...heroDoc.data() }))
        
        if (storiesDoc.exists()) {
          const d = storiesDoc.data()
          if (d.items && Array.isArray(d.items)) {
            setStories(d.items.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
          }
        }

        if (catDoc.exists()) {
          const d = catDoc.data()
          if (d.items && Array.isArray(d.items)) {
            setCategoryCards(d.items.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
          }
          setCategoryChoiceHeader({
            sectionBadge: d.sectionBadge || 'Seçimini Yap',
            sectionTitle: d.sectionTitle || 'Gülüşün için doğru seçimi yap.',
            sectionSubtitle: d.sectionSubtitle || 'İhtiyacınıza en uygun diş fırçası deneyimini seçin.',
          })
        }

        if (whyDoc.exists()) {
          const d = whyDoc.data()
          if (d.items && Array.isArray(d.items)) {
            setBenefits(d.items.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
          }
          setBenefitsHeader({
            badge: d.badge || 'Neden Gülümse?',
            title: d.title || 'Fark Yaratan 5 Marka Değeri.',
            subtitle: d.subtitle || 'Ağız ve diş sağlığında en yüksek standartları estetikle buluşturuyoruz.',
          })
        }

        if (prodShowDoc.exists()) setProductShowcase((prev) => ({ ...prev, ...prodShowDoc.data() }))
        if (ctaDoc.exists()) setCta((prev) => ({ ...prev, ...ctaDoc.data() }))
        if (aboutDoc.exists()) setAbout((prev) => ({ ...prev, ...aboutDoc.data() }))
        if (faqDoc.exists()) setFaq((prev) => ({ ...prev, ...faqDoc.data() }))
        if (shipDoc.exists()) setShipping((prev) => ({ ...prev, ...shipDoc.data() }))
        if (retDoc.exists()) setReturnPolicy((prev) => ({ ...prev, ...retDoc.data() }))
        if (contactDoc.exists()) setContact((prev) => ({ ...prev, ...contactDoc.data() }))
      } catch (err) {
        console.error('İçerikler yüklenirken hata:', err)
      } finally {
        setLoading(false)
      }
    }

    loadAll()

    return () => {
      unsubLogos()
      unsubFeatures()
    }
  }, [])

  // Universal Item Actions Helper (Add, Duplicate, Move, Toggle, Delete)
  const addItem = (list: DynamicSectionItem[], setList: (l: DynamicSectionItem[]) => void, template: Partial<DynamicSectionItem>) => {
    const newItem: DynamicSectionItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: template.title || 'Yeni İçerik Başlığı',
      subtitle: template.subtitle || '',
      badge: template.badge || '',
      description: template.description || 'İçerik açıklama metni...',
      bullets: template.bullets || ['Öne çıkan özellik maddesi 1', 'Öne çıkan özellik maddesi 2'],
      ctaText: template.ctaText || 'İncele',
      ctaUrl: template.ctaUrl || '/urunler',
      image: template.image || '',
      order: list.length + 1,
      active: true,
    }
    setList([...list, newItem])
  }

  const duplicateItem = (list: DynamicSectionItem[], setList: (l: DynamicSectionItem[]) => void, id: string) => {
    const target = list.find((item) => item.id === id)
    if (!target) return
    const clone: DynamicSectionItem = {
      ...target,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: `${target.title} (Kopya)`,
      order: list.length + 1,
    }
    setList([...list, clone])
  }

  const deleteItem = (list: DynamicSectionItem[], setList: (l: DynamicSectionItem[]) => void, id: string) => {
    if (!confirm('Bu öğeyi silmek istediğinize emin misiniz?')) return
    const updated = list.filter((i) => i.id !== id).map((item, idx) => ({ ...item, order: idx + 1 }))
    setList(updated)
  }

  const toggleActive = (list: DynamicSectionItem[], setList: (l: DynamicSectionItem[]) => void, id: string) => {
    setList(list.map((item) => (item.id === id ? { ...item, active: !item.active } : item)))
  }

  const moveItem = (list: DynamicSectionItem[], setList: (l: DynamicSectionItem[]) => void, index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= list.length) return

    const newList = [...list]
    const temp = newList[index]
    newList[index] = newList[targetIndex]
    newList[targetIndex] = temp

    const reordered = newList.map((item, idx) => ({ ...item, order: idx + 1 }))
    setList(reordered)
  }

  const openMediaPickerFor = (setter: (url: string) => void) => {
    setMediaPickerTarget(() => setter)
    setMediaPickerOpen(true)
  }

  // Save handler with notification
  const handleSaveSection = async (sectionKey: string, data: any) => {
    setSaving(true)
    setSaveSuccess(null)
    try {
      const db = getFirestoreDB()
      await setDoc(doc(db, 'siteContent', sectionKey), { ...data, updatedAt: new Date().toISOString() }, { merge: true })
      setSaveSuccess(sectionKey)
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (err: any) {
      alert(`Kaydedilirken hata oluştu: ${err.message || 'Hata'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">İçerik Stüdyosu Yükleniyor...</p>
        </div>
      </div>
    )
  }

  const TABS = [
    { id: 'salesShowcase', label: 'Ana Sayfa Satış Vitrini (Yeni)', icon: FiShoppingBag },
    { id: 'featuresBar', label: 'Alt Özellikler Barı', icon: FiZap },
    { id: 'brandLogos', label: 'Marka Logoları (5 Dil)', icon: FiGlobe },
    { id: 'stories', label: 'Tanıtım Hikayeleri (Sınırsız)', icon: FiStar },
    { id: 'categories', label: 'Kategori Seçim Kartları', icon: FiLayers },
    { id: 'benefits', label: 'Marka Değerleri (Neden Gülümse)', icon: FiShield },
    { id: 'productShowcase', label: 'Öne Çıkan Ürünler Başlığı', icon: FiGrid },
    { id: 'cta', label: 'Eylem Çağrısı (CTA)', icon: FiCompass },
    { id: 'about', label: 'Hakkımızda', icon: FiInfo },
    { id: 'faq', label: 'Sıkça Sorulan Sorular', icon: FiHelpCircle },
    { id: 'shipping', label: 'Kargo & Teslimat', icon: FiTruck },
    { id: 'return', label: 'İade & Değişim', icon: FiRotateCcw },
    { id: 'contact', label: 'İletişim Bilgileri', icon: FiPhone },
  ]

  // Helpers for Showcase Items
  const addProductToShowcase = (side: 'left' | 'right', product: any) => {
    const sideConfig = showcase[side]
    const existing = sideConfig.items || []
    
    // Duplicate check
    if (existing.some((i) => i.productId === product.id)) {
      alert('Bu ürün zaten vitrine ekli!')
      return
    }

    const newItem: ShowcaseItem = {
      id: `showcase_item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      productId: product.id,
      overrideTitle: '',
      overrideSubtitle: '',
      overrideDescription: '',
      overrideImage: '',
      overrideBadge: '',
      overrideCtaText: '',
      overrideCtaUrl: '',
      features: product.features || [],
      order: existing.length + 1,
      active: true,
    }

    setShowcase({
      ...showcase,
      [side]: {
        ...sideConfig,
        items: [...existing, newItem],
      },
    })
  }

  const removeShowcaseItem = (side: 'left' | 'right', itemId: string) => {
    const sideConfig = showcase[side]
    const updated = (sideConfig.items || [])
      .filter((i) => i.id !== itemId)
      .map((item, idx) => ({ ...item, order: idx + 1 }))

    setShowcase({
      ...showcase,
      [side]: {
        ...sideConfig,
        items: updated,
      },
    })
  }

  const moveShowcaseItem = (side: 'left' | 'right', index: number, direction: 'up' | 'down') => {
    const sideConfig = showcase[side]
    const list = [...(sideConfig.items || [])]
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= list.length) return

    const temp = list[index]
    list[index] = list[targetIndex]
    list[targetIndex] = temp

    const reordered = list.map((item, idx) => ({ ...item, order: idx + 1 }))

    setShowcase({
      ...showcase,
      [side]: {
        ...sideConfig,
        items: reordered,
      },
    })
  }

  const toggleShowcaseItemActive = (side: 'left' | 'right', itemId: string) => {
    const sideConfig = showcase[side]
    const updated = (sideConfig.items || []).map((item) =>
      item.id === itemId ? { ...item, active: !item.active } : item
    )

    setShowcase({
      ...showcase,
      [side]: {
        ...sideConfig,
        items: updated,
      },
    })
  }

  const handleSaveShowcase = async () => {
    setSaving(true)
    setSaveSuccess(null)
    try {
      await saveHomepageShowcase(showcase)
      setSaveSuccess('salesShowcase')
      setTimeout(() => setSaveSuccess(null), 3000)
    } catch (err: any) {
      alert(`Kaydedilirken hata oluştu: ${err.message || 'Hata'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">İçerik Yönetim Stüdyosu</h1>
          <p className="text-gray-500 mt-1">
            Sınırsız öğe ekleyin, sıralayın, kopyalayın ve ana sayfayı kod değiştirmeden tam dinamik yönetin.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 font-medium">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Canlı Firebase Senkronizasyonu Aktif
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm mb-6 p-2 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as ContentTab)}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm p-6 sm:p-8">

        {/* ========================================================================= */}
        {/* 0. NEW DUAL SALES SHOWCASE TAB (HERO REPLACEMENT WITH DYNAMIC PRODUCTS) */}
        {/* ========================================================================= */}
        {activeTab === 'salesShowcase' && (
          <div className="space-y-10">
            {/* Tab Header & Save */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-gray-900">Ana Sayfa Satış Vitrini</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase bg-primary-50 text-primary-700 border border-primary-200">
                    2 Kolonlu Vitrin
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Sol (Otomatik) ve Sağ (Kullan At) alanlarına istediğiniz sayıda ürün ekleyin. Ürünler bağımsız olarak 5 saniyede döner.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSaveShowcase}
                disabled={saving}
                className="flex items-center justify-center gap-2 px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-50"
              >
                {saveSuccess === 'salesShowcase' ? <FiCheck className="w-4 h-4" /> : <FiSave className="w-4 h-4" />}
                <span>{saving ? 'Kaydediliyor...' : saveSuccess === 'salesShowcase' ? 'Kaydedildi!' : 'Vitrini Kaydet'}</span>
              </button>
            </div>

            {/* General Showcase Settings Banner */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Genel Vitrin Ayarları</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                {/* Active Toggle */}
                <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Vitrin Durumu</div>
                    <div className="text-[11px] text-slate-500">Ana sayfada gösterilsin mi?</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showcase.active !== false}
                    onChange={(e) => setShowcase({ ...showcase, active: e.target.checked })}
                    className="w-5 h-5 accent-primary-600 rounded cursor-pointer"
                  />
                </div>

                {/* Autoplay Toggle */}
                <div className="flex items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200">
                  <div>
                    <div className="text-xs font-bold text-slate-800">Otomatik Döngü (Autoplay)</div>
                    <div className="text-[11px] text-slate-500">Ürünler otomatik değişsin</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={showcase.autoplay !== false}
                    onChange={(e) => setShowcase({ ...showcase, autoplay: e.target.checked })}
                    className="w-5 h-5 accent-primary-600 rounded cursor-pointer"
                  />
                </div>

                {/* Duration Picker */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="text-xs font-bold text-slate-800">Geçiş Süresi:</div>
                    <span className="text-xs font-extrabold text-primary-600">{showcase.autoplaySeconds || 5} saniye</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[3, 4, 5, 6, 10].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setShowcase({ ...showcase, autoplaySeconds: sec })}
                        className={`flex-1 py-1 text-xs font-bold rounded-lg transition-colors ${
                          showcase.autoplaySeconds === sec
                            ? 'bg-primary-600 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {sec}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Two Side Columns Editors */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* ======================================================== */}
              {/* LEFT COLUMN: OTOMATİK DİŞ FIRÇASI (Sky/Blue)              */}
              {/* ======================================================== */}
              <div className="bg-sky-50/40 rounded-3xl border border-sky-200/80 p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-sky-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-sky-500" />
                    <h3 className="text-base font-black text-slate-900">SOL ALAN – OTOMATİK DİŞ FIRÇASI</h3>
                  </div>
                  <span className="text-[11px] font-bold text-sky-700 bg-sky-100 px-2.5 py-0.5 rounded-full">
                    {showcase.left.items?.length || 0} Ürün
                  </span>
                </div>

                {/* Text configuration */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Üst Rozet</label>
                      <input
                        type="text"
                        value={showcase.left.badge || ''}
                        onChange={(e) => setShowcase({ ...showcase, left: { ...showcase.left, badge: e.target.value } })}
                        placeholder="örn: DÜNYANIN İLK"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Alt Kategori Başlığı</label>
                      <input
                        type="text"
                        value={showcase.left.subtitle || ''}
                        onChange={(e) => setShowcase({ ...showcase, left: { ...showcase.left, subtitle: e.target.value } })}
                        placeholder="örn: Otomatik Diş Fırçası"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Büyük Başlık Metni</label>
                    <input
                      type="text"
                      value={showcase.left.title || ''}
                      onChange={(e) => setShowcase({ ...showcase, left: { ...showcase.left, title: e.target.value } })}
                      placeholder="örn: 360° DÖNEBİLEN DİŞ FIRÇASI"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-sky-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama</label>
                    <textarea
                      rows={2}
                      value={showcase.left.description || ''}
                      onChange={(e) => setShowcase({ ...showcase, left: { ...showcase.left, description: e.target.value } })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs resize-none focus:border-sky-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CTA Buton Yazısı</label>
                      <input
                        type="text"
                        value={showcase.left.ctaText || ''}
                        onChange={(e) => setShowcase({ ...showcase, left: { ...showcase.left, ctaText: e.target.value } })}
                        placeholder="Satın Al"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CTA Buton Linki</label>
                      <input
                        type="text"
                        value={showcase.left.ctaUrl || ''}
                        onChange={(e) => setShowcase({ ...showcase, left: { ...showcase.left, ctaUrl: e.target.value } })}
                        placeholder="/urunler?kategori=otomatik"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-sky-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Left Products List */}
                <div className="pt-2 border-t border-sky-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Seçili Ürünler ({showcase.left.items?.length || 0})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowcasePickerSide('left')
                        setShowcasePickerOpen(true)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
                    >
                      <FiPlus className="w-3.5 h-3.5" />
                      <span>+ Ürün Ekle</span>
                    </button>
                  </div>

                  {/* Empty state or list */}
                  {(!showcase.left.items || showcase.left.items.length === 0) ? (
                    <div className="p-6 text-center bg-white/70 rounded-2xl border border-dashed border-sky-200 text-slate-400">
                      <p className="text-xs font-medium mb-2">Henüz özel ürün seçilmedi.</p>
                      <p className="text-[11px] text-slate-400">Otomatik olarak kategoriye ait ürünler dönecektir.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {showcase.left.items.map((item, idx) => {
                        const matchedProduct = allProductsList.find((p) => p.id === item.productId)
                        const displayImg = item.overrideImage || matchedProduct?.images?.[0] || matchedProduct?.image || ''

                        return (
                          <div
                            key={item.id}
                            className={`bg-white rounded-2xl border p-4 transition-all space-y-3 ${
                              item.active ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-gray-50'
                            }`}
                          >
                            {/* Card Item Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-6 h-6 rounded-lg bg-sky-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                  {displayImg ? (
                                    <img src={displayImg} alt="" className="w-full h-full object-contain" />
                                  ) : (
                                    <span>🦷</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-900 truncate">
                                    {item.overrideTitle || matchedProduct?.name || 'Ürün'}
                                  </h4>
                                  <span className="text-[10px] text-slate-400">
                                    {matchedProduct?.price ? `${matchedProduct.price.toLocaleString('tr-TR')} ₺` : 'Fiyat Tanımsız'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveShowcaseItem('left', idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30"
                                >
                                  <FiArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveShowcaseItem('left', idx, 'down')}
                                  disabled={idx === showcase.left.items.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30"
                                >
                                  <FiArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleShowcaseItemActive('left', item.id)}
                                  className={`p-1 ${item.active ? 'text-emerald-600' : 'text-slate-400'}`}
                                >
                                  {item.active ? <FiEye className="w-3.5 h-3.5" /> : <FiEyeOff className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeShowcaseItem('left', item.id)}
                                  className="p-1 text-red-500 hover:text-red-700 ml-1"
                                >
                                  <FiTrash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Item Overrides Collapsible Options */}
                            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Özel Başlık (Opsiyonel)
                                </label>
                                <input
                                  type="text"
                                  value={item.overrideTitle || ''}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    const updated = showcase.left.items.map((i) => (i.id === item.id ? { ...i, overrideTitle: val } : i))
                                    setShowcase({ ...showcase, left: { ...showcase.left, items: updated } })
                                  }}
                                  placeholder={matchedProduct?.name || 'Ürün Adı'}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Özel Fotoğraf (Override)
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openMediaPickerFor((url) => {
                                        const updated = showcase.left.items.map((i) => (i.id === item.id ? { ...i, overrideImage: url } : i))
                                        setShowcase({ ...showcase, left: { ...showcase.left, items: updated } })
                                      })
                                    }
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                                  >
                                    Medyadan Seç
                                  </button>
                                  {item.overrideImage && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = showcase.left.items.map((i) => (i.id === item.id ? { ...i, overrideImage: '' } : i))
                                        setShowcase({ ...showcase, left: { ...showcase.left, items: updated } })
                                      }}
                                      className="text-red-500 text-[10px] font-bold hover:underline"
                                    >
                                      Sıfırla
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* ======================================================== */}
              {/* RIGHT COLUMN: KULLAN AT DİŞ FIRÇASI (Emerald/Green)      */}
              {/* ======================================================== */}
              <div className="bg-emerald-50/40 rounded-3xl border border-emerald-200/80 p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <h3 className="text-base font-black text-slate-900">SAĞ ALAN – KULLAN AT DİŞ FIRÇASI</h3>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    {showcase.right.items?.length || 0} Ürün
                  </span>
                </div>

                {/* Text configuration */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Üst Rozet</label>
                      <input
                        type="text"
                        value={showcase.right.badge || ''}
                        onChange={(e) => setShowcase({ ...showcase, right: { ...showcase.right, badge: e.target.value } })}
                        placeholder="örn: DÜNYANIN İLK"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Alt Kategori Başlığı</label>
                      <input
                        type="text"
                        value={showcase.right.subtitle || ''}
                        onChange={(e) => setShowcase({ ...showcase, right: { ...showcase.right, subtitle: e.target.value } })}
                        placeholder="örn: Kullan At Diş Fırçası"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Büyük Başlık Metni</label>
                    <input
                      type="text"
                      value={showcase.right.title || ''}
                      onChange={(e) => setShowcase({ ...showcase, right: { ...showcase.right, title: e.target.value } })}
                      placeholder="örn: BAŞLIK DEĞİŞMELİ DİŞ FIRÇASI"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Açıklama</label>
                    <textarea
                      rows={2}
                      value={showcase.right.description || ''}
                      onChange={(e) => setShowcase({ ...showcase, right: { ...showcase.right, description: e.target.value } })}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs resize-none focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CTA Buton Yazısı</label>
                      <input
                        type="text"
                        value={showcase.right.ctaText || ''}
                        onChange={(e) => setShowcase({ ...showcase, right: { ...showcase.right, ctaText: e.target.value } })}
                        placeholder="Satın Al"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">CTA Buton Linki</label>
                      <input
                        type="text"
                        value={showcase.right.ctaUrl || ''}
                        onChange={(e) => setShowcase({ ...showcase, right: { ...showcase.right, ctaUrl: e.target.value } })}
                        placeholder="/urunler?kategori=kullan-at"
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Right Products List */}
                <div className="pt-2 border-t border-emerald-100">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Seçili Ürünler ({showcase.right.items?.length || 0})
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setShowcasePickerSide('right')
                        setShowcasePickerOpen(true)
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
                    >
                      <FiPlus className="w-3.5 h-3.5" />
                      <span>+ Ürün Ekle</span>
                    </button>
                  </div>

                  {/* Empty state or list */}
                  {(!showcase.right.items || showcase.right.items.length === 0) ? (
                    <div className="p-6 text-center bg-white/70 rounded-2xl border border-dashed border-emerald-200 text-slate-400">
                      <p className="text-xs font-medium mb-2">Henüz özel ürün seçilmedi.</p>
                      <p className="text-[11px] text-slate-400">Otomatik olarak seyahat / kullan-at ürünleri dönecektir.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {showcase.right.items.map((item, idx) => {
                        const matchedProduct = allProductsList.find((p) => p.id === item.productId)
                        const displayImg = item.overrideImage || matchedProduct?.images?.[0] || matchedProduct?.image || ''

                        return (
                          <div
                            key={item.id}
                            className={`bg-white rounded-2xl border p-4 transition-all space-y-3 ${
                              item.active ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-gray-50'
                            }`}
                          >
                            {/* Card Item Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                                  {idx + 1}
                                </span>
                                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 p-1 flex-shrink-0 flex items-center justify-center overflow-hidden">
                                  {displayImg ? (
                                    <img src={displayImg} alt="" className="w-full h-full object-contain" />
                                  ) : (
                                    <span>🌿</span>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-slate-900 truncate">
                                    {item.overrideTitle || matchedProduct?.name || 'Ürün'}
                                  </h4>
                                  <span className="text-[10px] text-slate-400">
                                    {matchedProduct?.price ? `${matchedProduct.price.toLocaleString('tr-TR')} ₺` : 'Fiyat Tanımsız'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveShowcaseItem('right', idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30"
                                >
                                  <FiArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveShowcaseItem('right', idx, 'down')}
                                  disabled={idx === showcase.right.items.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30"
                                >
                                  <FiArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => toggleShowcaseItemActive('right', item.id)}
                                  className={`p-1 ${item.active ? 'text-emerald-600' : 'text-slate-400'}`}
                                >
                                  {item.active ? <FiEye className="w-3.5 h-3.5" /> : <FiEyeOff className="w-3.5 h-3.5" />}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeShowcaseItem('right', item.id)}
                                  className="p-1 text-red-500 hover:text-red-700 ml-1"
                                >
                                  <FiTrash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            {/* Item Overrides Collapsible Options */}
                            <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Özel Başlık (Opsiyonel)
                                </label>
                                <input
                                  type="text"
                                  value={item.overrideTitle || ''}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    const updated = showcase.right.items.map((i) => (i.id === item.id ? { ...i, overrideTitle: val } : i))
                                    setShowcase({ ...showcase, right: { ...showcase.right, items: updated } })
                                  }}
                                  placeholder={matchedProduct?.name || 'Ürün Adı'}
                                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                                  Özel Fotoğraf (Override)
                                </label>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openMediaPickerFor((url) => {
                                        const updated = showcase.right.items.map((i) => (i.id === item.id ? { ...i, overrideImage: url } : i))
                                        setShowcase({ ...showcase, right: { ...showcase.right, items: updated } })
                                      })
                                    }
                                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold transition-colors"
                                  >
                                    Medyadan Seç
                                  </button>
                                  {item.overrideImage && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const updated = showcase.right.items.map((i) => (i.id === item.id ? { ...i, overrideImage: '' } : i))
                                        setShowcase({ ...showcase, right: { ...showcase.right, items: updated } })
                                      }}
                                      className="text-red-500 text-[10px] font-bold hover:underline"
                                    >
                                      Sıfırla
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* LIVE PREVIEW BOX */}
            <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Canlı Önizleme (Admin Preview)</span>
                </div>
                <span className="text-xs text-slate-400">Ana sayfadaki görünüm</span>
              </div>

              <div className="bg-white text-slate-900 rounded-2xl p-6 border border-slate-200 shadow-inner grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-sky-50/70 p-5 rounded-2xl border border-sky-200 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-sky-600 uppercase">{showcase.left.badge || 'DÜNYANIN İLK'}</span>
                    <h4 className="text-lg font-black text-slate-900">{showcase.left.subtitle || 'Otomatik Diş Fırçası'}</h4>
                    <p className="text-xs font-bold text-sky-700 mt-1">{showcase.left.title || '360° DÖNEBİLEN DİŞ FIRÇASI'}</p>
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">{showcase.left.description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-sky-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-600">🛒 {showcase.left.ctaText || 'Satın Al'}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{showcase.left.items?.length || 0} ürün tanımlı</span>
                  </div>
                </div>

                <div className="bg-emerald-50/70 p-5 rounded-2xl border border-emerald-200 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-600 uppercase">{showcase.right.badge || 'DÜNYANIN İLK'}</span>
                    <h4 className="text-lg font-black text-slate-900">{showcase.right.subtitle || 'Kullan At Diş Fırçası'}</h4>
                    <p className="text-xs font-bold text-emerald-700 mt-1">{showcase.right.title || 'BAŞLIK DEĞİŞMELİ DİŞ FIRÇASI'}</p>
                    <p className="text-[11px] text-slate-500 mt-2 line-clamp-2">{showcase.right.description}</p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-emerald-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-600">🛒 {showcase.right.ctaText || 'Satın Al'}</span>
                    <span className="text-[10px] text-slate-400 font-bold">{showcase.right.items?.length || 0} ürün tanımlı</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ========== FEATURES BAR TAB ========== */}
        {activeTab === 'featuresBar' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Alt Özellikler Barı</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ana sayfa vitrininin altında görünen özellik ikonları. İstediğiniz kadar ekleyebilirsiniz.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => addItem(featuresBarItems, setFeaturesBarItems, {
                    title: 'Yeni Özellik',
                    description: 'Özellik açıklaması',
                    extra: { icon: 'tooth' },
                  })}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white rounded-xl font-bold text-xs hover:bg-primary-700 transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Özellik Ekle
                </button>
                <button
                  onClick={() => handleSaveSection('homepageFeatures', { items: featuresBarItems })}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : saveSuccess === 'homepageFeatures' ? (
                    <FiCheck className="w-4 h-4" />
                  ) : (
                    <FiSave className="w-4 h-4" />
                  )}
                  Kaydet
                </button>
              </div>
            </div>

            {featuresBarItems.map((feat, fIdx) => (
              <div
                key={feat.id}
                className={`bg-white rounded-2xl border p-5 space-y-4 transition-all ${
                  feat.active === false ? 'opacity-50 border-gray-200' : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-black text-gray-800">#{fIdx + 1} — {feat.title || 'İsimsiz'}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveItem(featuresBarItems, setFeaturesBarItems, fIdx, 'up')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><FiArrowUp className="w-3.5 h-3.5" /></button>
                    <button onClick={() => moveItem(featuresBarItems, setFeaturesBarItems, fIdx, 'down')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><FiArrowDown className="w-3.5 h-3.5" /></button>
                    <button onClick={() => toggleActive(featuresBarItems, setFeaturesBarItems, feat.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                      {feat.active !== false ? <FiEye className="w-3.5 h-3.5" /> : <FiEyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => duplicateItem(featuresBarItems, setFeaturesBarItems, feat.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><FiCopy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteItem(featuresBarItems, setFeaturesBarItems, feat.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 hover:text-red-600"><FiTrash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Başlık</label>
                    <input
                      type="text"
                      value={feat.title || ''}
                      onChange={(e) => {
                        const updated = [...featuresBarItems]
                        updated[fIdx] = { ...updated[fIdx], title: e.target.value }
                        setFeaturesBarItems(updated)
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Açıklama</label>
                    <input
                      type="text"
                      value={feat.description || ''}
                      onChange={(e) => {
                        const updated = [...featuresBarItems]
                        updated[fIdx] = { ...updated[fIdx], description: e.target.value }
                        setFeaturesBarItems(updated)
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">İkon</label>
                    <select
                      value={feat.extra?.icon || 'tooth'}
                      onChange={(e) => {
                        const updated = [...featuresBarItems]
                        updated[fIdx] = { ...updated[fIdx], extra: { ...updated[fIdx].extra, icon: e.target.value } }
                        setFeaturesBarItems(updated)
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="tooth">🦷 Diş</option>
                      <option value="leaf">🌿 Yaprak</option>
                      <option value="heart">❤️ Kalp</option>
                      <option value="airplane">✈️ Uçak</option>
                      <option value="smile">😊 Gülümseme</option>
                    </select>
                  </div>
                </div>

                {/* Custom Icon Image Upload */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Özel İkon Görseli (Opsiyonel)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={feat.image || ''}
                      onChange={(e) => {
                        const updated = [...featuresBarItems]
                        updated[fIdx] = { ...updated[fIdx], image: e.target.value }
                        setFeaturesBarItems(updated)
                      }}
                      placeholder="https://... veya medya seçici kullanın"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => openMediaPickerFor((url) => {
                        const updated = [...featuresBarItems]
                        updated[fIdx] = { ...updated[fIdx], image: url }
                        setFeaturesBarItems(updated)
                      })}
                      className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-bold hover:bg-gray-200 text-gray-700 transition-colors"
                    >
                      <FiImage className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========== BRAND LOGOS TAB ========== */}
        {activeTab === 'brandLogos' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Marka Logoları (5 Dil)</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Her dil için farklı bir logo yükleyebilirsiniz. Navbar'da aktif dile göre gösterilir.
                </p>
              </div>
              <button
                onClick={async () => {
                  setSaving(true)
                  try {
                    await saveBrandLogos(brandLogos)
                    setSaveSuccess('brandLogos')
                    setTimeout(() => setSaveSuccess(null), 3000)
                  } catch (err: any) {
                    alert(`Hata: ${err.message}`)
                  } finally {
                    setSaving(false)
                  }
                }}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : saveSuccess === 'brandLogos' ? (
                  <FiCheck className="w-4 h-4" />
                ) : (
                  <FiSave className="w-4 h-4" />
                )}
                Kaydet
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {(['tr', 'en', 'de', 'fr', 'it'] as const).map((lang) => {
                const flags: Record<string, string> = { tr: '🇹🇷', en: '🇬🇧', de: '🇩🇪', fr: '🇫🇷', it: '🇮🇹' }
                const names: Record<string, string> = { tr: 'Türkçe', en: 'English', de: 'Deutsch', fr: 'Français', it: 'Italiano' }
                return (
                  <div key={lang} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{flags[lang]}</span>
                      <span className="text-sm font-black text-gray-800">{names[lang]} Logo</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={(brandLogos as any)[lang] || ''}
                        onChange={(e) => setBrandLogos((prev) => ({ ...prev, [lang]: e.target.value }))}
                        placeholder="Logo URL..."
                        className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <button
                        onClick={() => openMediaPickerFor((url) => setBrandLogos((prev) => ({ ...prev, [lang]: url })))}
                        className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-bold hover:bg-gray-200 text-gray-700 transition-colors"
                      >
                        <FiImage className="w-4 h-4" />
                      </button>
                    </div>
                    {(brandLogos as any)[lang] && (
                      <div className="h-16 bg-gray-50 rounded-xl flex items-center justify-center p-2">
                        <img src={(brandLogos as any)[lang]} alt={`${names[lang]} Logo`} className="max-h-full max-w-full object-contain" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Default / Fallback Logo */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌐</span>
                <span className="text-sm font-black text-gray-800">Varsayılan Logo (Fallback)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={brandLogos.default || ''}
                  onChange={(e) => setBrandLogos((prev) => ({ ...prev, default: e.target.value }))}
                  placeholder="Fallback logo URL..."
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <button
                  onClick={() => openMediaPickerFor((url) => setBrandLogos((prev) => ({ ...prev, default: url })))}
                  className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-bold hover:bg-gray-200 text-gray-700 transition-colors"
                >
                  <FiImage className="w-4 h-4" />
                </button>
              </div>
              {brandLogos.default && (
                <div className="h-16 bg-gray-50 rounded-xl flex items-center justify-center p-2">
                  <img src={brandLogos.default} alt="Default Logo" className="max-h-full max-w-full object-contain" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* 1. UNLIMITED EDITORIAL STORIES TAB */}
        {activeTab === 'stories' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Tanıtım Hikayeleri (Editorial Stories)</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ana sayfadaki koyu temalı hikaye blokları. İstediğiniz kadar (1, 2, 3, 4, 10...) ekleyebilirsiniz.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    addItem(stories, setStories, {
                      badge: 'YENİ HİKAYE',
                      subtitle: 'Dental Bakım Tavsiyesi',
                      title: 'Yeni Tanıtım Hikayesi Başlığı',
                      description: 'Hikaye detaylarını ve kullanıcıya güven veren medikal özellikleri buraya yazın.',
                      bullets: ['Klinik Onaylı Teknoloji', '%100 Hijyen Güvencesi'],
                      ctaText: 'Hemen İncele',
                      ctaUrl: '/urunler',
                    })
                  }
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-xl text-xs font-bold transition-all"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>+ Yeni Hikaye Ekle</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSaveSection('editorialPromo', { items: stories })}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {saveSuccess === 'editorialPromo' ? <FiCheck className="w-4 h-4" /> : <FiSave className="w-4 h-4" />}
                  <span>{saving ? 'Kaydediliyor...' : saveSuccess === 'editorialPromo' ? 'Kaydedildi!' : 'Hikayeleri Kaydet'}</span>
                </button>
              </div>
            </div>

            {/* Stories Dynamic List */}
            <div className="space-y-6">
              {stories.map((story, index) => (
                <div
                  key={story.id}
                  className={`rounded-2xl border p-6 transition-all ${
                    story.active ? 'bg-slate-50 border-slate-200' : 'bg-gray-100/70 border-gray-200 opacity-60'
                  }`}
                >
                  {/* Item Header Controls */}
                  <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-200/80">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-primary-600 text-white text-xs font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                      <h3 className="text-sm font-bold text-gray-900 truncate max-w-xs sm:max-w-md">
                        {story.title || 'İsimsiz Hikaye'}
                      </h3>
                      {!story.active && (
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                          Pasif
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Move Up */}
                      <button
                        type="button"
                        onClick={() => moveItem(stories, setStories, index, 'up')}
                        disabled={index === 0}
                        title="Yukarı Taşı"
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white rounded-lg transition-colors disabled:opacity-30"
                      >
                        <FiArrowUp className="w-4 h-4" />
                      </button>

                      {/* Move Down */}
                      <button
                        type="button"
                        onClick={() => moveItem(stories, setStories, index, 'down')}
                        disabled={index === stories.length - 1}
                        title="Aşağı Taşı"
                        className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-white rounded-lg transition-colors disabled:opacity-30"
                      >
                        <FiArrowDown className="w-4 h-4" />
                      </button>

                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={() => duplicateItem(stories, setStories, story.id)}
                        title="Bu Hikayeyi Kopyala (Duplicate)"
                        className="p-1.5 text-primary-600 hover:bg-white rounded-lg transition-colors"
                      >
                        <FiCopy className="w-4 h-4" />
                      </button>

                      {/* Toggle Active */}
                      <button
                        type="button"
                        onClick={() => toggleActive(stories, setStories, story.id)}
                        title={story.active ? 'Pasif Yap' : 'Aktif Yap'}
                        className={`p-1.5 rounded-lg transition-colors ${
                          story.active ? 'text-emerald-600 hover:bg-white' : 'text-gray-400 hover:bg-white'
                        }`}
                      >
                        {story.active ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => deleteItem(stories, setStories, story.id)}
                        title="Sil"
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Item Edit Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Üst Başlık (Badge)</label>
                      <input
                        type="text"
                        value={story.badge || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setStories(stories.map((s) => (s.id === story.id ? { ...s, badge: val } : s)))
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                        placeholder="örn: Her 3 Ayda Bir Yenileyin"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Alt Kategori Başlığı</label>
                      <input
                        type="text"
                        value={story.subtitle || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setStories(stories.map((s) => (s.id === story.id ? { ...s, subtitle: val } : s)))
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                        placeholder="örn: Ağız Sağlığı Rutini"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Büyük Ana Başlık</label>
                      <input
                        type="text"
                        value={story.title}
                        onChange={(e) => {
                          const val = e.target.value
                          setStories(stories.map((s) => (s.id === story.id ? { ...s, title: val } : s)))
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold focus:border-primary-600 focus:outline-none"
                        placeholder="Fırçanı Düzenli Yenile, Maksimum Koruma Sağla."
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Açıklama Metni</label>
                      <textarea
                        rows={3}
                        value={story.description || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setStories(stories.map((s) => (s.id === story.id ? { ...s, description: val } : s)))
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">CTA Buton Yazısı</label>
                      <input
                        type="text"
                        value={story.ctaText || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setStories(stories.map((s) => (s.id === story.id ? { ...s, ctaText: val } : s)))
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                        placeholder="Yedek Başlıkları İncele"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">CTA Buton Linki</label>
                      <input
                        type="text"
                        value={story.ctaUrl || ''}
                        onChange={(e) => {
                          const val = e.target.value
                          setStories(stories.map((s) => (s.id === story.id ? { ...s, ctaUrl: val } : s)))
                        }}
                        className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                        placeholder="/urunler"
                      />
                    </div>

                    {/* Image Selector */}
                    <div className="md:col-span-2 bg-white p-4 rounded-xl border border-gray-200">
                      <label className="block text-xs font-semibold text-gray-700 mb-2">Hikaye Görseli</label>
                      <div className="flex items-center gap-4">
                        {story.image ? (
                          <div className="relative w-20 h-20 rounded-xl border border-gray-200 overflow-hidden bg-slate-50 flex-shrink-0">
                            <img src={story.image} alt="" className="w-full h-full object-contain p-1" />
                            <button
                              type="button"
                              onClick={() => setStories(stories.map((s) => (s.id === story.id ? { ...s, image: '' } : s)))}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px]"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-400 flex-shrink-0">
                            <FiImage className="w-6 h-6" />
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openMediaPickerFor((url) => {
                                setStories(stories.map((s) => (s.id === story.id ? { ...s, image: url } : s)))
                              })
                            }
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                          >
                            <FiImage className="w-3.5 h-3.5" />
                            <span>Medyadan Seç</span>
                          </button>

                          <label className="cursor-pointer px-4 py-2 bg-primary-50 hover:bg-primary-100 text-primary-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5">
                            <FiUpload className="w-3.5 h-3.5" />
                            <span>Yeni Görsel Yükle</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                try {
                                  const url = await uploadImage(file, 'stories')
                                  setStories(stories.map((s) => (s.id === story.id ? { ...s, image: url } : s)))
                                } catch (err: any) {
                                  alert(`Hata: ${err.message || 'Yüklenemedi'}`)
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Bullets List */}
                    <div className="md:col-span-2 bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-gray-700">Öne Çıkan Madde & Avantajlar</label>
                        <button
                          type="button"
                          onClick={() => {
                            const newBullets = [...(story.bullets || []), '']
                            setStories(stories.map((s) => (s.id === story.id ? { ...s, bullets: newBullets } : s)))
                          }}
                          className="text-[11px] font-bold text-primary-600 hover:text-primary-700"
                        >
                          + Madde Ekle
                        </button>
                      </div>

                      {(story.bullets || []).map((bullet, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={bullet}
                            onChange={(e) => {
                              const val = e.target.value
                              const updated = [...(story.bullets || [])]
                              updated[bIdx] = val
                              setStories(stories.map((s) => (s.id === story.id ? { ...s, bullets: updated } : s)))
                            }}
                            className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs"
                            placeholder="Madde metni..."
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (story.bullets || []).filter((_, i) => i !== bIdx)
                              setStories(stories.map((s) => (s.id === story.id ? { ...s, bullets: updated } : s)))
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 2. HERO SECTION TAB */}
        {activeTab === 'hero' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Hero / Ana Karşılama Bölümü</h2>
                <p className="text-xs text-gray-500 mt-0.5">Sitenin en üstündeki ana karşılama başlığı ve metinleri</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('hero', hero)}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
              >
                {saveSuccess === 'hero' ? <FiCheck className="w-4 h-4" /> : <FiSave className="w-4 h-4" />}
                <span>{saving ? 'Kaydediliyor...' : saveSuccess === 'hero' ? 'Kaydedildi!' : 'Hero Kaydet'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Üst Rozet</label>
                <input
                  type="text"
                  value={hero.badge}
                  onChange={(e) => setHero({ ...hero, badge: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Ana Başlık (İlk Kısım)</label>
                <input
                  type="text"
                  value={hero.title}
                  onChange={(e) => setHero({ ...hero, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Vurgulu Başlık (Renkli Kısım)</label>
                <input
                  type="text"
                  value={hero.titleHighlight}
                  onChange={(e) => setHero({ ...hero, titleHighlight: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Birincil Buton Metni</label>
                <input
                  type="text"
                  value={hero.primaryButtonText}
                  onChange={(e) => setHero({ ...hero, primaryButtonText: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Açıklama Metni</label>
                <textarea
                  rows={3}
                  value={hero.description}
                  onChange={(e) => setHero({ ...hero, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">İkincil Buton Metni</label>
                <input
                  type="text"
                  value={hero.secondaryButtonText}
                  onChange={(e) => setHero({ ...hero, secondaryButtonText: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Güven Rozeti 1</label>
                <input
                  type="text"
                  value={hero.pill1}
                  onChange={(e) => setHero({ ...hero, pill1: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Güven Rozeti 2</label>
                <input
                  type="text"
                  value={hero.pill2}
                  onChange={(e) => setHero({ ...hero, pill2: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Güven Rozeti 3</label>
                <input
                  type="text"
                  value={hero.pill3}
                  onChange={(e) => setHero({ ...hero, pill3: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. UNLIMITED CATEGORY CARDS TAB */}
        {activeTab === 'categories' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Kategori Seçim Kartları</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ana sayfadaki seçim kartları (sınırsız eklenebilir)</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    addItem(categoryCards, setCategoryCards, {
                      badge: 'Yeni Seri',
                      title: 'YENİ KATEGORİ BAŞLIĞI',
                      description: 'Kategori tanıtım ve kullanım açıklaması.',
                      bullets: ['Özellik 1', 'Özellik 2', 'Özellik 3'],
                      ctaText: 'Koleksiyonu İncele',
                      ctaUrl: '/urunler',
                    })
                  }
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-xl text-xs font-bold transition-all"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>+ Yeni Kart Ekle</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSaveSection('categoryChoice', {
                      ...categoryChoiceHeader,
                      items: categoryCards,
                    })
                  }
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {saveSuccess === 'categoryChoice' ? <FiCheck className="w-4 h-4" /> : <FiSave className="w-4 h-4" />}
                  <span>{saving ? 'Kaydediliyor...' : saveSuccess === 'categoryChoice' ? 'Kaydedildi!' : 'Kartları Kaydet'}</span>
                </button>
              </div>
            </div>

            {/* Header info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bölüm Üst Rozeti</label>
                <input
                  type="text"
                  value={categoryChoiceHeader.sectionBadge}
                  onChange={(e) => setCategoryChoiceHeader({ ...categoryChoiceHeader, sectionBadge: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Bölüm Ana Başlığı</label>
                <input
                  type="text"
                  value={categoryChoiceHeader.sectionTitle}
                  onChange={(e) => setCategoryChoiceHeader({ ...categoryChoiceHeader, sectionTitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Cards List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {categoryCards.map((card, index) => (
                <div
                  key={card.id}
                  className={`rounded-2xl border p-5 space-y-4 transition-all ${
                    card.active ? 'bg-slate-50 border-slate-200' : 'bg-gray-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between border-b pb-3">
                    <span className="text-xs font-bold text-primary-700">Kart #{index + 1}</span>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => moveItem(categoryCards, setCategoryCards, index, 'up')} disabled={index === 0} className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30">
                        <FiArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => moveItem(categoryCards, setCategoryCards, index, 'down')} disabled={index === categoryCards.length - 1} className="p-1 text-gray-500 hover:text-gray-900 disabled:opacity-30">
                        <FiArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => duplicateItem(categoryCards, setCategoryCards, card.id)} className="p-1 text-primary-600">
                        <FiCopy className="w-3.5 h-3.5" />
                      </button>
                      <button type="button" onClick={() => toggleActive(categoryCards, setCategoryCards, card.id)} className="p-1 text-emerald-600">
                        {card.active ? <FiEye className="w-3.5 h-3.5" /> : <FiEyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button type="button" onClick={() => deleteItem(categoryCards, setCategoryCards, card.id)} className="p-1 text-red-500">
                        <FiTrash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Kart Rozeti</label>
                    <input
                      type="text"
                      value={card.badge || ''}
                      onChange={(e) => setCategoryCards(categoryCards.map((c) => (c.id === card.id ? { ...c, badge: e.target.value } : c)))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Kart Başlığı</label>
                    <input
                      type="text"
                      value={card.title}
                      onChange={(e) => setCategoryCards(categoryCards.map((c) => (c.id === card.id ? { ...c, title: e.target.value } : c)))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Açıklama</label>
                    <textarea
                      rows={2}
                      value={card.description || ''}
                      onChange={(e) => setCategoryCards(categoryCards.map((c) => (c.id === card.id ? { ...c, description: e.target.value } : c)))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Buton Metni</label>
                    <input
                      type="text"
                      value={card.ctaText || ''}
                      onChange={(e) => setCategoryCards(categoryCards.map((c) => (c.id === card.id ? { ...c, ctaText: e.target.value } : c)))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. UNLIMITED BENEFITS (WHY GULUMSE) TAB */}
        {activeTab === 'benefits' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Marka Değerleri & Avantajlar (Sınırsız)</h2>
                <p className="text-xs text-gray-500 mt-0.5">Neden Gülümse bölümündeki güven ve avantaj kartları</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    addItem(benefits, setBenefits, {
                      title: 'Yeni Marka Değeri',
                      description: 'Müşteriye güven veren avantaj açıklaması.',
                    })
                  }
                  className="flex items-center gap-2 px-4 py-2.5 bg-primary-50 text-primary-700 hover:bg-primary-100 rounded-xl text-xs font-bold"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>+ Yeni Değer Ekle</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleSaveSection('whyGulumse', {
                      ...benefitsHeader,
                      items: benefits,
                    })
                  }
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm disabled:opacity-50"
                >
                  {saveSuccess === 'whyGulumse' ? <FiCheck className="w-4 h-4" /> : <FiSave className="w-4 h-4" />}
                  <span>{saving ? 'Kaydediliyor...' : saveSuccess === 'whyGulumse' ? 'Kaydedildi!' : 'Değerleri Kaydet'}</span>
                </button>
              </div>
            </div>

            {/* Bölüm Başlık Ayarları */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Üst Rozet</label>
                <input
                  type="text"
                  value={benefitsHeader.badge || ''}
                  onChange={(e) => setBenefitsHeader({ ...benefitsHeader, badge: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold"
                  placeholder="GÜLÜMSE FARKI"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Ana Başlık</label>
                <input
                  type="text"
                  value={benefitsHeader.title || ''}
                  onChange={(e) => setBenefitsHeader({ ...benefitsHeader, title: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold"
                  placeholder="5 Temel Marka Değeri."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Alt Açıklama</label>
                <input
                  type="text"
                  value={benefitsHeader.subtitle || ''}
                  onChange={(e) => setBenefitsHeader({ ...benefitsHeader, subtitle: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                  placeholder="Açıklama metni..."
                />
              </div>
            </div>

            <div className="space-y-4">
              {benefits.map((b, index) => (
                <div key={b.id} className="grid grid-cols-1 sm:grid-cols-12 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 items-center">
                  <div className="sm:col-span-1 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary-600 bg-primary-50 px-2.5 py-1 rounded-lg">
                      #{index + 1}
                    </span>
                  </div>
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      value={b.title}
                      onChange={(e) => setBenefits(benefits.map((item) => (item.id === b.id ? { ...item, title: e.target.value } : item)))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold"
                      placeholder="Değer Başlığı"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <input
                      type="text"
                      value={b.description || ''}
                      onChange={(e) => setBenefits(benefits.map((item) => (item.id === b.id ? { ...item, description: e.target.value } : item)))}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm"
                      placeholder="Açıklama metni..."
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center justify-end gap-1">
                    <button type="button" onClick={() => moveItem(benefits, setBenefits, index, 'up')} disabled={index === 0} className="p-1 text-gray-500 disabled:opacity-30">
                      <FiArrowUp className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => moveItem(benefits, setBenefits, index, 'down')} disabled={index === benefits.length - 1} className="p-1 text-gray-500 disabled:opacity-30">
                      <FiArrowDown className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => duplicateItem(benefits, setBenefits, b.id)} className="p-1 text-primary-600">
                      <FiCopy className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => deleteItem(benefits, setBenefits, b.id)} className="p-1 text-red-500">
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. PRODUCT SHOWCASE */}
        {activeTab === 'productShowcase' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Öne Çıkan Ürünler Başlıkları</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ürün ızgarasının üstündeki başlık ve buton ayarları</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('productShowcase', productShowcase)}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {saveSuccess === 'productShowcase' ? <FiCheck className="w-4 h-4" /> : <FiSave className="w-4 h-4" />}
                <span>Vitrini Kaydet</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Üst Rozet</label>
                <input
                  type="text"
                  value={productShowcase.badge}
                  onChange={(e) => setProductShowcase({ ...productShowcase, badge: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Ana Başlık</label>
                <input
                  type="text"
                  value={productShowcase.title}
                  onChange={(e) => setProductShowcase({ ...productShowcase, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Tüm Ürünler Butonu</label>
                <input
                  type="text"
                  value={productShowcase.buttonText}
                  onChange={(e) => setProductShowcase({ ...productShowcase, buttonText: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* 6. CTA TAB */}
        {activeTab === 'cta' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Eylem Çağrısı (CTA) Bölümü</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ana sayfanın en altındaki büyük satın alma banner'ı</p>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSection('cta', cta)}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                {saveSuccess === 'cta' ? <FiCheck className="w-4 h-4" /> : <FiSave className="w-4 h-4" />}
                <span>CTA Kaydet</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Rozet</label>
                <input
                  type="text"
                  value={cta.badge}
                  onChange={(e) => setCta({ ...cta, badge: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Ana Başlık</label>
                <input
                  type="text"
                  value={cta.title}
                  onChange={(e) => setCta({ ...cta, title: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Vurgulanan Başlık</label>
                <input
                  type="text"
                  value={cta.titleHighlight}
                  onChange={(e) => setCta({ ...cta, titleHighlight: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Birincil Buton Metni</label>
                <input
                  type="text"
                  value={cta.primaryButtonText}
                  onChange={(e) => setCta({ ...cta, primaryButtonText: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Açıklama Metni</label>
                <textarea
                  rows={2}
                  value={cta.description}
                  onChange={(e) => setCta({ ...cta, description: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 7. ABOUT, FAQ, SHIPPING, RETURN, CONTACT TABS */}
        {activeTab === 'about' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Hakkımızda Sayfası</h2>
              <button type="button" onClick={() => handleSaveSection('about', about)} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold">Kaydet</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Başlık</label>
                <input type="text" value={about.title} onChange={(e) => setAbout({ ...about, title: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Hikaye Başlığı</label>
                <input type="text" value={about.storyTitle} onChange={(e) => setAbout({ ...about, storyTitle: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Açıklama</label>
                <textarea rows={4} value={about.storyParagraphs?.[0] || ''} onChange={(e) => setAbout({ ...about, storyParagraphs: [e.target.value] })} className="w-full px-4 py-2.5 border rounded-xl text-sm resize-none" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'faq' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Sıkça Sorulan Sorular</h2>
              <button type="button" onClick={() => handleSaveSection('faq', faq)} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold">Kaydet</button>
            </div>
            <div className="space-y-4">
              {faq.items.map((item, idx) => (
                <div key={idx} className="p-4 bg-gray-50 border rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-500">Soru #{idx + 1}</span>
                    <button type="button" onClick={() => setFaq({ ...faq, items: faq.items.filter((_, i) => i !== idx) })} className="text-red-500 text-xs">Sil</button>
                  </div>
                  <input type="text" value={item.question} onChange={(e) => {
                    const up = [...faq.items]
                    up[idx].question = e.target.value
                    setFaq({ ...faq, items: up })
                  }} className="w-full px-3 py-2 bg-white border rounded-lg text-sm font-semibold" />
                  <textarea rows={2} value={item.answer} onChange={(e) => {
                    const up = [...faq.items]
                    up[idx].answer = e.target.value
                    setFaq({ ...faq, items: up })
                  }} className="w-full px-3 py-2 bg-white border rounded-lg text-sm resize-none" />
                </div>
              ))}
              <button type="button" onClick={() => setFaq({ ...faq, items: [...faq.items, { question: '', answer: '' }] })} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-xs font-bold">+ Yeni Soru Ekle</button>
            </div>
          </div>
        )}

        {activeTab === 'shipping' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Kargo & Teslimat</h2>
              <button type="button" onClick={() => handleSaveSection('shipping', shipping)} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold">Kaydet</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Sabit Kargo Ücreti (₺)</label>
                <input type="number" value={shipping.shippingFee} onChange={(e) => setShipping({ ...shipping, shippingFee: parseFloat(e.target.value) || 0 })} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Teslimat Süresi</label>
                <input type="text" value={shipping.deliveryTime} onChange={(e) => setShipping({ ...shipping, deliveryTime: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'return' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">İade & Değişim</h2>
              <button type="button" onClick={() => handleSaveSection('return', returnPolicy)} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold">Kaydet</button>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">İade Bilgilendirme Metni</label>
              <textarea rows={5} value={returnPolicy.content} onChange={(e) => setReturnPolicy({ ...returnPolicy, content: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl text-sm resize-none" />
            </div>
          </div>
        )}

        {activeTab === 'contact' && (
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">İletişim Bilgileri</h2>
              <button type="button" onClick={() => handleSaveSection('contact', contact)} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-xs font-bold">Kaydet</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Telefon</label>
                <input type="text" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">E-posta</label>
                <input type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Adres</label>
                <input type="text" value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Çalışma Saatleri</label>
                <input type="text" value={contact.workingHours} onChange={(e) => setContact({ ...contact, workingHours: e.target.value })} className="w-full px-4 py-2.5 border rounded-xl text-sm" />
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Showcase Product Picker Modal */}
      <ShowcaseProductPickerModal
        isOpen={showcasePickerOpen}
        onClose={() => setShowcasePickerOpen(false)}
        sideTitle={showcasePickerSide === 'left' ? 'Sol Alan (Otomatik) İçin Ürün Seç' : 'Sağ Alan (Kullan At) İçin Ürün Seç'}
        alreadySelectedProductIds={(showcase[showcasePickerSide]?.items || []).map((i) => i.productId)}
        onSelect={(product) => addProductToShowcase(showcasePickerSide, product)}
      />

      {/* Global Media Picker Modal */}
      <MediaPickerModal
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={(url) => {
          if (mediaPickerTarget) mediaPickerTarget(url)
        }}
      />
    </div>
  )
}
