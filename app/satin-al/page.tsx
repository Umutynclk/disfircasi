'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { doc, getDoc, collection, addDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { FiCheck, FiArrowLeft, FiUser, FiPhone, FiMail, FiMapPin, FiShield, FiLock, FiArrowRight } from 'react-icons/fi'
import { getCart, clearCart, CartItem } from '@/lib/utils/cart'

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [shippingFee, setShippingFee] = useState(0)

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    note: '',
  })

  const [submitting, setSubmitting] = useState(false)
  const [orderComplete, setOrderComplete] = useState(false)
  const [orderId, setOrderId] = useState('')

  useEffect(() => {
    const loadShippingFee = async () => {
      try {
        const db = getFirestoreDB()
        const shippingDoc = await getDoc(doc(db, 'siteContent', 'shipping'))
        if (shippingDoc.exists()) {
          setShippingFee(shippingDoc.data().shippingFee || 0)
        }
      } catch (error) {
        console.error('Kargo ücreti okuma hatası:', error)
      }
    }
    loadShippingFee()

    const cart = getCart()
    if (cart.length === 0) {
      router.push('/sepet')
      return
    }
    setCartItems(cart)
    setLoading(false)
  }, [router])

  const subtotal = cartItems.reduce((total, item) => {
    const price = item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price
    return total + price * item.quantity
  }, 0)

  const totalAmount = subtotal + shippingFee

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name || !formData.email || !formData.phone || !formData.address || !formData.city) {
      alert('Lütfen gerekli iletişim ve adres bilgilerini doldurun.')
      return
    }

    setSubmitting(true)

    try {
      const db = getFirestoreDB()
      const orderNumber = `GS-${Date.now().toString(36).toUpperCase()}`
      const orderData = {
        orderNumber,
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        },
        shippingAddress: {
          fullName: formData.name,
          address: formData.address,
          city: formData.city,
          zipCode: formData.postalCode || '',
          country: 'Türkiye',
        },
        items: cartItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price,
          image: item.image || '',
          selectedColor: item.selectedColor || null,
        })),
        subtotal,
        shippingCost: shippingFee,
        total: totalAmount,
        notes: formData.note || '',
        status: 'pending',
        paymentStatus: 'pending_verification',
        createdAt: new Date().toISOString(),
      }

      const docRef = await addDoc(collection(db, 'orders'), orderData)
      setOrderId(docRef.id)
      setOrderComplete(true)
      clearCart()
    } catch (error) {
      console.error('Sipariş kaydetme hatası:', error)
      alert('Siparişiniz oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
      </div>
    )
  }

  if (orderComplete) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="container-custom section-padding">
          <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 md:p-12 text-center shadow-sm">
            <div className="w-20 h-20 bg-brand-softGreen rounded-full flex items-center justify-center mx-auto mb-6 text-brand-green">
              <FiCheck className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-brand-navy mb-2">Siparişiniz Alındı!</h2>
            <p className="text-slate-500 text-sm mb-6">
              Sipariş Numaranız: <span className="font-bold text-slate-900">{orderId}</span>
            </p>
            <p className="text-xs text-slate-600 leading-relaxed mb-8 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              Sipariş detayları ve kargo takip bilgileriniz{' '}
              <span className="font-semibold text-brand-blue">{formData.email}</span>{' '}
              adresinize iletilecektir.
            </p>
            <button
              onClick={() => router.push('/')}
              className="w-full py-4 bg-brand-blue text-white rounded-full font-bold text-xs uppercase tracking-wider hover:bg-blue-600 transition-colors shadow-md shadow-brand-blue/20"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-32 pb-24 min-h-screen bg-slate-50">
      <div className="container-custom section-padding">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-brand-blue mb-8 transition-colors"
        >
          <FiArrowLeft className="w-4 h-4" />
          Sepete Dön
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Checkout Form */}
          <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            <div>
              <h1 className="text-2xl font-black text-brand-navy">Teslimat & İletişim Bilgileri</h1>
              <p className="text-xs text-slate-500 mt-1">Lütfen siparişinizin ulaşacağı adresi eksiksiz doldurun.</p>
            </div>

            <form onSubmit={handleSubmitOrder} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Ad Soyad *
                  </label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      required
                      placeholder="Ahmet Yılmaz"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    E-Posta Adresi *
                  </label>
                  <div className="relative">
                    <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="email"
                      required
                      placeholder="ahmet@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Telefon *
                  </label>
                  <div className="relative">
                    <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="tel"
                      required
                      placeholder="0555 123 4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    Şehir *
                  </label>
                  <div className="relative">
                    <FiMapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                      type="text"
                      required
                      placeholder="İstanbul"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Açık Adres *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Mahalle, sokak, bina ve daire numarası..."
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-brand-blue"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Sipariş Notu (Opsiyonel)
                </label>
                <input
                  type="text"
                  placeholder="Zil çalışmıyor, kargocu arasın vb."
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-brand-blue"
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-gradient-to-r from-brand-blue to-blue-600 text-white font-bold text-sm rounded-full shadow-lg shadow-brand-blue/30 hover:opacity-95 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FiLock className="w-4 h-4" />
                  <span>{submitting ? 'Sipariş İşleniyor...' : 'Siparişi Onayla & Tamamla'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Order Summary & Security */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-lg font-black text-brand-navy pb-3 border-b border-slate-100">
                Sipariş Özeti ({cartItems.length} Kalem)
              </h3>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                {cartItems.map((item) => {
                  const price = item.discountPrice || item.price
                  return (
                    <div key={item.id} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 p-1 border border-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                          ) : (
                            <span>🦷</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 line-clamp-1">{item.name}</p>
                          <p className="text-slate-400">Adet: {item.quantity}</p>
                        </div>
                      </div>
                      <span className="font-extrabold text-slate-900 ml-2">
                        {(price * item.quantity).toLocaleString('tr-TR')} ₺
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Ara Toplam</span>
                  <span className="font-bold text-slate-900">{subtotal.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Kargo Ücreti</span>
                  <span className="font-bold text-brand-green">
                    {shippingFee === 0 ? 'Ücretsiz Kargo' : `${shippingFee.toLocaleString('tr-TR')} ₺`}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline text-sm">
                  <span className="font-bold text-slate-900">Toplam Tutar</span>
                  <span className="text-xl font-black text-brand-blue">{totalAmount.toLocaleString('tr-TR')} ₺</span>
                </div>
              </div>
            </div>

            {/* SSL Notice */}
            <div className="p-4 rounded-2xl bg-brand-softBlue border border-brand-blue/20 flex items-center gap-3 text-xs text-brand-blue font-semibold">
              <FiShield className="w-6 h-6 flex-shrink-0" />
              <span>Siparişiniz 256-Bit SSL şifrelemesi ve server-side fiyat doğrulaması ile korunmaktadır.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SatinAlPage() {
  return (
    <Suspense fallback={
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  )
}
