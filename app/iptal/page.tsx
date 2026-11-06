'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FiRefreshCw, FiShield, FiArrowLeft, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi'
import { useLocale } from '@/context/LocaleContext'
import { subscribeToLegalConfig, DEFAULT_LEGAL_CONFIG, LegalDocumentsConfig } from '@/lib/firebase/legal'

export default function IptalVeIadePage() {
  const { getLocalizedPath } = useLocale()
  const [legal, setLegal] = useState<LegalDocumentsConfig>(DEFAULT_LEGAL_CONFIG)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = subscribeToLegalConfig((cfg) => {
      setLegal(cfg)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  if (loading) {
    return (
      <div className="pt-32 pb-20 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-600"></div>
      </div>
    )
  }

  return (
    <div className="bg-slate-50 min-h-screen py-12 md:py-20">
      <div className="container-custom max-w-4xl mx-auto px-4">
        
        {/* Breadcrumb / Back */}
        <div className="mb-6">
          <Link
            href={getLocalizedPath('/')}
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-sky-600 transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>Ana Sayfaya Dön</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-200">
          
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-6">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
              <FiRefreshCw className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">6502 Sayılı Kanun Uyarınca</span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{legal.cancellationAndReturn.title}</h1>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-sm sm:text-base text-slate-600 leading-relaxed space-y-6">
            
            {/* Seller Company Legal Box */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs sm:text-sm text-slate-800">
              <p className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-2">HİZMET SAĞLAYICI VE SATICI BİLGİLERİ:</p>
              <p><strong>Unvan:</strong> {legal.company.title}</p>
              <p><strong>İade Adresi:</strong> {legal.company.address}</p>
              <p><strong>MERSİS:</strong> {legal.company.mersis} | <strong>Vergi Dairesi & No:</strong> {legal.company.taxOffice} {legal.company.taxNumber}</p>
              <p><strong>Müşteri Hizmetleri / Tel:</strong> {legal.company.phone} | <strong>E-Posta:</strong> {legal.company.email}</p>
            </div>

            {/* Important Hygiene Notice */}
            <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
              <FiAlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">Önemli Hijyen ve Sağlık Uyarısı (Yönetmelik Madde 15/ç):</p>
                <p>Diş fırçaları, elektronik fırça gövdeleri, değiştirilebilir başlıklar ve ağız bakım ürünleri hijyen ve sağlık kategorisindedir. Koruyucu güvenlik bandı, jelatini veya ambalajı açılmış, kullanılmış ürünlerin iadesi mevzuat gereği kabul edilememektedir.</p>
              </div>
            </div>

            {/* Dynamic Full Content */}
            <div className="whitespace-pre-line text-slate-700 font-sans leading-relaxed">
              {legal.cancellationAndReturn.content}
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
              <span>Son Güncelleme: {legal.cancellationAndReturn.updatedAt}</span>
              <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                <FiCheckCircle className="w-4 h-4" />
                PayTR & 256-Bit SSL ile Anında Kesintisiz İade
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
