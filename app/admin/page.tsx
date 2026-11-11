'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import {
  FiPlus, FiShoppingBag, FiPackage, FiTrendingUp, FiUsers,
  FiArrowRight, FiClock, FiTruck, FiCheck, FiAlertCircle,
  FiTag, FiEdit3, FiImage, FiArchive, FiCornerUpLeft,
} from 'react-icons/fi'

import { calculateOrderStats, OrderStats } from '@/lib/utils/orderStats'
import { getCommonOrderDisplayStatus } from '@/lib/hepsijet/status-display'

interface Order {
  id: string
  orderNumber?: string
  status: string
  total: number
  createdAt: string
  customer: { name: string; email: string }
  paymentStatus?: string
  shipping?: any
  isTrash?: boolean
  isArchived?: boolean
  archiveAt?: string
  terminalStatusAt?: string
  completedAt?: string
  cancelledAt?: string
  refundStatus?: string
  isCancelled?: boolean
}

interface Product {
  id: string
  name: string
  price: number
  stock?: number
}

const getStatusIcon = (key: string) => {
  switch (key) {
    case 'delivered':
      return FiCheck
    case 'accepted':
    case 'in_transit':
    case 'out_for_delivery':
      return FiTruck
    case 'label_created':
      return FiTag
    case 'processing':
      return FiPackage
    case 'returned':
      return FiCornerUpLeft
    case 'cancelled':
      return FiAlertCircle
    case 'pending':
    default:
      return FiClock
  }
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [nowMs, setNowMs] = useState(Date.now())

  useEffect(() => {
    const db = getFirestoreDB()

    // Tüm siparişleri Siparişler sayfası ile aynı şekilde limit olmadan dinle
    const ordersQ = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
    const unsub1 = onSnapshot(ordersQ, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)))
      setLoadingOrders(false)
    })

    // Ürünleri dinle
    const productsQ = query(collection(db, 'products'))
    const unsub2 = onSnapshot(productsQ, (snap) => {
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Product)))
      setLoadingProducts(false)
    })

    // Dakikalık zamanlayıcı (Türkiye saati ve arşiv kontrolleri için)
    const interval = setInterval(() => setNowMs(Date.now()), 60000)

    return () => {
      unsub1()
      unsub2()
      clearInterval(interval)
    }
  }, [])

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      const now = new Date(nowMs)
      const diff = now.getTime() - d.getTime()
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)

      if (minutes < 1) return 'Az önce'
      if (minutes < 60) return `${minutes} dk önce`
      if (hours < 24) return `${hours} sa önce`
      if (days < 7) return `${days} gün önce`
      return new Intl.DateTimeFormat('tr-TR', { day: '2-digit', month: 'short' }).format(d)
    } catch {
      return '-'
    }
  }

  const formatPrice = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n || 0)

  // Ortak istatistik yardımcısı ile tek kaynak üzerinden hesaplama
  const stats: OrderStats = calculateOrderStats(orders, nowMs)
  const totalProducts = products.length
  const lowStock = products.filter((p) => (p.stock || 0) < 5).length

  // Son siparişler (çöp hariç son 8 sipariş)
  const recentOrders = orders.filter((o) => !o.isTrash).slice(0, 8)

  const QUICK_LINKS = [
    { icon: FiPlus,        label: 'Yeni Ürün Ekle',   href: '/admin/urunler/yeni',  color: 'from-primary-500 to-primary-600' },
    { icon: FiShoppingBag, label: 'Siparişleri Gör', href: '/admin/siparisler',     color: 'from-violet-500 to-violet-600' },
    { icon: FiTag,         label: 'Kategoriler',     href: '/admin/kategoriler',    color: 'from-emerald-500 to-emerald-600' },
    { icon: FiEdit3,       label: 'Site İçeriği',    href: '/admin/icerik',         color: 'from-amber-500 to-amber-600' },
    { icon: FiImage,       label: 'Medya Kütüphanesi', href: '/admin/medya',        color: 'from-rose-500 to-rose-600' },
  ]

  const cardVariants = {
    hidden: { opacity: 0, y: 16 },
    visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.4 } }),
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Kontrol Paneli</h1>
            <p className="text-gray-500 mt-1">
              {new Intl.DateTimeFormat('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(nowMs))}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Canlı Veri
          </div>
        </div>
      </div>

      {/* Ana Metrik Kartları (Siparişler Ekranı ile %100 Uyumlu) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {[
          {
            label: 'Toplam Sipariş',
            value: loadingOrders ? '—' : stats.total,
            sub: `${stats.pending} bekliyor • ${stats.archived} arşivde`,
            icon: FiShoppingBag,
            color: 'text-violet-600',
            bg: 'bg-violet-50',
            border: 'border-violet-100',
          },
          {
            label: 'Toplam Gelir',
            value: loadingOrders ? '—' : formatPrice(stats.revenue),
            sub: `Bugün: ${formatPrice(stats.todayRevenue)}`,
            icon: FiTrendingUp,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            border: 'border-emerald-100',
          },
          {
            label: 'Toplam Ürün',
            value: loadingProducts ? '—' : totalProducts,
            sub: lowStock > 0 ? `${lowStock} düşük stok` : 'Stok sağlıklı',
            icon: FiPackage,
            color: 'text-primary-600',
            bg: 'bg-primary-50',
            border: 'border-primary-100',
          },
          {
            label: 'Kargoda',
            value: loadingOrders ? '—' : stats.shipped,
            sub: `${stats.processing} hazırlanıyor`,
            icon: FiTruck,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            border: 'border-amber-100',
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            custom={i}
            initial="hidden"
            animate="visible"
            variants={cardVariants}
            className={`bg-white rounded-2xl border ${stat.border} p-5 shadow-sm`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 ${stat.bg} rounded-xl flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{stat.label}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Detaylı Durum Dağılım Çubuğu (Tüm Durumlar) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 mb-8">
        {[
          { label: 'Bekliyor', count: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Hazırlanıyor', count: stats.processing, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Kargoda', count: stats.shipped, color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200' },
          { label: 'Teslim Edildi', count: stats.delivered, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          { label: 'İade Edildi', count: stats.returned, color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
          { label: 'İptal Edildi', count: stats.cancelled, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200' },
          { label: 'Arşivde', count: stats.archived, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
        ].map((item) => (
          <Link key={item.label} href="/admin/siparisler">
            <div className={`p-3 rounded-xl border ${item.border} ${item.bg} hover:shadow-sm transition-all cursor-pointer`}>
              <div className="text-[11px] font-medium text-gray-500 truncate">{item.label}</div>
              <div className={`text-lg font-bold ${item.color} mt-0.5`}>
                {loadingOrders ? '—' : item.count}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Hızlı İşlemler */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Hızlı İşlemler</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {QUICK_LINKS.map((link, i) => (
            <motion.div
              key={link.href}
              custom={i + 4}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
            >
              <Link href={link.href}>
                <div className="group bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer text-center">
                  <div className={`w-10 h-10 bg-gradient-to-br ${link.color} rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform`}>
                    <link.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-xs font-medium text-gray-700 leading-tight">{link.label}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Son Siparişler (Siparişler sayfası ile aynı rozet ve eşleştirme kuralları) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Son Siparişler</h2>
            <p className="text-xs text-gray-400 mt-0.5">Gerçek zamanlı güncellenen son işlemler</p>
          </div>
          <Link
            href="/admin/siparisler"
            className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
          >
            Tümünü Gör
            <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingOrders ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-12">
            <FiShoppingBag className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Henüz sipariş yok</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentOrders.map((order) => {
              const commonStatus = getCommonOrderDisplayStatus(order)
              const StatusIcon = getStatusIcon(commonStatus.key)
              const isPaid = String(order.paymentStatus || '').toUpperCase() === 'PAID'

              return (
                <Link key={order.id} href="/admin/siparisler">
                  <div className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${commonStatus.bg} ${commonStatus.border}`}>
                      <StatusIcon className={`w-4 h-4 ${commonStatus.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {order.customer?.name || 'Anonim'}
                        </p>
                        {isPaid && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Ödendi
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-gray-500 font-mono font-medium">
                          #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                        </span>
                        {order.shipping?.barcode && (
                          <span className="text-[10px] font-mono text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                            {order.shipping.barcode}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatPrice(order.total)}</p>
                      <p className="text-xs text-gray-400">{formatDate(order.createdAt)}</p>
                    </div>
                    <span className={`hidden sm:inline-flex px-2.5 py-1 rounded-full text-xs font-bold border ${commonStatus.bg} ${commonStatus.color} ${commonStatus.border}`}>
                      {commonStatus.text}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </motion.div>
    </div>
  )
}
