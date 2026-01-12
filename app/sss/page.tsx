'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FiChevronDown, FiChevronUp } from 'react-icons/fi'
import Link from 'next/link'

interface FAQItem {
  question: string
  answer: string
}

interface FAQContent {
  title?: string
  subtitle?: string
  items?: FAQItem[]
}

export default function FAQPage() {
  const [content, setContent] = useState<FAQContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const faqRef = doc(db, 'siteContent', 'faq')
      
      const unsubscribe = onSnapshot(
        faqRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as FAQContent
            setContent(data)
            console.log('✅ FAQ content loaded from Firebase:', data)
          } else {
            console.warn('⚠️ FAQ content not found in Firebase')
            setContent(null)
          }
          setLoading(false)
        },
        (error) => {
          console.error('❌ FAQ snapshot error:', error)
          setLoading(false)
          setContent(null)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ FAQ initialization error:', error)
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
          <p className="text-xl mb-4">SSS içeriği bulunamadı.</p>
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
            {content.title || 'Sık Sorulan Sorular'}
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {content.subtitle || 'Merak ettiğiniz soruların cevaplarını burada bulabilirsiniz'}
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto space-y-4">
          {content.items && content.items.length > 0 ? (
            content.items.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => setOpenIndex(openIndex === index ? null : index)}
                  className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg font-semibold text-gray-900 text-left">
                    {item.question}
                  </span>
                  {openIndex === index ? (
                    <FiChevronUp className="w-5 h-5 text-primary-600 flex-shrink-0 ml-4" />
                  ) : (
                    <FiChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0 ml-4" />
                  )}
                </button>
                {openIndex === index && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="px-6 pb-4"
                  >
                    <p className="text-gray-600 leading-relaxed">{item.answer}</p>
                  </motion.div>
                )}
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 text-gray-500">
              <p>Henüz soru eklenmemiş.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


