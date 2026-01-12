'use client'

import { useEffect } from 'react'
import HeroSection from '@/components/home/HeroSection'
import FeaturesSection from '@/components/home/FeaturesSection'
import ProductsPreview from '@/components/home/ProductsPreview'
import AccessoriesPreview from '@/components/home/AccessoriesPreview'
import BenefitsSection from '@/components/home/BenefitsSection'
import CTASection from '@/components/home/CTASection'

export default function Home() {
  useEffect(() => {
    // Scroll reveal animasyonları için
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active')
        }
      })
    }, observerOptions)

    const elements = document.querySelectorAll('.scroll-reveal')
    elements.forEach(el => observer.observe(el))

    return () => {
      elements.forEach(el => observer.unobserve(el))
    }
  }, [])

  return (
    <div className="overflow-hidden">
      <HeroSection />
      <FeaturesSection />
      <ProductsPreview />
      <AccessoriesPreview />
      <BenefitsSection />
      <CTASection />
    </div>
  )
}


