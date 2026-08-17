'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import { FiShoppingBag, FiCheck, FiShield, FiTruck, FiRefreshCw, FiArrowLeft, FiPlus, FiMinus, FiStar } from 'react-icons/fi'
import Link from 'next/link'
import { addToCart } from '@/lib/utils/cart'
import dynamic from 'next/dynamic'

const Product3DViewer = dynamic(() => import('@/components/3d/Product3DViewer'), { ssr: false })

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
  model3dUrl?: string
  description: string
  features?: string[]
  specifications?: Record<string, string>
  inStock?: boolean
  category?: string
  colors?: ColorOption[]
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedColor, setSelectedColor] = useState<ColorOption | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [currentDiscountPrice, setCurrentDiscountPrice] = useState<number | null>(null)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [added, setAdded] = useState(false)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const productRef = doc(db, 'products', params.id as string)

      const unsubscribe = onSnapshot(
        productRef,
        (productSnap) => {
          if (productSnap.exists()) {
            const productData = { id: productSnap.id, ...productSnap.data() } as Product
            setProduct(productData)

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
            setLoading(false)
          } else {
            setLoading(false)
          }
        },
        (error) => {
          console.error('Product fetch error:', error)
          setLoading(false)
        }
      )

      return () => unsubscribe()
    } catch (error) {
      console.error('Product init error:', error)
      setLoading(false)
    }
  }, [params.id])

  const handleColorSelect = (color: ColorOption) => {
    setSelectedColor(color)
    if (color.images && color.images.length > 0) {
      setCurrentImages(color.images)
    }
    if (color.price) setCurrentPrice(color.price)
    if (color.discountPrice !== undefined) setCurrentDiscountPrice(color.discountPrice)
  }

  const handleAddToCart = () => {
    if (!product) return

    for (let i = 0; i < quantity; i++) {
      addToCart({
        productId: product.id,
        name: product.name,
        price: currentPrice,
        discountPrice: currentDiscountPrice,
        image: currentImages[0] || product.image,
        selectedColor: selectedColor
          ? {
              name: selectedColor.name,
              code: selectedColor.code,
              price: selectedColor.price,
              discountPrice: selectedColor.discountPrice,
            }
          : undefined,
      })
    }

    setAdded(true)
    setTimeout(() => setAdded(false), 2000)

    window.dispatchEvent(new CustomEvent('openCartDrawer'))
  }

  const handleBuyNow = () => {
    handleAddToCart()
    router.push('/satin-al?sepet=true')
  }

  if (loading) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ürün Bulunamadı</h2>
        <p className="text-slate-500 mb-6">Aradığınız ürün mevcut değil veya kaldırılmış olabilir.</p>
        <Link
          href="/urunler"
          className="px-6 py-3 bg-brand-blue text-white rounded-full text-xs font-bold hover:bg-blue-600 transition-colors"
        >
          Tüm Ürünlere Dön
        </Link>
      </div>
    )
  }

  const isAutomatic = product.category === 'otomatik' || product.name.toLowerCase().includes('otomatik')

  return (
    <div className="pt-32 pb-24 bg-slate-50 min-h-screen">
      <div className="container-custom section-padding">
        {/* Back Link */}
        <Link
          href="/urunler"
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-brand-blue transition-colors mb-8"
        >
          <FiArrowLeft className="w-4 h-4" /> Tüm Ürünlere Dön
        </Link>

        {/* Hero Product Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-20">
          {/* Left Column: 3D Product Interactive Viewer */}
          <div className="lg:col-span-7 space-y-6">
            <Product3DViewer
              model3dUrl={product.model3dUrl}
              image={currentImages[0] || product.image}
              images={currentImages}
              productName={product.name}
            />

            {/* Thumbnail Carousel if multiple images */}
            {currentImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {currentImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const newImgs = [...currentImages]
                      const temp = newImgs[0]
                      newImgs[0] = newImgs[idx]
                      newImgs[idx] = temp
                      setCurrentImages(newImgs)
                    }}
                    className="w-20 h-20 rounded-2xl bg-white p-2 border border-slate-200 flex-shrink-0 hover:border-brand-blue transition-colors overflow-hidden"
                  >
                    <img src={img} alt={`Görsel ${idx}`} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Product Configuration & Actions */}
          <div className="lg:col-span-5 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            <div>
              {product.category && (
                <span className="text-xs font-bold uppercase tracking-widest text-brand-blue bg-brand-softBlue px-3 py-1 rounded-full border border-brand-blue/20">
                  {product.category}
                </span>
              )}
              <h1 className="text-3xl font-black text-brand-navy tracking-tight mt-3 mb-2">
                {product.name}
              </h1>

              {/* Rating */}
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-4">
                <div className="flex items-center text-amber-400">
                  <FiStar className="fill-current w-4 h-4" />
                  <FiStar className="fill-current w-4 h-4" />
                  <FiStar className="fill-current w-4 h-4" />
                  <FiStar className="fill-current w-4 h-4" />
                  <FiStar className="fill-current w-4 h-4" />
                </div>
                <span>5.0 (48+ Klinik İnceleme)</span>
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-3 my-4">
                {currentDiscountPrice ? (
                  <>
                    <span className="text-3xl font-black text-brand-blue">
                      {currentDiscountPrice.toLocaleString('tr-TR')} ₺
                    </span>
                    <span className="text-sm text-slate-400 line-through">
                      {currentPrice.toLocaleString('tr-TR')} ₺
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-black text-brand-navy">
                    {currentPrice.toLocaleString('tr-TR')} ₺
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed border-t border-b border-slate-100 py-4">
                {product.description}
              </p>
            </div>

            {/* Color Variants Selector */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-3">
                  Renk Seçeneği: <span className="text-brand-blue">{selectedColor?.name}</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleColorSelect(color)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold transition-all ${
                        selectedColor?.code === color.code
                          ? 'border-brand-blue bg-brand-softBlue text-brand-blue shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ backgroundColor: color.code }}
                      />
                      <span>{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Adet</span>
              <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="text-slate-600 hover:text-slate-900 p-1"
                >
                  <FiMinus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-bold text-slate-900 w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="text-slate-600 hover:text-slate-900 p-1"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3 pt-4">
              <button
                onClick={handleAddToCart}
                className={`w-full py-4 rounded-full font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                  added
                    ? 'bg-brand-green text-white scale-102'
                    : 'bg-brand-blue text-white hover:bg-blue-600 hover:shadow-brand-blue/30'
                }`}
              >
                {added ? (
                  <>
                    <FiCheck className="w-5 h-5" />
                    <span>Sepete Eklendi!</span>
                  </>
                ) : (
                  <>
                    <FiShoppingBag className="w-5 h-5" />
                    <span>Sepete Ekle</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                className="w-full py-4 bg-brand-navy text-white rounded-full font-bold text-sm hover:bg-slate-900 transition-colors flex items-center justify-center"
              >
                Hemen Satın Al
              </button>
            </div>

            {/* Guarantee Pills */}
            <div className="grid grid-cols-3 gap-2 pt-6 border-t border-slate-100 text-[11px] text-slate-500 font-medium text-center">
              <div className="p-2 rounded-xl bg-slate-50 flex flex-col items-center gap-1">
                <FiTruck className="w-4 h-4 text-brand-blue" />
                <span>Ücretsiz Kargo</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 flex flex-col items-center gap-1">
                <FiShield className="w-4 h-4 text-brand-green" />
                <span>2 Yıl Garanti</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 flex flex-col items-center gap-1">
                <FiRefreshCw className="w-4 h-4 text-cyan-500" />
                <span>14 Gün İade</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Scroll Story & Specifications */}
        {product.features && product.features.length > 0 && (
          <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200/80 shadow-xs max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-brand-navy mb-6">Öne Çıkan Özellikler</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <FiCheck className="w-5 h-5 text-brand-green flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-700 font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
