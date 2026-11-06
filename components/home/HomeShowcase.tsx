'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'

import {
  FiChevronLeft,
  FiChevronRight,
  FiSmile,
  FiHeart,
  FiShield,
  FiCheckCircle,
  FiArrowRight,
  FiZap,
  FiShoppingBag,
} from 'react-icons/fi'

import {
  HomepageShowcaseConfig,
  DEFAULT_HOMEPAGE_SHOWCASE,
  subscribeToHomepageShowcase,
  subscribeToSection,
  DynamicSectionItem,
} from '@/lib/firebase/content'
import { useLocale } from '@/context/LocaleContext'

// Large SVG Icons for the bottom trust bar
function ToothIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 3C4.24 3 2 5.24 2 8c0 3.5 2 7 3.5 10.5C6.5 20.5 7.5 22 9 22c1.2 0 2-.8 2.5-2 .4-1 .6-2.5 1-2.5s.6 1.5 1 2.5c.5 1.2 1.3 2 2.5 2 1.5 0 2.5-1.5 3.5-3.5C20 15 22 11.5 22 8c0-2.76-2.24-5-5-5-2.5 0-3.5 1.8-5 1.8S9.5 3 7 3z" />
      <path d="M9 8.5c1 .5 2 0 3-1" />
    </svg>
  )
}

function LeafIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}

function AirplaneIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3.5c-.5-.5-2.5 0-4 1.5L13.5 8.5 5.3 6.7c-.8-.2-1.6.2-2 .9-.4.7-.2 1.6.4 2.1l4.8 3.8-2 2-2.5-.5c-.4-.1-.8.1-1.1.4l-.6.6 2.7 1.8 1.8 2.7.6-.6c.3-.3.5-.7.4-1.1l-.5-2.5 2-2 3.8 4.8c.5.6 1.4.8 2.1.4.7-.4 1.1-1.2.9-2z" />
    </svg>
  )
}

export interface ShowcaseResolvedProduct {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  image?: string
  images?: string[]
  category?: string
  description?: string
  inStock?: boolean
  features?: string[]
  // Overrides
  overrideTitle?: any
  overrideSubtitle?: any
  overrideDescription?: any
  overrideImage?: string
  overrideBadge?: any
  overrideCtaText?: any
  overrideCtaUrl?: string
  overrideFeatures?: string[]
}

interface HomeShowcaseProps {
  products?: any[]
  loading?: boolean
}

