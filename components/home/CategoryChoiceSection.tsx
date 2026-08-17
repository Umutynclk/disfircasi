'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { FiArrowRight, FiZap, FiFeather, FiCheckCircle, FiShoppingBag } from 'react-icons/fi'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { DynamicSectionItem } from '@/lib/firebase/content'

interface CategoryProductItem {
  id: string
  name: string
  image?: string
  images?: string[]
  category?: string
}

interface CategoryChoiceSectionProps {
  autoProducts?: CategoryProductItem[]
  disposableProducts?: CategoryProductItem[]
}

const DEFAULT_CARDS: DynamicSectionItem[] = [
  {
    id: 'cat_1',
    badge: 'Sonic Technology',
    title: 'OTOMATİK DİŞ FIRÇASI',
    description: '360° sonic titreşim teknolojisi ile dişlerinizi 45 saniyede zahmetsizce ve profesyonel standartta temizleyin.',
    bullets: ['360° Eşzamanlı Fırçalama', '45 Günlük Pil Ömrü', 'Hassas Diş Eti Masajı'],
    ctaText: 'Otomatik Modelleri İncele',
    ctaUrl: '/urunler?kategori=otomatik',
    order: 1,
    active: true,
  },
  {
    id: 'cat_2',
    badge: 'Everyday Hygiene',
    title: 'KULLAN AT DİŞ FIRÇASI',
    description: 'Seyahat, ofis ve misafirlikler için kendinden macunlu veya ultra hijyenik tek kullanımlık çözümler.',
    bullets: ['%100 Medikal Hijyen Paketi', 'Kendinden Macunlu Pratiklik', 'Çanta ve Seyahat Boyu'],
    ctaText: 'Kullan-At Serisini İncele',
    ctaUrl: '/urunler?kategori=kullan-at',
    order: 2,
    active: true,
  },
]

