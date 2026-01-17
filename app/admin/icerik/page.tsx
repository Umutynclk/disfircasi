'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FiSave, FiPlus, FiTrash2, FiEdit, FiImage, FiX } from 'react-icons/fi'
import { uploadImage } from '@/lib/firebase/storage'

interface HeroContent {
  badge: string
  title: string
  titleHighlight: string
  description: string
  primaryButton: string
  secondaryButton: string
  image?: string
  images?: string[] // Çoklu görseller için
  video?: string // Video için
  sliderInterval?: number // Slider geçiş süresi (saniye)
}

interface Feature {
  id: string
  icon: string
  title: string
  description: string
  color: string
}

interface Benefit {
  title: string
  description: string
  benefits: string[]
  image?: string
}

interface SiteContent {
  hero: HeroContent
  features: Feature[]
  benefits: Benefit
  cta: {
    ctaTitle: string
    ctaDescription: string
    ctaPrimaryButton: string
    ctaSecondaryButton: string
  }
}

export default function ContentManagementPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'hero' | 'features' | 'benefits' | 'cta' | 'about' | 'faq' | 'shipping' | 'return' | 'productsMenu' | 'accessories' | 'contact'>('hero')
  
  // Yeni içerik state'leri
  const [aboutContent, setAboutContent] = useState<any>({
    title: '',
    subtitle: '',
    storyTitle: '',
    storyParagraphs: [''],
    storyImage: ''
  })
  
  const [productsMenuContent, setProductsMenuContent] = useState<any>({
    sections: []
  })
  
  const [accessoriesContent, setAccessoriesContent] = useState<any>({
    title: 'Yedek Fırça Başlıkları',
    subtitle: 'Diş fırçanız için uygun yedek başlıklar',
    buttonText: 'Tüm Yedek Başlıkları Görüntüle',
    buttonUrl: '/urunler?kategori=yedek-firca-basliklari'
  })
  
  const [contactContent, setContactContent] = useState<any>({
    title: 'İletişime Geçin',
    subtitle: 'Sorularınız için bize ulaşın',
    phone: '',
    email: '',
    address: '',
    workingHours: '',
    notificationEmail: '' // Mesajların gönderileceği e-posta
  })
  
  const [faqContent, setFaqContent] = useState<any>({
    title: '',
    subtitle: '',
    items: []
  })
  
  const [shippingContent, setShippingContent] = useState<any>({
    title: '',
    subtitle: '',
    sections: [],
    shippingFee: 0 // Kargo ücreti
  })
  
  const [returnContent, setReturnContent] = useState<any>({
    title: '',
    subtitle: '',
    sections: []
  })
  
  const [content, setContent] = useState<SiteContent>({
    hero: {
      badge: '🦷 Premium Diş Bakımı',
      title: 'Gülüşünüzü',
      titleHighlight: 'Parlatın',
      description: 'Modern teknoloji ile donatılmış elektrikli diş fırçaları ile profesyonel seviyede diş bakımı.',
      primaryButton: 'Ürünleri Keşfet',
      secondaryButton: 'Video İzle'
    },
    features: [],
    benefits: {
      title: 'Sağlıklı Gülüşün Sırrı',
      description: 'Elektrikli diş fırçalarımız ile günlük diş bakımınızı bir üst seviyeye taşıyın.',
      benefits: []
    },
    cta: {
      ctaTitle: 'Gülüşünüzü Dönüştürmeye Hazır mısınız?',
      ctaDescription: 'Bugün başlayın ve sağlıklı, parlak bir gülüşün farkını yaşayın',
      ctaPrimaryButton: 'Ürünleri İncele',
      ctaSecondaryButton: 'İletişime Geç'
    }
  })

  useEffect(() => {
    fetchContent()
  }, [])

  const fetchContent = async () => {
    try {
      const db = getFirestoreDB()
      
      // Hero content
      const heroDoc = await getDoc(doc(db, 'siteContent', 'hero'))
      if (heroDoc.exists()) {
        setContent(prev => ({ ...prev, hero: heroDoc.data() as HeroContent }))
      }

      // Features - basitleştirilmiş yapı
      try {
        const featuresDoc = await getDoc(doc(db, 'siteContent', 'features'))
        if (featuresDoc.exists()) {
          const featuresData = featuresDoc.data().items || []
          setContent(prev => ({ ...prev, features: featuresData }))
        }
      } catch (error) {
        console.error('Features fetch error:', error)
      }

      // Benefits
      const benefitsDoc = await getDoc(doc(db, 'siteContent', 'benefits'))
      if (benefitsDoc.exists()) {
        setContent(prev => ({ ...prev, benefits: benefitsDoc.data() as Benefit }))
      }

      // CTA
      const ctaDoc = await getDoc(doc(db, 'siteContent', 'cta'))
      if (ctaDoc.exists()) {
        const ctaData = ctaDoc.data()
        setContent(prev => ({ 
          ...prev, 
          cta: {
            ctaTitle: ctaData.ctaTitle || prev.cta.ctaTitle,
            ctaDescription: ctaData.ctaDescription || prev.cta.ctaDescription,
            ctaPrimaryButton: ctaData.ctaPrimaryButton || prev.cta.ctaPrimaryButton,
            ctaSecondaryButton: ctaData.ctaSecondaryButton || prev.cta.ctaSecondaryButton
          }
        }))
      }
      
      // About
      const aboutDoc = await getDoc(doc(db, 'siteContent', 'about'))
      if (aboutDoc.exists()) {
        setAboutContent(aboutDoc.data())
      }
      
      // FAQ
      const faqDoc = await getDoc(doc(db, 'siteContent', 'faq'))
      if (faqDoc.exists()) {
        setFaqContent(faqDoc.data())
      }
      
      // Shipping
      const shippingDoc = await getDoc(doc(db, 'siteContent', 'shipping'))
      if (shippingDoc.exists()) {
        setShippingContent(shippingDoc.data())
      }
      
      // Return
      const returnDoc = await getDoc(doc(db, 'siteContent', 'return'))
      if (returnDoc.exists()) {
        setReturnContent(returnDoc.data())
      }
      
      // Menu
      // Products Menu
      const productsMenuDoc = await getDoc(doc(db, 'siteContent', 'productsMenu'))
      if (productsMenuDoc.exists()) {
        setProductsMenuContent(productsMenuDoc.data())
      }
      
      // Accessories
      const accessoriesDoc = await getDoc(doc(db, 'siteContent', 'accessories'))
      if (accessoriesDoc.exists()) {
        setAccessoriesContent(accessoriesDoc.data())
      }
      
      // Contact
      const contactDoc = await getDoc(doc(db, 'siteContent', 'contact'))
      if (contactDoc.exists()) {
        setContactContent(contactDoc.data())
      }
    } catch (error) {
      console.error('Content fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (section: 'hero' | 'benefits' | 'cta' | 'features' | 'about' | 'faq' | 'shipping' | 'return' | 'productsMenu' | 'accessories' | 'contact') => {
    setSaving(true)
    try {
      const db = getFirestoreDB()
      
      if (section === 'hero') {
        const contentRef = doc(db, 'siteContent', 'hero')
        const dataToSave = {
          ...content.hero,
          updatedAt: new Date().toISOString()
        }
        await setDoc(contentRef, dataToSave, { merge: true })
        console.log('✅ Hero content saved to Firebase:', dataToSave)
      } else if (section === 'benefits') {
        const contentRef = doc(db, 'siteContent', 'benefits')
        const dataToSave = {
          ...content.benefits,
          updatedAt: new Date().toISOString()
        }
        await setDoc(contentRef, dataToSave, { merge: true })
        console.log('✅ Benefits content saved to Firebase:', dataToSave)
      } else if (section === 'cta') {
        const contentRef = doc(db, 'siteContent', 'cta')
        const dataToSave = {
          ...content.cta,
          updatedAt: new Date().toISOString()
        }
        await setDoc(contentRef, dataToSave, { merge: true })
        console.log('✅ CTA content saved to Firebase:', dataToSave)
      } else if (section === 'features') {
        const contentRef = doc(db, 'siteContent', 'features')
        const dataToSave = {
          items: content.features,
          updatedAt: new Date().toISOString()
        }
        await setDoc(contentRef, dataToSave, { merge: true })
        console.log('✅ Features content saved to Firebase:', dataToSave)
      }
      
      // Firebase'e kayıt başarılı olduğunu doğrula
      const verifyRef = doc(db, 'siteContent', section === 'features' ? 'features' : section)
      const verifyDoc = await getDoc(verifyRef)
      if (verifyDoc.exists()) {
        console.log('✅ Firebase verification successful:', verifyDoc.data())
      }
      
      // Yeni sayfalar için kayıt
      if (section === 'about') {
        const contentRef = doc(db, 'siteContent', 'about')
        await setDoc(contentRef, { ...aboutContent, updatedAt: new Date().toISOString() }, { merge: true })
        console.log('✅ About content saved')
      } else if (section === 'faq') {
        const contentRef = doc(db, 'siteContent', 'faq')
        await setDoc(contentRef, { ...faqContent, updatedAt: new Date().toISOString() }, { merge: true })
        console.log('✅ FAQ content saved')
      } else if (section === 'shipping') {
        const contentRef = doc(db, 'siteContent', 'shipping')
        await setDoc(contentRef, { ...shippingContent, updatedAt: new Date().toISOString() }, { merge: true })
        console.log('✅ Shipping content saved')
      } else if (section === 'return') {
        const contentRef = doc(db, 'siteContent', 'return')
        await setDoc(contentRef, { ...returnContent, updatedAt: new Date().toISOString() }, { merge: true })
        console.log('✅ Return content saved')
      } else if (section === 'productsMenu') {
        const contentRef = doc(db, 'siteContent', 'productsMenu')
        await setDoc(contentRef, { ...productsMenuContent, updatedAt: new Date().toISOString() }, { merge: true })
        console.log('✅ Products menu content saved')
      } else if (section === 'accessories') {
        const contentRef = doc(db, 'siteContent', 'accessories')
        await setDoc(contentRef, { ...accessoriesContent, updatedAt: new Date().toISOString() }, { merge: true })
        console.log('✅ Accessories content saved')
      } else if (section === 'contact') {
        const contentRef = doc(db, 'siteContent', 'contact')
        await setDoc(contentRef, { ...contactContent, updatedAt: new Date().toISOString() }, { merge: true })
        console.log('✅ Contact content saved')
      }
      
      // Broadcast mesajı gönder (diğer sekmelerdeki sayfalar için)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('contentUpdated', { detail: section }))
      }
      
      alert('✅ İçerik başarıyla Firebase\'e kaydedildi! Sayfa otomatik güncellenecek.')
    } catch (error: any) {
      console.error('❌ Content save error:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      alert(`❌ İçerik kaydedilirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Site İçerik Yönetimi</h1>
          <p className="text-gray-600">Ana sayfa ve diğer sayfaların içeriklerini yönetin</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {(['hero', 'features', 'benefits', 'cta', 'about', 'faq', 'shipping', 'return', 'productsMenu', 'accessories', 'contact'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 font-semibold transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab === 'hero' && 'Hero Bölümü'}
                {tab === 'features' && 'Özellikler'}
                {tab === 'benefits' && 'Avantajlar'}
                {tab === 'cta' && 'Eylem Çağrısı'}
                {tab === 'about' && 'Hakkımızda'}
                {tab === 'faq' && 'SSS'}
                {tab === 'shipping' && 'Kargo'}
                {tab === 'return' && 'İade'}
                {tab === 'productsMenu' && 'Ürünler Menüsü'}
                {tab === 'accessories' && 'Yedek Fırçalar'}
                {tab === 'contact' && 'İletişim Bilgileri'}
              </button>
            ))}
          </div>

          {/* Hero Content */}
          {activeTab === 'hero' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Hero Bölümü İçeriği</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Badge / Etiket
                  </label>
                  <input
                    type="text"
                    value={content.hero.badge}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      hero: { ...prev.hero, badge: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="🦷 Premium Diş Bakımı"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlık (İlk Kısım)
                  </label>
                  <input
                    type="text"
                    value={content.hero.title}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      hero: { ...prev.hero, title: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlık (Vurgulanan Kısım)
                  </label>
                  <input
                    type="text"
                    value={content.hero.titleHighlight}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      hero: { ...prev.hero, titleHighlight: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    rows={3}
                    value={content.hero.description}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      hero: { ...prev.hero, description: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Birincil Buton Metni
                  </label>
                  <input
                    type="text"
                    value={content.hero.primaryButton}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      hero: { ...prev.hero, primaryButton: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    İkincil Buton Metni
                  </label>
                  <input
                    type="text"
                    value={content.hero.secondaryButton}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      hero: { ...prev.hero, secondaryButton: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Slider Geçiş Süresi (Saniye)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={content.hero.sliderInterval || 5}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      hero: { ...prev.hero, sliderInterval: parseInt(e.target.value) || 5 }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="5"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    Çoklu görseller arasındaki geçiş süresi (1-30 saniye arası). Varsayılan: 5 saniye
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hero Video (Video İzle butonu için)
                  </label>
                  <div className="space-y-4">
                    {content.hero.video && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200">
                        <video
                          src={content.hero.video}
                          className="w-full h-full object-cover"
                          controls
                        />
                        <button
                          onClick={() => setContent(prev => ({
                            ...prev,
                            hero: { ...prev.hero, video: '' }
                          }))}
                          className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        try {
                          setSaving(true)
                          const { uploadVideo } = await import('@/lib/firebase/storage')
                          const url = await uploadVideo(file, 'hero')
                          
                          setContent(prev => ({
                            ...prev,
                            hero: { ...prev.hero, video: url }
                          }))
                          alert('Video başarıyla yüklendi!')
                        } catch (error: any) {
                          console.error('Video yükleme hatası:', error)
                          alert(`Video yüklenirken hata: ${error.message || 'Bilinmeyen hata'}`)
                        } finally {
                          setSaving(false)
                        }
                        
                        e.target.value = ''
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                      disabled={saving}
                    />
                    <p className="text-sm text-gray-500">
                      Video yükleyebilirsiniz (MP4, WebM)
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hero Görselleri (Çoklu Fotoğraf/Video - Slider için)
                  </label>
                  <div className="space-y-4">
                    {content.hero.images && content.hero.images.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {content.hero.images.map((img, index) => (
                          <div key={index} className="relative w-full h-32 rounded-lg overflow-hidden border-2 border-gray-200">
                            {img.endsWith('.mp4') || img.endsWith('.webm') || img.includes('video') || (img.includes('firebasestorage') && img.includes('videos')) ? (
                              <video
                                src={img}
                                className="w-full h-full object-cover"
                                muted
                              />
                            ) : (
                              <img
                                src={img}
                                alt={`Hero ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            )}
                            <button
                              onClick={() => {
                                const newImages = content.hero.images?.filter((_, i) => i !== index) || []
                                setContent(prev => ({
                                  ...prev,
                                  hero: { ...prev.hero, images: newImages }
                                }))
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files || [])
                        if (files.length === 0) return
                        
                        try {
                          setSaving(true)
                          const { uploadImage, uploadVideo } = await import('@/lib/firebase/storage')
                          const uploadPromises = files.map(async (file) => {
                            if (file.type.startsWith('image/')) {
                              return await uploadImage(file, 'hero')
                            } else if (file.type.startsWith('video/')) {
                              return await uploadVideo(file, 'hero')
                            }
                            return ''
                          })
                          
                          const urls = await Promise.all(uploadPromises)
                          const validUrls = urls.filter(url => url !== '')
                          
                          setContent(prev => ({
                            ...prev,
                            hero: { 
                              ...prev.hero, 
                              images: [...(prev.hero.images || []), ...validUrls]
                            }
                          }))
                          alert(`${validUrls.length} görsel/video başarıyla yüklendi!`)
                        } catch (error: any) {
                          console.error('Görsel yükleme hatası:', error)
                          alert(`Görsel yüklenirken hata: ${error.message || 'Bilinmeyen hata'}`)
                        } finally {
                          setSaving(false)
                        }
                        
                        e.target.value = ''
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                      disabled={saving}
                    />
                    <p className="text-sm text-gray-500">
                      Birden fazla fotoğraf veya video yükleyebilirsiniz (JPG, PNG, GIF, MP4, WebM). Slider olarak gösterilecektir.
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hero Görseli (Tek Görsel - Eski Yöntem - Opsiyonel)
                  </label>
                  <div className="space-y-4">
                    {content.hero.image && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200">
                        <img
                          src={content.hero.image}
                          alt="Hero"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => setContent(prev => ({
                            ...prev,
                            hero: { ...prev.hero, image: '' }
                          }))}
                          className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        try {
                          setSaving(true)
                          const { uploadImage } = await import('@/lib/firebase/storage')
                          const url = await uploadImage(file, 'hero')
                          
                          setContent(prev => ({
                            ...prev,
                            hero: { ...prev.hero, image: url }
                          }))
                          alert('Görsel başarıyla yüklendi!')
                        } catch (error: any) {
                          console.error('Görsel yükleme hatası:', error)
                          alert(`Görsel yüklenirken hata: ${error.message || 'Bilinmeyen hata'}`)
                        } finally {
                          setSaving(false)
                        }
                        
                        e.target.value = ''
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                      disabled={saving}
                    />
                    <p className="text-sm text-gray-500">
                      Tek bir fotoğraf yükleyebilirsiniz (JPG, PNG, GIF). Çoklu görseller için yukarıdaki alanı kullanın.
                    </p>
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => handleSave('hero')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Hero İçeriğini Kaydet'}
              </motion.button>
            </div>
          )}

          {/* Benefits Content */}
          {activeTab === 'benefits' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Avantajlar Bölümü</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlık
                  </label>
                  <input
                    type="text"
                    value={content.benefits.title}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      benefits: { ...prev.benefits, title: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    rows={4}
                    value={content.benefits.description}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      benefits: { ...prev.benefits, description: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Avantajlar Görseli/Video/Animasyon
                  </label>
                  <div className="space-y-4">
                    {content.benefits.image && (
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border-2 border-gray-200">
                        {content.benefits.image.endsWith('.mp4') || content.benefits.image.endsWith('.webm') || content.benefits.image.includes('video') || (content.benefits.image.includes('firebasestorage') && content.benefits.image.includes('videos')) ? (
                          <video
                            src={content.benefits.image}
                            className="w-full h-full object-cover"
                            controls
                          />
                        ) : (
                          <img
                            src={content.benefits.image}
                            alt="Benefits"
                            className="w-full h-full object-cover"
                          />
                        )}
                        <button
                          onClick={() => setContent(prev => ({
                            ...prev,
                            benefits: { ...prev.benefits, image: '' }
                          }))}
                          className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        try {
                          setSaving(true)
                          const { uploadImage, uploadVideo } = await import('@/lib/firebase/storage')
                          let url = ''
                          
                          if (file.type.startsWith('image/')) {
                            url = await uploadImage(file, 'benefits')
                          } else if (file.type.startsWith('video/')) {
                            url = await uploadVideo(file, 'benefits')
                          }
                          
                          setContent(prev => ({
                            ...prev,
                            benefits: { ...prev.benefits, image: url }
                          }))
                          alert('Görsel/Video başarıyla yüklendi!')
                        } catch (error: any) {
                          console.error('Görsel yükleme hatası:', error)
                          alert(`Görsel/Video yüklenirken hata: ${error.message || 'Bilinmeyen hata'}`)
                        } finally {
                          setSaving(false)
                        }
                        
                        // Reset input
                        e.target.value = ''
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                      disabled={saving}
                    />
                    <p className="text-sm text-gray-500">
                      Fotoğraf, video veya animasyon yükleyebilirsiniz (JPG, PNG, GIF, MP4, WebM)
                    </p>
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => handleSave('benefits')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}

          {/* Features Content */}
          {activeTab === 'features' && (
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Özellikler</h2>
                <button
                  onClick={() => {
                    const newFeature: Feature = {
                      id: Date.now().toString(),
                      icon: 'FiZap',
                      title: 'Yeni Özellik',
                      description: 'Özellik açıklaması',
                      color: 'from-primary-400 to-primary-500'
                    }
                    setContent(prev => ({
                      ...prev,
                      features: [...prev.features, newFeature]
                    }))
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Özellik Ekle
                </button>
              </div>

              <div className="space-y-4">
                {content.features.map((feature, index) => (
                  <div key={feature.id || index} className="border border-gray-200 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Başlık
                        </label>
                        <input
                          type="text"
                          value={feature.title}
                          onChange={(e) => {
                            const updated = [...content.features]
                            updated[index] = { ...updated[index], title: e.target.value }
                            setContent(prev => ({ ...prev, features: updated }))
                          }}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Açıklama
                        </label>
                        <input
                          type="text"
                          value={feature.description}
                          onChange={(e) => {
                            const updated = [...content.features]
                            updated[index] = { ...updated[index], description: e.target.value }
                            setContent(prev => ({ ...prev, features: updated }))
                          }}
                          className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setContent(prev => ({
                            ...prev,
                            features: prev.features.filter((_, i) => i !== index)
                          }))
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <motion.button
                onClick={() => handleSave('features')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Özellikleri Kaydet'}
              </motion.button>
            </div>
          )}

          {/* Benefits Content */}
          {activeTab === 'benefits' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Avantajlar Bölümü</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlık
                  </label>
                  <input
                    type="text"
                    value={content.benefits.title}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      benefits: { ...prev.benefits, title: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    rows={4}
                    value={content.benefits.description}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      benefits: { ...prev.benefits, description: e.target.value }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <motion.button
                onClick={() => handleSave('benefits')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}

          {/* CTA Content */}
          {activeTab === 'cta' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Eylem Çağrısı Bölümü</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Başlık
                  </label>
                  <input
                    type="text"
                    value={content.cta.ctaTitle}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      cta: { 
                        ...prev.cta,
                        ctaTitle: e.target.value
                      }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Açıklama
                  </label>
                  <textarea
                    rows={3}
                    value={content.cta.ctaDescription}
                    onChange={(e) => setContent(prev => ({
                      ...prev,
                      cta: { 
                        ...prev.cta,
                        ctaDescription: e.target.value
                      }
                    }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Birincil Buton
                    </label>
                    <input
                      type="text"
                      value={content.cta.ctaPrimaryButton}
                      onChange={(e) => setContent(prev => ({
                        ...prev,
                        cta: { 
                          ...prev.cta,
                          ctaPrimaryButton: e.target.value
                        }
                      }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      İkincil Buton
                    </label>
                    <input
                      type="text"
                      value={content.cta.ctaSecondaryButton}
                      onChange={(e) => setContent(prev => ({
                        ...prev,
                        cta: { 
                          ...prev.cta,
                          ctaSecondaryButton: e.target.value
                        }
                      }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => handleSave('cta')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}

          {/* About Content */}
          {activeTab === 'about' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Hakkımızda Sayfası</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                  <input
                    type="text"
                    value={aboutContent.title || ''}
                    onChange={(e) => setAboutContent({ ...aboutContent, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alt Başlık</label>
                  <textarea
                    rows={2}
                    value={aboutContent.subtitle || ''}
                    onChange={(e) => setAboutContent({ ...aboutContent, subtitle: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hikaye Başlığı</label>
                  <input
                    type="text"
                    value={aboutContent.storyTitle || ''}
                    onChange={(e) => setAboutContent({ ...aboutContent, storyTitle: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hikaye Paragrafları (Her satır bir paragraf)</label>
                  <textarea
                    rows={5}
                    value={aboutContent.storyParagraphs?.join('\n') || ''}
                    onChange={(e) => setAboutContent({ ...aboutContent, storyParagraphs: e.target.value.split('\n').filter(p => p.trim()) })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="Her satır bir paragraf olacak şekilde yazın"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Hikaye Görseli</label>
                  {aboutContent.storyImage ? (
                    <div className="relative mb-2">
                      <img src={aboutContent.storyImage} alt="Hikaye görseli" className="w-full h-48 object-cover rounded-lg border-2 border-gray-200" />
                      <button
                        type="button"
                        onClick={() => setAboutContent({ ...aboutContent, storyImage: '' })}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                  ) : null}
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 transition-colors">
                    <FiImage className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Görsel Yükle</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          try {
                            const url = await uploadImage(file, 'about')
                            setAboutContent({ ...aboutContent, storyImage: url })
                          } catch (error) {
                            alert('Görsel yüklenirken hata oluştu')
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              
              <motion.button
                onClick={() => handleSave('about')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}

          {/* FAQ Content */}
          {activeTab === 'faq' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Sık Sorulan Sorular</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                  <input
                    type="text"
                    value={faqContent.title || ''}
                    onChange={(e) => setFaqContent({ ...faqContent, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alt Başlık</label>
                  <input
                    type="text"
                    value={faqContent.subtitle || ''}
                    onChange={(e) => setFaqContent({ ...faqContent, subtitle: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Sorular</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newItems = [...(faqContent.items || []), { question: '', answer: '' }]
                        setFaqContent({ ...faqContent, items: newItems })
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <FiPlus className="w-4 h-4" />
                      Soru Ekle
                    </button>
                  </div>
                  
                  {(faqContent.items || []).map((item: any, index: number) => (
                    <div key={index} className="border-2 border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Soru #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newItems = faqContent.items.filter((_: any, i: number) => i !== index)
                            setFaqContent({ ...faqContent, items: newItems })
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Soru</label>
                        <input
                          type="text"
                          value={item.question || ''}
                          onChange={(e) => {
                            const newItems = [...faqContent.items]
                            newItems[index] = { ...newItems[index], question: e.target.value }
                            setFaqContent({ ...faqContent, items: newItems })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                          placeholder="Soruyu buraya yazın..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Cevap</label>
                        <textarea
                          rows={3}
                          value={item.answer || ''}
                          onChange={(e) => {
                            const newItems = [...faqContent.items]
                            newItems[index] = { ...newItems[index], answer: e.target.value }
                            setFaqContent({ ...faqContent, items: newItems })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                          placeholder="Cevabı buraya yazın..."
                        />
                      </div>
                    </div>
                  ))}
                  
                  {(faqContent.items || []).length === 0 && (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                      <p>Henüz soru eklenmemiş. Yukarıdaki "Soru Ekle" butonuna tıklayın.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <motion.button
                onClick={() => handleSave('faq')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}

          {/* Shipping Content */}
          {activeTab === 'shipping' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Kargo Bilgileri</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                  <input
                    type="text"
                    value={shippingContent.title || ''}
                    onChange={(e) => setShippingContent({ ...shippingContent, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alt Başlık</label>
                  <input
                    type="text"
                    value={shippingContent.subtitle || ''}
                    onChange={(e) => setShippingContent({ ...shippingContent, subtitle: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>
                
                <div className="bg-primary-50 border-2 border-primary-200 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kargo Ücreti (₺) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={shippingContent.shippingFee || 0}
                    onChange={(e) => setShippingContent({ ...shippingContent, shippingFee: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="0"
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    Satın al sayfasında gösterilecek kargo ücreti. 0 girerseniz "Ücretsiz Kargo" olarak gösterilir.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Bölümler</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newSections = [...(shippingContent.sections || []), { title: '', content: '', image: '' }]
                        setShippingContent({ ...shippingContent, sections: newSections })
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <FiPlus className="w-4 h-4" />
                      Bölüm Ekle
                    </button>
                  </div>
                  
                  {(shippingContent.sections || []).map((section: any, index: number) => (
                    <div key={index} className="border-2 border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Bölüm #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newSections = shippingContent.sections.filter((_: any, i: number) => i !== index)
                            setShippingContent({ ...shippingContent, sections: newSections })
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bölüm Başlığı</label>
                        <input
                          type="text"
                          value={section.title || ''}
                          onChange={(e) => {
                            const newSections = [...shippingContent.sections]
                            newSections[index] = { ...newSections[index], title: e.target.value }
                            setShippingContent({ ...shippingContent, sections: newSections })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                          placeholder="Bölüm başlığını yazın..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">İçerik</label>
                        <textarea
                          rows={4}
                          value={section.content || ''}
                          onChange={(e) => {
                            const newSections = [...shippingContent.sections]
                            newSections[index] = { ...newSections[index], content: e.target.value }
                            setShippingContent({ ...shippingContent, sections: newSections })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                          placeholder="İçeriği buraya yazın..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Görsel (Opsiyonel)</label>
                        {section.image ? (
                          <div className="relative mb-2">
                            <img src={section.image} alt="Bölüm görseli" className="w-full h-48 object-cover rounded-lg border-2 border-gray-200" />
                            <button
                              type="button"
                              onClick={() => {
                                const newSections = [...shippingContent.sections]
                                newSections[index] = { ...newSections[index], image: '' }
                                setShippingContent({ ...shippingContent, sections: newSections })
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          </div>
                        ) : null}
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 transition-colors">
                          <FiImage className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600">Görsel Yükle</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                try {
                                  const url = await uploadImage(file, 'shipping')
                                  const newSections = [...shippingContent.sections]
                                  newSections[index] = { ...newSections[index], image: url }
                                  setShippingContent({ ...shippingContent, sections: newSections })
                                } catch (error) {
                                  alert('Görsel yüklenirken hata oluştu')
                                }
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  
                  {(shippingContent.sections || []).length === 0 && (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                      <p>Henüz bölüm eklenmemiş. Yukarıdaki "Bölüm Ekle" butonuna tıklayın.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <motion.button
                onClick={() => handleSave('shipping')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}

          {/* Return Content */}
          {activeTab === 'return' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">İade ve Değişim</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                  <input
                    type="text"
                    value={returnContent.title || ''}
                    onChange={(e) => setReturnContent({ ...returnContent, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alt Başlık</label>
                  <input
                    type="text"
                    value={returnContent.subtitle || ''}
                    onChange={(e) => setReturnContent({ ...returnContent, subtitle: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Bölümler</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newSections = [...(returnContent.sections || []), { title: '', content: '', image: '' }]
                        setReturnContent({ ...returnContent, sections: newSections })
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <FiPlus className="w-4 h-4" />
                      Bölüm Ekle
                    </button>
                  </div>
                  
                  {(returnContent.sections || []).map((section: any, index: number) => (
                    <div key={index} className="border-2 border-gray-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Bölüm #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newSections = returnContent.sections.filter((_: any, i: number) => i !== index)
                            setReturnContent({ ...returnContent, sections: newSections })
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Bölüm Başlığı</label>
                        <input
                          type="text"
                          value={section.title || ''}
                          onChange={(e) => {
                            const newSections = [...returnContent.sections]
                            newSections[index] = { ...newSections[index], title: e.target.value }
                            setReturnContent({ ...returnContent, sections: newSections })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                          placeholder="Bölüm başlığını yazın..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">İçerik</label>
                        <textarea
                          rows={4}
                          value={section.content || ''}
                          onChange={(e) => {
                            const newSections = [...returnContent.sections]
                            newSections[index] = { ...newSections[index], content: e.target.value }
                            setReturnContent({ ...returnContent, sections: newSections })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                          placeholder="İçeriği buraya yazın..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Görsel (Opsiyonel)</label>
                        {section.image ? (
                          <div className="relative mb-2">
                            <img src={section.image} alt="Bölüm görseli" className="w-full h-48 object-cover rounded-lg border-2 border-gray-200" />
                            <button
                              type="button"
                              onClick={() => {
                                const newSections = [...returnContent.sections]
                                newSections[index] = { ...newSections[index], image: '' }
                                setReturnContent({ ...returnContent, sections: newSections })
                              }}
                              className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                            >
                              <FiX className="w-4 h-4" />
                            </button>
                          </div>
                        ) : null}
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 transition-colors">
                          <FiImage className="w-8 h-8 text-gray-400 mb-2" />
                          <span className="text-sm text-gray-600">Görsel Yükle</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                try {
                                  const url = await uploadImage(file, 'return')
                                  const newSections = [...returnContent.sections]
                                  newSections[index] = { ...newSections[index], image: url }
                                  setReturnContent({ ...returnContent, sections: newSections })
                                } catch (error) {
                                  alert('Görsel yüklenirken hata oluştu')
                                }
                              }
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  
                  {(returnContent.sections || []).length === 0 && (
                    <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                      <p>Henüz bölüm eklenmemiş. Yukarıdaki "Bölüm Ekle" butonuna tıklayın.</p>
                    </div>
                  )}
                </div>
              </div>
              
              <motion.button
                onClick={() => handleSave('return')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}

          {/* Products Menu Content */}
          {activeTab === 'productsMenu' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Ürünler Menüsü</h2>
              
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Bilgi:</strong> Bu menü navbar'daki "Ürünler" butonunun altında görünecek. Her bölüm için başlık, açıklama ve buton ekleyebilirsiniz.
                  </p>
                </div>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">Menü Bölümleri</label>
                    <button
                      type="button"
                      onClick={() => {
                        const newSections = [...(productsMenuContent.sections || []), { 
                          title: '', 
                          description: '', 
                          buttonText: 'Keşfet',
                          url: '/urunler'
                        }]
                        setProductsMenuContent({ ...productsMenuContent, sections: newSections })
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <FiPlus className="w-4 h-4" />
                      Bölüm Ekle
                    </button>
                  </div>
                  
                  {(productsMenuContent.sections || []).map((section: any, index: number) => (
                    <div key={index} className="border-2 border-gray-200 rounded-lg p-5 space-y-4 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">Bölüm #{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const newSections = productsMenuContent.sections.filter((_: any, i: number) => i !== index)
                            setProductsMenuContent({ ...productsMenuContent, sections: newSections })
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                        <input
                          type="text"
                          value={section.title || ''}
                          onChange={(e) => {
                            const newSections = [...productsMenuContent.sections]
                            newSections[index] = { ...newSections[index], title: e.target.value }
                            setProductsMenuContent({ ...productsMenuContent, sections: newSections })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                          placeholder="Örn: Diş Fırçaları, Yedek Fırça Başlıkları"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Açıklama</label>
                        <textarea
                          rows={3}
                          value={section.description || ''}
                          onChange={(e) => {
                            const newSections = [...productsMenuContent.sections]
                            newSections[index] = { ...newSections[index], description: e.target.value }
                            setProductsMenuContent({ ...productsMenuContent, sections: newSections })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                          placeholder="Bu bölüm için kısa bir açıklama yazın..."
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Buton Metni</label>
                          <input
                            type="text"
                            value={section.buttonText || 'Keşfet'}
                            onChange={(e) => {
                              const newSections = [...productsMenuContent.sections]
                              newSections[index] = { ...newSections[index], buttonText: e.target.value }
                              setProductsMenuContent({ ...productsMenuContent, sections: newSections })
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                            placeholder="Keşfet, İncele, vb."
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Yönlendirme URL</label>
                          <input
                            type="text"
                            value={section.url || '/urunler'}
                            onChange={(e) => {
                              const newSections = [...productsMenuContent.sections]
                              newSections[index] = { ...newSections[index], url: e.target.value }
                              setProductsMenuContent({ ...productsMenuContent, sections: newSections })
                            }}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                            placeholder="/urunler, /urunler?kategori=disfircalari"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(productsMenuContent.sections || []).length === 0 && (
                    <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg">
                      <p className="mb-2">Henüz bölüm eklenmemiş.</p>
                      <p className="text-sm">Yukarıdaki "Bölüm Ekle" butonuna tıklayarak başlayın.</p>
                      <p className="text-xs mt-2 text-gray-400">Örnek: Diş Fırçaları ve Yedek Fırça Başlıkları</p>
                    </div>
                  )}
                </div>
              </div>
              
              <motion.button
                onClick={() => handleSave('productsMenu')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}

          {/* Accessories Content */}
          {activeTab === 'accessories' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">Yedek Fırçalar Bölümü</h2>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Bilgi:</strong> Bu bölüm ana sayfadaki "Yedek Fırça Başlıkları" bölümünün içeriğini yönetir.
                </p>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Başlık</label>
                  <input
                    type="text"
                    value={accessoriesContent.title || ''}
                    onChange={(e) => setAccessoriesContent({ ...accessoriesContent, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="Yedek Fırça Başlıkları"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alt Başlık</label>
                  <textarea
                    rows={3}
                    value={accessoriesContent.subtitle || ''}
                    onChange={(e) => setAccessoriesContent({ ...accessoriesContent, subtitle: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                    placeholder="Diş fırçanız için uygun yedek başlıklar"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Buton Metni</label>
                    <input
                      type="text"
                      value={accessoriesContent.buttonText || ''}
                      onChange={(e) => setAccessoriesContent({ ...accessoriesContent, buttonText: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                      placeholder="Tüm Yedek Başlıkları Görüntüle"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Buton URL</label>
                    <input
                      type="text"
                      value={accessoriesContent.buttonUrl || ''}
                      onChange={(e) => setAccessoriesContent({ ...accessoriesContent, buttonUrl: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                      placeholder="/urunler?kategori=yedek-firca-basliklari"
                    />
                  </div>
                </div>
              </div>
              
              <motion.button
                onClick={() => handleSave('accessories')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}

          {/* Contact Content */}
          {activeTab === 'contact' && (
            <div className="p-6 space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">İletişim Bilgileri</h2>
              <p className="text-sm text-gray-600">Ana sayfadaki iletişim modalında gösterilecek bilgileri buradan yönetebilirsiniz.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Modal Başlığı</label>
                  <input
                    type="text"
                    value={contactContent.title || ''}
                    onChange={(e) => setContactContent({ ...contactContent, title: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="İletişime Geçin"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Alt Başlık</label>
                  <input
                    type="text"
                    value={contactContent.subtitle || ''}
                    onChange={(e) => setContactContent({ ...contactContent, subtitle: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="Sorularınız için bize ulaşın"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Telefon</label>
                  <input
                    type="tel"
                    value={contactContent.phone || ''}
                    onChange={(e) => setContactContent({ ...contactContent, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="+90 (212) 123 45 67"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">E-posta</label>
                  <input
                    type="email"
                    value={contactContent.email || ''}
                    onChange={(e) => setContactContent({ ...contactContent, email: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="info@smilebrush.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Adres</label>
                  <textarea
                    rows={3}
                    value={contactContent.address || ''}
                    onChange={(e) => setContactContent({ ...contactContent, address: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                    placeholder="İstanbul, Türkiye"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Çalışma Saatleri</label>
                  <input
                    type="text"
                    value={contactContent.workingHours || ''}
                    onChange={(e) => setContactContent({ ...contactContent, workingHours: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="Pazartesi - Cuma: 09:00 - 18:00"
                  />
                </div>

                <div className="border-t pt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bildirim E-posta Adresi <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Formdan gönderilen mesajlar bu e-posta adresine bildirim olarak gönderilecektir.
                  </p>
                  <input
                    type="email"
                    required
                    value={contactContent.notificationEmail || ''}
                    onChange={(e) => setContactContent({ ...contactContent, notificationEmail: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                    placeholder="admin@smilebrush.com"
                  />
                </div>
              </div>
              
              <motion.button
                onClick={() => handleSave('contact')}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

