'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiArrowRight, FiCheckCircle, FiShield, FiZap, FiShoppingBag, FiStar, FiChevronLeft, FiChevronRight } from 'react-icons/fi'
import Link from 'next/link'
import Image from 'next/image'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { addToCart } from '@/lib/utils/cart'
import { useRouter } from 'next/navigation'

export interface HeroProductData {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  description?: string
  images?: string[]
  image?: string
  category?: string
  rating?: number
  isPopular?: boolean
}

interface HeroSectionProps {
  featuredProducts: HeroProductData[]
  loading?: boolean
}

export default function HeroSection({ featuredProducts = [], loading }: HeroSectionProps) {
  const router = useRouter()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [content, setContent] = useState({
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
  })

  // Real-time siteContent/hero listener
  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const unsub = onSnapshot(doc(db, 'siteContent', 'hero'), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setContent((prev) => ({
            ...prev,
            badge: d.badge || prev.badge,
            title: d.title || prev.title,
            titleHighlight: d.titleHighlight || prev.titleHighlight,
            description: d.description || prev.description,
            primaryButtonText: d.primaryButtonText || prev.primaryButtonText,
            primaryButtonUrl: d.primaryButtonUrl || prev.primaryButtonUrl,
            secondaryButtonText: d.secondaryButtonText || prev.secondaryButtonText,
            pill1: d.pill1 || prev.pill1,
            pill2: d.pill2 || prev.pill2,
            pill3: d.pill3 || prev.pill3,
          }))
        }
      })
      return () => unsub()
    } catch (err) {
      console.error('Hero realtime error:', err)
    }
  }, [])

  // 5-Second rotation timer for featured products
  useEffect(() => {
    if (featuredProducts.length <= 1 || isPaused) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featuredProducts.length)
    }, 5000)

    // Handle tab visibility change (pause timer when tab is hidden)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setIsPaused(true)
      } else {
        setIsPaused(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [featuredProducts.length, isPaused])

  const scrollToCategories = () => {
    const el = document.getElementById('kategoriler')
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  const currentProduct = featuredProducts[currentIndex] || featuredProducts[0] || null
  const currentImage = currentProduct?.images?.[0] || currentProduct?.image || ''

  const handleQuickBuy = (product: HeroProductData, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    addToCart({
      productId: product.id,
      name: product.name,
      price: product.price,
      discountPrice: product.discountPrice,
      image: currentImage,
    })

    router.push('/satin-al')
  }

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center pt-28 pb-16 md:py-36 bg-gradient-to-b from-brand-softBlue/60 via-white to-slate-50/50 overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-brand-blue/12 via-cyan-400/10 to-brand-green/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-brand-green/8 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* Left Column: Headline, Subtext & CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 text-center lg:text-left flex flex-col items-center lg:items-start"
          >
            {/* Tagline Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-brand-blue/20 shadow-xs backdrop-blur-md mb-6"
            >
              <span className="w-2 h-2 rounded-full bg-brand-green animate-pulse" />
              <span className="text-xs font-bold tracking-wider text-brand-navy uppercase">
                {content.badge}
              </span>
            </motion.div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black text-brand-navy tracking-tight leading-[1.08] mb-6">
              {content.title} <br />
              <span className="text-gradient-brand">{content.titleHighlight}</span>
            </h1>

            {/* Subtext */}
            <p className="text-slate-600 text-base sm:text-lg md:text-xl max-w-xl font-normal leading-relaxed mb-8">
              {content.description}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-10">
              <Link
                href={content.primaryButtonUrl || '/urunler'}
                className="btn-primary w-full sm:w-auto flex items-center justify-center gap-2 group text-base py-4 px-8"
              >
                <span>{content.primaryButtonText}</span>
                <FiArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform" />
              </Link>

              <button
                onClick={scrollToCategories}
                className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2 text-base py-4 px-7"
              >
                {content.secondaryButtonText}
              </button>
            </div>

            {/* Trust Pills */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3 text-xs text-slate-700 font-semibold">
              <div className="flex items-center gap-1.5 bg-white/90 px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-xs">
                <FiCheckCircle className="text-brand-green w-4 h-4 flex-shrink-0" />
                <span>{content.pill1}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/90 px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-xs">
                <FiShield className="text-brand-blue w-4 h-4 flex-shrink-0" />
                <span>{content.pill2}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-white/90 px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-xs">
                <FiZap className="text-cyan-500 w-4 h-4 flex-shrink-0" />
                <span>{content.pill3}</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: 5-Second Rotating Real Featured Product Spotlight Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex justify-center w-full"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          >
            <div className="relative w-full max-w-md">
              {/* Decorative Ambient Background Ring */}
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-blue/20 to-brand-green/20 rounded-[2.5rem] blur-2xl -rotate-3 scale-95" />

              {/* Product Hero Card */}
              <div className="relative bg-white/95 backdrop-blur-xl rounded-[2.5rem] p-6 sm:p-8 border border-white/80 shadow-2xl shadow-slate-200/60 overflow-hidden group">
                
                {/* Top Badge, Carousel Pagination Dots & Rating */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand-green bg-brand-softGreen px-3 py-1 rounded-full border border-brand-green/20">
                      Öne Çıkan Ürün
                    </span>
                    {featuredProducts.length > 1 && (
                      <div className="flex items-center gap-1.5 ml-1">
                        {featuredProducts.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentIndex(i)}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              i === currentIndex
                                ? 'w-5 bg-brand-blue'
                                : 'w-1.5 bg-slate-200 hover:bg-slate-300'
                            }`}
                            aria-label={`Slayt ${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-amber-500 text-xs font-bold bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200/60">
                    <FiStar className="fill-amber-400 w-3.5 h-3.5" />
                    <span>4.9 / 5.0</span>
                  </div>
                </div>

                {/* Floating Product Image Display with Crossfade Transition */}
                <div className="relative h-64 sm:h-72 w-full flex items-center justify-center my-2 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentProduct?.id || currentIndex}
                      initial={{ opacity: 0, scale: 0.9, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                      className="relative w-full h-full flex items-center justify-center"
                    >
                      {currentImage ? (
                        <Image
                          src={currentImage}
                          alt={currentProduct?.name || 'Gülümse Diş Fırçası'}
                          fill
                          className="object-contain drop-shadow-2xl group-hover:scale-105 transition-transform duration-500"
                          priority
                          sizes="(max-width: 768px) 100vw, 400px"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl">
                          <FiShoppingBag className="w-16 h-16 text-slate-300 mb-2" />
                          <span className="text-xs font-medium">Gülümse Dental Care</span>
                        </div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Product Info & Direct Buy / Detail Actions */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentProduct?.id || currentIndex}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3 }}
                    className="mt-4 pt-4 border-t border-slate-100"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="text-xl font-bold text-brand-navy truncate">
                        {currentProduct?.name || 'Otomatik Sonic Diş Fırçası'}
                      </h3>
                      {currentProduct?.category && (
                        <span className="text-[10px] font-bold text-brand-blue bg-brand-softBlue px-2 py-0.5 rounded-md flex-shrink-0">
                          {currentProduct.category.replace(/-/g, ' ')}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-1 mb-4">
                      {currentProduct?.description || 'Yüksek frekanslı sonic titreşim ve medikal başlık.'}
                    </p>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        {currentProduct?.discountPrice ? (
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-brand-green">
                              {currentProduct.discountPrice.toLocaleString('tr-TR')} ₺
                            </span>
                            <span className="text-xs text-slate-400 line-through">
                              {currentProduct.price.toLocaleString('tr-TR')} ₺
                            </span>
                          </div>
                        ) : (
                          <span className="text-2xl font-black text-brand-navy">
                            {(currentProduct?.price || 499).toLocaleString('tr-TR')} ₺
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {currentProduct && (
                          <button
                            onClick={(e) => handleQuickBuy(currentProduct, e)}
                            className="px-4 py-2.5 bg-brand-green hover:bg-emerald-600 text-white rounded-full text-xs font-bold shadow-md shadow-brand-green/20 transition-all flex items-center gap-1.5"
                          >
                            <FiShoppingBag className="w-3.5 h-3.5" />
                            <span>Hemen Satın Al</span>
                          </button>
                        )}

                        <Link
                          href={currentProduct ? `/urunler/${currentProduct.id}` : '/urunler'}
                          className="btn-secondary text-xs py-2.5 px-4 flex items-center gap-1 shadow-xs"
                        >
                          <span>İncele</span>
                          <FiArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                </AnimatePresence>

              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  )
}
