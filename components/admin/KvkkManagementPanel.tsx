'use client'

import { useState, useEffect } from 'react'
import {
  FiShield,
  FiEye,
  FiEdit3,
  FiSave,
  FiUploadCloud,
  FiSlash,
  FiAlertTriangle,
  FiCheckCircle,
  FiInfo,
} from 'react-icons/fi'
import { getFirebaseAuth } from '@/firebase/config'
import {
  KVKK_DOCUMENT_META,
  KvkkDocumentType,
  KvkkManagedDocument,
  CompanyInfoCheckResult,
} from '@/lib/kvkk/types'

export default function KvkkManagementPanel() {
  const [documents, setDocuments] = useState<KvkkManagedDocument[]>([])
  const [selectedType, setSelectedType] = useState<KvkkDocumentType>('kvkk_aydinlatma')
  const [companyCompleteness, setCompanyCompleteness] = useState<CompanyInfoCheckResult>({
    isComplete: true,
    missingFields: [],
  })
  const [iysIntegrated, setIysIntegrated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [editTitle, setEditTitle] = useState('')
  const [editContent, setEditContent] = useState('')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const getToken = async () => {
    const auth = getFirebaseAuth()
    const user = auth?.currentUser
    if (!user) return ''
    return await user.getIdToken()
  }

  const fetchDocuments = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/kvkk/documents', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.documents)) {
        setDocuments(json.documents)
        if (json.companyCompleteness) setCompanyCompleteness(json.companyCompleteness)
        setIysIntegrated(Boolean(json.iysIntegrated))
        const current = json.documents.find((d: KvkkManagedDocument) => d.docType === selectedType) || json.documents[0]
        if (current) {
          setEditTitle(current.draftTitle || current.title)
          setEditContent(current.draftContent || current.content)
        }
      }
    } catch (err) {
      console.error('KVKK docs fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedDoc = documents.find((d) => d.docType === selectedType) || null

  const handleSelectDoc = (doc: KvkkManagedDocument) => {
    setSelectedType(doc.docType)
    setEditTitle(doc.draftTitle || doc.title)
    setEditContent(doc.draftContent || doc.content)
    setFeedback(null)
  }

  const runAction = async (action: 'save_draft' | 'publish' | 'unpublish' | 'toggle_active', extra?: any) => {
    if (!selectedDoc) return
    setSaving(true)
    setFeedback(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/kvkk/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          docType: selectedDoc.docType,
          action,
          title: editTitle,
          content: editContent,
          ...extra,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setFeedback({ type: 'error', message: json.error || 'İşlem başarısız oldu.' })
        return
      }

      const updated: KvkkManagedDocument = json.document
      setDocuments((prev) => prev.map((d) => (d.docType === updated.docType ? updated : d)))
      setEditTitle(updated.draftTitle || updated.title)
      setEditContent(updated.draftContent || updated.content)

      const msgMap: Record<string, string> = {
        save_draft: 'Taslak kaydedildi (yayındaki metin ve eski onay kayıtları etkilenmedi).',
        publish: `Yeni versiyon (v${updated.version}) başarıyla yayına alındı. Önceki versiyonlar arşivde korunmaktadır.`,
        unpublish: 'Belge yayından kaldırıldı ve pasif duruma alındı.',
        toggle_active: updated.active ? 'Belge aktif duruma getirildi.' : 'Belge pasif duruma getirildi.',
      }
      setFeedback({ type: 'success', message: msgMap[action] })
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Sunucu hatası.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0">
              <FiShield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">
                KVKK, Aydınlatma ve Açık Rıza Yönetimi
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                6698 sayılı KVKK ve 6502 sayılı Kanun metinlerini versiyonlu olarak yönetin. Her yayın yeni versiyon oluşturur; eski rıza kayıtları bozulmaz.
              </p>
            </div>
          </div>
        </div>

        {/* İYS & Firma Bilgisi Durum Uyarıları */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <FiInfo className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">
                İYS (İleti Yönetim Sistemi) Durumu: {iysIntegrated ? 'Aktif' : 'Entegrasyon Mevcut Değil'}
              </span>
              <span className="text-amber-800">
                Ticari elektronik ileti onayları sunucuda zaman damgalı ve versiyonlu olarak saklanır; İYS entegrasyonu henüz bağlanmamıştır.
              </span>
            </div>
          </div>

          {!companyCompleteness.isComplete ? (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2.5">
              <FiAlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Eksik Firma Bilgileri (Taslak Modu Zorunlu)</span>
                <span>
                  Yayına almadan önce tamamlanması gereken alanlar: {companyCompleteness.missingFields.join(', ')}.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-start gap-2.5">
              <FiCheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Firma Yasal Bilgileri Doğrulandı</span>
                <span>Ticaret unvanı, adres, vergi no, telefon ve e-posta kayıtlıdır (Yasal &amp; Sözleşmeler sekmesinden güncellenebilir).</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6 Document Cards Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {documents.map((doc) => {
          const isSelected = doc.docType === selectedType
          const statusBadge =
            doc.status === 'published' && doc.active
              ? { text: `Yayında • v${doc.version}`, cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
              : doc.status === 'unpublished' || !doc.active
              ? { text: `Pasif • v${doc.version}`, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
              : { text: `Taslak • v${doc.version}`, cls: 'bg-amber-100 text-amber-800 border-amber-200' }

          return (
            <button
              key={doc.docType}
              type="button"
              onClick={() => handleSelectDoc(doc)}
              className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                isSelected
                  ? 'border-sky-600 bg-sky-50/50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-xs font-bold text-gray-900 truncate">{doc.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${statusBadge.cls}`}>
                  {statusBadge.text}
                </span>
              </div>
              <p className="text-[11px] text-gray-500 line-clamp-2">
                {KVKK_DOCUMENT_META[doc.docType]?.legalNote}
              </p>
              <p className="text-[10px] text-gray-400 mt-2">
                Güncelleme: {doc.updatedAt ? new Date(doc.updatedAt).toLocaleString('tr-TR') : '-'}
              </p>
            </button>
          )
        })}
      </div>

      {/* Editor & Preview Panel */}
      {selectedDoc && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-gray-900">{selectedDoc.label}</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200">
                  Versiyon v{selectedDoc.version}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {KVKK_DOCUMENT_META[selectedDoc.docType]?.legalNote}
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setMode('edit')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  mode === 'edit' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FiEdit3 className="w-3.5 h-3.5" />
                Düzenle
              </button>
              <button
                type="button"
                onClick={() => setMode('preview')}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer ${
                  mode === 'preview' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <FiEye className="w-3.5 h-3.5" />
                Önizleme
              </button>
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-xl text-xs font-semibold border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.message}
            </div>
          )}

          {mode === 'edit' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Belge Başlığı
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-300 text-sm focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Belge Metni
                </label>
                <textarea
                  rows={12}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-4 rounded-xl border border-gray-300 text-sm font-mono leading-relaxed focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-slate-50 p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-200">
                <h4 className="text-base font-bold text-slate-900">{editTitle}</h4>
                <span className="text-[11px] font-semibold text-slate-500">v{selectedDoc.version}</span>
              </div>
              <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
                {editContent}
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => runAction('toggle_active', { active: !selectedDoc.active })}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer disabled:opacity-50 ${
                  selectedDoc.active
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                    : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                }`}
              >
                Durum: {selectedDoc.active ? 'Aktif' : 'Pasif'}
              </button>

              {selectedDoc.status === 'published' && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => runAction('unpublish')}
                  className="px-3.5 py-2.5 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <FiSlash className="w-3.5 h-3.5" />
                  Yayından Kaldır
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => runAction('save_draft')}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-800 hover:bg-gray-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FiSave className="w-3.5 h-3.5" />
                Taslak Kaydet
              </button>

              <button
                type="button"
                disabled={saving || !companyCompleteness.isComplete}
                onClick={() => runAction('publish')}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <FiUploadCloud className="w-4 h-4" />
                {saving ? 'İşleniyor...' : `Yeni Versiyonla Yayına Al (v${(selectedDoc.version || 0) + 1})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
