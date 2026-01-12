'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiPlus } from 'react-icons/fi'
import ProductList from '@/components/admin/ProductList'

export default function AdminDashboard() {
  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Ürün Yönetimi</h1>
              <p className="text-gray-600">Ürünlerinizi ekleyin, düzenleyin ve yönetin</p>
            </div>
            <Link href="/admin/urunler/yeni">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold shadow-lg hover:shadow-xl"
              >
                <FiPlus className="w-5 h-5" />
                Yeni Ürün Ekle
              </motion.button>
            </Link>
          </div>
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <ProductList />
        </div>
      </div>
    </div>
  )
}