export default function CategoryChoiceSection({
  autoProducts = [],
  disposableProducts = [],
}: CategoryChoiceSectionProps) {
  const [cards, setCards] = useState<DynamicSectionItem[]>(DEFAULT_CARDS)
  const [header, setHeader] = useState({
    sectionBadge: 'Seçimini Yap',
    sectionTitle: 'Gülüşün için doğru seçimi yap.',
    sectionSubtitle: 'İhtiyacınıza en uygun diş fırçası deneyimini seçin. Yüksek teknolojili sonic temizlik veya pratik kullan-at hijyen.',
  })

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const unsub = onSnapshot(doc(db, 'siteContent', 'categoryChoice'), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setHeader({
            sectionBadge: d.sectionBadge || 'Seçimini Yap',
            sectionTitle: d.sectionTitle || 'Gülüşün için doğru seçimi yap.',
            sectionSubtitle: d.sectionSubtitle || 'İhtiyacınıza en uygun diş fırçası deneyimini seçin.',
          })

          if (d.items && Array.isArray(d.items)) {
            const activeItems = d.items.filter((item: any) => item.active !== false)
            if (activeItems.length > 0) {
              setCards(activeItems.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
            }
          }
        }
      })
      return () => unsub()
    } catch (err) {
      console.error('CategoryChoice realtime error:', err)
    }
  }, [])

  const autoImages = autoProducts.map((p) => p.images?.[0] || p.image).filter(Boolean) as string[]
  const dispImages = disposableProducts.map((p) => p.images?.[0] || p.image).filter(Boolean) as string[]

  return (
    <section id="kategoriler" className="py-24 md:py-36 bg-white relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] bg-brand-blue/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-xs font-extrabold uppercase tracking-[0.2em] text-brand-blue bg-brand-softBlue px-4 py-1.5 rounded-full border border-brand-blue/20 mb-4"
          >
            {header.sectionBadge}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl sm:text-4xl md:text-5xl font-black text-brand-navy tracking-tight mb-4"
          >
            {header.sectionTitle}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto"
          >
            {header.sectionSubtitle}
          </motion.p>
        </div>

        {/* Dynamic Category Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {cards.map((card, index) => {
            const isAuto = card.title.toLowerCase().includes('otomatik') || index % 2 === 0
            const previewImg = card.image || (isAuto ? autoImages[0] : dispImages[0])

            return (
              <Link
                key={card.id || index}
                href={card.ctaUrl || '/urunler'}
                className={`group relative rounded-[2.5rem] p-8 sm:p-10 md:p-12 border transition-all duration-500 flex flex-col justify-between overflow-hidden min-h-[460px] ${
                  isAuto
                    ? 'bg-gradient-to-br from-brand-softBlue/80 via-white to-blue-50/50 border-brand-blue/20 hover:border-brand-blue/50 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-brand-blue/20'
                    : 'bg-gradient-to-br from-brand-softGreen/80 via-white to-emerald-50/50 border-brand-green/20 hover:border-brand-green/50 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-brand-green/20'
                }`}
              >
                {/* Ambient Glow */}
                <div
                  className={`absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl group-hover:scale-125 transition-transform duration-700 pointer-events-none ${
                    isAuto ? 'bg-brand-blue/15' : 'bg-brand-green/15'
                  }`}
                />

                {/* Top Details */}
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div
                      className={`w-14 h-14 rounded-2xl text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-500 ${
                        isAuto ? 'bg-brand-blue shadow-brand-blue/30' : 'bg-brand-green shadow-brand-green/30'
                      }`}
                    >
                      {isAuto ? <FiZap className="w-7 h-7" /> : <FiFeather className="w-7 h-7" />}
                    </div>

                    {card.badge && (
                      <span
                        className={`text-[11px] font-extrabold uppercase tracking-wider bg-white px-3.5 py-1.5 rounded-full border shadow-xs ${
                          isAuto
                            ? 'text-brand-blue border-brand-blue/20'
                            : 'text-brand-green border-brand-green/20'
                        }`}
                      >
                        {card.badge}
                      </span>
                    )}
                  </div>

                  <h3 className="text-2xl sm:text-4xl font-black text-brand-navy mb-3 group-hover:text-brand-blue transition-colors">
                    {card.title}
                  </h3>

                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-sm mb-6">
                    {card.description}
                  </p>

                  {/* Bullets */}
                  {card.bullets && card.bullets.length > 0 && (
                    <div className="space-y-2 mb-8 text-xs font-semibold text-slate-700">
                      {card.bullets.map((b, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2">
                          <FiCheckCircle
                            className={`w-4 h-4 ${isAuto ? 'text-brand-blue' : 'text-brand-green'}`}
                          />
                          <span>{b}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Floating Preview Image */}
                <div className="relative h-44 sm:h-52 w-full mt-4 flex items-center justify-center">
                  <motion.div
                    whileHover={{ scale: 1.08 }}
                    transition={{ duration: 0.4 }}
                    className="relative z-10 w-44 h-44 drop-shadow-2xl flex items-center justify-center"
                  >
                    {previewImg ? (
                      <Image
                        src={previewImg}
                        alt={card.title}
                        fill
                        className="object-contain"
                        sizes="200px"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/80 rounded-2xl flex flex-col items-center justify-center text-slate-400">
                        <FiShoppingBag className="w-10 h-10 mb-1" />
                        <span className="text-xs font-bold">{card.title}</span>
                      </div>
                    )}
                  </motion.div>
                </div>

                {/* Bottom CTA Action Bar */}
                <div className="relative z-10 pt-6 mt-4 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-sm font-bold text-brand-navy group-hover:text-brand-blue transition-colors">
                    {card.ctaText || 'Koleksiyonu İncele'}
                  </span>
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      isAuto
                        ? 'bg-brand-blue text-white group-hover:translate-x-1.5'
                        : 'bg-brand-green text-white group-hover:translate-x-1.5'
                    }`}
                  >
                    <FiArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
