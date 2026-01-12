'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import Link from 'next/link'

interface ReturnContent {
  title?: string
  subtitle?: string
  sections?: Array<{
    title: string
    content: string
    image?: string
  }>
}

export default function ReturnPage() {
  const [content, setContent] = useState<ReturnContent | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const returnRef = doc(db, 'siteContent', 'return')
      
      const unsubscribe = onSnapshot(
        returnRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as ReturnContent
            setContent(data)
            console.log('✅ Return content loaded from Firebase:', data)
          } else {
            console.warn('⚠️ Return content not found in Firebase')
            setContent(null)
          }
          setLoading(false)
        },
        (error) => {
          console.error('❌ Return snapshot error:', error)
          setLoading(false)
          setContent(null)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Return initialization error:', error)
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
          <p className="text-xl mb-4">İade ve değişim bilgileri bulunamadı.</p>
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
    <div className="pt-32 pb-20 bg-gradient-to-b from-white to-gray-50 min-h-screen">
      <div className="container-custom section-padding">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
            {content.title || 'İade ve Değişim'}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {content.subtitle || 'İade ve değişim koşulları hakkında bilgiler'}
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-6">
          {content.sections && content.sections.length > 0 ? (
            content.sections.map((section, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
              >
                {section.image && (
                  <div className="mb-4 rounded-lg overflow-hidden">
                    <img src={section.image} alt={section.title} className="w-full h-64 object-cover" />
                  </div>
                )}
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  {section.title}
                </h2>
                <div className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {section.content}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Henüz içerik eklenmemiş.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

