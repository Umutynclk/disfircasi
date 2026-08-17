'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'

interface DynamicSection {
  id: string
  title: string
  subtitle?: string
  content: string
  image?: string
  buttonText?: string
  buttonLink?: string
  backgroundColor?: string
  order?: number
}

export default function DynamicSections() {
  const [sections, setSections] = useState<DynamicSection[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const sectionsRef = collection(db, 'dynamicSections')
      const q = query(sectionsRef, orderBy('order', 'asc'))
      
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const sectionsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as DynamicSection))
          setSections(sectionsData)
          setLoading(false)
          console.log('✅ Dynamic sections loaded from Firebase:', sectionsData.length)
        },
        (error) => {
          console.error('❌ Dynamic sections snapshot error:', error)
          setSections([])
          setLoading(false)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Dynamic sections initialization error:', error)
      setLoading(false)
    }
  }, [])

  if (loading) {
    return null
  }

  if (sections.length === 0) {
    return null
  }

  const getBackgroundClass = (bgColor?: string) => {
    switch (bgColor) {
      case 'gray-50':
        return 'bg-gray-50'
      case 'primary-50':
        return 'bg-primary-50'
      case 'primary-600':
        return 'bg-primary-600 text-white'
      default:
        return 'bg-white'
    }
  }

  const getTextColorClass = (bgColor?: string) => {
    return bgColor === 'primary-600' ? 'text-white' : 'text-gray-900'
  }

  const getSubtitleColorClass = (bgColor?: string) => {
    return bgColor === 'primary-600' ? 'text-primary-100' : 'text-gray-600'
  }

  return (
    <>
      {sections.map((section, index) => (
        <section
          key={section.id}
          className={`py-20 ${getBackgroundClass(section.backgroundColor)}`}
        >
          <div className="container-custom section-padding">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="max-w-4xl mx-auto"
            >
              {section.title && (
                <h2 className={`text-4xl md:text-5xl font-bold mb-4 text-center ${getTextColorClass(section.backgroundColor)}`}>
                  {section.title}
                </h2>
              )}
              
              {section.subtitle && (
                <p className={`text-xl mb-8 text-center ${getSubtitleColorClass(section.backgroundColor)}`}>
                  {section.subtitle}
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                {section.image && (
                  <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="order-2 md:order-1"
                  >
                    <img
                      src={section.image}
                      alt={section.title}
                      className="w-full h-auto rounded-2xl shadow-lg"
                    />
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, x: section.image ? 50 : 0 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                  className={`order-1 md:order-2 ${section.image ? '' : 'md:col-span-2'}`}
                >
                  {section.content && (
                    <div className={`prose prose-lg max-w-none mb-6 ${getTextColorClass(section.backgroundColor)}`}>
                      <p className="text-lg leading-relaxed whitespace-pre-line">
                        {section.content}
                      </p>
                    </div>
                  )}

                  {section.buttonText && section.buttonLink && (
                    <Link href={section.buttonLink}>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl ${
                          section.backgroundColor === 'primary-600'
                            ? 'bg-white text-primary-600 hover:bg-gray-100'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {section.buttonText}
                        <FiArrowRight className="w-5 h-5" />
                      </motion.button>
                    </Link>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
      ))}
    </>
  )
}
