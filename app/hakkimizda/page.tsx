'use client'

import { useState, useEffect } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiCheckCircle, FiShield, FiHeart, FiAward, FiUsers, FiCompass } from 'react-icons/fi'
import { useLocale } from '@/context/LocaleContext'

const ABOUT_TRANSLATIONS = {
  tr: {
    badge: 'GÜLÜMSE HAKKINDA',
    title: 'Gülümse Dental Care',
    subtitle: 'Modern teknoloji ve sağlık bilincini bir araya getirerek, herkesin güzel, sağlıklı ve özgüvenli bir gülüşe sahip olması için çalışıyoruz.',
    storyTitle: 'Hikayemiz & Vizyonumuz',
    storyParagraphs: [
      'Gülümse Dental Care, modern ağız ve diş bakımında yenilikçi ve erişilebilir çözümler üretmek amacıyla kuruldu. Geleneksel diş fırçalama rutinlerini yüksek teknoloji ve ergonomik tasarımla birleştirerek yepyeni bir deneyim sunuyoruz.',
      'Dünyanın ilk 360° dönebilen sonik otomatik diş fırçası ve hijyenik başlık değiştirmeli kullan-at serimizle, evde profesyonel seviyede bakım yapabilmenizi ve seyahatlerinizde hijyenden ödün vermemenizi sağlıyoruz.',
      'Klinik olarak test edilmiş yumuşak mikro silikon başlıklarımız, diş minenizi ve hassas diş etlerinizi çizmeden korurken plak oluşumunu %99.8 oranında azaltmaya yardımcı olur.'
    ],
    valuesTitle: 'Temel Değerlerimiz',
    stat1: '100K+',
    stat1Label: 'Mutlu Gülümseme',
    stat2: '%99.8',
    stat2Label: 'Plak Temizliği',
    stat3: '360°',
    stat3Label: 'Kapsamlı Koruma',
    stat4: '2 Yıl',
    stat4Label: 'Birebir Garanti',
    ctaTitle: 'Daha Sağlıklı Bir Gülüş İçin İlk Adımı Atın',
    ctaDesc: 'Size en uygun fırçayı hemen keşfedin ve hayata güvenle gülümseyin.',
    ctaButton: 'Ürünleri İncele'
  },
  en: {
    badge: 'ABOUT GÜLÜMSE',
    title: 'Gülümse Dental Care',
    subtitle: 'Combining cutting-edge dental technology and health awareness to ensure everyone has a bright, healthy, and confident smile.',
    storyTitle: 'Our Story & Vision',
    storyParagraphs: [
      'Gülümse Dental Care was founded to provide innovative and accessible solutions in modern oral healthcare. We revolutionize traditional brushing routines with high technology and ergonomic design.',
      'With the world’s first 360° rotating sonic automatic toothbrush and our hygienic replaceable-head disposable series, we empower you to enjoy professional-grade care at home and uncompromised hygiene on the go.',
      'Our clinically tested soft micro-silicone brush heads protect your enamel and sensitive gums while helping reduce plaque by up to 99.8%.'
    ],
    valuesTitle: 'Our Core Values',
    stat1: '100K+',
    stat1Label: 'Happy Smiles',
    stat2: '99.8%',
    stat2Label: 'Plaque Removal',
    stat3: '360°',
    stat3Label: 'Complete Protection',
    stat4: '2 Years',
    stat4Label: 'Direct Warranty',
    ctaTitle: 'Take the First Step to a Healthier Smile',
    ctaDesc: 'Discover the ideal toothbrush for your lifestyle and smile with confidence.',
    ctaButton: 'Explore Products'
  },
  de: {
    badge: 'ÜBER GÜLÜMSE',
    title: 'Gülümse Dental Care',
    subtitle: 'Wir verbinden moderne Technologie und Gesundheitsbewusstsein, damit jeder ein schönes, gesundes und selbstbewusstes Lächeln hat.',
    storyTitle: 'Unsere Geschichte & Vision',
    storyParagraphs: [
      'Gülümse Dental Care wurde gegründet, um innovative und zugängliche Lösungen für die moderne Mund- und Zahnpflege zu schaffen. Wir verwandeln traditionelle Putzgewohnheiten durch Hochtechnologie und ergonomisches Design in ein völlig neues Erlebnis.',
      'Mit der weltweit ersten 360° rotierenden Schallzahnbürste und unserer hygienischen Einweg-Serie mit austauschbaren Köpfen ermöglichen wir professionelle Pflege für zu Hause und unterwegs.',
      'Unsere klinisch getesteten weichen Mikrosilikon-Bürstenköpfe schützen Zahnschmelz und empfindliches Zahnfleisch und reduzieren Plaque um bis zu 99,8 %.'
    ],
    valuesTitle: 'Unsere Kernwerte',
    stat1: '100K+',
    stat1Label: 'Glückliche Lächeln',
    stat2: '99,8%',
    stat2Label: 'Plaque-Entfernung',
    stat3: '360°',
    stat3Label: 'Rundum-Schutz',
    stat4: '2 Jahre',
    stat4Label: 'Direkte Garantie',
    ctaTitle: 'Machen Sie den ersten Schritt zu einem gesünderen Lächeln',
    ctaDesc: 'Entdecken Sie jetzt die perfekte Zahnbürste für Ihre Bedürfnisse.',
    ctaButton: 'Produkte ansehen'
  },
  fr: {
    badge: 'À PROPOS DE GÜLÜMSE',
    title: 'Gülümse Dental Care',
    subtitle: 'Allier technologie de pointe et bien-être pour offrir à chacun un sourire éclatant, sain et confiant.',
    storyTitle: 'Notre Histoire & Notre Vision',
    storyParagraphs: [
      'Gülümse Dental Care a été fondée pour apporter des solutions innovantes et accessibles dans les soins bucco-dentaires modernes. Nous transformons les habitudes de brossage grâce à une technologie avancée et un design ergonomique.',
      'Avec la première brosse à dents sonique rotative à 360° au monde et notre gamme jetable hygiénique à têtes interchangeables, nous garantissons des soins professionnels à la maison comme en déplacement.',
      'Nos têtes de brosse en micro-silicone souple testées cliniquement protègent l’émail et les gencives sensibles tout en éliminant jusqu’à 99,8 % de la plaque dentaire.'
    ],
    valuesTitle: 'Nos Valeurs Fondamentales',
    stat1: '100K+',
    stat1Label: 'Sourires Heureux',
    stat2: '99,8%',
    stat2Label: 'Élimination Plaque',
    stat3: '360°',
    stat3Label: 'Protection Complète',
    stat4: '2 Ans',
    stat4Label: 'Garantie Directe',
    ctaTitle: 'Faites le premier pas vers un sourire plus sain',
    ctaDesc: 'Découvrez la brosse à dents idéale pour votre quotidien et souriez à la vie.',
    ctaButton: 'Découvrir les Produits'
  },
  it: {
    badge: "CHI SIAMO",
    title: "Gülümse Dental Care",
    subtitle: "Uniamo tecnologia all’avanguardia e salute dentale affinché ognuno possa avere un sorriso sano, splendente e sicuro di sé.",
    storyTitle: "La Nostra Storia & Visione",
    storyParagraphs: [
      "Gülümse Dental Care nasce con l’obiettivo di offrire soluzioni innovative e accessibili per l’igiene orale quotidiana. Trasformiamo le tradizionali abitudini di pulizia grazie a tecnologie avanzate e design ergonomico.",
      "Con il primo spazzolino sonico automatico rotante a 360° al mondo e la nostra linea monouso a testine intercambiabili, garantiamo una cura professionale a casa come in viaggio.",
      "Le nostre testine in micro-silicone morbido clinicamente testate proteggono lo smalto e le gengive sensibili, riducendo la placca fino al 99.8%."
    ],
    valuesTitle: "I Nostri Valori Fondamentali",
    stat1: "100K+",
    stat1Label: "Sorrisi Soddisfatti",
    stat2: "99.8%",
    stat2Label: "Rimozione Placca",
    stat3: "360°",
    stat3Label: "Protezione Totale",
    stat4: "2 Anni",
    stat4Label: "Garanzia Diretta",
    ctaTitle: "Fai il primo passo verso un sorriso più sano",
    ctaDesc: "Scopri lo spazzolino perfetto per le tue esigenze e sorridi con fiducia.",
    ctaButton: "Esplora i Prodotti"
  }
}

