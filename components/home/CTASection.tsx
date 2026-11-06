'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { FiArrowRight, FiShield, FiTruck, FiStar } from 'react-icons/fi'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { useLocale } from '@/context/LocaleContext'

export default function CTASection() {
  const { locale, t, getLocalizedText, getLocalizedPath } = useLocale()

  const [dbContent, setDbContent] = useState<any>(null)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const unsub = onSnapshot(doc(db, 'siteContent', 'cta'), (snap) => {
        if (snap.exists()) {
          setDbContent(snap.data())
        }
      })
      return () => unsub()
    } catch (err) {
      console.error('CTA realtime error:', err)
    }
  }, [])

  // If locale is NOT 'tr', strictly prioritize dictionary translations unless localized object exists
  const badge = typeof dbContent?.badge === 'object' && dbContent?.badge !== null
    ? getLocalizedText(dbContent.badge, t.cta.badge)
    : (locale === 'tr' ? (dbContent?.badge || t.cta.badge) : t.cta.badge)

  const title = typeof dbContent?.title === 'object' && dbContent?.title !== null
    ? getLocalizedText(dbContent.title, t.cta.title)
    : (locale === 'tr' ? (dbContent?.title || t.cta.title) : t.cta.title)

  const titleHighlight = typeof dbContent?.titleHighlight === 'object' && dbContent?.titleHighlight !== null
    ? getLocalizedText(dbContent.titleHighlight, t.cta.titleHighlight)
    : (locale === 'tr' ? (dbContent?.titleHighlight || t.cta.titleHighlight) : t.cta.titleHighlight)

  const description = typeof dbContent?.description === 'object' && dbContent?.description !== null
    ? getLocalizedText(dbContent.description, t.cta.description)
    : (locale === 'tr' ? (dbContent?.description || t.cta.description) : t.cta.description)

  const primaryButtonText = typeof dbContent?.primaryButtonText === 'object' && dbContent?.primaryButtonText !== null
    ? getLocalizedText(dbContent.primaryButtonText, t.cta.primaryButtonText)
    : (locale === 'tr' ? (dbContent?.primaryButtonText || t.cta.primaryButtonText) : t.cta.primaryButtonText)

  const secondaryButtonText = typeof dbContent?.secondaryButtonText === 'object' && dbContent?.secondaryButtonText !== null
    ? getLocalizedText(dbContent.secondaryButtonText, t.cta.secondaryButtonText)
    : (locale === 'tr' ? (dbContent?.secondaryButtonText || t.cta.secondaryButtonText) : t.cta.secondaryButtonText)

  const guarantee1 = typeof dbContent?.guarantee1 === 'object' && dbContent?.guarantee1 !== null
    ? getLocalizedText(dbContent.guarantee1, t.cta.guarantee1)
    : (locale === 'tr' ? (dbContent?.guarantee1 || t.cta.guarantee1) : t.cta.guarantee1)

  const guarantee2 = typeof dbContent?.guarantee2 === 'object' && dbContent?.guarantee2 !== null
    ? getLocalizedText(dbContent.guarantee2, t.cta.guarantee2)
    : (locale === 'tr' ? (dbContent?.guarantee2 || t.cta.guarantee2) : t.cta.guarantee2)

  const guarantee3 = typeof dbContent?.guarantee3 === 'object' && dbContent?.guarantee3 !== null
    ? getLocalizedText(dbContent.guarantee3, t.cta.guarantee3)
    : (locale === 'tr' ? (dbContent?.guarantee3 || t.cta.guarantee3) : t.cta.guarantee3)

  return (
    <section className="py-20 md:py-32 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-white relative overflow-hidden">
      {/* Background Animated Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-8"
        >
          <FiStar className="w-4 h-4 text-emerald-400" />
          <span className="text-xs md:text-sm font-bold tracking-wider text-slate-200 uppercase">
            {badge}
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-3xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight mb-6"
        >
          {title} <br />
          <span className="bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
            {titleHighlight}
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-slate-300 text-sm md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed font-normal"
        >
          {description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14"
        >
          <Link
            href={getLocalizedPath('/urunler')}
            className="w-full sm:w-auto px-10 py-4.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white font-black text-sm uppercase tracking-wider rounded-full shadow-2xl shadow-sky-600/40 hover:scale-104 transition-transform flex items-center justify-center gap-2"
          >
            <span>{primaryButtonText}</span>
            <FiArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href={getLocalizedPath('/iletisim')}
            className="w-full sm:w-auto px-9 py-4.5 bg-white/10 hover:bg-white/20 text-white font-bold text-sm uppercase tracking-wider rounded-full border border-white/20 transition-all flex items-center justify-center"
          >
            {secondaryButtonText}
          </Link>
        </motion.div>

        {/* Guarantee Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center justify-center gap-2">
            <FiTruck className="w-4 h-4 text-sky-400" />
            <span>{guarantee1}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <FiShield className="w-4 h-4 text-emerald-400" />
            <span>{guarantee2}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <FiStar className="w-4 h-4 text-cyan-400" />
            <span>{guarantee3}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
