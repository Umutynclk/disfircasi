'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiMail, FiPhone, FiMapPin, FiSend } from 'react-icons/fi'
import { doc, onSnapshot, collection, addDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

interface ContactInfo {
  title?: string
  subtitle?: string
  phone?: string
  email?: string
  address?: string
  workingHours?: string
  notificationEmail?: string // Admin panelinden seçilecek e-posta
}

interface ContactModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [contactInfo, setContactInfo] = useState<ContactInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    try {
      const db = getFirestoreDB()
      const contactRef = doc(db, 'siteContent', 'contact')
      
      const unsubscribe = onSnapshot(
        contactRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setContactInfo(snapshot.data() as ContactInfo)
          } else {
            setContactInfo({
              title: 'İletişime Geçin',
              subtitle: 'Sorularınız için bize ulaşın',
              phone: '',
              email: '',
              address: '',
              workingHours: '',
              notificationEmail: ''
            })
          }
          setLoading(false)
        },
        (error) => {
          console.error('Contact info error:', error)
          setLoading(false)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('Contact initialization error:', error)
      setLoading(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const db = getFirestoreDB()
      
      // Firestore'a kaydet
      const contactData: any = {
        name: formData.name || '',
        email: formData.email || '',
        message: formData.message || '',
        createdAt: new Date(),
        source: 'homepage_modal'
      }
      
      if (formData.phone && formData.phone.trim() !== '') {
        contactData.phone = formData.phone
      }
      
      if (formData.subject && formData.subject.trim() !== '') {
        contactData.subject = formData.subject
      }
      
      await addDoc(collection(db, 'contacts'), contactData)
      
      // E-posta gönderme
      if (contactInfo?.notificationEmail) {
        try {
          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: formData.name,
              email: formData.email,
              phone: formData.phone,
              subject: formData.subject,
              message: formData.message
            })
          })
          
          if (!response.ok) {
            console.error('E-posta gönderme hatası')
          }
        } catch (error) {
          console.error('E-posta gönderme hatası:', error)
          // Hata olsa bile form kaydedildi, kullanıcıya hata gösterme
        }
      }
      
      setSubmitted(true)
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
      
      setTimeout(() => {
        setSubmitted(false)
        onClose()
      }, 2000)
    } catch (error) {
      console.error('Mesaj gönderilirken hata:', error)
      alert('Mesaj gönderilirken bir hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  {loading ? (
                    <div className="h-6 w-48 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-bold text-gray-900">
                        {contactInfo?.title || 'İletişime Geçin'}
                      </h2>
                      {contactInfo?.subtitle && (
                        <p className="text-sm text-gray-600 mt-1">{contactInfo.subtitle}</p>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <FiX className="w-6 h-6 text-gray-600" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* İletişim Bilgileri */}
                  <div className="space-y-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">İletişim Bilgileri</h3>
                    
                    {loading ? (
                      <div className="space-y-4">
                        <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                        <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
                      </div>
                    ) : (
                      <>
                        {contactInfo?.phone && (
                          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                            <FiPhone className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-700">Telefon</p>
                              <a href={`tel:${contactInfo.phone}`} className="text-primary-600 hover:text-primary-700">
                                {contactInfo.phone}
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {contactInfo?.email && (
                          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                            <FiMail className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-700">E-posta</p>
                              <a href={`mailto:${contactInfo.email}`} className="text-primary-600 hover:text-primary-700">
                                {contactInfo.email}
                              </a>
                            </div>
                          </div>
                        )}
                        
                        {contactInfo?.address && (
                          <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                            <FiMapPin className="w-5 h-5 text-primary-600 mt-1 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-gray-700">Adres</p>
                              <p className="text-gray-600">{contactInfo.address}</p>
                            </div>
                          </div>
                        )}
                        
                        {contactInfo?.workingHours && (
                          <div className="p-4 bg-primary-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-700 mb-1">Çalışma Saatleri</p>
                            <p className="text-gray-600">{contactInfo.workingHours}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* İletişim Formu */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Mesaj Gönderin</h3>
                    
                    {submitted ? (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FiSend className="w-8 h-8 text-green-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">Mesajınız Gönderildi!</h3>
                        <p className="text-gray-600">En kısa sürede size dönüş yapacağız.</p>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ad Soyad <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                            placeholder="Adınız ve soyadınız"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            E-posta <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="email"
                            required
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                            placeholder="ornek@email.com"
                          />
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
                            placeholder="05XX XXX XX XX"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Konu
                          </label>
                          <input
                            type="text"
                            value={formData.subject}
                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                            placeholder="Mesaj konusu"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Mesaj <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            required
                            rows={5}
                            value={formData.message}
                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                            className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors resize-none"
                            placeholder="Mesajınızı buraya yazın..."
                          />
                        </div>

                        <motion.button
                          type="submit"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          disabled={submitting}
                          className="w-full px-6 py-4 bg-primary-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {submitting ? (
                            <>
                              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                              Gönderiliyor...
                            </>
                          ) : (
                            <>
                              <FiSend className="w-5 h-5" />
                              Mesaj Gönder
                            </>
                          )}
                        </motion.button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
