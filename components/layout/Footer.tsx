'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { FiInstagram, FiTwitter, FiFacebook, FiShield, FiTruck, FiRefreshCw } from 'react-icons/fi'
import { useLocale } from '@/context/LocaleContext'
import { subscribeToLegalConfig, DEFAULT_LEGAL_CONFIG, LegalDocumentsConfig } from '@/lib/firebase/legal'

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
  const { t, getLocalizedText, getLocalizedPath } = useLocale()
  const [mounted, setMounted] = useState(false)

  const [settings, setSettings] = useState<SiteSettings>({
    siteName: 'GÜLÜMSE',
    siteDescription: '',
    socialMedia: {}
  })
  const [legalConfig, setLegalConfig] = useState<LegalDocumentsConfig>(DEFAULT_LEGAL_CONFIG)

  useEffect(() => {
    setMounted(true)
    try {
      const db = getFirestoreDB()
      const settingsRef = doc(db, 'settings', 'site')
      const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
          setSettings(snapshot.data() as SiteSettings)
        }
      })
      const unsubLegal = subscribeToLegalConfig((cfg) => {
        setLegalConfig(cfg)
      })
      return () => {
        unsubscribe()
        unsubLegal()
      }
    } catch (error) {
      console.error('Footer settings error:', error)
    }
  }, [])

  return (
    <footer className="relative bg-slate-950 text-slate-300 pt-20 pb-12 overflow-hidden border-t border-slate-900">
      {/* Background Ambient Lights */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10">
        {/* Value Badges Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-14 mb-14 border-b border-slate-800/80">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 flex items-center justify-center text-sky-400">
              <FiTruck className="w-6 h-6" />
            </div>
            <div>
              <h5 className="text-white font-bold text-sm">{t.footer.badge1Title}</h5>
              <p className="text-xs text-slate-400">{t.footer.badge1Desc}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FiShield className="w-6 h-6" />
            </div>
            <div>
              <h5 className="text-white font-bold text-sm">{t.footer.badge2Title}</h5>
              <p className="text-xs text-slate-400">{t.footer.badge2Desc}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <FiRefreshCw className="w-6 h-6" />
            </div>
            <div>
              <h5 className="text-white font-bold text-sm">{t.footer.badge3Title}</h5>
              <p className="text-xs text-slate-400">{t.footer.badge3Desc}</p>
            </div>
          </div>
        </div>

        {/* Editorial Brand Callout */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-5xl font-black text-white tracking-tight mb-3"
          >
            {t.footer.sloganLead} <span className="bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">{t.footer.sloganHighlight}</span>
          </motion.h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl mx-auto">
            {getLocalizedText(settings.siteDescription as any, t.footer.desc)}
          </p>
        </div>

        {/* Links Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 pb-14 border-b border-slate-800/80 text-sm">
          {/* Products Column */}
          <div>
            <h4 className="text-white font-extrabold tracking-wider uppercase text-xs mb-5 text-sky-400">{t.footer.productGroups}</h4>
            <ul className="space-y-3">
              <li>
                <Link href={`${getLocalizedPath('/urunler')}?kategori=otomatik`} className="hover:text-white transition-colors">
                  {t.footer.automatic}
                </Link>
              </li>
              <li>
                <Link href={`${getLocalizedPath('/urunler')}?kategori=kullan-at`} className="hover:text-white transition-colors">
                  {t.footer.disposable}
                </Link>
              </li>
              <li>
                <Link href={`${getLocalizedPath('/urunler')}?kategori=yedek-firca-basliklari`} className="hover:text-white transition-colors">
                  {t.footer.refills}
                </Link>
              </li>
              <li>
                <Link href={getLocalizedPath('/urunler')} className="hover:text-white transition-colors">
                  {t.footer.travelSets}
                </Link>
              </li>
            </ul>
          </div>

          {/* Corporate Column */}
          <div>
            <h4 className="text-white font-extrabold tracking-wider uppercase text-xs mb-5 text-sky-400">{t.footer.corporate}</h4>
            <ul className="space-y-3">
              <li>
                <Link href={getLocalizedPath('/hakkimizda')} className="hover:text-white transition-colors">
                  {t.footer.about}
                </Link>
              </li>
              <li>
                <Link href={getLocalizedPath('/iletisim')} className="hover:text-white transition-colors">
                  {t.footer.contact}
                </Link>
              </li>
              <li>
                <Link href={getLocalizedPath('/sss')} className="hover:text-white transition-colors">
                  {t.footer.faq}
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care Column */}
          <div>
            <h4 className="text-white font-extrabold tracking-wider uppercase text-xs mb-5 text-sky-400">{t.footer.customerCare}</h4>
            <ul className="space-y-3">
              <li>
                <Link href={getLocalizedPath('/kargo')} className="hover:text-white transition-colors">
                  {t.footer.shipping}
                </Link>
              </li>
              <li>
                <Link href={getLocalizedPath('/iptal')} className="hover:text-white transition-colors">
                  {t.footer.returns}
                </Link>
              </li>
              <li>
                <Link href={getLocalizedPath('/profil')} className="hover:text-white transition-colors">
                  {t.footer.orderTracking}
                </Link>
              </li>
            </ul>
          </div>

          {/* Social & Contact Column */}
          <div>
            <h4 className="text-white font-extrabold tracking-wider uppercase text-xs mb-5 text-sky-400">{t.footer.contactUs}</h4>
            <p className="text-xs text-slate-400 mb-4">
              {t.footer.customerSupport}: <br />
              <span className="text-white font-semibold text-sm">{settings.contactEmail || 'destek@gulumse.com'}</span>
            </p>
            <div className="flex items-center space-x-3">
              <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-sky-500 flex items-center justify-center text-white transition-colors">
                <FiInstagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-sky-500 flex items-center justify-center text-white transition-colors">
                <FiTwitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-white/10 hover:bg-sky-500 flex items-center justify-center text-white transition-colors">
                <FiFacebook className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>

        {/* Legal & Payment Trust Badges (Iyzico Audit Standard) */}
        <div suppressHydrationWarning className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 border-b border-slate-900 pb-6">
          <div suppressHydrationWarning className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span suppressHydrationWarning className="text-slate-400 font-normal">
              GÜLÜMSE© 2026 Kalıport Alüminyum Plastik Kalıp İmalat San. Tic. Ltd. Şti. Tüm Hakları Saklıdır.
            </span>
          </div>

          {/* Payment Trust Badges */}
          {(legalConfig.paymentBadges?.showInFooter ?? true) && (
            <div suppressHydrationWarning className="flex items-center gap-2.5 flex-wrap justify-center text-xs font-bold text-slate-300">
              {(legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items)
                .filter((b) => b.active)
                .map((b) => (
                  <span
                    key={b.id}
                    suppressHydrationWarning
                    className="h-8 px-3.5 rounded-xl bg-slate-900 text-slate-200 border border-slate-800 flex items-center justify-center gap-2 shadow-xs hover:border-slate-700 transition-colors"
                  >
                    {b.logoUrl ? (
                      <img src={b.logoUrl} alt={b.name} className="h-5 max-w-[75px] object-contain inline-block" />
                    ) : (
                      <span className={b.color || 'text-slate-200'}>{b.badgeText || b.name}</span>
                    )}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Legal Links Bar */}
        <div className="pt-4 flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 text-[11px] text-slate-500">
          <Link href={getLocalizedPath('/mesafeli-satis-sozlesmesi')} className="hover:text-sky-400 transition-colors">Mesafeli Satış Sözleşmesi</Link>
          <Link href={getLocalizedPath('/on-bilgilendirme-formu')} className="hover:text-sky-400 transition-colors">Ön Bilgilendirme Formu</Link>
          <Link href={getLocalizedPath('/iptal')} className="hover:text-sky-400 transition-colors">İptal ve İade Koşulları</Link>
          <Link href={getLocalizedPath('/gizlilik-ve-guvenlik')} className="hover:text-sky-400 transition-colors">Gizlilik ve Güvenlik</Link>
          <Link href={getLocalizedPath('/kvkk')} className="hover:text-sky-400 transition-colors">KVKK Aydınlatma Metni</Link>
          <Link href={getLocalizedPath('/kargo')} className="hover:text-sky-400 transition-colors">Teslimat & Kargo</Link>
        </div>

        {/* Developer Signature */}
        <div className="pt-6 mt-6 border-t border-slate-900/60 flex items-center justify-center text-center">
          <p className="text-[11px] tracking-wider text-slate-400 font-medium">
            Developed by Umutynclk
          </p>
        </div>
      </div>
    </footer>
  )
}
