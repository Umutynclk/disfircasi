'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FiCheckCircle } from 'react-icons/fi'

export default function BenefitsSection() {
  const [benefits, setBenefits] = useState<string[]>([])
  const [title, setTitle] = useState<string>('')
  const [description, setDescription] = useState<string>('')
  const [image, setImage] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const benefitsRef = doc(db, 'siteContent', 'benefits')
      
      // Real-time listener - Firebase değişikliklerini dinle
      const unsubscribe = onSnapshot(
        benefitsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()
            if (data.benefits && Array.isArray(data.benefits)) {
              setBenefits(data.benefits)
            } else if (data.items && Array.isArray(data.items)) {
              setBenefits(data.items)
            }
            if (data.title) setTitle(data.title)
            if (data.description) setDescription(data.description)
            if (data.image) setImage(data.image)
            console.log('✅ Benefits content loaded/updated from Firebase:', data)
          } else {
            console.warn('⚠️ Benefits content not found in Firebase. Please add content from admin panel.')
            setBenefits([])
            setTitle('')
            setDescription('')
            setImage('')
          }
          setLoading(false)
        },
        (error) => {
          console.error('❌ Benefits snapshot error:', error)
          setBenefits([])
          setLoading(false)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Benefits initialization error:', error)
      setBenefits([])
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

  if (benefits.length === 0 && !title && !description) {
    return (
      <section className="py-20 bg-white">
        <div className="container-custom section-padding">
          <div className="text-center text-gray-500 py-20">
            <p className="text-lg">Avantajlar bölümü henüz eklenmemiş.</p>
            <p className="text-sm mt-2">Admin panelden içerik ekleyin.</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-20 bg-white">
      <div className="container-custom section-padding">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Image/Visual */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative"
          >
            <div className="relative w-full h-[500px] rounded-3xl overflow-hidden shadow-2xl">
              {image ? (
                image.endsWith('.mp4') || image.endsWith('.webm') || image.includes('video') || (image.includes('firebasestorage') && image.includes('videos')) ? (
                  <video
                    src={image}
                    className="absolute inset-0 w-full h-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={image}
                    alt={title || 'Benefits'}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-primary-400 to-primary-600">
                  <div className="flex items-center justify-center h-full">
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="text-white text-[200px]"
                    >
                      🦷
                    </motion.div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            {title && (
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                {title.includes('\n') ? (
                  <>
                    {title.split('\n')[0]}
                    <br />
                    <span className="text-primary-600">{title.split('\n')[1]}</span>
                  </>
                ) : title.includes('Sırrı') ? (
                  <>
                    {title.split('Sırrı')[0]}
                    <br />
                    <span className="text-primary-600">Sırrı</span>
                    {title.split('Sırrı')[1]}
                  </>
                ) : (
                  title
                )}
              </h2>
            )}
            
            {description && (
              <p className="text-xl text-gray-600 mb-8">
                {description}
              </p>
            )}
            
            {benefits.length > 0 && (
              <div className="space-y-4 mb-8">
                {benefits.map((benefit, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="flex-shrink-0 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                      <FiCheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-lg text-gray-700">{benefit}</span>
                  </motion.div>
                ))}
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-primary-600 text-white rounded-full font-semibold shadow-lg hover:shadow-xl transition-shadow"
            >
              Daha Fazla Bilgi
            </motion.button>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
