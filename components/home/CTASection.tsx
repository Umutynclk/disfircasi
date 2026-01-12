'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'
import ContactModal from './ContactModal'

interface CTAContent {
  ctaTitle?: string
  ctaDescription?: string
  ctaPrimaryButton?: string
  ctaSecondaryButton?: string
}

export default function CTASection() {
  const [content, setContent] = useState<CTAContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [isContactModalOpen, setIsContactModalOpen] = useState(false)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const ctaRef = doc(db, 'siteContent', 'cta')
      
      // Real-time listener - Firebase değişikliklerini dinle
      const unsubscribe = onSnapshot(
        ctaRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as CTAContent
            setContent(data)
            console.log('✅ CTA content loaded/updated from Firebase:', data)
          } else {
            console.warn('⚠️ CTA content not found in Firebase. Please add content from admin panel.')
            setContent(null)
          }
          setLoading(false)
        },
        (error) => {
          console.error('❌ CTA snapshot error:', error)
          setContent(null)
          setLoading(false)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ CTA initialization error:', error)
      setContent(null)
      setLoading(false)
    }
  }, [])

  // Firebase'den veri yoksa boş göster
  if (loading) {
    return (
      <section className="py-20 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white relative overflow-hidden">
        <div className="container-custom section-padding">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
          </div>
        </div>
      </section>
    )
  }

  if (!content || (!content.ctaTitle && !content.ctaDescription)) {
    return (
      <section className="py-20 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white relative overflow-hidden">
        <div className="container-custom section-padding">
          <div className="text-center text-white/80 py-20">
            <p className="text-lg">CTA bölümü henüz eklenmemiş.</p>
            <p className="text-sm mt-2">Admin panelden içerik ekleyin.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-20 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="container-custom section-padding relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-3xl mx-auto"
        >
          {content.ctaTitle && (
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              {content.ctaTitle}
            </h2>
          )}
          
          {content.ctaDescription && (
            <p className="text-xl md:text-2xl mb-10 text-primary-100">
              {content.ctaDescription}
            </p>
          )}
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {content.ctaPrimaryButton && (
              <Link href="/satin-al">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white text-primary-600 rounded-full font-semibold flex items-center gap-2 shadow-xl hover:shadow-2xl transition-shadow"
                >
                  {content.ctaPrimaryButton}
                  <FiArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
            )}
            
            {content.ctaSecondaryButton && (
              <motion.button
                onClick={() => setIsContactModalOpen(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full font-semibold hover:bg-white/10 transition-colors"
              >
                {content.ctaSecondaryButton}
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Contact Modal */}
      <ContactModal 
        isOpen={isContactModalOpen} 
        onClose={() => setIsContactModalOpen(false)} 
      />
    </section>
  )
}
