'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { FiSearch, FiX, FiArrowRight, FiShoppingBag, FiTag } from 'react-icons/fi'
import Link from 'next/link'
import { collection, getDocs, query, limit } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

interface SearchProduct {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  image?: string
  images?: string[]
  category?: string
  description?: string
}

interface SearchModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SearchModal({ isOpen, onClose }: SearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [allProducts, setAllProducts] = useState<SearchProduct[]>([])
  const [results, setResults] = useState<SearchProduct[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
      const fetchProducts = async () => {
        try {
          setLoading(true)
          const db = getFirestoreDB()
          const q = query(collection(db, 'products'), limit(50))
          const snapshot = await getDocs(q)
          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as SearchProduct[]
          setAllProducts(data)
        } catch (error) {
          console.error('Search products fetch error:', error)
        } finally {
          setLoading(false)
        }
      }
      fetchProducts()
    } else {
      setSearchTerm('')
    }
  }, [isOpen])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setResults([])
      return
    }
    const term = searchTerm.toLowerCase()
    const filtered = allProducts.filter(
      (p) =>
        p.name?.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term) ||
        p.category?.toLowerCase().includes(term)
    )
    setResults(filtered)
  }, [searchTerm, allProducts])

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const popularSearches = ['Otomatik Diş Fırçası', 'Kullan At', 'Yedek Başlık', 'Sonic Temizlik', 'Beyazlatıcı']

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 flex flex-col max-h-[80vh]"
          >
            {/* Search Input Bar */}
            <div className="p-5 md:p-6 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <FiSearch className="w-6 h-6 text-brand-blue flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Ürün adı, özellik veya kategori ara..."
                className="w-full bg-transparent text-slate-800 placeholder-slate-400 text-base md:text-lg font-medium focus:outline-none"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <FiX className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded-xl bg-slate-200/80 hover:bg-slate-300 text-xs font-semibold text-slate-700 transition-colors"
              >
                ESC
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
              {/* Popular Searches when no term */}
              {!searchTerm && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <FiTag className="w-3.5 h-3.5" /> Popüler Aramalar
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {popularSearches.map((tag) => (
                      <button
                        key={tag}
                        onClick={() => setSearchTerm(tag)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-brand-softBlue hover:text-brand-blue text-xs font-semibold text-slate-700 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="py-12 flex justify-center items-center">
                  <div className="w-8 h-8 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
                </div>
              )}

              {/* Search Results */}
              {searchTerm && !loading && (
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Sonuçlar ({results.length})
                    </h4>
                  </div>

                  {results.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                        <FiShoppingBag className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700">"{searchTerm}" ile eşleşen ürün bulunamadı.</p>
                      <p className="text-xs text-slate-400 mt-1">Farklı bir kelime deneyebilir veya tüm ürünlere göz atabilirsiniz.</p>
                      <Link
                        href="/urunler"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-blue hover:underline mt-4"
                      >
                        Tüm Ürünleri Gör <FiArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {results.map((product) => {
                        const img = product.images?.[0] || product.image
                        return (
                          <Link
                            key={product.id}
                            href={`/urunler/${product.id}`}
                            onClick={onClose}
                            className="flex items-center gap-4 p-3 rounded-2xl bg-slate-50/70 hover:bg-brand-softBlue/60 border border-slate-100 hover:border-brand-blue/20 transition-all group"
                          >
                            <div className="w-14 h-14 rounded-xl bg-white p-1.5 border border-slate-200/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
                              {img ? (
                                <img src={img} alt={product.name} className="w-full h-full object-contain" />
                              ) : (
                                <FiShoppingBag className="w-6 h-6 text-slate-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-blue">
                                {product.category?.replace(/-/g, ' ') || 'Dental Care'}
                              </span>
                              <h5 className="text-sm font-bold text-slate-800 truncate group-hover:text-brand-blue transition-colors">
                                {product.name}
                              </h5>
                              <p className="text-xs text-slate-500 truncate">{product.description}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {product.discountPrice ? (
                                <div>
                                  <span className="text-sm font-black text-brand-green">
                                    {product.discountPrice.toLocaleString('tr-TR')} ₺
                                  </span>
                                  <span className="block text-[10px] text-slate-400 line-through">
                                    {product.price.toLocaleString('tr-TR')} ₺
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm font-black text-slate-900">
                                  {product.price?.toLocaleString('tr-TR')} ₺
                                </span>
                              )}
                            </div>
                            <FiArrowRight className="w-4 h-4 text-slate-400 group-hover:text-brand-blue group-hover:translate-x-1 transition-all" />
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer Quick Link */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
              <Link
                href="/urunler"
                onClick={onClose}
                className="text-xs font-semibold text-slate-600 hover:text-brand-blue transition-colors inline-flex items-center gap-1"
              >
                Tüm Ürün Kataloğunu İncele <FiArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
