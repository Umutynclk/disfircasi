'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import {
  FiSave,
  FiRefreshCw,
  FiGlobe,
  FiDollarSign,
  FiCheck,
  FiCpu,
  FiEdit3,
  FiInfo,
  FiFileText,
  FiShield,
  FiCreditCard,
  FiPlus,
  FiTrash2,
  FiUploadCloud,
  FiCheckCircle,
  FiImage,
  FiTruck,
  FiPrinter,
  FiAlertCircle,
  FiClock,
  FiPlay,
  FiList,
  FiDownload,
  FiEye,
  FiZap,
} from 'react-icons/fi'
import {
  FullCurrencyConfig,
  DEFAULT_CURRENCY_CONFIG,
  saveCurrencyConfig,
  SupportedCurrency,
} from '@/lib/firebase/currency'
import {
  LegalDocumentsConfig,
  DEFAULT_LEGAL_CONFIG,
  subscribeToLegalConfig,
  saveLegalConfig,
  PaymentTrustBadgeItem,
} from '@/lib/firebase/legal'
import { uploadImage } from '@/lib/firebase/storage'
import { formatMoney } from '@/lib/utils/format'
import {
  HepsiJetSettings,
  DEFAULT_HEPSIJET_SETTINGS,
  DEFAULT_PRINT_SETTINGS,
  PRESET_100X150_PORTRAIT,
  ThermalPrintSettings,
  ThermalPrintPreset,
  validatePrintSettings,
  HepsiJetAutomationSettings,
  DEFAULT_HEPSIJET_AUTOMATION_SETTINGS,
} from '@/lib/hepsijet/types'
import { getCurrentUser } from '@/lib/firebase/auth'

