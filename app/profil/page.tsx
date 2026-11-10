'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
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
} from 'react-icons/fi'
import { doc, updateDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'
import { buildHepsiJetTrackingUrl } from '@/lib/hepsijet/tracking-url'

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
    confirmCancelOrder: 'Are you sure you want to cancel this order?\n\nAny payment will be refunded within 1-3 business days.',
    orderCancelledSuccess: 'Your order was successfully cancelled.',
    orderCancelError: 'An error occurred while cancelling the order.',
    qty: 'Qty:',
    total: 'Total:',
    personalHeading: 'Personal & Shipping Details',
    personalSub: 'Your saved details for fast checkout and delivery.',
    editBtn: 'Edit',
    saveBtn: 'Save',
    savingBtn: 'Saving...',
    cancelBtn: 'Cancel',
    fullNameLabel: 'Full Name',
    emailLabel: 'Email Address',
    phoneLabel: 'Phone Number',
    addressLabel: 'Shipping Address',
    alertUpdated: 'Profile information updated successfully!',
    alertError: 'An error occurred while updating profile.',
  },
  de: {
    logout: 'Abmelden',
    tabOrders: 'Meine Bestellungen',
    tabProfile: 'Kontodaten',
    tabAddresses: 'Gespeicherte Adressen',
    loadingOrders: 'Bestellungen werden geladen...',
    noOrdersTitle: 'Noch keine Bestellungen',
    noOrdersDesc: 'Entdecken Sie unsere 360° Schallzahnbürsten und Reisesets.',
    exploreBtn: 'Produkte ansehen',
    orderNo: 'Bestell-Nr.:',
    statusDelivered: 'Zugestellt',
    statusShipped: 'Versandt',
    statusProcessing: 'In Bearbeitung',
    statusCancelled: 'Storniert',
    cancelOrderBtn: 'Bestellung stornieren',
    cancellingOrder: 'Wird storniert...',
    confirmCancelOrder: 'Möchten Sie diese Bestellung wirklich stornieren?\n\nEventuelle Zahlungen werden innerhalb von 1-3 Werktagen erstattet.',
    orderCancelledSuccess: 'Ihre Bestellung wurde erfolgreich storniert.',
    orderCancelError: 'Fehler beim Stornieren der Bestellung.',
    qty: 'Menge:',
    total: 'Gesamt:',
    personalHeading: 'Persönliche Daten & Lieferadresse',
    personalSub: 'Ihre hinterlegten Daten für schnelle Bestellungen.',
    editBtn: 'Bearbeiten',
    saveBtn: 'Speichern',
    savingBtn: 'Wird gespeichert...',
    cancelBtn: 'Abbrechen',
    fullNameLabel: 'Vollständiger Name',
    emailLabel: 'E-Mail-Adresse',
    phoneLabel: 'Telefonnummer',
    addressLabel: 'Lieferadresse',
    alertUpdated: 'Profildaten erfolgreich aktualisiert!',
    alertError: 'Fehler beim Aktualisieren der Daten.',
  },
  fr: {
    logout: 'Se Déconnecter',
    tabOrders: 'Mes Commandes',
    tabProfile: 'Mon Compte',
    tabAddresses: 'Adresses Enregistrées',
    loadingOrders: 'Chargement des commandes...',
    noOrdersTitle: 'Aucune commande pour le moment',
    noOrdersDesc: 'Découvrez nos brosses à dents soniques 360° et nos soins dentaires.',
    exploreBtn: 'Découvrir les Produits',
    orderNo: 'N° de commande :',
    statusDelivered: 'Livré',
    statusShipped: 'Expédié',
    statusProcessing: 'En préparation',
    statusCancelled: 'Annulée',
    cancelOrderBtn: 'Annuler la commande',
    cancellingOrder: 'Annulation en cours...',
    confirmCancelOrder: 'Êtes-vous sûr de vouloir annuler cette commande ?\n\nLe remboursement sera effectué sous 1 à 3 jours ouvrés.',
    orderCancelledSuccess: 'Votre commande a été annulée avec succès.',
    orderCancelError: "Une erreur est survenue lors de l'annulation de la commande.",
    qty: 'Qté :',
    total: 'Total :',
    personalHeading: 'Informations Personnelles & Livraison',
    personalSub: 'Vos coordonnées enregistrées pour faciliter vos prochaines commandes.',
    editBtn: 'Modifier',
    saveBtn: 'Enregistrer',
    savingBtn: 'Enregistrement...',
    cancelBtn: 'Annuler',
    fullNameLabel: 'Nom et Prénom',
    emailLabel: 'Adresse E-mail',
    phoneLabel: 'Numéro de téléphone',
    addressLabel: 'Adresse de livraison',
    alertUpdated: 'Profil mis à jour avec succès !',
    alertError: 'Une error est survenue lors de la mise à jour.',
  },
  it: {
    logout: "Esci",
    tabOrders: "I Miei Ordini",
    tabProfile: "Account",
    tabAddresses: "Indirizzi Salvati",
    loadingOrders: "Caricamento ordini...",
    noOrdersTitle: "Nessun Ordine Ancora",
    noOrdersDesc: "Scopri i nostri spazzolini sonici 360° e le nostre cure dentali premium.",
    exploreBtn: "Esplora i Prodotti",
    orderNo: "Ordine N°:",
    statusDelivered: "Consegnato",
    statusShipped: "Spedito",
    statusProcessing: "In elaborazione",
    statusCancelled: "Annullato",
    cancelOrderBtn: "Annulla Ordine",
    cancellingOrder: "Annullamento in corso...",
    confirmCancelOrder: "Sei sicuro di voler annullare questo ordine?\n\nIl rimborso verrà elaborato entro 1-3 giorni lavorativi.",
    orderCancelledSuccess: "Il tuo ordine è stato annullato con successo.",
    orderCancelError: "Si è verificato un errore durante l'annullamento dell'ordine.",
    qty: "Qtà:",
    total: "Totale:",
    personalHeading: "Dati Personali & Indirizzo",
    personalSub: "Le tue informazioni salvate per un checkout rapido.",
    editBtn: "Modifica",
    saveBtn: "Salva",
    savingBtn: "Salvataggio...",
    cancelBtn: "Annulla",
    fullNameLabel: "Nome e Cognome",
    emailLabel: "Indirizzo E-mail",
    phoneLabel: "Numero di Telefono",
    addressLabel: "Indirizzo di Spedizione",
    alertUpdated: "Profilo aggiornato con successo!",
    alertError: "Si è verificato un errore durante l’aggiornamento.",
  },
}

