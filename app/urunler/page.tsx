'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { collection, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { subscribeToCategories, Category } from '@/lib/firebase/categories'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { FiShoppingBag, FiSearch, FiStar, FiCheck, FiFilter, FiArrowRight } from 'react-icons/fi'
import { addToCart } from '@/lib/utils/cart'

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
  image?: string
  images?: string[]
  description: string
  category?: string
  categoryId?: string
  inStock?: boolean
  features?: string[]
  colors?: ColorOption[]
  rating?: number
  isPopular?: boolean
}

function ProductsListContent() {
  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('kategori')

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>(categoryParam || 'all')
  const [addedId, setAddedId] = useState<string | null>(null)

  // Update selected category if URL query parameter changes
  useEffect(() => {
    if (categoryParam) {
      setSelectedCategorySlug(categoryParam)
    }
  }, [categoryParam])

  // Real-time categories subscription
  useEffect(() => {
    const unsubCats = subscribeToCategories((cats) => {
      const activeCats = cats.filter((c) => c.active !== false)
      setCategories(activeCats)
    })
    return () => unsubCats()
  }, [])

  // Real-time products subscription
  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const productsRef = collection(db, 'products')

      const unsubscribe = onSnapshot(
        productsRef,
        (snapshot) => {
          const productsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Product[]
          setProducts(productsData)
          setLoading(false)
        },
        (error) => {
          console.error('Products fetch error:', error)
          setLoading(false)
        }
      )
      return () => unsubscribe()
    } catch (error) {
      console.error('Products init error:', error)
      setLoading(false)
    }
  }, [])

  // Dynamic Filtering Logic (Supports categoryId, category slug, and name search)
  const filteredProducts = products.filter((product) => {
    // 1. Text Search Filter
    const matchesSearch =
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description?.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    // 2. Category Filter
    if (selectedCategorySlug === 'all') return true

    // Find the category definition from Firestore categories
    const targetCat = categories.find(
      (c) => c.slug === selectedCategorySlug || c.id === selectedCategorySlug
    )

    if (targetCat) {
      const pCat = (product.category || '').toLowerCase()
      const pCatId = product.categoryId || ''
      const targetSlug = targetCat.slug.toLowerCase()
      const targetId = targetCat.id

      return (
        pCat === targetSlug ||
        pCatId === targetId ||
        pCat === targetId ||
        (targetSlug === 'otomatik' && (pCat.includes('otomatik') || pCat.includes('elektrikli'))) ||
        (targetSlug === 'kullan-at' && (pCat.includes('kullan') || pCat.includes('seyahat'))) ||
        (targetSlug === 'yedek-firca-basliklari' && (pCat.includes('yedek') || pCat.includes('baslik')))
      )
    }

    return (
      (product.category || '').toLowerCase() === selectedCategorySlug.toLowerCase() ||
      product.categoryId === selectedCategorySlug
    )
  })

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const itemImage = product.images?.[0] || product.image
    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      image: itemImage,
    })

    setAddedId(product.id)
    setTimeout(() => setAddedId(null), 1800)
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-28 pb-24">
      <div className="container-custom section-padding">
        
        {/* Header Title & Subtitle */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block text-xs font-extrabold uppercase tracking-[0.2em] text-brand-blue bg-brand-softBlue px-4 py-1.5 rounded-full border border-brand-blue/20 mb-4"
          >
            Premium Koleksiyon
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl font-black text-brand-navy tracking-tight mb-4"
          >
            Tüm Diş Fırçaları & Ağız Bakımı
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-600 text-base sm:text-lg"
          >
            Yeni nesil 360° sonic otomatik fırçalar, hijyenik kullan-at ürünler ve yedek başlıklar.
          </motion.p>
        </div>

        {/* Search & Dynamic Category Filter Bar */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 mb-12 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ürün veya özellik ara..."
                className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:border-brand-blue focus:bg-white transition-colors"
              />
            </div>

            {/* Dynamic Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedCategorySlug('all')}
                className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategorySlug === 'all'
                    ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/25'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tüm Ürünler ({products.length})
              </button>

              {categories.map((cat) => {
                const isSelected = selectedCategorySlug === cat.slug || selectedCategorySlug === cat.id
                return (
                  <button
                    key={cat.id || cat.slug}
                    onClick={() => setSelectedCategorySlug(cat.slug)}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/25'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <div className="w-12 h-12 border-3 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-slate-200 p-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <FiShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-brand-navy mb-2">Aradığınız kriterde ürün bulunamadı</h3>
            <p className="text-sm text-slate-500 mb-6">Farklı bir arama terimi veya kategori seçmeyi deneyin.</p>
            <button
              onClick={() => {
                setSelectedCategorySlug('all')
                setSearchTerm('')
              }}
              className="btn-primary text-xs py-3 px-6"
            >
              Tüm Ürünleri Göster
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {filteredProducts.map((product) => {
              const productImage = product.images?.[0] || product.image
              const isAdded = addedId === product.id
              const discount = product.discountPrice
                ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
                : null

              return (
                <div
                  key={product.id}
                  className="group bg-white rounded-[2rem] p-6 border border-slate-200/80 hover:border-brand-blue/40 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Card Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {discount ? (
                        <span className="text-[11px] font-extrabold text-white bg-brand-green px-3 py-1 rounded-full shadow-xs">
                          %{discount} İndirim
                        </span>
                      ) : product.isPopular ? (
                        <span className="text-[11px] font-extrabold text-brand-blue bg-brand-softBlue px-3 py-1 rounded-full border border-brand-blue/20">
                          Öne Çıkan
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                          {product.inStock !== false ? 'Stokta Var' : 'Tükendi'}
                        </span>
                      )}

                      <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                        <FiStar className="fill-amber-400 w-3.5 h-3.5" />
                        <span>4.9</span>
                      </div>
                    </div>

                    {/* Product Image Link */}
                    <Link
                      href={`/urunler/${product.id}`}
                      className="relative aspect-square w-full rounded-2xl bg-slate-50 flex items-center justify-center p-4 my-2 overflow-hidden block"
                    >
                      {productImage ? (
                        <Image
                          src={productImage}
                          alt={product.name}
                          fill
                          className="object-contain p-2 group-hover:scale-108 transition-transform duration-500"
                          sizes="(max-width: 768px) 100vw, 300px"
                        />
                      ) : (
                        <FiShoppingBag className="w-12 h-12 text-slate-300" />
                      )}
                    </Link>

                    {/* Product Title & Info */}
                    <div className="mt-4">
                      <Link href={`/urunler/${product.id}`}>
                        <h3 className="text-base font-bold text-brand-navy group-hover:text-brand-blue transition-colors line-clamp-1 mb-1">
                          {product.name}
                        </h3>
                      </Link>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                        {product.description}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom: Price & Add to Cart Action */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      {product.discountPrice ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 line-through leading-none">
                            {product.price.toLocaleString('tr-TR')} ₺
                          </span>
                          <span className="text-lg font-black text-brand-green leading-tight">
                            {product.discountPrice.toLocaleString('tr-TR')} ₺
                          </span>
                        </div>
                      ) : (
                        <span className="text-lg font-black text-brand-navy">
                          {product.price.toLocaleString('tr-TR')} ₺
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleAddToCart(product, e)}
                      disabled={product.inStock === false}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                        isAdded
                          ? 'bg-brand-green text-white'
                          : product.inStock === false
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-brand-navy hover:bg-brand-blue text-white'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <FiCheck className="w-3.5 h-3.5" />
                          <span>Eklendi</span>
                        </>
                      ) : (
                        <>
                          <FiShoppingBag className="w-3.5 h-3.5" />
                          <span>Sepete Ekle</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-12 h-12 border-3 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
        </div>
      }
    >
      <ProductsListContent />
    </Suspense>
  )
}
