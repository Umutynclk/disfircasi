'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { FiShoppingCart, FiArrowLeft, FiUser, FiPhone, FiMail, FiMapPin, FiCreditCard, FiLock, FiCheck } from 'react-icons/fi'
import { getCart, getCartTotal, CartItem } from '@/lib/utils/cart'
import { doc, getDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

function PaymentContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isFromCart = searchParams.get('sepet') === 'true'
  
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
    cardNumber: '',
    cardName: '',
    cardExpiry: '',
    cardCvv: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [paymentActive, setPaymentActive] = useState(false) // Ödeme aktif değil

  useEffect(() => {
    // Sepetten geliyorsa
    if (isFromCart) {
      const cart = getCart()
      if (cart.length === 0) {
        router.push('/sepet')
        return
      }
      setCartItems(cart)
      setLoading(false)
    } else {
      // Tek ürün satın alma için sepete yönlendir
      router.push('/sepet')
      return
    }
    
    // Kargo ücretini yükle
    const loadShippingFee = async () => {
      try {
        const db = getFirestoreDB()
        const shippingDoc = await getDoc(doc(db, 'siteContent', 'shipping'))
        if (shippingDoc.exists()) {
          const data = shippingDoc.data()
          setShippingFee(data.shippingFee || 0)
        }
      } catch (error) {
        console.error('Kargo ücreti yükleme hatası:', error)
      }
    }
    loadShippingFee()
  }, [isFromCart, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!paymentActive) {
      alert('Ödeme sistemi şu anda aktif değil. Lütfen daha sonra tekrar deneyin.')
      return
    }

    setSubmitting(true)
    try {
      // TODO: Sanal pos entegrasyonu burada yapılacak
      // Şimdilik sadece bilgileri kaydediyoruz
      console.log('Ödeme bilgileri:', formData)
      console.log('Sepet:', cartItems)
      
      // Burada sanal pos API'sine istek gönderilecek
      // Örnek: await processPayment(formData, cartItems)
      
      alert('Ödeme işlemi yakında aktif olacak!')
    } catch (error) {
      console.error('Ödeme hatası:', error)
      alert('Ödeme işlemi sırasında bir hata oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="pt-32 pb-20 bg-white min-h-screen">
        <div className="container-custom section-padding">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="pt-32 pb-20 bg-white min-h-screen">
        <div className="container-custom section-padding">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Sepetiniz boş</h1>
            <button
              onClick={() => router.push('/urunler')}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              Ürünlere Dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  const subtotal = getCartTotal()
  const total = subtotal + shippingFee

  return (
    <div className="pt-32 pb-20 bg-gradient-to-b from-white to-gray-50 min-h-screen">
      <div className="container-custom section-padding">
        <motion.button
          onClick={() => router.back()}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-gray-600 hover:text-primary-600 mb-8 transition-colors"
        >
          <FiArrowLeft className="w-5 h-5" />
          Geri Dön
        </motion.button>

        {/* Ödeme Aktif Değil Uyarısı */}
        {!paymentActive && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-6 mb-8"
          >
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <FiLock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-yellow-900 mb-2">
                  Ödeme Sistemi Şu Anda Aktif Değil
                </h3>
                <p className="text-yellow-800">
                  Ödeme sistemi entegrasyonu tamamlandıktan sonra aktif olacaktır. 
                  Şu anda test amaçlı formu doldurabilirsiniz ancak ödeme işlemi gerçekleştirilmeyecektir.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sipariş Özeti */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6 sticky top-32"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Sipariş Özeti</h2>

              <div className="space-y-4 mb-6">
                {cartItems.map((item) => {
                  const itemPrice = item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price
                  const itemTotal = itemPrice * item.quantity
                  
                  return (
                    <div key={item.id} className="flex items-start gap-3 pb-4 border-b last:border-0">
                      <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-2xl">🦷</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 mb-1 truncate">{item.name}</h3>
                        {item.selectedColor && (
                          <p className="text-xs text-gray-600 mb-1">Renk: {item.selectedColor.name}</p>
                        )}
                        <p className="text-xs text-gray-600">Adet: {item.quantity}</p>
                        <p className="text-sm font-bold text-primary-600 mt-1">
                          {itemTotal.toLocaleString('tr-TR')} ₺
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between text-gray-700">
                  <span>Ara Toplam</span>
                  <span className="font-semibold">{subtotal.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Kargo</span>
                  <span className="font-semibold">
                    {shippingFee === 0 ? 'Ücretsiz' : `${shippingFee.toLocaleString('tr-TR')} ₺`}
                  </span>
                </div>
                <div className="pt-3 border-t">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Toplam</span>
                    <span className="text-primary-600">{total.toLocaleString('tr-TR')} ₺</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Ödeme Formu */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-lg p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-primary-100 rounded-lg">
                  <FiCreditCard className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Ödeme Bilgileri</h2>
                  <p className="text-sm text-gray-600">Güvenli ödeme için bilgilerinizi girin</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Kişisel Bilgiler */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiUser className="w-5 h-5" />
                    Kişisel Bilgiler
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Ad Soyad <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                        placeholder="Adınız ve soyadınız"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FiMail className="inline w-4 h-4 mr-2" />
                        E-posta <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                        placeholder="ornek@email.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <FiPhone className="inline w-4 h-4 mr-2" />
                        Telefon <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                        placeholder="05XX XXX XX XX"
                      />
                    </div>
                  </div>
                </div>

                {/* Adres Bilgileri */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiMapPin className="w-5 h-5" />
                    Teslimat Adresi
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Adres <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        required
                        rows={3}
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors resize-none"
                        placeholder="Adres bilgileriniz"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Şehir <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                          placeholder="İstanbul"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Posta Kodu
                        </label>
                        <input
                          type="text"
                          value={formData.postalCode}
                          onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                          placeholder="34000"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Kredi Kartı Bilgileri */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiCreditCard className="w-5 h-5" />
                    Kredi Kartı Bilgileri
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kart Üzerindeki İsim <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.cardName}
                        onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                        placeholder="AD SOYAD"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kart Numarası <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={19}
                        value={formData.cardNumber}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\s/g, '').replace(/\D/g, '')
                          const formatted = value.match(/.{1,4}/g)?.join(' ') || value
                          setFormData({ ...formData, cardNumber: formatted })
                        }}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                        placeholder="1234 5678 9012 3456"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Son Kullanma Tarihi <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={5}
                          value={formData.cardExpiry}
                          onChange={(e) => {
                            let value = e.target.value.replace(/\D/g, '')
                            if (value.length >= 2) {
                              value = value.slice(0, 2) + '/' + value.slice(2, 4)
                            }
                            setFormData({ ...formData, cardExpiry: value })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                          placeholder="MM/YY"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          CVV <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={3}
                          value={formData.cardCvv}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '').slice(0, 3)
                            setFormData({ ...formData, cardCvv: value })
                          }}
                          className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                          placeholder="123"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Güvenlik Bilgisi */}
                <div className="bg-primary-50 border border-primary-200 rounded-lg p-4 flex items-start gap-3">
                  <FiLock className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-primary-900 mb-1">Güvenli Ödeme</p>
                    <p className="text-xs text-primary-700">
                      Tüm ödeme bilgileriniz SSL ile şifrelenmektedir. Kart bilgileriniz saklanmamaktadır.
                    </p>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  whileHover={{ scale: paymentActive ? 1.02 : 1 }}
                  whileTap={{ scale: paymentActive ? 0.98 : 1 }}
                  disabled={submitting || !paymentActive}
                  className={`w-full px-6 py-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
                    paymentActive
                      ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-lg hover:shadow-xl'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  } disabled:opacity-50`}
                >
                  {submitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      İşleniyor...
                    </>
                  ) : (
                    <>
                      <FiCheck className="w-5 h-5" />
                      {paymentActive ? 'Ödemeyi Tamamla' : 'Ödeme Sistemi Aktif Değil'}
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentPage() {
  return (
    <Suspense fallback={
      <div className="pt-32 pb-20 bg-white min-h-screen">
        <div className="container-custom section-padding">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
          </div>
        </div>
      </div>
    }>
      <PaymentContent />
    </Suspense>
  )
}
