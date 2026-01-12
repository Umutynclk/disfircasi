'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FiSave, FiRefreshCw } from 'react-icons/fi'

interface SiteSettings {
  siteName: string
  siteDescription: string
  contactEmail: string
  contactPhone: string
  address: string
  socialMedia: {
    facebook?: string
    instagram?: string
    twitter?: string
  }
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: 'SmileBrush',
    siteDescription: 'Modern elektrikli diş fırçası çözümleri ile gülüşünüzü parlatın',
    contactEmail: '',
    contactPhone: '',
    address: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: ''
    }
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const db = getFirestoreDB()
      const settingsRef = doc(db, 'settings', 'site')
      const settingsSnap = await getDoc(settingsRef)

      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data() as SiteSettings)
      }
    } catch (error) {
      console.error('Settings fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const db = getFirestoreDB()
      const settingsRef = doc(db, 'settings', 'site')
      const dataToSave = {
        ...settings,
        updatedAt: new Date().toISOString()
      }
      await setDoc(settingsRef, dataToSave, { merge: true })
      console.log('✅ Settings saved to Firebase:', dataToSave)
      
      // Firebase'e kayıt başarılı olduğunu doğrula
      const verifyDoc = await getDoc(settingsRef)
      if (verifyDoc.exists()) {
        console.log('✅ Firebase verification successful:', verifyDoc.data())
      }
      
      // Broadcast mesajı gönder
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('settingsUpdated'))
      }
      
      alert('✅ Ayarlar başarıyla Firebase\'e kaydedildi!')
    } catch (error: any) {
      console.error('❌ Settings save error:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      })
      alert(`❌ Ayarlar kaydedilirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`)
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = (key: keyof SiteSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  const updateSocialMedia = (platform: keyof SiteSettings['socialMedia'], value: string) => {
    setSettings(prev => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: value
      }
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 lg:mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Site Ayarları</h1>
          <p className="text-gray-600">Site genel ayarlarını yönetin</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:p-8 space-y-8"
        >
          {/* Genel Ayarlar */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Genel Ayarlar</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Adı *
                </label>
                <input
                  type="text"
                  value={settings.siteName}
                  onChange={(e) => updateSetting('siteName', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Site Açıklaması *
                </label>
                <textarea
                  rows={3}
                  value={settings.siteDescription}
                  onChange={(e) => updateSetting('siteDescription', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* İletişim Bilgileri */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">İletişim Bilgileri</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  E-posta
                </label>
                <input
                  type="email"
                  value={settings.contactEmail}
                  onChange={(e) => updateSetting('contactEmail', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={settings.contactPhone}
                  onChange={(e) => updateSetting('contactPhone', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adres
                </label>
                <textarea
                  rows={2}
                  value={settings.address}
                  onChange={(e) => updateSetting('address', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none resize-none"
                />
              </div>
            </div>
          </div>

          {/* Sosyal Medya */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Sosyal Medya</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Facebook URL
                </label>
                <input
                  type="url"
                  value={settings.socialMedia.facebook || ''}
                  onChange={(e) => updateSocialMedia('facebook', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  placeholder="https://facebook.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Instagram URL
                </label>
                <input
                  type="url"
                  value={settings.socialMedia.instagram || ''}
                  onChange={(e) => updateSocialMedia('instagram', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  placeholder="https://instagram.com/..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Twitter URL
                </label>
                <input
                  type="url"
                  value={settings.socialMedia.twitter || ''}
                  onChange={(e) => updateSocialMedia('twitter', e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none"
                  placeholder="https://twitter.com/..."
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex gap-4 pt-4 border-t">
            <motion.button
              onClick={handleSave}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              <FiSave className="w-5 h-5" />
              {saving ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </motion.button>

            <button
              onClick={fetchSettings}
              className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              <FiRefreshCw className="w-5 h-5" />
              Yenile
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