export default function AboutPage() {
  const { locale, getLocalizedText, getLocalizedPath } = useLocale()
  const loc = ABOUT_TRANSLATIONS[locale] || ABOUT_TRANSLATIONS.tr

  const [dbContent, setDbContent] = useState<any>(null)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const aboutRef = doc(db, 'siteContent', 'about')
      const unsubscribe = onSnapshot(aboutRef, (snapshot) => {
        if (snapshot.exists()) {
          setDbContent(snapshot.data())
        }
      })
      return () => unsubscribe()
    } catch (error) {
      console.error('About load error:', error)
    }
  }, [])

  const title = getLocalizedText(dbContent?.title, loc.title)
  const subtitle = getLocalizedText(dbContent?.subtitle, loc.subtitle)
  const storyTitle = getLocalizedText(dbContent?.storyTitle, loc.storyTitle)
  const storyParagraphs = dbContent?.storyParagraphs && dbContent.storyParagraphs.length > 0 && locale === 'tr'
    ? dbContent.storyParagraphs
    : loc.storyParagraphs

  return (
    <div className="pt-32 pb-24 bg-white min-h-screen">
      <div className="container-custom section-padding">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block text-xs font-black uppercase tracking-widest text-sky-600 bg-sky-100 px-4 py-1.5 rounded-full border border-sky-200 mb-4">
            {loc.badge}
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight">
            {title}
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-slate-600 leading-relaxed font-normal">
            {subtitle}
          </p>
        </motion.div>

        {/* Story Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-20 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-6 relative h-[380px] sm:h-[480px] rounded-[2.5rem] overflow-hidden shadow-2xl bg-gradient-to-tr from-sky-900 via-slate-800 to-slate-900 p-8 flex items-center justify-center border border-slate-200"
          >
            {dbContent?.storyImage ? (
              <img
                src={dbContent.storyImage}
                alt={storyTitle}
                className="w-full h-full object-cover rounded-2xl"
              />
            ) : (
              <div className="text-center text-white space-y-4">
                <div className="w-24 h-24 mx-auto rounded-3xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-5xl backdrop-blur-md">
                  🦷
                </div>
                <h3 className="text-2xl font-black tracking-tight">Gülümse Dental Care</h3>
                <p className="text-xs text-sky-200 max-w-xs mx-auto">
                  {loc.badge}
                </p>
              </div>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-6 space-y-6"
          >
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {storyTitle}
            </h2>
            <div className="space-y-4">
              {storyParagraphs.map((paragraph: string, index: number) => (
                <p key={index} className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
                  {paragraph}
                </p>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          <div className="p-6 rounded-3xl bg-sky-50 border border-sky-100 text-center">
            <span className="text-3xl sm:text-4xl font-black text-sky-600 block mb-1">{loc.stat1}</span>
            <span className="text-xs sm:text-sm font-bold text-slate-600">{loc.stat1Label}</span>
          </div>
          <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-100 text-center">
            <span className="text-3xl sm:text-4xl font-black text-emerald-600 block mb-1">{loc.stat2}</span>
            <span className="text-xs sm:text-sm font-bold text-slate-600">{loc.stat2Label}</span>
          </div>
          <div className="p-6 rounded-3xl bg-blue-50 border border-blue-100 text-center">
            <span className="text-3xl sm:text-4xl font-black text-blue-600 block mb-1">{loc.stat3}</span>
            <span className="text-xs sm:text-sm font-bold text-slate-600">{loc.stat3Label}</span>
          </div>
          <div className="p-6 rounded-3xl bg-amber-50 border border-amber-100 text-center">
            <span className="text-3xl sm:text-4xl font-black text-amber-600 block mb-1">{loc.stat4}</span>
            <span className="text-xs sm:text-sm font-bold text-slate-600">{loc.stat4Label}</span>
          </div>
        </div>

        {/* Bottom CTA Box */}
        <div className="p-8 sm:p-12 rounded-[2.5rem] bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white text-center shadow-2xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-4">
            <h3 className="text-2xl sm:text-4xl font-black tracking-tight">{loc.ctaTitle}</h3>
            <p className="text-slate-300 text-sm sm:text-base">{loc.ctaDesc}</p>
            <div className="pt-4">
              <Link
                href={getLocalizedPath('/urunler')}
                className="inline-flex items-center gap-2 px-9 py-4 rounded-full bg-sky-500 hover:bg-sky-400 text-white font-black text-sm uppercase tracking-wider shadow-lg transition-transform hover:scale-105"
              >
                {loc.ctaButton}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
