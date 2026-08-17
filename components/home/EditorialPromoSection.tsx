'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { FiArrowRight, FiCheckCircle, FiStar, FiShoppingBag } from 'react-icons/fi'
import { subscribeToSection, DynamicSectionItem } from '@/lib/firebase/content'

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

const DEFAULT_STORIES: DynamicSectionItem[] = [
  {
    id: 'story_1',
    badge: 'Her 3 Ayda Bir Yenileyin',
    subtitle: 'Ağız Sağlığı Rutini',
    title: 'Fırçanı Düzenli Yenile, Maksimum Koruma Sağla.',
    description: 'Diş hekimleri, optimum plak temizliği ve bakteri birikimini önlemek için fırça başlıklarının en geç 3 ayda bir yenilenmesini tavsiye ediyor. Gülümse yedek başlıkları ile her zaman ilk günkü hijyeni koruyun.',
    bullets: [
      '%99.8 Plak Temizleme Verimi',
      'Kolay Geçmeli Uyumlu Başlık',
      'Bakteri Tutmayan Medikal Silikon Yapı'
    ],
    ctaText: 'Yedek Başlıkları İncele',
    ctaUrl: '/urunler?kategori=yedek-firca-basliklari',
    image: '',
    order: 1,
    active: true,
  },
  {
    id: 'story_2',
    badge: 'Klinik Hassasiyet',
    subtitle: 'Nazik & Etkili Bakım',
    title: 'Hassas Diş Etlerine Özel Yumuşak Dokunuş.',
    description: 'Mikro incelikteki medikal fırça kılları, diş minenizi çizmeden ve diş etlerinize baskı yapmadan en zorlu aralıklara kadar ulaşır. Günlük kullanımda ferah ve acısız temizlik sağlar.',
    bullets: [
      'Hassas Diş Eti Dostu Yumuşak Kıllar',
      'BPA İçermeyen Güvenli Malzeme',
      'Diş Minesini Koruyan Mikro Titreşim'
    ],
    ctaText: 'Hassas Seri Ürünleri Keşfet',
    ctaUrl: '/urunler',
    image: '',
    order: 2,
    active: true,
  },
]

export default function EditorialPromoSection({
  brushProduct,
  refillProduct,
}: EditorialPromoSectionProps) {
  const [stories, setStories] = useState<DynamicSectionItem[]>(DEFAULT_STORIES)

  useEffect(() => {
    const unsub = subscribeToSection(
      'editorialPromo',
      (data) => {
        if (data.items && data.items.length > 0) {
          const activeItems = data.items.filter((item) => item.active !== false)
          setStories(activeItems.length > 0 ? activeItems : DEFAULT_STORIES)
        }
      },
      { items: DEFAULT_STORIES }
    )

    return () => unsub()
  }, [])

  if (stories.length === 0) return null

  return (
    <section className="py-24 md:py-36 bg-slate-900 text-white relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-brand-blue/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-brand-green/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container-custom section-padding relative z-10 space-y-24 md:space-y-36">
        {stories.map((story, index) => {
          const isEven = index % 2 === 1
          const storyImg = story.image || (isEven ? brushProduct?.images?.[0] || brushProduct?.image : refillProduct?.images?.[0] || refillProduct?.image)

          return (
            <div
              key={story.id || index}
              className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center"
            >
              {/* Image Column */}
              <motion.div
                initial={{ opacity: 0, x: isEven ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className={`lg:col-span-6 flex justify-center ${
                  isEven ? 'order-2 lg:order-2' : 'order-2 lg:order-1'
                }`}
              >
                <div className="relative w-full max-w-lg aspect-[4/3] rounded-[2.5rem] bg-gradient-to-tr from-slate-800 via-slate-800/80 to-slate-700/50 p-8 border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden group">
                  <div className="absolute inset-0 bg-brand-blue/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                  {storyImg ? (
                    <div className="relative w-full h-full">
                      <Image
                        src={storyImg}
                        alt={story.title}
                        fill
                        className="object-contain p-4 group-hover:scale-105 transition-transform duration-700"
                        sizes="(max-width: 768px) 100vw, 500px"
                      />
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3 text-brand-blue">
                        <FiShoppingBag className="w-8 h-8" />
                      </div>
                      <span className="text-sm font-semibold text-slate-300">Gülümse Dental Care</span>
                    </div>
                  )}

                  {/* Badge Pill Overlay */}
                  {story.badge && (
                    <div className="absolute top-6 left-6 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/15 text-[11px] font-bold text-white uppercase tracking-wider shadow-lg">
                      {story.badge}
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Text Column */}
              <motion.div
                initial={{ opacity: 0, x: isEven ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className={`lg:col-span-6 space-y-6 ${
                  isEven ? 'order-1 lg:order-1' : 'order-1 lg:order-2'
                }`}
              >
                {story.subtitle && (
                  <span className="inline-block text-xs font-extrabold uppercase tracking-[0.2em] text-brand-green bg-brand-green/10 border border-brand-green/20 px-4 py-1.5 rounded-full">
                    {story.subtitle}
                  </span>
                )}

                <h3 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-[1.15] text-white">
                  {story.title}
                </h3>

                <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
                  {story.description}
                </p>

                {/* Bullets List */}
                {story.bullets && story.bullets.length > 0 && (
                  <div className="space-y-3 pt-2">
                    {story.bullets.map((bullet, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-3 text-sm text-slate-200">
                        <div className="w-5 h-5 rounded-full bg-brand-blue/20 text-brand-blue flex items-center justify-center flex-shrink-0">
                          <FiCheckCircle className="w-3.5 h-3.5" />
                        </div>
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* CTA Link */}
                {story.ctaText && (
                  <div className="pt-4">
                    <Link
                      href={story.ctaUrl || '/urunler'}
                      className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-slate-900 hover:bg-brand-blue hover:text-white font-bold text-sm transition-all duration-300 shadow-xl group"
                    >
                      <span>{story.ctaText}</span>
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
