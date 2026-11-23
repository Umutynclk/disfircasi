'use client'

import { useState, useEffect } from 'react'
import { FiShield, FiCheckCircle, FiXCircle } from 'react-icons/fi'
import { getFirebaseAuth } from '@/firebase/config'

interface ConsentPrefState {
  granted?: boolean
  updatedAt?: string
  withdrawnAt?: string
  docVersion?: number
}

export default function KvkkConsentsCard() {
  const [prefs, setPrefs] = useState<{
    acik_riza: ConsentPrefState
    ticari_ileti: ConsentPrefState
  }>({
    acik_riza: { granted: false },
    ticari_ileti: { granted: false },
  })
  const [loading, setLoading] = useState(true)
  const [workingType, setWorkingType] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadPrefs = async () => {
    try {
      const user = getFirebaseAuth()?.currentUser
      if (!user) {
        setLoading(false)
        return
      }
      const token = await user.getIdToken()
      const res = await fetch('/api/consents/withdraw', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json()
      if (json.success && json.preferences) {
        setPrefs(json.preferences)
      }
    } catch (err) {
      console.warn('Consent prefs load warning:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPrefs()
  }, [])

  const handleWithdraw = async (docType: 'acik_riza' | 'ticari_ileti') => {
    setWorkingType(docType)
    setMessage(null)
    try {
      const user = getFirebaseAuth()?.currentUser
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/consents/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          docType,
          docVersion: prefs[docType]?.docVersion || 1,
        }),
      })
      const json = await res.json()
      if (json.success) {
        setPrefs((prev) => ({
          ...prev,
          [docType]: { granted: false, withdrawnAt: json.withdrawnAt },
        }))
        setMessage('İzniniz başarıyla geri çekildi ve kayıt altına alındı.')
      }
    } catch (err) {
      console.error('Consent withdraw error:', err)
    } finally {
      setWorkingType(null)
    }
  }

  if (loading) return null

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0">
          <FiShield className="w-4 h-4" />
        </div>
        <div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900">KVKK &amp; İletişim İzinlerim</h3>
          <p className="text-xs text-slate-500">
            İsteğe bağlı verdiğiniz açık rıza ve ticari ileti izinlerinizi dilediğiniz zaman geri çekebilirsiniz.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(
          [
            {
              key: 'acik_riza' as const,
              title: 'Kişiselleştirilmiş Kampanya & Analiz (Açık Rıza)',
              desc: 'Alışveriş tercihlerinize göre kişisel öneriler sunulması.',
            },
            {
              key: 'ticari_ileti' as const,
              title: 'Ticari Elektronik İleti İzni (E-posta / SMS)',
              desc: 'İndirim, kampanya ve duyuru iletilerinin gönderilmesi.',
            },
          ]
        ).map((item) => {
          const state = prefs[item.key]
          const isGranted = Boolean(state?.granted)
          return (
            <div
              key={item.key}
              className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-bold text-slate-900">{item.title}</span>
                  {isGranted ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      <FiCheckCircle className="w-3 h-3" /> Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                      <FiXCircle className="w-3 h-3" /> Kapalı
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">{item.desc}</p>
                {state?.withdrawnAt && !isGranted && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Geri çekilme: {new Date(state.withdrawnAt).toLocaleString('tr-TR')}
                  </p>
                )}
              </div>

              {isGranted && (
                <button
                  type="button"
                  disabled={workingType === item.key}
                  onClick={() => handleWithdraw(item.key)}
                  className="self-start px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  {workingType === item.key ? 'İşleniyor...' : 'İzni Geri Çek'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
