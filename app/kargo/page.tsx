'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiTruck, FiShield, FiClock, FiCheckCircle, FiSearch, FiPackage, FiArrowLeft, FiFileText } from 'react-icons/fi'
import { useLocale } from '@/context/LocaleContext'
import { subscribeToLegalConfig, DEFAULT_LEGAL_CONFIG, LegalDocumentsConfig } from '@/lib/firebase/legal'

const SHIPPING_TRANSLATIONS = {
  tr: {
    badge: 'TESLİMAT & KARGO BİLGİLERİ',
    title: 'Kargo & Teslimat Süreci',
    subtitle: 'Siparişlerinizin güvenle ve en hızlı şekilde size ulaşması için tüm süreçlerimiz şeffaf ve sigortalıdır.',
    trackTitle: 'Hızlı Kargo Takibi',
    trackSub: 'Sipariş numaranızı ve e-posta adresinizi girerek kargonuzu anlık takip edin.',
    orderNoPlaceholder: 'Örn: GS260903XXXX',
    trackBtn: 'Siparişi Sorgula',
    viewProfileBtn: 'Profilimden Siparişlerimi Gör',
    cards: [
      {
        icon: FiTruck,
        title: 'Aynı Gün & Hızlı Kargo',
        desc: 'Hafta içi saat 16:00\'a kadar verilen siparişler aynı gün anlaşmalı kargo firmasına teslim edilir.'
      },
      {
        icon: FiClock,
        title: '1-3 İş Gününde Teslimat',
        desc: 'Anlaşmalı hızlı kargo ağımız sayesinde Türkiye genelinde il ve ilçe merkezlerine 1-3 iş gününde kapınıza teslimat.'
      },
      {
        icon: FiShield,
        title: '%100 Sigortalı ve Hijyenik Paketleme',
        desc: 'Tüm ürünler steril medikal ambalajında ve darbelere dayanıklı özel koruyucu kutularda %100 sigortalı olarak gönderilir.'
      },
      {
        icon: FiCheckCircle,
        title: '14 Gün Koşulsuz Kolay İade',
        desc: 'Kullanılmamış ve ambalajı açılmamış ürünleri 14 gün içerisinde anlaşmalı kargomuzla ücretsiz olarak geri gönderebilirsiniz.'
      }
    ]
  },
  en: {
    badge: 'DELIVERY & SHIPPING',
    title: 'Shipping & Delivery Process',
    subtitle: 'All our shipments are insured and processed rapidly to ensure your dental products arrive safely.',
    trackTitle: 'Track Your Order',
    trackSub: 'Check your order status by entering your order number or logging in.',
    orderNoPlaceholder: 'e.g. GS260903XXXX',
    trackBtn: 'Track Order',
    viewProfileBtn: 'View Orders in Profile',
    cards: [
      {
        icon: FiTruck,
        title: 'Same-Day & Fast Delivery',
        desc: 'Orders placed before 4:00 PM on weekdays are dispatched to the courier the same day.'
      },
      {
        icon: FiClock,
        title: 'Fast Domestic Transit',
        desc: 'With our premium courier partners, domestic delivery takes 1-3 business days directly to your doorstep.'
      },
      {
        icon: FiShield,
        title: 'Insured & Hygienic Packaging',
        desc: 'Every item is sealed in sterile medical packaging and shipped in tamper-evident, shock-resistant boxes.'
      },
      {
        icon: FiCheckCircle,
        title: '14-Day Hassle-Free Returns',
        desc: 'Unopened products can be returned within 14 days with free prepaid return shipping labels.'
      }
    ]
  },
  de: {
    badge: 'LIEFERUNG & VERSAND',
    title: 'Versand & Lieferprozess',
    subtitle: 'Alle Sendungen sind versichert und werden zügig versandt, damit Ihre Zahnpflegeprodukte schnell ankommen.',
    trackTitle: 'Sendungsverfolgung',
    trackSub: 'Überprüfen Sie Ihren Bestellstatus mit Ihrer Bestellnummer oder in Ihrem Kundenkonto.',
    orderNoPlaceholder: 'z.B. GS260903XXXX',
    trackBtn: 'Status prüfen',
    viewProfileBtn: 'Bestellungen im Profil ansehen',
    cards: [
      {
        icon: FiTruck,
        title: 'Versand am selben Tag',
        desc: 'Bestellungen vor 16:00 Uhr an Werktagen werden noch am selben Tag versendet.'
      },
      {
        icon: FiClock,
        title: 'Schnelle Zustellung (1-3 Werktage)',
        desc: 'Dank unserer Premium-Versandpartner erhalten Sie Ihre Sendung innerhalb von 1 bis 3 Werktagen direkt nach Hause.'
      },
      {
        icon: FiShield,
        title: 'Versicherte & Hygienische Verpackung',
        desc: 'Alle Zahnbürsten sind steril versiegelt und werden in stoßfesten Sicherheitsverpackungen geliefert.'
      },
      {
        icon: FiCheckCircle,
        title: '14 Tage Unkompliziertes Rückgaberecht',
        desc: 'Ungeöffnete Artikel können innerhalb von 14 Tagen kostenfrei an uns zurückgesendet werden.'
      }
    ]
  },
  fr: {
    badge: 'LIVRAISON & EXPÉDITION',
    title: 'Expédition & Délais de Livraison',
    subtitle: 'Tous nos colis sont assurés et expédiés avec soin pour vous garantir une réception rapide et sécurisée.',
    trackTitle: 'Suivi de Commande',
    trackSub: 'Consultez l’état de votre livraison en saisissant votre référence de commande ou via votre compte.',
    orderNoPlaceholder: 'ex: GS260903XXXX',
    trackBtn: 'Suivre ma commande',
    viewProfileBtn: 'Voir mes commandes dans mon profil',
    cards: [
      {
        icon: FiTruck,
        title: 'Expédition le jour même',
        desc: 'Toute commande passée avant 16h du lundi au vendredi est expédiée le jour même.'
      },
      {
        icon: FiClock,
        title: 'Livraison Rapide (1 à 3 Jours)',
        desc: 'Nos transporteurs partenaires garantissent une livraison sécurisée et suivie à votre domicile en 1 à 3 jours ouvrés.'
      },
      {
        icon: FiShield,
        title: 'Colis Assuré et Emballage Stérile',
        desc: 'Chaque brosse à dents est conditionnée sous scellé médical dans des emballages haute résistance.'
      },
      {
        icon: FiCheckCircle,
        title: '14 Jours pour Changer d’Avis',
        desc: 'Retournez facilement vos articles non ouverts sous 14 jours grâce à notre étiquette prépayée.'
      }
    ]
  },
  it: {
    badge: 'SPEDIZIONE & CONSEGNA',
    title: 'Spedizione & Processo di Consegna',
    subtitle: 'Tutte le spedizioni sono assicurate e processate rapidamente per garantirvi una consegna sicura.',
    trackTitle: 'Traccia il Tuo Ordine',
    trackSub: 'Controlla lo stato della tua spedizione inserendo il numero d\'ordine o accedendo al tuo account.',
    orderNoPlaceholder: 'es. GS260903XXXX',
    trackBtn: 'Traccia ordine',
    viewProfileBtn: 'Visualizza ordini nel profilo',
    cards: [
      {
        icon: FiTruck,
        title: 'Spedizione in Giornata',
        desc: 'Gli ordini effettuati prima delle 16:00 nei giorni feriali vengono spediti lo stesso giorno.'
      },
      {
        icon: FiClock,
        title: 'Consegna Rapida (1-3 Giorni)',
        desc: 'Con i nostri partner corrieri, la consegna avviene in 1-3 giorni lavorativi.'
      },
      {
        icon: FiShield,
        title: 'Imballaggio Assicurato & Igienico',
        desc: 'Ogni spazzolino è sigillato in confezione medica sterile e spedito in scatole antiurto.'
      },
      {
        icon: FiCheckCircle,
        title: '14 Giorni di Reso Senza Problemi',
        desc: 'Restituisci articoli non aperti entro 14 giorni con etichetta di reso prepagata gratuita.'
      }
    ]
  }
}

