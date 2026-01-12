'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiArrowRight, FiPlay } from 'react-icons/fi'

interface HeroContent {
  badge?: string
  title?: string
  titleHighlight?: string
  description?: string
  primaryButton?: string
  secondaryButton?: string
  image?: string
}

export default function HeroSection() {
  const [content, setContent] = useState<HeroContent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const heroRef = doc(db, 'siteContent', 'hero')
      
      // Real-time listener - Firebase değişikliklerini dinle
      const unsubscribe = onSnapshot(
        heroRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as HeroContent
            setContent(data)
            console.log('✅ Hero content loaded/updated from Firebase:', data)
          } else {
            console.warn('⚠️ Hero content not found in Firebase. Please add content from admin panel.')
            setContent(null)
          }
          setLoading(false)
        },
        (error) => {
          console.error('❌ Hero snapshot error:', error)
          setContent(null)
          setLoading(false)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Hero initialization error:', error)
      setContent(null)
      setLoading(false)
    }
  }, [])

  // Loading state - Firebase'den veri yoksa boş göster
  if (loading) {
    return (
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </section>
    )
  }

  // Firebase'den veri yoksa boş göster
  if (!content) {
    return (
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50">
        <div className="text-center text-gray-500">
          <p className="text-lg">Hero içeriği henüz eklenmemiş.</p>
          <p className="text-sm mt-2">Admin panelden içerik ekleyin.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute top-20 left-10 w-72 h-72 bg-primary-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute bottom-20 right-10 w-96 h-96 bg-primary-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30"
        />
      </div>

      <div className="container-custom section-padding relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Text Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center lg:text-left"
          >
            {content.badge && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="inline-block mb-4 px-4 py-2 bg-primary-100 text-primary-700 rounded-full text-sm font-medium"
              >
                {content.badge}
              </motion.div>
            )}
            
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-5xl md:text-6xl lg:text-7xl font-bold mb-6 text-gray-900 leading-tight"
            >
              {content.title || 'Başlık'}
              {content.titleHighlight && (
                <>
                  <br />
                  <span className="bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent">
                    {content.titleHighlight}
                  </span>
                </>
              )}
            </motion.h1>

            {content.description && (
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="text-xl text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0"
              >
                {content.description}
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
            >
              {content.primaryButton && (
                <Link href="/urunler">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 bg-primary-600 text-white rounded-full font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow"
                  >
                    {content.primaryButton}
                    <FiArrowRight className="w-5 h-5" />
                  </motion.button>
                </Link>
              )}
              
              {content.secondaryButton && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white text-gray-900 rounded-full font-semibold flex items-center gap-2 shadow-lg hover:shadow-xl transition-shadow border-2 border-gray-200"
                >
                  <FiPlay className="w-5 h-5" />
                  {content.secondaryButton}
                </motion.button>
              )}
            </motion.div>
          </motion.div>

          {/* Image/Visual Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="relative"
          >
            <div className="relative w-full h-[500px] lg:h-[600px]">
              {content.image ? (
                content.image.endsWith('.mp4') || content.image.endsWith('.webm') || content.image.includes('video') || content.image.includes('firebasestorage') && content.image.includes('videos') ? (
                  <video
                    src={content.image}
                    className="absolute inset-0 w-full h-full object-cover rounded-3xl shadow-2xl"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={content.image}
                    alt={content.title || 'Hero'}
                    className="absolute inset-0 w-full h-full object-cover rounded-3xl shadow-2xl"
                  />
                )
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600 rounded-3xl shadow-2xl transform rotate-3 hover:rotate-6 transition-transform duration-500">
                  <div className="flex items-center justify-center h-full">
                    <motion.div
                      animate={{ y: [0, -20, 0] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      className="text-white text-9xl"
                    >
                      🦷
                    </motion.div>
                  </div>
                </div>
              )}
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-3xl" />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
      >
        <div className="w-6 h-10 border-2 border-gray-400 rounded-full flex justify-center">
          <motion.div
            animate={{ y: [0, 12, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-1 h-3 bg-gray-400 rounded-full mt-2"
          />
        </div>
      </motion.div>
    </section>
  )
}
