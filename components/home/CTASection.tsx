'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { FiArrowRight, FiShield, FiTruck, FiStar } from 'react-icons/fi'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

export default function CTASection() {
  const [content, setContent] = useState({
    badge: 'HAYATA GÜLÜMSE',
    title: 'Gülümsemeye bugün başla.',
    titleHighlight: 'Sağlığı ve estetiği keşfet.',
    description: 'Hızlı kargo, 2 yıl resmi garanti ve %100 memnuniyet güvencesiyle sana en uygun ürünü hemen sipariş et.',
    primaryButtonText: 'Tüm Ürünleri İncele',
    secondaryButtonText: 'İletişime Geç',
    guarantee1: 'Aynı Gün Kargo Teslimatı',
    guarantee2: '2 Yıl Birebir Değişim Garantisi',
    guarantee3: '%100 Hijyen ve Müşteri Memnuniyeti',
  })

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const unsub = onSnapshot(doc(db, 'siteContent', 'cta'), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setContent((prev) => ({
            ...prev,
            badge: d.badge || prev.badge,
            title: d.title || prev.title,
            titleHighlight: d.titleHighlight || prev.titleHighlight,
            description: d.description || prev.description,
            primaryButtonText: d.primaryButtonText || prev.primaryButtonText,
            secondaryButtonText: d.secondaryButtonText || prev.secondaryButtonText,
            guarantee1: d.guarantee1 || prev.guarantee1,
            guarantee2: d.guarantee2 || prev.guarantee2,
            guarantee3: d.guarantee3 || prev.guarantee3,
          }))
        }
      })
      return () => unsub()
    } catch (err) {
      console.error('CTA realtime error:', err)
    }
  }, [])

  return (
    <section className="py-24 md:py-36 bg-gradient-to-br from-brand-navy via-slate-900 to-brand-navy text-white relative overflow-hidden">
      {/* Background Animated Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brand-blue/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-10 w-96 h-96 bg-brand-green/15 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/20 backdrop-blur-md mb-8"
        >
          <FiStar className="w-4 h-4 text-brand-green" />
          <span className="text-xs md:text-sm font-semibold tracking-wider text-slate-200 uppercase">
            {content.badge}
          </span>
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-4xl md:text-6xl lg:text-7xl font-black text-white tracking-tight leading-tight mb-6"
        >
          {content.title} <br />
          <span className="text-gradient-brand">{content.titleHighlight}</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="text-slate-300 text-base md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          {content.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
        >
          <Link
            href="/urunler"
            className="w-full sm:w-auto px-10 py-5 bg-gradient-to-r from-brand-blue to-blue-600 text-white font-black text-base rounded-full shadow-2xl shadow-brand-blue/40 hover:scale-105 transition-transform flex items-center justify-center gap-2"
          >
            <span>{content.primaryButtonText}</span>
            <FiArrowRight className="w-5 h-5" />
          </Link>

          <Link
            href="/iletisim"
            className="w-full sm:w-auto px-10 py-5 bg-white/10 text-white font-bold text-base rounded-full border border-white/20 hover:bg-white/20 transition-all flex items-center justify-center"
          >
            {content.secondaryButtonText}
          </Link>
        </motion.div>

        {/* Guarantee Pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-10 border-t border-slate-800 text-xs text-slate-400">
          <div className="flex items-center justify-center gap-2">
            <FiTruck className="w-4 h-4 text-brand-blue" />
            <span>{content.guarantee1}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <FiShield className="w-4 h-4 text-brand-green" />
            <span>{content.guarantee2}</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <FiStar className="w-4 h-4 text-cyan-400" />
            <span>{content.guarantee3}</span>
          </div>
        </div>
      </div>
    </section>
  )
}
