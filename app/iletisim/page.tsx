'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { FiMail, FiPhone, FiMapPin, FiSend } from 'react-icons/fi'
import { collection, addDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const db = getFirestoreDB()
      
      // Firebase'e undefined değerler göndermemek için temizle
      const contactData: any = {
        name: formData.name || '',
        email: formData.email || '',
        message: formData.message || '',
        createdAt: new Date()
      }
      
      // Phone varsa ekle
      if (formData.phone && formData.phone.trim() !== '') {
        contactData.phone = formData.phone
      }
      
      // Subject varsa ekle
      if (formData.subject && formData.subject.trim() !== '') {
        contactData.subject = formData.subject
      }
      
      await addDoc(collection(db, 'contacts'), contactData)
      setSubmitted(true)
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
    } catch (error) {
      console.error('Mesaj gönderilirken hata:', error)
      alert('Mesaj gönderilirken bir hata oluştu')
    } finally {
      setLoading(false)
    }
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
            İletişime Geçin
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Sorularınız, önerileriniz veya destek talepleriniz için bize ulaşın
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Info */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 bg-white rounded-xl shadow-lg"
            >
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <FiMail className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">E-posta</h3>
              <p className="text-gray-600">info@smilebrush.com</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 bg-white rounded-xl shadow-lg"
            >
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <FiPhone className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Telefon</h3>
              <p className="text-gray-600">+90 (212) 123 45 67</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="p-6 bg-white rounded-xl shadow-lg"
            >
              <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <FiMapPin className="w-6 h-6 text-primary-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Adres</h3>
              <p className="text-gray-600">
                İstanbul, Türkiye
              </p>
            </motion.div>
          </div>

          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 bg-white rounded-xl shadow-lg p-8"
          >
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FiSend className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Mesajınız Gönderildi!</h3>
                <p className="text-gray-600 mb-6">En kısa sürede size dönüş yapacağız.</p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  Yeni Mesaj Gönder
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ad Soyad *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      E-posta *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Konu *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mesajınız *
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors resize-none"
                  />
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={loading}
                  className="w-full px-6 py-4 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <FiSend className="w-5 h-5" />
                  {loading ? 'Gönderiliyor...' : 'Mesaj Gönder'}
                </motion.button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}


