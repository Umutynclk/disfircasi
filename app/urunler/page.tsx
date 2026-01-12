'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiShoppingCart, FiSearch, FiStar } from 'react-icons/fi'

interface ColorOption {
  name: string
  code: string
  images?: string[]
  price?: number
  discountPrice?: number | null
}

interface Product {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  discountPercentage?: number | null
  image?: string
  images?: string[]
  description: string
  category?: string
  inStock?: boolean
  features?: string[]
  colors?: ColorOption[]
  rating?: number
}

const getProductImage = (product: Product): string | undefined => {
  if (product.images && product.images.length > 0) {
    return product.images[0]
  }
  return product.image
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const productsRef = collection(db, 'products')
      
      // Real-time listener - Firebase değişikliklerini dinle
      const unsubscribe = onSnapshot(
        productsRef,
        (snapshot) => {
          const productsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Product))
          setProducts(productsData)
          setFilteredProducts(productsData)
          setLoading(false)
          console.log('✅ Products loaded from Firebase:', productsData.length)
        },
        (error) => {
          console.error('❌ Products fetch error:', error)
          setProducts([])
          setFilteredProducts([])
          setLoading(false)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Products initialization error:', error)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let filtered = products.filter(product =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    // Kategori filtreleme
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory)
    }
    
    setFilteredProducts(filtered)
  }, [searchTerm, products, selectedCategory])

  return (
    <div className="pt-32 pb-20 bg-gray-50 min-h-screen">
      <div className="container-custom section-padding">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-4">
            Ürünlerimiz
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Tüm modellerimizi keşfedin ve ihtiyacınıza en uygun olanı seçin
          </p>
        </motion.div>

        {/* Category Filter */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 flex flex-wrap justify-center gap-4"
        >
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-6 py-3 rounded-full font-semibold transition-all duration-200 ${
              selectedCategory === 'all'
                ? 'bg-primary-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
            }`}
          >
            Tümü
          </button>
          <button
            onClick={() => setSelectedCategory('elektrikli-disfircasi')}
            className={`px-6 py-3 rounded-full font-semibold transition-all duration-200 ${
              selectedCategory === 'elektrikli-disfircasi'
                ? 'bg-primary-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
            }`}
          >
            Elektrikli Diş Fırçaları
          </button>
          <button
            onClick={() => setSelectedCategory('yedek-firca-basliklari')}
            className={`px-6 py-3 rounded-full font-semibold transition-all duration-200 ${
              selectedCategory === 'yedek-firca-basliklari'
                ? 'bg-primary-600 text-white shadow-lg scale-105'
                : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
            }`}
          >
            Yedek Fırça Başlıkları
          </button>
        </motion.div>

        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12 max-w-2xl mx-auto"
        >
          <div className="relative">
            <FiSearch className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Ürün ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-full border-2 border-gray-200 focus:border-primary-600 focus:outline-none transition-colors text-lg"
            />
          </div>
        </motion.div>

        {/* Products Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-2xl h-64 mb-4"></div>
                <div className="bg-gray-200 rounded h-6 w-3/4 mb-2"></div>
                <div className="bg-gray-200 rounded h-4 w-1/2"></div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-2xl text-gray-600 mb-4">Ürün bulunamadı</p>
            <p className="text-gray-500">Farklı bir arama terimi deneyin</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
            {filteredProducts.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 flex flex-col border border-gray-100"
              >
                {/* Ürün Görseli - Oral-B tarzı büyük görsel */}
                <Link href={`/urunler/${product.id}`}>
                  <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 aspect-[3/4] flex items-center justify-center overflow-hidden cursor-pointer group">
                    {getProductImage(product) ? (
                      <div className="w-full h-full flex items-center justify-center p-6 overflow-hidden">
                        <img
                          src={getProductImage(product)}
                          alt={product.name}
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-9xl opacity-20">🦷</span>
                      </div>
                    )}
                    {/* İndirim Badge */}
                    {product.discountPrice && product.discountPrice < product.price && (
                      <div className="absolute top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg">
                        %{product.discountPercentage || Math.round(((product.price - product.discountPrice) / product.price) * 100)} İndirim
                      </div>
                    )}
                    {/* Stok Yok Overlay */}
                    {product.inStock === false && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <div className="bg-red-500 text-white px-6 py-3 rounded-lg font-bold text-lg shadow-xl">
                          Stokta Yok
                        </div>
                      </div>
                    )}
                  </div>
                </Link>

                <div className="p-6 flex flex-col flex-grow">
                  {/* Yıldız Puanı - Oral-B tarzı */}
                  <div className="mb-3 flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <FiStar
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.floor(product.rating || 5)
                            ? 'text-yellow-400 fill-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="ml-2 text-sm text-gray-600 font-medium">
                      {(product.rating || 5).toFixed(1)}
                    </span>
                  </div>

                  {/* Ürün Adı */}
                  <Link href={`/urunler/${product.id}`}>
                    <h3 className="text-xl font-bold text-gray-900 mb-4 hover:text-primary-600 transition-colors cursor-pointer">
                      {product.name}
                    </h3>
                  </Link>

                  {/* Renk Seçenekleri - Oral-B tarzı */}
                  {product.colors && product.colors.length > 0 && (
                    <div className="mb-4 flex items-center gap-2 flex-wrap">
                      {product.colors.map((color, idx) => (
                        <div
                          key={idx}
                          className="w-8 h-8 rounded-full border-2 border-gray-300 shadow-sm hover:scale-110 transition-transform cursor-pointer"
                          style={{ backgroundColor: color.code }}
                          title={color.name}
                        />
                      ))}
                    </div>
                  )}

                  {/* Özellikler Listesi - Oral-B tarzı */}
                  {product.features && product.features.length > 0 && (
                    <ul className="mb-6 space-y-2.5 flex-grow">
                      {product.features.slice(0, 6).map((feature, idx) => (
                        <li key={idx} className="text-sm text-gray-700 flex items-start">
                          <span className="text-primary-600 mr-2.5 font-bold text-base leading-none">•</span>
                          <span className="leading-relaxed">{feature}</span>
                        </li>
                      ))}
                      {product.features.length > 6 && (
                        <li className="text-sm text-primary-600 font-semibold mt-2">
                          +{product.features.length - 6} özellik daha
                        </li>
                      )}
                    </ul>
                  )}

                  {/* Fiyat - Oral-B tarzı */}
                  <div className="mb-6 pt-4 border-t-2 border-gray-200">
                    {product.discountPrice && product.discountPrice < product.price ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-baseline gap-3">
                          <span className="text-3xl font-bold text-primary-600">
                            {product.discountPrice.toLocaleString('tr-TR')} ₺
                          </span>
                          <span className="text-lg text-gray-500 line-through">
                            {product.price.toLocaleString('tr-TR')} ₺
                          </span>
                        </div>
                        <span className="text-xs text-red-600 font-semibold uppercase tracking-wide">İndirimli Fiyat</span>
                      </div>
                    ) : (
                      <span className="text-3xl font-bold text-primary-600">
                        {product.price.toLocaleString('tr-TR')} ₺
                      </span>
                    )}
                  </div>

                  {/* Stok Durumu */}
                  {product.inStock === false && (
                    <div className="mb-4">
                      <span className="inline-block bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold border border-red-200">
                        ⚠️ Stokta Yok
                      </span>
                    </div>
                  )}

                  {/* Butonlar - Oral-B tarzı */}
                  <div className="flex flex-col gap-3 mt-auto">
                    <Link href={`/urunler/${product.id}`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={product.inStock === false}
                        className={`w-full py-4 rounded-lg font-bold text-base transition-all shadow-md hover:shadow-lg ${
                          product.inStock === false
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        Şimdi Alışveriş Yapın
                      </motion.button>
                    </Link>
                    <Link href={`/urunler/${product.id}`}>
                      <button className="w-full py-2 text-primary-600 hover:text-primary-700 font-semibold text-sm transition-colors">
                        Daha Fazla Bilgi
                      </button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}


