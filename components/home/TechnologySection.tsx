'use client'

import { motion } from 'framer-motion'
import { FiZap, FiShield, FiDroplet, FiClock } from 'react-icons/fi'

interface TechnologyProduct {
  name?: string
}

const techFeatures = [
  {
    icon: FiZap,
    title: 'Sonic Titreşim',
    description: 'Dakikada 40.000+ titreşimle derin ve etkili temizlik.',
    color: 'text-brand-blue',
    bg: 'bg-brand-blue/10',
    border: 'border-brand-blue/20',
  },
  {
    icon: FiShield,
    title: 'Diş Eti Koruma',
    description: 'Basınç sensörü ile diş etlerinize zarar vermez.',
    color: 'text-brand-green',
    bg: 'bg-brand-green/10',
    border: 'border-brand-green/20',
  },
  {
    icon: FiDroplet,
    title: 'Su Geçirmez',
    description: 'IPX7 su geçirmezlik ile güvenli duş kullanımı.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/20',
  },
  {
    icon: FiClock,
    title: 'Akıllı Zamanlayıcı',
    description: '2 dakikalık fırçalama ve 30 saniyelik bölge uyarısı.',
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/20',
  },
]

interface TechnologySectionProps {
  product?: TechnologyProduct | null
}

export default function TechnologySection({ product }: TechnologySectionProps) {
  return (
    <section className="relative py-28 md:py-40 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-blue/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-20">
          <motion.span
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="inline-block text-[10px] font-bold uppercase tracking-[0.3em] text-brand-blue mb-4"
          >
            Teknoloji
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-black tracking-tight text-white mb-4"
          >
            Fark yaratan özellikler.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-base md:text-lg max-w-xl mx-auto"
          >
            {product?.name || 'Gülümse'} ile ağız bakımınız bir üst seviyeye çıkar.
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {techFeatures.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`p-6 rounded-2xl bg-white/[0.03] border ${feature.border} backdrop-blur-sm hover:bg-white/[0.06] transition-colors group`}
            >
              <div className={`w-12 h-12 rounded-xl ${feature.bg} flex items-center justify-center ${feature.color} mb-5 group-hover:scale-110 transition-transform`}>
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
