'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FiShoppingBag, FiTrash2, FiPlus, FiMinus, FiArrowLeft, FiArrowRight, FiShield } from 'react-icons/fi'
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

    const handleCartUpdate = () => {
      loadCart()
    }
    window.addEventListener('cartUpdated', handleCartUpdate)

    getCurrentUser().then(setUser)

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
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-blue"></div>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="container-custom section-padding">
          <div className="max-w-xl mx-auto text-center bg-white rounded-3xl border border-slate-200/80 p-12 shadow-xs">
            <div className="w-20 h-20 bg-brand-softBlue rounded-full flex items-center justify-center mx-auto mb-6 text-brand-blue">
              <FiShoppingBag className="w-10 h-10" />
            </div>
            <h2 className="text-3xl font-black text-brand-navy mb-3">Sepetiniz Boş</h2>
            <p className="text-slate-500 text-sm mb-8">Sepetinize henüz bir ağız bakım ürünü eklemediniz.</p>
            <Link href="/urunler">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-8 py-4 bg-brand-blue text-white rounded-full font-bold text-xs uppercase tracking-wider flex items-center gap-2 mx-auto hover:bg-blue-600 transition-colors shadow-md shadow-brand-blue/20"
              >
                <span>Ürünleri Keşfet</span>
                <FiArrowRight className="w-4 h-4" />
              </motion.button>
            </Link>
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
          Geri Dön
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-2xl font-black text-brand-navy">Alışveriş Sepetim</h2>
                  <p className="text-xs text-slate-500 mt-1">{cart.reduce((a, b) => a + b.quantity, 0)} Ürün</p>
                </div>
                <button
                  onClick={() => {
                    if (confirm('Sepeti temizlemek istediğinize emin misiniz?')) {
                      clearCart()
                      setCart([])
                    }
                  }}
                  className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
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
                      layout
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex flex-col sm:flex-row gap-4 p-4 border border-slate-200/80 rounded-2xl bg-slate-50/50 hover:border-brand-blue/30 transition-colors"
                    >
                      <div className="w-24 h-24 bg-white rounded-xl border border-slate-200/60 p-2 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <span className="text-2xl">🦷</span>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
                            <button
                              onClick={() => handleRemove(item.id)}
                              className="text-slate-400 hover:text-red-500 transition-colors p-1"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {item.selectedColor && (
                            <p className="text-xs text-slate-500 mt-1">
                              Renk: <span className="font-semibold text-slate-800">{item.selectedColor.name}</span>
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-4">
                          <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-full px-3 py-1">
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              className="text-slate-500 hover:text-slate-900 p-1"
                            >
                              <FiMinus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs font-bold text-slate-900 w-6 text-center">{item.quantity}</span>
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              className="text-slate-500 hover:text-slate-900 p-1"
                            >
                              <FiPlus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="text-right">
                            <p className="text-xs text-slate-400">Birim Tutar</p>
                            <p className="text-base font-extrabold text-brand-blue">
                              {itemTotal.toLocaleString('tr-TR')} ₺
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 md:p-8 shadow-xs sticky top-32 space-y-6">
              <h3 className="text-xl font-black text-brand-navy pb-4 border-b border-slate-100">Sipariş Özeti</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Ara Toplam</span>
                  <span className="font-bold text-slate-900">{subtotal.toLocaleString('tr-TR')} ₺</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Kargo</span>
                  <span className="font-bold text-brand-green">
                    {shipping === 0 ? 'Ücretsiz Kargo' : `${shipping.toLocaleString('tr-TR')} ₺`}
                  </span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between items-baseline">
                  <span className="font-bold text-slate-900 text-base">Toplam</span>
                  <span className="text-2xl font-black text-brand-blue">{total.toLocaleString('tr-TR')} ₺</span>
                </div>
              </div>

              <div className="p-3 bg-brand-softBlue rounded-2xl border border-brand-blue/20 flex items-center gap-2 text-xs text-brand-blue font-semibold">
                <FiShield className="w-5 h-5 flex-shrink-0" />
                <span>256-Bit SSL Şifreleme ile Güvenli Alışveriş</span>
              </div>

              <button
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('checkout_cart', JSON.stringify(cart))
                    router.push('/satin-al?sepet=true')
                  }
                }}
                className="w-full py-4 bg-gradient-to-r from-brand-blue to-blue-600 text-white font-bold text-sm rounded-full shadow-lg shadow-brand-blue/30 hover:scale-102 transition-transform flex items-center justify-center gap-2"
              >
                <span>Ödemeye Geç</span>
                <FiArrowRight className="w-4 h-4" />
              </button>

              <Link href="/urunler" className="block text-center text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors pt-2">
                Alışverişe Devam Et
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

