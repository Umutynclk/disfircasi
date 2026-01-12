'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiArrowRight } from 'react-icons/fi'
import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

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
  colors?: ColorOption[]
}

interface ColorOption {
  name: string
  code: string
  image?: string
  images?: string[]
  price?: number
  discountPrice?: number | null
}

const getProductImage = (product: Product): string | undefined => {
  if (product.images && product.images.length > 0) {
    return product.images[0]
  }
  return product.image
}

export default function ProductsPreview() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const productsRef = collection(db, 'products')
      
      // Real-time listener - Firebase değişikliklerini dinle
      const unsubscribe = onSnapshot(
        productsRef,
        (snapshot) => {
          const productsData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(product => product.category === 'elektrikli-disfircasi' || !product.category)
            .slice(0, 3) // İlk 3 ürünü göster
          setProducts(productsData)
          setLoading(false)
          console.log('✅ Electric Toothbrushes loaded from Firebase:', productsData.length)
        },
        (error) => {
          console.error('❌ Products fetch error:', error)
          setProducts([])
          setLoading(false)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Products initialization error:', error)
      setLoading(false)
    }
  }, [])

  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="container-custom section-padding">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Popüler <span className="text-primary-600">Ürünlerimiz</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Her ihtiyaca uygun elektrikli diş fırçası modelleri
          </p>
          <Link href="/urunler">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-6 py-3 text-primary-600 hover:text-primary-700 font-semibold"
            >
              Tümünü Gör
              <FiArrowRight className="w-5 h-5" />
            </motion.button>
          </Link>
        </motion.div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-200 rounded-2xl h-64 mb-4"></div>
                <div className="bg-gray-200 rounded h-6 w-3/4 mb-2"></div>
                <div className="bg-gray-200 rounded h-4 w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300"
              >
                {/* Product Image */}
                <div className="relative aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-200 overflow-hidden">
                  {getProductImage(product) ? (
                    <motion.div
                      className="w-full h-full flex items-center justify-center perspective-1000"
                      style={{ perspective: '1000px' }}
                      whileHover={{ 
                        rotateY: 15,
                        rotateX: -5,
                        scale: 1.05
                      }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    >
                      <img 
                        src={getProductImage(product)} 
                        alt={product.name} 
                        className="w-full h-full object-contain transition-transform duration-300"
                        style={{ transformStyle: 'preserve-3d' }}
                      />
                    </motion.div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-8xl">🦷</span>
                    </div>
                  )}
                  {/* İndirim Badge */}
                  {product.discountPrice && product.discountPrice < product.price && (
                    <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      %{product.discountPercentage || Math.round(((product.price - product.discountPrice) / product.price) * 100)} İndirim
                    </div>
                  )}
                  {/* Stok Yok Badge */}
                  {product.inStock === false && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold">
                        Stokta Yok
                      </div>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-gray-600 mb-4 line-clamp-2">{product.description}</p>
                  
                  {/* Stok Durumu */}
                  {product.inStock === false && (
                    <div className="mb-4">
                      <span className="inline-block bg-red-100 text-red-600 px-3 py-1 rounded-lg text-sm font-medium">
                        ⚠️ Stokta Yok
                      </span>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-3">
                    <Link href={`/satin-al?urun=${product.id}`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={product.inStock === false}
                        className={`w-full px-6 py-3 rounded-lg font-semibold transition-colors ${
                          product.inStock === false
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {product.inStock === false ? 'Stokta Yok' : 'Şimdi Satın Alın'}
                      </motion.button>
                    </Link>
                    <Link href={`/urunler/${product.id}`}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full px-6 py-3 rounded-lg font-semibold border-2 border-primary-600 text-primary-600 hover:bg-primary-50 transition-colors"
                      >
                        Daha Fazla Bilgi
                      </motion.button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

