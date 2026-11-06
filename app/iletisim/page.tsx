'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiMail, FiPhone, FiMapPin, FiSend, FiCheckCircle, FiShield } from 'react-icons/fi'
import { collection, addDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { useLocale } from '@/context/LocaleContext'
import { subscribeToLegalConfig, DEFAULT_LEGAL_CONFIG, LegalDocumentsConfig } from '@/lib/firebase/legal'

const CONTACT_TRANSLATIONS = {
  tr: {
    badge: 'BİZE ULAŞIN',
    title: 'İletişime Geçin',
    subtitle: 'Sorularınız, ürün önerileriniz veya toptan sipariş talepleriniz için bize mesaj bırakın.',
    emailCardTitle: 'E-posta',
    emailCardSub: '7/24 kesintisiz destek',
    phoneCardTitle: 'Müşteri Hizmetleri',
    phoneCardSub: 'Hafta içi 09:00 - 18:00',
    addressCardTitle: 'Genel Merkez & Satıcı Adresi',
    addressCardSub: 'Resmi Firma Adresi',
    formTitle: 'Bize Mesaj Gönderin',
    nameLabel: 'Adınız Soyadınız *',
    namePlaceholder: 'Örn: Ahmet Yılmaz',
    emailLabel: 'E-posta Adresiniz *',
    emailPlaceholder: 'ahmet@example.com',
    phoneLabel: 'Telefon Numaranız',
    phonePlaceholder: '+90 (5xx) xxx xx xx',
    subjectLabel: 'Konu',
    subjectPlaceholder: 'Sipariş veya Ürün Hakkında',
    messageLabel: 'Mesajınız *',
    messagePlaceholder: 'Size nasıl yardımcı olabiliriz?',
    submitBtn: 'Mesajı Gönder',
    sendingBtn: 'Gönderiliyor...',
    successTitle: 'Mesajınız Başarıyla Alındı!',
    successDesc: 'En kısa sürede e-posta veya telefon üzerinden sizinle iletişime geçeceğiz.',
    sendAnother: 'Yeni Bir Mesaj Gönder'
  },
  en: {
    badge: 'CONTACT US',
    title: 'Get in Touch',
    subtitle: 'Have a question about our products or want to discuss bulk orders? Leave us a message.',
    emailCardTitle: 'Email Support',
    emailCardSub: '24/7 online assistance',
    phoneCardTitle: 'Customer Care',
    phoneCardSub: 'Mon-Fri 09:00 - 18:00',
    addressCardTitle: 'Headquarters',
    addressCardSub: 'Official Company Address',
    formTitle: 'Send us a message',
    nameLabel: 'Full Name *',
    namePlaceholder: 'e.g. John Doe',
    emailLabel: 'Email Address *',
    emailPlaceholder: 'john@example.com',
    phoneLabel: 'Phone Number',
    phonePlaceholder: '+1 (555) 000-0000',
    subjectLabel: 'Subject',
    subjectPlaceholder: 'Order inquiry or product question',
    messageLabel: 'Your Message *',
    messagePlaceholder: 'How can we help you today?',
    submitBtn: 'Send Message',
    sendingBtn: 'Sending...',
    successTitle: 'Message Sent Successfully!',
    successDesc: 'Our support team will get back to you shortly via email or phone.',
    sendAnother: 'Send Another Message'
  },
  de: {
    badge: 'KONTAKT',
    title: 'Kontaktieren Sie uns',
    subtitle: 'Haben Sie Fragen zu unseren Zahnbürsten oder Großbestellungen? Schreiben Sie uns.',
    emailCardTitle: 'E-Mail Support',
    emailCardSub: '24/7 Online-Hilfe',
    phoneCardTitle: 'Kundenservice',
    phoneCardSub: 'Mo-Fr 09:00 - 18:00',
    addressCardTitle: 'Hauptsitz',
    addressCardSub: 'Offizielle Firmenadresse',
    formTitle: 'Nachricht senden',
    nameLabel: 'Vollständiger Name *',
    namePlaceholder: 'z.B. Max Mustermann',
    emailLabel: 'E-Mail-Adresse *',
    emailPlaceholder: 'max@example.com',
    phoneLabel: 'Telefonnummer',
    phonePlaceholder: '+49 (0) 123 456789',
    subjectLabel: 'Betreff',
    subjectPlaceholder: 'Bestellanfrage oder Produktinformation',
    messageLabel: 'Ihre Nachricht *',
    messagePlaceholder: 'Wie können wir Ihnen weiterhelfen?',
    submitBtn: 'Nachricht senden',
    sendingBtn: 'Wird gesendet...',
    successTitle: 'Nachricht erfolgreich gesendet!',
    successDesc: 'Unser Support-Team wird sich schnellstmöglich bei Ihnen melden.',
    sendAnother: 'Weitere Nachricht senden'
  },
  fr: {
    badge: 'CONTACT',
    title: 'Contactez-nous',
    subtitle: 'Des questions sur nos produits ou des commandes en gros ? Envoyez-nous un message.',
    emailCardTitle: 'Support E-mail',
    emailCardSub: 'Assistance en ligne 24h/24',
    phoneCardTitle: 'Service Client',
    phoneCardSub: 'Lun-Ven 09:00 - 18:00',
    addressCardTitle: 'Siège Social',
    addressCardSub: 'Adresse Officielle',
    formTitle: 'Envoyez-nous un message',
    nameLabel: 'Nom et Prénom *',
    namePlaceholder: 'ex: Jean Dupont',
    emailLabel: 'Adresse E-mail *',
    emailPlaceholder: 'jean@example.com',
    phoneLabel: 'Numéro de téléphone',
    phonePlaceholder: '+33 6 12 34 56 78',
    subjectLabel: 'Sujet',
    subjectPlaceholder: 'Question sur une commande ou un produit',
    messageLabel: 'Votre Message *',
    messagePlaceholder: 'Comment pouvons-nous vous aider ?',
    submitBtn: 'Envoyer le message',
    sendingBtn: 'Envoi en cours...',
    successTitle: 'Message envoyé avec succès !',
    successDesc: 'Notre équipe vous répondra dans les plus brefs délais.',
    sendAnother: 'Envoyer un autre message'
  },
  it: {
    badge: "CONTATTI",
    title: "Mettiti in Contatto",
    subtitle: "Hai domande sui nostri prodotti o desideri effettuare ordini all’ingrosso? Inviaci un messaggio.",
    emailCardTitle: "Supporto E-mail",
    emailCardSub: "Assistenza online 24/7",
    phoneCardTitle: "Assistenza Clienti",
    phoneCardSub: "Lun-Ven 09:00 - 18:00",
    addressCardTitle: "Sede Centrale",
    addressCardSub: "Indirizzo Ufficiale",
    formTitle: "Inviaci un messaggio",
    nameLabel: "Nome e Cognome *",
    namePlaceholder: "es: Mario Rossi",
    emailLabel: "Indirizzo E-mail *",
    emailPlaceholder: "mario@example.com",
    phoneLabel: "Numero di Telefono",
    phonePlaceholder: "+39 02 1234567",
    subjectLabel: "Oggetto",
    subjectPlaceholder: "Informazioni su ordini o prodotti",
    messageLabel: "Il Tuo Messaggio *",
    messagePlaceholder: "Come possiamo aiutarti?",
    submitBtn: "Invia Messaggio",
    sendingBtn: "Invio in corso...",
    successTitle: "Messaggio Inviato con Successo!",
    successDesc: "Il nostro team ti risponderà nel più breve tempo possibile.",
    sendAnother: "Invia un Altro Messaggio"
  }
}

export default function ContactPage() {
  const { locale } = useLocale()
  const loc = CONTACT_TRANSLATIONS[locale] || CONTACT_TRANSLATIONS.tr
  const [legal, setLegal] = useState<LegalDocumentsConfig>(DEFAULT_LEGAL_CONFIG)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    const unsub = subscribeToLegalConfig((cfg) => {
      setLegal(cfg)
    })
    return () => unsub()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const db = getFirestoreDB()
      const contactData: any = {
        name: formData.name || '',
        email: formData.email || '',
        message: formData.message || '',
        locale: locale,
        createdAt: new Date().toISOString(),
      }
      
      if (formData.phone && formData.phone.trim() !== '') {
        contactData.phone = formData.phone
      }
      if (formData.subject && formData.subject.trim() !== '') {
        contactData.subject = formData.subject
      }
      
      await addDoc(collection(db, 'contacts'), contactData)
      setSubmitted(true)
      setFormData({ name: '', email: '', phone: '', subject: '', message: '' })
    } catch (error) {
      console.error('Contact error:', error)
      alert('Mesajınız kaydedilirken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="pt-32 pb-24 bg-slate-50 min-h-screen">
      <div className="container-custom section-padding px-4 max-w-6xl mx-auto">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="inline-block text-xs font-black uppercase tracking-widest text-sky-600 bg-sky-100 px-4 py-1.5 rounded-full border border-sky-200 mb-4">
            {loc.badge}
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-slate-900 mb-4 tracking-tight">
            {loc.title}
          </h1>
          <p className="text-base sm:text-lg text-slate-600">
            {loc.subtitle}
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Contact Info Cards */}
          <div className="lg:col-span-4 space-y-5">
            <div className="p-7 bg-white rounded-3xl border border-slate-200/80 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 flex-shrink-0">
                <FiMail className="w-6 h-6" />
              </div>
              <div className="overflow-hidden">
                <h3 className="text-base font-bold text-slate-900">{loc.emailCardTitle}</h3>
                <a href={`mailto:${legal.company.email}`} className="text-sm font-semibold text-sky-600 mt-0.5 block truncate hover:underline">
                  {legal.company.email || 'info@gulumse.com'}
                </a>
                <p className="text-xs text-slate-400 mt-1">{loc.emailCardSub}</p>
              </div>
            </div>

            <div className="p-7 bg-white rounded-3xl border border-slate-200/80 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                <FiPhone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{loc.phoneCardTitle}</h3>
                <a href={`tel:${legal.company.phone}`} className="text-sm font-semibold text-emerald-600 mt-0.5 block hover:underline">
                  {legal.company.phone || '0850 300 00 00'}
                </a>
                <p className="text-xs text-slate-400 mt-1">{loc.phoneCardSub}</p>
              </div>
            </div>

            <div className="p-7 bg-white rounded-3xl border border-slate-200/80 shadow-sm flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 flex-shrink-0">
                <FiMapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{loc.addressCardTitle}</h3>
                <p className="text-sm text-slate-700 mt-0.5 leading-relaxed font-medium">
                  {legal.company.address || 'Maslak Mah. Büyükdere Cad. No: 120 Sarıyer / İstanbul'}
                </p>
                <p className="text-xs text-slate-400 mt-1">{legal.company.title}</p>
              </div>
            </div>

            {/* Official Company Badges Box */}
            <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-md space-y-2 text-xs">
              <p className="font-black text-sky-400 uppercase tracking-wider text-[11px]">Yasal Firma Künyesi:</p>
              <p><strong className="text-slate-300">Unvan:</strong> {legal.company.title}</p>
              <p><strong className="text-slate-300">MERSİS:</strong> {legal.company.mersis}</p>
              <p><strong className="text-slate-300">Vergi:</strong> {legal.company.taxOffice} {legal.company.taxNumber}</p>
              {legal.company.kepAddress && (
                <p><strong className="text-slate-300">KEP:</strong> {legal.company.kepAddress}</p>
              )}
            </div>
          </div>

          {/* Form */}
          <div className="lg:col-span-8">
            <div className="bg-white rounded-3xl p-8 sm:p-10 border border-slate-200/80 shadow-xl">
              {submitted ? (
                <div className="text-center py-12 space-y-4">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-2xl">
                    <FiCheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900">{loc.successTitle}</h3>
                  <p className="text-sm text-slate-600 max-w-md mx-auto">{loc.successDesc}</p>
                  <button
                    onClick={() => setSubmitted(false)}
                    className="mt-6 px-8 py-3.5 bg-slate-900 text-white rounded-full font-bold text-xs uppercase tracking-wider hover:bg-slate-800 transition-colors"
                  >
                    {loc.sendAnother}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <h2 className="text-2xl font-black text-slate-900 mb-6">{loc.formTitle}</h2>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        {loc.nameLabel}
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder={loc.namePlaceholder}
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white focus:outline-none text-sm transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        {loc.emailLabel}
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder={loc.emailPlaceholder}
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white focus:outline-none text-sm transition-all"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        {loc.phoneLabel}
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder={loc.phonePlaceholder}
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white focus:outline-none text-sm transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                        {loc.subjectLabel}
                      </label>
                      <input
                        type="text"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        placeholder={loc.subjectPlaceholder}
                        className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white focus:outline-none text-sm transition-all"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                      {loc.messageLabel}
                    </label>
                    <textarea
                      required
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      placeholder={loc.messagePlaceholder}
                      className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border border-slate-200 focus:border-sky-500 focus:bg-white focus:outline-none text-sm transition-all resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-9 py-4 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-sky-600/30 flex items-center justify-center gap-2 transition-transform hover:scale-103 disabled:opacity-50"
                  >
                    <FiSend className="w-4 h-4" />
                    <span>{loading ? loc.sendingBtn : loc.submitBtn}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
