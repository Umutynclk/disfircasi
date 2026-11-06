'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiChevronDown, FiChevronUp, FiHelpCircle, FiMail, FiPhone } from 'react-icons/fi'
import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'

const FAQ_TRANSLATIONS = {
  tr: {
    badge: 'YARDIM VE DESTEK',
    title: 'Sık Sorulan Sorular',
    subtitle: 'Gülümse diş fırçaları ve kullanım hakkında aklınıza takılan tüm soruların cevapları.',
    supportCardTitle: 'Sorunuzun cevabını bulamadınız mı?',
    supportCardDesc: 'Uzman müşteri destek ekibimiz sorularınızı yanıtlamak için 7/24 hazır.',
    contactBtn: 'Bizimle İletişime Geçin',
    items: [
      {
        q: '360° Sonic Otomatik Diş Fırçası nasıl çalışır?',
        a: '360° Sonic fırçamız, yüksek frekanslı sonik titreşimler üreterek mikro silikon başlığın tüm diş yüzeylerine aynı anda temas etmesini sağlar. Diş minesini ve diş etlerini aşındırmadan 45 saniye içinde derinlemesine plak temizliği sunar.'
      },
      {
        q: 'Kullan-At / Başlık Değişmeli Diş Fırçası seyahat için uygun mudur?',
        a: 'Evet! Özel hijyenik koruma kapağı ve kompakt tasarımı sayesinde seyahatlerde, ofiste veya spor çantanızda güvenle taşıyabilirsiniz. Kendinden macunlu ve pratik başlık değiştirme mekanizmasına sahiptir.'
      },
      {
        q: 'Şarj süresi ve pil ömrü ne kadardır?',
        a: 'Tek bir tam şarj (yaklaşık 2 saat) ile günde 2 kez kullanımda ortalama 45 güne kadar kesintisiz kullanım imkanı sunar. Manyetik kablosuz hızlı şarj standı kutu içeriğine dahildir.'
      },
      {
        q: 'Hassas diş ve diş etine sahip kişiler kullanabilir mi?',
        a: 'Kesinlikle. Fırçalarımız gıda sınıfı medikal yumuşak silikon kıllara ve hassas diş eti modu dahil olmak üzere farklı temizleme kademelerine sahiptir.'
      },
      {
        q: 'Kargo teslimat süresi nedir ve kargo ücretsiz midir?',
        a: 'Tüm siparişlerinizde kargo tamamen ücretsizdir. Saat 16:00\'a kadar verilen siparişler aynı gün kargoya verilir ve genellikle 1-2 iş günü içinde adresinize teslim edilir.'
      },
      {
        q: 'Garanti ve iade koşulları nelerdir?',
        a: 'Tüm elektrikli diş fırçalarımız 2 yıl birebir değişim garantisine sahiptir. Memnun kalmamanız durumunda 14 gün içinde koşulsuz kolay iade hakkınız bulunmaktadır.'
      }
    ]
  },
  en: {
    badge: 'HELP & SUPPORT',
    title: 'Frequently Asked Questions',
    subtitle: 'Find answers to everything you need to know about Gülümse toothbrushes and their daily use.',
    supportCardTitle: 'Couldn’t find what you were looking for?',
    supportCardDesc: 'Our dedicated customer support team is always ready to assist you 24/7.',
    contactBtn: 'Contact Us',
    items: [
      {
        q: 'How does the 360° Sonic Automatic Toothbrush work?',
        a: 'Our 360° Sonic brush generates high-frequency acoustic micro-vibrations, allowing soft silicone bristles to clean all tooth surfaces simultaneously in just 45 seconds without damaging delicate enamel.'
      },
      {
        q: 'Is the disposable / replaceable-head toothbrush travel-friendly?',
        a: 'Yes! Its hygienic protective cover and ultralight design make it perfect for travel, workouts, or daily commutes. It features an effortless snap-on brush head system.'
      },
      {
        q: 'How long does the battery last on a single charge?',
        a: 'A single 2-hour charge delivers up to 45 days of daily use (twice a day). A convenient wireless fast-charging dock is included in every box.'
      },
      {
        q: 'Can I use it if I have sensitive teeth or gums?',
        a: 'Absolutely. Our brush heads are crafted from ultra-gentle food-grade medical silicone and include dedicated gentle/sensitive modes.'
      },
      {
        q: 'What are the delivery times and shipping costs?',
        a: 'Shipping is 100% free on all orders. Orders placed before 4:00 PM are dispatched on the same day with fast, tracked international delivery.'
      },
      {
        q: 'What is the warranty and return policy?',
        a: 'Every sonic toothbrush includes a 2-year full replacement warranty. We also provide a 14-day hassle-free money-back guarantee.'
      }
    ]
  },
  de: {
    badge: 'HILFE & SUPPORT',
    title: 'Häufig gestellte Fragen',
    subtitle: 'Finden Sie Antworten auf alle Fragen rund um die Gülümse Zahnbürsten und ihre Anwendung.',
    supportCardTitle: 'Haben Sie keine passende Antwort gefunden?',
    supportCardDesc: 'Unser freundliches Kundensupport-Team steht Ihnen rund um die Uhr zur Verfügung.',
    contactBtn: 'Kontaktieren Sie uns',
    items: [
      {
        q: 'Wie funktioniert die 360° Schallzahnbürste?',
        a: 'Unsere 360° Schallzahnbürste erzeugt hochfrequente Vibrationen, wodurch die weichen Silikonborsten alle Zahnoberflächen gleichzeitig und schonend in nur 45 Sekunden reinigen.'
      },
      {
        q: 'Ist die Einweg-/Wechselkopf-Zahnbürste für Reisen geeignet?',
        a: 'Ja! Dank der hygienischen Schutzkappe und des kompakten Designs ist sie der ideale Begleiter für Reisen, Sport und Büro.'
      },
      {
        q: 'Wie lange hält der Akku mit einer einzigen Ladung?',
        a: 'Eine einzige 2-stündige Ladung reicht bei zweimal täglicher Nutzung für bis zu 45 Tage. Eine kabellose Ladestation ist im Lieferumfang enthalten.'
      },
      {
        q: 'Ist sie für empfindliche Zähne und Zahnfleisch geeignet?',
        a: 'Absolut. Die Bürstenköpfe bestehen aus lebensmittelechtem medizinischem Silikon und bieten spezielle Sanftmodi für empfindliches Zahnfleisch.'
      },
      {
        q: 'Wie hoch sind die Versandkosten und wie schnell ist die Lieferung?',
        a: 'Der Versand ist für alle Bestellungen kostenlos. Bestellungen vor 16:00 Uhr werden noch am selben Werktag versendet.'
      },
      {
        q: 'Welche Garantie- und Rückgaberechte gelten?',
        a: 'Sie erhalten 2 Jahre Direktaustausch-Garantie auf alle elektronischen Zahnbürsten sowie ein 14-tägiges unkompliziertes Rückgaberecht.'
      }
    ]
  },
  fr: {
    badge: 'AIDE & SUPPORT',
    title: 'Foire Aux Questions',
    subtitle: 'Retrouvez toutes les réponses à vos questions sur les brosses à dents Gülümse et leur utilisation.',
    supportCardTitle: 'Vous n’avez pas trouvé votre réponse ?',
    supportCardDesc: 'Notre équipe de support client dédiée est prête à vous aider 24h/24 et 7j/7.',
    contactBtn: 'Contactez-nous',
    items: [
      {
        q: 'Comment fonctionne la brosse sonique automatique 360° ?',
        a: 'Notre brosse sonique 360° émet des micro-vibrations haute fréquence permettant aux poils en silicone doux de nettoyer toutes les faces dentaires en seulement 45 secondes sans abîmer l’émail.'
      },
      {
        q: 'La brosse jetable / à tête interchangeable est-elle adaptée aux voyages ?',
        a: 'Oui ! Grâce à son capuchon de protection hygiénique et son format compact, elle s’emporte partout en toute sécurité (voyages, bureau, sport).'
      },
      {
        q: 'Quelle est l’autonomie de la batterie ?',
        a: 'Une seule charge complète de 2 heures offre jusqu’à 45 jours d’utilisation quotidienne (2 fois par jour). Le socle de charge sans fil rapide est inclus.'
      },
      {
        q: 'Convient-elle aux dents et gencives sensibles ?',
        a: 'Parfaitement. Les têtes en silicone médical extra-doux et les différents modes de puissance garantissent un brossage tout en douceur.'
      },
      {
        q: 'Quels sont les délais et frais de livraison ?',
        a: 'La livraison est 100% gratuite. Toute commande passée avant 16h est expédiée le jour même avec un suivi en ligne.'
      },
      {
        q: 'Quelles sont les conditions de garantie et de retour ?',
        a: 'Toutes nos brosses à dents soniques bénéficient d’une garantie de 2 ans avec échange direct et d’un délai de rétractation de 14 jours.'
      }
    ]
  },
  it: {
    badge: "ASSISTENZA & SUPPORTO",
    title: "Domande Frequenti",
    subtitle: "Trova risposta a tutte le tue domande sugli spazzolini Gülümse e il loro utilizzo.",
    supportCardTitle: "Non hai trovato la risposta che cercavi?",
    supportCardDesc: "Il nostro team di assistenza clienti dedicato è disponibile 24 ore su 24, 7 giorni su 7.",
    contactBtn: "Contattaci",
    items: [
      {
        q: "Come funziona lo Spazzolino Sonico Automatico 360°?",
        a: "Il nostro spazzolino sonico 360° genera micro-vibrazioni ad alta frequenza che consentono alle setole in silicone morbido di pulire tutte le superfici dentali contemporaneamente in soli 45 secondi, senza intaccare lo smalto."
      },
      {
        q: "Lo spazzolino monouso / a testine intercambiabili è adatto ai viaggi?",
        a: "Assolutamente sì! Grazie al cappuccio protettivo antibatterico e al design ultraleggero, è perfetto per viaggi, palestra o ufficio."
      },
      {
        q: "Quanto dura la batteria con una sola ricarica?",
        a: "Una singola ricarica di 2 ore garantisce fino a 45 giorni di utilizzo quotidiano (2 volte al giorno). La base di ricarica wireless rapida è inclusa nella confezione."
      },
      {
        q: "È adatto a chi ha denti o gengive sensibili?",
        a: "Certamente. Le testine sono realizzate in silicone medico ultra-delicato e offrono modalità di pulizia specifiche per gengive sensibili."
      },
      {
        q: "Quali sono i tempi e i costi di spedizione?",
        a: "La spedizione è 100% gratuita per tutti gli ordini. Gli ordini effettuati prima delle 16:00 vengono spediti il giorno stesso."
      },
      {
        q: "Quali sono i termini di garanzia e di reso?",
        a: "Tutti i nostri spazzolini sonici includono 2 anni di garanzia con sostituzione diretta e 14 giorni di diritto di recesso senza problemi."
      }
    ]
  }
}

