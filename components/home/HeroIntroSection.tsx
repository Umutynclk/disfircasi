'use client'

import { motion } from 'framer-motion'
import { FiArrowDown, FiZap, FiCheckCircle } from 'react-icons/fi'

export default function HeroIntroSection() {
  const scrollToChoice = () => {
    const el = document.getElementById('product-choice')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section className="relative min-h-[90vh] md:min-h-screen flex flex-col justify-center items-center overflow-hidden pt-28 pb-16 bg-gradient-to-b from-slate-50 via-white to-blue-50/40">
      {/* Background Animated Gradient Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-brand-blue/20 via-cyan-400/15 to-brand-green/20 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute top-1/3 right-10 w-72 h-72 bg-brand-green/10 rounded-full blur-2xl pointer-events-none animate-float" />

      <div className="container-custom section-padding relative z-10 text-center max-w-4xl mx-auto flex flex-col items-center">
        {/* Brand Tagline Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 border border-brand-blue/20 shadow-sm backdrop-blur-md mb-8"
        >
          <FiZap className="w-4 h-4 text-brand-blue" />
          <span className="text-xs md:text-sm font-semibold tracking-wider text-brand-navy uppercase">
            GÜLÜMSE Premium Dental-Tech
          </span>
        </motion.div>

        {/* Main Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl lg:text-8xl font-black text-brand-navy tracking-tight leading-[1.08] mb-6"
        >
          Gülümsemenin <br className="hidden sm:inline" />
          <span className="text-gradient-brand">yeni hali.</span>
        </motion.h1>

        {/* Subtext */}
        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-slate-600 text-lg md:text-2xl max-w-2xl mx-auto font-normal leading-relaxed mb-10"
        >
          İhtiyacın olan kusursuz diş bakım ve beyazlatma deneyimini sinematik 3D teknolojisiyle keşfet.
        </motion.p>

        {/* Value Pills */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-wrap justify-center items-center gap-4 md:gap-8 text-xs md:text-sm text-slate-700 font-medium mb-12"
        >
          <span className="flex items-center gap-1.5 bg-white/70 px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
            <FiCheckCircle className="text-brand-green w-4 h-4" /> 360° Sonic Temizlik
          </span>
          <span className="flex items-center gap-1.5 bg-white/70 px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
            <FiCheckCircle className="text-brand-blue w-4 h-4" /> Medikal Hijyen Başlıkları
          </span>
          <span className="flex items-center gap-1.5 bg-white/70 px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-xs">
            <FiCheckCircle className="text-cyan-500 w-4 h-4" /> Klinik Onaylı Bakım
          </span>
        </motion.div>

        {/* Scroll Indicator Button */}
        <motion.button
          onClick={scrollToChoice}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="group flex flex-col items-center gap-2 text-slate-500 hover:text-brand-blue transition-colors cursor-pointer"
        >
          <span className="text-xs font-semibold uppercase tracking-widest">Aşağı Scroll Et</span>
          <div className="w-10 h-10 rounded-full border border-slate-200 group-hover:border-brand-blue/40 flex items-center justify-center bg-white/80 shadow-xs group-hover:scale-110 transition-all">
            <FiArrowDown className="w-4 h-4 animate-bounce text-brand-blue" />
          </div>
        </motion.button>
      </div>
    </section>
  )
}
