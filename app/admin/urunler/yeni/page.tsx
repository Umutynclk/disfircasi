'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from '@/lib/firebase/auth'
import { collection, addDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { uploadImage, uploadVideo, uploadModel } from '@/lib/firebase/storage'
import { subscribeToCategories, createCategory, Category } from '@/lib/firebase/categories'
import { motion } from 'framer-motion'
import { FiUpload, FiX, FiImage, FiVideo, FiPlus, FiTrash2, FiBox, FiFolderPlus } from 'react-icons/fi'
import MediaPickerModal from '@/components/admin/MediaPickerModal'

export default function NewProductPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCatModal, setShowCatModal] = useState(false)
  const [showMediaModal, setShowMediaModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [newCatDesc, setNewCatDesc] = useState('')
  const [creatingCat, setCreatingCat] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    discountPrice: '',
    discountPercentage: '',
    priceUSD: '',
    discountPriceUSD: '',
    priceEUR: '',
    discountPriceEUR: '',
    description: '',
    category: 'otomatik',
    inStock: true,
    isPopular: false,
    features: [''],
    specifications: {} as Record<string, string>,
  })
  
  const [categories, setCategories] = useState<Category[]>([])
  
  const [images, setImages] = useState<File[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [video, setVideo] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string>('')
  
  interface ColorOption {
    name: string
    code: string
    images: File[]
    imageUrls: string[]
    price?: number
    discountPrice?: number
  }
  
  const [colors, setColors] = useState<ColorOption[]>([])

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser()
      if (!user) {
        router.push('/admin/login')
      } else {
        setLoading(false)
      }
    }
    checkAuth()
    
    // Kategorileri dinamik olarak dinle
    const unsub = subscribeToCategories((cats) => {
      setCategories(cats)
      if (cats.length > 0 && (!formData.category || formData.category === 'otomatik')) {
        setFormData((prev) => ({ ...prev, category: cats[0].slug }))
      }
    })
    return () => unsub()
  }, [router])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setImages([...images, ...files])
  }

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index))
    setImageUrls(imageUrls.filter((_, i) => i !== index))
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setVideo(file)
  }

  const addFeature = () => {
    setFormData({
      ...formData,
      features: [...formData.features, '']
    })
  }

  const updateFeature = (index: number, value: string) => {
    const newFeatures = [...formData.features]
    newFeatures[index] = value
    setFormData({ ...formData, features: newFeatures })
  }

  const removeFeature = (index: number) => {
    setFormData({
      ...formData,
      features: formData.features.filter((_, i) => i !== index)
    })
  }

  const addSpecification = () => {
    const key = prompt('Özellik adı (örn: Model, Ağırlık):')
    if (key) {
      setFormData({
        ...formData,
        specifications: { ...formData.specifications, [key]: '' }
      })
    }
  }

  const updateSpecification = (key: string, value: string) => {
    setFormData({
      ...formData,
      specifications: { ...formData.specifications, [key]: value }
    })
  }

  const removeSpecification = (key: string) => {
    const newSpecs = { ...formData.specifications }
    delete newSpecs[key]
    setFormData({ ...formData, specifications: newSpecs })
  }

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return

    setCreatingCat(true)
    try {
      const slug = newCatName
        .toLowerCase()
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')

      await createCategory({
        name: newCatName.trim(),
        slug: slug || `cat-${Date.now()}`,
        description: newCatDesc.trim(),
        order: categories.length + 1,
        active: true,
      })

      setFormData((prev) => ({ ...prev, category: slug }))
      setNewCatName('')
      setNewCatDesc('')
      setShowCatModal(false)
      alert(`✅ "${newCatName}" kategorisi oluşturuldu ve seçildi!`)
    } catch (err: any) {
      alert(`Kategori oluşturulamadı: ${err.message || 'Hata'}`)
    } finally {
      setCreatingCat(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (!formData.name.trim()) {
        alert('Lütfen ürün adını girin.')
        setSaving(false)
        return
      }

      if (!formData.price || isNaN(parseFloat(formData.price))) {
        alert('Lütfen geçerli bir fiyat girin.')
        setSaving(false)
        return
      }

      // Resimleri yükle
      const uploadedImageUrls: string[] = []
      for (const image of images) {
        const url = await uploadImage(image, 'products')
        uploadedImageUrls.push(url)
      }

      // Videoyu yükle
      let uploadedVideoUrl = ''
      if (video) {
        uploadedVideoUrl = await uploadVideo(video, 'products')
      }
      
      // Renk seçeneklerini yükle
      const uploadedColors = await Promise.all(
        colors.map(async (color) => {
          const colorImages: string[] = []
          for (const image of color.images) {
            const url = await uploadImage(image, `products/colors/${color.code}`)
            colorImages.push(url)
          }
          const colorData: any = {
            name: color.name || '',
            code: color.code || '',
            images: colorImages
          }
          if (color.price !== undefined && color.price !== null && !isNaN(Number(color.price))) {
            colorData.price = Number(color.price)
          }
          if (color.discountPrice !== undefined && color.discountPrice !== null && !isNaN(Number(color.discountPrice))) {
            colorData.discountPrice = Number(color.discountPrice)
          }
          return colorData
        })
      )

      // Firestore'a kaydet - undefined değer içermeyen temiz obje
      const regularPrice = parseFloat(formData.price)
      const discountPriceNum = formData.discountPrice && !isNaN(parseFloat(formData.discountPrice))
        ? parseFloat(formData.discountPrice)
        : null
      const discountPercentageNum = formData.discountPercentage && !isNaN(parseFloat(formData.discountPercentage))
        ? parseFloat(formData.discountPercentage)
        : null

      const productData: any = {
        name: formData.name.trim(),
        price: regularPrice,
        description: formData.description || '',
        category: formData.category || (categories[0]?.slug || 'otomatik'),
        inStock: formData.inStock ?? true,
        isPopular: formData.isPopular ?? false,
        images: uploadedImageUrls,
        image: uploadedImageUrls[0] || '',
        features: formData.features.filter(f => f && f.trim() !== ''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      if (discountPriceNum !== null && discountPriceNum < regularPrice) {
        productData.discountPrice = discountPriceNum
        productData.hasDiscount = true
        if (discountPercentageNum !== null) {
          productData.discountPercentage = discountPercentageNum
        }
      }

      // Opsiyonel Dolar ve Euro Özel Fiyatları
      if (formData.priceUSD && !isNaN(parseFloat(formData.priceUSD))) {
        productData.priceUSD = parseFloat(formData.priceUSD)
      }
      if (formData.discountPriceUSD && !isNaN(parseFloat(formData.discountPriceUSD))) {
        productData.discountPriceUSD = parseFloat(formData.discountPriceUSD)
      }
      if (formData.priceEUR && !isNaN(parseFloat(formData.priceEUR))) {
        productData.priceEUR = parseFloat(formData.priceEUR)
      }
      if (formData.discountPriceEUR && !isNaN(parseFloat(formData.discountPriceEUR))) {
        productData.discountPriceEUR = parseFloat(formData.discountPriceEUR)
      }

      if (uploadedVideoUrl) {
        productData.video = uploadedVideoUrl
      }

      if (uploadedColors.length > 0) {
        productData.colors = uploadedColors
      }

      if (formData.specifications && Object.keys(formData.specifications).length > 0) {
        productData.specifications = formData.specifications
      }

      const db = getFirestoreDB()
      await addDoc(collection(db, 'products'), productData)
      alert('✅ Ürün başarıyla eklendi!')
      router.push('/admin/urunler')
    } catch (error: any) {
      console.error('Ürün kaydedilirken hata:', error)
      alert(`Ürün kaydedilirken hata oluştu: ${error.message || 'Bilinmeyen hata'}`)
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
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8"
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Yeni Ürün Ekle</h1>
            <p className="text-gray-600">Ürün bilgilerini doldurun ve kaydedin</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Temel Bilgiler */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Temel Bilgiler</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ürün Adı *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fiyat (₺) *
                  </label>
                  <input
                    type="number"
                    required
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => {
                      const price = parseFloat(e.target.value) || 0
                      const discountPrice = formData.discountPrice ? parseFloat(formData.discountPrice) : price
                      const discountPercentage = price > 0 && discountPrice < price
                        ? Math.round(((price - discountPrice) / price) * 100)
                        : ''
                      setFormData({ 
                        ...formData, 
                        price: e.target.value,
                        discountPercentage: discountPercentage.toString()
                      })
                    }}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Kategori
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowCatModal(true)}
                      className="text-xs font-bold text-primary-600 hover:text-primary-700 flex items-center gap-1 bg-primary-50 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <FiFolderPlus className="w-3.5 h-3.5" />
                      <span>+ Yeni Kategori</span>
                    </button>
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-primary-600 focus:outline-none"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id || cat.slug} value={cat.slug}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* İndirim Alanları */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold text-orange-900">İndirim Ayarları (TL)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      İndirimli Fiyat (₺)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.discountPrice}
                      onChange={(e) => {
                        const discountPrice = parseFloat(e.target.value) || 0
                        const price = parseFloat(formData.price) || 0
                        const discountPercentage = price > 0 && discountPrice < price
                          ? Math.round(((price - discountPrice) / price) * 100)
                          : ''
                        setFormData({ 
                          ...formData, 
                          discountPrice: e.target.value,
                          discountPercentage: discountPercentage.toString()
                        })
                      }}
                      placeholder="İndirimli fiyat"
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      İndirim Yüzdesi (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      max="100"
                      value={formData.discountPercentage}
                      onChange={(e) => {
                        const discountPercentage = parseFloat(e.target.value) || 0
                        const price = parseFloat(formData.price) || 0
                        const discountPrice = price > 0 && discountPercentage > 0
                          ? (price * (1 - discountPercentage / 100)).toFixed(2)
                          : ''
                        setFormData({ 
                          ...formData, 
                          discountPercentage: e.target.value,
                          discountPrice: discountPrice
                        })
                      }}
                      placeholder="İndirim %"
                      className="w-full px-4 py-3 border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    />
                    {formData.discountPrice && formData.price && (
                      <p className="text-xs text-orange-700 mt-1">
                        {formData.discountPercentage}% indirimle: {parseFloat(formData.discountPrice).toLocaleString('tr-TR')} ₺
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Dolar ($) ve Euro (€) Özel Fiyat Alanları (Opsiyonel) */}
              <div className="bg-sky-50 border border-sky-200 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-sky-950">🌍 Uluslararası Özel Fiyatlandırma (Opsiyonel)</h3>
                  <span className="text-xs text-sky-700 font-medium">Boş bırakılırsa genel kur oranından otomatik çevrilir</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {/* USD ($) */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                      <span>🇺🇸 / 🇬🇧</span>
                      <span>İngilizce Dili için Dolar ($) Fiyatı</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Normal ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.priceUSD}
                          onChange={(e) => setFormData({ ...formData, priceUSD: e.target.value })}
                          placeholder="Örn: 39.99"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">İndirimli ($)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.discountPriceUSD}
                          onChange={(e) => setFormData({ ...formData, discountPriceUSD: e.target.value })}
                          placeholder="Örn: 29.99"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* EUR (€) */}
                  <div className="bg-white p-4 rounded-xl border border-sky-100 space-y-3">
                    <div className="flex items-center gap-2 font-bold text-sm text-slate-800">
                      <span>🇩🇪 / 🇫🇷</span>
                      <span>Almanca & Fransızca için Euro (€) Fiyatı</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Normal (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.priceEUR}
                          onChange={(e) => setFormData({ ...formData, priceEUR: e.target.value })}
                          placeholder="Örn: 34.99"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">İndirimli (€)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.discountPriceEUR}
                          onChange={(e) => setFormData({ ...formData, discountPriceEUR: e.target.value })}
                          placeholder="Örn: 24.99"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-sky-500 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Açıklama *
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="inStock"
                    checked={formData.inStock}
                    onChange={(e) => setFormData({ ...formData, inStock: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="inStock" className="text-sm font-medium text-gray-700">
                    Stokta var
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isPopular"
                    checked={formData.isPopular}
                    onChange={(e) => setFormData({ ...formData, isPopular: e.target.checked })}
                    className="w-4 h-4 text-primary-600 rounded focus:ring-primary-500"
                  />
                  <label htmlFor="isPopular" className="text-sm font-medium text-gray-700">
                    Popüler Ürün
                    <span className="text-xs text-gray-500 ml-2">(Ana sayfada gösterilir)</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Medya */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Medya</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ürün Görselleri
                </label>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {images.map((image, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(image)}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 transition-colors">
                  <FiImage className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-600">Görsel Ekle</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ürün Videosu (Opsiyonel)
                </label>
                {video ? (
                  <div className="relative">
                    <video src={URL.createObjectURL(video)} controls className="w-full rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setVideo(null)}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 transition-colors">
                    <FiVideo className="w-8 h-8 text-gray-400 mb-2" />
                    <span className="text-sm text-gray-600">Video Ekle</span>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleVideoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Renk Seçenekleri */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Renk Seçenekleri</h2>
                <button
                  type="button"
                  onClick={() => {
                    const newColor: ColorOption = {
                      name: '',
                      code: '#000000',
                      images: [],
                      imageUrls: []
                    }
                    setColors([...colors, newColor])
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Renk Ekle
                </button>
              </div>

              {colors.map((color, colorIndex) => (
                <div key={colorIndex} className="border-2 border-gray-200 rounded-lg p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Renk Adı
                      </label>
                      <input
                        type="text"
                        value={color.name}
                        onChange={(e) => {
                          const updated = [...colors]
                          updated[colorIndex] = { ...updated[colorIndex], name: e.target.value }
                          setColors(updated)
                        }}
                        placeholder="Örn: Siyah, Beyaz, Mavi"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Renk Kodu
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={color.code}
                          onChange={(e) => {
                            const updated = [...colors]
                            updated[colorIndex] = { ...updated[colorIndex], code: e.target.value }
                            setColors(updated)
                          }}
                          className="w-16 h-10 border-2 border-gray-200 rounded-lg cursor-pointer"
                        />
                        <input
                          type="text"
                          value={color.code}
                          onChange={(e) => {
                            const updated = [...colors]
                            updated[colorIndex] = { ...updated[colorIndex], code: e.target.value }
                            setColors(updated)
                          }}
                          placeholder="#000000"
                          className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Renk Özel Fiyatı (Opsiyonel)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={color.price || ''}
                        onChange={(e) => {
                          const updated = [...colors]
                          updated[colorIndex] = { ...updated[colorIndex], price: e.target.value ? parseFloat(e.target.value) : undefined }
                          setColors(updated)
                        }}
                        placeholder="Bu renk için özel fiyat"
                        className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Renk Görselleri
                    </label>
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      {color.images.map((img, imgIndex) => (
                        <div key={imgIndex} className="relative group">
                          <img
                            src={URL.createObjectURL(img)}
                            alt={`${color.name} ${imgIndex + 1}`}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...colors]
                              updated[colorIndex].images = updated[colorIndex].images.filter((_, i) => i !== imgIndex)
                              setColors(updated)
                            }}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <FiX className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 transition-colors">
                      <FiImage className="w-6 h-6 text-gray-400 mb-1" />
                      <span className="text-xs text-gray-600">Görsel Ekle</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          const updated = [...colors]
                          updated[colorIndex].images = [...updated[colorIndex].images, ...files]
                          setColors(updated)
                          e.target.value = ''
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setColors(colors.filter((_, i) => i !== colorIndex))
                    }}
                    className="w-full p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
                  >
                    <FiTrash2 className="w-4 h-4 inline mr-2" />
                    Bu Rengi Kaldır
                  </button>
                </div>
              ))}
            </div>

            {/* Özellikler */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Özellikler</h2>
                <button
                  type="button"
                  onClick={addFeature}
                  className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Özellik Ekle
                </button>
              </div>
              
              {formData.features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => updateFeature(index, e.target.value)}
                    placeholder="Özellik açıklaması"
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                  {formData.features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFeature(index)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <FiTrash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Teknik Özellikler */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Teknik Özellikler</h2>
                <button
                  type="button"
                  onClick={addSpecification}
                  className="flex items-center gap-2 px-4 py-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <FiPlus className="w-4 h-4" />
                  Özellik Ekle
                </button>
              </div>
              
              {Object.entries(formData.specifications).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <input
                    type="text"
                    value={key}
                    disabled
                    className="w-1/3 px-4 py-2 border-2 border-gray-200 rounded-lg bg-gray-50"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => updateSpecification(key, e.target.value)}
                    className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeSpecification(key)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <FiTrash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4 border-t">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={saving}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Ürünü Kaydet'}
              </motion.button>
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                İptal
              </button>
            </div>
          </form>
        </motion.div>
      </div>

      {/* Inline New Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-6 sm:p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
                  <FiFolderPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Yeni Kategori Ekle</h3>
                  <p className="text-xs text-gray-500">Ürünlerinize yeni bir kategori oluşturun</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCatModal(false)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Kategori Adı *
                </label>
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="örn: Seyahat Setleri"
                  required
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Açıklama (Opsiyonel)
                </label>
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="Kategori açıklaması"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-primary-600 focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCatModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl text-xs transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={creatingCat || !newCatName.trim()}
                  className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs transition-colors shadow-md disabled:opacity-50"
                >
                  {creatingCat ? 'Oluşturuluyor...' : 'Kategori Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      <MediaPickerModal
        isOpen={showMediaModal}
        onClose={() => setShowMediaModal(false)}
        onSelect={(url) => {
          setImageUrls((prev) => [...prev, url])
        }}
      />
    </div>
  )
}


