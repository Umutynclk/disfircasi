'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiTrash2, FiPlus, FiMinus, FiShoppingBag, FiArrowRight, FiShield, FiCheck } from 'react-icons/fi'
import Link from 'next/link'
import { getCart, removeFromCart, updateCartItemQuantity, getCartTotal, CartItem } from '@/lib/utils/cart'

export default function CartDrawer() {
  const [isOpen, setIsOpen] = useState(false)
  const [cart, setCart] = useState<CartItem[]>([])

  const loadCart = () => {
    setCart(getCart())
  }

  useEffect(() => {
    loadCart()

    const handleOpenCart = () => setIsOpen(true)
    const handleCartUpdated = () => {
      loadCart()
    }

    window.addEventListener('openCartDrawer', handleOpenCart)
    window.addEventListener('cartUpdated', handleCartUpdated)

    return () => {
      window.removeEventListener('openCartDrawer', handleOpenCart)
      window.removeEventListener('cartUpdated', handleCartUpdated)
    }
  }, [])

  const handleRemove = (id: string) => {
    removeFromCart(id)
    loadCart()
  }

  const handleQuantity = (id: string, qty: number) => {
    updateCartItemQuantity(id, qty)
    loadCart()
  }

  const subtotal = getCartTotal()

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 transition-opacity"
          />

          {/* Slide-over Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col justify-between overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-blue/10 flex items-center justify-center text-brand-blue">
                  <FiShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Alışveriş Sepetim</h3>
                  <p className="text-xs text-gray-500">{cart.reduce((a, b) => a + b.quantity, 0)} Adet Ürün</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors"
              >
                <FiX className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
                  <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <FiShoppingBag className="w-10 h-10 text-gray-300" />
                  </div>
                  <h4 className="text-lg font-semibold text-gray-700 mb-1">Sepetiniz Boş</h4>
                  <p className="text-sm text-gray-500 max-w-xs mb-6">
                    Ağız sağlığınız için en yeni ürünleri keşfedin ve sepetinize ekleyin.
                  </p>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="px-6 py-3 bg-brand-blue text-white font-medium rounded-full hover:bg-blue-600 transition-all text-sm shadow-md shadow-brand-blue/20"
                  >
                    Ürünleri Keşfet
                  </button>
                </div>
              ) : (
                cart.map((item) => {
                  const price = item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="flex gap-4 p-4 rounded-2xl bg-slate-50/80 border border-slate-100 relative group"
                    >
                      {/* Product Thumbnail */}
                      <div className="w-20 h-20 rounded-xl bg-white p-2 border border-slate-200/60 flex items-center justify-center overflow-hidden flex-shrink-0">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-xs text-gray-400">
                            Resim Yok
                          </div>
                        )}
                      </div>

                      {/* Details */}
                      <div className="flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <h4 className="font-semibold text-gray-900 text-sm line-clamp-1">{item.name}</h4>
                            <button
                              onClick={() => handleRemove(item.id)}
                              className="text-gray-400 hover:text-red-500 transition-colors p-1"
                            >
                              <FiTrash2 className="w-4 h-4" />
                            </button>
                          </div>
                          {item.selectedColor && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              Renk: {item.selectedColor.name}
                            </p>
                          )}
                        </div>

                        {/* Quantity and Price */}
                        <div className="flex justify-between items-center mt-3">
                          <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-2 py-1">
                            <button
                              onClick={() => handleQuantity(item.id, item.quantity - 1)}
                              className="text-gray-500 hover:text-gray-900 p-0.5"
                            >
                              <FiMinus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-semibold w-5 text-center text-gray-900">{item.quantity}</span>
                            <button
                              onClick={() => handleQuantity(item.id, item.quantity + 1)}
                              className="text-gray-500 hover:text-gray-900 p-0.5"
                            >
                              <FiPlus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-right">
                            <span className="font-bold text-gray-900 text-sm">
                              {(price * item.quantity).toLocaleString('tr-TR')} ₺
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>

            {/* Footer Summary & Checkout CTA */}
            {cart.length > 0 && (
              <div className="p-6 border-t border-slate-100 bg-white space-y-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-500">
                    <span>Ara Toplam</span>
                    <span className="font-medium text-gray-900">{subtotal.toLocaleString('tr-TR')} ₺</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Kargo</span>
                    <span className="text-brand-green font-medium">Ücretsiz Kargo</span>
                  </div>
                  <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
                    <span>Toplam Tutarlık</span>
                    <span className="text-brand-blue text-lg">{subtotal.toLocaleString('tr-TR')} ₺</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100">
                  <FiShield className="w-4 h-4 text-brand-blue flex-shrink-0" />
                  <span>256-Bit SSL ile %100 Güvenli ve Şifreli Ödeme</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Link
                    href="/sepet"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-center py-3 bg-slate-100 text-gray-800 font-semibold rounded-full hover:bg-slate-200 transition-colors text-sm"
                  >
                    Sepete Git
                  </Link>

                  <Link
                    href="/satin-al?sepet=true"
                    onClick={() => setIsOpen(false)}
                    className="w-full text-center py-3 bg-gradient-to-r from-brand-blue to-blue-600 text-white font-semibold rounded-full hover:shadow-lg hover:shadow-brand-blue/30 transition-all text-sm flex items-center justify-center gap-1.5"
                  >
                    Ödemeye Geç <FiArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
