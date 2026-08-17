'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot, doc, updateDoc, query, orderBy } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPackage, FiTruck, FiCheck, FiX, FiClock, FiEye,
  FiSearch, FiFilter, FiRefreshCw, FiChevronDown, FiChevronUp,
  FiUser, FiMapPin, FiPhone, FiMail, FiShoppingBag,
} from 'react-icons/fi'

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
  shippingAddress: {
    fullName?: string
    address?: string
    city?: string
    district?: string
    zipCode?: string
    country?: string
  }
  paymentMethod?: string
  notes?: string
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; color: string; bg: string; border: string; icon: any }> = {
  pending:    { label: 'Bekliyor',     color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', icon: FiClock },
  processing: { label: 'Hazırlanıyor', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  icon: FiPackage },
  shipped:    { label: 'Kargoda',      color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200', icon: FiTruck },
  delivered:  { label: 'Teslim Edildi',color: 'text-emerald-700',bg: 'bg-emerald-50',border: 'border-emerald-200',icon: FiCheck },
  cancelled:  { label: 'İptal Edildi', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',    icon: FiX },
}

const STATUS_FLOW: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered']

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  useEffect(() => {
    const db = getFirestoreDB()
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))
      setOrders(list)
      setLoading(false)
    }, (err) => {
      console.error('Orders fetch error:', err)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setUpdating(orderId)
    try {
      const db = getFirestoreDB()
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      })
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null)
      }
    } catch (err) {
      console.error('Status update error:', err)
      alert('Durum güncellenemedi!')
    } finally {
      setUpdating(null)
    }
  }

  const filtered = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.status === statusFilter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      o.customer?.name?.toLowerCase().includes(q) ||
      o.customer?.email?.toLowerCase().includes(q) ||
      o.id.toLowerCase().includes(q) ||
      o.orderNumber?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  // Stats
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    processing: orders.filter((o) => o.status === 'processing').length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
    revenue: orders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (o.total || 0), 0),
  }

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
      <div className="mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sipariş Yönetimi</h1>
          <p className="text-gray-500 mt-1">Tüm siparişleri gerçek zamanlı izleyin ve yönetin</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Canlı Güncelleme Aktif
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-8">
        {[
          { label: 'Toplam Sipariş', value: stats.total, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Bekliyor', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Hazırlanıyor', value: stats.processing, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'Kargoda', value: stats.shipped, color: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'Teslim Edildi', value: stats.delivered, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'İptal Edildi', value: stats.cancelled, color: 'text-red-700', bg: 'bg-red-50' },
          { label: 'Toplam Gelir', value: formatPrice(stats.revenue), color: 'text-primary-700', bg: 'bg-primary-50', wide: true },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`${stat.bg} border border-gray-200 rounded-xl p-4 ${(stat as any).wide ? 'col-span-2 md:col-span-2' : ''}`}
          >
            <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="İsim, email veya sipariş no ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', ...STATUS_FLOW, 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                statusFilter === s
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s === 'all' ? 'Tümü' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <FiShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">Sipariş bulunamadı</p>
            <p className="text-gray-400 text-sm mt-1">Filtrelerinizi değiştirmeyi deneyin</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Table Header */}
            <div className="hidden lg:grid grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <span>Sipariş No</span>
              <span>Müşteri</span>
              <span>Ürünler</span>
              <span>Toplam</span>
              <span>Durum</span>
              <span>İşlemler</span>
            </div>

            {filtered.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending
              const StatusIcon = cfg.icon
              const isExpanded = expandedOrder === order.id

              return (
                <div key={order.id}>
                  <div
                    className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                  >
                    {/* Order No */}
                    <div>
                      <p className="text-xs text-gray-400 lg:hidden mb-0.5">Sipariş</p>
                      <p className="font-mono text-sm font-semibold text-gray-800">
                        #{order.orderNumber || order.id.slice(-8).toUpperCase()}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</p>
                    </div>

                    {/* Customer */}
                    <div>
                      <p className="text-xs text-gray-400 lg:hidden mb-0.5">Müşteri</p>
                      <p className="font-medium text-gray-900">{order.customer?.name || '-'}</p>
                      <p className="text-xs text-gray-500">{order.customer?.email}</p>
                    </div>

                    {/* Items count */}
                    <div>
                      <p className="text-xs text-gray-400 lg:hidden mb-0.5">Ürünler</p>
                      <p className="text-sm text-gray-700">
                        {order.items?.reduce((s, i) => s + i.quantity, 0) || 0} adet
                      </p>
                      <p className="text-xs text-gray-400">{order.items?.length || 0} kalem</p>
                    </div>

                    {/* Total */}
                    <div>
                      <p className="text-xs text-gray-400 lg:hidden mb-0.5">Toplam</p>
                      <p className="font-semibold text-gray-900">{formatPrice(order.total)}</p>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <p className="text-xs text-gray-400 lg:hidden mb-0.5">Durum</p>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="Detay Görüntüle"
                      >
                        <FiEye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Hızlı İşlem"
                      >
                        {isExpanded ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Quick Actions */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 pt-3">Durum Güncelle</p>
                          <div className="flex flex-wrap gap-2">
                            {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG.pending][]).map(([s, cfg]) => (
                              <button
                                key={s}
                                disabled={order.status === s || updating === order.id}
                                onClick={() => updateStatus(order.id, s)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-40 ${
                                  order.status === s
                                    ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current`
                                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                                }`}
                              >
                                {updating === order.id ? (
                                  <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <cfg.icon className="w-3 h-3" />
                                )}
                                {cfg.label}
                              </button>
                            ))}
                          </div>

                          {/* Quick product list */}
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {order.items?.map((item, idx) => (
                              <div key={idx} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2 border border-gray-100">
                                {item.image && (
                                  <img src={item.image} alt={item.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <p className="text-xs font-medium text-gray-800 truncate">{item.name}</p>
                                  <p className="text-xs text-gray-500">{item.quantity}x {formatPrice(item.price)}</p>
                                </div>
                              </div>
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

      {/* Order Detail Modal */}
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
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Sipariş #{selectedOrder.orderNumber || selectedOrder.id.slice(-8).toUpperCase()}
                  </h2>
                  <p className="text-sm text-gray-500">{formatDate(selectedOrder.createdAt)}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Status Update */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3">Sipariş Durumu</p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(STATUS_CONFIG) as [OrderStatus, typeof STATUS_CONFIG.pending][]).map(([s, cfg]) => (
                      <button
                        key={s}
                        disabled={selectedOrder.status === s || updating === selectedOrder.id}
                        onClick={() => updateStatus(selectedOrder.id, s)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                          selectedOrder.status === s
                            ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current`
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <cfg.icon className="w-3 h-3" />
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Info */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <FiUser className="w-4 h-4" /> Müşteri Bilgileri
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-700">
                      <FiUser className="w-3.5 h-3.5 text-gray-400" />
                      {selectedOrder.customer?.name || '-'}
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <FiMail className="w-3.5 h-3.5 text-gray-400" />
                      {selectedOrder.customer?.email || '-'}
                    </div>
                    {selectedOrder.customer?.phone && (
                      <div className="flex items-center gap-2 text-gray-700">
                        <FiPhone className="w-3.5 h-3.5 text-gray-400" />
                        {selectedOrder.customer.phone}
                      </div>
                    )}
                  </div>
                </div>

                {/* Shipping Address */}
                {selectedOrder.shippingAddress && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <FiMapPin className="w-4 h-4" /> Teslimat Adresi
                    </p>
                    <div className="text-sm text-gray-700 space-y-1">
                      {selectedOrder.shippingAddress.fullName && (
                        <p>{selectedOrder.shippingAddress.fullName}</p>
                      )}
                      {selectedOrder.shippingAddress.address && (
                        <p>{selectedOrder.shippingAddress.address}</p>
                      )}
                      <p>
                        {[
                          selectedOrder.shippingAddress.district,
                          selectedOrder.shippingAddress.city,
                          selectedOrder.shippingAddress.zipCode,
                        ].filter(Boolean).join(', ')}
                      </p>
                      {selectedOrder.shippingAddress.country && (
                        <p>{selectedOrder.shippingAddress.country}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Order Items */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <FiPackage className="w-4 h-4" /> Ürünler
                  </p>
                  <div className="space-y-3">
                    {selectedOrder.items?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{item.name}</p>
                          <p className="text-sm text-gray-500">Adet: {item.quantity}</p>
                        </div>
                        <p className="font-semibold text-gray-900 flex-shrink-0">{formatPrice(item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Price Summary */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                  {selectedOrder.subtotal !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Ara Toplam</span>
                      <span className="text-gray-800">{formatPrice(selectedOrder.subtotal)}</span>
                    </div>
                  )}
                  {selectedOrder.shippingCost !== undefined && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Kargo</span>
                      <span className="text-gray-800">
                        {selectedOrder.shippingCost === 0 ? 'Ücretsiz' : formatPrice(selectedOrder.shippingCost)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 mt-2">
                    <span>Toplam</span>
                    <span className="text-primary-600">{formatPrice(selectedOrder.total)}</span>
                  </div>
                </div>

                {/* Notes */}
                {selectedOrder.notes && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <p className="text-sm font-semibold text-amber-800 mb-1">Müşteri Notu</p>
                    <p className="text-sm text-amber-700">{selectedOrder.notes}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
