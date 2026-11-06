'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiCheckCircle, FiHeart, FiShield, FiUsers, FiCompass, FiSun, FiAward } from 'react-icons/fi'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { DynamicSectionItem } from '@/lib/firebase/content'
import { useLocale } from '@/context/LocaleContext'

const ICONS = [FiHeart, FiShield, FiUsers, FiCompass, FiSun, FiAward, FiCheckCircle]
const COLORS = [
  { grad: 'from-sky-500 to-blue-600', light: 'bg-sky-50 border-sky-100 text-sky-600' },
  { grad: 'from-emerald-500 to-teal-600', light: 'bg-emerald-50 border-emerald-100 text-emerald-600' },
  { grad: 'from-purple-500 to-indigo-500', light: 'bg-purple-50 border-purple-100 text-purple-600' },
  { grad: 'from-cyan-500 to-blue-600', light: 'bg-cyan-50 border-cyan-100 text-cyan-600' },
  { grad: 'from-amber-400 to-orange-500', light: 'bg-amber-50 border-amber-100 text-amber-600' },
]

export default function WhyGulumseSection() {
  const { t, locale, getLocalizedText } = useLocale()

  const defaultBenefits: DynamicSectionItem[] = [
    { id: 'b_1', title: t.whyGulumse.b1Title, description: t.whyGulumse.b1Desc, order: 1, active: true },
    { id: 'b_2', title: t.whyGulumse.b2Title, description: t.whyGulumse.b2Desc, order: 2, active: true },
    { id: 'b_3', title: t.whyGulumse.b3Title, description: t.whyGulumse.b3Desc, order: 3, active: true },
    { id: 'b_4', title: t.whyGulumse.b4Title, description: t.whyGulumse.b4Desc, order: 4, active: true },
    { id: 'b_5', title: t.whyGulumse.b5Title, description: t.whyGulumse.b5Desc, order: 5, active: true },
  ]

  const [header, setHeader] = useState({
    badge: t.whyGulumse.badge,
    title: t.whyGulumse.title,
    subtitle: t.whyGulumse.subtitle,
  })

  const [benefits, setBenefits] = useState<DynamicSectionItem[]>(defaultBenefits)

  useEffect(() => {
    // Baseline updates when language/dictionary changes
    setHeader({
      badge: t.whyGulumse.badge,
      title: t.whyGulumse.title,
      subtitle: t.whyGulumse.subtitle,
    })
    setBenefits(defaultBenefits)

    try {
      const db = getFirestoreDB()
      const unsub = onSnapshot(doc(db, 'siteContent', 'whyGulumse'), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          if (locale === 'tr') {
            setHeader({
              badge: d.badge || t.whyGulumse.badge,
              title: d.title || t.whyGulumse.title,
              subtitle: d.subtitle || t.whyGulumse.subtitle,
            })

            if (d.items && Array.isArray(d.items)) {
              const activeItems = d.items.filter((item: any) => item.active !== false)
              if (activeItems.length > 0) {
                setBenefits(activeItems.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
              }
            }
          } else {
            const trans = d.translations?.[locale]
            setHeader({
              badge: trans?.badge || d[`badge_${locale}`] || t.whyGulumse.badge,
              title: trans?.title || d[`title_${locale}`] || t.whyGulumse.title,
              subtitle: trans?.subtitle || d[`subtitle_${locale}`] || t.whyGulumse.subtitle,
            })

            if (trans?.items && Array.isArray(trans.items) && trans.items.length > 0) {
              setBenefits(trans.items)
            } else {
              setBenefits(defaultBenefits)
            }
          }
        }
      })
      return () => unsub()
    } catch (err) {
      console.error('WhyGulumse realtime error:', err)
    }
  }, [t, locale])

  return (
    <section className="py-20 md:py-32 bg-white relative overflow-hidden border-t border-slate-100">
      {/* Background Gradient Shapes */}
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-sky-100/30 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-100/30 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-black uppercase tracking-widest text-sky-600 bg-sky-100 px-4 py-1.5 rounded-full border border-sky-200"
          >
            {getLocalizedText(header.badge as any, t.whyGulumse.badge)}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-black text-slate-900 tracking-tight mt-4 mb-4"
          >
            {getLocalizedText(header.title as any, t.whyGulumse.title)}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-600 text-sm md:text-base"
          >
            {getLocalizedText(header.subtitle as any, t.whyGulumse.subtitle)}
          </motion.p>
        </div>

        {/* Dynamic Benefits Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${benefits.length >= 5 ? 'lg:grid-cols-5' : benefits.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
          {benefits.map((item, idx) => {
            const Icon = ICONS[idx % ICONS.length]
            const colorScheme = COLORS[idx % COLORS.length]
            const itemTitle = getLocalizedText(item.title as any, item.title)
            const itemDesc = getLocalizedText(item.description as any, item.description)

            return (
              <motion.div
                key={item.id || idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="bg-slate-50/70 rounded-3xl p-6 md:p-7 border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Step Pill & Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-black text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                      0{idx + 1}
                    </span>
                    <div className={`w-12 h-12 rounded-2xl ${colorScheme.light} border flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-2xs`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-base md:text-lg font-black text-slate-900 mb-2 group-hover:text-sky-600 transition-colors">
                    {itemTitle}
                  </h3>

                  <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                    {itemDesc}
                  </p>
                </div>

                {/* Bottom Color Accent Bar */}
                <div className="w-full h-1 bg-slate-200/60 rounded-full mt-6 overflow-hidden">
                  <div className={`w-0 group-hover:w-full h-full bg-gradient-to-r ${colorScheme.grad} transition-all duration-500`} />
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