export default function FAQPage() {
  const { locale, getLocalizedPath } = useLocale()
  const loc = FAQ_TRANSLATIONS[locale] || FAQ_TRANSLATIONS.tr
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <div className="pt-32 pb-24 bg-slate-50 min-h-screen">
      <div className="container-custom section-padding max-w-4xl mx-auto">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-xs font-black uppercase tracking-widest text-sky-600 bg-sky-100 px-4 py-1.5 rounded-full border border-sky-200 mb-4">
            {loc.badge}
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-4 tracking-tight">
            {loc.title}
          </h1>
          <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
            {loc.subtitle}
          </p>
        </motion.div>

        {/* FAQ Accordion List */}
        <div className="space-y-4 mb-16">
          {loc.items.map((item, index) => {
            const isOpen = openIndex === index
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`bg-white rounded-3xl border transition-all duration-200 overflow-hidden ${
                  isOpen ? 'border-sky-300 shadow-lg shadow-sky-100/50' : 'border-slate-200/80 hover:border-slate-300'
                }`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full p-6 sm:p-7 flex items-center justify-between text-left gap-4"
                >
                  <span className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    {item.q}
                  </span>
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                    isOpen ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {isOpen ? <FiChevronUp className="w-5 h-5" /> : <FiChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-6 sm:px-7 pb-6 sm:pb-7 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100 pt-4"
                    >
                      {item.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}
        </div>

        {/* Need More Help Card */}
        <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200/90 shadow-md text-center flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-left space-y-1">
            <h3 className="text-lg sm:text-xl font-black text-slate-900">{loc.supportCardTitle}</h3>
            <p className="text-xs sm:text-sm text-slate-500">{loc.supportCardDesc}</p>
          </div>
          <Link
            href={getLocalizedPath('/iletisim')}
            className="px-8 py-3.5 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs sm:text-sm uppercase tracking-wider transition-all flex-shrink-0"
          >
            {loc.contactBtn}
          </Link>
        </div>

      </div>
    </div>
  )
}
