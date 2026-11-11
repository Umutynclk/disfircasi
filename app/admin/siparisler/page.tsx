'use client'

import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, deleteDoc, query, orderBy, where, limit, getDocs } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPackage, FiTruck, FiCheck, FiX, FiClock, FiEye,
  FiSearch, FiFilter, FiRefreshCw, FiChevronDown, FiChevronUp,
  FiUser, FiMapPin, FiPhone, FiMail, FiShoppingBag, FiPrinter,
  FiSettings, FiSliders, FiCheckCircle, FiAlertCircle, FiShield,
  FiDownload, FiExternalLink, FiFileText, FiInfo, FiXCircle,
  FiArchive, FiTrash2, FiBriefcase, FiCopy, FiZap,
  FiVolume2, FiVolumeX,
} from 'react-icons/fi'

import { getCurrentUser } from '@/lib/firebase/auth'
import { OrderShippingData, HepsiJetSettings, OrderCancellationRecord } from '@/lib/hepsijet/types'
import { generateBarcodeSvg } from '@/lib/utils/barcode'
import {
  isUnprocessed24h,
  isInArchive,
  isOverdueButBlocked,
  getArchiveBlockers,
  ARCHIVE_BLOCK_LABELS,
} from '@/lib/utils/orderLifecycle'
import { getCommonOrderDisplayStatus } from '@/lib/hepsijet/status-display'
import { calculateOrderStats } from '@/lib/utils/orderStats'

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'

interface OrderItem {
  productId: string
  name: string
  price: number
  quantity: number
  image?: string
}

interface Order {
  id: string
  orderNumber?: string
  status: OrderStatus
  createdAt: string
  updatedAt?: string
  total: number
  subtotal?: number
  shippingCost?: number
  items: OrderItem[]
  customer: {
    name: string
    email: string
    phone?: string
  }
  customerType?: 'individual' | 'corporate'
  billingInfo?: {
    type?: 'individual' | 'corporate'
    companyName?: string
    taxOffice?: string
    taxNumber?: string
    tcKimlikNo?: string
    fullName?: string
    authorizedPerson?: { name?: string; surname?: string }
    address?: string
    city?: string
    district?: string
    phone?: string
    email?: string
  }
  billingAddress?: {
    fullName?: string
    companyName?: string
    taxOffice?: string
    taxNumber?: string
    tcKimlikNo?: string
    address?: string
    city?: string
    district?: string
  }
  tcKimlikNo?: string
  isTrash?: boolean
  trashedAt?: string
  isArchived?: boolean
  archivedAt?: string
  shippingAddress: {
    fullName?: string
    address?: string
    city?: string
    district?: string
    zipCode?: string
    country?: string
  }
  paymentMethod?: string
  paymentStatus?: string
  notes?: string
  shipping?: OrderShippingData
  desi?: number
  weight?: number
  packageCount?: number
  cancelReason?: string
  cancelledAt?: string
  cancelledBy?: string
  cancellationHistory?: OrderCancellationRecord[]
  refundStatus?: 'none' | 'pending_refund' | 'processing_refund' | 'refunded' | 'refund_failed' | 'no_refund_needed'
  refundError?: string
  refundedAmountTRY?: number
  refundUpdatedAt?: string
  refundDetail?: any
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:    { label: 'Bekliyor',     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', icon: FiClock },
  processing: { label: 'Hazırlanıyor', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  icon: FiPackage },
  shipped:    { label: 'Kargoda',      color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', icon: FiTruck },
  delivered:  { label: 'Teslim Edildi',color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200',icon: FiCheck },
  cancelled:  { label: 'İptal Edildi', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: FiX },
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [viewTab, setViewTab] = useState<'active' | 'unprocessed24h' | 'archive' | 'trash'>('active')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [automationFilter, setAutomationFilter] = useState<'all' | 'ready' | 'pending_review'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const [creatingShipment, setCreatingShipment] = useState<string | null>(null)
  const [labelLoading, setLabelLoading] = useState<string | null>(null)
  const [refundingOrder, setRefundingOrder] = useState<string | null>(null)

  // Siparişe özel paket bilgileri state'i
  const [pkgDesi, setPkgDesi] = useState<number>(1)
  const [pkgWeight, setPkgWeight] = useState<number>(0.3)
  const [pkgCount, setPkgCount] = useState<number>(1)
  const [pkgNote, setPkgNote] = useState<string>('')

  // Birleşik Etiket Yazdırma & Önizleme State'i
  const [combinedLoading, setCombinedLoading] = useState<string | null>(null)
  const [combinedPdfPreview, setCombinedPdfPreview] = useState<{
    isOpen: boolean
    url: string | null
    order: Order | null
  }>({
    isOpen: false,
    url: null,
    order: null,
  })

  // İptal Modal ve İşlem State'leri
  const [cancellingOrder, setCancellingOrder] = useState<boolean>(false)
  const [cancellingShipment, setCancellingShipment] = useState<boolean>(false)
  const [cancelModalOrder, setCancelModalOrder] = useState<Order | null>(null)
  const [cancelReasonInput, setCancelReasonInput] = useState<string>('')
  const [cancelError, setCancelError] = useState<string | null>(null)

  // HepsiJET Kargo Durumu Senkronizasyon State'i
  const [isSyncingTracking, setIsSyncingTracking] = useState<boolean>(false)
  const [lastTrackingSyncAt, setLastTrackingSyncAt] = useState<string | null>(null)

  const handleSyncAllTracking = async (showNotice = true) => {
    setIsSyncingTracking(true)
    try {
      const user = await getCurrentUser()
      if (!user) return
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/hepsijet/sync-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      })
      if (res.ok) {
        const data = await res.json()
        setLastTrackingSyncAt(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
        if (showNotice && data.success) {
          alert(`✅ Kargo Takip Senkronizasyonu:\n${data.message || 'Siparişler başarıyla güncellendi.'}`)
        }
      }
    } catch (err) {
      console.warn('Otomatik kargo takibi senkronizasyon hatası:', err)
    } finally {
      setIsSyncingTracking(false)
    }
  }

  // Sayfa açıldığında ve her 5 dakikada bir otomatik arka plan kargo senkronizasyonu
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      handleSyncAllTracking(false)
    }, 2000)

    const interval = setInterval(() => {
      handleSyncAllTracking(false)
    }, 5 * 60 * 1000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [])

  // Seçili sipariş değiştiğinde paket bilgilerini senkronize et
  useEffect(() => {
    if (selectedOrder) {
      setPkgDesi(selectedOrder.shipping?.desi ?? selectedOrder.desi ?? 1)
      setPkgWeight(selectedOrder.shipping?.weight ?? selectedOrder.weight ?? 0.3)
      setPkgCount(selectedOrder.shipping?.packageCount ?? selectedOrder.packageCount ?? 1)
      setPkgNote((selectedOrder as any).packagingNote || selectedOrder.notes || '')
    }
  }, [selectedOrder])

  const [hepsijetSettings, setHepsijetSettings] = useState<HepsiJetSettings | null>(null)

