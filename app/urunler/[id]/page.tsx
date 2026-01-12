'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { doc, getDoc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FiShoppingCart, FiCheck, FiHeart, FiShare2 } from 'react-icons/fi'
import Link from 'next/link'

interface ColorOption {
  name: string
  code: string
  images?: string[]
  price?: number
  discountPrice?: number | null
}

interface Product {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  discountPercentage?: number | null
  images?: string[]
  image?: string
  video?: string
  description: string
  features: string[]
  specifications: Record<string, string>
  inStock?: boolean
  category: string
  colors?: ColorOption[]
}

export default function ProductDetailPage() {
  const params = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [selectedColor, setSelectedColor] = useState<ColorOption | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [currentDiscountPrice, setCurrentDiscountPrice] = useState<number | null>(null)
  const [currentImages, setCurrentImages] = useState<string[]>([])

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const productRef = doc(db, 'products', params.id as string)
      
      // Real-time listener - Firebase değişikliklerini dinle
      const unsubscribe = onSnapshot(
        productRef,
        (productSnap) => {
          if (productSnap.exists()) {
            const productData = { id: productSnap.id, ...productSnap.data() } as Product
            setProduct(productData)
            
            // İlk rengi seç veya ana görselleri kullan
            if (productData.colors && productData.colors.length > 0) {
              const firstColor = productData.colors[0]
              setSelectedColor(firstColor)
              setCurrentImages(firstColor.images || productData.images || [])
              setCurrentPrice(firstColor.price || productData.price)
              setCurrentDiscountPrice(firstColor.discountPrice || productData.discountPrice || null)
            } else {
              const images = productData.images || (productData.image ? [productData.image] : [])
              setCurrentImages(images)
              setCurrentPrice(productData.price)
              setCurrentDiscountPrice(productData.discountPrice || null)
            }
            
            if (productData.images?.[0] || productData.image) {
              setSelectedImage(0)
            }
            
            setLoading(false)
          } else {
            setLoading(false)
          }
        },
        (error) => {
          console.error('❌ Product fetch error:', error)
          setLoading(false)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Product initialization error:', error)
      setLoading(false)
    }
  }, [params.id])

  // Renk seçildiğinde fiyat ve fotoğrafları güncelle
  useEffect(() => {
    if (selectedColor && product) {
      setCurrentImages(selectedColor.images || product.images || [])
      setCurrentPrice(selectedColor.price || product.price)
      setCurrentDiscountPrice(selectedColor.discountPrice || product.discountPrice || null)
      setSelectedImage(0)
    } else if (product && !selectedColor) {
      const images = product.images || (product.image ? [product.image] : [])
      setCurrentImages(images)
      setCurrentPrice(product.price)
      setCurrentDiscountPrice(product.discountPrice || null)
    }
  }, [selectedColor, product])

  if (loading) {
    return (
      <div className="pt-32 pb-20 min-h-screen">
        <div className="container-custom section-padding">
          <div className="animate-pulse grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="bg-gray-200 rounded-2xl h-[600px]"></div>
            <div className="space-y-4">
              <div className="bg-gray-200 rounded h-12 w-3/4"></div>
              <div className="bg-gray-200 rounded h-6 w-full"></div>
              <div className="bg-gray-200 rounded h-6 w-2/3"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="pt-32 pb-20 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ürün bulunamadı</h2>
          <p className="text-gray-600">Aradığınız ürün mevcut değil.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-32 pb-20 bg-white min-h-screen">
      <div className="container-custom section-padding">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Image Gallery */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <div className="relative" style={{ perspective: '1000px' }}>
              <motion.div 
                className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-primary-100 to-primary-200 shadow-xl"
                whileHover={{ 
                  rotateY: 15,
                  rotateX: -5,
                  scale: 1.02
                }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {currentImages && currentImages[selectedImage] ? (
                  <img
                    src={currentImages[selectedImage]}
                    alt={product.name}
                    className="w-full h-full object-contain transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-9xl">🦷</span>
                  </div>
                )}
              </motion.div>
              {/* Stok Yok Overlay */}
              {product.inStock === false && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-2xl pointer-events-none">
                  <div className="bg-red-500 text-white px-6 py-3 rounded-lg font-semibold text-lg">
                    Stokta Yok
                  </div>
                </div>
              )}
            </div>
            
            {currentImages && currentImages.length > 1 && (
                    <div className="grid grid-cols-4 gap-4">
                      {currentImages.map((image, index) => (
                        <motion.button
                          key={index}
                          onClick={() => setSelectedImage(index)}
                          whileHover={{ 
                            rotateY: 10,
                            scale: 1.05
                          }}
                          transition={{ duration: 0.2, ease: "easeOut" }}
                          className={`aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImage === index
                              ? 'border-primary-600 ring-2 ring-primary-200'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          style={{ transformStyle: 'preserve-3d', perspective: '500px' }}
                        >
                          <img
                            src={image}
                            alt={`${product.name} ${index + 1}`}
                            className="w-full h-full object-contain"
                          />
                        </motion.button>
                      ))}
                    </div>
            )}

            {product.video && (
              <div className="rounded-2xl overflow-hidden shadow-xl">
                <video
                  src={product.video}
                  controls
                  className="w-full"
                />
              </div>
            )}
          </motion.div>

          {/* Product Info */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>
              {/* Fiyat */}
              <div className="mb-6">
                {currentDiscountPrice && currentDiscountPrice < currentPrice ? (
                  <div className="flex flex-col gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl font-bold text-primary-600">
                        {currentDiscountPrice.toLocaleString('tr-TR')} ₺
                      </span>
                      <span className="text-xl text-gray-500 line-through">
                        {currentPrice.toLocaleString('tr-TR')} ₺
                      </span>
                      <span className="px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
                        İndirimli Fiyat
                      </span>
                    </div>
                    <span className="text-sm text-red-600 font-medium">
                      %{product.discountPercentage || Math.round(((currentPrice - currentDiscountPrice) / currentPrice) * 100)} indirim
                    </span>
                  </div>
                ) : (
                  <span className="text-4xl font-bold text-primary-600 block mb-4">
                    {currentPrice.toLocaleString('tr-TR')} ₺
                  </span>
                )}
                {product.inStock === false ? (
                  <span className="inline-block px-4 py-2 bg-red-100 text-red-700 rounded-full text-sm font-semibold">
                    ⚠️ Stokta Yok
                  </span>
                ) : (
                  <span className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-semibold flex items-center gap-2">
                    <FiCheck className="w-4 h-4" />
                    Stokta Var
                  </span>
                )}
              </div>

              {/* Renk Seçenekleri */}
              {product.colors && product.colors.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Renk Seçenekleri</h3>
                  <div className="flex flex-wrap gap-3">
                    {product.colors.map((color, index) => {
                      const colorImages = color.images && color.images.length > 0 ? color.images : []
                      const hasImages = colorImages.length > 0
                      
                      return (
                        <div key={index} className="relative group">
                          <button
                            onClick={() => setSelectedColor(color)}
                            onMouseEnter={() => {
                              // Hover yapıldığında o rengin fotoğraflarını göster
                              if (hasImages) {
                                setCurrentImages(colorImages)
                                setSelectedImage(0)
                              }
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all relative ${
                              selectedColor?.code === color.code
                                ? 'border-primary-600 ring-2 ring-primary-200 bg-primary-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div
                              className="w-6 h-6 rounded-full border-2 border-gray-300"
                              style={{ backgroundColor: color.code }}
                            />
                            <span className="font-medium text-gray-700">{color.name}</span>
                            {hasImages && (
                              <span className="text-xs text-gray-500 ml-1">({colorImages.length})</span>
                            )}
                          </button>
                          
                          {/* Hover Preview - Renk fotoğraflarını göster */}
                          {hasImages && (
                            <div className="absolute left-0 top-full mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                              <div className="text-xs font-semibold text-gray-700 mb-2">{color.name} Görselleri</div>
                              <div className="grid grid-cols-3 gap-2">
                                {colorImages.slice(0, 6).map((img, imgIndex) => (
                                  <img
                                    key={imgIndex}
                                    src={img}
                                    alt={`${color.name} ${imgIndex + 1}`}
                                    className="w-full h-16 object-cover rounded"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Açıklama</h3>
              <p className="text-gray-600 leading-relaxed">{product.description}</p>
            </div>

            {product.features && product.features.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Özellikler</h3>
                <ul className="space-y-3">
                  {product.features.map((feature, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <div className="flex-shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                        <FiCheck className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-gray-700">{feature}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {product.specifications && Object.keys(product.specifications).length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Teknik Özellikler</h3>
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  {Object.entries(product.specifications).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2 border-b border-gray-200 last:border-0">
                      <span className="text-gray-600 font-medium">{key}:</span>
                      <span className="text-gray-900">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <Link href={`/satin-al?urun=${product.id}`} className="flex-1">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={product.inStock === false}
                  className={`w-full px-8 py-4 rounded-full font-semibold flex items-center justify-center gap-3 transition-all ${
                    product.inStock !== false
                      ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <FiShoppingCart className="w-5 h-5" />
                  {product.inStock === false ? 'Stokta Yok' : 'Şimdi Satın Alın'}
                </motion.button>
              </Link>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-4 rounded-full border-2 border-gray-300 hover:border-primary-600 hover:bg-primary-50 transition-colors"
              >
                <FiHeart className="w-5 h-5 text-gray-700" />
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-4 rounded-full border-2 border-gray-300 hover:border-primary-600 hover:bg-primary-50 transition-colors"
              >
                <FiShare2 className="w-5 h-5 text-gray-700" />
              </motion.button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

