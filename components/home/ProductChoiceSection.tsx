'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { FiArrowRight, FiZap, FiFeather } from 'react-icons/fi'

export default function ProductChoiceSection() {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState<'auto' | 'disposable' | null>(null)

  const handleSelectCategory = (cat: 'auto' | 'disposable') => {
    if (cat === 'auto') {
      const el = document.getElementById('automatic-experience')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
      else router.push('/urunler?kategori=otomatik')
    } else {
      const el = document.getElementById('disposable-experience')
      if (el) el.scrollIntoView({ behavior: 'smooth' })
      else router.push('/urunler?kategori=kullan-at')
    }
  }

  return (
    <section id="product-choice" className="relative py-32 md:py-48 text-white overflow-hidden bg-transparent">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-brand-blue/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[500px] h-[500px] bg-brand-green/5 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10">
        {/* Section Title Header */}
        <div className="text-center max-w-3xl mx-auto mb-64">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-xs font-bold uppercase tracking-widest text-brand-green bg-brand-green/10 px-4 py-1.5 rounded-full border border-brand-green/20"
          >
            Seçimini Yap
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-black tracking-tight text-white mt-4 mb-4 drop-shadow-lg"
          >
            Gülümsemeye Nereden Başlamak İstersin?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-300 text-base md:text-lg drop-shadow-md"
          >
            İki farklı ağız bakım dünyasını keşfet. Sana uygun olan fırçalama deneyimini seç.
          </motion.p>
        </div>

        {/* Interactive Choice Card Overlay Banner */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto mt-64">
          {/* Card 1: OTOMATİK DİŞ FIRÇASI */}
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            onClick={() => handleSelectCategory('auto')}
            onMouseEnter={() => setActiveCategory('auto')}
            onMouseLeave={() => setActiveCategory(null)}
            className={`p-8 rounded-3xl cursor-pointer transition-all duration-500 glass-card-dark ${
              activeCategory === 'auto'
                ? 'border-brand-blue ring-2 ring-brand-blue/50 shadow-[0_0_60px_rgba(8,120,255,0.3)]'
                : 'border-white/10 hover:border-brand-blue/50'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-blue/20 flex items-center justify-center text-brand-blue">
                <FiZap className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-blue bg-brand-blue/10 px-3 py-1 rounded-full border border-brand-blue/20">
                360° Cleaning Experience
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">OTOMATİK DİŞ FIRÇASI</h3>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              Yüksek frekanslı sonic titreşimler, akıllı zamanlayıcı ve 360° döner başlık ile profesyonel klinik temizlik.
            </p>
            <div className="flex items-center text-brand-blue font-semibold text-sm gap-2 group">
              <span>Şimdi Keşfet</span>
              <FiArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.div>

          {/* Card 2: KULLAN AT DİŞ FIRÇASI */}
          <motion.div
            whileHover={{ y: -6, scale: 1.02 }}
            onClick={() => handleSelectCategory('disposable')}
            onMouseEnter={() => setActiveCategory('disposable')}
            onMouseLeave={() => setActiveCategory(null)}
            className={`p-8 rounded-3xl cursor-pointer transition-all duration-500 glass-card-dark ${
              activeCategory === 'disposable'
                ? 'border-brand-green ring-2 ring-brand-green/50 shadow-[0_0_60px_rgba(19,184,58,0.3)]'
                : 'border-white/10 hover:border-brand-green/50'
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-2xl bg-brand-green/20 flex items-center justify-center text-brand-green">
                <FiFeather className="w-6 h-6" />
              </div>
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-green bg-brand-green/10 px-3 py-1 rounded-full border border-brand-green/20">
                Hygienic Everyday Experience
              </span>
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-white mb-2">KULLAN AT DİŞ FIRÇASI</h3>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              Seyahatler, oteller ve günlük kullanım için %100 hijyenik, hafif, çevre dostu ve pratik diş fırçaları.
            </p>
            <div className="flex items-center text-brand-green font-semibold text-sm gap-2 group">
              <span>Şimdi Keşfet</span>
              <FiArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
