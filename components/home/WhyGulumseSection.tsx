'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiCheckCircle, FiHeart, FiShield, FiUsers, FiCompass, FiSun, FiAward } from 'react-icons/fi'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { DynamicSectionItem } from '@/lib/firebase/content'

const ICONS = [FiHeart, FiShield, FiUsers, FiCompass, FiSun, FiAward, FiCheckCircle]
const COLORS = [
  { grad: 'from-brand-blue to-cyan-500', light: 'bg-blue-50 border-blue-100 text-brand-blue' },
  { grad: 'from-brand-green to-emerald-500', light: 'bg-emerald-50 border-emerald-100 text-brand-green' },
  { grad: 'from-purple-500 to-indigo-500', light: 'bg-purple-50 border-purple-100 text-purple-600' },
  { grad: 'from-cyan-500 to-blue-600', light: 'bg-cyan-50 border-cyan-100 text-cyan-600' },
  { grad: 'from-amber-400 to-orange-500', light: 'bg-amber-50 border-amber-100 text-amber-600' },
]

const DEFAULT_BENEFITS: DynamicSectionItem[] = [
  { id: 'b_1', title: 'Daha Sağlıklı Dişler', description: 'Plağa karşı %99.4 daha etkili koruma ile diş eti sağlığınızı güçlendirin.', order: 1, active: true },
  { id: 'b_2', title: 'Güvenli ve Doğal Temizlik', description: 'BPA içermeyen medikal malzeme ve mikro aktif karbon kıl teknolojisi.', order: 2, active: true },
  { id: 'b_3', title: 'Aile Boyu Kullanım', description: 'Değiştirilebilir renkli başlıklar ve yetişkin/çocuk hassas modları.', order: 3, active: true },
  { id: 'b_4', title: 'Seyahatler İçin İdeal', description: 'Ultra hafif ergonomik kılıf, 45 günlük pil ve katlanabilir seçenekler.', order: 4, active: true },
  { id: 'b_5', title: 'Daha Beyaz Bir Gülüş', description: 'İlk haftadan itibaren çay, kahve ve lekelere karşı görünür parlatma.', order: 5, active: true },
]

export default function WhyGulumseSection() {
  const [header, setHeader] = useState({
    badge: 'Neden Gülümse?',
    title: 'Fark Yaratan 5 Marka Değeri.',
    subtitle: 'Ağız ve diş sağlığında en yüksek standartları estetikle buluşturuyoruz.',
  })
  const [benefits, setBenefits] = useState<DynamicSectionItem[]>(DEFAULT_BENEFITS)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const unsub = onSnapshot(doc(db, 'siteContent', 'whyGulumse'), (snap) => {
        if (snap.exists()) {
          const d = snap.data()
          setHeader({
            badge: d.badge || 'Neden Gülümse?',
            title: d.title || 'Fark Yaratan 5 Marka Değeri.',
            subtitle: d.subtitle || 'Ağız ve diş sağlığında en yüksek standartları estetikle buluşturuyoruz.',
          })

          if (d.items && Array.isArray(d.items)) {
            const activeItems = d.items.filter((item: any) => item.active !== false)
            if (activeItems.length > 0) {
              setBenefits(activeItems.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)))
            }
          }
        }
      })
      return () => unsub()
    } catch (err) {
      console.error('WhyGulumse realtime error:', err)
    }
  }, [])

  return (
    <section className="py-24 md:py-36 bg-slate-50 relative overflow-hidden">
      {/* Background Gradient Shapes */}
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-brand-blue/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10">
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-widest text-brand-blue bg-brand-blue/10 px-4 py-1.5 rounded-full border border-brand-blue/20"
          >
            {header.badge}
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black text-brand-navy tracking-tight mt-4 mb-4"
          >
            {header.title}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-600 text-base md:text-lg"
          >
            {header.subtitle}
          </motion.p>
        </div>

        {/* Dynamic Benefits Grid */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${benefits.length >= 5 ? 'lg:grid-cols-5' : benefits.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
          {benefits.map((item, idx) => {
            const Icon = ICONS[idx % ICONS.length]
            const colorScheme = COLORS[idx % COLORS.length]

            return (
              <motion.div
                key={item.id || idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                whileHover={{ y: -8, transition: { duration: 0.2 } }}
                className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-all flex flex-col justify-between group"
              >
                <div>
                  {/* Top Step Pill & Icon */}
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-xs font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full group-hover:bg-brand-navy group-hover:text-white transition-colors">
                      0{idx + 1}
                    </span>
                    <div className={`w-12 h-12 rounded-2xl ${colorScheme.light} border flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-xs`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-lg md:text-xl font-bold text-brand-navy mb-3 group-hover:text-brand-blue transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-slate-500 text-xs md:text-sm leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Bottom Color Accent Bar */}
                <div className="w-full h-1 bg-slate-100 rounded-full mt-6 overflow-hidden">
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
