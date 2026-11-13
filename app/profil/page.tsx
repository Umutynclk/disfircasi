'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  getUserData, 
  logoutUser, 
  onUserAuthStateChanged, 
  getUserOrders,
  getUserSavedAddresses,
  saveUserAddress,
  deleteUserAddress,
  setDefaultUserAddress,
  UserAddress,
} from '@/lib/firebase/userAuth'
import {
  FiUser,
  FiMail,
  FiLogOut,
  FiEdit2,
  FiSave,
  FiX,
  FiShoppingBag,
  FiPackage,
  FiCalendar,
  FiMapPin,
  FiPhone,
  FiPlus,
  FiTrash2,
  FiCheck,
  FiCheckCircle,
  FiHome,
  FiBriefcase,
  FiAlertCircle,
  FiTruck,
  FiExternalLink,
  FiClock,
  FiCornerUpLeft,
  FiRotateCcw,
  FiChevronRight,
  FiInfo,
  FiTag,
  FiFileText,
  FiRefreshCw,
} from 'react-icons/fi'
import { doc, updateDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'
import { buildHepsiJetTrackingUrl } from '@/lib/hepsijet/tracking-url'
import { getCommonOrderDisplayStatus } from '@/lib/hepsijet/status-display'
import { RETURN_REASONS, ReturnReasonCode, ReturnRequest, AvailableDeliveryDate } from '@/lib/returns/types'
import { addToCart } from '@/lib/utils/cart'

interface UserData {
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  createdAt?: any
  phone?: string
  address?: string
}

const PROFILE_TRANSLATIONS = {
  tr: {
    logout: 'Çıkış Yap',
    tabOrders: 'Siparişlerim',
    tabProfile: 'Hesap Bilgilerim',
    tabAddresses: 'Kayıtlı Adreslerim',
    loadingOrders: 'Siparişleriniz yükleniyor...',
    noOrdersTitle: 'Henüz Siparişiniz Bulunmuyor',
    noOrdersDesc: 'Ağız sağlığınızı dönüştürecek 360° sonic ve kullan-at diş fırçalarımızı keşfedin.',
    exploreBtn: 'Ürünleri İncele',
    orderNo: 'Sipariş No:',
    statusReceived: 'Sipariş Alındı',
    statusProcessing: 'Hazırlanıyor',
    statusLabelCreated: 'Kargo Etiketi Oluşturuldu',
    statusShipped: 'Kargoya Verildi',
    statusInTransit: 'Yolda',
    statusOutForDelivery: 'Dağıtımda',
    statusDelivered: 'Teslim Edildi',
    statusCancelled: 'İptal Edildi',
    trackingTitle: 'Kargo Bilgisi',
    trackingCarrier: 'Kargo Firması:',
    trackingNo: 'Takip No:',
    trackingBtn: 'Kargomu Takip Et',
    cancelOrderBtn: 'Siparişi İptal Et',
    cancellingOrder: 'İptal Ediliyor...',
    confirmCancelOrder: 'Bu siparişi iptal etmek istediğinize emin misiniz?\n\nVarsa ödemeniz banka ve PayTR onayının ardından 1-3 iş günü içinde kartınıza iade edilecektir.',
    orderCancelledSuccess: 'Siparişiniz başarıyla iptal edildi.',
    orderCancelError: 'Sipariş iptal edilirken bir hata oluştu.',
    qty: 'Adet:',
    total: 'Toplam:',
    personalHeading: 'Kişisel & Teslimat Bilgileri',
    personalSub: 'Siparişlerinizde otomatik doldurulacak adres ve iletişim bilgileriniz.',
    editBtn: 'Düzenle',
    saveBtn: 'Kaydet',
    savingBtn: 'Kaydediliyor...',
    cancelBtn: 'İptal',
    fullNameLabel: 'Ad Soyad',
    emailLabel: 'E-posta Adresi',
    phoneLabel: 'Telefon Numarası',
    addressLabel: 'Teslimat Adresi',
    alertUpdated: 'Profil bilgileriniz güncellendi!',
    alertError: 'Güncelleme sırasında bir hata oluştu.',
  },
  en: {
    logout: 'Sign Out',
    tabOrders: 'My Orders',
    tabProfile: 'Account Details',
    tabAddresses: 'Saved Addresses',
    loadingOrders: 'Loading your orders...',
    noOrdersTitle: 'No Orders Yet',
    noOrdersDesc: 'Explore our 360° sonic and travel-ready dental care collections.',
    exploreBtn: 'Explore Products',
    orderNo: 'Order #:',
    statusReceived: 'Order Received',
    statusProcessing: 'Processing',
    statusLabelCreated: 'Shipping Label Created',
    statusShipped: 'Shipped',
    statusInTransit: 'In Transit',
    statusOutForDelivery: 'Out for Delivery',
    statusDelivered: 'Delivered',
    statusCancelled: 'Cancelled',
    trackingTitle: 'Shipping Info',
    trackingCarrier: 'Carrier:',
    trackingNo: 'Tracking #:',
    trackingBtn: 'Track My Package',
    cancelOrderBtn: 'Cancel Order',
    cancellingOrder: 'Cancelling...',
    confirmCancelOrder: 'Are you sure you want to cancel this order?\n\nYour refund will be processed within 1-3 business days.',
    orderCancelledSuccess: 'Your order was cancelled successfully.',
    orderCancelError: 'An error occurred while cancelling your order.',
    qty: 'Qty:',
    total: 'Total:',
    personalHeading: 'Personal & Shipping Details',
    personalSub: 'Your saved details for fast checkout.',
    editBtn: 'Edit',
    saveBtn: 'Save',
    savingBtn: 'Saving...',
    cancelBtn: 'Cancel',
    fullNameLabel: 'Full Name',
    emailLabel: 'Email Address',
    phoneLabel: 'Phone Number',
    addressLabel: 'Delivery Address',
    alertUpdated: 'Profile updated successfully!',
    alertError: 'An error occurred during update.',
  },
}

type OrderFilterType = 'all' | 'ongoing' | 'delivered' | 'cancelled_returned'

export default function ProfilePage() {
  const router = useRouter()
  const { locale, getLocalizedPath, formatPriceWithCurrency } = useLocale()
  const loc = PROFILE_TRANSLATIONS[locale as 'tr' | 'en'] || PROFILE_TRANSLATIONS.tr

  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'addresses'>('orders')
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orderFilter, setOrderFilter] = useState<OrderFilterType>('all')

  // Modallar
  const [selectedDetailOrder, setSelectedDetailOrder] = useState<any | null>(null)
  const [cancelModalOrder, setCancelModalOrder] = useState<any | null>(null)
  const [cancelReasonText, setCancelReasonText] = useState('')
  const [cancellingLoading, setCancellingLoading] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  // İade Talebi Modalı
  const [returnModalOrder, setReturnModalOrder] = useState<any | null>(null)
  const [returnScope, setReturnScope] = useState<'full' | 'partial'>('partial')
  const [selectedReturnItems, setSelectedReturnItems] = useState<Record<string, number>>({})
  const [returnReasonCode, setReturnReasonCode] = useState<ReturnReasonCode>('not_wanted')
  const [returnNote, setReturnNote] = useState('')
  const [returnSubmitting, setReturnSubmitting] = useState(false)
  const [returnModalError, setReturnModalError] = useState<string | null>(null)

  // HepsiJET Randevu Modalı
  const [appointmentModalData, setAppointmentModalData] = useState<{
    order: any
    returnRequest: ReturnRequest
  } | null>(null)
  const [availableDates, setAvailableDates] = useState<AvailableDeliveryDate[]>([])
  const [datesLoading, setDatesLoading] = useState(false)
  const [datesError, setDatesError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [selectedSlot, setSelectedSlot] = useState<number>(1)
  const [schedulingLoading, setSchedulingLoading] = useState(false)
  const [scheduledResult, setScheduledResult] = useState<{
    barcode: string
    trackingUrl: string
    appointmentDate: string
  } | null>(null)

  // Profil Form State
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  })

  // Adres State
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressModalOpen, setAddressModalOpen] = useState(false)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  const [savingAddress, setSavingAddress] = useState(false)
  const [addressForm, setAddressForm] = useState({
    title: 'Ev Adresim',
    type: 'both' as 'delivery' | 'billing' | 'both',
    fullName: '',
    phone: '',
    city: '',
    district: '',
    neighborhood: '',
    address: '',
    postalCode: '',
    isDefaultDelivery: false,
    isDefaultBilling: false,
    isCorporate: false,
    companyName: '',
    taxOffice: '',
    taxNumber: '',
  })

  useEffect(() => {
    const unsubscribe = onUserAuthStateChanged((currentUser) => {
      if (!currentUser) {
        router.push(getLocalizedPath('/giris') + '?redirect=' + encodeURIComponent(getLocalizedPath('/profil')))
        return
      }
      setUser(currentUser)
      loadUserData(currentUser.uid)
      loadOrders(currentUser.uid, currentUser.email || undefined)
      loadAddresses(currentUser.uid)
    })
    return () => unsubscribe()
  }, [router, getLocalizedPath])

  const loadAddresses = async (userId: string) => {
    setAddressLoading(true)
    try {
      const res = await getUserSavedAddresses(userId)
      if (res.success) {
        setSavedAddresses(res.addresses)
      }
    } catch (err) {
      console.error('Adresler yüklenemedi:', err)
    } finally {
      setAddressLoading(false)
    }
  }

  const handleOpenNewAddress = () => {
    setEditingAddressId(null)
    setAddressForm({
      title: 'Ev Adresim',
      type: 'both',
      fullName: userData?.name || '',
      phone: userData?.phone || '',
      city: '',
      district: '',
      neighborhood: '',
      address: '',
      postalCode: '',
      isDefaultDelivery: savedAddresses.length === 0,
      isDefaultBilling: savedAddresses.length === 0,
      isCorporate: false,
      companyName: '',
      taxOffice: '',
      taxNumber: '',
    })
    setAddressModalOpen(true)
  }

  const handleEditAddress = (addr: UserAddress) => {
    setEditingAddressId(addr.id)
    setAddressForm({
      title: addr.title,
      type: addr.type || 'both',
      fullName: addr.fullName,
      phone: addr.phone,
      city: addr.city,
      district: addr.district,
      neighborhood: addr.neighborhood || '',
      address: addr.address,
      postalCode: addr.postalCode || '',
      isDefaultDelivery: Boolean(addr.isDefaultDelivery),
      isDefaultBilling: Boolean(addr.isDefaultBilling),
      isCorporate: Boolean(addr.isCorporate),
      companyName: addr.companyName || '',
      taxOffice: addr.taxOffice || '',
      taxNumber: addr.taxNumber || '',
    })
    setAddressModalOpen(true)
  }

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!addressForm.fullName.trim() || !addressForm.phone.trim() || !addressForm.city.trim() || !addressForm.district.trim() || !addressForm.address.trim()) {
      alert('Lütfen zorunlu alanları (Ad Soyad, Telefon, İl, İlçe, Adres) doldurunuz.')
      return
    }
    setSavingAddress(true)
    try {
      const res = await saveUserAddress(
        user.uid,
        {
          ...addressForm,
        },
        editingAddressId || undefined
      )
      if (res.success) {
        await loadAddresses(user.uid)
        setAddressModalOpen(false)
      } else {
        alert(res.error || 'Adres kaydedilemedi.')
      }
    } catch (err: any) {
      alert(err.message || 'Adres kaydedilemedi.')
    } finally {
      setSavingAddress(false)
    }
  }

  const handleDeleteAddress = async (addressId: string) => {
    if (!user) return
    if (!confirm('Bu adresi silmek istediğinize emin misiniz?')) return
    try {
      const res = await deleteUserAddress(user.uid, addressId)
      if (res.success) {
        await loadAddresses(user.uid)
      } else {
        alert(res.error || 'Adres silinemedi.')
      }
    } catch (err: any) {
      alert(err.message || 'Adres silinemedi.')
    }
  }

  const handleSetDefaultAddress = async (addressId: string, type: 'delivery' | 'billing') => {
    if (!user) return
    try {
      const res = await setDefaultUserAddress(user.uid, addressId, type)
      if (res.success) {
        await loadAddresses(user.uid)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const loadUserData = async (userId: string) => {
    try {
      const result = await getUserData(userId)
      if (result.success && result.data) {
        const data = result.data as UserData
        setUserData(data)
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || '',
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Kullanıcı verisi yükleme hatası:', error)
      setLoading(false)
    }
  }

  const loadOrders = async (userId: string, email?: string) => {
    setOrdersLoading(true)
    try {
      const result = await getUserOrders(userId, email)
      if (result.success && result.orders) {
        setOrders(result.orders)
      }
    } catch (error) {
      console.error('Sipariş yükleme hatası:', error)
    } finally {
      setOrdersLoading(false)
    }
  }

  // Sipariş İptali
  const handleOpenCancelModal = (order: any) => {
    setCancelModalOrder(order)
    setCancelReasonText('Vazgeçtim / Başka ürün alacağım')
    setCancelError(null)
  }

  const handleConfirmCancel = async () => {
    if (!user || !cancelModalOrder) return
    setCancellingLoading(true)
    setCancelError(null)

    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orderId: cancelModalOrder.orderNumber || cancelModalOrder.id,
          reason: cancelReasonText.trim() || 'Müşteri talebiyle sipariş iptal edildi.',
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        alert(data.message || loc.orderCancelledSuccess)
        setCancelModalOrder(null)
        if (selectedDetailOrder?.id === cancelModalOrder.id) {
          setSelectedDetailOrder(null)
        }
        await loadOrders(user.uid, user.email || undefined)
      } else {
        setCancelError(data.error || loc.orderCancelError)
      }
    } catch (err: any) {
      console.error('Sipariş iptal hatası:', err)
      setCancelError(err?.message || loc.orderCancelError)
    } finally {
      setCancellingLoading(false)
    }
  }

  // İade Talebi Başlatma
  const handleOpenReturnModal = (order: any) => {
    setReturnModalOrder(order)
    setReturnScope('partial')
    setReturnReasonCode('not_wanted')
    setReturnNote('')
    setReturnModalError(null)

    // Başlangıçta tüm ürünlerin 1 adetini varsayılan seç
    const initialItems: Record<string, number> = {}
    for (const it of order.items || []) {
      const pid = it.productId || it.id || it.name
      initialItems[pid] = 1
    }
    setSelectedReturnItems(initialItems)
  }

  const handleSubmitReturn = async () => {
    if (!user || !returnModalOrder) return
    setReturnSubmitting(true)
    setReturnModalError(null)

    try {
      const idToken = await user.getIdToken()

      const itemsPayload = returnScope === 'full'
        ? []
        : Object.entries(selectedReturnItems)
            .filter(([_, qty]) => qty > 0)
            .map(([productId, quantity]) => ({ productId, quantity }))

      if (returnScope === 'partial' && itemsPayload.length === 0) {
        setReturnModalError('Lütfen iade edilecek en az bir ürün ve miktar seçiniz.')
        setReturnSubmitting(false)
        return
      }

      const res = await fetch('/api/orders/returns/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orderId: returnModalOrder.orderNumber || returnModalOrder.id,
          scope: returnScope,
          reasonCode: returnReasonCode,
          customerNote: returnNote.trim(),
          items: itemsPayload,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        const createdReturn = data.returnRequest
        alert(data.message)
        setReturnModalOrder(null)
        await loadOrders(user.uid, user.email || undefined)

        // Otomatik ön onaylandıysa doğrudan HepsiJET Randevu Modalı açılır
        if (data.isAutoPreapproved && createdReturn) {
          handleOpenAppointmentModal(returnModalOrder, createdReturn)
        }
      } else {
        setReturnModalError(data.error || 'İade talebi oluşturulamadı.')
      }
    } catch (err: any) {
      console.error('İade talebi hatası:', err)
      setReturnModalError(err?.message || 'İade talebi gönderilirken hata oluştu.')
    } finally {
      setReturnSubmitting(false)
    }
  }

  // HepsiJET Randevu Modalı
  const handleOpenAppointmentModal = async (order: any, returnRequest: ReturnRequest) => {
    setAppointmentModalData({ order, returnRequest })
    setDatesLoading(true)
    setDatesError(null)
    setAvailableDates([])
    setSelectedDate('')
    setSelectedSlot(1)
    setScheduledResult(null)

    try {
      const idToken = await user.getIdToken()
      const res = await fetch(`/api/orders/returns/dates?orderId=${encodeURIComponent(order.id)}&returnId=${encodeURIComponent(returnRequest.id)}`, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setAvailableDates(data.dates || [])
        if (data.dates && data.dates.length > 0) {
          setSelectedDate(data.dates[0].date)
        }
      } else {
        setDatesError(data.error || 'Uygun randevu tarihleri alınamadı.')
      }
    } catch (err: any) {
      console.error('Randevu tarihi alma hatası:', err)
      setDatesError(err?.message || 'Randevu tarihleri alınamadı.')
    } finally {
      setDatesLoading(false)
    }
  }

  const handleConfirmSchedule = async () => {
    if (!user || !appointmentModalData || !selectedDate) return
    setSchedulingLoading(true)
    setDatesError(null)

    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/orders/returns/schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orderId: appointmentModalData.order.id,
          returnId: appointmentModalData.returnRequest.id,
          appointmentDate: selectedDate,
          appointmentSlot: selectedSlot,
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setScheduledResult({
          barcode: data.barcode,
          trackingUrl: data.trackingUrl,
          appointmentDate: data.appointmentDate,
        })
        await loadOrders(user.uid, user.email || undefined)
      } else {
        setDatesError(data.error || 'Randevu oluşturulamadı.')
      }
    } catch (err: any) {
      console.error('Randevu kaydetme hatası:', err)
      setDatesError(err?.message || 'Randevu oluşturulamadı.')
    } finally {
      setSchedulingLoading(false)
    }
  }

  // Tekrar Satın Al (Buy Again)
  const handleBuyAgain = (order: any) => {
    if (!order.items || order.items.length === 0) return
    for (const item of order.items) {
      addToCart({
        productId: item.productId || item.id,
        name: item.name,
        price: item.price,
        image: item.image,
        quantity: item.quantity || 1,
      }, true)
    }
    router.push(getLocalizedPath('/sepet'))
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    try {
      const db = getFirestoreDB()
      const userRef = doc(db, 'users', user.uid)
      const updateData: any = {
        name: formData.name,
        updatedAt: new Date().toISOString(),
      }
      if (formData.phone) updateData.phone = formData.phone
      if (formData.address) updateData.address = formData.address
      await updateDoc(userRef, updateData)
      await loadUserData(user.uid)
      setEditing(false)
      alert(loc.alertUpdated)
    } catch (error) {
      console.error('Güncelleme hatası:', error)
      alert(loc.alertError)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logoutUser()
    router.push(getLocalizedPath('/'))
    router.refresh()
  }

  // Sipariş Filtresi Eşleştirme
  const filteredOrders = orders.filter((order) => {
    const rawStatus = String(order.status || '').toLowerCase()
    const rawShipStatus = String(order.shipping?.status || '').toLowerCase()
    const isCancelled = rawStatus === 'cancelled' || rawShipStatus === 'cancelled' || order.isCancelled === true
    const isDelivered = rawStatus === 'delivered' || rawStatus === 'completed' || rawShipStatus === 'delivered'
    const isReturned = rawShipStatus === 'returned' || order.hasReturnRequest === true

    if (orderFilter === 'ongoing') {
      return !isCancelled && !isDelivered && !isReturned
    }
    if (orderFilter === 'delivered') {
      return isDelivered && !isReturned
    }
    if (orderFilter === 'cancelled_returned') {
      return isCancelled || isReturned
    }
    return true
  })

  // Kargo Zaman Çizelgesi Adımları
  const getTimelineSteps = (order: any) => {
    const common = getCommonOrderDisplayStatus(order)
    const key = common.key

    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'
    const shipDate = order.shipping?.updatedAt ? new Date(order.shipping.updatedAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '-'

    const steps = [
      { id: 'pending', title: 'Sipariş Alındı', desc: orderDate, completed: true, active: key === 'pending' },
      { id: 'processing', title: 'Hazırlanıyor', desc: 'Siparişiniz paketleniyor', completed: ['processing', 'label_created', 'accepted', 'in_transit', 'out_for_delivery', 'delivered'].includes(key), active: key === 'processing' },
      { id: 'label_created', title: 'Kargo Etiketi', desc: order.shipping?.barcode ? `#${order.shipping.barcode}` : 'Barkod oluşturuldu', completed: ['label_created', 'accepted', 'in_transit', 'out_for_delivery', 'delivered'].includes(key), active: key === 'label_created' },
      { id: 'accepted', title: 'Kargoya Verildi', desc: 'HepsiJET teslim aldı', completed: ['accepted', 'in_transit', 'out_for_delivery', 'delivered'].includes(key), active: key === 'accepted' },
      { id: 'in_transit', title: 'Yolda', desc: 'Transfer merkezinde', completed: ['in_transit', 'out_for_delivery', 'delivered'].includes(key), active: key === 'in_transit' },
      { id: 'out_for_delivery', title: 'Dağıtımda', desc: 'Kurye teslimat yolunda', completed: ['out_for_delivery', 'delivered'].includes(key), active: key === 'out_for_delivery' },
      { id: 'delivered', title: 'Teslim Edildi', desc: order.completedAt || shipDate, completed: key === 'delivered', active: key === 'delivered' },
    ]

    return { steps, isCancelled: key === 'cancelled', isReturned: key === 'returned', statusInfo: common }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 pt-32">
        <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="pt-28 pb-24 min-h-screen bg-slate-50">
      <div className="container-custom section-padding max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden"
        >
          {/* Üst Profil Kartı */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-sky-950 px-6 sm:px-8 py-8 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 text-2xl font-black text-sky-400">
                {userData?.name ? userData.name.charAt(0).toUpperCase() : 'M'}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black">{userData?.name || user.email?.split('@')[0]}</h1>
                <p className="text-xs text-slate-300 mt-0.5 font-medium">{user.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-colors self-start sm:self-auto cursor-pointer"
            >
              <FiLogOut className="w-3.5 h-3.5" />
              <span>{loc.logout}</span>
            </button>
          </div>

          {/* Sekmeler */}
          <div className="flex border-b border-slate-100 px-6 sm:px-8 pt-3 gap-6 bg-slate-50/50">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 pb-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeTab === 'orders'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <FiShoppingBag className="w-4 h-4" />
              <span>{loc.tabOrders} ({orders.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 pb-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeTab === 'profile'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <FiUser className="w-4 h-4" />
              <span>{loc.tabProfile}</span>
            </button>

            <button
              onClick={() => setActiveTab('addresses')}
              className={`flex items-center gap-2 pb-3.5 text-xs font-black uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeTab === 'addresses'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <FiMapPin className="w-4 h-4" />
              <span>{loc.tabAddresses || 'Kayıtlı Adreslerim'} ({savedAddresses.length})</span>
            </button>
          </div>

          {/* SİPARİŞLERİM SEKMESİ */}
          {activeTab === 'orders' && (
            <div className="p-5 sm:p-8 space-y-6">
              {/* Filtre Butonları */}
              <div className="flex flex-wrap items-center gap-2 pb-2">
                {[
                  { id: 'all', label: 'Tüm Siparişler', count: orders.length },
                  {
                    id: 'ongoing',
                    label: 'Devam Edenler',
                    count: orders.filter((o) => {
                      const s = String(o.status || '').toLowerCase()
                      const sh = String(o.shipping?.status || '').toLowerCase()
                      return s !== 'cancelled' && s !== 'delivered' && s !== 'completed' && sh !== 'delivered' && sh !== 'returned' && !o.hasReturnRequest
                    }).length,
                  },
                  {
                    id: 'delivered',
                    label: 'Teslim Edilenler',
                    count: orders.filter((o) => {
                      const s = String(o.status || '').toLowerCase()
                      const sh = String(o.shipping?.status || '').toLowerCase()
                      return (s === 'delivered' || s === 'completed' || sh === 'delivered') && sh !== 'returned' && !o.hasReturnRequest
                    }).length,
                  },
                  {
                    id: 'cancelled_returned',
                    label: 'İptal / İade',
                    count: orders.filter((o) => {
                      const s = String(o.status || '').toLowerCase()
                      const sh = String(o.shipping?.status || '').toLowerCase()
                      return s === 'cancelled' || sh === 'cancelled' || sh === 'returned' || o.hasReturnRequest === true
                    }).length,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setOrderFilter(tab.id as OrderFilterType)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      orderFilter === tab.id
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${orderFilter === tab.id ? 'bg-white/20 text-white' : 'bg-white text-slate-700'}`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {ordersLoading ? (
                <div className="py-20 text-center">
                  <div className="w-10 h-10 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-semibold">{loc.loadingOrders}</p>
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                    <FiPackage className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mb-1">
                    {orderFilter === 'all' ? loc.noOrdersTitle : 'Bu filtrede sipariş bulunamadı'}
                  </h3>
                  <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
                    {loc.noOrdersDesc}
                  </p>
                  <Link
                    href={getLocalizedPath('/urunler')}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-full text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-sky-600/20"
                  >
                    <FiShoppingBag className="w-4 h-4" />
                    <span>{loc.exploreBtn}</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredOrders.map((order) => {
                    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }) : '---'
                    const rawStatus = String(order.status || '').toLowerCase()
                    const rawShipStatus = String(order.shipping?.status || '').toLowerCase()

                    const isCancelled = rawStatus === 'cancelled' || rawShipStatus === 'cancelled' || order.isCancelled === true
                    const isDelivered = rawStatus === 'delivered' || rawStatus === 'completed' || rawShipStatus === 'delivered'

                    // İptal edilebilirlik: Kargoya verilmemiş ve kurye teslim almamış
                    const isCancellable =
                      !isCancelled &&
                      !isDelivered &&
                      rawStatus !== 'shipped' &&
                      rawShipStatus !== 'accepted' &&
                      rawShipStatus !== 'in_transit' &&
                      rawShipStatus !== 'out_for_delivery' &&
                      rawShipStatus !== 'cancel_pending'

                    // Kargo takip bilgisi
                    const shipping = order.shipping
                    const hasRealBarcode =
                      shipping?.barcode &&
                      !/NUMUNE|SAMPLE|TEST/i.test(shipping.barcode) &&
                      !shipping.barcode.startsWith('SIM-')
                    const trackingBarcode = hasRealBarcode ? shipping.barcode : null
                    const trackingUrl = trackingBarcode ? buildHepsiJetTrackingUrl(trackingBarcode) : null

                    // Ortak Durum Rozeti
                    const statusInfo = getCommonOrderDisplayStatus(order)

                    // Açık iade talepleri
                    const returnRequests: ReturnRequest[] = Array.isArray(order.returnRequests) ? order.returnRequests : []
                    const activeReturn = returnRequests[returnRequests.length - 1]

                    const itemsCount = (order.items || []).reduce((sum: number, it: any) => sum + (Number(it.quantity) || 1), 0)

                    return (
                      <div
                        key={order.id}
                        className={`bg-white rounded-2xl border transition-all hover:shadow-md ${
                          isCancelled ? 'border-rose-200 bg-rose-50/10' : 'border-slate-200 hover:border-sky-300'
                        }`}
                      >
                        {/* 1. KART ÜST BİLGİ ŞERİDİ */}
                        <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-100 rounded-t-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">SİPARİŞ TARİHİ</span>
                              <span className="font-extrabold text-slate-800">{orderDate}</span>
                            </div>
                            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">SİPARİŞ NO</span>
                              <span className="font-mono font-black text-slate-900">
                                #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                              </span>
                            </div>
                            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
                            <div>
                              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">ALICI</span>
                              <span className="font-bold text-slate-700">
                                {order.customer?.name || order.shippingAddress?.fullName || 'Müşteri'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-black border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}>
                              {statusInfo.text}
                            </span>
                          </div>
                        </div>

                        {/* 2. KART ORTA ALAN: Ürün Görselleri & Özet Bilgiler */}
                        <div className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                          <div className="space-y-3 flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                              <span>{itemsCount} ürün · 1 HepsiJET gönderisi</span>
                              {trackingBarcode && (
                                <>
                                  <span>•</span>
                                  <span className="font-mono text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200 text-[10px]">
                                    Barkod: {trackingBarcode}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Ürün Listesi Önizlemesi */}
                            <div className="flex flex-wrap items-center gap-3">
                              {(order.items || []).map((item: any, idx: number) => (
                                <div key={idx} className="flex items-center gap-2.5 bg-slate-50 border border-slate-100 rounded-xl p-2 pr-3.5 max-w-xs">
                                  <div className="w-11 h-11 rounded-lg bg-white border border-slate-100 p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
                                    {item.image ? (
                                      <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                                    ) : (
                                      <span className="text-lg">🪥</span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-800 truncate" title={item.name}>
                                      {item.name}
                                    </p>
                                    <p className="text-[11px] text-slate-400">
                                      {item.quantity} adet · {formatPriceWithCurrency(item.price)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Açık İade Talebi Bildirimi */}
                            {activeReturn && (
                              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 mt-2">
                                <FiCornerUpLeft className="w-4 h-4 text-purple-600 flex-shrink-0" />
                                <span className="font-bold">İade Talebi:</span>
                                <span>{activeReturn.reason}</span>
                                <span className="font-bold underline cursor-pointer" onClick={() => setSelectedDetailOrder(order)}>
                                  (Durumu Gör)
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Tutar & Detay Butonu */}
                          <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 gap-3 flex-shrink-0">
                            <div className="text-left md:text-right">
                              <span className="text-[10px] uppercase font-bold text-slate-400 block">TOPLAM TUTAR</span>
                              <span className="text-lg font-black text-slate-900">
                                {formatPriceWithCurrency(order.total || 0)}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedDetailOrder(order)}
                              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>Sipariş Detayı</span>
                              <FiChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* 3. KART ALT HIZLI İŞLEMLER */}
                        <div className="px-4 sm:px-6 py-3 bg-slate-50/50 border-t border-slate-100 rounded-b-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            {trackingUrl && (
                              <a
                                href={trackingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold transition-colors border border-sky-200"
                              >
                                <FiTruck className="w-3.5 h-3.5 text-sky-600" />
                                <span>Kargomu Takip Et</span>
                                <FiExternalLink className="w-3 h-3 opacity-60" />
                              </a>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* İptal Butonu */}
                            {isCancellable && (
                              <button
                                type="button"
                                onClick={() => handleOpenCancelModal(order)}
                                className="px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-colors cursor-pointer"
                              >
                                Siparişi İptal Et
                              </button>
                            )}

                            {/* İade Talebi Butonu */}
                            {isDelivered && !activeReturn && (
                              <button
                                type="button"
                                onClick={() => handleOpenReturnModal(order)}
                                className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <FiCornerUpLeft className="w-3.5 h-3.5" />
                                <span>İade Talebi Oluştur</span>
                              </button>
                            )}

                            {/* Randevu Seçimi Butonu */}
                            {activeReturn && ['auto_preapproved', 'approved', 'awaiting_pickup_date'].includes(activeReturn.status) && (
                              <button
                                type="button"
                                onClick={() => handleOpenAppointmentModal(order, activeReturn)}
                                className="px-3 py-1.5 rounded-lg border border-purple-600 bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors cursor-pointer flex items-center gap-1 animate-pulse"
                              >
                                <FiCalendar className="w-3.5 h-3.5" />
                                <span>HepsiJET Randevusu Seç</span>
                              </button>
                            )}

                            {/* Tekrar Satın Al */}
                            <button
                              type="button"
                              onClick={() => handleBuyAgain(order)}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            >
                              <FiRotateCcw className="w-3 h-3 text-slate-400" />
                              <span>Tekrar Satın Al</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Profil Bilgileri */}
          {activeTab === 'profile' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{loc.personalHeading}</h3>
                  <p className="text-xs text-slate-500">{loc.personalSub}</p>
                </div>

                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" />
                    <span>{loc.editBtn}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <FiSave className="w-3.5 h-3.5" />
                      <span>{saving ? loc.savingBtn : loc.saveBtn}</span>
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        setFormData({
                          name: userData?.name || '',
                          phone: userData?.phone || '',
                          address: userData?.address || '',
                        })
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <FiX className="w-3.5 h-3.5" />
                      <span>{loc.cancelBtn}</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    {loc.fullNameLabel}
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-900 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      {userData?.name || '---'}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    {loc.emailLabel}
                  </label>
                  <p className="text-sm font-semibold text-slate-900 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-2">
                    <FiMail className="text-slate-400 w-4 h-4" />
                    <span>{user.email}</span>
                  </p>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    {loc.phoneLabel}
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+90 555 123 4567"
                      className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-900 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center gap-2">
                      <FiPhone className="text-slate-400 w-4 h-4" />
                      <span>{userData?.phone || '---'}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                    {loc.addressLabel}
                  </label>
                  {editing ? (
                    <textarea
                      rows={2}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Mahalle, Cadde, Sokak..."
                      className="w-full p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500 resize-none"
                    />
                  ) : (
                    <p className="text-sm font-semibold text-slate-900 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                      {userData?.address || '---'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Kayıtlı Adreslerim */}
          {activeTab === 'addresses' && (
            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Kayıtlı Teslimat & Fatura Adreslerim</h3>
                  <p className="text-xs text-slate-500">
                    Siparişlerinizde otomatik doldurulacak bireysel ve kurumsal adreslerinizi yönetin.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenNewAddress}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Yeni Adres Ekle</span>
                </button>
              </div>

              {addressLoading ? (
                <div className="py-16 text-center">
                  <div className="w-8 h-8 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Adresler yükleniyor...</p>
                </div>
              ) : savedAddresses.length === 0 ? (
                <div className="py-16 text-center">
                  <FiMapPin className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <h4 className="font-bold text-slate-800 text-sm mb-1">Henüz Kayıtlı Adresiniz Yok</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                    Siparişlerinizi daha hızlı tamamlamak için teslimat ve fatura adreslerinizi kaydedebilirsiniz.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenNewAddress}
                    className="px-4 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition-colors cursor-pointer"
                  >
                    İlk Adresinizi Ekleyin
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedAddresses.map((addr) => (
                    <div key={addr.id} className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
                            {addr.isCorporate ? <FiBriefcase className="w-4 h-4" /> : <FiHome className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{addr.title}</p>
                            <span className="text-[10px] text-slate-500 uppercase font-semibold">
                              {addr.isCorporate ? 'Kurumsal Fatura' : 'Bireysel Adres'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditAddress(addr)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 cursor-pointer"
                            title="Düzenle"
                          >
                            <FiEdit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600 cursor-pointer"
                            title="Sil"
                          >
                            <FiTrash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1">
                        <p className="font-semibold text-slate-900">{addr.fullName} · {addr.phone}</p>
                        <p className="line-clamp-2">{addr.address}</p>
                        <p className="text-slate-500 font-medium">
                          {addr.neighborhood ? `${addr.neighborhood}, ` : ''}{addr.district} / {addr.city}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-[11px]">
                        {addr.isDefaultDelivery ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">
                            <FiCheck className="w-3 h-3" /> Varsayılan Teslimat
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultAddress(addr.id, 'delivery')}
                            className="text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
                          >
                            Varsayılan Yap
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* MODAL 1: SİPARİŞ DETAY EKRANI */}
      <AnimatePresence>
        {selectedDetailOrder && (() => {
          const timeline = getTimelineSteps(selectedDetailOrder)
          const shipping = selectedDetailOrder.shipping
          const hasRealBarcode = shipping?.barcode && !/NUMUNE|SAMPLE|TEST/i.test(shipping.barcode) && !shipping.barcode.startsWith('SIM-')
          const trackingBarcode = hasRealBarcode ? shipping.barcode : null
          const trackingUrl = trackingBarcode ? buildHepsiJetTrackingUrl(trackingBarcode) : null
          const returnRequests: ReturnRequest[] = Array.isArray(selectedDetailOrder.returnRequests) ? selectedDetailOrder.returnRequests : []
          const activeReturn = returnRequests[returnRequests.length - 1]
          const isDelivered = timeline.statusInfo.key === 'delivered'
          const isCancelled = timeline.statusInfo.key === 'cancelled'
          const isCancellable = !isCancelled && !isDelivered && !['accepted', 'in_transit', 'out_for_delivery'].includes(timeline.statusInfo.key)

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200"
              >
                {/* Modal Başlığı */}
                <div className="p-6 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">
                      Sipariş #{selectedDetailOrder.orderNumber || selectedDetailOrder.id.slice(0, 8).toUpperCase()}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {selectedDetailOrder.createdAt ? new Date(selectedDetailOrder.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedDetailOrder(null)}
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Durum Rozeti */}
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">GÜNCEL DURUM</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border mt-1 ${timeline.statusInfo.bg} ${timeline.statusInfo.color} ${timeline.statusInfo.border}`}>
                        {timeline.statusInfo.text}
                      </span>
                    </div>

                    {trackingBarcode && trackingUrl && (
                      <a
                        href={trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-colors shadow-sm"
                      >
                        <FiTruck className="w-3.5 h-3.5" />
                        <span>Kargomu Takip Et</span>
                        <FiExternalLink className="w-3 h-3 opacity-70" />
                      </a>
                    )}
                  </div>

                  {/* Kargo Zaman Çizelgesi */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <FiTruck className="w-4 h-4 text-sky-600" />
                      <span>Kargo Hareketleri ve Aşamaları</span>
                    </h3>

                    <div className="p-4 rounded-2xl border border-slate-200 bg-white space-y-4">
                      {timeline.steps.map((st, i) => (
                        <div key={st.id} className="flex items-start gap-3 relative">
                          {i < timeline.steps.length - 1 && (
                            <div className={`absolute left-3.5 top-7 bottom-0 w-0.5 ${st.completed ? 'bg-sky-600' : 'bg-slate-200'}`} />
                          )}
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10 ${
                            st.completed
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            {st.completed ? <FiCheck className="w-3.5 h-3.5" /> : (i + 1)}
                          </div>
                          <div className="pt-0.5">
                            <p className={`text-xs font-bold ${st.completed ? 'text-slate-900' : 'text-slate-400'}`}>
                              {st.title}
                            </p>
                            <p className="text-[11px] text-slate-500">{st.desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sipariş Edilen Ürünler */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <FiPackage className="w-4 h-4 text-slate-600" />
                      <span>Sipariş Ürünleri</span>
                    </h3>

                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
                      {(selectedDetailOrder.items || []).map((it: any, idx: number) => (
                        <div key={idx} className="p-4 flex items-center justify-between gap-4 bg-white">
                          <div className="flex items-center gap-3">
                            <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center flex-shrink-0">
                              {it.image ? (
                                <img src={it.image} alt={it.name} className="w-full h-full object-contain" />
                              ) : (
                                <span className="text-xl">🪥</span>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900">{it.name}</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Adet: {it.quantity} · Birim: {formatPriceWithCurrency(it.price)}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-black text-slate-900">
                            {formatPriceWithCurrency((it.price || 0) * (it.quantity || 1))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Teslimat ve Alıcı Bilgileri */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <FiMapPin className="w-4 h-4 text-slate-600" />
                      <span>Teslimat Adresi</span>
                    </h3>

                    <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50 text-xs text-slate-700 space-y-1">
                      <p className="font-bold text-slate-900">
                        {selectedDetailOrder.customer?.name || selectedDetailOrder.shippingAddress?.fullName}
                      </p>
                      <p className="text-slate-500 font-medium">
                        {selectedDetailOrder.customer?.phone || selectedDetailOrder.shippingAddress?.phone}
                      </p>
                      <p>{selectedDetailOrder.shippingAddress?.address}</p>
                      <p className="text-slate-500 font-semibold">
                        {selectedDetailOrder.shippingAddress?.district ? `${selectedDetailOrder.shippingAddress.district}, ` : ''}
                        {selectedDetailOrder.shippingAddress?.city || 'İstanbul'}
                      </p>
                    </div>
                  </div>

                  {/* Ödeme Özeti */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                      <FiFileText className="w-4 h-4 text-slate-600" />
                      <span>Ödeme Özeti</span>
                    </h3>

                    <div className="p-4 rounded-2xl border border-slate-200 bg-white text-xs space-y-2">
                      <div className="flex justify-between text-slate-600">
                        <span>Ürünler Toplamı</span>
                        <span className="font-bold">{formatPriceWithCurrency(selectedDetailOrder.subtotal || selectedDetailOrder.total)}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Kargo Ücreti</span>
                        <span className="font-bold text-emerald-600">
                          {selectedDetailOrder.shippingCost ? formatPriceWithCurrency(selectedDetailOrder.shippingCost) : 'Ücretsiz'}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-900 font-black text-sm pt-2 border-t border-slate-100">
                        <span>Genel Toplam</span>
                        <span className="text-sky-600">{formatPriceWithCurrency(selectedDetailOrder.total)}</span>
                      </div>
                      <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Ödeme Durumu:</span>
                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          {selectedDetailOrder.paymentStatus === 'PAID' ? '✓ TAHSİL EDİLDİ (PayTR/Kart)' : 'ÖDEME BEKLİYOR'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Modal Aksiyon Butonları */}
                <div className="p-6 border-t border-slate-100 bg-slate-50/50 rounded-b-3xl flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isCancellable && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDetailOrder(null)
                          handleOpenCancelModal(selectedDetailOrder)
                        }}
                        className="px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-colors cursor-pointer"
                      >
                        Siparişi İptal Et
                      </button>
                    )}

                    {isDelivered && !activeReturn && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDetailOrder(null)
                          handleOpenReturnModal(selectedDetailOrder)
                        }}
                        className="px-4 py-2 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <FiCornerUpLeft className="w-4 h-4" />
                        <span>İade Talebi Oluştur</span>
                      </button>
                    )}

                    {activeReturn && ['auto_preapproved', 'approved', 'awaiting_pickup_date'].includes(activeReturn.status) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDetailOrder(null)
                          handleOpenAppointmentModal(selectedDetailOrder, activeReturn)
                        }}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 animate-pulse"
                      >
                        <FiCalendar className="w-4 h-4" />
                        <span>HepsiJET Randevusu Seç</span>
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleBuyAgain(selectedDetailOrder)}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <FiRotateCcw className="w-3.5 h-3.5" />
                    <span>Tekrar Satın Al</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )
        })()}
      </AnimatePresence>

      {/* MODAL 2: İADE TALEBİ OLUŞTURMA */}
      <AnimatePresence>
        {returnModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <FiCornerUpLeft className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">İade Talebi Oluştur</h3>
                    <p className="text-xs text-slate-400">Sipariş #{returnModalOrder.orderNumber || returnModalOrder.id.slice(0, 8)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setReturnModalOrder(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              {returnModalError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2 font-medium">
                  <FiAlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{returnModalError}</span>
                </div>
              )}

              {/* İade Kapsamı Seçimi */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">İade Kapsamı</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setReturnScope('partial')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      returnScope === 'partial'
                        ? 'border-purple-600 bg-purple-50/50 text-purple-950 font-bold ring-2 ring-purple-600/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <p className="text-xs font-bold">Seçtiğim Ürünleri İade Et</p>
                    <p className="text-[11px] text-slate-400 font-normal mt-0.5">Uygunsa hızlı otomatik onaylanır</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setReturnScope('full')}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      returnScope === 'full'
                        ? 'border-purple-600 bg-purple-50/50 text-purple-950 font-bold ring-2 ring-purple-600/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <p className="text-xs font-bold">Tüm Siparişi İade Et</p>
                    <p className="text-[11px] text-slate-400 font-normal mt-0.5">Yönetici onayına sunulur</p>
                  </button>
                </div>
              </div>

              {/* Ürün Listesi ve Miktar Seçimi (Kısmi İade için) */}
              {returnScope === 'partial' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">İade Edilecek Ürünler</label>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl p-2 bg-slate-50/40 max-h-48 overflow-y-auto">
                    {(returnModalOrder.items || []).map((it: any) => {
                      const pid = it.productId || it.id || it.name
                      const maxQty = Number(it.quantity) || 1
                      const currentSelected = selectedReturnItems[pid] || 0

                      return (
                        <div key={pid} className="py-2.5 px-2 flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={currentSelected > 0}
                              onChange={(e) => {
                                setSelectedReturnItems((prev) => ({
                                  ...prev,
                                  [pid]: e.target.checked ? 1 : 0,
                                }))
                              }}
                              className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                            />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-900 truncate">{it.name}</p>
                              <p className="text-[11px] text-slate-400">Satın Alınan: {maxQty} adet</p>
                            </div>
                          </div>

                          {currentSelected > 0 && (
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-[11px] text-slate-500 font-medium">İade Adedi:</span>
                              <select
                                value={currentSelected}
                                onChange={(e) => {
                                  const val = Number(e.target.value)
                                  setSelectedReturnItems((prev) => ({ ...prev, [pid]: val }))
                                }}
                                className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-xs font-bold"
                              >
                                {Array.from({ length: maxQty }, (_, i) => i + 1).map((n) => (
                                  <option key={n} value={n}>{n} Adet</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* İade Nedeni */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">İade Nedeni</label>
                <select
                  value={returnReasonCode}
                  onChange={(e) => setReturnReasonCode(e.target.value as ReturnReasonCode)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-purple-600"
                >
                  {Object.entries(RETURN_REASONS).map(([code, title]) => (
                    <option key={code} value={code}>{title}</option>
                  ))}
                </select>
              </div>

              {/* Açıklama */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">Açıklama (İsteğe Bağlı)</label>
                <textarea
                  rows={2}
                  value={returnNote}
                  onChange={(e) => setReturnNote(e.target.value)}
                  placeholder="İade talebinizle ilgili eklemek istediğiniz detaylar..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-purple-600 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setReturnModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={returnSubmitting}
                  onClick={handleSubmitReturn}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {returnSubmitting ? 'Gönderiliyor...' : 'İade Talebini Gönder'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 3: HEPSİJET RANDEVULU TOPLAMA TARİHİ SEÇİCİ */}
      <AnimatePresence>
        {appointmentModalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                    <FiCalendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900">HepsiJET İade Randevusu Seç</h3>
                    <p className="text-xs text-slate-400">Kurye kapınızdan belirtilen tarihte teslim alacaktır</p>
                  </div>
                </div>
                <button
                  onClick={() => setAppointmentModalData(null)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              {datesError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <FiAlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{datesError}</span>
                </div>
              )}

              {scheduledResult ? (
                /* Başarılı Randevu ve Barkod Sonucu */
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-xl">
                    ✓
                  </div>
                  <h4 className="text-sm font-black text-emerald-900">Randevulu İade Kodu Oluşturuldu!</h4>
                  <div className="p-3 bg-white rounded-xl border border-emerald-200 inline-block font-mono text-base font-black text-slate-900 tracking-wider">
                    {scheduledResult.barcode}
                  </div>
                  <p className="text-xs text-slate-600 max-w-sm mx-auto">
                    HepsiJET kuryesi <strong className="text-emerald-900">{scheduledResult.appointmentDate}</strong> tarihinde adresinize gelecektir. Paketin üzerine bu barkod numarasını yazmanız yeterlidir.
                  </p>
                  <div className="pt-2">
                    <a
                      href={scheduledResult.trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                    >
                      <span>İade Gönderisini Takip Et</span>
                      <FiExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>
                  </div>
                </div>
              ) : datesLoading ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-8 h-8 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400 font-semibold">HepsiJET sisteminden uygun tarihler sorgulanıyor...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                    <FiMapPin className="w-4 h-4 text-sky-600 flex-shrink-0" />
                    <span>
                      Teslim Alınacak Adres: <strong>{appointmentModalData.order.shippingAddress?.district || 'Merkez'} / {appointmentModalData.order.shippingAddress?.city || 'İstanbul'}</strong>
                    </span>
                  </div>

                  {/* Tarih Seçimi */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Uygun Toplama Tarihleri
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {availableDates.map((item) => {
                        const dObj = new Date(item.date)
                        const dayName = dObj.toLocaleDateString('tr-TR', { weekday: 'short' })
                        const formatted = dObj.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })

                        return (
                          <button
                            key={item.date}
                            type="button"
                            onClick={() => setSelectedDate(item.date)}
                            className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                              selectedDate === item.date
                                ? 'border-sky-600 bg-sky-50 text-sky-950 font-black ring-2 ring-sky-600/20'
                                : 'border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <span className="text-[10px] uppercase text-slate-400 block font-bold">{dayName}</span>
                            <span className="text-xs font-bold mt-0.5 block">{formatted}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Saat Aralığı */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Saat Dilimi
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSelectedSlot(1)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          selectedSlot === 1
                            ? 'border-sky-600 bg-sky-50 text-sky-950 font-black ring-2 ring-sky-600/20'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold block">09:00 - 13:00</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Öğleden Önce</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedSlot(2)}
                        className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                          selectedSlot === 2
                            ? 'border-sky-600 bg-sky-50 text-sky-950 font-black ring-2 ring-sky-600/20'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span className="text-xs font-bold block">13:00 - 18:00</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">Öğleden Sonra</span>
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setAppointmentModalData(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      Kapat
                    </button>
                    <button
                      type="button"
                      disabled={schedulingLoading || !selectedDate}
                      onClick={handleConfirmSchedule}
                      className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      {schedulingLoading ? 'Kargo Kodu Alınıyor...' : 'Randevuyu Onayla ve Kod Al'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 4: SİPARİŞ İPTAL ONAYI */}
      <AnimatePresence>
        {cancelModalOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <div className="w-10 h-10 rounded-2xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                  <FiAlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Siparişi İptal Etmek İstiyor Musunuz?</h3>
                  <p className="text-xs text-slate-400">Sipariş #{cancelModalOrder.orderNumber || cancelModalOrder.id.slice(0, 8)}</p>
                </div>
              </div>

              {cancelError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {cancelError}
                </div>
              )}

              <p className="text-xs text-slate-600">
                Ödemeniz PayTR ve banka güvencesiyle otomatik olarak kartınıza iade edilecektir. Lütfen iptal nedeninizi seçiniz:
              </p>

              <select
                value={cancelReasonText}
                onChange={(e) => setCancelReasonText(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-none focus:border-rose-500"
              >
                <option value="Vazgeçtim / Başka ürün alacağım">Vazgeçtim / Başka ürün alacağım</option>
                <option value="Teslimat adresimi yanlış girdim">Teslimat adresimi yanlış girdim</option>
                <option value="Ödeme yöntemimi değiştirmek istiyorum">Ödeme yöntemimi değiştirmek istiyorum</option>
                <option value="Yanlışlıkla sipariş verdim">Yanlışlıkla sipariş verdim</option>
                <option value="Diğer">Diğer</option>
              </select>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCancelModalOrder(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  disabled={cancellingLoading}
                  onClick={handleConfirmCancel}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {cancellingLoading ? 'İptal Ediliyor...' : 'Evet, Siparişi İptal Et'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Adres Ekleme / Düzenleme Modalı */}
      <AnimatePresence>
        {addressModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900">
                  {editingAddressId ? 'Adresi Düzenle' : 'Yeni Adres Ekle'}
                </h3>
                <button
                  onClick={() => setAddressModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer"
                >
                  <FiX className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveAddress} className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Adres Başlığı *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ev, İş, Yazlık..."
                    value={addressForm.title}
                    onChange={(e) => setAddressForm({ ...addressForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Ad Soyad *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ad Soyad"
                      value={addressForm.fullName}
                      onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Telefon *</label>
                    <input
                      type="tel"
                      required
                      placeholder="05XX XXX XX XX"
                      value={addressForm.phone}
                      onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-500 font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">İl *</label>
                    <input
                      type="text"
                      required
                      placeholder="İstanbul, Ankara, Konya..."
                      value={addressForm.city}
                      onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-500 font-medium"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">İlçe *</label>
                    <input
                      type="text"
                      required
                      placeholder="Kadıköy, Selçuklu..."
                      value={addressForm.district}
                      onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-500 font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Açık Adres *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Mahalle, Cadde, Sokak, Bina No, Daire..."
                    value={addressForm.address}
                    onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-sky-500 font-medium resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setAddressModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={savingAddress}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingAddress ? 'Kaydediliyor...' : 'Adresi Kaydet'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
