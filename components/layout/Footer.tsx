'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import Link from 'next/link'
import { FiFacebook, FiInstagram, FiTwitter, FiMail } from 'react-icons/fi'

interface SiteSettings {
  siteName?: string
  siteDescription?: string
  contactEmail?: string
  contactPhone?: string
  address?: string
  socialMedia?: {
    facebook?: string
    instagram?: string
    twitter?: string
  }
}

export default function Footer() {
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: 'SmileBrush',
    siteDescription: 'Modern elektrikli diş fırçası çözümleri ile sağlıklı gülüşler.',
    socialMedia: {}
  })

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const settingsRef = doc(db, 'settings', 'site')
      
      // Real-time listener - Firebase değişikliklerini dinle
      const unsubscribe = onSnapshot(
        settingsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as SiteSettings
            setSettings(data)
            console.log('✅ Footer settings loaded from Firebase:', data)
          }
        },
        (error) => {
          console.error('❌ Footer settings error:', error)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Footer initialization error:', error)
    }
  }, [])

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="container-custom section-padding py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-2xl font-bold text-white mb-4">{settings.siteName || 'SmileBrush'}</h3>
            <p className="text-sm">
              {settings.siteDescription || 'Modern elektrikli diş fırçası çözümleri ile sağlıklı gülüşler.'}
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white font-semibold mb-4">Hızlı Linkler</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-primary-400 transition-colors">
                  Ana Sayfa
                </Link>
              </li>
              <li>
                <Link href="/urunler" className="hover:text-primary-400 transition-colors">
                  Ürünler
                </Link>
              </li>
              <li>
                <Link href="/hakkimizda" className="hover:text-primary-400 transition-colors">
                  Hakkımızda
                </Link>
              </li>
              <li>
                <Link href="/iletisim" className="hover:text-primary-400 transition-colors">
                  İletişim
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="text-white font-semibold mb-4">Destek</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/sss" className="hover:text-primary-400 transition-colors">
                  Sık Sorulan Sorular
                </Link>
              </li>
              <li>
                <Link href="/kargo" className="hover:text-primary-400 transition-colors">
                  Kargo Bilgileri
                </Link>
              </li>
              <li>
                <Link href="/iptal" className="hover:text-primary-400 transition-colors">
                  İade ve Değişim
                </Link>
              </li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-white font-semibold mb-4">Bizi Takip Edin</h4>
            <div className="flex space-x-4">
              {settings.socialMedia?.facebook && (
                <a href={settings.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-800 hover:bg-primary-600 transition-colors">
                  <FiFacebook className="w-5 h-5" />
                </a>
              )}
              {settings.socialMedia?.instagram && (
                <a href={settings.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-800 hover:bg-primary-600 transition-colors">
                  <FiInstagram className="w-5 h-5" />
                </a>
              )}
              {settings.socialMedia?.twitter && (
                <a href={settings.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-gray-800 hover:bg-primary-600 transition-colors">
                  <FiTwitter className="w-5 h-5" />
                </a>
              )}
              {settings.contactEmail && (
                <a href={`mailto:${settings.contactEmail}`} className="p-2 rounded-full bg-gray-800 hover:bg-primary-600 transition-colors">
                  <FiMail className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm">
          <p>&copy; {new Date().getFullYear()} {settings.siteName || 'SmileBrush'}. Tüm hakları saklıdır.</p>
        </div>
      </div>
    </footer>
  )
}


