'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiShoppingCart, FiTrash2, FiPlus, FiMinus, FiArrowLeft, FiArrowRight } from 'react-icons/fi'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getCart, removeFromCart, updateCartItemQuantity, getCartTotal, clearCart, CartItem } from '@/lib/utils/cart'
import { getCurrentUser } from '@/lib/firebase/userAuth'
import { doc, getDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

export default function CartPage() {
  const router = useRouter()
  const [cart, setCart] = useState<CartItem[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [shippingFee, setShippingFee] = useState(0)

  useEffect(() => {
    const loadCart = () => {
      setCart(getCart())
    }
    
    loadCart()
    
    // Cart update event listener
    const handleCartUpdate = () => {
      loadCart()
    }
    window.addEventListener('cartUpdated', handleCartUpdate)
    
    // User check
    getCurrentUser().then(setUser)
    
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
    
    setLoading(false)
    
    return () => {
      window.removeEventListener('cartUpdated', handleCartUpdate)
    }
  }, [])

  const handleRemove = (itemId: string) => {
    removeFromCart(itemId)
    setCart(getCart())
  }

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    updateCartItemQuantity(itemId, newQuantity)
    setCart(getCart())
  }

  const subtotal = getCartTotal()
  const shipping = shippingFee
  const total = subtotal + shipping

  if (loading) {
    return (
      <div className="pt-32 pb-20 min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="pt-32 pb-20 min-h-screen bg-gradient-to-b from-white to-gray-50">
        <div className="container-custom section-padding">
          <div className="max-w-2xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-lg p-12"
            >
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <FiShoppingCart className="w-12 h-12 text-gray-400" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Sepetiniz Boş</h2>
              <p className="text-gray-600 mb-8">Sepetinize henüz ürün eklemediniz.</p>
              <Link href="/urunler">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-primary-600 text-white rounded-full font-semibold flex items-center gap-2 mx-auto hover:bg-primary-700 transition-colors"
                >
                  <FiArrowRight className="w-5 h-5" />
                  Alışverişe Başla
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-32 pb-20 min-h-screen bg-gradient-to-b from-white to-gray-50">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Sepetim</h2>
                <button
                  onClick={() => {
                    if (confirm('Sepeti temizlemek istediğinize emin misiniz?')) {
                      clearCart()
                      setCart([])
                    }
                  }}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Sepeti Temizle
                </button>
              </div>

              <div className="space-y-4">
                {cart.map((item) => {
                  const itemPrice = item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price
                  const itemTotal = itemPrice * item.quantity

                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-4 p-4 border-2 border-gray-100 rounded-xl hover:border-primary-200 transition-colors"
                    >
                      <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <span className="text-3xl">🦷</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-1">{item.name}</h3>
                        {item.selectedColor && (
                          <p className="text-sm text-gray-600 mb-2">
                            Renk: {item.selectedColor.name}
                          </p>
                        )}
                        <div className="flex items-center justify-between mt-2">
                          <div>
                            {item.discountPrice || item.selectedColor?.discountPrice ? (
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-bold text-primary-600">
                                  {itemPrice.toLocaleString('tr-TR')} ₺
                                </span>
                                <span className="text-sm text-gray-400 line-through">
                                  {(item.selectedColor?.price || item.price).toLocaleString('tr-TR')} ₺
                                </span>
                              </div>
                            ) : (
                              <span className="text-lg font-bold text-primary-600">
                                {itemPrice.toLocaleString('tr-TR')} ₺
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end justify-between">
                        <button
                          onClick={() => handleRemove(item.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <FiTrash2 className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-2 border-2 border-gray-200 rounded-lg">
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                            className="p-2 hover:bg-gray-100 transition-colors"
                          >
                            <FiMinus className="w-4 h-4" />
                          </button>
                          <span className="px-4 py-2 font-semibold text-gray-900 min-w-[3rem] text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                            className="p-2 hover:bg-gray-100 transition-colors"
                          >
                            <FiPlus className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="text-right mt-2">
                          <p className="text-sm text-gray-600">Toplam</p>
                          <p className="text-lg font-bold text-primary-600">
                            {itemTotal.toLocaleString('tr-TR')} ₺
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white rounded-2xl shadow-lg p-6 sticky top-32"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Sipariş Özeti</h2>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between text-gray-700">
                  <span>Ara Toplam</span>
                  <span className="font-semibold">{subtotal.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Kargo</span>
                  <span className="font-semibold">
                    {shipping === 0 ? 'Ücretsiz' : `${shipping.toLocaleString('tr-TR')} ₺`}
                  </span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between text-lg font-bold text-gray-900">
                    <span>Toplam</span>
                    <span className="text-primary-600">{total.toLocaleString('tr-TR')} ₺</span>
                  </div>
                </div>
              </div>

              <motion.button
                onClick={() => {
                  // Sepetteki ürünleri localStorage'a kaydet ve ödeme sayfasına yönlendir
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('checkout_cart', JSON.stringify(cart))
                    router.push('/odeme')
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full px-6 py-4 bg-primary-600 text-white rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors shadow-lg hover:shadow-xl"
              >
                <FiShoppingCart className="w-5 h-5" />
                Siparişi Tamamla
              </motion.button>

              <Link href="/urunler">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full mt-4 px-6 py-3 bg-gray-100 text-gray-900 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Alışverişe Devam Et
                </motion.button>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}
