'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiPlus, FiArrowLeft } from 'react-icons/fi'
import ProductList from '@/components/admin/ProductList'

export default function AdminProductsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 lg:mb-8">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Ürün Yönetimi</h1>
            <p className="text-sm text-gray-600">Ürünlerinizi listeleyin, düzenleyin, fiyat ve stok güncelleyin</p>
          </div>
          <Link href="/admin/urunler/yeni" className="w-full sm:w-auto">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold shadow-lg hover:shadow-xl cursor-pointer"
            >
              <FiPlus className="w-5 h-5" />
              Yeni Ürün Ekle
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <ProductList />
      </div>
    </div>
  )
}