export default function ShippingPage() {
  const { locale, getLocalizedPath } = useLocale()
  const loc = SHIPPING_TRANSLATIONS[locale] || SHIPPING_TRANSLATIONS.tr
  const [trackQuery, setTrackQuery] = useState('')
  const [legal, setLegal] = useState<LegalDocumentsConfig>(DEFAULT_LEGAL_CONFIG)

  useEffect(() => {
    const unsub = subscribeToLegalConfig((cfg) => {
      setLegal(cfg)
    })
    return () => unsub()
  }, [])

  return (
    <div className="pt-32 pb-24 bg-slate-50 min-h-screen">
      <div className="container-custom section-padding max-w-5xl mx-auto px-4">
        
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href={getLocalizedPath('/')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-sky-600 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>Ana Sayfaya Dön</span>
          </Link>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-14"
        >
          <span className="inline-block text-xs font-black uppercase tracking-widest text-sky-600 bg-sky-100 px-4 py-1.5 rounded-full border border-sky-200 mb-4">
            {loc.badge}
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mb-4 tracking-tight">
            {legal.deliveryAndShipping?.title || loc.title}
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            {loc.subtitle}
          </p>
        </motion.div>

        {/* Quick Tracking Search Box */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/80 shadow-md mb-12 text-center max-w-2xl mx-auto">
          <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <FiPackage className="w-7 h-7" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">{loc.trackTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-6">{loc.trackSub}</p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={trackQuery}
              onChange={(e) => setTrackQuery(e.target.value)}
              placeholder={loc.orderNoPlaceholder}
              className="flex-1 px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:border-sky-500 font-mono"
            />
            <Link
              href={`${getLocalizedPath('/profil')}?order=${encodeURIComponent(trackQuery)}`}
              className="px-8 py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl transition-colors flex items-center justify-center gap-2 shadow-md shadow-sky-600/20"
            >
              <FiSearch className="w-4 h-4" />
              <span>{loc.trackBtn}</span>
            </Link>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-center gap-4 text-xs font-bold text-slate-500">
            <Link
              href={getLocalizedPath('/profil')}
              className="text-sky-600 hover:underline"
            >
              {loc.viewProfileBtn} →
            </Link>
          </div>
        </div>

        {/* Shipping Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
          {loc.cards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
              className="bg-white rounded-3xl p-7 border border-slate-200/80 shadow-xs flex items-start gap-4 hover:border-sky-200 transition-colors"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-50 to-blue-50 border border-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
                <card.icon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 mb-1.5">{card.title}</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{card.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Full Legal Delivery Policy Content Card */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
              <FiFileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-sky-600 uppercase tracking-wider">Resmi Sözleşme Maddeleri</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                {legal.deliveryAndShipping?.title || 'Teslimat ve Kargo Koşulları'}
              </h2>
            </div>
          </div>

          {/* Seller Company Legal Box */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs sm:text-sm text-slate-800">
            <p className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-2">GÖNDERİCİ FİRMA BİLGİLERİ:</p>
            <p><strong>Unvan:</strong> {legal.company.title}</p>
            <p><strong>Adres:</strong> {legal.company.address}</p>
            <p><strong>Müşteri Hizmetleri:</strong> {legal.company.phone} | <strong>E-Posta:</strong> {legal.company.email}</p>
          </div>

          {/* Dynamic Policy Text */}
          <div className="whitespace-pre-line text-slate-700 font-sans leading-relaxed text-sm sm:text-base">
            {legal.deliveryAndShipping?.content || DEFAULT_LEGAL_CONFIG.deliveryAndShipping.content}
          </div>

          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
            <span>Son Güncelleme: {legal.deliveryAndShipping?.updatedAt || '03 Eylül 2026'}</span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
              <FiShield className="w-4 h-4" />
              %100 Sigortalı ve Hasar Korumalı Gönderim
            </span>
          </div>
        </div>

      </div>
    </div>
  )
}