interface SiteSettings {
  siteName: string
  siteDescription: string
  contactEmail: string
  contactPhone: string
  address: string
  socialMedia: {
    facebook?: string
    instagram?: string
    twitter?: string
  }
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingCurrency, setSavingCurrency] = useState(false)
  const [savingLegal, setSavingLegal] = useState(false)
  const [savingHepsiJet, setSavingHepsiJet] = useState(false)
  const [syncingTCMB, setSyncingTCMB] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'payment' | 'currency' | 'legal' | 'hepsijet' | 'print_agent'>('general')
  const [hepsijetSettings, setHepsijetSettings] = useState<HepsiJetSettings>(DEFAULT_HEPSIJET_SETTINGS)
  const [hasEnvCredentials, setHasEnvCredentials] = useState(false)
  const [isLiveDispatchEnabled, setIsLiveDispatchEnabled] = useState(false)
  const [testingPreview, setTestingPreview] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState<ThermalPrintPreset>(
    () => (hepsijetSettings.printSettings?.preset || '100x150_portrait') as ThermalPrintPreset
  )

  // HepsiJET Günlük Otomasyon State'leri
  const [automationSettings, setAutomationSettings] = useState<HepsiJetAutomationSettings>(DEFAULT_HEPSIJET_AUTOMATION_SETTINGS)
  const [savingAutomation, setSavingAutomation] = useState(false)
  const [runningAutomation, setRunningAutomation] = useState(false)
  const [automationRunResult, setAutomationRunResult] = useState<any>(null)
  const [connectionChecking, setConnectionChecking] = useState(false)
  const [connectionResult, setConnectionResult] = useState<{ success: boolean; message?: string; error?: string; checks?: Record<string, any> } | null>(null)
  const [activeHepsiJetSubTab, setActiveHepsiJetSubTab] = useState<'automation' | 'company' | 'warehouse' | 'print' | 'all'>('automation')

  const [activeLegalSubTab, setActiveLegalSubTab] = useState<
    'company' | 'return' | 'shipping' | 'distance' | 'preliminary' | 'privacy' | 'kvkk' | 'badges' | 'bankTransfer'
  >('company')
  const [uploadingBadge, setUploadingBadge] = useState<string | null>(null)
  const [newBadge, setNewBadge] = useState<{ name: string; badgeText: string; color: string }>({
    name: '',
    badgeText: '',
    color: 'text-sky-400',
  })
  const [settings, setSettings] = useState<SiteSettings>({
    siteName: 'SmileBrush',
    siteDescription: 'Modern elektrikli diş fırçası çözümleri ile gülüşünüzü parlatın',
    contactEmail: '',
    contactPhone: '',
    address: '',
    socialMedia: {
      facebook: '',
      instagram: '',
      twitter: '',
    },
  })
  const [currencyConfig, setCurrencyConfig] = useState<FullCurrencyConfig>(DEFAULT_CURRENCY_CONFIG)
  const [legalConfig, setLegalConfig] = useState<LegalDocumentsConfig>(DEFAULT_LEGAL_CONFIG)
  const [printAgents, setPrintAgents] = useState<any[]>([])
  const [loadingAgents, setLoadingAgents] = useState(false)
  const [generatingAgentToken, setGeneratingAgentToken] = useState(false)
  const [newAgentToken, setNewAgentToken] = useState<string | null>(null)
  const [printQueueStats, setPrintQueueStats] = useState<{
    pending: number
    processing: number
    printed: number
    simulated: number
    failed: number
    total: number
  } | null>(null)
  const [agentForm, setAgentForm] = useState({
    agentId: 'kaliport-win-01',
    name: 'Windows Palmx TXP-400',
    printerId: '4BARCODE 4B-2054TG',
    description: 'Depo PALMX TXP 400 / 4BARCODE 4B-2054TG Termal Barkod Yazıcı Servisi',
  })
  const [showCreateAgentModal, setShowCreateAgentModal] = useState(false)
  const [actionInProgressAgentId, setActionInProgressAgentId] = useState<string | null>(null)

  useEffect(() => {
    fetchSettings()
    loadPrintAgents()
    // Subscribe to currency config
    try {
      const db = getFirestoreDB()
      const unsub = onSnapshot(doc(db, 'settings', 'currency'), (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<FullCurrencyConfig>
          const rates = {
            TRY: { ...DEFAULT_CURRENCY_CONFIG.rates.TRY, ...data.rates?.TRY },
            USD: { ...DEFAULT_CURRENCY_CONFIG.rates.USD, ...data.rates?.USD },
            EUR: { ...DEFAULT_CURRENCY_CONFIG.rates.EUR, ...data.rates?.EUR },
            GBP: { ...DEFAULT_CURRENCY_CONFIG.rates.GBP, ...data.rates?.GBP },
          }

          setCurrencyConfig({
            baseCurrency: 'TRY',
            mode: data.mode || 'auto',
            source: data.source || 'TCMB',
            rateDate: data.rateDate || DEFAULT_CURRENCY_CONFIG.rateDate,
            bultenNo: data.bultenNo || DEFAULT_CURRENCY_CONFIG.bultenNo,
            updatedAt: data.updatedAt || new Date().toISOString(),
            isStale: data.isStale || false,
            rates,
            tr: rates.TRY,
            en: rates.USD,
            de: rates.EUR,
            fr: rates.EUR,
            it: rates.EUR,
          })
        }
      })
    } catch (err) {
      console.error('Currency settings fetch error:', err)
    }

    // Subscribe to legal & company config
    const unsubLegal = subscribeToLegalConfig((cfg) => {
      setLegalConfig(cfg)
    })

    fetchHepsiJetSettings()
    fetchAutomationSettings()

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('tab') === 'hepsijet') {
        setActiveTab('hepsijet')
      }
      if (params.get('tab') === 'print_agent' || params.get('tab') === 'print-agent') {
        setActiveTab('print_agent')
      }
      if (params.get('sub') === 'automation') {
        setActiveHepsiJetSubTab('automation')
      }
    }

    return () => {
      unsubLegal()
    }
  }, [])

  const fetchAutomationSettings = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) return
      const token = await user.getIdToken()

      const res = await fetch('/api/admin/hepsijet/automation/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) return
      const json = await res.json()
      if (json.success && json.settings) {
        setAutomationSettings(json.settings)
      }
    } catch (err) {
      console.warn('HepsiJET otomasyon ayarları yüklenemedi:', err)
    }
  }

  const handleSaveAutomation = async () => {
    setSavingAutomation(true)
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.')
        return
      }
      const token = await user.getIdToken()

      const res = await fetch('/api/admin/hepsijet/automation/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(automationSettings),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Otomasyon ayarları kaydedilemedi.')
      }

      setAutomationSettings(json.settings)
      alert('✅ HepsiJET Günlük Otomasyon Ayarları başarıyla kaydedildi!')
    } catch (err: any) {
      console.error('Save automation error:', err)
      alert(`❌ Otomasyon ayarları kaydedilirken hata: ${err.message}`)
    } finally {
      setSavingAutomation(false)
    }
  }

  const handleTestAutomationRun = async () => {
    setRunningAutomation(true)
    setAutomationRunResult(null)
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.')
        return
      }
      const token = await user.getIdToken()

      const res = await fetch('/api/admin/hepsijet/automation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Otomasyon testi çalıştırılamadı.')
      }

      setAutomationRunResult(json)
      fetchAutomationSettings()
      alert(`✅ Otomasyon Simülasyonu Tamamlandı!\n${json.summary?.message || 'Kontroller bitti.'}`)
    } catch (err: any) {
      console.error('Test automation run error:', err)
      alert(`❌ Otomasyon testi sırasında hata: ${err.message}`)
    } finally {
      setRunningAutomation(false)
    }
  }

  const loadPrintAgents = async () => {
    setLoadingAgents(true)
    try {
      const user = await getCurrentUser()
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/print-agents', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.success) {
        setPrintAgents(data.agents || [])
        if (data.queueStats) {
          setPrintQueueStats(data.queueStats)
        }
      }
    } catch (e) {
      console.warn('Failed to load print agents:', e)
    } finally {
      setLoadingAgents(false)
    }
  }

  const handleCreatePrintAgent = async () => {
    await handleCreateCustomPrintAgent()
  }

  const handleCreateCustomPrintAgent = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!agentForm.agentId.trim()) {
      alert('Lütfen Agent ID giriniz.')
      return
    }

    setGeneratingAgentToken(true)
    try {
      const user = await getCurrentUser()
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/print-agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId: agentForm.agentId.trim(),
          name: agentForm.name.trim() || agentForm.agentId.trim(),
          printerId: agentForm.printerId.trim() || '4BARCODE 4B-2054TG',
          description: agentForm.description.trim(),
        }),
      })
      const data = await res.json()
      if (data.success && data.rawToken) {
        setNewAgentToken(data.rawToken)
        setShowCreateAgentModal(false)
        alert(`✅ Print Agent Başarıyla Oluşturuldu!\nToken: ${data.rawToken}\n\nBu tokenı Windows bilgisayardaki config.json dosyasına yapıştırın.`)
        loadPrintAgents()
      } else {
        alert(`❌ Hata: ${data.error || 'Agent oluşturulamadı'}`)
      }
    } catch (err: any) {
      alert(`❌ Hata: ${err.message}`)
    } finally {
      setGeneratingAgentToken(false)
    }
  }

  const handleRegenerateAgentToken = async (agentId: string) => {
    const confirmRotate = window.confirm(
      `Agent [${agentId}] için güvenlik tokenını yenilemek istediğinize emin misiniz?\n\nEski token anında iptal edilir. Windows servisinin yeni token ile güncellenmesi gerekir.`
    )
    if (!confirmRotate) return

    setActionInProgressAgentId(agentId)
    try {
      const user = await getCurrentUser()
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/print-agents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId,
          action: 'regenerate_token',
        }),
      })
      const data = await res.json()
      if (data.success && data.rawToken) {
        setNewAgentToken(data.rawToken)
        alert(`✅ Token Başarıyla Yenilendi!\nYeni Token: ${data.rawToken}\n\nBu tokenı Windows'taki config.json dosyasına yapıştırın.`)
        loadPrintAgents()
      } else {
        alert(`❌ Hata: ${data.error || 'Token yenilenemedi'}`)
      }
    } catch (err: any) {
      alert(`❌ Hata: ${err.message}`)
    } finally {
      setActionInProgressAgentId(null)
    }
  }

  const handleToggleAgentStatus = async (agentId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'revoked' : 'active'
    const confirmToggle = window.confirm(
      newStatus === 'revoked'
        ? `Agent [${agentId}] erişim yetkisini iptal etmek istediğinize emin misiniz? Agent kuyruktan iş alamayacaktır.`
        : `Agent [${agentId}] erişim yetkisini tekrar etkinleştirmek istiyor musunuz?`
    )
    if (!confirmToggle) return

    setActionInProgressAgentId(agentId)
    try {
      const user = await getCurrentUser()
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/print-agents', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          agentId,
          status: newStatus,
        }),
      })
      const data = await res.json()
      if (data.success) {
        loadPrintAgents()
      } else {
        alert(`❌ Hata: ${data.error || 'Durum güncellenemedi'}`)
      }
    } catch (err: any) {
      alert(`❌ Hata: ${err.message}`)
    } finally {
      setActionInProgressAgentId(null)
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    const confirmDelete = window.confirm(
      `Agent [${agentId}] kaydını tamamen silmek istediğinize emin misiniz?`
    )
    if (!confirmDelete) return

    setActionInProgressAgentId(agentId)
    try {
      const user = await getCurrentUser()
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch(`/api/admin/print-agents?agentId=${encodeURIComponent(agentId)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (data.success) {
        loadPrintAgents()
      } else {
        alert(`❌ Hata: ${data.error || 'Agent silinemedi'}`)
      }
    } catch (err: any) {
      alert(`❌ Hata: ${err.message}`)
    } finally {
      setActionInProgressAgentId(null)
    }
  }

  const fetchHepsiJetSettings = async () => {
    try {
      const user = await getCurrentUser()
      if (!user) return
      const token = await user.getIdToken()

      const res = await fetch('/api/admin/hepsijet/settings', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) return
      const json = await res.json()
      if (json.success && json.settings) {
        setHepsijetSettings(json.settings)
        if (json.settings.printSettings?.preset) {
          setSelectedPreset(json.settings.printSettings.preset)
        }
        setHasEnvCredentials(Boolean(json.hasEnvCredentials))
        setIsLiveDispatchEnabled(Boolean(json.isLiveDispatchEnabled))
      }
    } catch (err) {
      console.warn('HepsiJET ayarları yüklenemedi:', err)
    }
  }

  const handleSaveHepsiJet = async () => {
    setSavingHepsiJet(true)
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.')
        return
      }
      const token = await user.getIdToken()

      const res = await fetch('/api/admin/hepsijet/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(hepsijetSettings),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Ayarlar kaydedilemedi.')
      }

      setHepsijetSettings(json.settings)
      if (json.settings.printSettings?.preset) {
        setSelectedPreset(json.settings.printSettings.preset)
      }
      alert('✅ HepsiJET Entegrasyon Ayarları başarıyla kaydedildi!')
    } catch (err: any) {
      console.error('Save HepsiJET settings error:', err)
      alert(`❌ HepsiJET ayarları kaydedilirken hata: ${err.message}`)
    } finally {
      setSavingHepsiJet(false)
    }
  }

  const handleTestPrintPreview = async (mode: 'preview' | 'download' = 'preview') => {
    setTestingPreview(true)
    try {
      const user = await getCurrentUser()
      const token = user ? await user.getIdToken() : ''
      const presetQuery = selectedPreset !== 'custom' ? `&preset=${selectedPreset}` : ''
      const downloadQuery = mode === 'download' ? '&download=true' : ''
      const res = await fetch(`/api/admin/hepsijet/combined-label?orderId=sample${presetQuery}${downloadQuery}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Örnek etiket önizlemesi oluşturulamadı.')
      }
      const blob = await res.blob()
      const fileUrl = window.URL.createObjectURL(blob)
      if (mode === 'download') {
        const presetLabel = selectedPreset === '100x150_portrait' ? '100x150-dikey' : selectedPreset === '150x100_landscape' ? '150x100-yatay' : 'ozel'
        const a = document.createElement('a')
        a.href = fileUrl
        a.download = `numune-etiket-${presetLabel}.pdf`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(fileUrl)
      } else {
        window.open(fileUrl, '_blank')
      }
    } catch (err: any) {
      console.error('Test preview error:', err)
      alert(`❌ Önizleme Hatası: ${err.message}`)
    } finally {
      setTestingPreview(false)
    }
  }

  const handlePresetChange = (preset: ThermalPrintPreset) => {
    setSelectedPreset(preset)
    if (preset === '150x100_landscape') {
      setHepsijetSettings((prev) => ({
        ...prev,
        printSettings: {
          ...DEFAULT_PRINT_SETTINGS,
          preset: '150x100_landscape',
          // Kullanıcı tercihlerini koru
          companyTitle: prev.printSettings?.companyTitle ?? DEFAULT_PRINT_SETTINGS.companyTitle,
          showPrice: prev.printSettings?.showPrice ?? DEFAULT_PRINT_SETTINGS.showPrice,
          showCustomerPhone: prev.printSettings?.showCustomerPhone ?? DEFAULT_PRINT_SETTINGS.showCustomerPhone,
          showPackerField: prev.printSettings?.showPackerField ?? DEFAULT_PRINT_SETTINGS.showPackerField,
          showItemSku: prev.printSettings?.showItemSku ?? DEFAULT_PRINT_SETTINGS.showItemSku,
          showItemVariant: prev.printSettings?.showItemVariant ?? DEFAULT_PRINT_SETTINGS.showItemVariant,
          fontSize: prev.printSettings?.fontSize ?? DEFAULT_PRINT_SETTINGS.fontSize,
          logoUrl: prev.printSettings?.logoUrl ?? DEFAULT_PRINT_SETTINGS.logoUrl,
          showFullAddress: prev.printSettings?.showFullAddress ?? DEFAULT_PRINT_SETTINGS.showFullAddress,
          showNotes: prev.printSettings?.showNotes ?? DEFAULT_PRINT_SETTINGS.showNotes,
        },
      }))
    } else if (preset === '100x150_portrait') {
      setHepsijetSettings((prev) => ({
        ...prev,
        printSettings: {
          ...PRESET_100X150_PORTRAIT,
          preset: '100x150_portrait',
          // Kullanıcı tercihlerini koru
          companyTitle: prev.printSettings?.companyTitle ?? PRESET_100X150_PORTRAIT.companyTitle,
          showPrice: prev.printSettings?.showPrice ?? PRESET_100X150_PORTRAIT.showPrice,
          showCustomerPhone: prev.printSettings?.showCustomerPhone ?? PRESET_100X150_PORTRAIT.showCustomerPhone,
          showPackerField: prev.printSettings?.showPackerField ?? PRESET_100X150_PORTRAIT.showPackerField,
          showItemSku: prev.printSettings?.showItemSku ?? PRESET_100X150_PORTRAIT.showItemSku,
          showItemVariant: prev.printSettings?.showItemVariant ?? PRESET_100X150_PORTRAIT.showItemVariant,
          fontSize: prev.printSettings?.fontSize ?? PRESET_100X150_PORTRAIT.fontSize,
          logoUrl: prev.printSettings?.logoUrl ?? PRESET_100X150_PORTRAIT.logoUrl,
          showFullAddress: prev.printSettings?.showFullAddress ?? PRESET_100X150_PORTRAIT.showFullAddress,
          showNotes: prev.printSettings?.showNotes ?? PRESET_100X150_PORTRAIT.showNotes,
        },
      }))
    } else if (preset === 'custom') {
      setHepsijetSettings((prev) => ({
        ...prev,
        printSettings: {
          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
          preset: 'custom',
        },
      }))
    }
  }

  const fetchSettings = async () => {
    try {
      const db = getFirestoreDB()
      const settingsRef = doc(db, 'settings', 'site')
      const settingsSnap = await getDoc(settingsRef)

      if (settingsSnap.exists()) {
        setSettings(settingsSnap.data() as SiteSettings)
      }
    } catch (error) {
      console.error('Settings fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const db = getFirestoreDB()
      const settingsRef = doc(db, 'settings', 'site')
      const dataToSave = {
        ...settings,
        updatedAt: new Date().toISOString(),
      }
      await setDoc(settingsRef, dataToSave, { merge: true })

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('settingsUpdated'))
      }

      alert('✅ Ayarlar başarıyla Firebase\'e kaydedildi!')
    } catch (error: any) {
      console.error('❌ Settings save error:', error)
      alert(`❌ Ayarlar kaydedilirken bir hata oluştu: ${error.message || 'Bilinmeyen hata'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveCurrency = async () => {
    setSavingCurrency(true)
    try {
      await saveCurrencyConfig(currencyConfig)
      alert('✅ Para birimi ayarları başarıyla kaydedildi!')
    } catch (error: any) {
      console.error('❌ Currency save error:', error)
      alert(`❌ Para birimi kaydedilirken hata: ${error.message || 'Bilinmeyen hata'}`)
    } finally {
      setSavingCurrency(false)
    }
  }

  const handleSaveLegal = async () => {
    setSavingLegal(true)
    try {
      await saveLegalConfig(legalConfig)
      alert('✅ Satıcı & Sözleşmeler (6502 Sayılı Kanun & KVKK) başarıyla Firebase\'e kaydedildi!')
    } catch (error: any) {
      console.error('❌ Legal save error:', error)
      alert(`❌ Sözleşmeler kaydedilirken hata: ${error.message || 'Bilinmeyen hata'}`)
    } finally {
      setSavingLegal(false)
    }
  }

  const handleSyncTCMB = async () => {
    setSyncingTCMB(true)
    try {
      const res = await fetch('/api/currency-rates?force=true')
      if (!res.ok) throw new Error('TCMB API yanıt vermedi')
      const json = await res.json()
      if (!json.success || !json.data) throw new Error(json.error || 'Veri okunamadı')

      const tcmb = json.data
      const updatedRates = {
        TRY: { symbol: '₺', rate: 1, sellingTRY: 1, buyingTRY: 1, label: 'Türk Lirası (₺)', code: 'TRY' as SupportedCurrency },
        USD: { symbol: '$', rate: tcmb.rates.USD.rate, sellingTRY: tcmb.rates.USD.selling, buyingTRY: tcmb.rates.USD.buying, label: 'US Dollar ($)', code: 'USD' as SupportedCurrency },
        EUR: { symbol: '€', rate: tcmb.rates.EUR.rate, sellingTRY: tcmb.rates.EUR.selling, buyingTRY: tcmb.rates.EUR.buying, label: 'Euro (€)', code: 'EUR' as SupportedCurrency },
        GBP: { symbol: '£', rate: tcmb.rates.GBP.rate, sellingTRY: tcmb.rates.GBP.selling, buyingTRY: tcmb.rates.GBP.buying, label: 'British Pound (£)', code: 'GBP' as SupportedCurrency },
      }

      const newConfig: FullCurrencyConfig = {
        baseCurrency: 'TRY',
        mode: 'auto',
        source: 'TCMB',
        rateDate: tcmb.date,
        bultenNo: tcmb.bultenNo,
        updatedAt: new Date().toISOString(),
        isStale: tcmb.isStale,
        rates: updatedRates,
        tr: updatedRates.TRY,
        en: updatedRates.USD,
        de: updatedRates.EUR,
        fr: updatedRates.EUR,
        it: updatedRates.EUR,
      }

      setCurrencyConfig(newConfig)
      await saveCurrencyConfig(newConfig)

      alert(`✅ TCMB Kurları Başarıyla Senkronize Edildi!\nBülten Tarihi: ${tcmb.date}\nUSD Satış: ${tcmb.rates.USD.selling.toFixed(4)} ₺\nEUR Satış: ${tcmb.rates.EUR.selling.toFixed(4)} ₺\nGBP Satış: ${tcmb.rates.GBP.selling.toFixed(4)} ₺`)
    } catch (error: any) {
      console.error('TCMB sync error:', error)
      alert(`⚠️ TCMB senkronizasyon hatası: ${error.message}`)
    } finally {
      setSyncingTCMB(false)
    }
  }

  const updateSetting = (key: keyof SiteSettings, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const updateSocialMedia = (platform: keyof SiteSettings['socialMedia'], value: string) => {
    setSettings((prev) => ({
      ...prev,
      socialMedia: {
        ...prev.socialMedia,
        [platform]: value,
      },
    }))
  }

  const updateRate = (curr: SupportedCurrency, field: string, value: any) => {
    setCurrencyConfig((prev) => {
      const currentRate = prev.rates[curr]
      let newRate = { ...currentRate, [field]: value }

      // If user updates sellingTRY (e.g. 47.897), recalculate rate multiplier
      if (field === 'sellingTRY') {
        const num = parseFloat(value) || 1
        newRate.rate = num > 0 ? 1 / num : 1
      }

      const updatedRates = {
        ...prev.rates,
        [curr]: newRate,
      }

      return {
        ...prev,
        rates: updatedRates,
        tr: updatedRates.TRY,
        en: updatedRates.USD,
        de: updatedRates.EUR,
        fr: updatedRates.EUR,
        it: updatedRates.EUR,
      }
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Site Ayarları & TCMB Kurları</h1>
          <p className="text-gray-600 mt-1">
            Site genel bilgileri ve TCMB otomatik döviz kuru entegrasyonu
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'general'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiGlobe className="w-4 h-4" />
          Genel Ayarlar
        </button>

        <button
          onClick={() => setActiveTab('payment')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'payment'
              ? 'border-sky-600 text-sky-600 bg-sky-50/50'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <FiCreditCard className="w-4 h-4 text-sky-600" />
          <span>Ödeme & Havale / EFT Yönetimi</span>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
            legalConfig.bankTransfer?.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
          }`}>
            {legalConfig.bankTransfer?.enabled ? 'Havale Aktif' : 'Kart'}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('currency')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'currency'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiDollarSign className="w-4 h-4" />
          TCMB Döviz Kurları (TRY, USD, EUR, GBP)
        </button>

        <button
          onClick={() => setActiveTab('legal')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'legal'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FiFileText className="w-4 h-4" />
          Yasal & Sözleşmeler (6502 & KVKK)
        </button>

        <button
          onClick={() => setActiveTab('hepsijet')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'hepsijet'
              ? 'border-orange-500 text-orange-600 bg-orange-50/50'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <FiTruck className="w-4 h-4 text-orange-500" />
          <span>HepsiJET Kargo Entegrasyonu</span>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
            Konya Depo
          </span>
        </button>

        <button
          onClick={() => setActiveTab('print_agent')}
          className={`flex items-center gap-2 px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-colors ${
            activeTab === 'print_agent'
              ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <FiPrinter className="w-4 h-4 text-indigo-600" />
          <span>Windows Print Agent Yönetimi</span>
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
            PALMX TXP-400
          </span>
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-6">
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Genel Bilgiler</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Site Adı
                  </label>
                  <input
                    type="text"
                    value={settings.siteName}
                    onChange={(e) => updateSetting('siteName', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Site Açıklaması
                  </label>
                  <input
                    type="text"
                    value={settings.siteDescription}
                    onChange={(e) => updateSetting('siteDescription', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">İletişim Bilgileri</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-posta
                  </label>
                  <input
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) => updateSetting('contactEmail', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefon
                  </label>
                  <input
                    type="tel"
                    value={settings.contactPhone}
                    onChange={(e) => updateSetting('contactPhone', e.target.value)}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Adres
                  </label>
                  <textarea
                    value={settings.address}
                    onChange={(e) => updateSetting('address', e.target.value)}
                    rows={3}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-900 mb-4">Sosyal Medya</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Facebook
                  </label>
                  <input
                    type="url"
                    value={settings.socialMedia.facebook || ''}
                    onChange={(e) => updateSocialMedia('facebook', e.target.value)}
                    placeholder="https://facebook.com/..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Instagram
                  </label>
                  <input
                    type="url"
                    value={settings.socialMedia.instagram || ''}
                    onChange={(e) => updateSocialMedia('instagram', e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Twitter (X)
                  </label>
                  <input
                    type="url"
                    value={settings.socialMedia.twitter || ''}
                    onChange={(e) => updateSocialMedia('twitter', e.target.value)}
                    placeholder="https://twitter.com/..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ÖDEME YÖNTEMLERİ & HAVALE / EFT YÖNETİM PANELİ                             */}
        {/* ========================================================================= */}
        {activeTab === 'payment' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header & Save Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Ödeme Yöntemleri & Havale / EFT Yönetimi</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Havale / EFT ile ödeme seçeneğini tek tıkla açıp kapatabilir, banka IBAN bilgilerinizi güncelleyebilir ve logoları yönetebilirsiniz.
                </p>
              </div>

              <motion.button
                onClick={handleSaveLegal}
                disabled={savingLegal}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/30 flex-shrink-0 disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                <span>{savingLegal ? 'Kaydediliyor...' : 'Ödeme Ayarlarını Kaydet'}</span>
              </motion.button>
            </div>

            {/* SECTION 1: HAVALE / EFT ON/OFF TOGGLE & BANK DETAILS */}
            <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base sm:text-lg font-black text-slate-900">Havale / EFT ile Ödeme Durumu</span>
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                      legalConfig.bankTransfer?.enabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {legalConfig.bankTransfer?.enabled ? '🟢 Müşterilere Açık (Aktif)' : '🔴 Kapalı (Yalnızca Kart)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Bu anahtar açık olduğunda satın alma ekranında kredi kartına ek olarak Havale/EFT sekmesi gösterilir. Kapalı olduğunda müşteriler yalnızca PayTR 3D Secure ile kartla ödeyebilir.
                  </p>
                </div>

                {/* Big Switch */}
                <label className="flex items-center gap-3 cursor-pointer bg-white px-5 py-3 rounded-2xl border-2 border-sky-600 shadow-md flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={legalConfig.bankTransfer?.enabled ?? false}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      bankTransfer: {
                        ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                        enabled: e.target.checked,
                      },
                    })}
                    className="w-6 h-6 text-sky-600 rounded cursor-pointer"
                  />
                  <span className="text-sm font-black text-slate-900 select-none">
                    {legalConfig.bankTransfer?.enabled ? 'HAVALE/EFT AKTİF' : 'HAVALE/EFT KAPALI'}
                  </span>
                </label>
              </div>

              {/* Bank Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Banka Adı
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Garanti BBVA, Ziraat Bankası"
                    value={legalConfig.bankTransfer?.bankName || ''}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      bankTransfer: {
                        ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                        bankName: e.target.value,
                      },
                    })}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Hesap Sahibi (Unvan / Şirket Adı)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Gülümse Dental Tic. Ltd. Şti."
                    value={legalConfig.bankTransfer?.accountHolder || ''}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      bankTransfer: {
                        ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                        accountHolder: e.target.value,
                      },
                    })}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    IBAN Numarası (TR...)
                  </label>
                  <input
                    type="text"
                    placeholder="TR00 0000 0000 0000 0000 0000 00"
                    value={legalConfig.bankTransfer?.iban || ''}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      bankTransfer: {
                        ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                        iban: e.target.value,
                      },
                    })}
                    className="w-full px-4 py-3 bg-white rounded-xl border border-slate-300 text-sm font-mono font-black text-slate-900 tracking-wider focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Şube / Şube Kodu (Opsiyonel)
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Maslak Ticari Şube (1234)"
                    value={legalConfig.bankTransfer?.branchCode || ''}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      bankTransfer: {
                        ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                        branchCode: e.target.value,
                      },
                    })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Müşteri Havale Talimatı / Açıklama Notu
                  </label>
                  <input
                    type="text"
                    placeholder="Örn: Açıklamaya Ad-Soyad ve Sipariş Numaranızı yazınız."
                    value={legalConfig.bankTransfer?.description || ''}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      bankTransfer: {
                        ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                        description: e.target.value,
                      },
                    })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 2: PAYMENT & SECURITY BADGES */}
            <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900">Ödeme & Güvenlik Rozetleri (PayTR, Mastercard, Visa vb.)</h3>
                  <p className="text-xs text-slate-500">
                    Footer ve Satın Alma ekranında görüntülenecek güven rozetlerini yönetin.
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={legalConfig.paymentBadges?.showInFooter ?? true}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        paymentBadges: {
                          ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                          showInFooter: e.target.checked,
                        },
                      })}
                      className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                    />
                    <span>Footer&apos;da Göster</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700">
                    <input
                      type="checkbox"
                      checked={legalConfig.paymentBadges?.showInCheckout ?? true}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        paymentBadges: {
                          ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                          showInCheckout: e.target.checked,
                        },
                      })}
                      className="w-4 h-4 text-sky-600 rounded cursor-pointer"
                    />
                    <span>Satın Almada Göster</span>
                  </label>
                </div>
              </div>

              {/* Badges Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items).map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      badge.active ? 'bg-white border-slate-300 shadow-xs' : 'bg-slate-100/70 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-12 h-10 rounded-xl bg-slate-900 flex items-center justify-center p-1 border border-slate-800 flex-shrink-0">
                        {badge.logoUrl ? (
                          <img src={badge.logoUrl} alt={badge.name} className="h-6 max-w-full object-contain" />
                        ) : (
                          <span className={`text-[11px] font-black ${badge.color || 'text-sky-400'}`}>
                            {badge.badgeText || badge.name}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{badge.name}</p>
                        <span className="text-[10px] text-slate-500">{badge.badgeText || (badge.logoUrl ? 'Görsel Logo' : 'Yazı Rozeti')}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={badge.active}
                          onChange={(e) => {
                            const list = (legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items).map((b) =>
                              b.id === badge.id ? { ...b, active: e.target.checked } : b
                            )
                            setLegalConfig({
                              ...legalConfig,
                              paymentBadges: {
                                ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                                items: list,
                              },
                            })
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                      </label>

                      {!badge.isPreset && (
                        <button
                          type="button"
                          onClick={() => {
                            const list = (legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items).filter((b) => b.id !== badge.id)
                            setLegalConfig({
                              ...legalConfig,
                              paymentBadges: {
                                ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                                items: list,
                              },
                            })
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <FiTrash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Upload / Add Custom Badge */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <FiPlus className="w-4 h-4 text-sky-600" />
                  Yeni Ödeme & Güvenlik Logosu Yükle (Firebase Storage)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <input
                      type="text"
                      placeholder="Rozet Adı (Örn: Bonus, World)"
                      value={newBadge.name}
                      onChange={(e) => setNewBadge({ ...newBadge, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="w-full px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-600 cursor-pointer flex items-center justify-center gap-2 transition-colors">
                      <FiUploadCloud className="w-4 h-4 text-sky-600" />
                      <span>{uploadingBadge ? 'Yükleniyor...' : 'Logo Görseli Seç'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        disabled={!!uploadingBadge}
                        onChange={async (e) => {
                          const file = e.target.files?.[0]
                          if (!file) return
                          setUploadingBadge('new')
                          try {
                            const url = await uploadImage(file, 'payment-badges')
                            const newItem: PaymentTrustBadgeItem = {
                              id: `custom_${Date.now()}`,
                              name: newBadge.name || file.name.split('.')[0],
                              logoUrl: url,
                              active: true,
                              isPreset: false,
                            }
                            const list = [...(legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items), newItem]
                            setLegalConfig({
                              ...legalConfig,
                              paymentBadges: {
                                ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                                items: list,
                              },
                            })
                            setNewBadge({ name: '', badgeText: '', color: 'text-sky-400' })
                            alert('✅ Logo Firebase Storage\'a başarıyla yüklendi!')
                          } catch (err: any) {
                            alert(`❌ Görsel yükleme hatası: ${err.message}`)
                          } finally {
                            setUploadingBadge(null)
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!newBadge.name) {
                          alert('Lütfen rozet adı girin.')
                          return
                        }
                        const newItem: PaymentTrustBadgeItem = {
                          id: `custom_${Date.now()}`,
                          name: newBadge.name,
                          badgeText: newBadge.badgeText || newBadge.name,
                          active: true,
                          isPreset: false,
                          color: 'text-sky-400',
                        }
                        const list = [...(legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items), newItem]
                        setLegalConfig({
                          ...legalConfig,
                          paymentBadges: {
                            ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                            items: list,
                          },
                        })
                        setNewBadge({ name: '', badgeText: '', color: 'text-sky-400' })
                      }}
                      className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FiPlus className="w-4 h-4" />
                      <span>Yazı Rozeti Olarak Ekle</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Save Action */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
              <motion.button
                onClick={handleSaveLegal}
                disabled={savingLegal}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                <span>{savingLegal ? 'Kaydediliyor...' : 'Ödeme Ayarlarını Kaydet'}</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* TCMB DÖVİZ KURLARI YÖNETİM PANELİ                                        */}
        {/* ========================================================================= */}
        {activeTab === 'currency' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Status & Sync Bar */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      TCMB Canlı Kur Bağlantısı Aktif
                    </span>
                    <span className="text-xs font-bold text-slate-400">
                      Kaynak: {currencyConfig.source || 'TCMB'}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    TCMB Otomatik Gösterge Kurları
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
                    Ürünlerin ana fiyatı <span className="text-emerald-400 font-bold">TRY (₺)</span> olarak saklanır. Kullanıcı USD, EUR veya GBP seçtiğinde fiyatlar TCMB'nin resmi günlük satış kuruyla (ForexSelling) otomatik dönüştürülür.
                  </p>

                  <div className="flex flex-wrap gap-4 mt-4 text-xs font-semibold text-slate-300">
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                      📅 TCMB Bülten Tarihi: <strong className="text-white ml-1">{currencyConfig.rateDate || 'Güncel'}</strong>
                    </div>
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                      📄 Bülten No: <strong className="text-white ml-1">{currencyConfig.bultenNo || '2026/152'}</strong>
                    </div>
                    <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/10">
                      ⏱️ Son Senkronizasyon: <strong className="text-white ml-1">{new Date(currencyConfig.updatedAt).toLocaleTimeString('tr-TR')}</strong>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    onClick={handleSyncTCMB}
                    disabled={syncingTCMB}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-xl text-sm shadow-lg shadow-emerald-500/25 transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
                  >
                    <FiRefreshCw className={`w-4 h-4 ${syncingTCMB ? 'animate-spin' : ''}`} />
                    {syncingTCMB ? 'TCMB Kurları Alınıyor...' : 'TCMB Kurlarını Şimdi Güncelle'}
                  </button>
                </div>
              </div>
            </div>

            {/* Mode Switcher: Auto TCMB vs Manual */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-primary-600 shadow-2xs">
                  {currencyConfig.mode === 'auto' ? <FiCpu className="w-6 h-6 text-emerald-600" /> : <FiEdit3 className="w-6 h-6 text-amber-600" />}
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Kur Güncelleme Modu: {currencyConfig.mode === 'auto' ? '🤖 Otomatik (TCMB Günlük XML)' : '✍️ Manuel Giriş'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currencyConfig.mode === 'auto'
                      ? 'Kurlar her gün TCMB resmi XML verisinden otomatik güncellenir.'
                      : 'Kurları aşağıdaki kutulardan manuel olarak kendiniz belirlersiniz.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  onClick={() => setCurrencyConfig((prev) => ({ ...prev, mode: 'auto' }))}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                    currencyConfig.mode === 'auto'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Otomatik (TCMB)
                </button>
                <button
                  onClick={() => setCurrencyConfig((prev) => ({ ...prev, mode: 'manual' }))}
                  className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                    currencyConfig.mode === 'manual'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Manuel Mod
                </button>
              </div>
            </div>

            {/* Currency Rates Grid (TRY, USD, EUR, GBP) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Desteklenen Para Birimleri & TCMB Kurları</span>
                </h3>
                <span className="text-xs text-slate-400 font-semibold">
                  Hesaplama Formülü: <code className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-bold">Fiyat (TRY) / TCMB Satış Kuru</code>
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {/* 1. TRY */}
                <div className="bg-red-50/40 rounded-2xl border-2 border-red-200/80 p-5 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🇹🇷</span>
                      <div>
                        <h4 className="text-base font-black text-slate-900">TRY</h4>
                        <span className="text-[10px] uppercase font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                          Baz Para Birimi
                        </span>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-red-600">₺</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Kur Değeri</label>
                    <div className="px-3.5 py-2.5 bg-white border border-red-200 rounded-xl font-black text-base text-slate-800">
                      1.0000 ₺ (Sabit Baz)
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Etiket</label>
                    <input
                      type="text"
                      value={currencyConfig.rates.TRY.label}
                      onChange={(e) => updateRate('TRY', 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-red-400"
                    />
                  </div>
                </div>

                {/* 2. USD */}
                <div className="bg-sky-50/40 rounded-2xl border-2 border-sky-200/80 p-5 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🇺🇸</span>
                      <div>
                        <h4 className="text-base font-black text-slate-900">USD</h4>
                        <span className="text-[10px] uppercase font-bold text-sky-600 bg-sky-100 px-2 py-0.5 rounded-full">
                          TCMB: ABD DOLARI
                        </span>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-sky-600">$</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      1 USD = Kaç TRY? (Satış Kuru)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      disabled={currencyConfig.mode === 'auto'}
                      value={currencyConfig.rates.USD.sellingTRY || (1 / (currencyConfig.rates.USD.rate || 0.02088))}
                      onChange={(e) => updateRate('USD', 'sellingTRY', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-sky-300 rounded-xl font-black text-base text-slate-900 focus:ring-2 focus:ring-sky-500 disabled:bg-slate-50 disabled:text-slate-700"
                    />
                    <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                      1 TRY = {(currencyConfig.rates.USD.rate || 0.02088).toFixed(5)} $
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Etiket</label>
                    <input
                      type="text"
                      value={currencyConfig.rates.USD.label}
                      onChange={(e) => updateRate('USD', 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-sky-400"
                    />
                  </div>
                </div>

                {/* 3. EUR */}
                <div className="bg-emerald-50/40 rounded-2xl border-2 border-emerald-200/80 p-5 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🇪🇺</span>
                      <div>
                        <h4 className="text-base font-black text-slate-900">EUR</h4>
                        <span className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                          TCMB: EURO
                        </span>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-emerald-600">€</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      1 EUR = Kaç TRY? (Satış Kuru)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      disabled={currencyConfig.mode === 'auto'}
                      value={currencyConfig.rates.EUR.sellingTRY || (1 / (currencyConfig.rates.EUR.rate || 0.018))}
                      onChange={(e) => updateRate('EUR', 'sellingTRY', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-emerald-300 rounded-xl font-black text-base text-slate-900 focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50 disabled:text-slate-700"
                    />
                    <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                      1 TRY = {(currencyConfig.rates.EUR.rate || 0.018).toFixed(5)} €
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Etiket</label>
                    <input
                      type="text"
                      value={currencyConfig.rates.EUR.label}
                      onChange={(e) => updateRate('EUR', 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>
                </div>

                {/* 4. GBP */}
                <div className="bg-purple-50/40 rounded-2xl border-2 border-purple-200/80 p-5 space-y-3.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🇬🇧</span>
                      <div>
                        <h4 className="text-base font-black text-slate-900">GBP</h4>
                        <span className="text-[10px] uppercase font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
                          TCMB: İNGİLİZ STERLİNİ
                        </span>
                      </div>
                    </div>
                    <span className="text-2xl font-black text-purple-600">£</span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      1 GBP = Kaç TRY? (Satış Kuru)
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      disabled={currencyConfig.mode === 'auto'}
                      value={currencyConfig.rates.GBP.sellingTRY || (1 / (currencyConfig.rates.GBP.rate || 0.0155))}
                      onChange={(e) => updateRate('GBP', 'sellingTRY', e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border-2 border-purple-300 rounded-xl font-black text-base text-slate-900 focus:ring-2 focus:ring-purple-500 disabled:bg-slate-50 disabled:text-slate-700"
                    />
                    <span className="text-[10px] text-slate-400 font-semibold block mt-1">
                      1 TRY = {(currencyConfig.rates.GBP.rate || 0.0155).toFixed(5)} £
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">Etiket</label>
                    <input
                      type="text"
                      value={currencyConfig.rates.GBP.label}
                      onChange={(e) => updateRate('GBP', 'label', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Currency Preview Box */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-slate-200 flex items-center gap-2">
                  <FiDollarSign className="w-5 h-5 text-emerald-400" />
                  Canlı Fiyat Dönüşüm Önizlemesi — Örnek Ürün: 1.000,00 ₺
                </h3>
                <span className="text-xs text-emerald-400 font-bold">
                  İnt’l Formatter: Aktif
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">🇹🇷 TRY (Türk Lirası)</span>
                  <span className="text-xl sm:text-2xl font-black text-white">
                    {formatMoney(1000, 'TRY')}
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">🇺🇸 USD (US Dollar)</span>
                  <span className="text-xl sm:text-2xl font-black text-sky-400">
                    {formatMoney(
                      currencyConfig.rates.USD.sellingTRY
                        ? 1000 / currencyConfig.rates.USD.sellingTRY
                        : 1000 * (currencyConfig.rates.USD.rate || 0.02088),
                      'USD',
                      'en-US'
                    )}
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">🇪🇺 EUR (Euro)</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-400">
                    {formatMoney(
                      currencyConfig.rates.EUR.sellingTRY
                        ? 1000 / currencyConfig.rates.EUR.sellingTRY
                        : 1000 * (currencyConfig.rates.EUR.rate || 0.018),
                      'EUR',
                      'de-DE'
                    )}
                  </span>
                </div>

                <div className="bg-white/10 rounded-xl p-4 border border-white/10">
                  <span className="text-xs text-slate-400 block mb-1">🇬🇧 GBP (British Pound)</span>
                  <span className="text-xl sm:text-2xl font-black text-purple-400">
                    {formatMoney(
                      currencyConfig.rates.GBP.sellingTRY
                        ? 1000 / currencyConfig.rates.GBP.sellingTRY
                        : 1000 * (currencyConfig.rates.GBP.rate || 0.0155),
                      'GBP',
                      'en-GB'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="flex flex-wrap gap-4 pt-4 border-t border-gray-100">
              <motion.button
                onClick={handleSaveCurrency}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={savingCurrency}
                className="flex items-center gap-2 px-7 py-3.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/25 disabled:opacity-50"
              >
                <FiSave className="w-5 h-5" />
                {savingCurrency ? 'Kaydediliyor...' : 'Kur Ayarlarını Kaydet'}
              </motion.button>

              <button
                onClick={() => setCurrencyConfig(DEFAULT_CURRENCY_CONFIG)}
                className="flex items-center gap-2 px-6 py-3.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                <FiRefreshCw className="w-4 h-4" />
                Varsayılana Sıfırla
              </button>
            </div>
          </motion.div>
        )}

        {/* 3. LEGAL & POLICIES TAB (6502 SAYILI KANUN & KVKK) */}
        {activeTab === 'legal' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Top Info Banner */}
            <div className="p-4 bg-gradient-to-r from-sky-900 to-indigo-950 text-white rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400 flex-shrink-0">
                  <FiShield className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-sky-300">Yasal Şartlar, Sözleşmeler & Firma Bilgileri</h2>
                  <p className="text-xs text-slate-300">
                    6502 Sayılı Tüketici Kanunu, Mesafeli Sözleşmeler Yönetmeliği, KVKK ve PayTR denetim standartlarına uygun sözleşmeler.
                  </p>
                </div>
              </div>

              <motion.button
                onClick={handleSaveLegal}
                disabled={savingLegal}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/30 flex-shrink-0 disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                <span>{savingLegal ? 'Kaydediliyor...' : 'Tümünü Kaydet'}</span>
              </motion.button>
            </div>

            {/* Legal Sub-Navigation */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
              {[
                { id: 'company', label: '1. Satıcı & Firma Bilgileri', icon: FiShield },
                { id: 'return', label: '2. İptal ve İade Koşulları', icon: FiRefreshCw },
                { id: 'shipping', label: '3. Teslimat & Kargo Koşulları', icon: FiTruck },
                { id: 'distance', label: '4. Mesafeli Satış Sözleşmesi', icon: FiFileText },
                { id: 'preliminary', label: '5. Ön Bilgilendirme Formu', icon: FiFileText },
                { id: 'privacy', label: '6. Gizlilik & Güvenlik Politikası', icon: FiShield },
                { id: 'kvkk', label: '7. KVKK Aydınlatma Metni', icon: FiShield },
                { id: 'badges', label: '8. Ödeme & Güvenlik Logoları', icon: FiCreditCard },
                { id: 'bankTransfer', label: '9. Havale & EFT Yönetimi (Opsiyonel)', icon: FiDollarSign },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveLegalSubTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    activeLegalSubTab === tab.id
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Sub-Tab 1: Satıcı & Firma Yasal Bilgileri */}
            {activeLegalSubTab === 'company' && (
              <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">Satıcı & Firma Yasal Bilgileri (6502 Sayılı Kanun Gereği)</h3>
                  <p className="text-xs text-slate-500">
                    Bu bilgiler sipariş ekranının altındaki yasal künyede, faturalarda, fiş çıktılarında ve sözleşmelerde otomatik gösterilir.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Firma Resmi Unvanı <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={legalConfig.company.title}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        company: { ...legalConfig.company, title: e.target.value },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Firma Açık Adresi <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={legalConfig.company.address}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        company: { ...legalConfig.company, address: e.target.value },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-medium text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      MERSİS Numarası <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={legalConfig.company.mersis}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        company: { ...legalConfig.company, mersis: e.target.value },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-mono font-medium text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Vergi Dairesi
                      </label>
                      <input
                        type="text"
                        value={legalConfig.company.taxOffice}
                        onChange={(e) => setLegalConfig({
                          ...legalConfig,
                          company: { ...legalConfig.company, taxOffice: e.target.value },
                        })}
                        className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                        Vergi No
                      </label>
                      <input
                        type="text"
                        value={legalConfig.company.taxNumber}
                        onChange={(e) => setLegalConfig({
                          ...legalConfig,
                          company: { ...legalConfig.company, taxNumber: e.target.value },
                        })}
                        className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Müşteri Hizmetleri Telefonu <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={legalConfig.company.phone}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        company: { ...legalConfig.company, phone: e.target.value },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Resmi İletişim E-Posta <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={legalConfig.company.email}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        company: { ...legalConfig.company, email: e.target.value },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      KEP Adresi (Kayıtlı Elektronik Posta)
                    </label>
                    <input
                      type="text"
                      value={legalConfig.company.kepAddress || ''}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        company: { ...legalConfig.company, kepAddress: e.target.value },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 2: Mesafeli Satış Sözleşmesi */}
            {activeLegalSubTab === 'distance' && (
              <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Mesafeli Satış Sözleşmesi Metni</h3>
                    <p className="text-xs text-slate-500">Müşterilerin ödeme öncesinde onayladığı ve /mesafeli-satis-sozlesmesi sayfasındaki metin.</p>
                  </div>
                  <span className="text-xs text-slate-400">Son Güncelleme: {legalConfig.distanceSalesAgreement.updatedAt}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Sözleşme Başlığı</label>
                  <input
                    type="text"
                    value={legalConfig.distanceSalesAgreement.title}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      distanceSalesAgreement: { ...legalConfig.distanceSalesAgreement, title: e.target.value },
                    })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Sözleşme Tam Metni / Maddeleri</label>
                  <textarea
                    rows={14}
                    value={legalConfig.distanceSalesAgreement.content}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      distanceSalesAgreement: { ...legalConfig.distanceSalesAgreement, content: e.target.value },
                    })}
                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 text-xs sm:text-sm font-mono leading-relaxed text-slate-800 focus:outline-none focus:border-sky-500 resize-y"
                  />
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Ön Bilgilendirme Formu */}
            {activeLegalSubTab === 'preliminary' && (
              <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Ön Bilgilendirme Koşulları Formu</h3>
                    <p className="text-xs text-slate-500">6502 Sayılı Kanun gereği zorunlu ön bilgilendirme metni.</p>
                  </div>
                  <span className="text-xs text-slate-400">Son Güncelleme: {legalConfig.preliminaryInfoForm.updatedAt}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Form Başlığı</label>
                  <input
                    type="text"
                    value={legalConfig.preliminaryInfoForm.title}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      preliminaryInfoForm: { ...legalConfig.preliminaryInfoForm, title: e.target.value },
                    })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Form Metni</label>
                  <textarea
                    rows={14}
                    value={legalConfig.preliminaryInfoForm.content}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      preliminaryInfoForm: { ...legalConfig.preliminaryInfoForm, content: e.target.value },
                    })}
                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 text-xs sm:text-sm font-mono leading-relaxed text-slate-800 focus:outline-none focus:border-sky-500 resize-y"
                  />
                </div>
              </div>
            )}

            {/* Sub-Tab 4: KVKK Aydınlatma Metni */}
            {activeLegalSubTab === 'kvkk' && (
              <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">KVKK Aydınlatma Metni ve Veri Politikası</h3>
                    <p className="text-xs text-slate-500">6698 Sayılı Kişisel Verilerin Korunması Kanunu aydınlatma metni.</p>
                  </div>
                  <span className="text-xs text-slate-400">Son Güncelleme: {legalConfig.kvkkPolicy.updatedAt}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Politika Başlığı</label>
                  <input
                    type="text"
                    value={legalConfig.kvkkPolicy.title}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      kvkkPolicy: { ...legalConfig.kvkkPolicy, title: e.target.value },
                    })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">KVKK Metni</label>
                  <textarea
                    rows={14}
                    value={legalConfig.kvkkPolicy.content}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      kvkkPolicy: { ...legalConfig.kvkkPolicy, content: e.target.value },
                    })}
                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 text-xs sm:text-sm font-mono leading-relaxed text-slate-800 focus:outline-none focus:border-sky-500 resize-y"
                  />
                </div>
              </div>
            )}

            {/* Sub-Tab 5: Gizlilik ve Güvenlik */}
            {activeLegalSubTab === 'privacy' && (
              <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Gizlilik ve Güvenlik Politikası</h3>
                    <p className="text-xs text-slate-500">256-Bit SSL, 3D Secure, PCI-DSS ve çerez güvenlik şartları.</p>
                  </div>
                  <span className="text-xs text-slate-400">Son Güncelleme: {legalConfig.privacyAndSecurity.updatedAt}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Politika Başlığı</label>
                  <input
                    type="text"
                    value={legalConfig.privacyAndSecurity.title}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      privacyAndSecurity: { ...legalConfig.privacyAndSecurity, title: e.target.value },
                    })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Politika Metni</label>
                  <textarea
                    rows={14}
                    value={legalConfig.privacyAndSecurity.content}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      privacyAndSecurity: { ...legalConfig.privacyAndSecurity, content: e.target.value },
                    })}
                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 text-xs sm:text-sm font-mono leading-relaxed text-slate-800 focus:outline-none focus:border-sky-500 resize-y"
                  />
                </div>
              </div>
            )}

            {/* Sub-Tab 6: İptal ve İade Politikası */}
            {activeLegalSubTab === 'return' && (
              <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">İptal ve İade Koşulları Politikası</h3>
                    <p className="text-xs text-slate-500">6502 Sayılı Kanun Madde 15/ç hijyen istisnası ve 14 gün cayma hakkı koşulları (/iptal sayfası).</p>
                  </div>
                  <span className="text-xs text-slate-400">Son Güncelleme: {legalConfig.cancellationAndReturn?.updatedAt || '20 Ağustos 2026'}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Politika Başlığı</label>
                  <input
                    type="text"
                    value={legalConfig.cancellationAndReturn?.title || ''}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      cancellationAndReturn: {
                        ...(legalConfig.cancellationAndReturn || DEFAULT_LEGAL_CONFIG.cancellationAndReturn),
                        title: e.target.value,
                      },
                    })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">İptal & İade Şartları Metni</label>
                  <textarea
                    rows={14}
                    value={legalConfig.cancellationAndReturn?.content || ''}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      cancellationAndReturn: {
                        ...(legalConfig.cancellationAndReturn || DEFAULT_LEGAL_CONFIG.cancellationAndReturn),
                        content: e.target.value,
                      },
                    })}
                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 text-xs sm:text-sm font-mono leading-relaxed text-slate-800 focus:outline-none focus:border-sky-500 resize-y"
                  />
                </div>
              </div>
            )}

            {/* Sub-Tab 3: Teslimat ve Kargo Koşulları */}
            {activeLegalSubTab === 'shipping' && (
              <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Teslimat ve Kargo Koşulları Politikası</h3>
                    <p className="text-xs text-slate-500">Teslimat süreleri, kargo firmaları, hasarlı kargo tutanağı ve gönderim şartları (/kargo sayfası).</p>
                  </div>
                  <span className="text-xs text-slate-400">Son Güncelleme: {legalConfig.deliveryAndShipping?.updatedAt || '03 Eylül 2026'}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Politika Başlığı</label>
                  <input
                    type="text"
                    value={legalConfig.deliveryAndShipping?.title || ''}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      deliveryAndShipping: {
                        ...(legalConfig.deliveryAndShipping || DEFAULT_LEGAL_CONFIG.deliveryAndShipping),
                        title: e.target.value,
                      },
                    })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">Teslimat & Kargo Şartları Metni</label>
                  <textarea
                    rows={14}
                    value={legalConfig.deliveryAndShipping?.content || ''}
                    onChange={(e) => setLegalConfig({
                      ...legalConfig,
                      deliveryAndShipping: {
                        ...(legalConfig.deliveryAndShipping || DEFAULT_LEGAL_CONFIG.deliveryAndShipping),
                        content: e.target.value,
                      },
                    })}
                    className="w-full p-4 bg-white rounded-2xl border border-slate-200 text-xs sm:text-sm font-mono leading-relaxed text-slate-800 focus:outline-none focus:border-sky-500 resize-y"
                  />
                </div>
              </div>
            )}

            {/* Sub-Tab 8: Ödeme & Güvenlik Logoları (PayTR, Mastercard, Visa, Troy vb.) */}
            {activeLegalSubTab === 'badges' && (
              <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Ödeme ve Güvenlik Güven Rozetleri (İyzico, Mastercard, Visa vb.)</h3>
                  <p className="text-xs text-slate-500">
                    Sitenin alt kısmında (Footer), sipariş ekranında ve güven barlarında görünen lisanslı ödeme ve güvenlik logoları.
                  </p>
                </div>

                {/* Display Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-white rounded-2xl border border-slate-200">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={legalConfig.paymentBadges?.showInFooter ?? true}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        paymentBadges: {
                          ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                          showInFooter: e.target.checked,
                        },
                      })}
                      className="w-4 h-4 text-sky-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">Footer (Alt Bilgi) Alanında Göster</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={legalConfig.paymentBadges?.showInCheckout ?? true}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        paymentBadges: {
                          ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                          showInCheckout: e.target.checked,
                        },
                      })}
                      className="w-4 h-4 text-sky-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">Satın Al / Ödeme Ekranında Göster</span>
                  </label>
                </div>

                {/* Badges List */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                    Aktif Güven ve Ödeme Rozetleri ({legalConfig.paymentBadges?.items?.length || 0})
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items).map((badge, idx) => (
                      <div
                        key={badge.id}
                        className={`p-3.5 bg-white rounded-2xl border transition-all ${
                          badge.active ? 'border-slate-300 shadow-xs' : 'border-dashed border-slate-200 opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={badge.active}
                              onChange={(e) => {
                                const list = [...(legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items)]
                                list[idx] = { ...list[idx], active: e.target.checked }
                                setLegalConfig({
                                  ...legalConfig,
                                  paymentBadges: {
                                    ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                                    items: list,
                                  },
                                })
                              }}
                              className="w-4 h-4 text-sky-600 rounded"
                            />
                            <span className="text-xs font-black text-slate-800 line-clamp-1">{badge.name}</span>
                          </div>

                          {!badge.isPreset && (
                            <button
                              type="button"
                              onClick={() => {
                                const list = (legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items).filter((_, i) => i !== idx)
                                setLegalConfig({
                                  ...legalConfig,
                                  paymentBadges: {
                                    ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                                    items: list,
                                  },
                                })
                              }}
                              className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Logo Preview / Upload */}
                        <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                          {badge.logoUrl ? (
                            <div className="w-16 h-8 bg-slate-900 rounded-lg p-1 flex items-center justify-center overflow-hidden border border-slate-700">
                              <img src={badge.logoUrl} alt={badge.name} className="max-h-full max-w-full object-contain" />
                            </div>
                          ) : (
                            <div className="px-2.5 py-1 bg-slate-900 rounded-lg text-slate-200 text-[11px] font-bold border border-slate-800">
                              {badge.badgeText || badge.name}
                            </div>
                          )}

                          <label className="cursor-pointer text-[11px] font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1">
                            <FiUploadCloud className="w-3.5 h-3.5" />
                            <span>{uploadingBadge === badge.id ? 'Yükleniyor...' : 'Özel Logo Yükle'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                try {
                                  setUploadingBadge(badge.id)
                                  const url = await uploadImage(file, 'badges')
                                  const list = [...(legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items)]
                                  list[idx] = { ...list[idx], logoUrl: url }
                                  setLegalConfig({
                                    ...legalConfig,
                                    paymentBadges: {
                                      ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                                      items: list,
                                    },
                                  })
                                } catch (err: any) {
                                  alert(`Resim yüklenemedi: ${err.message || 'Hata'}`)
                                } finally {
                                  setUploadingBadge(null)
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add New Custom Badge */}
                <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <FiPlus className="w-4 h-4 text-sky-600" />
                    Yeni Güven / Ödeme Rozeti Ekle
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Logo / Rozet Adı (Örn: BKM Express)"
                      value={newBadge.name}
                      onChange={(e) => setNewBadge({ ...newBadge, name: e.target.value })}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                    <input
                      type="text"
                      placeholder="Görünecek Metin (Örn: BKM)"
                      value={newBadge.badgeText}
                      onChange={(e) => setNewBadge({ ...newBadge, badgeText: e.target.value })}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newBadge.name.trim()) {
                          alert('Lütfen rozet adını girin.')
                          return
                        }
                        const newItem: PaymentTrustBadgeItem = {
                          id: `badge_${Date.now()}`,
                          name: newBadge.name.trim(),
                          badgeText: newBadge.badgeText.trim() || newBadge.name.trim(),
                          active: true,
                          isPreset: false,
                          color: 'text-sky-400',
                        }
                        const list = [...(legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items), newItem]
                        setLegalConfig({
                          ...legalConfig,
                          paymentBadges: {
                            ...(legalConfig.paymentBadges || DEFAULT_LEGAL_CONFIG.paymentBadges),
                            items: list,
                          },
                        })
                        setNewBadge({ name: '', badgeText: '', color: 'text-sky-400' })
                      }}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                    >
                      <FiPlus className="w-4 h-4" />
                      <span>Rozeti Ekle</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-Tab 8: Havale / EFT Ödeme Yönetimi (Opsiyonel) */}
            {activeLegalSubTab === 'bankTransfer' && (
              <div className="bg-slate-50/70 p-6 rounded-2xl border border-slate-200 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Havale / EFT ile Ödeme Yönetimi</h3>
                    <p className="text-xs text-slate-500">
                      Müşterilerinize satın alma ekranında banka transferi seçeneği sunmak istiyorsanız buradan açıp IBAN bilgilerini yönetebilirsiniz.
                    </p>
                  </div>

                  {/* Toggle Switch */}
                  <label className="flex items-center gap-3 cursor-pointer bg-white px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs">
                    <input
                      type="checkbox"
                      checked={legalConfig.bankTransfer?.enabled ?? false}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        bankTransfer: {
                          ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                          enabled: e.target.checked,
                        },
                      })}
                      className="w-5 h-5 text-sky-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-900">
                      {legalConfig.bankTransfer?.enabled ? '🟢 Havale/EFT Aktif' : '🔴 Havale/EFT Kapalı (Yalnızca Kart)'}
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Banka Adı
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Ziraat Bankası, Garanti BBVA"
                      value={legalConfig.bankTransfer?.bankName || ''}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        bankTransfer: {
                          ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                          bankName: e.target.value,
                        },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Hesap Sahibi (Unvan / İsim)
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Gülümse Dental Tic. Ltd. Şti."
                      value={legalConfig.bankTransfer?.accountHolder || ''}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        bankTransfer: {
                          ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                          accountHolder: e.target.value,
                        },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      IBAN Numarası
                    </label>
                    <input
                      type="text"
                      placeholder="TR00 0000 0000 0000 0000 0000 00"
                      value={legalConfig.bankTransfer?.iban || ''}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        bankTransfer: {
                          ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                          iban: e.target.value,
                        },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Şube / Şube Kodu (Opsiyonel)
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Maslak Ticari Şubesi (1234)"
                      value={legalConfig.bankTransfer?.branchCode || ''}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        bankTransfer: {
                          ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                          branchCode: e.target.value,
                        },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      Açıklama / Müşteri Talimat Notu
                    </label>
                    <input
                      type="text"
                      placeholder="Örn: Açıklamaya Ad-Soyad ve Sipariş No yazınız."
                      value={legalConfig.bankTransfer?.description || ''}
                      onChange={(e) => setLegalConfig({
                        ...legalConfig,
                        bankTransfer: {
                          ...(legalConfig.bankTransfer || DEFAULT_LEGAL_CONFIG.bankTransfer),
                          description: e.target.value,
                        },
                      })}
                      className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Save Action */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <button
                onClick={() => setLegalConfig(DEFAULT_LEGAL_CONFIG)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Varsayılan Yasal Metinlere Sıfırla
              </button>

              <motion.button
                onClick={handleSaveLegal}
                disabled={savingLegal}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                <span>{savingLegal ? 'Kaydediliyor...' : 'Yasal Bilgileri Kaydet'}</span>
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ========================================================================= */}
        {/* HEPSIJET KARGO ENTEGRASYON AYARLARI PANELİ                               */}
        {/* ========================================================================= */}
        {activeTab === 'hepsijet' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Header & Save Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-slate-900">HepsiJET Canlı Kargo Entegrasyonu</h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-orange-100 text-orange-800 border border-orange-200">
                    Konya Çıkışlı
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Çıkış deposu, gönderici adresi, varsayılan desi ve paketleme yapılandırmalarını buradan yönetin.
                </p>
              </div>

              <motion.button
                onClick={handleSaveHepsiJet}
                disabled={savingHepsiJet}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-orange-600/30 disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                <span>{savingHepsiJet ? 'Kaydediliyor...' : 'HepsiJET Ayarlarını Kaydet'}</span>
              </motion.button>
            </div>

            {/* STATUS & SECURITY NOTICE */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-col gap-3 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0">
                    <FiShield className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-100">
                      API Uç Noktası: <code className="text-orange-400">https://integration.hepsijet.com/</code>
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Kimlik bilgileri sunucu tarafında güvenle saklanmaktadır.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  <span className={`px-3 py-1 rounded-full text-[11px] font-black ${
                    hasEnvCredentials ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}>
                    {hasEnvCredentials ? '✓ Kimlik Bilgileri Hazır' : '⚠ .env Bilgileri Bekleniyor'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-[11px] font-black ${
                    isLiveDispatchEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                  }`}>
                    {isLiveDispatchEnabled ? '🟢 Canlı Gönderi Aktif' : '🛡 Korumalı / Onay Bekleme Modu'}
                  </span>
                </div>
              </div>

              {/* HepsiJET API Bağlantı Testi */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-slate-700/50">
                <button
                  type="button"
                  disabled={connectionChecking}
                  onClick={async () => {
                    setConnectionChecking(true)
                    setConnectionResult(null)
                    try {
                      const user = await getCurrentUser()
                      if (!user) {
                        setConnectionResult({ success: false, error: 'Oturum doğrulanamadı. Lütfen tekrar giriş yapın.' })
                        return
                      }
                      const idToken = await user.getIdToken()
                      const res = await fetch('/api/admin/hepsijet/connection-check', {
                        method: 'POST',
                        headers: { Authorization: `Bearer ${idToken}` },
                      })
                      const json = await res.json()
                      setConnectionResult(json)
                    } catch (err: any) {
                      setConnectionResult({ success: false, error: err?.message || 'Bağlantı kontrolü sırasında beklenmeyen hata.' })
                    } finally {
                      setConnectionChecking(false)
                    }
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                    connectionChecking
                      ? 'bg-slate-700 text-slate-400 cursor-wait'
                      : 'bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30 cursor-pointer'
                  }`}
                >
                  {connectionChecking ? (
                    <FiRefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <FiCheckCircle className="w-4 h-4" />
                  )}
                  <span>{connectionChecking ? 'Bağlantı kontrol ediliyor…' : 'HepsiJET API Bağlantısını Test Et'}</span>
                </button>

                {connectionResult && (
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-semibold ${
                    connectionResult.success
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-300 border border-red-500/30'
                  }`}>
                    <span>{connectionResult.success ? '✅' : '❌'}</span>
                    <span>{connectionResult.message || connectionResult.error}</span>
                    {connectionResult.checks?.tokenAcquired === true && (
                      <span className="ml-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-black">TOKEN OK</span>
                    )}
                    {connectionResult.checks?.httpStatus && (
                      <span className="ml-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-200 text-[10px] font-black">HTTP {connectionResult.checks.httpStatus}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* HEPSIJET ALT SEKMELER (Otomasyon & Saat Ayarı En Başta) */}
            <div className="flex border-b-2 border-slate-200 gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setActiveHepsiJetSubTab('automation')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                  activeHepsiJetSubTab === 'automation'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FiZap className="w-4 h-4" />
                <span>⚡ 1. Anlık Gönderi & Otomatik Yazdırma</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-white font-mono font-black">
                  Anlık
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHepsiJetSubTab('company')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                  activeHepsiJetSubTab === 'company'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FiGlobe className="w-4 h-4" />
                <span>🏢 2. Firma Bilgileri</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHepsiJetSubTab('warehouse')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                  activeHepsiJetSubTab === 'warehouse'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FiTruck className="w-4 h-4" />
                <span>📍 3. Konya Deposu</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHepsiJetSubTab('print')}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                  activeHepsiJetSubTab === 'print'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FiPrinter className="w-4 h-4" />
                <span>🖨️ 4. Desi & Termal Baskı</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHepsiJetSubTab('all')}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                  activeHepsiJetSubTab === 'all'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <FiList className="w-3.5 h-3.5" />
                <span>Tümünü Göster</span>
              </button>
            </div>

            {/* GÜNLÜK SİPARİŞ OTOMASYONU VE SAAT AYARI (EN BAŞTA) */}
            {(activeHepsiJetSubTab === 'automation' || activeHepsiJetSubTab === 'all') && (
              <div className="p-6 rounded-3xl bg-slate-50 border-2 border-orange-200 space-y-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                        <FiZap className="w-4 h-4 text-orange-600" />
                        Sipariş Bazlı Gerçek Zamanlı HepsiJET & Otomatik Yazdırma
                      </h3>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ⚡ Anlık Mod (Saat Beklemesiz)
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Saat bazlı bekleme tamamen kaldırılmıştır. Müşteri siparişi verip ödemesi onaylandığı anda sistem otomatik olarak HepsiJET gönderisini oluşturur, birleşik fişi hazırlar ve Windows Print Agent kuyruğuna gönderir.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-black ${
                      automationSettings.enabled
                        ? 'bg-emerald-500/20 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-200 text-slate-600 border border-slate-300'
                    }`}>
                      {automationSettings.enabled ? '✓ Anlık Otomasyon Açık' : '○ Otomasyon Duraklatıldı'}
                    </span>
                    <motion.button
                      onClick={handleSaveAutomation}
                      disabled={savingAutomation}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-orange-600/30 disabled:opacity-50"
                    >
                      <FiSave className="w-4 h-4" />
                      <span>{savingAutomation ? 'Kaydediliyor...' : 'Ayarları Kaydet'}</span>
                    </motion.button>
                  </div>
                </div>

                {/* Güvenlik & Simülasyon Bildirimi */}
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
                  <FiShield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-amber-950">
                      🛡️ Korumalı Güvenlik / Canlı Gönderi Koruması
                    </p>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Canlı gönderi oluşturma kilidi (<code className="font-bold">HEPSIJET_LIVE_DISPATCH_ENABLED=false</code>) aktiftir. Test aşamasında canlı HepsiJET API&apos;sine gereksiz talep gönderilmez. Canlıya geçiş öncesinde ortam değişkeninden onaylanabilir.
                    </p>
                  </div>
                </div>

                {/* Ayar Girişleri & Durum Paneli */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {/* ANLIK OTOMATİK GÖNDERİ */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Anlık HepsiJET Gönderisi
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer pt-1">
                      <input
                        type="checkbox"
                        checked={automationSettings.enabled}
                        onChange={(e) => setAutomationSettings({ ...automationSettings, enabled: e.target.checked })}
                        className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm font-bold text-slate-800">
                        {automationSettings.enabled ? '🟢 Anında Oluştur' : '⏸ Duraklatıldı'}
                      </span>
                    </label>
                    <span className="text-[10px] text-slate-400 block">Ödeme başarılı olunca kargo kaydı açılır</span>
                  </div>

                  {/* OTOMATİK YAZDIRMA KUYRUĞU */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Print Agent Kuyruğu
                    </label>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-sm font-bold text-slate-900">Aktif & Dinleniyor</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">Yeni etiketler kuyruğa otomatik düşer</span>
                  </div>

                  {/* BAĞLANTI DURUMU */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Windows Agent Durumu
                    </label>
                    <div className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 inline-block">
                      ✓ USB Yazıcı Bağlantısı Hazır
                    </div>
                    <span className="text-[10px] text-slate-400 block">Palmx TXP-400 / 4BARCODE</span>
                  </div>

                  {/* SİPARİŞ PARTİ LİMİTİ */}
                  <div className="p-4 bg-white rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
                      Eşzamanlı İşlem Limiti
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="200"
                      value={automationSettings.maxBatchSize || 50}
                      onChange={(e) => setAutomationSettings({ ...automationSettings, maxBatchSize: parseInt(e.target.value, 10) || 50 })}
                      className="w-full px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                    <span className="text-[10px] text-slate-400 block">Kuyrukta azami eşzamanlı iş</span>
                  </div>
                </div>

                {/* Zamanlama ve Son Çalıştırma Özeti */}
                <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 font-medium">Son Çalışma: </span>
                        <strong className="text-slate-900">
                          {automationSettings.lastRunAt ? new Date(automationSettings.lastRunAt).toLocaleString('tr-TR') : 'Henüz çalışmadı'}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-400 font-medium">Bir Sonraki Çalışma: </span>
                        <strong className="text-slate-900 font-mono">
                          {automationSettings.nextRunAt ? new Date(automationSettings.nextRunAt).toLocaleString('tr-TR') : 'Hesaplanıyor'}
                        </strong>
                      </div>
                    </div>

                    <motion.button
                      onClick={handleTestAutomationRun}
                      disabled={runningAutomation}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      <FiPlay className="w-3.5 h-3.5 text-orange-400" />
                      <span>{runningAutomation ? 'Kontrol Ediliyor...' : 'Otomasyonu Şimdi Test Et (Simülasyon)'}</span>
                    </motion.button>
                  </div>

                  {/* Özet Kartları */}
                  {automationSettings.lastRunSummary && (
                    <div>
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Son Çalıştırma Özeti ({automationSettings.lastRunSummary.runId})
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
                          <span className="text-[10px] text-slate-500 block uppercase">İncelenen</span>
                          <strong className="text-lg font-black text-slate-900">{automationSettings.lastRunSummary.totalChecked}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                          <span className="text-[10px] text-emerald-700 block uppercase">Gönderime Hazır</span>
                          <strong className="text-lg font-black text-emerald-800">{automationSettings.lastRunSummary.readyCount}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
                          <span className="text-[10px] text-amber-700 block uppercase">Onay Bekleyen</span>
                          <strong className="text-lg font-black text-amber-800">{automationSettings.lastRunSummary.pendingReviewCount}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-center">
                          <span className="text-[10px] text-red-700 block uppercase">Hatalı</span>
                          <strong className="text-lg font-black text-red-800">{automationSettings.lastRunSummary.failedCount}</strong>
                        </div>
                        <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-center">
                          <span className="text-[10px] text-purple-700 block uppercase">Belirsiz</span>
                          <strong className="text-lg font-black text-purple-800">{automationSettings.lastRunSummary.unknownCount}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Anlık Test Sonucu Listesi */}
                  {automationRunResult && automationRunResult.items && automationRunResult.items.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center justify-between">
                        <span>İncelenen Siparişler ({automationRunResult.items.length})</span>
                        <span className="text-[11px] font-normal text-slate-500">Korumalı Simülasyon Çıktısı</span>
                      </h4>

                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                        {automationRunResult.items.map((item: any) => (
                          <div key={item.orderId} className="p-3 bg-white hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">#{item.orderNumber}</span>
                                <span className="text-slate-600 font-medium">{item.customerName}</span>
                                <span className="text-slate-400 font-mono">({item.totalAmount} TL)</span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1">
                                {item.reasons.map((r: string, idx: number) => (
                                  <span key={idx} className="block text-slate-600">• {r}</span>
                                ))}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[11px] text-slate-400 font-mono">
                                {item.desi} Desi / {item.weight} kg
                              </span>
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                                item.status === 'ready'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}>
                                {item.status === 'ready' ? '✓ Gönderime Hazır' : '⚠ İnceleme Bekliyor'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SECTION 1: ŞİRKET & GÖNDERİCİ BİLGİLERİ */}
            {(activeHepsiJetSubTab === 'company' || activeHepsiJetSubTab === 'all') && (
            <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FiGlobe className="w-4 h-4 text-orange-600" />
                2. Firma & İletişim Bilgileri
              </h3>
              <p className="text-xs text-slate-500">
                HepsiJET sisteminde kargo etiketinde ve taşıma irsaliyesinde görünecek gönderici firma bilgileri.
              </p>
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2 mt-2">
                <span className="text-emerald-600 mt-0.5">🔒</span>
                <div>
                  <p className="font-bold">Resmi HepsiJET Sözleşme Bilgileri (Kilitli)</p>
                  <p className="text-[11px] text-emerald-800 mt-0.5">Firma adı, kısaltma kodu, depo ve adres bilgileri HepsiJET tarafından teyit edilmiş resmi değerlerdir. Bu alanlar sunucu tarafında sabitlenmiştir ve değiştirilemez.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Firma Unvanı *
                  </label>
                  <input
                    type="text"
                    value={hepsijetSettings.companyName || 'KALIPORT'}
                    readOnly
                    className="w-full px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-300 text-sm font-bold text-emerald-900 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">🔒 Resmi değer (değiştirilemez)</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Firma Kısaltma Kodu * (abbreviationCode)
                  </label>
                  <input
                    type="text"
                    value={hepsijetSettings.abbreviationCode || 'KALIPORT'}
                    readOnly
                    className="w-full px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-300 text-sm font-mono font-black text-emerald-900 tracking-wider cursor-not-allowed"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">🔒 Resmi değer — Barkod ön eki (değiştirilemez)</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Yetkili / Depo Sorumlusu
                  </label>
                  <input
                    type="text"
                    value={hepsijetSettings.contactName || ''}
                    onChange={(e) => setHepsijetSettings({ ...hepsijetSettings, contactName: e.target.value })}
                    placeholder="Örn: Depo Sorumlusu"
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Gönderici Telefon *
                  </label>
                  <input
                    type="tel"
                    value={hepsijetSettings.contactPhone || ''}
                    onChange={(e) => setHepsijetSettings({ ...hepsijetSettings, contactPhone: e.target.value })}
                    placeholder="05XXXXXXXXX"
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Gönderici E-Posta
                  </label>
                  <input
                    type="email"
                    value={hepsijetSettings.contactEmail || ''}
                    onChange={(e) => setHepsijetSettings({ ...hepsijetSettings, contactEmail: e.target.value })}
                    placeholder="destek@kaliport.com"
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
            )}

            {/* SECTION 2: KONYA ÇIKIŞ DEPOSU & ADRES BİLGİLERİ */}
            {(activeHepsiJetSubTab === 'warehouse' || activeHepsiJetSubTab === 'all') && (
            <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FiTruck className="w-4 h-4 text-orange-600" />
                3. Konya Çıkış Deposu & Adres Bilgileri
              </h3>
              <p className="text-xs text-slate-500">
                Kargoların teslim alınacağı veya çıkış yapılacağı Konya deposunun açık adresi ve HepsiJET depo kodları.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Çıkış Şehri (İl) *
                  </label>
                  <input
                    type="text"
                    value={hepsijetSettings.senderCity || 'Konya'}
                    readOnly
                    className="w-full px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-300 text-sm font-bold text-emerald-900 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">🔒 Resmi değer</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Çıkış İlçesi *
                  </label>
                  <input
                    type="text"
                    value={hepsijetSettings.senderTown || 'SELÇUKLU'}
                    readOnly
                    className="w-full px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-300 text-sm font-bold text-emerald-900 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">🔒 Resmi değer</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    HepsiJET Depo / Şube Kodu (companyAddressId)
                  </label>
                  <input
                    type="text"
                    value={hepsijetSettings.warehouseCode || 'kali-kaliport-73'}
                    readOnly
                    className="w-full px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-300 text-sm font-mono font-bold text-emerald-900 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">🔒 Resmi HepsiJET companyAddressId (değiştirilemez)</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Aktarma Merkezi Kodu (CurrentXdock.abbreviationCode)
                  </label>
                  <input
                    type="text"
                    value={hepsijetSettings.currentXdock || 'KALIPORTSELCUKLU'}
                    readOnly
                    className="w-full px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-300 text-sm font-mono font-bold text-emerald-900 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">🔒 Resmi HepsiJET CurrentXdock (değiştirilemez)</span>
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Açık Depo / Çıkış Adresi *
                  </label>
                  <textarea
                    rows={2}
                    value={hepsijetSettings.senderAddress || 'büyükkayacık mah. Ankara cad. no:312/H ( Gnc sanayi sitesi ) Selçuklu / KONYA'}
                    readOnly
                    className="w-full px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-300 text-sm text-emerald-900 cursor-not-allowed"
                  />
                  <span className="text-[10px] text-emerald-600 font-bold mt-0.5 block">🔒 Resmi HepsiJET depo adresi (değiştirilemez)</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Posta Kodu
                  </label>
                  <input
                    type="text"
                    value={hepsijetSettings.senderPostalCode || '42000'}
                    onChange={(e) => setHepsijetSettings({ ...hepsijetSettings, senderPostalCode: e.target.value })}
                    placeholder="42000"
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
            )}

            {/* SECTION 4: PAKETLEME, DESİ & TERMAL BASKI */}
            {(activeHepsiJetSubTab === 'print' || activeHepsiJetSubTab === 'all') && (
            <>
            <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 space-y-4">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FiInfo className="w-4 h-4 text-orange-600" />
                4. Paketleme, Desi ve Termal Baskı
              </h3>
              <p className="text-xs text-slate-500">
                Siparişte veya üründe özel bir desi/ağırlık tanımlanmamışsa otomatik olarak bu değerler baz alınır.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Varsayılan Desi *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    value={hepsijetSettings.defaultDesi ?? 1}
                    onChange={(e) => setHepsijetSettings({ ...hepsijetSettings, defaultDesi: parseFloat(e.target.value) || 1 })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Diş fırçası için örn: 1 desi</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Varsayılan Ağırlık (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.05"
                    value={hepsijetSettings.defaultWeight ?? 0.3}
                    onChange={(e) => setHepsijetSettings({ ...hepsijetSettings, defaultWeight: parseFloat(e.target.value) || 0.3 })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Örn: 0.30 kg</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Varsayılan Paket Sayısı
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={hepsijetSettings.defaultPackageCount ?? 1}
                    onChange={(e) => setHepsijetSettings({ ...hepsijetSettings, defaultPackageCount: parseInt(e.target.value, 10) || 1 })}
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    HepsiJET Ürün Kodu
                  </label>
                  <input
                    type="text"
                    value={hepsijetSettings.productCode || 'HX_STD'}
                    onChange={(e) => setHepsijetSettings({ ...hepsijetSettings, productCode: e.target.value })}
                    placeholder="HX_STD"
                    className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-300 text-sm font-mono text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Standart: HX_STD</span>
                </div>
              </div>
            </div>

            {/* SECTION 4: TERMAL BASKI & BİRLEŞİK ETİKET AYARLARI */}
            <div className="p-6 rounded-3xl bg-slate-50 border-2 border-slate-200 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <FiPrinter className="w-4 h-4 text-orange-600" />
                    4. Termal Baskı & Birleşik Etiket Ayarları (KALIPORT)
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    100 × 150 mm (Dikey) veya 150 × 100 mm (Yatay) termal yazıcı için HepsiJET kargo etiketi ve KALIPORT sipariş fişi yerleşimi.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleTestPrintPreview('preview')}
                    disabled={testingPreview}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
                    title="Numune PDF etiketini yeni sekmede aç"
                  >
                    <FiEye className="w-3.5 h-3.5 text-orange-400" />
                    <span>{testingPreview ? 'Üretiliyor...' : 'Numune Önizle'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTestPrintPreview('download')}
                    disabled={testingPreview}
                    className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50"
                    title="Numune PDF etiketini bilgisayara indir"
                  >
                    <FiDownload className="w-3.5 h-3.5 text-slate-600" />
                    <span>İndir</span>
                  </button>
                </div>
              </div>

              {/* Baskı Preset Seçici */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider block">
                    Baskı Şablonu (Preset)
                  </label>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Aktif: {selectedPreset === '100x150_portrait' ? '100×150 mm Dikey' : selectedPreset === '150x100_landscape' ? '150×100 mm Yatay' : 'Özel Ölçüler'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => handlePresetChange('100x150_portrait')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPreset === '100x150_portrait'
                        ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">100 × 150 mm — Dikey</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">Dikey Rulo</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Üstte HepsiJET Kargo (100×100 mm), altta KALIPORT Sipariş Fişi (100×50 mm).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('150x100_landscape')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPreset === '150x100_landscape'
                        ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">150 × 100 mm — Yatay</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">Geniş Yatay</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Solda HepsiJET Kargo (100×100 mm), sağda KALIPORT Sipariş Fişi (50×100 mm).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handlePresetChange('custom')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      selectedPreset === 'custom'
                        ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">Özel Ölçüler</span>
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">Manuel</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Aşağıdaki milimetre ve yön değerlerini yazıcınıza göre özel olarak ayarlayın.
                    </p>
                  </button>
                </div>
              </div>

              {/* Boyut Doğrulama Uyarısı */}
              {(() => {
                const ps = hepsijetSettings.printSettings || DEFAULT_PRINT_SETTINGS
                const validation = validatePrintSettings(ps)
                if (!validation.isValid) {
                  return (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                      <FiAlertCircle className="w-4 h-4 shrink-0" />
                      <span>{validation.error}</span>
                    </div>
                  )
                }
                return (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-700 flex items-center gap-2">
                    <FiCheckCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>Ölçüler uyumlu: Toplam {ps.totalWidthMm} × {ps.totalHeightMm} mm termal kağıda kusursuz sığıyor.</span>
                  </div>
                )
              })()}

              {/* Ölçü Alanları */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Toplam Genişlik (mm)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="300"
                    value={hepsijetSettings.printSettings?.totalWidthMm ?? 150}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 150
                      setSelectedPreset('custom')
                      setHepsijetSettings((prev) => ({
                        ...prev,
                        printSettings: {
                          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
                          totalWidthMm: v,
                          preset: 'custom',
                        },
                      }))
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {selectedPreset === '100x150_portrait' ? 'Dikey Rulo: 100 mm' : 'Yatay Rulo: 150 mm'}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Toplam Yükseklik (mm)
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="300"
                    value={hepsijetSettings.printSettings?.totalHeightMm ?? 100}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 100
                      setSelectedPreset('custom')
                      setHepsijetSettings((prev) => ({
                        ...prev,
                        printSettings: {
                          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
                          totalHeightMm: v,
                          preset: 'custom',
                        },
                      }))
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-black text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {selectedPreset === '100x150_portrait' ? 'Dikey Rulo: 150 mm' : 'Yatay Rulo: 100 mm'}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Kargo Genişlik (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="250"
                    value={hepsijetSettings.printSettings?.labelWidthMm ?? 96}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 96
                      setSelectedPreset('custom')
                      setHepsijetSettings((prev) => ({
                        ...prev,
                        printSettings: {
                          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
                          labelWidthMm: v,
                          preset: 'custom',
                        },
                      }))
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Kargo etiketi genişliği</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Kargo Yükseklik (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="250"
                    value={hepsijetSettings.printSettings?.labelHeightMm ?? 96}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 96
                      setSelectedPreset('custom')
                      setHepsijetSettings((prev) => ({
                        ...prev,
                        printSettings: {
                          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
                          labelHeightMm: v,
                          preset: 'custom',
                        },
                      }))
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Kargo etiketi yüksekliği</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Fiş Genişlik (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="250"
                    value={hepsijetSettings.printSettings?.slipWidthMm ?? (selectedPreset === '100x150_portrait' ? 96 : 48)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 48
                      setSelectedPreset('custom')
                      setHepsijetSettings((prev) => ({
                        ...prev,
                        printSettings: {
                          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
                          slipWidthMm: v,
                          preset: 'custom',
                        },
                      }))
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {selectedPreset === '100x150_portrait' ? 'Dikey fiş: 96 mm' : 'Yatay fiş: 48 mm'}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Fiş Yükseklik (mm)
                  </label>
                  <input
                    type="number"
                    min="20"
                    max="250"
                    value={hepsijetSettings.printSettings?.slipHeightMm ?? (selectedPreset === '100x150_portrait' ? 46 : 96)}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 96
                      setSelectedPreset('custom')
                      setHepsijetSettings((prev) => ({
                        ...prev,
                        printSettings: {
                          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
                          slipHeightMm: v,
                          preset: 'custom',
                        },
                      }))
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {selectedPreset === '100x150_portrait' ? 'Dikey fiş: 46 mm' : 'Yatay fiş: 96 mm'}
                  </span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Bölüm Arası Boşluk (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={hepsijetSettings.printSettings?.gapMm ?? 2}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      setSelectedPreset('custom')
                      setHepsijetSettings((prev) => ({
                        ...prev,
                        printSettings: {
                          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
                          gapMm: v,
                          preset: 'custom',
                        },
                      }))
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Varsayılan: 2 mm</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Kenar Boşluğu (mm)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={hepsijetSettings.printSettings?.marginMm ?? 2}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value) || 0
                      setSelectedPreset('custom')
                      setHepsijetSettings((prev) => ({
                        ...prev,
                        printSettings: {
                          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
                          marginMm: v,
                          preset: 'custom',
                        },
                      }))
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-[10px] text-slate-400 block mt-0.5">Varsayılan: 2 mm</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Baskı Yönü
                  </label>
                  <select
                    value={hepsijetSettings.printSettings?.orientation ?? 'landscape'}
                    onChange={(e) => {
                      const v = e.target.value as 'landscape' | 'portrait'
                      setSelectedPreset('custom')
                      setHepsijetSettings((prev) => ({
                        ...prev,
                        printSettings: {
                          ...(prev.printSettings || DEFAULT_PRINT_SETTINGS),
                          orientation: v,
                          preset: 'custom',
                        },
                      }))
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  >
                    <option value="landscape">Yatay (Yan Yana)</option>
                    <option value="portrait">Dikey (Alt Alta)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                    Fiş Yazı Boyutu
                  </label>
                  <select
                    value={hepsijetSettings.printSettings?.fontSize ?? 'compact'}
                    onChange={(e) => {
                      const v = e.target.value as 'compact' | 'small' | 'medium'
                      setHepsijetSettings({
                        ...hepsijetSettings,
                        printSettings: {
                          ...(hepsijetSettings.printSettings || DEFAULT_PRINT_SETTINGS),
                          fontSize: v,
                        },
                      })
                    }}
                    className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                  >
                    <option value="compact">Sıkıştırılmış (Kompakt 50mm)</option>
                    <option value="small">Standart Küçük</option>
                    <option value="medium">Orta</option>
                  </select>
                </div>
              </div>

              {/* Bilgi Fişi Başlığı ve İçerik Anahtarları */}
              <div className="pt-3 border-t border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                      Fiş Firma Başlığı
                    </label>
                    <input
                      type="text"
                      value={hepsijetSettings.printSettings?.companyTitle ?? 'KALIPORT'}
                      onChange={(e) => {
                        setHepsijetSettings({
                          ...hepsijetSettings,
                          printSettings: {
                            ...(hepsijetSettings.printSettings || DEFAULT_PRINT_SETTINGS),
                            companyTitle: e.target.value,
                          },
                        })
                      }}
                      placeholder="KALIPORT"
                      className="w-full px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 pt-2">
                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={hepsijetSettings.printSettings?.showPrice ?? false}
                      onChange={(e) => {
                        setHepsijetSettings({
                          ...hepsijetSettings,
                          printSettings: {
                            ...(hepsijetSettings.printSettings || DEFAULT_PRINT_SETTINGS),
                            showPrice: e.target.checked,
                          },
                        })
                      }}
                      className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                    />
                    <span>Fiyat Göster</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={hepsijetSettings.printSettings?.showCustomerPhone ?? true}
                      onChange={(e) => {
                        setHepsijetSettings({
                          ...hepsijetSettings,
                          printSettings: {
                            ...(hepsijetSettings.printSettings || DEFAULT_PRINT_SETTINGS),
                            showCustomerPhone: e.target.checked,
                          },
                        })
                      }}
                      className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                    />
                    <span>Alıcı Telefon</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={hepsijetSettings.printSettings?.showPackerField ?? true}
                      onChange={(e) => {
                        setHepsijetSettings({
                          ...hepsijetSettings,
                          printSettings: {
                            ...(hepsijetSettings.printSettings || DEFAULT_PRINT_SETTINGS),
                            showPackerField: e.target.checked,
                          },
                        })
                      }}
                      className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                    />
                    <span>Hazırlayan & Kontrol</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={hepsijetSettings.printSettings?.showItemSku ?? true}
                      onChange={(e) => {
                        setHepsijetSettings({
                          ...hepsijetSettings,
                          printSettings: {
                            ...(hepsijetSettings.printSettings || DEFAULT_PRINT_SETTINGS),
                            showItemSku: e.target.checked,
                          },
                        })
                      }}
                      className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                    />
                    <span>Ürün SKU</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer bg-white p-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={hepsijetSettings.printSettings?.showItemVariant ?? true}
                      onChange={(e) => {
                        setHepsijetSettings({
                          ...hepsijetSettings,
                          printSettings: {
                            ...(hepsijetSettings.printSettings || DEFAULT_PRINT_SETTINGS),
                            showItemVariant: e.target.checked,
                          },
                        })
                      }}
                      className="rounded text-orange-600 focus:ring-orange-500 w-4 h-4"
                    />
                    <span>Ürün Varyant</span>
                  </label>
                </div>
              </div>
            </div>
            </>
            )}

            {/* Windows Print Agent & Cihaz Durumu */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <FiPrinter className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Windows Print Agent & Palmx TXP-400 Durumu</h3>
                    <p className="text-xs text-slate-500">Windows bilgisayarda arka planda çalışan yazdırma servisi ve canlı cihaz bağlantısı.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={loadPrintAgents}
                    disabled={loadingAgents}
                    className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors text-xs flex items-center gap-1 font-semibold"
                  >
                    <FiRefreshCw className={`w-3.5 h-3.5 ${loadingAgents ? 'animate-spin' : ''}`} />
                    <span>Yenile</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCreatePrintAgent}
                    disabled={generatingAgentToken}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <FiPlus className="w-3.5 h-3.5" />
                    <span>{generatingAgentToken ? 'Oluşturuluyor...' : 'Yeni Agent / Token Üret'}</span>
                  </button>
                </div>
              </div>

              {newAgentToken && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-emerald-800">✅ Yeni Üretilen Agent Token:</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={newAgentToken}
                      className="flex-1 px-2.5 py-1.5 bg-white border border-emerald-300 rounded text-xs font-mono select-all text-emerald-950 font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(newAgentToken)
                        alert('Token panoya kopyalandı!')
                      }}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs font-bold hover:bg-emerald-700"
                    >
                      Kopyala
                    </button>
                  </div>
                  <p className="text-[11px] text-emerald-700">Bu tokenı Windows bilgisayardaki <code>print-agent/config.json</code> dosyasına yapıştırın.</p>
                </div>
              )}

              {printAgents.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-xl border border-dashed border-slate-200">
                  <p className="text-xs text-slate-500 font-medium">Henüz kayıtlı bir Print Agent bulunmuyor.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Yukarıdaki butona tıklayarak Windows için token oluşturabilirsiniz.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {printAgents.map((agent) => (
                    <div key={agent.agentId} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{agent.name}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          agent.isOnline ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {agent.isOnline ? '● CANLI (ONLINE)' : '○ BEKLİYOR (OFFLINE)'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                        <div>Agent ID: <span className="font-mono text-slate-800 font-semibold">{agent.agentId}</span></div>
                        <div>Yazıcı: <span className="text-slate-800 font-semibold">{agent.printerId}</span></div>
                        <div className="col-span-2">
                          Son Sinyal (Heartbeat):{' '}
                          <span className="text-slate-800 font-semibold">
                            {agent.lastHeartbeatAt ? new Date(agent.lastHeartbeatAt).toLocaleString('tr-TR') : 'Henüz sinyal yok'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-3 text-[11px] text-indigo-900 space-y-1 leading-relaxed">
                <span className="font-bold block">💡 Windows Bilgisayara Kurulum Özeti (Sıfır Kod / Tek Tık):</span>
                <p>1. Windows bilgisayara yalnızca <code>print-agent/</code> klasörünü kopyalayın (Proje kaynak kodları veya node_modules gerekmez).</p>
                <p>2. <code>quick-setup.bat</code> dosyasına çift tıklayarak çalıştırın. Script yazıcıyı ve portu otomatik algılar, uyku modunu kapatır ve Windows arka plan servisini kurar.</p>
              </div>
            </div>



            {/* Bottom Save Action */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-end">
              <motion.button
                onClick={handleSaveHepsiJet}
                disabled={savingHepsiJet}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2 px-8 py-3 bg-orange-600 hover:bg-orange-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-orange-600/30 disabled:opacity-50"
              >
                <FiSave className="w-4 h-4" />
                <span>{savingHepsiJet ? 'Kaydediliyor...' : 'HepsiJET Ayarlarını Kaydet'}</span>
              </motion.button>
            </div>
          </motion.div>
        )}
        {activeTab === 'print_agent' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header & Quick Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <FiPrinter className="w-5 h-5" />
                  </span>
                  <h2 className="text-lg font-black text-slate-900">Windows Print Agent Yönetimi</h2>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800">
                    PALMX TXP-400
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Windows bilgisayarda çalışan PALMX TXP 400 termal etiket servisini, yetkili agent cihazlarını ve baskı kuyruğunu yönetin.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadPrintAgents}
                  disabled={loadingAgents}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                >
                  <FiRefreshCw className={`w-3.5 h-3.5 ${loadingAgents ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>Yenile</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowCreateAgentModal(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-600/20"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                  <span>Yeni Agent Oluştur</span>
                </button>
              </div>
            </div>

            {/* Print Queue Stats Cards */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-600 font-semibold">
                <span>📊 Baskı Kuyruğu Durumu (Print Queue)</span>
                <span className="text-[11px] text-slate-400">Toplam: {printQueueStats?.total ?? 0} iş</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-2xl">
                  <span className="text-[10px] font-bold text-amber-700 block uppercase tracking-wider">Bekleyen (Pending)</span>
                  <span className="text-xl font-black text-amber-900 mt-0.5 block">{printQueueStats?.pending ?? 0}</span>
                  <span className="text-[10px] text-amber-600">Yazıcı sırası bekliyor</span>
                </div>

                <div className="p-3.5 bg-sky-50/70 border border-sky-200/80 rounded-2xl">
                  <span className="text-[10px] font-bold text-sky-700 block uppercase tracking-wider">İşleniyor (Processing)</span>
                  <span className="text-xl font-black text-sky-900 mt-0.5 block">{printQueueStats?.processing ?? 0}</span>
                  <span className="text-[10px] text-sky-600">Agent tarafından kilitli</span>
                </div>

                <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl">
                  <span className="text-[10px] font-bold text-emerald-700 block uppercase tracking-wider">Fiziksel Basıldı</span>
                  <span className="text-xl font-black text-emerald-900 mt-0.5 block">{printQueueStats?.printed ?? 0}</span>
                  <span className="text-[10px] text-emerald-600">Yazıcı çıktısı alındı</span>
                </div>

                <div className="p-3.5 bg-purple-50/70 border border-purple-200/80 rounded-2xl">
                  <span className="text-[10px] font-bold text-purple-700 block uppercase tracking-wider">Simülasyon (DryRun)</span>
                  <span className="text-xl font-black text-purple-900 mt-0.5 block">{printQueueStats?.simulated ?? 0}</span>
                  <span className="text-[10px] text-purple-600">PDF diske yazıldı</span>
                </div>

                <div className="p-3.5 bg-rose-50/70 border border-rose-200/80 rounded-2xl">
                  <span className="text-[10px] font-bold text-rose-700 block uppercase tracking-wider">Hatalı (Failed)</span>
                  <span className="text-xl font-black text-rose-900 mt-0.5 block">{printQueueStats?.failed ?? 0}</span>
                  <span className="text-[10px] text-rose-600">Maks. deneme aşıldı</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-600 block uppercase tracking-wider">Toplam Kuyruk (Kayıt)</span>
                  <span className="text-xl font-black text-slate-800 mt-0.5 block">{printQueueStats?.total ?? 0}</span>
                  <span className="text-[10px] text-slate-500">Tüm kuyruk kaydı</span>
                </div>
              </div>
            </div>

            {/* Newly Generated Raw Token Banner */}
            {newAgentToken && (
              <div className="p-4 bg-emerald-50/90 border-2 border-emerald-300 rounded-2xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="font-black text-emerald-900 text-xs uppercase tracking-wider">
                      ✅ Yeni Agent Güvenlik Tokenı Üretildi
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNewAgentToken(null)}
                    className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
                  >
                    Kapat ✕
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={newAgentToken}
                    className="flex-1 px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono select-all text-emerald-950 font-bold tracking-wide"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(newAgentToken)
                      alert('Token panoya kopyalandı!')
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                  >
                    Kopyala
                  </button>
                </div>

                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  ⚠️ <strong>Önemli Güvenlik Uyarısı:</strong> Bu token veritabanında tek yönlü <strong>SHA-256</strong> hash olarak saklanır ve bir daha asla görüntülenemez. Lütfen Windows bilgisayardaki <code>print-agent/config.json</code> dosyasındaki <code>agentToken</code> alanına kaydediniz.
                </p>
              </div>
            )}

            {/* Create Agent Modal / Inline Form */}
            {showCreateAgentModal && (
              <div className="p-5 bg-slate-50 border border-indigo-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <FiPlus className="w-4 h-4 text-indigo-600" />
                    <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">Yeni Print Agent Tanımla</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCreateAgentModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    Vazgeç ✕
                  </button>
                </div>

                <form onSubmit={handleCreateCustomPrintAgent} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Agent ID <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="kaliport-win-01"
                        value={agentForm.agentId}
                        onChange={(e) => setAgentForm({ ...agentForm, agentId: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400">Küçük harf, rakam ve tire (-) içerebilir.</span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Cihaz / Konum Adı <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Windows Palmx TXP-400"
                        value={agentForm.name}
                        onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Yazıcı Adı (Windows Spooler)
                      </label>
                      <input
                        type="text"
                        placeholder="4BARCODE 4B-2054TG"
                        value={agentForm.printerId}
                        onChange={(e) => setAgentForm({ ...agentForm, printerId: e.target.value })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                      />
                      <span className="text-[10px] text-slate-400">Windows Aygıtlar ve Yazıcılar altındaki ad.</span>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                        Açıklama (Opsiyonel)
                      </label>
                      <input
                        type="text"
                        placeholder="Depo 1. Kat Palmx TXP 400 Termal Yazıcı Servisi"
                        value={agentForm.description}
                        onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                        className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateAgentModal(false)}
                      className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50"
                    >
                      İptal
                    </button>
                    <button
                      type="submit"
                      disabled={generatingAgentToken}
                      className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <FiZap className="w-3.5 h-3.5" />
                      <span>{generatingAgentToken ? 'Üretiliyor...' : 'Güvenli Agent & Token Üret'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Registered Agents List */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Kayıtlı Cihazlar & Servisler ({printAgents.length})
              </span>

              {printAgents.length === 0 ? (
                <div className="text-center py-10 bg-slate-50/60 rounded-2xl border-2 border-dashed border-slate-200 space-y-2">
                  <FiPrinter className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-600 font-bold">Henüz kayıtlı bir Print Agent bulunmuyor.</p>
                  <p className="text-[11px] text-slate-400">
                    Yukarıdaki "Yeni Agent Oluştur" butonuna tıklayarak Windows için güvenli erişim belirteci oluşturabilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {printAgents.map((agent) => (
                    <div
                      key={agent.agentId}
                      className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                    >
                      {/* Left: Info */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{agent.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                            {agent.agentId}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                              agent.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {agent.status === 'active' ? 'YETKİLİ (AKTİF)' : 'ERİŞİM İPTAL (REVOKED)'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <div>
                            Yazıcı: <span className="font-bold text-slate-800">{agent.printerId}</span>
                          </div>
                          <div>
                            Kayıt Tarihi: <span className="text-slate-700">{agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('tr-TR') : '---'}</span>
                          </div>
                          {agent.description && (
                            <div className="text-slate-400 italic">"{agent.description}"</div>
                          )}
                        </div>
                      </div>

                      {/* Middle: Heartbeat & Online Status */}
                      <div className="flex items-center gap-3 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100 self-start md:self-center">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2.5 h-2.5 rounded-full ${
                              agent.isOnline
                                ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse'
                                : 'bg-slate-300'
                            }`}
                          />
                          <div>
                            <span className={`font-black text-[11px] block ${agent.isOnline ? 'text-emerald-700' : 'text-slate-500'}`}>
                              {agent.isOnline ? 'ÇEVRİMİÇİ (ONLINE)' : 'ÇEVRİMDIŞI (OFFLINE)'}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              {agent.lastHeartbeatAt || agent.lastSeenAt
                                ? `Son Sinyal: ${new Date(agent.lastHeartbeatAt || agent.lastSeenAt).toLocaleTimeString('tr-TR')}`
                                : 'Henüz sinyal yok'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5 self-end md:self-center">
                        <button
                          type="button"
                          disabled={actionInProgressAgentId === agent.agentId}
                          onClick={() => handleRegenerateAgentToken(agent.agentId)}
                          className="px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                          title="Tokenı Yenile (Rotate Token)"
                        >
                          <FiRefreshCw className={`w-3 h-3 ${actionInProgressAgentId === agent.agentId ? 'animate-spin' : ''}`} />
                          <span>Token Yenile</span>
                        </button>

                        <button
                          type="button"
                          disabled={actionInProgressAgentId === agent.agentId}
                          onClick={() => handleToggleAgentStatus(agent.agentId, agent.status)}
                          className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all disabled:opacity-50 ${
                            agent.status === 'active'
                              ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800'
                              : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {agent.status === 'active' ? 'Erişimi İptal Et' : 'Erişimi Aç'}
                        </button>

                        <button
                          type="button"
                          disabled={actionInProgressAgentId === agent.agentId}
                          onClick={() => handleDeleteAgent(agent.agentId)}
                          className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all disabled:opacity-50"
                          title="Agent'ı Sil"
                        >
                          <FiTrash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Windows Setup & Live Deployment Guide */}
            <div className="bg-gradient-to-br from-indigo-50/90 via-sky-50/50 to-white border border-indigo-100 rounded-2xl p-5 text-xs text-indigo-950 space-y-3 shadow-2xs">
              <div className="flex items-center gap-2">
                <FiZap className="w-4 h-4 text-indigo-600" />
                <span className="font-black text-sm text-indigo-950">Windows Print Agent Kurulum ve Canlıya Geçiş Rehberi</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] leading-relaxed">
                <div className="space-y-1.5 bg-white/70 p-3.5 rounded-xl border border-indigo-100">
                  <span className="font-bold text-indigo-900 block">📁 1. Dosyaların Kopyalanması</span>
                  <p>
                    MacBook geliştirme ortamınızdan <strong>yalnızca <code>print-agent/</code> klasörünü</strong> Windows bilgisayara kopyalayın.
                  </p>
                  <p className="text-slate-600">
                    Proje kaynak kodları, Next.js, Chrome veya açık terminal gerekmez. Agent içinde derlenmiş sıfır bağımlı dosyalar (<code>dist/index.js</code>) yer almaktadır.
                  </p>
                </div>

                <div className="space-y-1.5 bg-white/70 p-3.5 rounded-xl border border-indigo-100">
                  <span className="font-bold text-indigo-900 block">⚡ 2. Kurulum ve Başlatma (Tek Tık)</span>
                  <p>
                    <code>print-agent/quick-setup.bat</code> dosyasına sağ tıklayıp <strong>"Yönetici olarak çalıştır"</strong> seçeneğini seçin.
                  </p>
                  <p className="text-slate-600">
                    Script yazıcıyı otomatik tarar, uyku modunu kapatır ve Windows Servisi (NSSM/Task Scheduler) olarak arka planda 7/24 çalışacak şekilde ayarlar.
                  </p>
                </div>

                <div className="space-y-1.5 bg-white/70 p-3.5 rounded-xl border border-indigo-100">
                  <span className="font-bold text-indigo-900 block">🔑 3. Token Tanımlama & Sunucu Adresi</span>
                  <p>
                    Kurulum esnasında yukarıda üretilen Agent Token'ını yapıştırın veya <code>config.json</code> dosyasındaki <code>agentToken</code> alanına girin.
                  </p>
                  <p className="text-slate-600">
                    Varsayılan API adresi <code>https://sonrakam.com</code> olarak ayarlanmıştır.
                  </p>
                </div>

                <div className="space-y-1.5 bg-white/70 p-3.5 rounded-xl border border-indigo-100">
                  <span className="font-bold text-indigo-900 block">🖨️ 4. Canlı Baskıya Geçiş (dryRun Güvenliği)</span>
                  <p>
                    Varsayılan güvenlik kuralı olarak <code>"dryRun": true</code> etkindir (etiketler sadece diske kaydedilir, kâğıt harcanmaz).
                  </p>
                  <p className="text-slate-600">
                    Fiziksel baskıyı açmak için <code>config.json</code> içindeki <code>"dryRun": false</code> yapmanız ve servisi yeniden başlatmanız yeterlidir.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}

