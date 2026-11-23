'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { collection, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

// Above-the-fold LCP sections (eagerly loaded)
import HomeShowcase from '@/components/home/HomeShowcase'
import ProductOptionsSection, { ShowcaseProductItem } from '@/components/home/ProductOptionsSection'
import RevealOnScroll from '@/components/common/RevealOnScroll'

// Below-the-fold sections (code-split for smaller initial JS bundle, SSR preserved for SEO)
const EditorialPromoSection = dynamic(() => import('@/components/home/EditorialPromoSection'), { ssr: true })
const WhyGulumseSection = dynamic(() => import('@/components/home/WhyGulumseSection'), { ssr: true })
const CTASection = dynamic(() => import('@/components/home/CTASection'), { ssr: true })

export default function Home() {
  const [allProducts, setAllProducts] = useState<ShowcaseProductItem[]>([])
  const [featuredProducts, setFeaturedProducts] = useState<ShowcaseProductItem[]>([])
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

          // 1. Featured products array
          const popularList = list.filter((p: any) => p.isPopular === true)
          setFeaturedProducts(popularList.length > 0 ? popularList : list)

          // 2. Refill / Accessory Product for Promo
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
      {/* 01. ABOVE-THE-FOLD SHOWCASE (LCP critical - rendered immediately without hiding) */}
      <HomeShowcase products={allProducts} loading={loading} />

      {/* 02. PRODUCT OPTIONS & BESTSELLERS */}
      <RevealOnScroll>
        <ProductOptionsSection products={allProducts} loading={loading} />
      </RevealOnScroll>

      {/* 03. EDITORIAL PROMOTIONAL STORIES */}
      <RevealOnScroll delayMs={40}>
        <EditorialPromoSection
          brushProduct={featuredProducts[0] || null}
          refillProduct={refillProduct}
        />
      </RevealOnScroll>

      {/* 04. BRAND VALUE PROPOSITIONS */}
      <RevealOnScroll delayMs={40}>
        <WhyGulumseSection />
      </RevealOnScroll>

      {/* 05. FINAL HIGH-CONVERSION CTA */}
      <RevealOnScroll delayMs={40}>
        <CTASection />
      </RevealOnScroll>
    </div>
  )
}
