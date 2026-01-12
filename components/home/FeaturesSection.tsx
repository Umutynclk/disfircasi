'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FiBattery, FiZap, FiShield, FiClock } from 'react-icons/fi'

interface Feature {
  id?: string
  icon?: string
  title: string
  description: string
  color?: string
}

const iconMap: { [key: string]: any } = {
  FiZap,
  FiBattery,
  FiShield,
  FiClock
}

export default function FeaturesSection() {
  const [features, setFeatures] = useState<Feature[]>([])
  const [title, setTitle] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const featuresRef = doc(db, 'siteContent', 'features')
      
      // Real-time listener - Firebase değişikliklerini dinle
      const unsubscribe = onSnapshot(
        featuresRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()
            if (data.items && Array.isArray(data.items)) {
              setFeatures(data.items)
            }
            if (data.title) setTitle(data.title)
            if (data.description) setDescription(data.description)
            console.log('✅ Features content loaded/updated from Firebase:', data)
          } else {
            console.warn('⚠️ Features content not found in Firebase. Please add content from admin panel.')
            setFeatures([])
            setTitle('')
            setDescription('')
          }
          setLoading(false)
        },
        (error) => {
          console.error('❌ Features snapshot error:', error)
          setFeatures([])
          setLoading(false)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Features initialization error:', error)
      setFeatures([])
      setLoading(false)
    }
  }, [])

  // Firebase'den veri yoksa boş göster
  if (loading) {
    return (
      <section className="py-20 bg-white">
        <div className="container-custom section-padding">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </section>
    )
  }

  if (features.length === 0 && !title && !description) {
    return (
      <section className="py-20 bg-white">
        <div className="container-custom section-padding">
          <div className="text-center text-gray-500 py-20">
            <p className="text-lg">Özellikler bölümü henüz eklenmemiş.</p>
            <p className="text-sm mt-2">Admin panelden içerik ekleyin.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-20 bg-white">
      <div className="container-custom section-padding">
        {(title || description) && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            {title && (
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                {title.includes('SmileBrush') ? (
                  <>
                    {title.split('SmileBrush')[0]}
                    <span className="text-primary-600">SmileBrush</span>
                    {title.split('SmileBrush')[1] || '?'}
                  </>
                ) : (
                  title
                )}
              </h2>
            )}
            {description && (
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                {description}
              </p>
            )}
          </motion.div>
        )}

        {features.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const IconComponent = feature.icon && iconMap[feature.icon] ? iconMap[feature.icon] : FiZap
              const color = feature.color || 'from-primary-400 to-primary-500'
              return (
                <motion.div
                  key={feature.id || index}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ y: -10 }}
                  className="p-6 rounded-2xl bg-gray-50 hover:bg-white border border-gray-100 hover:border-primary-200 transition-all duration-300 shadow-sm hover:shadow-xl group"
                >
                  <div className={`w-16 h-16 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <IconComponent className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600">
                    {feature.description}
                  </p>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
