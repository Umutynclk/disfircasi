'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { FiShoppingBag, FiCheck, FiArrowRight } from 'react-icons/fi'
import { addToCart } from '@/lib/utils/cart'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { useLocale } from '@/context/LocaleContext'

export interface ShowcaseProductItem {
  id: string
  name: any
  price: number
  discountPrice?: number | null
  discountPercentage?: number | null
  priceUSD?: number | null
  discountPriceUSD?: number | null
  priceEUR?: number | null
  discountPriceEUR?: number | null
  image?: string
  images?: string[]
  description?: any
  category?: string
  inStock?: boolean
  rating?: number
}

interface ProductOptionsSectionProps {
  products: ShowcaseProductItem[]
  loading?: boolean
}

export default function ProductOptionsSection({ products, loading }: ProductOptionsSectionProps) {
  const { locale, t, getLocalizedText, getLocalizedPath, formatPriceWithCurrency } = useLocale()
  const [addedId, setAddedId] = useState<string | null>(null)
  const [content, setContent] = useState<any>({
    badge: null,
    title: null,
    buttonText: null,
  })

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const unsub = onSnapshot(doc(db, 'siteContent', 'productShowcase'), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setContent((prev: any) => ({
            ...prev,
            badge: d.badge,
            title: d.title,
            buttonText: d.buttonText,
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
      name: getLocalizedText(product.name, typeof product.name === 'string' ? product.name : 'Ürün'),
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
          <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin" />
        </div>
      </section>
    )
  }

  if (products.length === 0) return null

  // Section badge & title: Use localized dictionary by default or custom localized object
  const sectionBadge = typeof content.badge === 'object' && content.badge !== null
    ? getLocalizedText(content.badge, t.productsSection.badge)
    : (locale === 'tr' ? (content.badge || t.productsSection.badge) : t.productsSection.badge)

  const sectionTitle = typeof content.title === 'object' && content.title !== null
    ? getLocalizedText(content.title, t.productsSection.title)
    : (locale === 'tr' ? (content.title || t.productsSection.title) : t.productsSection.title)

  return (
    <section className="py-20 md:py-32 bg-slate-50 relative overflow-hidden">
      <div className="container-custom section-padding relative z-10">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <motion.span
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-block text-xs sm:text-sm font-black uppercase tracking-[0.2em] text-sky-600 bg-sky-100 px-4 py-2 rounded-full border border-sky-200 mb-3"
            >
              {sectionBadge}
            </motion.span>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight"
            >
              {sectionTitle}
            </motion.h2>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <Link
              href={getLocalizedPath('/urunler')}
              className="inline-flex items-center gap-2 text-base font-bold text-sky-600 hover:text-slate-900 transition-colors group"
            >
              <span>{t.productsSection.viewAll}</span>
              <FiArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </motion.div>
        </div>

        {/* Product Cards Grid - Substantially Bigger Cards (1-3 Columns Layout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 sm:gap-10">
          {products.slice(0, 6).map((product, i) => {
            const img = product.images?.[0] || product.image
            const isAdded = addedId === product.id
            const discount = product.discountPrice
              ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
              : null
            const prodTitle = getLocalizedText(product.name, typeof product.name === 'string' ? product.name : 'Ürün')
            const prodDesc = getLocalizedText(product.description, typeof product.description === 'string' ? product.description : '')

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group relative bg-white rounded-[2.5rem] p-7 sm:p-8 border-2 border-slate-200/80 hover:border-sky-300 shadow-md hover:shadow-2xl hover:shadow-sky-100/60 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Large Image Container with Badges */}
                  <div className="relative w-full h-[280px] sm:h-[340px] rounded-3xl bg-gradient-to-b from-slate-50 via-slate-100/60 to-sky-50/30 p-6 mb-6 flex items-center justify-center overflow-hidden border border-slate-100">
                    {/* Discount Badge */}
                    {discount && discount > 0 && (
                      <span className="absolute top-4 left-4 z-10 text-xs font-black uppercase tracking-wider text-white bg-rose-500 px-3.5 py-1.5 rounded-full shadow-md">
                        %{discount} İNDİRİM
                      </span>
                    )}

                    {/* Stock Status */}
                    {product.inStock === false && (
                      <span className="absolute top-4 right-4 z-10 text-xs font-bold text-slate-500 bg-slate-200 px-3 py-1 rounded-full">
                        {t.productsSection.outOfStock}
                      </span>
                    )}

                    {/* Product Image */}
                    <Link href={`${getLocalizedPath('/urunler')}/${product.id}`} className="relative w-full h-full block">
                      {img ? (
                        <Image
                          src={img}
                          alt={prodTitle}
                          fill
                          className="object-contain p-2 group-hover:scale-108 transition-transform duration-700 drop-shadow-md"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <FiShoppingBag className="w-16 h-16" />
                        </div>
                      )}
                    </Link>
                  </div>

                  {/* Category */}
                  <div className="flex items-center text-xs sm:text-sm text-slate-500 mb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-sky-600 bg-sky-50 px-3 py-1 rounded-full border border-sky-200/60">
                      {product.category?.replace(/-/g, ' ') || 'Dental Care'}
                    </span>
                  </div>

                  {/* Big Product Title */}
                  <Link href={`${getLocalizedPath('/urunler')}/${product.id}`}>
                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 line-clamp-1 group-hover:text-sky-600 transition-colors mb-2 mt-2">
                      {prodTitle}
                    </h3>
                  </Link>

                  {/* Short Description */}
                  <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-6 font-normal">
                    {prodDesc || t.features.f1Desc}
                  </p>
                </div>

                {/* Card Bottom: Big Price & Action Button */}
                <div className="pt-6 border-t border-slate-100 flex items-center justify-between gap-4">
                  <div>
                    {product.discountPrice ? (
                      <div className="flex flex-col">
                        <span className="text-2xl sm:text-3xl font-black text-emerald-600 leading-tight">
                          {formatPriceWithCurrency(product.discountPrice, product.discountPriceUSD, product.discountPriceEUR)}
                        </span>
                        <span className="text-sm text-slate-400 line-through leading-tight mt-0.5">
                          {formatPriceWithCurrency(product.price, product.priceUSD, product.priceEUR)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-2xl sm:text-3xl font-black text-slate-900">
                        {formatPriceWithCurrency(product.price, product.priceUSD, product.priceEUR)}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleAddToCart(product, e)}
                    disabled={product.inStock === false}
                    className={`px-6 py-3.5 rounded-full text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md ${
                      isAdded
                        ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                        : product.inStock === false
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        : 'bg-sky-600 text-white hover:bg-sky-700 hover:shadow-sky-600/30 hover:scale-104'
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <FiCheck className="w-4 h-4" />
                        <span>{t.productsSection.addedToCart}</span>
                      </>
                    ) : (
                      <>
                        <FiShoppingBag className="w-4 h-4" />
                        <span>{t.productsSection.addToCart}</span>
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
            href={getLocalizedPath('/urunler')}
            className="inline-flex items-center gap-3 text-sm sm:text-base font-black uppercase tracking-wider py-4.5 px-12 rounded-full bg-slate-900 hover:bg-slate-800 text-white shadow-2xl hover:scale-104 transition-all"
          >
            <span>{t.productsSection.viewAll} ({products.length})</span>
            <FiArrowRight className="w-5 h-5" />
          </Link>
        </div>

      </div>
    </section>
  )
}
