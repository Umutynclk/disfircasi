'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { FiShoppingBag, FiArrowRight, FiCheck, FiStar } from 'react-icons/fi'
import { addToCart } from '@/lib/utils/cart'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

export interface ShowcaseProductItem {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  discountPercentage?: number | null
  image?: string
  images?: string[]
  description?: string
  category?: string
  inStock?: boolean
  rating?: number
}

interface ProductOptionsSectionProps {
  products: ShowcaseProductItem[]
  loading?: boolean
}

export default function ProductOptionsSection({ products, loading }: ProductOptionsSectionProps) {
  const [addedId, setAddedId] = useState<string | null>(null)
  const [content, setContent] = useState({
    badge: 'Ürün Koleksiyonu',
    title: 'En Çok Tercih Edilenler',
    buttonText: 'Tüm Ürünleri İncele',
  })

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const unsub = onSnapshot(doc(db, 'siteContent', 'productShowcase'), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setContent((prev) => ({
            ...prev,
            badge: d.badge || prev.badge,
            title: d.title || prev.title,
            buttonText: d.buttonText || prev.buttonText,
          }))
        }
      })
      return () => unsub()
    } catch (err) {
      console.error('ProductShowcase realtime error:', err)
    }
  }, [])

  const handleAddToCart = (product: ShowcaseProductItem, e: React.MouseEvent) => {
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

  if (loading) {
    return (
      <section className="py-24 bg-white">
        <div className="container-custom section-padding flex justify-center">
          <div className="w-10 h-10 border-3 border-brand-blue/20 border-t-brand-blue rounded-full animate-spin" />
        </div>
      </section>
    )
  }

  if (products.length === 0) return null

  return (
    <section className="py-24 md:py-36 bg-slate-50 relative overflow-hidden">
      <div className="container-custom section-padding relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block text-xs font-extrabold uppercase tracking-[0.2em] text-brand-blue bg-brand-softBlue px-4 py-1.5 rounded-full border border-brand-blue/20 mb-3"
            >
              {content.badge}
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl font-black text-brand-navy tracking-tight"
            >
              {content.title}
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Link
              href="/urunler"
              className="inline-flex items-center gap-2 text-sm font-bold text-brand-blue hover:text-brand-navy transition-colors group"
            >
              <span>{content.buttonText}</span>
              <FiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </div>

        {/* Product Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
          {products.slice(0, 8).map((product, i) => {
            const img = product.images?.[0] || product.image
            const isAdded = addedId === product.id
            const discount = product.discountPrice
              ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
              : null

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
                className="group relative bg-white rounded-3xl p-5 border border-slate-200/80 hover:border-brand-blue/40 shadow-sm hover:shadow-xl hover:shadow-brand-blue/10 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Image Container with Badges */}
                  <div className="relative aspect-square w-full rounded-2xl bg-slate-50/80 p-4 mb-4 flex items-center justify-center overflow-hidden">
                    {/* Discount Badge */}
                    {discount && discount > 0 && (
                      <span className="absolute top-3 left-3 z-10 text-[10px] font-black uppercase tracking-wider text-white bg-red-500 px-2.5 py-1 rounded-full shadow-xs">
                        %{discount} İndirim
                      </span>
                    )}

                    {/* Stock Status */}
                    {product.inStock === false && (
                      <span className="absolute top-3 right-3 z-10 text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                        Tükendi
                      </span>
                    )}

                    {/* Product Image */}
                    <Link href={`/urunler/${product.id}`} className="relative w-full h-full block">
                      {img ? (
                        <Image
                          src={img}
                          alt={product.name}
                          fill
                          className="object-contain group-hover:scale-108 transition-transform duration-500"
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <FiShoppingBag className="w-12 h-12" />
                        </div>
                      )}
                    </Link>
                  </div>

                  {/* Category & Rating */}
                  <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                      {product.category?.replace(/-/g, ' ') || 'Dental Care'}
                    </span>
                    <div className="flex items-center gap-1 text-amber-500 font-bold text-[11px]">
                      <FiStar className="fill-amber-400 w-3 h-3" />
                      <span>{product.rating || '4.9'}</span>
                    </div>
                  </div>

                  {/* Product Title */}
                  <Link href={`/urunler/${product.id}`}>
                    <h3 className="text-base font-bold text-slate-900 line-clamp-1 group-hover:text-brand-blue transition-colors mb-2">
                      {product.name}
                    </h3>
                  </Link>

                  {/* Short Description */}
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                    {product.description || 'Klinik onaylı günlük ağız bakım diş fırçası.'}
                  </p>
                </div>

                {/* Price & Action Button */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div>
                    {product.discountPrice ? (
                      <div className="flex flex-col">
                        <span className="text-lg font-black text-brand-green leading-tight">
                          {product.discountPrice.toLocaleString('tr-TR')} ₺
                        </span>
                        <span className="text-[11px] text-slate-400 line-through leading-tight">
                          {product.price.toLocaleString('tr-TR')} ₺
                        </span>
                      </div>
                    ) : (
                      <span className="text-lg font-black text-brand-navy">
                        {product.price?.toLocaleString('tr-TR')} ₺
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleAddToCart(product, e)}
                    disabled={product.inStock === false}
                    className={`px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs ${
                      isAdded
                        ? 'bg-brand-green text-white shadow-brand-green/30'
                        : product.inStock === false
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-brand-softBlue text-brand-blue hover:bg-brand-blue hover:text-white'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <FiCheck className="w-4 h-4" />
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
              </motion.div>
            )
          })}
        </div>

        {/* Bottom Discover CTA */}
        <div className="mt-16 text-center">
          <Link
            href="/urunler"
            className="btn-primary inline-flex items-center gap-2 text-base py-4 px-10 shadow-md"
          >
            <span>Tüm Ürünleri Gör ({products.length})</span>
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>

      </div>
    </section>
  )
}