export default function HomeShowcase({ products = [], loading = false }: HomeShowcaseProps) {
  const { locale, t, getLocalizedText, getLocalizedPath, formatPriceWithCurrency } = useLocale()

  const [config, setConfig] = useState<HomepageShowcaseConfig>(DEFAULT_HOMEPAGE_SHOWCASE)
  const [dynamicFeatures, setDynamicFeatures] = useState<DynamicSectionItem[]>([])
  
  // Independent active index state for left and right columns
  const [leftIndex, setLeftIndex] = useState(0)
  const [rightIndex, setRightIndex] = useState(0)
  
  // Pause states
  const [leftPaused, setLeftPaused] = useState(false)
  const [rightPaused, setRightPaused] = useState(false)
  const [tabVisible, setTabVisible] = useState(true)

  // Direct checkout handler removed - showcase now uses "Ürünleri Gör" category links

  // Real-time Firestore subscription to homepage showcase config
  useEffect(() => {
    const unsub = subscribeToHomepageShowcase((newConfig) => {
      setConfig(newConfig)
    })
    return () => unsub()
  }, [])

  // Real-time Firestore subscription to dynamic homepage features
  useEffect(() => {
    const unsubFeatures = subscribeToSection(
      'homepageFeatures',
      (secData) => {
        if (secData.items && secData.items.length > 0) {
          setDynamicFeatures(secData.items.filter((i) => i.active !== false))
        }
      },
      {
        items: [
          { id: 'f1', title: t.features.f1Title, description: t.features.f1Desc, extra: { icon: 'tooth' }, order: 1, active: true },
          { id: 'f2', title: t.features.f2Title, description: t.features.f2Desc, extra: { icon: 'leaf' }, order: 2, active: true },
          { id: 'f3', title: t.features.f3Title, description: t.features.f3Desc, extra: { icon: 'heart' }, order: 3, active: true },
          { id: 'f4', title: t.features.f4Title, description: t.features.f4Desc, extra: { icon: 'airplane' }, order: 4, active: true },
          { id: 'f5', title: t.features.f5Title, description: t.features.f5Desc, extra: { icon: 'smile' }, order: 5, active: true },
        ],
      }
    )
    return () => unsubFeatures()
  }, [t])

  // Visibility state listener (pause rotation when tab is hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      setTabVisible(!document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Resolve Left Items (Automatic Sonic Brushes)
  const leftProducts: ShowcaseResolvedProduct[] = useMemo(() => {
    const sideConfig = config.left
    if (sideConfig.items && sideConfig.items.length > 0) {
      return sideConfig.items
        .filter((item) => item.active !== false)
        .map((item) => {
          const matchedProd = products.find((p) => p.id === item.productId)
          return {
            id: item.productId || item.id,
            name: matchedProd?.name || t.showcase.leftCategorySubtitle,
            price: matchedProd?.price || 1299,
            discountPrice: matchedProd?.discountPrice || 899,
            image: matchedProd?.images?.[0] || matchedProd?.image || '/products/automatic-brush.png',
            images: matchedProd?.images || [],
            category: matchedProd?.category || 'otomatik',
            description: matchedProd?.description || sideConfig.description || t.showcase.leftDefaultDesc,
            inStock: matchedProd?.inStock !== false,
            features: matchedProd?.features || ['360° Sonic', '45 Gün Pil Ömrü'],
            overrideTitle: item.overrideTitle,
            overrideSubtitle: item.overrideSubtitle,
            overrideDescription: item.overrideDescription,
            overrideImage: item.overrideImage,
            overrideBadge: item.overrideBadge,
            overrideCtaText: item.overrideCtaText,
            overrideCtaUrl: item.overrideCtaUrl,
            overrideFeatures: item.features && item.features.length > 0 ? item.features : undefined,
          }
        })
    }

    // Dynamic Fallback from raw products collection
    const autoList = products.filter(
      (p) =>
        p.category === 'otomatik' ||
        p.category === 'elektrikli-disfircasi' ||
        p.name?.toLowerCase().includes('otomatik') ||
        p.name?.toLowerCase().includes('sonic') ||
        p.name?.toLowerCase().includes('360')
    )

    if (autoList.length > 0) {
      return autoList.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price || 1299,
        discountPrice: p.discountPrice,
        image: p.images?.[0] || p.image || '/products/automatic-brush.png',
        images: p.images || [],
        category: p.category,
        description: p.description || t.showcase.leftDefaultDesc,
        inStock: p.inStock !== false,
        features: p.features || ['360° Sonic', 'IPX7 Su Geçirmez'],
      }))
    }

    return [
      {
        id: 'default_auto_1',
        name: '360° Sonic Otomatik Diş Fırçası Pro',
        price: 1299,
        discountPrice: 899,
        image: '',
        category: 'otomatik',
        description: t.showcase.leftDefaultDesc,
        features: ['360° Sonic', '45 Gün Pil Ömrü'],
      },
    ]
  }, [config.left, products, t])

  // Resolve Right Items (Disposable / Refill Brushes)
  const rightProducts: ShowcaseResolvedProduct[] = useMemo(() => {
    const sideConfig = config.right
    if (sideConfig.items && sideConfig.items.length > 0) {
      return sideConfig.items
        .filter((item) => item.active !== false)
        .map((item) => {
          const matchedProd = products.find((p) => p.id === item.productId)
          return {
            id: item.productId || item.id,
            name: matchedProd?.name || t.showcase.rightCategorySubtitle,
            price: matchedProd?.price || 249,
            discountPrice: matchedProd?.discountPrice || 179,
            image: matchedProd?.images?.[0] || matchedProd?.image || '/products/disposable-brush.png',
            images: matchedProd?.images || [],
            category: matchedProd?.category || 'kullan-at',
            description: matchedProd?.description || sideConfig.description || t.showcase.rightDefaultDesc,
            inStock: matchedProd?.inStock !== false,
            features: matchedProd?.features || ['%100 Hijyenik Tekli Paket', 'Kendinden Macunlu Pratiklik'],
            overrideTitle: item.overrideTitle,
            overrideSubtitle: item.overrideSubtitle,
            overrideDescription: item.overrideDescription,
            overrideImage: item.overrideImage,
            overrideBadge: item.overrideBadge,
            overrideCtaText: item.overrideCtaText,
            overrideCtaUrl: item.overrideCtaUrl,
            overrideFeatures: item.features && item.features.length > 0 ? item.features : undefined,
          }
        })
    }

    // Dynamic Fallback from raw products collection
    const dispList = products.filter(
      (p) =>
        p.category === 'kullan-at' ||
        p.category === 'kullanat' ||
        p.category === 'yedek-firca-basliklari' ||
        p.name?.toLowerCase().includes('kullan') ||
        p.name?.toLowerCase().includes('seyahat') ||
        p.name?.toLowerCase().includes('başlık')
    )

    if (dispList.length > 0) {
      return dispList.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price || 249,
        discountPrice: p.discountPrice,
        image: p.images?.[0] || p.image || '/products/disposable-brush.png',
        images: p.images || [],
        category: p.category,
        description: p.description || t.showcase.rightDefaultDesc,
        inStock: p.inStock !== false,
        features: p.features || ['%100 Hijyenik', 'Seyahat Boyu'],
      }))
    }

    return [
      {
        id: 'default_disp_1',
        name: 'Başlık Değişmeli Hijyenik Diş Fırçası',
        price: 249,
        discountPrice: 179,
        image: '',
        category: 'kullan-at',
        description: t.showcase.rightDefaultDesc,
        features: ['Başlık Değişmeli Pratik Sistem'],
      },
    ]
  }, [config.right, products, t])

  // Ensure indices are within bounds
  useEffect(() => {
    if (leftIndex >= leftProducts.length && leftProducts.length > 0) setLeftIndex(0)
  }, [leftProducts.length, leftIndex])

  useEffect(() => {
    if (rightIndex >= rightProducts.length && rightProducts.length > 0) setRightIndex(0)
  }, [rightProducts.length, rightIndex])

  // Rotation Timer for LEFT Column (5 seconds)
  useEffect(() => {
    if (!config.autoplay || leftProducts.length <= 1 || leftPaused || !tabVisible || config.active === false) return
    const intervalMs = (config.autoplaySeconds || 5) * 1000
    const timer = setInterval(() => {
      setLeftIndex((prev) => (prev + 1) % leftProducts.length)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [config.autoplay, config.autoplaySeconds, config.active, leftProducts.length, leftPaused, tabVisible])

  // Rotation Timer for RIGHT Column (5 seconds)
  useEffect(() => {
    if (!config.autoplay || rightProducts.length <= 1 || rightPaused || !tabVisible || config.active === false) return
    const intervalMs = (config.autoplaySeconds || 5) * 1000
    const timer = setInterval(() => {
      setRightIndex((prev) => (prev + 1) % rightProducts.length)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [config.autoplay, config.autoplaySeconds, config.active, rightProducts.length, rightPaused, tabVisible])

  const currentLeft = leftProducts[leftIndex] || leftProducts[0]
  const currentRight = rightProducts[rightIndex] || rightProducts[0]

  const leftImageSrc = currentLeft?.overrideImage || currentLeft?.images?.[0] || currentLeft?.image || ''
  const rightImageSrc = currentRight?.overrideImage || currentRight?.images?.[0] || currentRight?.image || ''

  // Texts strictly localized by current active locale
  const leftBadge = typeof currentLeft?.overrideBadge === 'object'
    ? getLocalizedText(currentLeft.overrideBadge, t.showcase.leftTitleBadge)
    : (locale === 'tr' ? (currentLeft?.overrideBadge || config.left.badge || t.showcase.leftTitleBadge) : t.showcase.leftTitleBadge)

  const leftSubtitle = typeof currentLeft?.overrideSubtitle === 'object'
    ? getLocalizedText(currentLeft.overrideSubtitle, t.showcase.leftCategorySubtitle)
    : (locale === 'tr' ? (currentLeft?.overrideSubtitle || config.left.subtitle || t.showcase.leftCategorySubtitle) : t.showcase.leftCategorySubtitle)

  const leftDesc = typeof currentLeft?.overrideDescription === 'object'
    ? getLocalizedText(currentLeft.overrideDescription, t.showcase.leftDefaultDesc)
    : (locale === 'tr' ? (currentLeft?.overrideDescription || currentLeft?.description || config.left.description || t.showcase.leftDefaultDesc) : t.showcase.leftDefaultDesc)

  const leftCtaText = typeof currentLeft?.overrideCtaText === 'object'
    ? getLocalizedText(currentLeft.overrideCtaText, t.showcase.buyNow)
    : (locale === 'tr' ? (currentLeft?.overrideCtaText || config.left.ctaText || t.showcase.buyNow) : t.showcase.buyNow)

  const leftCtaUrl = currentLeft?.overrideCtaUrl || config.left.ctaUrl || `${getLocalizedPath('/urunler')}?kategori=otomatik`

  const rightBadge = typeof currentRight?.overrideBadge === 'object'
    ? getLocalizedText(currentRight.overrideBadge, t.showcase.rightTitleBadge)
    : (locale === 'tr' ? (currentRight?.overrideBadge || config.right.badge || t.showcase.rightTitleBadge) : t.showcase.rightTitleBadge)

  const rightSubtitle = typeof currentRight?.overrideSubtitle === 'object'
    ? getLocalizedText(currentRight.overrideSubtitle, t.showcase.rightCategorySubtitle)
    : (locale === 'tr' ? (currentRight?.overrideSubtitle || config.right.subtitle || t.showcase.rightCategorySubtitle) : t.showcase.rightCategorySubtitle)

  const rightDesc = typeof currentRight?.overrideDescription === 'object'
    ? getLocalizedText(currentRight.overrideDescription, t.showcase.rightDefaultDesc)
    : (locale === 'tr' ? (currentRight?.overrideDescription || currentRight?.description || config.right.description || t.showcase.rightDefaultDesc) : t.showcase.rightDefaultDesc)

  const rightCtaText = typeof currentRight?.overrideCtaText === 'object'
    ? getLocalizedText(currentRight.overrideCtaText, t.showcase.buyNow)
    : (locale === 'tr' ? (currentRight?.overrideCtaText || config.right.ctaText || t.showcase.buyNow) : t.showcase.buyNow)

  const rightCtaUrl = currentRight?.overrideCtaUrl || config.right.ctaUrl || `${getLocalizedPath('/urunler')}?kategori=kullan-at`

  const featuresList = dynamicFeatures.length > 0 ? dynamicFeatures : [
    { id: 'f1', title: t.features.f1Title, description: t.features.f1Desc, extra: { icon: 'tooth' }, order: 1, active: true },
    { id: 'f2', title: t.features.f2Title, description: t.features.f2Desc, extra: { icon: 'leaf' }, order: 2, active: true },
    { id: 'f3', title: t.features.f3Title, description: t.features.f3Desc, extra: { icon: 'heart' }, order: 3, active: true },
    { id: 'f4', title: t.features.f4Title, description: t.features.f4Desc, extra: { icon: 'airplane' }, order: 4, active: true },
    { id: 'f5', title: t.features.f5Title, description: t.features.f5Desc, extra: { icon: 'smile' }, order: 5, active: true },
  ]

  return (
    <section className="relative w-full bg-slate-50/50 overflow-hidden pt-2 sm:pt-4 pb-6 sm:pb-8">
      
      {/* Background Subtle Organic Brand Wave Curves */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
        <div className="absolute -top-10 -left-20 w-[600px] h-[600px] bg-sky-200/25 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -right-20 w-[600px] h-[600px] bg-emerald-200/25 rounded-full blur-3xl" />

        {/* Dynamic Curved Accent Line */}
        <svg className="absolute bottom-6 left-0 right-0 w-full h-36 opacity-30 pointer-events-none" viewBox="0 0 1440 240" fill="none" preserveAspectRatio="none">
          <path d="M0,120 C360,200 480,-20 720,120 C960,260 1080,40 1440,140 L1440,240 L0,240 Z" fill="url(#dualWaveGrad)" />
          <defs>
            <linearGradient id="dualWaveGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0284c7" stopOpacity="0.4" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.4" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="container-custom section-padding relative z-10">

        {/* ======================================================== */}
        {/* DUAL COLUMN SHOWCASE GRID (Connected & Above-the-Fold)    */}
        {/* ======================================================== */}
        <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 lg:gap-6 items-stretch">
          
          {/* ======================================================== */}
          {/* 1. LEFT COLUMN: OTOMATİK DİŞ FIRÇASI (Blue / Cyan Theme)  */}
          {/* ======================================================== */}
          <div
            onMouseEnter={() => setLeftPaused(true)}
            onMouseLeave={() => setLeftPaused(false)}
            onTouchStart={() => setLeftPaused(true)}
            onTouchEnd={() => setLeftPaused(false)}
            className="group relative bg-gradient-to-br from-white via-sky-50/50 to-blue-50/40 rounded-3xl sm:rounded-[2.25rem] p-5 sm:p-7 xl:p-8 border-2 border-sky-100/90 shadow-md hover:shadow-2xl hover:shadow-sky-100/80 transition-all duration-500 flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient Lighting Background */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-sky-200/40 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />

            {/* Left Header Info */}
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-[11px] sm:text-xs font-black tracking-wider text-sky-600 uppercase bg-sky-100/80 px-3 py-1 rounded-full border border-sky-200/60">
                  {leftBadge}
                </span>

                {/* Dots indicator for rotation */}
                {leftProducts.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full border border-sky-100 shadow-2xs">
                    {leftProducts.map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        onClick={() => setLeftIndex(dotIdx)}
                        className={`transition-all duration-300 rounded-full ${
                          leftIndex === dotIdx ? 'w-5 h-2 bg-sky-600' : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                        }`}
                        aria-label={`Ürün ${dotIdx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Subtitle / Big Category Title */}
              <h2 className="text-2xl sm:text-3xl lg:text-3.5xl xl:text-4xl font-black text-slate-900 tracking-tight leading-tight mb-1">
                {leftSubtitle}
              </h2>

              {/* 360° Circular Dynamic Badge / Title */}
              <div className="relative inline-flex items-center gap-3 my-1">
                <div className="relative flex items-center justify-center">
                  <div className="text-3xl sm:text-4xl lg:text-4.5xl font-black text-sky-600 tracking-tighter">
                    360°
                  </div>
                  <div className="absolute -inset-1.5 border-2 border-dashed border-sky-400 rounded-full animate-spin-slow opacity-60 pointer-events-none" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-black text-slate-900 tracking-wider uppercase leading-tight">
                    {t.showcase.leftHighlight}
                  </span>
                  <span className="text-xs sm:text-sm font-black text-slate-700 tracking-wider uppercase leading-tight">
                    {t.showcase.leftHighlightSub}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-md mt-0.5 line-clamp-2">
                {leftDesc}
              </p>
            </div>

            {/* ======================================================== */}
            {/* HERO PRODUCT VISUAL: COMPACT SCALED (Fully Visible)     */}
            {/* ======================================================== */}
            <div className="relative z-10 my-2 sm:my-3 flex items-center justify-center min-h-[190px] sm:min-h-[240px] lg:min-h-[270px] xl:min-h-[300px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentLeft?.id || leftIndex}
                  initial={{ opacity: 0, scale: 0.92, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -10 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="relative w-full h-[180px] sm:h-[230px] lg:h-[260px] xl:h-[290px] flex items-center justify-center"
                >
                  {/* Decorative Sonic Splash Halo Behind Hero Brush */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-85">
                    <div className="w-48 h-48 sm:w-64 sm:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 rounded-full border-2 border-sky-200/60 bg-gradient-to-tr from-sky-100/50 via-white to-sky-50/30 shadow-inner" />
                  </div>

                  {leftImageSrc ? (
                    <div className="relative w-full h-full max-h-[290px] flex items-center justify-center p-2">
                      <Image
                        src={leftImageSrc}
                        alt={leftSubtitle}
                        fill
                        className="object-contain drop-shadow-[0_15px_30px_rgba(2,132,199,0.22)] group-hover:scale-105 transition-transform duration-700"
                        priority
                        sizes="(max-width: 768px) 100vw, 550px"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-sky-600 gap-2">
                      <div className="w-24 h-24 rounded-2xl bg-sky-100/90 flex items-center justify-center text-3xl font-black shadow-lg">
                        360°
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-600">360° Sonic Otomatik Seri</span>
                    </div>
                  )}

                {/* Price Tag Overlay REMOVED per design spec – showcase = category explorer, not direct buy */}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Left Column Bottom Action: "Ürünleri Gör" → Category page */}
            <div className="relative z-10 pt-3 flex items-center justify-between gap-3 border-t border-sky-100/80">
              <Link
                href={leftCtaUrl}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 sm:px-9 sm:py-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-full font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 shadow-lg shadow-sky-600/25 hover:scale-105 active:scale-95 cursor-pointer"
              >
                <FiArrowRight className="w-4 h-4" />
                <span>{t.showcase.viewProducts}</span>
              </Link>

              {/* Prev / Next manual controls */}
              {leftProducts.length > 1 && (
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    onClick={() => setLeftIndex((prev) => (prev - 1 + leftProducts.length) % leftProducts.length)}
                    className="p-2.5 rounded-full bg-white text-slate-700 hover:text-sky-600 hover:bg-sky-50 border border-sky-100 transition-colors shadow-2xs"
                    aria-label="Önceki Ürün"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setLeftIndex((prev) => (prev + 1) % leftProducts.length)}
                    className="p-2.5 rounded-full bg-white text-slate-700 hover:text-sky-600 hover:bg-sky-50 border border-sky-100 transition-colors shadow-2xs"
                    aria-label="Sonraki Ürün"
                  >
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* CENTER DIVIDER: "VEYA" (Single Connected Composition)    */}
          {/* ======================================================== */}
          <div className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex-col items-center pointer-events-none">
            <div className="w-1 h-32 bg-gradient-to-b from-sky-400/80 via-sky-500 to-slate-400 rounded-full" />
            <div className="my-2 w-14 h-14 rounded-full bg-white border-3 border-slate-200 shadow-xl flex items-center justify-center text-slate-800 font-black text-xs uppercase tracking-widest pointer-events-auto hover:scale-110 transition-transform duration-300 ring-4 ring-sky-50">
              {t.showcase.or}
            </div>
            <div className="w-1 h-32 bg-gradient-to-b from-slate-400 via-emerald-500 to-emerald-400/80 rounded-full" />
          </div>

          {/* ======================================================== */}
          {/* 2. RIGHT COLUMN: KULLAN AT DİŞ FIRÇASI (Green / White)   */}
          {/* ======================================================== */}
          <div
            onMouseEnter={() => setRightPaused(true)}
            onMouseLeave={() => setRightPaused(false)}
            onTouchStart={() => setRightPaused(true)}
            onTouchEnd={() => setRightPaused(false)}
            className="group relative bg-gradient-to-br from-white via-emerald-50/50 to-teal-50/40 rounded-3xl sm:rounded-[2.25rem] p-5 sm:p-7 xl:p-8 border-2 border-emerald-100/90 shadow-md hover:shadow-2xl hover:shadow-emerald-100/80 transition-all duration-500 flex flex-col justify-between overflow-hidden"
          >
            {/* Ambient Lighting Background */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-200/40 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-700" />

            {/* Right Header Info */}
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <span className="text-[11px] sm:text-xs font-black tracking-wider text-emerald-600 uppercase bg-emerald-100/80 px-3 py-1 rounded-full border border-emerald-200/60">
                  {rightBadge}
                </span>

                {/* Dots indicator for rotation */}
                {rightProducts.length > 1 && (
                  <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full border border-emerald-100 shadow-2xs">
                    {rightProducts.map((_, dotIdx) => (
                      <button
                        key={dotIdx}
                        onClick={() => setRightIndex(dotIdx)}
                        className={`transition-all duration-300 rounded-full ${
                          rightIndex === dotIdx ? 'w-5 h-2 bg-emerald-600' : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                        }`}
                        aria-label={`Ürün ${dotIdx + 1}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Subtitle / Big Category Title */}
              <h2 className="text-2xl sm:text-3xl lg:text-3.5xl xl:text-4xl font-black text-slate-900 tracking-tight leading-tight mb-1">
                {rightSubtitle}
              </h2>

              {/* Highlight Subheading */}
              <div className="relative inline-flex flex-col my-1">
                <span className="text-base sm:text-lg lg:text-xl font-black text-emerald-600 tracking-tight uppercase leading-tight">
                  {t.showcase.rightHighlight}
                </span>
                <span className="text-base sm:text-lg lg:text-xl font-black text-slate-800 tracking-tight uppercase leading-tight">
                  {t.showcase.rightHighlightSub}
                </span>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-slate-600 font-medium leading-relaxed max-w-md mt-0.5 line-clamp-2">
                {rightDesc}
              </p>
            </div>

            {/* ======================================================== */}
            {/* HERO PRODUCT VISUAL: COMPACT SCALED (Fully Visible)     */}
            {/* ======================================================== */}
            <div className="relative z-10 my-2 sm:my-3 flex items-center justify-center min-h-[190px] sm:min-h-[240px] lg:min-h-[270px] xl:min-h-[300px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentRight?.id || rightIndex}
                  initial={{ opacity: 0, scale: 0.92, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -10 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="relative w-full h-[180px] sm:h-[230px] lg:h-[260px] xl:h-[290px] flex items-center justify-center"
                >
                  {/* Decorative Glow Halo Behind Disposable Brushes */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-85">
                    <div className="w-48 h-48 sm:w-64 sm:h-64 lg:w-72 lg:h-72 xl:w-80 xl:h-80 rounded-full border-2 border-emerald-200/60 bg-gradient-to-tr from-emerald-100/50 via-white to-emerald-50/30 shadow-inner" />
                  </div>

                  {rightImageSrc ? (
                    <div className="relative w-full h-full max-h-[290px] flex items-center justify-center p-2">
                      <Image
                        src={rightImageSrc}
                        alt={rightSubtitle}
                        fill
                        className="object-contain drop-shadow-[0_15px_30px_rgba(16,185,129,0.22)] group-hover:scale-105 transition-transform duration-700"
                        priority
                        sizes="(max-width: 768px) 100vw, 550px"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-emerald-600 gap-2">
                      <div className="w-24 h-24 rounded-2xl bg-emerald-100/90 flex items-center justify-center text-3xl font-black shadow-lg">
                        🌿
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-600">Hijyenik Kullan-At Seri</span>
                    </div>
                  )}

                {/* Price Tag Overlay REMOVED per design spec – showcase = category explorer, not direct buy */}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Column Bottom Action: "Ürünleri Gör" → Category page */}
            <div className="relative z-10 pt-3 flex items-center justify-between gap-3 border-t border-emerald-100/80">
              <Link
                href={rightCtaUrl}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 sm:px-9 sm:py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full font-black text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 shadow-lg shadow-emerald-600/25 hover:scale-105 active:scale-95 cursor-pointer"
              >
                <FiArrowRight className="w-4 h-4" />
                <span>{t.showcase.viewProducts}</span>
              </Link>

              {/* Prev / Next manual controls */}
              {rightProducts.length > 1 && (
                <div className="hidden sm:flex items-center gap-1">
                  <button
                    onClick={() => setRightIndex((prev) => (prev - 1 + rightProducts.length) % rightProducts.length)}
                    className="p-2.5 rounded-full bg-white text-slate-700 hover:text-emerald-600 hover:bg-emerald-50 border border-emerald-100 transition-colors shadow-2xs"
                    aria-label="Önceki Ürün"
                  >
                    <FiChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setRightIndex((prev) => (prev + 1) % rightProducts.length)}
                    className="p-2.5 rounded-full bg-white text-slate-700 hover:text-emerald-600 hover:bg-emerald-50 border border-emerald-100 transition-colors shadow-2xs"
                    aria-label="Sonraki Ürün"
                  >
                    <FiChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* 3. PREMIUM INTERACTIVE VALUE PROPOSITIONS & HERO CTA                     */}
        {/* ========================================================================= */}
        <div className="mt-6 sm:mt-8 max-w-6xl mx-auto relative z-20">
          
          {/* 5 Distinct Luxury Feature & Benefit Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 sm:gap-4">
            
            {/* Card 1: Daha Sağlıklı Dişler */}
            <div className="group relative bg-gradient-to-b from-white via-sky-50/40 to-blue-50/30 rounded-2xl p-4 sm:p-4.5 border-2 border-sky-100 hover:border-sky-300 shadow-sm hover:shadow-xl hover:shadow-sky-100/70 transition-all duration-300 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-sky-200/30 rounded-full blur-xl pointer-events-none -mr-6 -mt-6 group-hover:scale-125 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[9px] font-black uppercase tracking-wider text-sky-700 bg-sky-100/90 px-2 py-0.5 rounded-md border border-sky-200/60 flex items-center gap-1">
                    <FiShield className="w-2.5 h-2.5" />
                    KLİNİK ONAYLI
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-sky-500/25 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                    <ToothIcon className="w-5 h-5" />
                  </div>
                </div>

                <h3 className="text-sm sm:text-[15px] font-black text-slate-900 leading-snug tracking-tight group-hover:text-sky-700 transition-colors">
                  {t.features.f1Title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed mt-1.5">
                  {t.features.f1Desc}
                </p>
              </div>

              {/* Bottom Subtle Animated Accent Bar */}
              <div className="mt-3.5 h-1 w-8 bg-sky-400 rounded-full group-hover:w-full transition-all duration-500" />
            </div>

            {/* Card 2: Güvenli ve Doğal Temizlik */}
            <div className="group relative bg-gradient-to-b from-white via-emerald-50/40 to-teal-50/30 rounded-2xl p-4 sm:p-4.5 border-2 border-emerald-100 hover:border-emerald-300 shadow-sm hover:shadow-xl hover:shadow-emerald-100/70 transition-all duration-300 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/30 rounded-full blur-xl pointer-events-none -mr-6 -mt-6 group-hover:scale-125 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-200/60 flex items-center gap-1">
                    <FiCheckCircle className="w-2.5 h-2.5" />
                    BPA FREE
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/25 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <LeafIcon className="w-5 h-5" />
                  </div>
                </div>

                <h3 className="text-sm sm:text-[15px] font-black text-slate-900 leading-snug tracking-tight group-hover:text-emerald-700 transition-colors">
                  {t.features.f2Title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed mt-1.5">
                  {t.features.f2Desc}
                </p>
              </div>

              {/* Bottom Subtle Animated Accent Bar */}
              <div className="mt-3.5 h-1 w-8 bg-emerald-400 rounded-full group-hover:w-full transition-all duration-500" />
            </div>

            {/* Card 3: Aile Boyu Kullanım */}
            <div className="group relative bg-gradient-to-b from-white via-amber-50/40 to-rose-50/30 rounded-2xl p-4 sm:p-4.5 border-2 border-amber-100 hover:border-amber-300 shadow-sm hover:shadow-xl hover:shadow-amber-100/70 transition-all duration-300 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-amber-200/30 rounded-full blur-xl pointer-events-none -mr-6 -mt-6 group-hover:scale-125 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-200/60 flex items-center gap-1">
                    <FiHeart className="w-2.5 h-2.5" />
                    HER YAŞA UYGUN
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 text-white flex items-center justify-center shadow-md shadow-amber-500/25 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                    <FiHeart className="w-5 h-5" />
                  </div>
                </div>

                <h3 className="text-sm sm:text-[15px] font-black text-slate-900 leading-snug tracking-tight group-hover:text-amber-700 transition-colors">
                  {t.features.f3Title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed mt-1.5">
                  {t.features.f3Desc}
                </p>
              </div>

              {/* Bottom Subtle Animated Accent Bar */}
              <div className="mt-3.5 h-1 w-8 bg-amber-400 rounded-full group-hover:w-full transition-all duration-500" />
            </div>

            {/* Card 4: Seyahatler İçin İdeal */}
            <div className="group relative bg-gradient-to-b from-white via-indigo-50/40 to-purple-50/30 rounded-2xl p-4 sm:p-4.5 border-2 border-indigo-100 hover:border-indigo-300 shadow-sm hover:shadow-xl hover:shadow-indigo-100/70 transition-all duration-300 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-200/30 rounded-full blur-xl pointer-events-none -mr-6 -mt-6 group-hover:scale-125 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[9px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-100/90 px-2 py-0.5 rounded-md border border-indigo-200/60 flex items-center gap-1">
                    <FiZap className="w-2.5 h-2.5" />
                    PORTATİF & HİJYENİK
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                    <AirplaneIcon className="w-5 h-5" />
                  </div>
                </div>

                <h3 className="text-sm sm:text-[15px] font-black text-slate-900 leading-snug tracking-tight group-hover:text-indigo-700 transition-colors">
                  {t.features.f4Title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed mt-1.5">
                  {t.features.f4Desc}
                </p>
              </div>

              {/* Bottom Subtle Animated Accent Bar */}
              <div className="mt-3.5 h-1 w-8 bg-indigo-400 rounded-full group-hover:w-full transition-all duration-500" />
            </div>

            {/* Card 5: Daha Beyaz Bir Gülüş */}
            <div className="group relative bg-gradient-to-b from-white via-rose-50/40 to-pink-50/30 rounded-2xl p-4 sm:p-4.5 border-2 border-rose-100 hover:border-rose-300 shadow-sm hover:shadow-xl hover:shadow-rose-100/70 transition-all duration-300 flex flex-col justify-between overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-200/30 rounded-full blur-xl pointer-events-none -mr-6 -mt-6 group-hover:scale-125 transition-transform duration-500" />
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[9px] font-black uppercase tracking-wider text-rose-700 bg-rose-100/90 px-2 py-0.5 rounded-md border border-rose-200/60 flex items-center gap-1">
                    <FiSmile className="w-2.5 h-2.5" />
                    PARLAK GÜLÜŞ
                  </span>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-rose-500/25 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300">
                    <FiSmile className="w-5 h-5" />
                  </div>
                </div>

                <h3 className="text-sm sm:text-[15px] font-black text-slate-900 leading-snug tracking-tight group-hover:text-rose-700 transition-colors">
                  {t.features.f5Title}
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-600 font-medium leading-relaxed mt-1.5">
                  {t.features.f5Desc}
                </p>
              </div>

              {/* Bottom Subtle Animated Accent Bar */}
              <div className="mt-3.5 h-1 w-8 bg-rose-400 rounded-full group-hover:w-full transition-all duration-500" />
            </div>

          </div>

          {/* Glowing Center Hero CTA Button */}
          <div className="mt-6 flex flex-col items-center justify-center gap-3">
            <Link
              href={getLocalizedPath('/urunler')}
              className="group relative inline-flex items-center justify-center gap-3 px-10 py-4 bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-600 hover:from-sky-500 hover:to-emerald-500 text-white rounded-full font-black text-xs sm:text-sm tracking-wider uppercase shadow-xl shadow-blue-600/30 hover:shadow-2xl hover:shadow-blue-600/40 hover:scale-103 active:scale-98 transition-all duration-300 overflow-hidden"
            >
              {/* Shimmer light effect across button */}
              <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/25 to-transparent pointer-events-none" />

              <FiShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
              <span>{t.showcase.bottomBarCta}</span>
              <FiArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
            </Link>

            {/* Trust Mini-Highlights Row */}
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-[11px] sm:text-xs font-bold text-slate-500 select-none">
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600">🚚</span> Aynı Gün Kargo Teslimatı
              </span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-sky-600">🛡️</span> 2 Yıl Birebir Değişim Garantisi
              </span>
              <span className="hidden sm:inline text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-emerald-600">💚</span> %100 Hijyen & Memnuniyet Güvencesi
              </span>
            </div>
          </div>

        </div>

      </div>
    </section>
  )
}
