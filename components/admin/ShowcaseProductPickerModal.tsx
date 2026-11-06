'use client'

import { useState, useEffect } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import { FiX, FiSearch, FiCheck, FiPackage, FiShoppingBag } from 'react-icons/fi'
import Image from 'next/image'

interface ProductItem {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  image?: string
  images?: string[]
  category?: string
  categoryId?: string
  stock?: number
  inStock?: boolean
}

interface ShowcaseProductPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (product: ProductItem) => void
  alreadySelectedProductIds: string[]
  sideTitle?: string
}

export default function ShowcaseProductPickerModal({
  isOpen,
  onClose,
  onSelect,
  alreadySelectedProductIds = [],
  sideTitle = 'Vitrine Ürün Ekle',
}: ShowcaseProductPickerModalProps) {
  const [products, setProducts] = useState<ProductItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCat, setSelectedCat] = useState<string>('all')

  useEffect(() => {
    if (!isOpen) return

    const db = getFirestoreDB()
    const productsRef = collection(db, 'products')

    const unsubscribe = onSnapshot(
      productsRef,
      (snap) => {
        const list = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as ProductItem[]
        setProducts(list)
        setLoading(false)
      },
      (err) => {
        console.error('Showcase modal fetch error:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [isOpen])

  if (!isOpen) return null

  // Unique categories list
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean))) as string[]

  // Filtered products
  const filtered = products.filter((p) => {
    const matchesSearch =
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category?.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false

    if (selectedCat !== 'all' && p.category !== selectedCat) {
      return false
    }

    return true
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{sideTitle}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Vitrine eklemek istediğiniz gerçek Firebase ürününü seçin.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="p-6 pb-2 space-y-3 bg-gray-50/50 border-b border-gray-100">
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ürün adı veya kategori ara..."
              className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-primary-600 shadow-2xs"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCat('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                selectedCat === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              Tümü ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCat(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap capitalize transition-colors ${
                  selectedCat === cat
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products List Grid */}
        <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">Ürünler yükleniyor...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center text-gray-400">
              <FiPackage className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm font-semibold">Aradığınız kriterde ürün bulunamadı.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filtered.map((product) => {
                const isAlreadySelected = alreadySelectedProductIds.includes(product.id)
                const img = product.images?.[0] || product.image

                return (
                  <div
                    key={product.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                      isAlreadySelected
                        ? 'bg-gray-50 border-gray-200 opacity-60'
                        : 'bg-white border-gray-200 hover:border-primary-600 hover:shadow-md cursor-pointer'
                    }`}
                    onClick={() => {
                      if (!isAlreadySelected) {
                        onSelect(product)
                        onClose()
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 p-1.5 flex-shrink-0 flex items-center justify-center overflow-hidden relative">
                        {img ? (
                          <img src={img} alt={product.name} className="w-full h-full object-contain" />
                        ) : (
                          <FiShoppingBag className="w-6 h-6 text-gray-300" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">
                          {product.category || 'Genel'}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          {product.discountPrice ? (
                            <>
                              <span className="text-xs font-black text-emerald-600">
                                {product.discountPrice.toLocaleString('tr-TR')} ₺
                              </span>
                              <span className="text-[10px] text-gray-400 line-through">
                                {product.price.toLocaleString('tr-TR')} ₺
                              </span>
                            </>
                          ) : (
                            <span className="text-xs font-black text-gray-900">
                              {product.price.toLocaleString('tr-TR')} ₺
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {isAlreadySelected ? (
                        <span className="px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-[11px] font-bold">
                          Zaten Ekli
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-colors shadow-2xs"
                        >
                          Seç & Ekle
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>Toplam {products.length} ürün listelendi</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-200 rounded-xl font-bold hover:bg-gray-100 transition-colors"
          >
            Kapat
          </button>
        </div>
      </motion.div>
    </div>
  )
}
