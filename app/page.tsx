'use client'

import { useEffect, useState } from 'react'
import { collection, query, where, getDocs, limit, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

// Clean E-Commerce Sections
import HomeShowcase from '@/components/home/HomeShowcase'
import ProductOptionsSection, { ShowcaseProductItem } from '@/components/home/ProductOptionsSection'
import EditorialPromoSection from '@/components/home/EditorialPromoSection'
import WhyGulumseSection from '@/components/home/WhyGulumseSection'
import CTASection from '@/components/home/CTASection'

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
      {/* 01. NEW SALES SHOWCASE (Dual Column: Otomatik Diş Fırçası + Kullan At Diş Fırçası with Independent 5-Second Rotation) */}
      <HomeShowcase products={allProducts} loading={loading} />

      {/* 02. PRODUCT OPTIONS & BESTSELLERS (Real Firebase products with CartDrawer trigger) */}
      <ProductOptionsSection products={allProducts} loading={loading} />

      {/* 03. EDITORIAL PROMOTIONAL STORIES (Commercial healthcare advice blocks) */}
      <EditorialPromoSection
        brushProduct={featuredProducts[0] || null}
        refillProduct={refillProduct}
      />

      {/* 04. BRAND VALUE PROPOSITIONS (Trust, hygiene, clinic approval) */}
      <WhyGulumseSection />

      {/* 05. FINAL HIGH-CONVERSION CTA */}
      <CTASection />
    </div>
  )
}

