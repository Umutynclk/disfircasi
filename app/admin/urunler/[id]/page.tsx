'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { getCurrentUser } from '@/lib/firebase/auth'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { uploadImage, uploadVideo } from '@/lib/firebase/storage'
import { motion } from 'framer-motion'
import { FiX, FiImage, FiVideo, FiPlus, FiTrash2 } from 'react-icons/fi'

export default function EditProductPage() {
  const router = useRouter()
  const params = useParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    discountPrice: '',
    discountPercentage: '',
    description: '',
    category: 'elektrikli-disfircasi',
    inStock: true,
    features: [''],
    specifications: {} as Record<string, string>,
  })
  
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [newImages, setNewImages] = useState<File[]>([])
  const [existingVideo, setExistingVideo] = useState<string>('')
  const [newVideo, setNewVideo] = useState<File | null>(null)
  
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
    const checkAuthAndLoad = async () => {
      const user = await getCurrentUser()
      if (!user) {
        router.push('/admin/login')
        return
      }

      try {
        const db = getFirestoreDB()
        const productRef = doc(db, 'products', params.id as string)
        const productSnap = await getDoc(productRef)
        
        if (productSnap.exists()) {
          const data = productSnap.data()
          setFormData({
            name: data.name || '',
            price: data.price?.toString() || '',
            discountPrice: data.discountPrice?.toString() || '',
            discountPercentage: data.discountPercentage?.toString() || '',
            description: data.description || '',
            category: data.category || 'premium',
            inStock: data.inStock !== undefined ? data.inStock : true,
            features: data.features && data.features.length > 0 ? data.features : [''],
            specifications: data.specifications || {}
          })
          setExistingImages(data.images || [])
          setExistingVideo(data.video || '')
          setColors(data.colors?.map((c: any) => ({ 
            ...c, 
            images: [], 
            imageUrls: c.images || [] 
          })) || [])
        }
      } catch (error) {
        console.error('Ürün yüklenirken hata:', error)
      } finally {
        setLoading(false)
      }
    }
    checkAuthAndLoad()
  }, [params.id, router])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setNewImages([...newImages, ...files])
  }

  const removeExistingImage = (index: number) => {
    setExistingImages(existingImages.filter((_, i) => i !== index))
  }

  const removeNewImage = (index: number) => {
    setNewImages(newImages.filter((_, i) => i !== index))
  }

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setNewVideo(file)
  }

  const removeVideo = () => {
    setExistingVideo('')
    setNewVideo(null)
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      // Yeni resimleri yükle
      const uploadedImageUrls: string[] = []
      for (const image of newImages) {
        const url = await uploadImage(image, 'products')
        uploadedImageUrls.push(url)
      }

      // Yeni videoyu yükle
      let uploadedVideoUrl = existingVideo
      if (newVideo) {
        uploadedVideoUrl = await uploadVideo(newVideo, 'products')
      }

      // Renk seçeneklerini yükle
      const uploadedColors = await Promise.all(
        colors.map(async (color) => {
          const colorImages: string[] = []
      
          // Yeni görselleri yükle
          for (const image of color.images) {
            const url = await uploadImage(image, `products/colors/${color.code}`)
            colorImages.push(url)
          }
      
          // Temel color objesi
          const colorData: any = {
            name: color.name,
            code: color.code,
            images: [...color.imageUrls, ...colorImages],
          }
      
          // Price varsa ekle
          if (color.price !== undefined && color.price !== null) {
            colorData.price = typeof color.price === 'number' ? color.price : parseFloat(String(color.price))
          }
      
          // DiscountPrice varsa ekle
          if (color.discountPrice !== undefined && color.discountPrice !== null) {
            colorData.discountPrice = typeof color.discountPrice === 'number' ? color.discountPrice : parseFloat(String(color.discountPrice))
          }
      
          return colorData
        })
      )
      // Firestore'u güncelle
      const productData: any = {
        name: formData.name,
        price: parseFloat(formData.price),
        discountPrice: formData.discountPrice ? parseFloat(formData.discountPrice) : null,
        discountPercentage: formData.discountPercentage ? parseFloat(formData.discountPercentage) : null,
        hasDiscount: !!(formData.discountPrice && parseFloat(formData.discountPrice) < parseFloat(formData.price)),
        description: formData.description,
        category: formData.category,
        inStock: formData.inStock,
        images: [...existingImages, ...uploadedImageUrls],
        features: formData.features.filter(f => f.trim() !== ''),
        specifications: formData.specifications,
        updatedAt: new Date()
      }

      // Video varsa ekle (undefined olmamalı)
      if (uploadedVideoUrl) {
        productData.video = uploadedVideoUrl
      }

      // Colors varsa ekle
      if (uploadedColors.length > 0) {
        productData.colors = uploadedColors
      }

      const db = getFirestoreDB()
      const productRef = doc(db, 'products', params.id as string)
      await updateDoc(productRef, productData)
      router.push('/admin')
    } catch (error) {
      console.error('Ürün güncellenirken hata:', error)
      alert('Ürün güncellenirken bir hata oluştu')
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
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Ürünü Düzenle</h1>
            <p className="text-gray-600">Ürün bilgilerini güncelleyin</p>
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
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Kategori
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  >
                    <option value="elektrikli-disfircasi">Elektrikli Diş Fırçası</option>
                    <option value="yedek-firca-basliklari">Yedek Fırça Başlıkları</option>
                  </select>
                </div>
              </div>

              {/* İndirim Alanları */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 space-y-4">
                <h3 className="text-lg font-semibold text-orange-900">İndirim Ayarları</h3>
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
            </div>

            {/* Medya */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-900">Medya</h2>
              
              {/* Mevcut Görseller */}
              {existingImages.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mevcut Görseller
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {existingImages.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={imageUrl}
                          alt={`Existing ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(index)}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Yeni Görseller */}
              {newImages.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yeni Görseller
                  </label>
                  <div className="grid grid-cols-3 gap-4 mb-4">
                    {newImages.map((image, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(image)}
                          alt={`New ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeNewImage(index)}
                          className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

              {/* Video */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ürün Videosu (Opsiyonel)
                </label>
                {existingVideo && !newVideo ? (
                  <div className="relative">
                    <video src={existingVideo} controls className="w-full rounded-lg" />
                    <button
                      type="button"
                      onClick={removeVideo}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full"
                    >
                      <FiX className="w-4 h-4" />
                    </button>
                  </div>
                ) : newVideo ? (
                  <div className="relative">
                    <video src={URL.createObjectURL(newVideo)} controls className="w-full rounded-lg" />
                    <button
                      type="button"
                      onClick={removeVideo}
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
                    {/* Mevcut Görseller */}
                    {color.imageUrls.length > 0 && (
                      <div className="grid grid-cols-4 gap-4 mb-4">
                        {color.imageUrls.map((imgUrl, imgIndex) => (
                          <div key={imgIndex} className="relative group">
                            <img
                              src={imgUrl}
                              alt={`${color.name} ${imgIndex + 1}`}
                              className="w-full h-24 object-cover rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...colors]
                                updated[colorIndex].imageUrls = updated[colorIndex].imageUrls.filter((_, i) => i !== imgIndex)
                                setColors(updated)
                              }}
                              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <FiX className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Yeni Görseller */}
                    {color.images.length > 0 && (
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
                    )}
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
                {saving ? 'Güncelleniyor...' : 'Değişiklikleri Kaydet'}
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
    </div>
  )
}