  // HepsiJET ve Termal Baskı Ayarlarını yükle
  useEffect(() => {
    const loadHepsiJetSettings = async () => {
      try {
        const user = await getCurrentUser()
        if (!user) return
        const token = await user.getIdToken()
        const res = await fetch('/api/admin/hepsijet/settings', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.settings) {
            setHepsijetSettings(json.settings)
          }
        }
      } catch (err) {
        console.warn('HepsiJET ayarları yüklenemedi:', err)
      }
    }
    loadHepsiJetSettings()
  }, [])

  const printSettings = hepsijetSettings?.printSettings
  const activePreset = printSettings?.preset || (printSettings?.orientation === 'portrait' ? '100x150_portrait' : '150x100_landscape')
  const isPortrait = activePreset === '100x150_portrait' || printSettings?.orientation === 'portrait'
  const totalW = printSettings?.totalWidthMm || (isPortrait ? 100 : 150)
  const totalH = printSettings?.totalHeightMm || (isPortrait ? 150 : 100)
  const presetDimensionsLabel = `${totalW}×${totalH}mm ${isPortrait ? 'Dikey' : 'Yatay'}`

  // Order Intake Mode Setting (Auto-Approve vs. Manual Pending)
  const [autoApprove, setAutoApprove] = useState(false)
  const [autoPrintPrompt, setAutoPrintPrompt] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)

  // Sesli bildirim (Web Audio API) & Canlı Toast Bildirimi
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('kaliport_admin_sound') !== 'false'
    }
    return true
  })
  const soundEnabledRef = useRef(soundEnabled)
  useEffect(() => {
    soundEnabledRef.current = soundEnabled
    if (typeof window !== 'undefined') {
      localStorage.setItem('kaliport_admin_sound', String(soundEnabled))
    }
  }, [soundEnabled])

  const autoPrintPromptRef = useRef(autoPrintPrompt)
  useEffect(() => {
    autoPrintPromptRef.current = autoPrintPrompt
  }, [autoPrintPrompt])

  const [newOrderToast, setNewOrderToast] = useState<{
    id: string
    orderNumber: string
    customerName: string
    total: number
    itemCount: number
    createdAt: string
  } | null>(null)
  const [sessionNewOrderCount, setSessionNewOrderCount] = useState<number>(0)
  const [confirmingPayment, setConfirmingPayment] = useState<string | null>(null)

  const isFirstLoad = useRef(true)
  const knownOrderIdsRef = useRef<Set<string>>(new Set())

  // Web Audio API ile harici dosya bağımlılığı olmaksızın temiz zil tonu çalma
  const playNewOrderChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      const ctx = new AudioCtx()
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, start)
        gain.gain.setValueAtTime(0.25, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + dur)
      }
      const now = ctx.currentTime
      playTone(523.25, now, 0.12) // C5
      playTone(659.25, now + 0.10, 0.12) // E5
      playTone(783.99, now + 0.20, 0.30) // G5
    } catch (err) {
      console.warn('Audio chime error:', err)
    }
  }

  const toggleSound = () => {
    // Tarayıcı autoplay kilidini açmak için audio context'i kullanıcı etkileşiminde başlat
    playNewOrderChime()
    setSoundEnabled((prev) => !prev)
  }

  // Toast bildirimi için otomatik kapanma zamanlayıcısı
  useEffect(() => {
    if (!newOrderToast) return
    const timer = setTimeout(() => {
      setNewOrderToast(null)
    }, 10000)
    return () => clearTimeout(timer)
  }, [newOrderToast])

  // Banka Havalesi / EFT Ödemesini Onayla ve Kargo Sürecini Başlat
  const handleConfirmBankPayment = async (order: Order) => {
    const recipient = order.shippingAddress?.fullName || order.customer?.name || '-'
    const orderNum = order.orderNumber || order.id.slice(-8).toUpperCase()
    const confirmed = window.confirm(
      `[Havale / EFT Ödeme Onayı ve Kargo Başlatma]\n\n` +
      `Sipariş No: #${orderNum}\n` +
      `Müşteri: ${recipient}\n` +
      `Tutar: ${formatPrice(order.total)}\n\n` +
      `Bu siparişin banka hesabına gelen ödemesini onaylamak (PAID yapmak) ve anlık HepsiJET kargo gönderisi ile Print Agent baskı kuyruğunu başlatmak istiyor musunuz?`
    )
    if (!confirmed) return

    setConfirmingPayment(order.id)
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert('Oturum süresi dolmuş. Lütfen tekrar giriş yapınız.')
        return
      }
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/orders/confirm-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: order.id }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        alert(`Ödeme onaylanırken hata oluştu: ${data.error || 'Bilinmeyen hata'}`)
        return
      }

      alert(`✅ Ödeme başarıyla onaylandı (PAID)!\n${data.message || ''}\n${data.dispatch?.barcode ? `Barkod: ${data.dispatch.barcode}` : ''}`)
      if (selectedOrder && (selectedOrder.id === order.id || selectedOrder.orderNumber === order.orderNumber)) {
        setSelectedOrder((prev) => prev ? { ...prev, paymentStatus: 'PAID', status: 'processing' } : null)
      }
    } catch (err: any) {
      alert(`İstek iletilemedi: ${err?.message || 'Ağ hatası'}`)
    } finally {
      setConfirmingPayment(null)
    }
  }

  // HepsiJET Kargo Gönderisi Oluşturma (Tekil ve Kontrollü Akış)
  const handleCreateHepsiJetShipment = async (order: Order) => {
    if (order.paymentStatus !== 'PAID') {
      alert('⚠️ Yalnızca ödemesi başarıyla tamamlanmış (PAID) siparişler için kargo oluşturulabilir.')
      return
    }
    if (order.status === 'cancelled') {
      alert('⚠️ İptal edilmiş siparişler için kargo gönderisi oluşturulamaz.')
      return
    }
    if ((order.status as string) === 'refunded' || (order.status as string) === 'returned') {
      alert('⚠️ İade edilmiş siparişler için kargo gönderisi oluşturulamaz.')
      return
    }
    if (
      order.shipping?.status === 'created' ||
      Boolean(order.shipping?.barcode) ||
      Boolean(order.shipping?.trackingNumber)
    ) {
      alert(`⚠️ Bu sipariş için zaten aktif bir kargo gönderisi veya barkodu mevcuttur.\nBarkod / Takip No: ${order.shipping?.barcode || order.shipping?.trackingNumber || '-'}`)
      return
    }
    if (order.shipping?.status === 'unknown') {
      alert('⚠️ Bu siparişin kargo gönderi durumu belirsizdir (unknown). Ağ zaman aşımı nedeniyle istek kargo sistemine ulaşmış olabileceğinden mükerrer gönderim engellenmiştir.\nLütfen önce HepsiJET yönetim portalından kontrol ediniz.')
      return
    }
    if (order.shipping?.status === 'creating') {
      alert('⚠️ Bu sipariş için kargo oluşturma işlemi şu anda devam etmektedir. Lütfen bekleyiniz.')
      return
    }

    // Açık ve Güvenli Onay Akışı (Tekil Sipariş Kontrolü)
    const recipient = order.shippingAddress?.fullName || order.customer?.name || '-'
    const destination = `${order.shippingAddress?.city || '-'} / ${order.shippingAddress?.district || (order.shippingAddress as any)?.town || '-'}`
    const desiVal = (pkgDesi && pkgDesi > 0) ? pkgDesi : (order.desi || 1)
    const weightVal = (pkgWeight && pkgWeight > 0) ? pkgWeight : (order.weight || 0.3)
    const countVal = (pkgCount && pkgCount > 0) ? pkgCount : (order.packageCount || 1)

    const confirmed = window.confirm(
      `[HepsiJET Kargo Gönderisi Oluşturma Onayı]\n\n` +
      `Sipariş No: #${order.orderNumber || order.id.slice(-8).toUpperCase()}\n` +
      `Alıcı: ${recipient}\n` +
      `Varış: ${destination}\n` +
      `Koli/Paket: ${countVal} Adet | Desi: ${desiVal} | Ağırlık: ${weightVal} kg\n\n` +
      `Bu sipariş için HepsiJET kargo gönderisi oluşturulacaktır. Onaylıyor musunuz?`
    )

    if (!confirmed) {
      return
    }

    setCreatingShipment(order.id)
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert('Oturum doğrulanamadı. Lütfen yönetici hesabınızla tekrar giriş yapın.')
        return
      }
      const token = await user.getIdToken()

      const res = await fetch('/api/admin/hepsijet/create-shipment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          desi: pkgDesi,
          weight: pkgWeight,
          packageCount: pkgCount,
          packagingNote: pkgNote,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'HepsiJET kargo gönderisi oluşturulamadı.')
      }

      if (json.isSimulated) {
        alert(`ℹ️ ${json.message}\n\nGerçek kargo gönderisi oluşturulmadı. Sipariş durumu değiştirilmedi.`)
      } else {
        alert(`✅ ${json.message}\nBarkod: ${json.shipping?.barcode || json.shipping?.customerDeliveryNo}`)
      }

      // Seçili siparişi güncelle
      const updatedStatus = json.isSimulated ? (order.status || 'processing') : 'shipped'
      if (selectedOrder?.id === order.id) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: updatedStatus,
                shipping: json.shipping,
              }
            : null
        )
      }
    } catch (err: any) {
      console.error('HepsiJET gönderi oluşturma hatası:', err)
      alert(`❌ Kargo Gönderi Hatası:\n${err.message}`)
    } finally {
      setCreatingShipment(null)
    }
  }

  // Sipariş İptal Modalını Aç
  const handleOpenCancelModal = (order: Order) => {
    setCancelModalOrder(order)
    setCancelReasonInput('')
    setCancelError(null)
  }

  // Sipariş İptalini Sunucuya Gönder
  const handleConfirmCancelOrder = async () => {
    if (!cancelModalOrder) return
    const reason = cancelReasonInput.trim()
    if (!reason || reason.length < 3) {
      setCancelError('Lütfen en az 3 karakterden oluşan geçerli bir iptal nedeni giriniz.')
      return
    }

    setCancellingOrder(true)
    setCancelError(null)
    try {
      const user = await getCurrentUser()
      if (!user) {
        setCancelError('Oturum doğrulanamadı. Lütfen tekrar giriş yapınız.')
        return
      }
      const token = await user.getIdToken()

      const res = await fetch('/api/admin/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: cancelModalOrder.id,
          reason,
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Sipariş iptal edilemedi.')
      }

      alert(`✅ ${json.message}`)

      // State'leri güncelle
      const updatedOrder = {
        ...cancelModalOrder,
        status: 'cancelled' as OrderStatus,
        cancelReason: reason,
        cancelledAt: new Date().toISOString(),
        cancelledBy: user.email || 'admin',
        shipping: cancelModalOrder.shipping
          ? {
              ...cancelModalOrder.shipping,
              status: 'cancelled' as const,
              cancelReason: reason,
              cancelledAt: new Date().toISOString(),
            }
          : undefined,
        cancellationHistory: [
          ...(cancelModalOrder.cancellationHistory || []),
          json.cancellationRecord,
        ].filter(Boolean),
      }

      setOrders((prev) => prev.map((o) => (o.id === cancelModalOrder.id ? { ...o, ...updatedOrder } : o)))
      if (selectedOrder?.id === cancelModalOrder.id) {
        setSelectedOrder((prev) => (prev ? { ...prev, ...updatedOrder } : null))
      }

      setCancelModalOrder(null)
    } catch (err: any) {
      console.error('Sipariş iptal hatası:', err)
      setCancelError(err.message || 'Sipariş iptal edilirken bir sorun oluştu.')
    } finally {
      setCancellingOrder(false)
    }
  }

  // PayTR Otomatik Para İadesini Tetikle / Tekrar Dene
  const handleTriggerRefund = async (order: Order) => {
    const isPaid = order.paymentStatus === 'PAID' || order.paymentStatus === 'paid'
    if (!isPaid) {
      alert('⚠️ Yalnızca ödemesi tahsil edilmiş (PAID) siparişler için iade yapılabilir.')
      return
    }

    const confirmed = window.confirm(
      `[PayTR Otomatik Para İadesi Talebi]\n\n` +
      `Sipariş No: #${order.orderNumber || order.id.slice(-8).toUpperCase()}\n` +
      `Toplam Tutar: ${formatPrice(order.total)}\n` +
      `Mevcut İade Durumu: ${order.refundStatus || 'none'}\n\n` +
      `PayTR resmî iade API'si üzerinden müşterinin kartına para iadesi gönderilecektir. Onaylıyor musunuz?`
    )
    if (!confirmed) return

    setRefundingOrder(order.id)
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert('Yönetici oturumu bulunamadı. Lütfen tekrar giriş yapınız.')
        return
      }
      const token = await user.getIdToken()
      const res = await fetch('/api/admin/orders/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId: order.id }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        alert(`✅ ${data.message}`)
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  refundStatus: 'refunded',
                  refundedAmountTRY: data.refundedAmountTRY,
                  refundError: undefined,
                }
              : o
          )
        )
        if (selectedOrder?.id === order.id) {
          setSelectedOrder((prev) =>
            prev
              ? {
                  ...prev,
                  refundStatus: 'refunded',
                  refundedAmountTRY: data.refundedAmountTRY,
                  refundError: undefined,
                }
              : null
          )
        }
      } else {
        alert(`❌ PayTR iade hatası: ${data.error || 'İşlem gerçekleştirilemedi.'}`)
        setOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  refundStatus: 'refund_failed',
                  refundError: data.error,
                }
              : o
          )
        )
        if (selectedOrder?.id === order.id) {
          setSelectedOrder((prev) =>
            prev
              ? {
                  ...prev,
                  refundStatus: 'refund_failed',
                  refundError: data.error,
                }
              : null
          )
        }
      }
    } catch (err: any) {
      alert(`İade işlemi sırasında bağlantı hatası oluştu: ${err?.message || err}`)
    } finally {
      setRefundingOrder(null)
    }
  }

  // Yalnızca HepsiJET Kargo Gönderisini İptal Et
  const handleCancelHepsiJetShipment = async (order: Order) => {
    const confirmed = window.confirm(
      `Sipariş #${order.orderNumber || order.id.slice(-8).toUpperCase()} için HepsiJET kargo kaydını iptal etmek istediğinize emin misiniz?\n\n` +
      `Barkod: ${order.shipping?.barcode || order.shipping?.customerDeliveryNo || '-'}` +
      `\n\nNot: Sipariş açık kalacak, yalnızca kargo kaydı iptal edilecektir.`
    )
    if (!confirmed) return

    setCancellingShipment(true)
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert('Oturum doğrulanamadı. Lütfen tekrar giriş yapın.')
        return
      }
      const token = await user.getIdToken()

      const res = await fetch('/api/admin/hepsijet/cancel-shipment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: order.id,
          reason: 'Yönetici tarafından HepsiJET kargo gönderisi iptal edildi.',
        }),
      })

      const json = await res.json()
      if (!res.ok || !json.success) {
        if (json.hepsijetDeleted && !json.firestoreUpdated) {
          alert(`⚠️ ${json.error || 'HepsiJET gönderisi silindi ancak siparişin yerel kaydı güncellenemedi. Sistem tekrar senkronizasyon bekliyor.'}`)
          return
        }
        throw new Error(json.error || 'HepsiJET kargo gönderisi iptal edilemedi.')
      }

      alert(`✅ ${json.message}`)

      // State'i güncelle: Sipariş başarıyla iptal edildi ve otomatik çöp kutusuna taşındı
      const updatedShipping: OrderShippingData = {
        ...(order.shipping as OrderShippingData),
        status: 'cancelled',
        cancelReason: 'Yönetici tarafından HepsiJET kargo gönderisi iptal edildi.',
        cancelledAt: json.cancellationRecord?.cancelledAt || new Date().toISOString(),
        cancelResult: 'SUCCESS',
        alreadyDeletedOnHepsiJet: json.alreadyDeleted,
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id
            ? {
                ...o,
                status: 'cancelled',
                isTrash: true,
                trashedAt: new Date().toISOString(),
                shipping: updatedShipping,
                cancellationHistory: [
                  ...(o.cancellationHistory || []),
                  json.cancellationRecord,
                ].filter(Boolean),
              }
            : o
        )
      )
      if (selectedOrder?.id === order.id) {
        setSelectedOrder((prev) =>
          prev
            ? {
                ...prev,
                status: 'cancelled',
                isTrash: true,
                trashedAt: new Date().toISOString(),
                shipping: updatedShipping,
                cancellationHistory: [
                  ...(prev.cancellationHistory || []),
                  json.cancellationRecord,
                ].filter(Boolean),
              }
            : null
        )
      }
    } catch (err: any) {
      console.error('Kargo iptal hatası:', err)
      alert(`⚠️ Kargo İptal Hatası: ${err.message || 'Bilinmeyen hata'}`)
    } finally {
      setCancellingShipment(false)
    }
  }

  // 1. Birleşik Etiketi Önizle (Modal Aç)
  const handlePreviewCombinedLabel = async (order: Order) => {
    setCombinedLoading(`preview-${order.id}`)
    try {
      const user = await getCurrentUser()
      if (!user) throw new Error('Oturum doğrulanamadı.')
      const token = await user.getIdToken()
      const presetQuery = activePreset ? `&preset=${encodeURIComponent(activePreset)}` : ''
      const res = await fetch(`/api/admin/hepsijet/combined-label?orderId=${encodeURIComponent(order.id)}${presetQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Birleşik etiket oluşturulamadı.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      setCombinedPdfPreview({
        isOpen: true,
        url,
        order,
      })
    } catch (err: any) {
      console.error('Birleşik etiket önizleme hatası:', err)
      alert(`❌ Birleşik Etiket Hatası:\n${err.message}`)
    } finally {
      setCombinedLoading(null)
    }
  }

  // 2. Birleşik Etiketi PDF Olarak İndir
  const handleDownloadCombinedLabel = async (order: Order) => {
    setCombinedLoading(`download-${order.id}`)
    try {
      const user = await getCurrentUser()
      if (!user) throw new Error('Oturum doğrulanamadı.')
      const token = await user.getIdToken()
      const presetQuery = activePreset ? `&preset=${encodeURIComponent(activePreset)}` : ''
      const res = await fetch(
        `/api/admin/hepsijet/combined-label?orderId=${encodeURIComponent(order.id)}&download=true${presetQuery}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Birleşik etiket indirilemedi.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `birlesik-etiket-${order.orderNumber || order.id.slice(-8)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => window.URL.revokeObjectURL(url), 2000)
    } catch (err: any) {
      console.error('Birleşik etiket indirme hatası:', err)
      alert(`❌ İndirme Hatası:\n${err.message}`)
    } finally {
      setCombinedLoading(null)
    }
  }

  // 3. Birleşik Etiketi Doğrudan Yazdır (Termal Yazıcı)
  const handlePrintCombinedLabel = async (order: Order) => {
    setCombinedLoading(`print-${order.id}`)
    try {
      const user = await getCurrentUser()
      if (!user) throw new Error('Oturum doğrulanamadı.')
      const token = await user.getIdToken()
      const presetQuery = activePreset ? `&preset=${encodeURIComponent(activePreset)}` : ''
      const res = await fetch(`/api/admin/hepsijet/combined-label?orderId=${encodeURIComponent(order.id)}${presetQuery}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Birleşik etiket yazdırma dosyası alınamadı.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)

      // Termal yazıcı penceresini doğru sayfa ölçüleriyle tetikle
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.top = '-9999px'
      iframe.style.left = '-9999px'
      iframe.style.width = isPortrait ? '100mm' : '150mm'
      iframe.style.height = isPortrait ? '150mm' : '100mm'
      iframe.style.border = '0'
      iframe.style.opacity = '0.01'
      iframe.style.pointerEvents = 'none'
      iframe.src = url
      document.body.appendChild(iframe)

      const cleanup = () => {
        setTimeout(() => {
          if (iframe.parentNode) iframe.parentNode.removeChild(iframe)
          window.URL.revokeObjectURL(url)
        }, 15000)
      }

      iframe.onload = () => {
        // Chrome PDF eklentisinin (MimeHandlerView) sayfayı tam render etmesi için 800ms gecikme ver
        setTimeout(() => {
          try {
            iframe.contentWindow?.focus()
            iframe.contentWindow?.print()
            cleanup()
          } catch {
            window.open(url, '_blank')
            cleanup()
          }
        }, 800)
      }
    } catch (err: any) {
      console.error('Birleşik etiket yazdırma hatası:', err)
      alert(`❌ Yazdırma Hatası:\n${err.message}`)
    } finally {
      setCombinedLoading(null)
    }
  }

  // HepsiJET Kargo Etiketini Yeni Sekmede Açma (PDF)
  const handleDownloadLabel = async (order: Order) => {
    setLabelLoading(order.id)
    try {
      const user = await getCurrentUser()
      if (!user) {
        alert('Oturum doğrulanamadı.')
        return
      }
      const token = await user.getIdToken()

      const res = await fetch(`/api/admin/hepsijet/label?orderId=${encodeURIComponent(order.id)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(json?.error || 'Kargo etiketi indirilemedi.')
      }

      const blob = await res.blob()
      const fileUrl = window.URL.createObjectURL(blob)
      window.open(fileUrl, '_blank')
    } catch (err: any) {
      console.error('Etiket indirme hatası:', err)
      alert(`❌ Kargo Etiketi Hatası: ${err.message}`)
    } finally {
      setLabelLoading(null)
    }
  }


  // Load Order Settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const db = getFirestoreDB()
        const sDoc = await getDoc(doc(db, 'settings', 'orders'))
        if (sDoc.exists()) {
          const d = sDoc.data()
          setAutoApprove(d.autoApprove ?? false)
          setAutoPrintPrompt(d.autoPrintPrompt ?? false)
        }
      } catch (err) {
        console.warn('Order settings fetch error:', err)
      }
    }
    loadSettings()
  }, [])

  // Listen to Orders in Real-Time & Auto-Print / Sound Notification / Auto-HepsiJET
  useEffect(() => {
    const db = getFirestoreDB()
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const list = snap.docs.map((d) => ({ ...d.data(), id: d.id, docId: d.id } as unknown as Order))

        if (isFirstLoad.current) {
          // İlk yükleme: mevcut tüm sipariş ID'lerini hafızaya al, bildirim verme
          knownOrderIdsRef.current = new Set(snap.docs.map((d) => d.id))
          isFirstLoad.current = false
        } else {
          // Sonraki anlık güncellemeler: gerçekten yeni eklenen siparişleri bul
          const newlyAdded = snap.docChanges()
            .filter((c) => c.type === 'added' && !knownOrderIdsRef.current.has(c.doc.id))
            .map((c) => ({ ...c.doc.data(), id: c.doc.id, docId: c.doc.id } as unknown as Order))

          if (newlyAdded.length > 0) {
            newlyAdded.forEach((ord) => knownOrderIdsRef.current.add(ord.id))
            const newest = newlyAdded[0]

            // 1. Sesli bildirim (kullanıcı tercihine ve autoplay kuralına uygun)
            if (soundEnabledRef.current) {
              playNewOrderChime()
            }

            // 2. Canlı Toast Bildirimi
            setNewOrderToast({
              id: newest.id,
              orderNumber: newest.orderNumber || newest.id.slice(-8).toUpperCase(),
              customerName: newest.shippingAddress?.fullName || newest.customer?.name || 'Müşteri',
              total: newest.total || 0,
              itemCount: newest.items?.length || 1,
              createdAt: newest.createdAt || new Date().toISOString(),
            })

            // 3. Oturum Yeni Sipariş Sayacı
            setSessionNewOrderCount((prev) => prev + newlyAdded.length)

            // 4. İsteğe bağlı otomatik fiş önizleme
            if (autoPrintPromptRef.current) {
              setPrintingOrder(newest)
              setTimeout(() => {
                try {
                  window.print()
                } catch (printErr) {
                  console.warn('Otomatik yazdırma uyarısı:', printErr)
                }
              }, 600)
            }
          }
        }

        setOrders(list)
        setLoading(false)
      },
      (err) => {
        console.error('Orders fetch error:', err?.message || String(err))
        setLoading(false)
      }
    )
    return () => unsub()
  }, [])


  const toggleAutoApprove = async () => {
    setSettingsLoading(true)
    const nextVal = !autoApprove
    setAutoApprove(nextVal)
    try {
      const db = getFirestoreDB()
      await setDoc(doc(db, 'settings', 'orders'), {
        autoApprove: nextVal,
        autoPrintPrompt,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
    } catch (err) {
      console.error('Save order settings error:', err)
      setAutoApprove(!nextVal)
    } finally {
      setSettingsLoading(false)
    }
  }

  const toggleAutoPrintPrompt = async () => {
    const nextVal = !autoPrintPrompt
    setAutoPrintPrompt(nextVal)
    try {
      const db = getFirestoreDB()
      await setDoc(doc(db, 'settings', 'orders'), {
        autoApprove,
        autoPrintPrompt: nextVal,
        updatedAt: new Date().toISOString(),
      }, { merge: true })
    } catch (err) {
      console.error('Save auto print settings error:', err)
      setAutoPrintPrompt(!nextVal)
    }
  }

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdating(orderId)
    try {
      const db = getFirestoreDB()
      const initialRef = doc(db, 'orders', orderId)
      const directSnap = await getDoc(initialRef)

      let resolvedRef = directSnap.exists() ? initialRef : null

      if (!resolvedRef) {
        // Fallback 1: orderNumber field
        const qByNum = query(collection(db, 'orders'), where('orderNumber', '==', orderId), limit(1))
        const numSnap = await getDocs(qByNum)
        if (!numSnap.empty) {
          resolvedRef = numSnap.docs[0].ref
        }
      }

      if (!resolvedRef) {
        // Fallback 2: merchant_oid field
        const qByOid = query(collection(db, 'orders'), where('merchant_oid', '==', orderId), limit(1))
        const oidSnap = await getDocs(qByOid)
        if (!oidSnap.empty) {
          resolvedRef = oidSnap.docs[0].ref
        }
      }

      if (!resolvedRef) {
        // Fallback 3: id field
        const qById = query(collection(db, 'orders'), where('id', '==', orderId), limit(1))
        const idSnap = await getDocs(qById)
        if (!idSnap.empty) {
          resolvedRef = idSnap.docs[0].ref
        }
      }

      if (!resolvedRef) {
        resolvedRef = initialRef
      }

      await setDoc(
        resolvedRef,
        {
          status: newStatus,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      )

      if (selectedOrder && (selectedOrder.id === orderId || (selectedOrder as any).docId === orderId || selectedOrder.orderNumber === orderId)) {
        setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null)
      }
    } catch (err: any) {
      console.warn('Status update warning:', err?.message || err)
      alert(`Durum güncellenirken bir sorun oluştu: ${err?.message || 'Bilinmeyen hata'}`)
    } finally {
      setUpdating(null)
    }
  }


  const handlePrintSlip = (order: Order) => {
    setPrintingOrder(order)
  }

  const executePrint = () => {
    window.print()
  }

  const nowMs = Date.now()

  // 24 saati aşmış, ödemesi onaylı ve kargo işlemi (barkod) bekleyen siparişler.
  // Ödeme bekleyenler dahil değildir; otomatik barkod/fiş baskısı bu uyarıyı beklemez.
  const unprocessed24hOrders = orders.filter((o) => isUnprocessed24h(o as any, nowMs))

  // Arşiv: elle arşivlenenler veya 15 günü geçmiş VE çözülmüş siparişler (hiçbir kayıt silinmez)
  const archivedOrders = orders.filter((o) => isInArchive(o as any, nowMs))

  // 15 günü aşmış ama çözülmemiş (ödeme/kargo bekleyen, kargo hatalı) siparişler: aktifte kalır, uyarı gösterilir
  const overdueBlockedOrders = orders.filter((o) => isOverdueButBlocked(o as any, nowMs))

  // Trash orders
  const trashOrders = orders.filter((o) => o.isTrash === true)

  // Active orders
  const activeOrders = orders.filter((o) => !o.isTrash && !isInArchive(o as any, nowMs))

  const maskTC = (tc?: string) => {
    if (!tc) return '-'
    const s = tc.trim()
    if (s.length < 5) return s
    return `${s.slice(0, 2)}*******${s.slice(-2)}`
  }

  const handleMoveToTrash = async (orderId: string) => {
    if (!window.confirm('Bu siparişi Çöp Kutusuna taşımak istediğinize emin misiniz? (Fatura ve ödeme kayıtları korunacaktır)')) return
    try {
      const db = getFirestoreDB()
      await setDoc(doc(db, 'orders', orderId), {
        isTrash: true,
        trashedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, isTrash: true, trashedAt: new Date().toISOString() } : o))
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, isTrash: true } : null)
      }
    } catch (err: any) {
      alert('Çöp kutusuna taşınamadı: ' + err.message)
    }
  }

  const handleRestoreFromTrash = async (orderId: string) => {
    try {
      const db = getFirestoreDB()
      await setDoc(doc(db, 'orders', orderId), {
        isTrash: false,
        restoredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, isTrash: false } : o))
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, isTrash: false } : null)
      }
    } catch (err: any) {
      alert('Geri yüklenemedi: ' + err.message)
    }
  }

  const handleMoveToArchive = async (orderId: string) => {
    try {
      const db = getFirestoreDB()
      await setDoc(doc(db, 'orders', orderId), {
        isArchived: true,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, isArchived: true, archivedAt: new Date().toISOString() } : o))
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, isArchived: true } : null)
      }
    } catch (err: any) {
      alert('Arşivlenemedi: ' + err.message)
    }
  }

  const handleRestoreFromArchive = async (orderId: string) => {
    try {
      const db = getFirestoreDB()
      await setDoc(doc(db, 'orders', orderId), {
        isArchived: false,
        unarchivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, { merge: true })
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, isArchived: false } : o))
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, isArchived: false } : null)
      }
    } catch (err: any) {
      alert('Aktif siparişlere geri alınamadı: ' + err.message)
    }
  }

  const handlePermanentDelete = async (order: Order) => {
    const confirmation = window.prompt(
      `DİKKAT: Kalıcı Silme İşlemi!\n` +
      `Sipariş #${order.orderNumber || order.id.slice(-8)} veritabanından kalıcı olarak silinecektir.\n` +
      `Yasal ve muhasebe saklama yükümlülüklerini göz önünde bulundurunuz.\n\n` +
      `Onaylamak için büyük harflerle SİL yazınız:`
    )
    if (confirmation !== 'SİL') {
      alert('İşlem iptal edildi.')
      return
    }
    try {
      const db = getFirestoreDB()
      await deleteDoc(doc(db, 'orders', order.id))
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(null)
      }
      alert('Sipariş kalıcı olarak silindi.')
    } catch (err: any) {
      alert('Silinemedi: ' + err.message)
    }
  }

  const currentTabOrders =
    viewTab === 'unprocessed24h'
      ? unprocessed24hOrders
      : viewTab === 'archive'
      ? archivedOrders
      : viewTab === 'trash'
      ? trashOrders
      : activeOrders

  const filtered = currentTabOrders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const matchAutomation =
      automationFilter === 'all' ||
      (automationFilter === 'ready' && o.shipping?.automationStatus === 'ready') ||
      (automationFilter === 'pending_review' && o.shipping?.automationStatus === 'pending_review')
    const q = search.toLowerCase()
    const matchSearch = !q ||
      o.customer?.name?.toLowerCase().includes(q) ||
      o.customer?.email?.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.orderNumber?.toLowerCase().includes(q) ||
      o.billingInfo?.companyName?.toLowerCase().includes(q)
    return matchStatus && matchAutomation && matchSearch
  })

  const readyForDispatchCount = currentTabOrders.filter((o) => o.shipping?.automationStatus === 'ready').length
  const pendingReviewCount = currentTabOrders.filter((o) => o.shipping?.automationStatus === 'pending_review').length

  // Stats (ortak orderStats yardımcısı ile hesaplanır)
  const stats = calculateOrderStats(orders, nowMs)

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      }).format(new Date(dateStr))
    } catch {
      return dateStr
    }
  }

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n || 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Siparişler yükleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sipariş Yönetimi & Fiş Sistemi</h1>
          <p className="text-gray-500 mt-1">Siparişleri izleyin, otomatik/manuel onaylayın ve kargo fişi yazdırın</p>
        </div>

        {/* Order Intake Mode Setting Toggles */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2.5 rounded-2xl border border-gray-200 shadow-xs">
          
          {/* Auto Approve Mode Button */}
          <button
            onClick={toggleAutoApprove}
            disabled={settingsLoading}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              autoApprove
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
            }`}
            title="Otomatik Onay: Yeni gelen siparişler doğrudan 'Hazırlanıyor' aşamasına geçer. Manuel Mod: 'Bekliyor' aşamasında onayınızı bekler."
          >
            {autoApprove ? (
              <>
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span>🟢 Otomatik Onay Aktif</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>🟡 Manuel Onay Modu (Bekleyenler)</span>
              </>
            )}
          </button>

          {/* Auto Print Prompt Toggle */}
          <button
            onClick={toggleAutoPrintPrompt}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              autoPrintPrompt
                ? 'bg-sky-50 text-sky-700 border-sky-300 font-bold'
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
            }`}
            title="Açıkken sayfaya yeni sipariş düştüğünde otomatik fiş yazdırma ekranı açılır"
          >
            <FiPrinter className="w-3.5 h-3.5" />
            <span>{autoPrintPrompt ? 'Oto-Fiş Açık' : 'Oto-Fiş Kapalı'}</span>
          </button>

          {/* Sound Notification Toggle */}
          <button
            onClick={toggleSound}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
            }`}
            title="Yeni sipariş geldiğinde sesli uyarı çal"
          >
            {soundEnabled ? <FiVolume2 className="w-3.5 h-3.5" /> : <FiVolumeX className="w-3.5 h-3.5" />}
            <span>{soundEnabled ? 'Ses Açık' : 'Ses Kapalı'}</span>
          </button>

          {/* Session New Orders Badge */}
          {sessionNewOrderCount > 0 && (
            <span
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black bg-rose-600 text-white shadow-xs"
              title="Bu oturumda sayfaya yeni düşen sipariş sayısı"
            >
              🔥 {sessionNewOrderCount} Yeni
            </span>
          )}
        </div>
      </div>

      {/* Gerçek Zamanlı Yeni Sipariş Toast Bildirimi */}
      <AnimatePresence>
        {newOrderToast && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            className="p-4 mb-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600 text-white rounded-2xl shadow-lg flex items-center justify-between gap-4 border border-white/20"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-xl flex-shrink-0">
                🔔
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-black text-sm uppercase tracking-wide">Yeni Sipariş Geldi!</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-white/25">
                    #{newOrderToast.orderNumber}
                  </span>
                </div>
                <p className="text-xs text-emerald-50 mt-0.5 truncate">
                  {newOrderToast.customerName} • {formatPrice(newOrderToast.total)} • {newOrderToast.itemCount} ürün
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  const found = orders.find((o) => o.id === newOrderToast.id || o.orderNumber === newOrderToast.orderNumber)
                  if (found) setSelectedOrder(found)
                  setNewOrderToast(null)
                }}
                className="px-3.5 py-1.5 bg-white text-emerald-900 rounded-xl text-xs font-black hover:bg-emerald-50 transition-all shadow-xs"
              >
                Görüntüle
              </button>
              <button
                onClick={() => setNewOrderToast(null)}
                className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10"
                title="Kapat"
              >
                <FiX className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-8">
        {[
          { label: 'Toplam Sipariş', value: stats.total, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Bekliyor', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Hazırlanıyor', value: stats.processing, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Kargoda', value: stats.shipped, color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Teslim Edildi', value: stats.delivered, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'İptal Edildi', value: stats.cancelled, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'İade Edildi', value: stats.returned, color: 'text-purple-700', bg: 'bg-purple-50' },
          { label: 'Toplam Gelir', value: formatPrice(stats.revenue), color: 'text-primary-700', bg: 'bg-primary-50' },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bg} border border-gray-200 rounded-xl p-4`}
          >
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* 15 Günü Aşan Çözülmemiş Sipariş Uyarısı (arşive taşınmadı) */}
      {overdueBlockedOrders.length > 0 && (
        <div className="bg-red-500/10 border-2 border-red-500/30 rounded-2xl p-4 mb-6 text-red-950 text-xs">
          <div className="font-black text-sm mb-1">
            15 günü geçen {overdueBlockedOrders.length} sipariş çözülmediği için arşive taşınmadı
          </div>
          <ul className="space-y-1">
            {overdueBlockedOrders.slice(0, 8).map((ord) => (
              <li
                key={ord.id}
                onClick={() => setSelectedOrder(ord)}
                className="cursor-pointer hover:underline"
              >
                <span className="font-mono font-bold">#{ord.orderNumber || ord.id.slice(-8).toUpperCase()}</span>{' '}
                — {getArchiveBlockers(ord as any).map((r) => ARCHIVE_BLOCK_LABELS[r]).join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 24 Saatlik Bekleme Uyarısı Bildirim Kartı */}
      {unprocessed24hOrders.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl p-4 sm:p-5 mb-6 text-amber-950 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black flex-shrink-0 shadow-sm shadow-amber-600/30 animate-pulse">
                <FiAlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-amber-900 text-sm sm:text-base flex items-center gap-2">
                  <span>24 Saati Aşan İşlem Yapılmamış Sipariş Uyarısı</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-black bg-amber-200 text-amber-900">
                    {unprocessed24hOrders.length} Sipariş
                  </span>
                </h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Aşağıdaki siparişler oluşturulduktan sonra 24 saatten uzun süredir bekliyor durumundadır. Lütfen kontrol edip işleme alınız.
                </p>
              </div>
            </div>
            <button
              onClick={() => setViewTab('unprocessed24h')}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex-shrink-0 self-start sm:self-auto"
            >
              Bekleyenleri Filtrele ({unprocessed24hOrders.length})
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-amber-500/20 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {unprocessed24hOrders.slice(0, 6).map((ord) => {
              const diffHours = Math.floor((nowMs - new Date(ord.createdAt).getTime()) / (1000 * 60 * 60))
              return (
                <div
                  key={ord.id}
                  onClick={() => setSelectedOrder(ord)}
                  className="p-2.5 bg-white/90 hover:bg-white rounded-xl border border-amber-300/60 flex items-center justify-between gap-2 cursor-pointer transition-all hover:shadow-xs"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-black text-slate-900 truncate">
                      #{ord.orderNumber || ord.id.slice(-8).toUpperCase()}
                    </p>
                    <p className="text-[11px] text-slate-600 truncate">{ord.customer?.name || '-'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                      {diffHours}s önce
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* HepsiJET Anlık Otomasyon ve Termal Yazdırma Durum Kartı */}
      <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-emerald-50 border border-orange-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black flex-shrink-0 shadow-sm shadow-orange-600/30">
            <FiZap className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-sm">Sipariş Bazlı Otomatik HepsiJET & Print Agent</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                ⚡ Anlık Mod (Saat Beklemesiz)
              </span>
            </div>
            <p className="text-slate-600 mt-0.5">
              Ödemesi başarılı olan her siparişte kargo kaydı ve birleşik fiş anında oluşturulur, Windows Print Agent kuyruğuna iletilir.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <a
            href="/admin/ayarlar?tab=hepsijet&sub=automation"
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition-all shadow-sm shadow-orange-600/20 text-xs"
          >
            <span>⚙️ Otomasyon Ayarları</span>
            <FiExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* 4 Ana Görünüm Sekmesi: Aktif, 24s Bekleyen, 15 Gün Arşiv, Çöp Kutusu */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setViewTab('active')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            viewTab === 'active'
              ? 'bg-slate-900 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FiShoppingBag className="w-4 h-4" />
          <span>Aktif Siparişler</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-900 font-bold">
            {activeOrders.length}
          </span>
        </button>

        <button
          onClick={() => setViewTab('unprocessed24h')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            viewTab === 'unprocessed24h'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-white border border-amber-200 text-amber-800 hover:bg-amber-50'
          }`}
        >
          <FiClock className="w-4 h-4 text-amber-600" />
          <span>24s İşlem Bekleyen</span>
          {unprocessed24hOrders.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
              {unprocessed24hOrders.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setViewTab('archive')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            viewTab === 'archive'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FiArchive className="w-4 h-4" />
          <span>Arşiv (24s / 15 Gün)</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 font-bold">
            {archivedOrders.length}
          </span>
        </button>

        <button
          onClick={() => setViewTab('trash')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
            viewTab === 'trash'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <FiTrash2 className="w-4 h-4" />
          <span>Çöp Kutusu</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-50 text-rose-700 font-bold">
            {trashOrders.length}
          </span>
        </button>

        <div className="ml-auto flex items-center gap-2 w-full sm:w-auto justify-end">
          {lastTrackingSyncAt && (
            <span className="text-[11px] text-slate-400 hidden sm:inline">
              Son kargo güncellemesi: {lastTrackingSyncAt}
            </span>
          )}
          <button
            type="button"
            onClick={() => handleSyncAllTracking(true)}
            disabled={isSyncingTracking}
            className="flex items-center gap-1.5 px-3 py-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            title="HepsiJET API'sinden tüm aktif kargoların son hareket ve teslimat durumunu çeker"
          >
            <FiRefreshCw className={`w-3.5 h-3.5 ${isSyncingTracking ? 'animate-spin text-sky-600' : ''}`} />
            <span>{isSyncingTracking ? 'Sorgulanıyor...' : 'Kargoları Senkronize Et'}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-6 flex flex-col sm:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Sipariş no, müşteri adı veya e-posta ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-primary-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Tümü ({orders.length})
          </button>
          {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG.pending][]).map(([s, cfg]) => {
            const count = orders.filter((o) => o.status === s).length
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                  statusFilter === s
                    ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-current`
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {cfg.label} ({count})
              </button>
            )
          })}
          {readyForDispatchCount > 0 && (
            <button
              onClick={() => setAutomationFilter(automationFilter === 'ready' ? 'all' : 'ready')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                automationFilter === 'ready'
                  ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-400'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              }`}
            >
              ✓ Gönderime Hazır ({readyForDispatchCount})
            </button>
          )}
          {pendingReviewCount > 0 && (
            <button
              onClick={() => setAutomationFilter(automationFilter === 'pending_review' ? 'all' : 'pending_review')}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                automationFilter === 'pending_review'
                  ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-400'
                  : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
              }`}
            >
              ⚠ Onay Bekleyen ({pendingReviewCount})
            </button>
          )}
        </div>
      </div>

      {/* Orders List */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <FiShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Sipariş bulunamadı</p>
            <p className="text-xs text-gray-400 mt-1">Arama kriterlerinizi değiştirmeyi deneyin</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((order) => {
              const commonStatus = getCommonOrderDisplayStatus(order)
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
              const StatusIcon = cfg.icon
              const isExpanded = expandedOrder === order.id

              return (
                <div key={order.id} className="transition-colors hover:bg-gray-50/70">
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    
                    {/* Order Number & Date */}
                    <div className="min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-black text-gray-900">
                          #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                        </span>
                        {order.status === 'pending' && (
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
                      {order.shipping?.barcode && (
                        <div className="mt-1">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200"
                            title={`HepsiJET Kargo Barkodu: ${order.shipping.barcode}`}
                          >
                            <FiTruck className="w-3 h-3 text-orange-600" />
                            {order.shipping.barcode}
                          </span>
                        </div>
                      )}
                      {!order.shipping?.barcode && order.shipping?.automationStatus === 'ready' && (
                        <div className="mt-1">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200"
                            title="HepsiJET Otomasyon: Tüm kontroller tamamlandı, gönderim için hazır"
                          >
                            ✓ Gönderime Hazır
                          </span>
                        </div>
                      )}
                      {!order.shipping?.barcode && order.shipping?.automationStatus === 'pending_review' && (
                        <div className="mt-1">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200"
                            title={order.shipping?.automationReasons?.join('; ') || 'Yönetici onayı bekliyor'}
                          >
                            ⚠ İnceleme Bekliyor
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Customer & Type Badge */}
                    <div className="min-w-[190px]">
                      {(() => {
                        const isCorporate = order.customerType === 'corporate' || order.billingInfo?.type === 'corporate'
                        const tcVal = order.billingInfo?.tcKimlikNo || order.tcKimlikNo
                        const companyName = order.billingInfo?.companyName || order.billingAddress?.companyName

                        return (
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-bold text-gray-900 text-sm">{order.customer?.name || '-'}</p>
                              {isCorporate ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  <FiBriefcase className="w-3 h-3 text-indigo-600" />
                                  Kurumsal
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                  <FiUser className="w-3 h-3 text-slate-500" />
                                  Bireysel
                                </span>
                              )}
                            </div>
                            {isCorporate && companyName && (
                              <p className="text-[11px] font-semibold text-indigo-900 truncate max-w-[200px]" title={companyName}>
                                {companyName}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">{order.customer?.phone || order.customer?.email}</p>
                            {tcVal && (
                              <p className="text-[10px] text-gray-400 font-mono">
                                TC: {maskTC(tcVal)}
                              </p>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Location */}
                    <div className="min-w-[140px] text-xs text-gray-600">
                      <p className="font-semibold text-gray-800">
                        {order.shippingAddress?.district ? `${order.shippingAddress.district}, ` : ''}{order.shippingAddress?.city || 'İstanbul'}
                      </p>
                      <p className="text-gray-400 truncate max-w-[180px]">{order.shippingAddress?.address}</p>
                    </div>

                    {/* Total & Items */}
                    <div className="min-w-[120px]">
                      <p className="font-black text-gray-900 text-sm">{formatPrice(order.total)}</p>
                      <p className="text-xs text-gray-400">{order.items?.length || 1} ürün</p>
                    </div>

                    {/* Status Badge */}
                    <div className="min-w-[130px] flex flex-col items-start gap-1">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${commonStatus.bg} ${commonStatus.color} ${commonStatus.border}`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {commonStatus.text}
                      </span>
                      {order.refundStatus === 'refunded' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          ✓ İade Edildi
                        </span>
                      )}
                      {order.refundStatus === 'refund_failed' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200" title={order.refundError || 'İade başarısız'}>
                          ⚠ İade Başarısız
                        </span>
                      )}
                      {order.refundStatus === 'processing_refund' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          ⏳ İade İşleniyor
                        </span>
                      )}
                      {order.refundStatus === 'pending_refund' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-md border border-orange-200">
                          ⏳ İade Bekliyor
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* One Click Print Combined Label or Slip */}
                      {order.shipping?.status === 'created' ? (
                        <button
                          type="button"
                          onClick={() => handlePrintCombinedLabel(order)}
                          disabled={combinedLoading === `print-${order.id}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all shadow-sm shadow-orange-600/30 disabled:opacity-50"
                          title={`HepsiJET + KALIPORT Birleşik Termal Baskı (${presetDimensionsLabel})`}
                        >
                          <FiPrinter className="w-3.5 h-3.5" />
                          <span>{combinedLoading === `print-${order.id}` ? '...' : 'Birleşik Etiket'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePrintSlip(order)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-xl text-xs font-bold transition-colors shadow-2xs"
                          title="Fiş / Kargo Fişi Yazdır"
                        >
                          <FiPrinter className="w-3.5 h-3.5" />
                          <span>Fiş Yazdır</span>
                        </button>
                      )}

                      {/* Quick Status Approve Button (if pending) */}
                      {order.status === 'pending' && (
                        <button
                          onClick={() => updateStatus(order.id, 'processing')}
                          disabled={updating === order.id}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs flex items-center gap-1"
                        >
                          <FiCheck className="w-3.5 h-3.5" />
                          <span>Onayla</span>
                        </button>
                      )}

                      {/* Detail View */}
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded-xl transition-colors"
                        title="Detay Görüntüle"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>

                      {/* Trash / Archive Context Actions */}
                      {viewTab === 'trash' ? (
                        <>
                          <button
                            onClick={() => handleRestoreFromTrash(order.id)}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors"
                            title="Aktif Siparişlere Geri Yükle"
                          >
                            <FiRefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handlePermanentDelete(order)}
                            className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            title="Kalıcı Olarak Sil (Geri Alınamaz)"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : viewTab === 'archive' ? (
                        <>
                          <button
                            onClick={() => handleRestoreFromArchive(order.id)}
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="Aktif Listeye Geri Al"
                          >
                            <FiRefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveToTrash(order.id)}
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            title="Çöp Kutusuna Taşı"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleMoveToArchive(order.id)}
                            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="15 Günlük Arşive Taşı"
                          >
                            <FiArchive className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleMoveToTrash(order.id)}
                            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                            title="Çöp Kutusuna Taşı"
                          >
                            <FiTrash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}

                      {/* Expand Button */}
                      <button
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                        title="Hızlı Durum Değiştir"
                      >
                        {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                      </button>
                    </div>

                  </div>

                  {/* Expanded Status Bar */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-5 pb-4 bg-gray-50/80 border-t border-gray-100"
                      >
                        <div className="pt-3 flex items-center justify-between gap-4 flex-wrap">
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Durumu Değiştir:</p>
                          <div className="flex flex-wrap gap-2">
                            {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG.pending][]).map(([s, c]) => (
                              <button
                                key={s}
                                disabled={order.status === s || updating === order.id}
                                onClick={() => updateStatus(order.id, s)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                                  order.status === s
                                    ? `${c.bg} ${c.color} ${c.border} ring-2 ring-offset-1 ring-current`
                                    : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                                }`}
                              >
                                <c.icon className="w-3.5 h-3.5" />
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. ORDER DETAIL MODAL                                                    */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Sipariş #{selectedOrder.orderNumber || selectedOrder.id.slice(-8).toUpperCase()}
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedOrder.shipping?.status === 'created' && (
                    <button
                      type="button"
                      onClick={() => handlePrintCombinedLabel(selectedOrder)}
                      disabled={combinedLoading === `print-${selectedOrder.id}`}
                      className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all shadow-sm shadow-orange-600/30 disabled:opacity-50"
                    >
                      <FiPrinter className="w-4 h-4" />
                      <span>{combinedLoading === `print-${selectedOrder.id}` ? '...' : 'Birleşik Etiket'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => handlePrintSlip(selectedOrder)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-xl text-xs font-bold border border-sky-200 transition-colors"
                  >
                    <FiPrinter className="w-4 h-4" />
                    <span>Fiş</span>
                  </button>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* Status Options */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Sipariş Durumu</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG.pending][]).map(([s, cfg]) => (
                      <button
                        key={s}
                        disabled={selectedOrder.status === s || updating === selectedOrder.id}
                        onClick={() => updateStatus(selectedOrder.id, s)}
                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                          selectedOrder.status === s
                            ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current`
                            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <cfg.icon className="w-3.5 h-3.5" />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer, Shipping & Payment Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5 mb-2">
                      <FiUser className="w-4 h-4 text-sky-600" /> Müşteri Bilgileri
                    </p>
                    <p><strong>Ad Soyad:</strong> {selectedOrder.customer?.name || '-'}</p>
                    <p><strong>E-Posta:</strong> {selectedOrder.customer?.email || '-'}</p>
                    <p><strong>Telefon:</strong> {selectedOrder.customer?.phone || '-'}</p>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5 mb-2">
                      <FiMapPin className="w-4 h-4 text-emerald-600" /> Teslimat Adresi
                    </p>
                    <p><strong>Şehir / İlçe:</strong> {selectedOrder.shippingAddress?.district ? `${selectedOrder.shippingAddress.district}, ` : ''}{selectedOrder.shippingAddress?.city || 'İstanbul'}</p>
                    <p><strong>Açık Adres:</strong> {selectedOrder.shippingAddress?.address || '-'}</p>
                  </div>

                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-xs">
                    <p className="font-bold text-gray-900 text-sm flex items-center gap-1.5 mb-2">
                      <FiShield className="w-4 h-4 text-indigo-600" /> Ödeme & İşlem
                    </p>
                    <p>
                      <strong>Yöntem:</strong>{' '}
                      {selectedOrder.paymentMethod === 'paytr_iframe'
                        ? 'PayTR 3D Secure'
                        : selectedOrder.paymentMethod === 'iyzico_3d_secure'
                        ? 'Kredi Kartı'
                        : 'Havale / EFT'}
                    </p>
                    <p>
                      <strong>Durum:</strong>{' '}
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        selectedOrder.paymentStatus === 'PAID'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedOrder.paymentStatus === 'FAILED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedOrder.paymentStatus === 'PAID'
                          ? 'ÖDENDİ (PAID)'
                          : selectedOrder.paymentStatus === 'FAILED'
                          ? 'BAŞARISIZ'
                          : 'BEKLİYOR'}
                      </span>
                    </p>
                    {selectedOrder.orderNumber && (
                      <p className="truncate"><strong>Ref (OID):</strong> {selectedOrder.orderNumber}</p>
                    )}

                    {/* Havale / EFT Ödeme Onaylama Aksiyonu */}
                    {selectedOrder.paymentStatus !== 'PAID' && selectedOrder.status !== 'cancelled' && (
                      <div className="pt-2 border-t border-gray-200 mt-2">
                        <button
                          type="button"
                          onClick={() => handleConfirmBankPayment(selectedOrder)}
                          disabled={confirmingPayment === selectedOrder.id}
                          className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                        >
                          {confirmingPayment === selectedOrder.id ? (
                            <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FiCheckCircle className="w-3.5 h-3.5" />
                          )}
                          <span>💰 Havale/EFT Ödemesini Onayla (PAID)</span>
                        </button>
                      </div>
                    )}

                    {/* PayTR İade Durumu & Yönetici Aksiyonu */}
                    {Boolean(selectedOrder.refundStatus && selectedOrder.refundStatus !== 'none' && selectedOrder.refundStatus !== 'no_refund_needed') && (
                      <div className="pt-2 border-t border-gray-200 mt-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-gray-700">İade Durumu:</span>
                          <span className={`px-2 py-0.5 rounded-full font-black text-[10px] ${
                            selectedOrder.refundStatus === 'refunded'
                              ? 'bg-emerald-100 text-emerald-800'
                              : selectedOrder.refundStatus === 'refund_failed'
                              ? 'bg-rose-100 text-rose-800'
                              : selectedOrder.refundStatus === 'processing_refund'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-orange-100 text-orange-800'
                          }`}>
                            {selectedOrder.refundStatus === 'refunded'
                              ? `İADE EDİLDİ (${selectedOrder.refundedAmountTRY || selectedOrder.total} TL)`
                              : selectedOrder.refundStatus === 'refund_failed'
                              ? 'İADE BAŞARISIZ'
                              : selectedOrder.refundStatus === 'processing_refund'
                              ? 'İŞLENİYOR'
                              : 'İADE BEKLİYOR'}
                          </span>
                        </div>
                        {selectedOrder.refundError && (
                          <p className="text-[11px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-200 leading-tight">
                            <strong>Hata:</strong> {selectedOrder.refundError}
                          </p>
                        )}
                        {selectedOrder.refundStatus !== 'refunded' && (
                          <button
                            type="button"
                            onClick={() => handleTriggerRefund(selectedOrder)}
                            disabled={refundingOrder === selectedOrder.id}
                            className="w-full mt-2 py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {refundingOrder === selectedOrder.id ? (
                              <FiRefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <FiRefreshCw className="w-3 h-3" />
                            )}
                            <span>PayTR İadeyi Tekrar Dene</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* İade henüz başlatılmamış ama sipariş iptal edilmiş ve ödenmişse */}
                    {(!selectedOrder.refundStatus || selectedOrder.refundStatus === 'none') &&
                      selectedOrder.status === 'cancelled' &&
                      (selectedOrder.paymentStatus === 'PAID' || selectedOrder.paymentStatus === 'paid') && (
                        <div className="pt-2 border-t border-gray-200 mt-2">
                          <button
                            type="button"
                            onClick={() => handleTriggerRefund(selectedOrder)}
                            disabled={refundingOrder === selectedOrder.id}
                            className="w-full py-1.5 px-3 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            {refundingOrder === selectedOrder.id ? (
                              <FiRefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <FiRefreshCw className="w-3 h-3" />
                            )}
                            <span>PayTR Otomatik İadeyi Başlat</span>
                          </button>
                        </div>
                    )}
                  </div>
                </div>

                {/* 2. Fatura ve Müşteri Türü Bilgileri (Bireysel / Kurumsal) */}
                {(() => {
                  const isCorporate = selectedOrder.customerType === 'corporate' || selectedOrder.billingInfo?.type === 'corporate'
                  const bInfo = selectedOrder.billingInfo || {}
                  const bAddr = selectedOrder.billingAddress || {}
                  const tcNum = bInfo.tcKimlikNo || selectedOrder.tcKimlikNo || bAddr.tcKimlikNo
                  const compName = bInfo.companyName || bAddr.companyName
                  const taxOff = bInfo.taxOffice || bAddr.taxOffice
                  const taxNum = bInfo.taxNumber || bAddr.taxNumber
                  const authPerson = bInfo.authorizedPerson
                    ? `${bInfo.authorizedPerson.name || ''} ${bInfo.authorizedPerson.surname || ''}`.trim()
                    : bInfo.fullName || '-'

                  return (
                    <div className="bg-slate-50/80 rounded-2xl p-5 border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <FiFileText className="w-4 h-4 text-primary-600" />
                          <h4 className="font-bold text-gray-900 text-sm">Fatura ve Müşteri Türü Bilgileri</h4>
                        </div>
                        {isCorporate ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-2xs">
                            <FiBriefcase className="w-3.5 h-3.5" />
                            Kurumsal Fatura
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300">
                            <FiUser className="w-3.5 h-3.5" />
                            Bireysel Fatura
                          </span>
                        )}
                      </div>

                      {isCorporate ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-400 block">Firma Tam Unvanı:</span>
                            <strong className="text-gray-900 font-bold text-sm block mt-0.5">{compName || '-'}</strong>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Yetkili Kişi:</span>
                            <span className="text-gray-800 font-medium block mt-0.5">{authPerson || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Vergi Dairesi:</span>
                            <span className="text-gray-800 font-semibold block mt-0.5">{taxOff || '-'}</span>
                          </div>
                          <div>
                            <span className="text-gray-400 block">Vergi Numarası:</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono font-bold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                {taxNum || '-'}
                              </span>
                              {taxNum && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(taxNum)
                                    alert('Vergi Numarası kopyalandı!')
                                  }}
                                  className="text-gray-400 hover:text-indigo-600 p-1"
                                  title="Kopyala"
                                >
                                  <FiCopy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-gray-400 block">Fatura Adresi:</span>
                            <span className="text-gray-800 block mt-0.5">
                              {bInfo.address || bAddr.address || selectedOrder.shippingAddress?.address || '-'}
                              {' '}({bInfo.district || bAddr.district || selectedOrder.shippingAddress?.district || '-'} / {bInfo.city || bAddr.city || selectedOrder.shippingAddress?.city || '-'})
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-gray-400 block">Müşteri Adı Soyadı:</span>
                            <strong className="text-gray-900 font-bold text-sm block mt-0.5">
                              {bInfo.fullName || selectedOrder.customer?.name || '-'}
                            </strong>
                          </div>
                          <div>
                            <span className="text-gray-400 block">T.C. Kimlik Numarası (Yetkili Görünüm):</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 shadow-2xs">
                                {tcNum || 'Belirtilmedi'}
                              </span>
                              {tcNum && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(tcNum)
                                    alert('T.C. Kimlik No kopyalandı!')
                                  }}
                                  className="text-gray-400 hover:text-slate-800 p-1"
                                  title="Kopyala"
                                >
                                  <FiCopy className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="sm:col-span-2">
                            <span className="text-gray-400 block">Fatura Adresi:</span>
                            <span className="text-gray-800 block mt-0.5">
                              {bInfo.address || bAddr.address || selectedOrder.shippingAddress?.address || '-'}
                              {' '}({bInfo.district || bAddr.district || selectedOrder.shippingAddress?.district || '-'} / {bInfo.city || bAddr.city || selectedOrder.shippingAddress?.city || '-'})
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* HepsiJET Kargo Entegrasyonu Kartı */}
                <div className="bg-gradient-to-br from-orange-50/60 to-amber-50/40 rounded-2xl p-5 border border-orange-200/80 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                        HJ
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900 text-sm">HepsiJET Kargo Gönderisi</h4>
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">
                            Konya Çıkışlı
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          {selectedOrder.shipping?.status === 'created'
                            ? 'Kargo gönderisi başarıyla oluşturuldu ve sisteme işlendi.'
                            : selectedOrder.shipping?.status === 'creating'
                            ? 'Kargo oluşturma isteği şu anda işleniyor...'
                            : selectedOrder.shipping?.status === 'cancel_pending'
                            ? 'Kargo iptal isteği HepsiJET servisine iletiliyor...'
                            : selectedOrder.shipping?.status === 'cancelled'
                            ? 'Kargo gönderisi iptal edilmiştir.'
                            : selectedOrder.shipping?.status === 'cancel_failed'
                            ? 'Kargo iptal isteği reddedildi veya yönetici incelemesi gerekmektedir.'
                            : selectedOrder.shipping?.status === 'unknown'
                            ? 'Kargo durumu belirsiz (Zaman aşımı / servis yanıt vermedi).'
                            : selectedOrder.shipping?.status === 'simulated'
                            ? 'Simülasyon modu — gerçek kargo gönderisi oluşturulmadı.'
                            : selectedOrder.shipping?.status === 'failed'
                            ? 'Önceki gönderi oluşturma denemesi başarısız oldu.'
                            : 'Henüz kargo kaydı oluşturulmadı.'}
                        </p>
                      </div>
                    </div>

                    {/* Durum Rozeti */}
                    <div>
                      {selectedOrder.shipping?.status === 'created' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <FiCheckCircle className="w-3.5 h-3.5" />
                          Kargo Hazır
                        </span>
                      ) : selectedOrder.shipping?.status === 'creating' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                          <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Oluşturuluyor
                        </span>
                      ) : selectedOrder.shipping?.status === 'cancel_pending' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                          İptal Ediliyor...
                        </span>
                      ) : selectedOrder.shipping?.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <FiXCircle className="w-3.5 h-3.5" />
                          Kargo İptal Edildi
                        </span>
                      ) : selectedOrder.shipping?.status === 'cancel_failed' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          İptal Başarısız
                        </span>
                      ) : selectedOrder.shipping?.status === 'unknown' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          Kargo Belirsiz
                        </span>
                      ) : selectedOrder.shipping?.automationStatus === 'ready' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <FiCheckCircle className="w-3.5 h-3.5" />
                          Gönderime Hazır
                        </span>
                      ) : selectedOrder.shipping?.automationStatus === 'pending_review' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          İnceleme Bekliyor
                        </span>
                      ) : selectedOrder.shipping?.status === 'simulated' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-violet-100 text-violet-800 border border-violet-300">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          Simülasyon
                        </span>
                      ) : selectedOrder.shipping?.status === 'failed' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          Gönderi Başarısız
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                          <FiClock className="w-3.5 h-3.5" />
                          Kargo Bekliyor
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Kargo İptal / Hata Uyarısı */}
                  {(selectedOrder.shipping?.cancelFailedReason || selectedOrder.shipping?.status === 'cancel_failed' || selectedOrder.shipping?.status === 'unknown') && (
                    <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 space-y-1">
                      <p className="font-bold flex items-center gap-1.5 text-rose-800">
                        <FiAlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        Kargo İptal Uyarısı (Yönetici İncelemesi Gerekli):
                      </p>
                      <p className="text-[11px] leading-relaxed text-rose-700">
                        {selectedOrder.shipping?.cancelFailedReason || selectedOrder.shipping?.error || 'Kargo iptali HepsiJET sistemi tarafından onaylanmadı veya sonuç belirsiz kaldı. Lütfen HepsiJET paneli üzerinden kurye/teslimat durumunu kontrol ediniz.'}
                      </p>
                    </div>
                  )}

                  {/* Otomasyon Analiz Gerekçeleri (Eğer Varsa) */}
                  {selectedOrder.shipping?.automationReasons && selectedOrder.shipping.automationReasons.length > 0 && (
                    <div className={`p-3.5 rounded-xl text-xs space-y-1.5 ${
                      selectedOrder.shipping.automationStatus === 'ready'
                        ? 'bg-emerald-50/80 border border-emerald-200 text-emerald-900'
                        : 'bg-amber-50/80 border border-amber-200 text-amber-900'
                    }`}>
                      <p className="font-bold flex items-center gap-1.5">
                        <FiInfo className="w-3.5 h-3.5" />
                        Otomasyon Kontrol Raporu:
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90">
                        {selectedOrder.shipping.automationReasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Kargo Detayları (Barkod, Takip No vb.) */}
                  {selectedOrder.shipping?.barcode && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white/90 rounded-2xl p-4 border border-orange-200 text-xs shadow-xs">
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Barkod / Gönderi No</span>
                        <span className="font-mono font-black text-orange-600 text-sm">
                          {selectedOrder.shipping.barcode || selectedOrder.shipping.customerDeliveryNo || '-'}
                        </span>
                        {selectedOrder.shipping.displayStatus && (
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            {selectedOrder.shipping.displayStatus}
                          </span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Kargo Takibi</span>
                        {(selectedOrder.shipping.trackingUrl || selectedOrder.shipping.barcode) ? (
                          <a
                            href={
                              selectedOrder.shipping.trackingUrl && selectedOrder.shipping.trackingUrl.includes('gonderi-takibi')
                                ? selectedOrder.shipping.trackingUrl
                                : `https://hepsijet.com/gonderi-takibi/${encodeURIComponent(selectedOrder.shipping.barcode || selectedOrder.shipping.trackingNumber || '')}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-sky-600 hover:text-sky-700 underline truncate block mt-0.5"
                          >
                            HepsiJET Takip Ekranı ↗
                          </a>
                        ) : (
                          <span className="font-semibold text-gray-700">{selectedOrder.shipping.trackingNumber || '-'}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Paket Bilgisi</span>
                        <span className="font-bold text-gray-800">
                          {selectedOrder.shipping.desi ? `${selectedOrder.shipping.desi} Desi` : '1 Desi'} •{' '}
                          {selectedOrder.shipping.weight ? `${selectedOrder.shipping.weight} kg` : '0.3 kg'} •{' '}
                          {selectedOrder.shipping.packageCount ? `${selectedOrder.shipping.packageCount} Parça` : '1 Parça'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Henüz Kargo Oluşturulmadıysa: Düzenlenebilir Paket Bilgileri */}
                  {selectedOrder.shipping?.status !== 'created' && (
                    <div className="bg-white/90 p-3.5 rounded-2xl border border-orange-200/80 space-y-2.5">
                      <p className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FiSliders className="w-3.5 h-3.5 text-orange-600" />
                        Gönderi Paket Bilgileri (Kargo Oluşturulmadan Önce Düzenlenebilir)
                      </p>
                      <div className="grid grid-cols-3 gap-2.5">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Desi</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={pkgDesi}
                            onChange={(e) => setPkgDesi(parseFloat(e.target.value) || 1)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-black text-slate-900 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Ağırlık (kg)</label>
                          <input
                            type="number"
                            step="0.05"
                            min="0.05"
                            value={pkgWeight}
                            onChange={(e) => setPkgWeight(parseFloat(e.target.value) || 0.3)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-black text-slate-900 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Parça / Koli</label>
                          <input
                            type="number"
                            min="1"
                            value={pkgCount}
                            onChange={(e) => setPkgCount(parseInt(e.target.value, 10) || 1)}
                            className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs font-black text-slate-900 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Paketleme Notu (Opsiyonel)</label>
                        <input
                          type="text"
                          value={pkgNote}
                          onChange={(e) => setPkgNote(e.target.value)}
                          placeholder="Örn: Hassas ürün, özenli paketleyin"
                          className="w-full px-2.5 py-1.5 bg-white rounded-lg border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                    </div>
                  )}

                  {/* Hata Mesajı Varsa */}
                  {selectedOrder.shipping?.status === 'failed' && selectedOrder.shipping.error && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                      <strong>Hata Nedeni:</strong> {selectedOrder.shipping.error}
                    </div>
                  )}

                  {/* Butonlar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                    <div className="text-[11px] text-gray-500">
                      {selectedOrder.paymentStatus !== 'PAID' && (
                        <span className="text-amber-700 font-semibold flex items-center gap-1">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          Ödeme tamamlanmadığı için kargo oluşturulamaz.
                        </span>
                      )}
                      {selectedOrder.status === 'cancelled' && (
                        <span className="text-rose-700 font-semibold flex items-center gap-1">
                          <FiAlertCircle className="w-3.5 h-3.5" />
                          İptal edilmiş sipariş için kargo oluşturulamaz.
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Durum 'unknown' ise yöneticiye açık uyarı bildirimi */}
                      {selectedOrder.shipping?.status === 'unknown' && (
                        <div className="w-full p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] font-medium leading-relaxed">
                          ⚠️ <strong>Kargo Durumu Belirsiz (Ağ Zaman Aşımı):</strong> Önceki gönderim denemesinde ağ zaman aşımı yaşandı. İstek HepsiJET sistemine ulaşmış ve kargo kaydı açılmış olabileceğinden mükerrer gönderi engellenmiştir. Lütfen önce HepsiJET yönetim portalından kontrol ediniz.
                        </div>
                      )}

                      {/* GÖNDERİ OLUŞTURULMUŞSA VEYA BARKOD VARSA: BİRLEŞİK TERMAL BASKI AKSİYONLARI */}
                      {selectedOrder.shipping?.status === 'created' || Boolean(selectedOrder.shipping?.barcode) ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handlePrintCombinedLabel(selectedOrder)}
                            disabled={combinedLoading === `print-${selectedOrder.id}`}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm shadow-orange-600/30 disabled:opacity-50"
                            title={`${presetDimensionsLabel} Birleşik Termal Etiketi Doğrudan Yazdır`}
                          >
                            <FiPrinter className="w-3.5 h-3.5" />
                            <span>{combinedLoading === `print-${selectedOrder.id}` ? 'Yazdırılıyor...' : 'Birleşik Etiketi Yazdır'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handlePreviewCombinedLabel(selectedOrder)}
                            disabled={combinedLoading === `preview-${selectedOrder.id}`}
                            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                            title="Birleşik PDF Önizlemesini Aç"
                          >
                            <FiEye className="w-3.5 h-3.5 text-slate-600" />
                            <span>{combinedLoading === `preview-${selectedOrder.id}` ? '...' : 'Birleşik Önizle'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadCombinedLabel(selectedOrder)}
                            disabled={combinedLoading === `download-${selectedOrder.id}`}
                            className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
                            title="Birleşik Etiketi PDF Olarak İndir"
                          >
                            <FiDownload className="w-3.5 h-3.5 text-slate-600" />
                            <span>{combinedLoading === `download-${selectedOrder.id}` ? '...' : 'PDF İndir'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadLabel(selectedOrder)}
                            disabled={labelLoading === selectedOrder.id}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[11px] font-semibold transition-all flex items-center gap-1 disabled:opacity-50"
                            title="Orijinal HepsiJET Kargo Etiketi"
                          >
                            <FiFileText className="w-3 h-3" />
                            <span>Kargo (Tek)</span>
                          </button>

                          {selectedOrder.status !== 'cancelled' && (
                            <button
                              type="button"
                              onClick={() => handleCancelHepsiJetShipment(selectedOrder)}
                              disabled={cancellingShipment}
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1 disabled:opacity-50"
                              title="Yalnızca HepsiJET Kargo Gönderisini İptal Et (Sipariş açık kalır)"
                            >
                              {cancellingShipment ? (
                                <FiRefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <FiXCircle className="w-3 h-3" />
                              )}
                              <span>Kargo İptal</span>
                            </button>
                          )}
                        </>
                      ) : selectedOrder.shipping?.status === 'cancelled' ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <FiXCircle className="w-3.5 h-3.5" />
                          Kargo İptal Edildi
                        </span>
                      ) : (
                        /* GÖNDERİ OLUŞTURULMAMIŞSA: KARGO OLUŞTUR BUTONU */
                        <button
                          type="button"
                          onClick={() => handleCreateHepsiJetShipment(selectedOrder)}
                          disabled={
                            selectedOrder.paymentStatus !== 'PAID' ||
                            selectedOrder.status === 'cancelled' ||
                            selectedOrder.status === 'shipped' ||
                            selectedOrder.status === 'delivered' ||
                            (selectedOrder.status as string) === 'refunded' ||
                            (selectedOrder.status as string) === 'returned' ||
                            selectedOrder.shipping?.status === 'unknown' ||
                            selectedOrder.shipping?.status === 'creating' ||
                            Boolean(selectedOrder.shipping?.barcode) ||
                            Boolean(selectedOrder.shipping?.trackingNumber) ||
                            creatingShipment === selectedOrder.id
                          }
                          className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm shadow-orange-600/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                        >
                          {creatingShipment === selectedOrder.id ? (
                            <>
                              <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>HepsiJET&apos;e İletiliyor...</span>
                            </>
                          ) : (
                            <>
                              <FiTruck className="w-3.5 h-3.5" />
                              <span>HepsiJET Kargo Oluştur</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">Siparişteki Ürünler</p>
                  <div className="space-y-2">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-xl p-3 text-xs">
                        <div className="flex items-center gap-3">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="w-10 h-10 rounded-lg object-contain bg-white border border-gray-200 p-0.5" />
                          )}
                          <div>
                            <p className="font-bold text-gray-900">{item.name}</p>
                            <p className="text-gray-500">{item.quantity} Adet x {formatPrice(item.price)}</p>
                          </div>
                        </div>
                        <span className="font-black text-gray-900">{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Ara Toplam</span>
                    <span className="font-bold text-gray-900">{formatPrice(selectedOrder.subtotal || selectedOrder.total)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Kargo Ücreti</span>
                    <span className="font-bold text-emerald-600">{selectedOrder.shippingCost ? formatPrice(selectedOrder.shippingCost) : 'Ücretsiz'}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-200 flex justify-between items-baseline text-sm">
                    <span className="font-bold text-gray-900">Toplam Tutar</span>
                    <span className="text-xl font-black text-sky-600">{formatPrice(selectedOrder.total)}</span>
                  </div>
                </div>

                {/* Note */}
                {selectedOrder.notes && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900">
                    <p className="font-bold mb-0.5">Sipariş Notu:</p>
                    <p>{selectedOrder.notes}</p>
                  </div>
                )}

                {/* Sipariş İptal Durumu / Butonu */}
                {selectedOrder.status === 'cancelled' ? (
                  <div className="p-4 bg-rose-50/90 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm flex items-center gap-1.5 text-rose-700">
                        <FiXCircle className="w-4 h-4" />
                        Bu Sipariş İptal Edilmiştir
                      </span>
                      {selectedOrder.cancelledAt && (
                        <span className="text-[10px] text-rose-500 font-medium">
                          {new Date(selectedOrder.cancelledAt).toLocaleString('tr-TR')}
                        </span>
                      )}
                    </div>
                    {selectedOrder.cancelReason && (
                      <p className="text-rose-800">
                        <strong className="font-semibold">İptal Nedeni:</strong> {selectedOrder.cancelReason}
                      </p>
                    )}
                    {selectedOrder.cancelledBy && (
                      <p className="text-[11px] text-rose-600">
                        İşlemi Yapan: {selectedOrder.cancelledBy}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenCancelModal(selectedOrder)}
                      className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-2xs cursor-pointer"
                    >
                      <FiXCircle className="w-4 h-4" />
                      <span>Siparişi İptal Et</span>
                    </button>
                  </div>
                )}

                {/* İptal İşlem Geçmişi (Audit Trail) */}
                {selectedOrder.cancellationHistory && selectedOrder.cancellationHistory.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <FiClock className="w-3.5 h-3.5" />
                      İptal İşlem Geçmişi ({selectedOrder.cancellationHistory.length})
                    </p>
                    <div className="space-y-2">
                      {selectedOrder.cancellationHistory.map((rec, i) => (
                        <div key={i} className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs space-y-2">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="font-semibold text-gray-800">{rec.reason}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              rec.cancellationResult === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : rec.cancellationResult === 'NOT_APPLICABLE'
                                ? 'bg-blue-100 text-blue-800'
                                : rec.cancellationResult === 'UNKNOWN'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {rec.cancellationResult === 'SUCCESS'
                                ? 'KESİN BAŞARILI'
                                : rec.cancellationResult === 'NOT_APPLICABLE'
                                ? 'KARGOSUZ İPTAL'
                                : rec.cancellationResult === 'UNKNOWN'
                                ? 'BELİRSİZ (ZAMAN AŞIMI)'
                                : 'BAŞARISIZ / REDDEDİLDİ'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] text-gray-600 bg-white p-2 rounded-lg border border-gray-100">
                            <div>
                              <span className="text-gray-400 block font-medium">Kargo Barkod:</span>
                              <span className="font-mono font-bold text-gray-800">{rec.shipmentBarcode || '---'}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block font-medium">İstek Zamanı:</span>
                              <span className="font-medium text-gray-700">{new Date(rec.cancelledAt).toLocaleString('tr-TR')}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block font-medium">HTTP Kodu:</span>
                              <span className="font-mono font-bold text-gray-800">HTTP {rec.httpStatus || (rec.cancellationResult === 'SUCCESS' ? 200 : 400)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400 block font-medium">HepsiJET Durumu:</span>
                              <span className="font-medium text-gray-800">{rec.hepsijetResponse?.status || (rec.cancellationResult === 'SUCCESS' ? 'OK' : 'FAIL')}</span>
                            </div>
                            <div className="col-span-2">
                              <span className="text-gray-400 block font-medium">HepsiJET Yanıtı:</span>
                              <span className="text-gray-700 truncate block">{rec.hepsijetResponse?.message || rec.errorDetail || 'Gönderi silindi'}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[10px] text-gray-500 pt-1">
                            <span>İşlemi Yapan: {rec.cancelledBy?.email || 'admin'}</span>
                            <span className={`font-semibold ${rec.firestoreUpdateStatus === 'FAILED' ? 'text-amber-600' : 'text-emerald-600'}`}>
                              Yerel Kayıt: {rec.firestoreUpdateStatus === 'FAILED' ? 'Senkronizasyon Bekliyor ⚠️' : 'Firestore Güncellendi ✅'}
                            </span>
                          </div>

                          {rec.errorDetail && rec.cancellationResult !== 'SUCCESS' && (
                            <p className="text-[10px] text-rose-600 mt-1 font-medium bg-rose-50 p-1.5 rounded border border-rose-100">
                              Hata Detayı: {rec.errorDetail}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 2. PRINTABLE RECEIPT / PACKING & HEPSIJET SHIPPING SLIP MODAL             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {printingOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:p-0 print:bg-white print:static"
            onClick={(e) => { if (e.target === e.currentTarget) setPrintingOrder(null) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden print:shadow-none print:w-full print:max-w-none max-h-[95vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Action Bar (Hidden on Print) */}
              <div className="p-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3 print:hidden border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center font-black text-xs">
                    HJ
                  </div>
                  <div>
                    <span className="text-xs font-bold block">HepsiJET Kargo & Paketleme Fişi</span>
                    <span className="text-[10px] text-slate-400">
                      Sipariş #{printingOrder.orderNumber || printingOrder.id.slice(-8).toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Fiş ekranından tek tıkla HepsiJET kargo oluşturma */}
                  {printingOrder.shipping?.status !== 'created' && !printingOrder.shipping?.barcode ? (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation()
                        try {
                          await handleCreateHepsiJetShipment(printingOrder)
                          // Fiş modalındaki veriyi de tazelemek için orders state'inden bul
                          const updated = orders.find((o) => o.id === printingOrder.id)
                          if (updated) setPrintingOrder(updated)
                        } catch (err: any) {
                          console.error('Fiş ekranı kargo oluşturma hatası:', err)
                        }
                      }}
                      disabled={
                        printingOrder.paymentStatus !== 'PAID' ||
                        printingOrder.status === 'cancelled' ||
                        printingOrder.status === 'shipped' ||
                        printingOrder.status === 'delivered' ||
                        (printingOrder.status as string) === 'refunded' ||
                        (printingOrder.status as string) === 'returned' ||
                        printingOrder.shipping?.status === 'unknown' ||
                        printingOrder.shipping?.status === 'creating' ||
                        Boolean(printingOrder.shipping?.barcode) ||
                        Boolean(printingOrder.shipping?.trackingNumber) ||
                        creatingShipment === printingOrder.id
                      }
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-colors flex items-center gap-1.5 shadow-sm shadow-orange-600/30 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {creatingShipment === printingOrder.id ? (
                        <>
                          <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Barkod Alınıyor...</span>
                        </>
                      ) : (
                        <>
                          <FiTruck className="w-3.5 h-3.5" />
                          <span>HepsiJET Barkodu Al</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <FiCheckCircle className="w-3.5 h-3.5" />
                      Barkod Hazır
                    </span>
                  )}

                  <button
                    onClick={executePrint}
                    className="px-4 py-1.5 bg-sky-500 hover:bg-sky-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-colors flex items-center gap-1.5 shadow-sm"
                  >
                    <FiPrinter className="w-3.5 h-3.5" />
                    <span>Yazdır</span>
                  </button>

                  <button
                    onClick={() => setPrintingOrder(null)}
                    className="p-1.5 text-slate-400 hover:text-white rounded-xl"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* PRINTABLE RECEIPT & SHIPPING SLIP BODY (Precise 10x15cm Thermal Label: 10x10cm HepsiJET + 10x5cm Packing Slip) */}
              <div className="overflow-y-auto p-4 sm:p-6 print:p-0 flex justify-center bg-slate-100 print:bg-white">
                <style
                  dangerouslySetInnerHTML={{
                    __html: `
                      @media print {
                        @page {
                          size: ${totalW}mm ${totalH}mm;
                          margin: 0;
                        }
                        html, body {
                          width: ${totalW}mm !important;
                          height: ${totalH}mm !important;
                          margin: 0 !important;
                          padding: 0 !important;
                          background: #fff !important;
                          -webkit-print-color-adjust: exact !important;
                          print-color-adjust: exact !important;
                        }
                        body * {
                          visibility: hidden;
                        }
                        #printable-receipt, #printable-receipt * {
                          visibility: visible;
                        }
                        #printable-receipt {
                          position: fixed !important;
                          left: 0 !important;
                          top: 0 !important;
                          width: ${totalW}mm !important;
                          height: ${totalH}mm !important;
                          margin: 0 !important;
                          padding: 2mm !important;
                          border: none !important;
                          border-radius: 0 !important;
                          box-sizing: border-box !important;
                          background: white !important;
                          overflow: visible !important;
                          page-break-inside: avoid !important;
                          break-inside: avoid !important;
                        }
                        #printable-receipt > div {
                          page-break-inside: avoid !important;
                          break-inside: avoid !important;
                        }
                      }
                    `,
                  }}
                />

                <div
                  id="printable-receipt"
                  className="w-[100mm] h-[150mm] p-3 font-mono text-slate-900 bg-white border-2 border-slate-300 rounded-xl print:border-0 print:p-0 print:m-0 flex flex-col justify-between box-border shadow-md print:shadow-none print:rounded-none"
                >
                  {/* ========================================================================= */}
                  {/* SECTION 1 (10cm x 10cm): HEPSIJET KARGO SEVK ETİKETİ                       */}
                  {/* ========================================================================= */}
                  <div className="space-y-2 border-b-2 border-dashed border-slate-900 pb-2">
                    
                    {/* Header: Carrier & Origin */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 bg-black text-white font-black text-sm rounded tracking-wider">
                          HEPSİJET
                        </span>
                        <span className="font-black text-[10px] tracking-wider uppercase text-slate-800">
                          (HX_STD)
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-500 block uppercase leading-none">ÇIKIŞ DEPOSU</span>
                        <span className="font-black text-sm text-slate-900 leading-none">KONYA</span>
                      </div>
                    </div>

                    {/* Sender Brief */}
                    <div className="text-[9px] leading-tight text-slate-600 border-b border-slate-200 pb-1">
                      <strong className="text-slate-900">GÖNDERİCİ:</strong> {hepsijetSettings?.companyName || 'KALİPORT'} • {hepsijetSettings?.senderDistrict ? `${hepsijetSettings.senderDistrict}, ` : ''}{hepsijetSettings?.senderTown || 'Selçuklu'} / {hepsijetSettings?.senderCity || 'KONYA'}
                    </div>

                    {/* Recipient & Shipping Address (High Contrast for Couriers) */}
                    <div className="border-2 border-slate-900 p-1.5 rounded-lg bg-slate-50/50 space-y-0.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[9px] font-black text-orange-700 uppercase">ALICI:</span>
                        <span className="text-[10px] font-bold text-slate-900">{printingOrder.customer?.phone || '-'}</span>
                      </div>
                      <p className="font-black text-xs text-slate-900 truncate">
                        {printingOrder.shippingAddress?.fullName || printingOrder.customer?.name}
                      </p>
                      <p className="text-[9px] text-slate-800 leading-snug line-clamp-2">
                        {printingOrder.shippingAddress?.address}
                      </p>
                      <div className="pt-0.5 border-t border-slate-300 flex justify-between items-center">
                        <span className="font-black text-xs uppercase text-slate-900">
                          {printingOrder.shippingAddress?.district ? `${printingOrder.shippingAddress.district} / ` : ''}
                          {printingOrder.shippingAddress?.city || 'İSTANBUL'}
                        </span>
                        <span className="text-[9px] font-bold text-slate-600">
                          {printingOrder.shipping?.desi || 1.0} Desi • {printingOrder.shipping?.weight || 0.3} kg
                        </span>
                      </div>
                    </div>

                    {/* Scannable Real HepsiJET Barcode (Code128 SVG) */}
                    <div className="text-center pt-1">
                      {(() => {
                        const barcodeText =
                          printingOrder.shipping?.barcode ||
                          printingOrder.shipping?.customerDeliveryNo ||
                          `HJ${printingOrder.orderNumber || printingOrder.id.slice(-8).toUpperCase()}`
                        return (
                          <div>
                            <div
                              className="w-full flex justify-center py-0.5"
                              dangerouslySetInnerHTML={{
                                __html: generateBarcodeSvg(barcodeText, 55, 2),
                              }}
                            />
                            <p className="font-mono text-xs font-black text-slate-900 tracking-widest mt-0.5">
                              {barcodeText}
                            </p>
                          </div>
                        )
                      })()}
                    </div>

                    {/* Meta Bar */}
                    <div className="flex justify-between text-[8px] text-slate-500 pt-0.5">
                      <span>Ref: #{printingOrder.orderNumber || printingOrder.id.slice(-8).toUpperCase()}</span>
                      <span>HepsiJET Müşteri Hizmetleri: 0850 558 03 33</span>
                    </div>
                  </div>

                  {/* ========================================================================= */}
                  {/* SECTION 2 (10cm x 5cm): SİPARİŞ & PAKETLEME SEVK FİŞİ                     */}
                  {/* ========================================================================= */}
                  <div className="pt-2 text-[9px] space-y-1.5">
                    {/* Header */}
                    <div className="flex justify-between items-baseline border-b border-slate-300 pb-1">
                      <span className="font-black text-[10px] text-slate-900 uppercase">
                        SİPARİŞ SEVK & PAKETLEME FİŞİ
                      </span>
                      <span className="font-bold text-emerald-700 text-[9px]">
                        {printingOrder.paymentStatus === 'PAID' ? '✓ TAHSİL EDİLDİ' : 'BEKLİYOR'}
                      </span>
                    </div>

                    {/* Order Details & Items (Packing Checklist) */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-slate-500 text-[8px]">
                        <span>Tarih: {formatDate(printingOrder.createdAt)}</span>
                        <span>
                          Ödeme:{' '}
                          {printingOrder.paymentMethod === 'paytr_iframe'
                            ? 'PayTR 3D'
                            : printingOrder.paymentMethod === 'iyzico_3d_secure'
                            ? 'Kredi Kartı'
                            : 'Havale'}
                        </span>
                      </div>

                      {/* Items */}
                      <div className="border border-slate-200 rounded p-1 space-y-0.5 bg-slate-50/50">
                        {printingOrder.items?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[9px] leading-tight">
                            <span className="font-bold text-slate-900 truncate pr-2">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="font-black text-slate-800 whitespace-nowrap">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Totals */}
                      <div className="flex justify-between items-center font-black text-[10px] text-slate-900 pt-0.5">
                        <span className="text-[9px]">TOPLAM TUTAR:</span>
                        <span className="text-sm font-black text-orange-600">{formatPrice(printingOrder.total)}</span>
                      </div>

                      {/* Customer Note if exists */}
                      {printingOrder.notes && (
                        <p className="text-[8px] text-amber-900 bg-amber-50 p-1 rounded border border-amber-200 line-clamp-1">
                          <strong>Not:</strong> {printingOrder.notes}
                        </p>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BİRLEŞİK TERMAL ETİKET (150 × 100 mm) ÖNİZLEME MODALI */}
      {combinedPdfPreview.isOpen && combinedPdfPreview.url && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
          onClick={() => setCombinedPdfPreview({ isOpen: false, url: null, order: null })}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                  <FiPrinter className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Birleşik Termal Etiket Önizleme ({presetDimensionsLabel})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sipariş #{combinedPdfPreview.order?.orderNumber || combinedPdfPreview.order?.id.slice(-8).toUpperCase()} • {isPortrait ? 'Üst: HepsiJET Kargo, Alt: KALIPORT Fişi' : 'Sol: HepsiJET Kargo, Sağ: KALIPORT Fişi'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => combinedPdfPreview.order && handlePrintCombinedLabel(combinedPdfPreview.order)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm shadow-orange-600/30"
                >
                  <FiPrinter className="w-3.5 h-3.5" />
                  <span>Yazdır</span>
                </button>
                <button
                  type="button"
                  onClick={() => combinedPdfPreview.order && handleDownloadCombinedLabel(combinedPdfPreview.order)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <FiDownload className="w-3.5 h-3.5" />
                  <span>İndir</span>
                </button>
                <button
                  type="button"
                  onClick={() => combinedPdfPreview.url && window.open(combinedPdfPreview.url, '_blank')}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                  title="PDF'i Chrome sekmesinde tam boyutta açıp yazdırmak için"
                >
                  <FiExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Yeni Sekme</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCombinedPdfPreview({ isOpen: false, url: null, order: null })}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal PDF Viewer Body */}
            <div className="flex-1 p-4 bg-slate-900/5 min-h-[500px]">
              <iframe
                src={`${combinedPdfPreview.url}#toolbar=0&navpanes=0`}
                className="w-full h-full min-h-[520px] rounded-2xl border border-slate-200 bg-white shadow-inner"
                title="Birleşik Termal Etiket PDF"
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. SİPARİŞ İPTAL ONAY VE NEDEN MODALI */}
      <AnimatePresence>
        {cancelModalOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => { if (!cancellingOrder) setCancelModalOrder(null) }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center">
                    <FiXCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Siparişi İptal Et</h3>
                    <p className="text-xs text-gray-500">
                      Sipariş #{cancelModalOrder.orderNumber || cancelModalOrder.id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={cancellingOrder}
                  onClick={() => setCancelModalOrder(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Kargo durumuna göre bilgilendirme */}
              {cancelModalOrder.shipping?.status === 'created' || Boolean(cancelModalOrder.shipping?.barcode) ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <FiAlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    HepsiJET Kargo Gönderisi Bulunmaktadır:
                  </p>
                  <p className="text-[11px] leading-relaxed">
                    Bu siparişe bağlı aktif bir kargo barkodu (<strong>{cancelModalOrder.shipping?.barcode || cancelModalOrder.shipping?.customerDeliveryNo}</strong>) mevcuttur.
                    Onayınızla birlikte sipariş iptal edilecek ve HepsiJET API üzerinden kargo iptal isteği gönderilecektir.
                  </p>
                </div>
              ) : (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-700">
                  <p className="text-[11px] leading-relaxed">
                    Bu sipariş için henüz aktif bir kargo gönderisi oluşturulmamıştır. Sipariş doğrudan iptal edilecek ve yeni gönderi oluşturulması kilitlenecektir.
                  </p>
                </div>
              )}

              {/* İptal Nedeni Girişi */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">
                  İptal Nedeni <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReasonInput}
                  onChange={(e) => setCancelReasonInput(e.target.value)}
                  placeholder="Örn: Müşteri isteği üzerine iptal edildi / Hatalı sipariş..."
                  disabled={cancellingOrder}
                  className="w-full text-xs p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-rose-500 transition-all outline-none resize-none"
                />
              </div>

              {cancelError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <FiAlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{cancelError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  disabled={cancellingOrder}
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={cancellingOrder || !cancelReasonInput.trim()}
                  onClick={handleConfirmCancelOrder}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm shadow-rose-600/30 disabled:opacity-50 cursor-pointer"
                >
                  {cancellingOrder ? (
                    <>
                      <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>İptal Ediliyor...</span>
                    </>
                  ) : (
                    <>
                      <FiXCircle className="w-3.5 h-3.5" />
                      <span>İptali Onayla</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
