'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { doc, getDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FiShoppingCart, FiCheck, FiArrowLeft, FiUser, FiPhone, FiMail, FiMapPin } from 'react-icons/fi'
import { getCart, getCartTotal, CartItem } from '@/lib/utils/cart'

interface Product {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  images?: string[]
  image?: string
  description: string
  inStock?: boolean
  colors?: ColorOption[]
}

interface ColorOption {
  name: string
  code: string
  price?: number
  discountPrice?: number | null
}

function CheckoutContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const productId = searchParams.get('urun')
  const isFromCart = searchParams.get('sepet') === 'true'
  
  const [product, setProduct] = useState<Product | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedColor, setSelectedColor] = useState<ColorOption | null>(null)
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [shippingFee, setShippingFee] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    postalCode: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    // Sepetten geliyorsa
    if (isFromCart) {
      const cart = getCart()
      if (cart.length === 0) {
        router.push('/sepet')
        return
      }
      setCartItems(cart)
      setCurrentPrice(getCartTotal())
      setLoading(false)
    } else if (!productId) {
      router.push('/urunler')
      return
    } else {
      // Tek ürün satın alma
      const fetchProduct = async () => {
        try {
          const db = getFirestoreDB()
          const productRef = doc(db, 'products', productId)
          const productSnap = await getDoc(productRef)
          
          if (productSnap.exists()) {
            const productData = { id: productSnap.id, ...productSnap.data() } as Product
            setProduct(productData)
            
            // İlk rengi seç veya ana fiyatı kullan
            if (productData.colors && productData.colors.length > 0) {
              const firstColor = productData.colors[0]
              setSelectedColor(firstColor)
              setCurrentPrice(firstColor.price || productData.price)
            } else {
              setCurrentPrice(productData.discountPrice || productData.price)
            }
          } else {
            router.push('/urunler')
          }
        } catch (error) {
          console.error('Ürün yüklenirken hata:', error)
          router.push('/urunler')
        } finally {
          setLoading(false)
        }
      }
      fetchProduct()
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
  }, [productId, isFromCart, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    // TODO: Ödeme işlemi entegre edilecek
    // Şimdilik sadece bilgileri kaydediyoruz
    try {
      // Burada ödeme işlemi yapılacak
      alert('Ödeme işlemi yakında eklenecek!')
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

  if (!isFromCart && !product) {
    return (
      <div className="pt-32 pb-20 bg-white min-h-screen">
        <div className="container-custom section-padding">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Ürün bulunamadı</h1>
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

  const finalPrice = isFromCart ? currentPrice : (selectedColor?.price || product?.discountPrice || product?.price || 0)

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Ürün Bilgileri */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-lg p-8"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Sipariş Özeti</h2>
            
            {isFromCart ? (
              <div className="space-y-4">
                {cartItems.map((item) => {
                  const itemPrice = item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price
                  const itemTotal = itemPrice * item.quantity
                  
                  return (
                    <div key={item.id} className="flex items-start gap-4 pb-4 border-b last:border-0">
                      <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-4xl">🦷</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">{item.name}</h3>
                        {item.selectedColor && (
                          <p className="text-sm text-gray-600 mb-2">Renk: {item.selectedColor.name}</p>
                        )}
                        <p className="text-sm text-gray-600 mb-2">Adet: {item.quantity}</p>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">Birim Fiyat</p>
                            <span className="text-lg font-bold text-primary-600">
                              {itemPrice.toLocaleString('tr-TR')} ₺
                            </span>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">Toplam</p>
                            <span className="text-lg font-bold text-primary-600">
                              {itemTotal.toLocaleString('tr-TR')} ₺
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : product ? (
              <div className="flex items-start gap-4 mb-6 pb-6 border-b">
                <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg overflow-hidden flex-shrink-0">
                  {product.images?.[0] || product.image ? (
                    <img
                      src={product.images?.[0] || product.image}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-4xl">🦷</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{product.description}</p>
                  
                  {/* Renk Seçimi */}
                  {product.colors && product.colors.length > 0 && (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Renk:</p>
                      <div className="flex gap-2">
                        {product.colors.map((color) => (
                          <button
                            key={color.code}
                            onClick={() => {
                              setSelectedColor(color)
                              setCurrentPrice(color.price || product.price)
                            }}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              selectedColor?.code === color.code
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {color.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Fiyat</p>
                      {product.discountPrice && product.discountPrice < product.price ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold text-primary-600">
                            {finalPrice.toLocaleString('tr-TR')} ₺
                          </span>
                          <span className="text-sm text-gray-400 line-through">
                            {product.price.toLocaleString('tr-TR')} ₺
                          </span>
                        </div>
                      ) : (
                        <span className="text-xl font-bold text-primary-600">
                          {finalPrice.toLocaleString('tr-TR')} ₺
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <div className="flex justify-between text-gray-700">
                <span>Ara Toplam</span>
                <span className="font-semibold">{finalPrice.toLocaleString('tr-TR')} ₺</span>
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
                  <span className="text-primary-600">{(finalPrice + shippingFee).toLocaleString('tr-TR')} ₺</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Sipariş Formu */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-2xl shadow-lg p-8"
          >
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Sipariş Bilgileri</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiUser className="inline w-4 h-4 mr-2" />
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FiMapPin className="inline w-4 h-4 mr-2" />
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

              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                disabled={submitting || (!isFromCart && product?.inStock === false)}
                className={`w-full px-6 py-4 bg-primary-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  (!isFromCart && product?.inStock === false) ? 'bg-gray-400' : ''
                }`}
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    İşleniyor...
                  </>
                ) : (
                  <>
                    <FiShoppingCart className="w-5 h-5" />
                    Siparişi Tamamla
                  </>
                )}
              </motion.button>

              {!isFromCart && product?.inStock === false && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-red-600 font-medium">
                    ⚠️ Bu ürün şu anda stokta bulunmamaktadır.
                  </p>
                </div>
              )}
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
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
      <CheckoutContent />
    </Suspense>
  )
}
