'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { FiShield, FiArrowLeft, FiLock } from 'react-icons/fi'
import { useLocale } from '@/context/LocaleContext'
import { subscribeToLegalConfig, DEFAULT_LEGAL_CONFIG, LegalDocumentsConfig } from '@/lib/firebase/legal'

export default function KvkkPage() {
  const { getLocalizedPath } = useLocale()
  const [legal, setLegal] = useState<LegalDocumentsConfig>(DEFAULT_LEGAL_CONFIG)

  useEffect(() => {
    const unsub = subscribeToLegalConfig((cfg) => {
      setLegal(cfg)
    })
    return () => unsub()
  }, [])

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
            Ana Sayfaya Dön
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-8 sm:p-12 shadow-sm border border-slate-200">
          
          <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
              <FiLock className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">6698 Sayılı Kanun Uyarınca</span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{legal.kvkkPolicy.title}</h1>
            </div>
          </div>

          <div className="prose prose-slate max-w-none text-sm sm:text-base text-slate-600 leading-relaxed space-y-6">
            
            {/* Data Controller Legal Box */}
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs sm:text-sm text-slate-800">
              <p className="font-bold text-slate-900 text-sm uppercase tracking-wider mb-2">VERİ SORUMLUSU BİLGİLERİ:</p>
              <p><strong>Unvan:</strong> {legal.company.title}</p>
              <p><strong>Adres:</strong> {legal.company.address}</p>
              <p><strong>MERSİS No:</strong> {legal.company.mersis} | <strong>Vergi Dairesi & No:</strong> {legal.company.taxOffice} {legal.company.taxNumber}</p>
              <p><strong>İletişim & Başvuru:</strong> {legal.company.email} | Tel: {legal.company.phone}</p>
            </div>

            {/* Dynamic Full Content */}
            <div className="whitespace-pre-line text-slate-700 font-sans leading-relaxed">
              {legal.kvkkPolicy.content}
            </div>

            <div className="pt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
              <span>Son Güncelleme: {legal.kvkkPolicy.updatedAt}</span>
              <span className="flex items-center gap-1 text-indigo-600 font-semibold">
                <FiShield className="w-3.5 h-3.5" />
                KVKK & Kişisel Veri Güvenliği
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  )
}
