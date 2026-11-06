'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { FiArrowRight, FiCheckCircle, FiShoppingBag } from 'react-icons/fi'
import { subscribeToSection, DynamicSectionItem } from '@/lib/firebase/content'
import { useLocale } from '@/context/LocaleContext'

interface PromoProductItem {
  id: string
  name: string
  image?: string
  images?: string[]
}

interface EditorialPromoSectionProps {
  brushProduct?: PromoProductItem | null
  refillProduct?: PromoProductItem | null
}

export default function EditorialPromoSection({
  brushProduct,
  refillProduct,
}: EditorialPromoSectionProps) {
  const { t, getLocalizedText, getLocalizedPath } = useLocale()

  const defaultStories: DynamicSectionItem[] = [
    {
      id: 'story_1',
      badge: t.editorial.s1Badge,
      subtitle: t.editorial.s1Subtitle,
      title: t.editorial.s1Title,
      description: t.editorial.s1Desc,
      bullets: [t.editorial.s1Bullet1, t.editorial.s1Bullet2, t.editorial.s1Bullet3],
      ctaText: t.editorial.s1Cta,
      ctaUrl: '/urunler?kategori=yedek-firca-basliklari',
      image: '',
      order: 1,
      active: true,
    },
    {
      id: 'story_2',
      badge: t.editorial.s2Badge,
      subtitle: t.editorial.s2Subtitle,
      title: t.editorial.s2Title,
      description: t.editorial.s2Desc,
      bullets: [t.editorial.s2Bullet1, t.editorial.s2Bullet2, t.editorial.s2Bullet3],
      ctaText: t.editorial.s2Cta,
      ctaUrl: '/urunler',
      image: '',
      order: 2,
      active: true,
    },
  ]

  const [stories, setStories] = useState<DynamicSectionItem[]>(defaultStories)

  useEffect(() => {
    const unsub = subscribeToSection(
      'editorialPromo',
      (data) => {
        if (data.items && data.items.length > 0) {
          const activeItems = data.items.filter((item) => item.active !== false)
          setStories(activeItems.length > 0 ? activeItems : defaultStories)
        }
      },
      { items: defaultStories }
    )

    return () => unsub()
  }, [t])

  if (stories.length === 0) return null

  return (
    <section className="py-20 md:py-32 bg-slate-900 text-white relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10 space-y-20 md:space-y-32">
        {stories.map((story, index) => {
          const isEven = index % 2 === 1
          const storyImg = story.image || (isEven ? brushProduct?.images?.[0] || brushProduct?.image : refillProduct?.images?.[0] || refillProduct?.image)
          const title = getLocalizedText(story.title as any, story.title)
          const desc = getLocalizedText(story.description as any, story.description)
          const badge = getLocalizedText(story.badge as any, story.badge)
          const subtitle = getLocalizedText(story.subtitle as any, story.subtitle)
          const ctaText = getLocalizedText(story.ctaText as any, story.ctaText)

          return (
            <div
              key={story.id || index}
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center"
            >
              {/* Image Column */}
              <motion.div
                initial={{ opacity: 0, x: isEven ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                className={`lg:col-span-6 flex justify-center ${
                  isEven ? 'order-2 lg:order-2' : 'order-2 lg:order-1'
                }`}
              >
                <div className="relative w-full max-w-lg aspect-[4/3.2] sm:aspect-[4/3] rounded-[3.25rem] sm:rounded-[3.75rem] bg-gradient-to-br from-slate-800/90 via-slate-900/95 to-slate-950 p-6 sm:p-8 border-2 border-white/10 flex items-center justify-center shadow-2xl overflow-hidden group">
                  {/* Luxury Concentric Oval Ambient Glow Behind Product */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <div className="w-56 h-56 sm:w-72 sm:h-72 lg:w-80 lg:h-80 rounded-full bg-gradient-to-tr from-sky-500/20 via-cyan-400/15 to-emerald-500/20 blur-2xl group-hover:scale-115 transition-transform duration-700" />
                    <div className="absolute w-44 h-64 sm:w-56 sm:h-72 rounded-[100px] border border-sky-400/25 rotate-12 opacity-60 group-hover:rotate-45 transition-transform duration-1000" />
                    <div className="absolute w-48 h-60 sm:w-60 sm:h-68 rounded-[100px] border border-emerald-400/20 -rotate-12 opacity-50 group-hover:-rotate-30 transition-transform duration-1000" />
                  </div>

                  {/* Oval Pedestal Base Light */}
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-48 sm:w-64 h-8 bg-sky-400/15 blur-lg rounded-full pointer-events-none" />

                  {storyImg ? (
                    <motion.div
                      animate={{ y: [-4, 4, -4] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative w-full h-full max-h-[290px] flex items-center justify-center z-10"
                    >
                      <Image
                        src={storyImg}
                        alt={title}
                        fill
                        className="object-contain p-3 sm:p-4 drop-shadow-[0_20px_35px_rgba(56,189,248,0.25)] group-hover:scale-106 transition-transform duration-700"
                        sizes="(max-width: 768px) 100vw, 520px"
                        priority={index === 0}
                      />
                    </motion.div>
                  ) : (
                    <div className="text-center text-slate-400 z-10">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-sky-400">
                        <FiShoppingBag className="w-8 h-8" />
                      </div>
                      <span className="text-sm font-semibold text-slate-300">Dental Care</span>
                    </div>
                  )}

                  {/* Badge Pill Overlay */}
                  {badge && (
                    <div className="absolute top-5 left-6 px-4 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-white/20 text-[11px] font-bold text-sky-300 uppercase tracking-wider shadow-lg z-20 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                      <span>{badge}</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Text Column */}
              <motion.div
                initial={{ opacity: 0, x: isEven ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`lg:col-span-6 space-y-6 ${
                  isEven ? 'order-1 lg:order-1' : 'order-1 lg:order-2'
                }`}
              >
                {subtitle && (
                  <span className="inline-block text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full">
                    {subtitle}
                  </span>
                )}

                <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.12] text-white">
                  {title}
                </h3>

                <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
                  {desc}
                </p>

                {/* Bullets List */}
                {story.bullets && story.bullets.length > 0 && (
                  <div className="space-y-3 pt-2">
                    {story.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-3 text-sm text-slate-200">
                        <div className="w-5 h-5 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center flex-shrink-0">
                          <FiCheckCircle className="w-3.5 h-3.5" />
                        </div>
                        <span>{getLocalizedText(bullet as any, bullet)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA Link */}
                {ctaText && (
                  <div className="pt-4">
                    <Link
                      href={getLocalizedPath(story.ctaUrl || '/urunler')}
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-slate-900 hover:bg-sky-500 hover:text-white font-bold text-sm transition-all duration-300 shadow-xl group"
                    >
                      <span>{ctaText}</span>
                      <FiArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
                    </Link>
                  </div>
                )}
              </motion.div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
