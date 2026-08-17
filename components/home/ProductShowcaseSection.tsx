'use client'

import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { FiShoppingBag, FiStar, FiArrowRight, FiCheck } from 'react-icons/fi'
import TiltCard from '@/components/animation/TiltCard'
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
  inStock?: boolean
  colors?: ColorOption[]
  rating?: number
}

export default function ProductShowcaseSection() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'otomatik' | 'kullan-at'>('all')
  const [addedId, setAddedId] = useState<string | null>(null)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const productsRef = collection(db, 'products')
      const unsubscribe = onSnapshot(
        productsRef,
        (snapshot) => {
          const list = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Product[]
          setProducts(list)
          setLoading(false)
        },
        (error) => {
          console.error('Firebase products error:', error)
          setLoading(false)
        }
      )
      return () => unsubscribe()
    } catch (error) {
      console.error('Products init error:', error)
      setLoading(false)
    }
  }, [])

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault()
    e.stopPropagation()

    const price = product.discountPrice || product.price
    const img = product.images?.[0] || product.image

    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      image: img,
    })

    setAddedId(product.id)
    setTimeout(() => setAddedId(null), 2000)

    window.dispatchEvent(new CustomEvent('openCartDrawer'))
  }

  const filteredProducts = products.filter((p) => {
    if (filter === 'all') return true
    if (filter === 'otomatik') return p.category === 'otomatik' || p.name.toLowerCase().includes('otomatik')
    if (filter === 'kullan-at') return p.category === 'kullan-at' || p.name.toLowerCase().includes('kullan')
    return true
  })

  return (
    <section className="py-24 md:py-36 bg-white relative overflow-hidden">
      <div className="container-custom section-padding">
        {/* Section Title & Category Filter Tabs */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-brand-blue bg-brand-softBlue px-4 py-1.5 rounded-full border border-brand-blue/20">
              Koleksiyonumuz
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-brand-navy tracking-tight mt-3">
              Öne Çıkan Ürünler.
            </h2>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 p-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-bold">
            <button
              onClick={() => setFilter('all')}
              className={`px-5 py-2.5 rounded-full transition-all ${
                filter === 'all' ? 'bg-brand-navy text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tüm Ürünler ({products.length})
            </button>
            <button
              onClick={() => setFilter('otomatik')}
              className={`px-5 py-2.5 rounded-full transition-all ${
                filter === 'otomatik' ? 'bg-brand-blue text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Otomatik Diş Fırçaları
            </button>
            <button
              onClick={() => setFilter('kullan-at')}
              className={`px-5 py-2.5 rounded-full transition-all ${
                filter === 'kullan-at' ? 'bg-brand-green text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Kullan At Grubu
            </button>
          </div>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-20 flex justify-center items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredProducts.length === 0 && (
          <div className="text-center py-16 bg-slate-50 rounded-3xl border border-slate-200">
            <p className="text-slate-500 font-medium">Bu kategoride henüz ürün bulunmuyor.</p>
            <Link
              href="/urunler"
              className="mt-4 inline-flex items-center gap-2 text-brand-blue font-bold text-sm hover:underline"
            >
              Tüm Ürünleri İncele <FiArrowRight />
            </Link>
          </div>
        )}

        {/* Products Grid with 3D Tilt Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProducts.map((product) => {
            const price = product.price
            const discountPrice = product.discountPrice
            const image = product.images?.[0] || product.image

            return (
              <Link key={product.id} href={`/urunler/${product.id}`}>
                <TiltCard maxTilt={4} glowColor="blue" className="h-full">
                  <div className="h-full bg-slate-50/80 rounded-3xl p-6 border border-slate-200/80 flex flex-col justify-between group hover:border-brand-blue/40 transition-all duration-300">
                    {/* Top Image Badge & Thumbnail */}
                    <div>
                      <div className="relative w-full h-64 rounded-2xl bg-white p-4 border border-slate-100 flex items-center justify-center overflow-hidden mb-6">
                        {discountPrice && (
                          <span className="absolute top-3 left-3 bg-red-500 text-white text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full shadow-xs z-10">
                            İndirimli
                          </span>
                        )}
                        {product.category && (
                          <span className="absolute top-3 right-3 bg-brand-softBlue text-brand-blue text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border border-brand-blue/20 z-10">
                            {product.category}
                          </span>
                        )}

                        {image ? (
                          <img
                            src={image}
                            alt={product.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xs text-gray-400 font-medium">
                            Görsel Yok
                          </div>
                        )}
                      </div>

                      {/* Product Info */}
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-brand-blue transition-colors line-clamp-1 mb-2">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                        {product.description}
                      </p>
                    </div>

                    {/* Price and Cart Action */}
                    <div className="pt-4 border-t border-slate-200/60 flex items-center justify-between">
                      <div>
                        {discountPrice ? (
                          <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black text-brand-blue">
                              {discountPrice.toLocaleString('tr-TR')} ₺
                            </span>
                            <span className="text-xs text-slate-400 line-through">
                              {price.toLocaleString('tr-TR')} ₺
                            </span>
                          </div>
                        ) : (
                          <span className="text-xl font-black text-brand-navy">
                            {price.toLocaleString('tr-TR')} ₺
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => handleAddToCart(e, product)}
                        className={`px-4 py-2.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all duration-300 ${
                          addedId === product.id
                            ? 'bg-brand-green text-white scale-105'
                            : 'bg-brand-blue text-white hover:bg-blue-600 hover:shadow-md'
                        }`}
                      >
                        {addedId === product.id ? (
                          <>
                            <FiCheck className="w-4 h-4" />
                            <span>Eklendi</span>
                          </>
                        ) : (
                          <>
                            <FiShoppingBag className="w-4 h-4" />
                            <span>Sepete Ekle</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </TiltCard>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
