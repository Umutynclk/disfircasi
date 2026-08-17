'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

// Clean E-Commerce Sections
import HeroSection, { HeroProductData } from '@/components/home/HeroSection'
import CategoryChoiceSection from '@/components/home/CategoryChoiceSection'
import ProductOptionsSection, { ShowcaseProductItem } from '@/components/home/ProductOptionsSection'
import EditorialPromoSection from '@/components/home/EditorialPromoSection'
import WhyGulumseSection from '@/components/home/WhyGulumseSection'
import CTASection from '@/components/home/CTASection'

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<HeroProductData[]>([])
  const [allProducts, setAllProducts] = useState<ShowcaseProductItem[]>([])
  const [autoProducts, setAutoProducts] = useState<ShowcaseProductItem[]>([])
  const [disposableProducts, setDisposableProducts] = useState<ShowcaseProductItem[]>([])
  const [refillProduct, setRefillProduct] = useState<ShowcaseProductItem | null>(null)
  const [loading, setLoading] = useState(true)

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
          })) as ShowcaseProductItem[]

          setAllProducts(list)

          // 1. Featured products array (all with isPopular === true, sorted, or fallback to first 4)
          const popularList = list.filter((p: any) => p.isPopular === true)
          setFeaturedProducts(popularList.length > 0 ? popularList : list.slice(0, 4))

          // 2. Automatic Brush Category Products
          const autoList = list.filter(
            (p) =>
              p.category === 'otomatik' ||
              p.category === 'elektrikli-disfircasi' ||
              p.name?.toLowerCase().includes('otomatik') ||
              p.name?.toLowerCase().includes('sonic')
          )
          setAutoProducts(autoList.length > 0 ? autoList : list.slice(0, 3))

          // 3. Disposable Brush Category Products
          const dispList = list.filter(
            (p) =>
              p.category === 'kullan-at' ||
              p.category === 'kullanat' ||
              p.name?.toLowerCase().includes('kullan') ||
              p.name?.toLowerCase().includes('seyahat')
          )
          setDisposableProducts(dispList.length > 0 ? dispList : list.slice(1, 4))

          // 4. Refill / Accessory Product for Promo
          const refill = list.find(
            (p) =>
              p.category === 'yedek-firca-basliklari' ||
              p.name?.toLowerCase().includes('başlık') ||
              p.name?.toLowerCase().includes('yedek')
          )
          setRefillProduct(refill || list[1] || null)

          setLoading(false)
        },
        (error) => {
          console.error('Home products fetch error:', error)
          setLoading(false)
        }
      )

      return () => unsubscribe()
    } catch (error) {
      console.error('Home Firestore init error:', error)
      setLoading(false)
    }
  }, [])

  return (
    <div className="bg-white min-h-screen">
      {/* 01. HERO SECTION (5-Second Rotating Featured Products Carousel) */}
      <HeroSection featuredProducts={featuredProducts} loading={loading} />

      {/* 02. CATEGORY CHOICE ("Gülüşün için doğru seçimi yap." - 2 Large Interactive Cards) */}
      <CategoryChoiceSection
        autoProducts={autoProducts}
        disposableProducts={disposableProducts}
      />

      {/* 03. PRODUCT OPTIONS & BESTSELLERS (Real Firebase products with CartDrawer trigger) */}
      <ProductOptionsSection products={allProducts} loading={loading} />

      {/* 04. EDITORIAL PROMOTIONAL STORIES (Commercial healthcare advice blocks) */}
      <EditorialPromoSection
        brushProduct={featuredProducts[0] || null}
        refillProduct={refillProduct}
      />

      {/* 05. BRAND VALUE PROPOSITIONS (Trust, hygiene, clinic approval) */}
      <WhyGulumseSection />

      {/* 06. FINAL HIGH-CONVERSION CTA */}
      <CTASection />
    </div>
  )
}
