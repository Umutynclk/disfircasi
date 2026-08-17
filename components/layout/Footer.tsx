'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { FiInstagram, FiTwitter, FiFacebook, FiMail, FiShield, FiTruck, FiRefreshCw } from 'react-icons/fi'

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
    siteName: 'GÜLÜMSE',
    siteDescription: 'Ağız sağlığı teknolojisinde yeni nesil 360° hijyen ve beyazlatma deneyimi.',
    socialMedia: {}
  })

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const settingsRef = doc(db, 'settings', 'site')
      const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
          setSettings(snapshot.data() as SiteSettings)
        }
      })
      return () => unsubscribe()
    } catch (error) {
      console.error('Footer settings error:', error)
    }
  }, [])

  return (
    <footer className="relative bg-brand-navy text-slate-300 pt-24 pb-12 overflow-hidden">
      {/* Background Ambient Lights */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-blue/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-brand-green/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10">
        {/* Value Badges Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-16 mb-16 border-b border-slate-800/80">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-brand-blue/20 flex items-center justify-center text-brand-blue">
              <FiTruck className="w-6 h-6" />
            </div>
            <div>
              <h5 className="text-white font-semibold text-sm">Hızlı ve Ücretsiz Kargo</h5>
              <p className="text-xs text-slate-400">Tüm Türkiye'ye aynı gün teslimat</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-brand-green/20 flex items-center justify-center text-brand-green">
              <FiShield className="w-6 h-6" />
            </div>
            <div>
              <h5 className="text-white font-semibold text-sm">2 Yıl Resmi Garanti</h5>
              <p className="text-xs text-slate-400">%100 Orijinal ürün ve müşteri desteği</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <FiRefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h5 className="text-white font-semibold text-sm">14 Gün Kolay İade</h5>
              <p className="text-xs text-slate-400">Kesintisiz iade ve değişim imkanı</p>
            </div>
          </div>
        </div>

        {/* Editorial Brand Callout */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-black text-white tracking-tight mb-4"
          >
            Gülümse. <span className="text-gradient-brand">Daha iyi hisset.</span>
          </motion.h2>
          <p className="text-slate-400 text-base max-w-xl mx-auto">
            {settings.siteDescription || 'Modern ağız ve diş bakımında yüksek teknoloji ve estetik deneyim.'}
          </p>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 pb-16 border-b border-slate-800/80 text-sm">
          {/* Products Column */}
          <div>
            <h4 className="text-white font-bold tracking-wider uppercase text-xs mb-5 text-brand-blue">Ürün Grupları</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/urunler" className="hover:text-white transition-colors">
                  Otomatik Diş Fırçası
                </Link>
              </li>
              <li>
                <Link href="/urunler" className="hover:text-white transition-colors">
                  Kullan At Diş Fırçaları
                </Link>
              </li>
              <li>
                <Link href="/urunler" className="hover:text-white transition-colors">
                  Yedek Başlık Setleri
                </Link>
              </li>
              <li>
                <Link href="/urunler" className="hover:text-white transition-colors">
                  Seyahat Paketleri
                </Link>
              </li>
            </ul>
          </div>

          {/* Corporate Column */}
          <div>
            <h4 className="text-white font-bold tracking-wider uppercase text-xs mb-5 text-brand-blue">Kurumsal</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/hakkimizda" className="hover:text-white transition-colors">
                  Hakkımızda
                </Link>
              </li>
              <li>
                <Link href="/iletisim" className="hover:text-white transition-colors">
                  İletişim & Konum
                </Link>
              </li>
              <li>
                <Link href="/sss" className="hover:text-white transition-colors">
                  Sık Sorulan Sorular
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care Column */}
          <div>
            <h4 className="text-white font-bold tracking-wider uppercase text-xs mb-5 text-brand-blue">Müşteri Destek</h4>
            <ul className="space-y-3">
              <li>
                <Link href="/kargo" className="hover:text-white transition-colors">
                  Kargo ve Teslimat
                </Link>
              </li>
              <li>
                <Link href="/iptal" className="hover:text-white transition-colors">
                  İptal ve İade Koşulları
                </Link>
              </li>
              <li>
                <Link href="/profil" className="hover:text-white transition-colors">
                  Sipariş Takibi
                </Link>
              </li>
            </ul>
          </div>

          {/* Social & Contact Column */}
          <div>
            <h4 className="text-white font-bold tracking-wider uppercase text-xs mb-5 text-brand-blue">Bize Ulaşın</h4>
            <p className="text-xs text-slate-400 mb-4">
              Müşteri Hizmetleri: <br />
              <span className="text-white font-semibold text-sm">{settings.contactEmail || 'destek@gulumse.com'}</span>
            </p>
            <div className="flex items-center space-x-3">
              <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-brand-blue flex items-center justify-center text-white transition-colors">
                <FiInstagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-brand-blue flex items-center justify-center text-white transition-colors">
                <FiTwitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-brand-blue flex items-center justify-center text-white transition-colors">
                <FiFacebook className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white tracking-widest uppercase text-xs">GÜLÜMSE</span>
            <span>© {new Date().getFullYear()} tüm hakları saklıdır.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link href="/kargo" className="hover:text-slate-300 transition-colors">Gizlilik Politikası</Link>
            <Link href="/iptal" className="hover:text-slate-300 transition-colors">Kullanım Koşulları</Link>
            <Link href="/sss" className="hover:text-slate-300 transition-colors">Çerez Ayarları</Link>
          </div>
        </div>
      </div>
    </footer>
  )

}