export default function ProfilePage() {
  const router = useRouter()
  const { locale, getLocalizedPath, formatPriceWithCurrency } = useLocale()
  const loc = PROFILE_TRANSLATIONS[locale] || PROFILE_TRANSLATIONS.tr

  const [activeTab, setActiveTab] = useState<'profile' | 'orders' | 'addresses'>('orders')
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
  })

  // Saved Addresses State
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

  const handleCancelOrder = async (orderId: string) => {
    if (!user) return
    const confirmed = window.confirm(loc.confirmCancelOrder)
    if (!confirmed) return

    setCancellingOrderId(orderId)
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/orders/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          orderId,
          reason: 'Müşteri hesabı üzerinden iptal edildi',
        }),
      })

      const data = await res.json()
      if (res.ok && data.success) {
        alert(data.message || loc.orderCancelledSuccess)
        await loadOrders(user.uid, user.email || undefined)
      } else {
        alert(data.error || loc.orderCancelError)
      }
    } catch (err: any) {
      console.error('Sipariş iptal hatası:', err)
      alert(loc.orderCancelError)
    } finally {
      setCancellingOrderId(null)
    }
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
      
      if (formData.phone) {
        updateData.phone = formData.phone
      }
      
      if (formData.address) {
        updateData.address = formData.address
      }
      
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
    <div className="pt-32 pb-24 min-h-screen bg-slate-50">
      <div className="container-custom section-padding max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-sm border border-slate-200/80 overflow-hidden"
        >
          {/* Profile Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-sky-900 px-8 py-10 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 text-2xl font-black">
                {userData?.name ? userData.name.charAt(0).toUpperCase() : 'G'}
              </div>
              <div>
                <h1 className="text-2xl font-black">{userData?.name || user.email?.split('@')[0]}</h1>
                <p className="text-xs text-slate-300 mt-0.5">{user.email}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition-colors self-start sm:self-auto"
            >
              <FiLogOut className="w-3.5 h-3.5" />
              <span>{loc.logout}</span>
            </button>
          </div>

          {/* Tabs Selector */}
          <div className="flex border-b border-slate-100 px-8 pt-4 gap-4 bg-slate-50/50">
            <button
              onClick={() => setActiveTab('orders')}
              className={`flex items-center gap-2 pb-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
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
              className={`flex items-center gap-2 pb-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
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
              className={`flex items-center gap-2 pb-4 text-xs font-black uppercase tracking-wider transition-all border-b-2 ${
                activeTab === 'addresses'
                  ? 'border-sky-600 text-sky-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <FiMapPin className="w-4 h-4" />
              <span>{loc.tabAddresses || 'Kayıtlı Adreslerim'} ({savedAddresses.length})</span>
            </button>
          </div>

          {/* Tab 1: Orders Tab */}
          {activeTab === 'orders' && (
            <div className="p-6 sm:p-8">
              {ordersLoading ? (
                <div className="py-16 text-center">
                  <div className="w-10 h-10 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-semibold">{loc.loadingOrders}</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                    <FiPackage className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">{loc.noOrdersTitle}</h3>
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
                <div className="space-y-6">
                  {orders.map((order) => {
                    const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '---'
                    const isCancelled = order.status === 'cancelled'
                    const isCancellable =
                      !isCancelled &&
                      order.status !== 'shipped' &&
                      order.status !== 'completed' &&
                      order.status !== 'delivered' &&
                      order.shipping?.status !== 'shipped' &&
                      order.shipping?.status !== 'delivered' &&
                      order.shipping?.status !== 'cancel_pending'

                    // Kargo takip bilgisi (HepsiJET)
                    const shipping = (order as any).shipping
                    const hasRealBarcode =
                      shipping?.barcode &&
                      !/NUMUNE|SAMPLE|TEST/i.test(shipping.barcode) &&
                      !shipping.barcode.startsWith('SIM-')
                    const trackingBarcode = hasRealBarcode ? shipping.barcode : (shipping?.trackingNumber || null)
                    const trackingUrl = trackingBarcode
                      ? (shipping?.trackingUrl && shipping.trackingUrl.includes('gonderi-takibi')
                          ? shipping.trackingUrl
                          : buildHepsiJetTrackingUrl(trackingBarcode))
                      : null

                    // Durum metni — HepsiJET canlı API durumu ve sipariş status eşleşmesine göre
                    const getStatusInfo = (): { text: string; color: string; bg: string; border: string } => {
                      if (isCancelled) return { text: loc.statusCancelled, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' }
                      if (order.status === 'completed' || order.status === 'delivered' || shipping?.status === 'delivered' || shipping?.providerStatus === 'DELIVERED') {
                        return { text: loc.statusDelivered || 'Teslim Edildi', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' }
                      }
                      if (shipping?.status === 'out_for_delivery' || shipping?.providerStatus === 'OUT_FOR_DELIVERY') {
                        return { text: 'Dağıtımda', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' }
                      }
                      if (shipping?.status === 'accepted' || shipping?.providerStatus === 'ACCEPTED' || order.status === 'shipped') {
                        return { text: loc.statusShipped || 'Kargoya Verildi', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' }
                      }
                      if (shipping?.status === 'in_transit') {
                        return { text: (loc as any).statusInTransit || 'Yolda', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' }
                      }
                      // HepsiJET gerçek barkodu varsa kargo etiketi oluşturulmuştur
                      if (hasRealBarcode) {
                        return { text: shipping?.displayStatus || (loc as any).statusLabelCreated || 'Kargo Etiketi Oluşturuldu', color: 'text-slate-700', bg: 'bg-slate-100', border: 'border-slate-200' }
                      }
                      if (order.status === 'paid' || order.status === 'processing') return { text: loc.statusProcessing, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
                      return { text: (loc as any).statusReceived || 'Sipariş Alındı', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' }
                    }

                    const statusInfo = getStatusInfo()

                    return (
                      <div
                        key={order.id}
                        className={`bg-white rounded-2xl border p-6 space-y-4 shadow-2xs transition-colors ${
                          isCancelled ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200/80 hover:border-sky-300'
                        }`}
                      >
                        {/* Order Top Line */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 text-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-extrabold text-slate-900">
                              {loc.orderNo} #{order.orderNumber || order.id.slice(0, 8).toUpperCase()}
                            </span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-500 flex items-center gap-1">
                              <FiCalendar className="w-3.5 h-3.5" />
                              {orderDate}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-3 py-1 rounded-full text-[11px] font-bold border ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border}`}
                            >
                              {statusInfo.text}
                            </span>
                          </div>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-3">
                          {(order.items || []).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {item.image ? (
                                    <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                                  ) : (
                                    <span>🦷</span>
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-bold text-slate-900">{item.name}</h4>
                                  <p className="text-slate-400 text-[11px]">{loc.qty} {item.quantity}</p>
                                </div>
                              </div>
                              <span className="font-black text-slate-900">
                                {formatPriceWithCurrency((item.price || 0) * (item.quantity || 1))}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* HepsiJET Kargo Takip Bilgisi — yalnızca gerçek barkod varsa göster */}
                        {trackingBarcode && trackingUrl && (
                          <div className="pt-4 border-t border-sky-100 bg-sky-50/50 rounded-xl p-3 space-y-2">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-sky-800">
                              <FiTruck className="w-4 h-4 text-sky-600 flex-shrink-0" />
                              <span>{(loc as any).trackingTitle || 'Kargo Bilgisi'}</span>
                            </div>
                            <div className="text-[11px] text-slate-600 space-y-1 ml-5">
                              <div>
                                <span className="text-slate-400 font-medium">{(loc as any).trackingCarrier || 'Kargo Firması:'} </span>
                                <span className="font-bold text-slate-800">HepsiJET</span>
                              </div>
                              <div>
                                <span className="text-slate-400 font-medium">{(loc as any).trackingNo || 'Takip No:'} </span>
                                <span className="font-mono font-bold text-slate-800">{trackingBarcode}</span>
                              </div>
                            </div>
                            <a
                              href={trackingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-5 inline-flex items-center gap-1.5 mt-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-colors shadow-sm shadow-sky-600/20"
                            >
                              <FiTruck className="w-3.5 h-3.5" />
                              <span>{(loc as any).trackingBtn || 'Kargomu Takip Et'}</span>
                              <FiExternalLink className="w-3 h-3 opacity-70" />
                            </a>
                          </div>
                        )}

                        {/* Order Bottom Line */}
                        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                          <div className="text-slate-500 flex items-center gap-1.5">
                            <FiMapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {order.shippingAddress?.city || ''} {order.shippingAddress?.address ? `(${order.shippingAddress.address.slice(0, 30)}...)` : ''}
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2">
                            <span className="text-slate-500 font-medium">{loc.total}</span>
                            <span className="text-base font-black text-sky-600">
                              {formatPriceWithCurrency(order.total || 0)}
                            </span>
                          </div>
                        </div>

                        {/* Cancel Notice / Refund Notice */}
                        {isCancelled && (
                          <div className="pt-3 border-t border-rose-100 flex items-center gap-2 text-xs text-rose-700 bg-rose-50/50 p-2.5 rounded-xl">
                            <FiAlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                            <div>
                              <span className="font-bold">{loc.statusCancelled}</span>
                              {order.cancellationReason && (
                                <span className="text-slate-600 ml-1.5">({order.cancellationReason})</span>
                              )}
                              {order.refundStatus === 'pending_refund' && (
                                <span className="block text-[11px] text-slate-500 mt-0.5">İade tutarı PayTR/Banka güvencesiyle 1-3 iş günü içinde kartınıza yansıtılacaktır.</span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Customer Cancel Button */}
                        {isCancellable && (
                          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <span className="text-[11px] text-slate-500">
                              Henüz kargoya verilmemiş siparişinizi iptal edebilirsiniz.
                            </span>
                            <button
                              type="button"
                              disabled={cancellingOrderId === (order.orderNumber || order.id)}
                              onClick={() => handleCancelOrder(order.orderNumber || order.id)}
                              className="px-3.5 py-1.5 rounded-xl border border-rose-200 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 self-end sm:self-auto cursor-pointer"
                            >
                              <FiX className="w-3.5 h-3.5" />
                              <span>
                                {cancellingOrderId === (order.orderNumber || order.id) ? loc.cancellingOrder : loc.cancelOrderBtn}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Profile & Address Info */}
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
                    className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    <FiEdit2 className="w-3.5 h-3.5" />
                    <span>{loc.editBtn}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
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
                      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
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

          {/* Tab 3: Saved Addresses Manager */}
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
                  className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-600/20 self-start sm:self-auto"
                >
                  <FiPlus className="w-4 h-4" />
                  <span>Yeni Adres Ekle</span>
                </button>
              </div>

              {addressLoading ? (
                <div className="py-16 text-center">
                  <div className="w-10 h-10 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-xs text-slate-400 font-semibold">Adresleriniz yükleniyor...</p>
                </div>
              ) : savedAddresses.length === 0 ? (
                <div className="py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto mb-4 border border-sky-100">
                    <FiMapPin className="w-8 h-8" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-1">Henüz Kayıtlı Adresiniz Yok</h4>
                  <p className="text-xs text-slate-500 mb-6 max-w-sm mx-auto">
                    Satın alma işlemlerinizi hızlandırmak için ilk teslimat adresinizi hemen ekleyebilirsiniz.
                  </p>
                  <button
                    type="button"
                    onClick={handleOpenNewAddress}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-full text-xs font-bold uppercase tracking-wider transition-colors shadow-md shadow-sky-600/20"
                  >
                    <FiPlus className="w-4 h-4" />
                    <span>İlk Adresinizi Ekleyin</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {savedAddresses.map((addr) => {
                    const isCorporate = Boolean(addr.isCorporate)
                    const isDefault = Boolean(addr.isDefaultDelivery)

                    return (
                      <div
                        key={addr.id}
                        className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                          isDefault
                            ? 'border-sky-500 bg-sky-50/20 shadow-xs ring-1 ring-sky-500/30'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div>
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                  isCorporate ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {isCorporate ? <FiBriefcase className="w-4 h-4" /> : <FiHome className="w-4 h-4" />}
                              </div>
                              <div>
                                <h4 className="font-extrabold text-sm text-slate-900">{addr.title}</h4>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {isCorporate ? 'Kurumsal Fatura' : 'Bireysel Adres'}
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              {isDefault && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200 flex items-center gap-1">
                                  <FiCheck className="w-3 h-3" />
                                  Varsayılan Teslimat
                                </span>
                              )}
                              {addr.isDefaultBilling && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  Varsayılan Fatura
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Recipient Info */}
                          <div className="py-3 space-y-1.5 text-xs text-slate-600">
                            <p className="font-bold text-slate-900 flex items-center gap-1.5">
                              <FiUser className="w-3.5 h-3.5 text-slate-400" />
                              <span>{addr.fullName}</span>
                            </p>
                            <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
                              <FiPhone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{addr.phone}</span>
                            </p>
                            <p className="font-semibold text-slate-800 pt-1">
                              {addr.city} / {addr.district}
                              {addr.neighborhood ? ` • ${addr.neighborhood}` : ''}
                            </p>
                            <p className="text-slate-500 leading-relaxed text-[11px]">{addr.address}</p>

                            {/* Corporate Details */}
                            {isCorporate && (
                              <div className="mt-3 p-2.5 rounded-xl bg-purple-50/60 border border-purple-100 text-[11px] space-y-0.5">
                                <p className="font-bold text-purple-950">{addr.companyName || 'Şirket'}</p>
                                <p className="text-purple-800">
                                  VD: <span className="font-semibold">{addr.taxOffice || '---'}</span> | VN: <span className="font-mono font-semibold">{addr.taxNumber || '---'}</span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card Actions Footer */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs mt-2">
                          <div>
                            {!isDefault ? (
                              <button
                                type="button"
                                onClick={() => handleSetDefaultAddress(addr.id, 'delivery')}
                                className="text-[11px] font-bold text-sky-600 hover:text-sky-700 underline underline-offset-2"
                              >
                                Varsayılan Yap
                              </button>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-400">✓ Varsayılan</span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditAddress(addr)}
                              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors"
                            >
                              <FiEdit2 className="w-3 h-3" />
                              <span>Düzenle</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteAddress(addr.id)}
                              className="px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 font-bold text-[11px] transition-colors"
                              title="Adresi Sil"
                            >
                              <FiTrash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Address Add/Edit Modal */}
              {addressModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                  <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <h3 className="text-base font-extrabold text-slate-900">
                          {editingAddressId ? 'Adresi Düzenle' : 'Yeni Adres Ekle'}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          Siparişlerinizde hızlı kullanım için teslimat ve fatura bilgileri.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAddressModalOpen(false)}
                        className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200 flex items-center justify-center transition-colors"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSaveAddress} className="space-y-4 text-xs">
                      <div>
                        <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          Adres Başlığı *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.title}
                          onChange={(e) => setAddressForm({ ...addressForm, title: e.target.value })}
                          placeholder="Örn: Evim, Ofis, Yazlık"
                          className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            Ad Soyad *
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.fullName}
                            onChange={(e) => setAddressForm({ ...addressForm, fullName: e.target.value })}
                            placeholder="Adınız Soyadınız"
                            className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            Telefon Numarası *
                          </label>
                          <input
                            type="tel"
                            required
                            value={addressForm.phone}
                            onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                            placeholder="05XXXXXXXXX"
                            className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            İl (Şehir) *
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                            placeholder="İstanbul, Ankara..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            İlçe *
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.district}
                            onChange={(e) => setAddressForm({ ...addressForm, district: e.target.value })}
                            placeholder="Kadıköy, Çankaya..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            Mahalle / Semt
                          </label>
                          <input
                            type="text"
                            value={addressForm.neighborhood}
                            onChange={(e) => setAddressForm({ ...addressForm, neighborhood: e.target.value })}
                            placeholder="Örn: Caferağa Mah."
                            className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                          />
                        </div>
                        <div>
                          <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            Posta Kodu
                          </label>
                          <input
                            type="text"
                            value={addressForm.postalCode}
                            onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                            placeholder="34710"
                            className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          Açık Adres (Cadde, Sokak, No, Daire) *
                        </label>
                        <textarea
                          required
                          rows={3}
                          value={addressForm.address}
                          onChange={(e) => setAddressForm({ ...addressForm, address: e.target.value })}
                          placeholder="Cadde, sokak, bina no, daire no..."
                          className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500 resize-none"
                        />
                      </div>

                      {/* Corporate Invoice Toggle */}
                      <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                        <label className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addressForm.isCorporate}
                            onChange={(e) => setAddressForm({ ...addressForm, isCorporate: e.target.checked })}
                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                          />
                          <span className="font-bold text-slate-900 text-xs">
                            Bu kurumsal bir fatura adresidir (Şirket Bilgileri)
                          </span>
                        </label>

                        {addressForm.isCorporate && (
                          <div className="space-y-3 pt-2 border-t border-slate-200">
                            <div>
                              <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                Firma Resmi Unvanı *
                              </label>
                              <input
                                type="text"
                                required={addressForm.isCorporate}
                                value={addressForm.companyName}
                                onChange={(e) => setAddressForm({ ...addressForm, companyName: e.target.value })}
                                placeholder="Örn: ABC Ticaret Ltd. Şti."
                                className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-sky-500"
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                  Vergi Dairesi (Opsiyonel)
                                </label>
                                <input
                                  type="text"
                                  value={addressForm.taxOffice}
                                  onChange={(e) => setAddressForm({ ...addressForm, taxOffice: e.target.value })}
                                  placeholder="Kadıköy V.D."
                                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-sky-500"
                                />
                              </div>
                              <div>
                                <label className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                                  Vergi Numarası *
                                </label>
                                <input
                                  type="text"
                                  required={addressForm.isCorporate}
                                  value={addressForm.taxNumber}
                                  onChange={(e) => setAddressForm({ ...addressForm, taxNumber: e.target.value })}
                                  placeholder="10 Haneli Vergi No"
                                  className="w-full px-3 py-2 bg-white rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-sky-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Defaults */}
                      <div className="space-y-2 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={addressForm.isDefaultDelivery}
                            onChange={(e) => setAddressForm({ ...addressForm, isDefaultDelivery: e.target.checked })}
                            className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500"
                          />
                          <span className="text-xs text-slate-700 font-medium">
                            Varsayılan teslimat adresi olarak ayarla
                          </span>
                        </label>
                      </div>

                      {/* Modal Footer Buttons */}
                      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => setAddressModalOpen(false)}
                          className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                        >
                          İptal
                        </button>
                        <button
                          type="submit"
                          disabled={savingAddress}
                          className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-bold transition-colors shadow-md shadow-sky-600/20 disabled:opacity-50"
                        >
                          {savingAddress ? 'Kaydediliyor...' : 'Adresi Kaydet'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
