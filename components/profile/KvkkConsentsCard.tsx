'use client'

import { useState, useEffect, useCallback } from 'react'
import { FiShield, FiCheckCircle, FiXCircle, FiRefreshCw } from 'react-icons/fi'
import { getFirebaseAuth } from '@/firebase/config'
import {
  CONSENT_PREFERENCE_KEYS,
  CONSENT_PREFERENCE_META,
  ConsentPreferenceKey,
  NormalizedConsentPreferences,
  createEmptyConsentPreferences,
} from '@/lib/kvkk/consents'

export default function KvkkConsentsCard() {
  const [prefs, setPrefs] = useState<NormalizedConsentPreferences>(createEmptyConsentPreferences)
  const [loading, setLoading] = useState(true)
  const [workingKey, setWorkingKey] = useState<ConsentPreferenceKey | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const loadPrefs = useCallback(async () => {
    setErrorMsg(null)
    try {
      const user = getFirebaseAuth()?.currentUser
      if (!user) {
        setLoading(false)
        return
      }
      const token = await user.getIdToken()
      const res = await fetch('/api/consents/withdraw', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const json = await res.json()
      if (json.success && json.preferences) {
        setPrefs(json.preferences)
      } else {
        setErrorMsg(json.error || 'İzin bilgileri yüklenemedi.')
      }
    } catch (err) {
      console.warn('Consent prefs load warning:', err)
      setErrorMsg('İzin bilgileri okunurken bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPrefs()
  }, [loadPrefs])

  const handleWithdraw = async (consentKey: ConsentPreferenceKey) => {
    setWorkingKey(consentKey)
    setMessage(null)
    setErrorMsg(null)
    try {
      const user = getFirebaseAuth()?.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const current = prefs[consentKey]
      const res = await fetch('/api/consents/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          consentKey,
          docType: current.docType,
          channel: current.channel,
          docVersion: current.docVersion || 1,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setPrefs((prev) => ({
          ...prev,
          [consentKey]: {
            ...prev[consentKey],
            granted: false,
            withdrawnAt: json.withdrawnAt,
            updatedAt: json.withdrawnAt,
          },
        }))
        setMessage(`${CONSENT_PREFERENCE_META[consentKey].label} başarıyla geri çekildi ve kayıt altına alındı.`)
      } else {
        setErrorMsg(json.error || 'İzin geri çekilemedi.')
      }
    } catch (err) {
      console.error('Consent withdraw error:', err)
      setErrorMsg('İzin geri çekilirken bir bağlantı hatası oluştu.')
    } finally {
      setWorkingKey(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <div className="w-4 h-4 border-2 border-sky-600/20 border-t-sky-600 rounded-full animate-spin" />
          <span>KVKK ve iletişim izinleriniz yükleniyor...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
            <FiShield className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900">KVKK &amp; İletişim İzinlerim</h3>
            <p className="text-xs text-slate-500">
              Açık rıza ve kanal bazlı ticari elektronik ileti izinlerinizi görüntüleyebilir, her birini bağımsız olarak geri çekebilirsiniz.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={loadPrefs}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          title="Yenile"
        >
          <FiRefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {message}
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CONSENT_PREFERENCE_KEYS.map((key) => {
          const meta = CONSENT_PREFERENCE_META[key]
          const state = prefs[key]
          const isGranted = Boolean(state?.granted)
          return (
            <div
              key={key}
              className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-colors ${
                isGranted
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : 'border-slate-200 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-900">{meta.label}</span>
                  {isGranted ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 whitespace-nowrap">
                      <FiCheckCircle className="w-3 h-3" /> {meta.activeLabel}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 whitespace-nowrap">
                      <FiXCircle className="w-3 h-3" /> {meta.inactiveLabel}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">{meta.description}</p>
                {isGranted && state?.grantedAt && (
                  <p className="text-[10px] text-emerald-700 mt-1.5 font-medium">
                    Onay: {new Date(state.grantedAt).toLocaleString('tr-TR')} (v{state.docVersion || 1})
                  </p>
                )}
                {!isGranted && state?.withdrawnAt && (
                  <p className="text-[10px] text-slate-400 mt-1.5">
                    Geri çekilme: {new Date(state.withdrawnAt).toLocaleString('tr-TR')}
                  </p>
                )}
              </div>

              {isGranted && (
                <button
                  type="button"
                  disabled={workingKey === key}
                  onClick={() => handleWithdraw(key)}
                  className="self-start px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {workingKey === key ? 'İşleniyor...' : 'İzni Geri Çek'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
