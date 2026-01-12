'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface AboutContent {
  title?: string
  subtitle?: string
  storyTitle?: string
  storyParagraphs?: string[]
  storyImage?: string
}

export default function AboutPage() {
  const [content, setContent] = useState<AboutContent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const aboutRef = doc(db, 'siteContent', 'about')
      
      const unsubscribe = onSnapshot(
        aboutRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as AboutContent
            setContent(data)
            console.log('✅ About content loaded from Firebase:', data)
          } else {
            console.warn('⚠️ About content not found in Firebase')
            setContent(null)
          }
          setLoading(false)
        },
        (error) => {
          console.error('❌ About snapshot error:', error)
          setLoading(false)
          setContent(null)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ About initialization error:', error)
      setLoading(false)
      setContent(null)
    }
  }, [])

  if (loading) {
    return (
      <div className="pt-32 pb-20 bg-white min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!content) {
    return (
      <div className="pt-32 pb-20 bg-white min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-600">
          <p className="text-xl mb-4">Hakkımızda içeriği bulunamadı.</p>
          <Link href="/admin/icerik">
            <button className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              Admin Panelden Ekle
            </button>
          </Link>
        </div>
      </div>
    )
  }
  return (
    <div className="pt-32 pb-20 bg-white min-h-screen">
      <div className="container-custom section-padding">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6">
            {content.title || 'Hakkımızda'}
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
            {content.subtitle || 'Modern teknoloji ve sağlık bilincini bir araya getirerek, herkesin güzel ve sağlıklı bir gülüşe sahip olması için çalışıyoruz.'}
          </p>
        </motion.div>

        {/* Story Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative h-[500px] rounded-2xl overflow-hidden shadow-2xl"
          >
            {content.storyImage ? (
              <img
                src={content.storyImage}
                alt="Hikayemiz"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary-400 to-primary-600">
                <div className="flex items-center justify-center h-full">
                  <span className="text-9xl">🦷</span>
                </div>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <h2 className="text-4xl font-bold text-gray-900">
              {content.storyTitle || 'Hikayemiz'}
            </h2>
            {content.storyParagraphs && content.storyParagraphs.length > 0 ? (
              content.storyParagraphs.map((paragraph, index) => (
                <p key={index} className="text-lg text-gray-600 leading-relaxed">
                  {paragraph}
                </p>
              ))
            ) : (
              <>
                <p className="text-lg text-gray-600 leading-relaxed">
                  2020 yılında kurulan SmileBrush, diş sağlığına olan tutkumuzla yola çıktı.
                  Amacımız, herkesin evinde profesyonel seviyede diş bakımı yapabilmesini sağlamak.
                </p>
                <p className="text-lg text-gray-600 leading-relaxed">
                  Modern teknoloji ile donatılmış elektrikli diş fırçalarımız, kullanıcılarımıza
                  en iyi deneyimi sunmak için sürekli geliştirilmektedir.
                </p>
              </>
            )}
          </motion.div>
        </div>

      </div>
    </div>
  )
}


