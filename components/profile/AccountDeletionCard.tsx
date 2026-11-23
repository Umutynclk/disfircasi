'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth'
import {
  FiAlertTriangle,
  FiTrash2,
  FiLock,
  FiX,
  FiInfo,
  FiCheckCircle,
} from 'react-icons/fi'
import { getFirebaseAuth } from '@/firebase/config'
import { logoutUser } from '@/lib/firebase/userAuth'
import { clearCart } from '@/lib/utils/cart'
import { ACCOUNT_DELETION_CONFIRMATION_PHRASE } from '@/lib/kvkk/accountDeletion'

interface PreDeleteSummary {
  activeOrdersCount: number
  activeOrderNumbers: string[]
  historicalOrdersCount: number
  savedAddressesCount: number
}

export default function AccountDeletionCard() {
  const router = useRouter()
  const [summary, setSummary] = useState<PreDeleteSummary | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadSummary = async () => {
      try {
        const user = getFirebaseAuth()?.currentUser
        if (!user) return
        const token = await user.getIdToken()
        const res = await fetch('/api/account/delete', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const json = await res.json()
        if (!cancelled && json.success && json.summary) {
          setSummary(json.summary)
        }
      } catch {
        // Non-blocking
      }
    }
    loadSummary()
    return () => {
      cancelled = true
    }
  }, [])

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const auth = getFirebaseAuth()
    const user = auth?.currentUser
    if (!user || !user.email) {
      setError('Aktif kullanıcı oturumu bulunamadı. Lütfen yeniden giriş yapın.')
      return
    }

    if (confirmText.trim().toUpperCase() !== ACCOUNT_DELETION_CONFIRMATION_PHRASE) {
      setError(`Onay kutusuna tam olarak "${ACCOUNT_DELETION_CONFIRMATION_PHRASE}" yazmalısınız.`)
      return
    }

    if (!password.trim()) {
      setError('Güvenliğiniz için mevcut şifrenizi girerek kimliğinizi doğrulamalısınız.')
      return
    }

    setSubmitting(true)
    try {
      // 1. Yeniden kimlik doğrulaması (fresh auth_time)
      const credential = EmailAuthProvider.credential(user.email, password)
      await reauthenticateWithCredential(user, credential)

      // 2. Taze ID token al ve sunucu tarafı hesap silme API'sini çağır
      const freshToken = await user.getIdToken(true)
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify({
          confirmationText: confirmText.trim(),
        }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        setError(json.error || 'Hesap silme işlemi tamamlanamadı.')
        setSubmitting(false)
        return
      }

      // 3. Yerel sepeti temizle, oturumu kapat ve giriş ekranına yönlendir
      try {
        clearCart()
      } catch {
        // ignore
      }
      await logoutUser()
      router.push(`/giris?deleted=1&ref=${encodeURIComponent(json.requestRef || '')}`)
      router.refresh()
    } catch (err: any) {
      const code = String(err?.code || err?.message || '')
      if (code.includes('wrong-password') || code.includes('invalid-credential')) {
        setError('Girdiğiniz şifre hatalı. Lütfen kontrol edip tekrar deneyin.')
      } else if (code.includes('too-many-requests')) {
        setError('Çok fazla başarısız deneme yapıldı. Lütfen biraz sonra tekrar deneyin.')
      } else {
        setError(err?.message || 'Hesap silme işlemi sırasında bir hata oluştu.')
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-rose-200/80 p-5 sm:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <FiAlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Hesabımı Sil &amp; KVKK Veri İmha Talebi
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hesabınızı kapattığınızda üyelik erişiminiz kalıcı olarak sonlandırılır; profil, adresler, tercihler ve
              saklama zorunluluğu bulunmayan kişisel verileriniz silinir. Bu işlem geri alınamaz.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null)
            setPassword('')
            setConfirmText('')
            setModalOpen(true)
          }}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm cursor-pointer flex-shrink-0"
        >
          <FiTrash2 className="w-3.5 h-3.5" />
          <span>Hesabımı Sil</span>
        </button>
      </div>

      {/* Aktif sipariş uyarısı */}
      {summary && summary.activeOrdersCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <FiInfo className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Devam eden {summary.activeOrdersCount} adet sipariş/iade süreciniz bulunmaktadır.
            </p>
            <p className="text-[11px] mt-0.5 text-amber-800">
              Hesabınızı silseniz bile devam eden teslimat (HepsiJET) ve iade/ödeme süreçleriniz bozulmaz; ilgili
              kayıtlar yasal zorunluluk gereği kısıtlı erişimle korunmaya devam eder.
            </p>
          </div>
        </div>
      )}

      {/* Hesap Silme Onay Modalı */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !submitting && setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200"
          >
            <div className="px-6 py-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FiAlertTriangle className="w-5 h-5 text-rose-600" />
                <h4 className="text-sm sm:text-base font-black text-rose-950">
                  Hesap Silme İşlemini Onayla
                </h4>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-xl text-rose-700 hover:bg-rose-100 cursor-pointer"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmDelete} className="p-6 space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                <p className="font-bold text-slate-900">Bu işlem geri alınamaz.</p>
                <p>
                  Hesabınız kalıcı olarak kapatılacak; profil, adres ve tercih verileriniz silinecektir. Mevzuat gereği
                  saklanması zorunlu sipariş, fatura ve rıza ispat kayıtları kısıtlı erişimle korunmaya devam edecektir.
                </p>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Mevcut Şifreniz (Yeniden Kimlik Doğrulama) *
                </label>
                <div className="relative">
                  <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Şifrenizi girin"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-rose-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Onaylamak için aşağıya{' '}
                  <span className="font-mono text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                    {ACCOUNT_DELETION_CONFIRMATION_PHRASE}
                  </span>{' '}
                  yazın *
                </label>
                <input
                  type="text"
                  required
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={ACCOUNT_DELETION_CONFIRMATION_PHRASE}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:border-rose-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    confirmText.trim().toUpperCase() !== ACCOUNT_DELETION_CONFIRMATION_PHRASE ||
                    !password.trim()
                  }
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <FiCheckCircle className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Hesabınız Kapatılıyor...' : 'Hesabımı Kalıcı Olarak Sil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
