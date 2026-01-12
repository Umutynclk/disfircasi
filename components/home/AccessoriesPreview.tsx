'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { FiArrowRight, FiShoppingCart } from 'react-icons/fi'
import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc } from 'firebase/firestore'
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

interface AccessoriesContent {
  title?: string
  subtitle?: string
  buttonText?: string
  buttonUrl?: string
}

const getProductImage = (product: Product): string | undefined => {
  if (product.images && product.images.length > 0) {
    return product.images[0]
  }
  return product.image
}

export default function AccessoriesPreview() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState<AccessoriesContent>({
    title: 'Yedek Fırça Başlıkları',
    subtitle: 'Diş fırçanız için uygun yedek başlıklar',
    buttonText: 'Tüm Yedek Başlıkları Görüntüle',
    buttonUrl: '/urunler?kategori=yedek-firca-basliklari'
  })

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      
      // Content from Firebase
      const contentRef = doc(db, 'siteContent', 'accessories')
      const unsubscribeContent = onSnapshot(
        contentRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setContent(snapshot.data() as AccessoriesContent)
          }
        },
        (error) => {
          console.error('Accessories content error:', error)
        }
      )

      // Products - filter by category
      const productsRef = collection(db, 'products')
      const unsubscribeProducts = onSnapshot(
        productsRef,
        (snapshot) => {
          const productsData = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() } as Product))
            .filter(product => product.category === 'yedek-firca-basliklari' || product.category === 'accessories')
            .slice(0, 3) // İlk 3 ürünü göster
          setProducts(productsData)
          setLoading(false)
        },
        (error) => {
          console.error('Ürünler yüklenirken hata:', error)
          setLoading(false)
        }
      )

      return () => {
        unsubscribeContent()
        unsubscribeProducts()
      }
    } catch (error) {
      console.error('AccessoriesPreview initialization error:', error)
      setLoading(false)
    }
  }, [])

  return (
    <section className="py-20 bg-white">
      <div className="container-custom section-padding">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            {content.title || 'Yedek Fırça Başlıkları'}
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            {content.subtitle || 'Diş fırçanız için uygun yedek başlıklar'}
          </p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            {products.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                whileHover={{ y: -10 }}
                className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 border border-gray-100"
              >
                {/* Product Image */}
                <div className="relative aspect-[3/4] bg-gradient-to-br from-primary-100 to-primary-200 overflow-hidden cursor-pointer">
                  <Link href={`/urunler/${product.id}`}>
                    {getProductImage(product) ? (
                      <motion.div
                        className="w-full h-full flex items-center justify-center"
                        whileHover={{ rotate: 360 }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                      >
                        <img
                          src={getProductImage(product)}
                          alt={product.name}
                          className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
                        />
                      </motion.div>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <span className="text-8xl group-hover:scale-110 transition-transform">🦷</span>
                      </div>
                    )}
                    {/* İndirim Badge */}
                    {product.discountPrice && product.discountPrice < product.price && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                        %{product.discountPercentage || Math.round(((product.price - product.discountPrice) / product.price) * 100)} İndirim
                      </div>
                    )}
                    {/* Stok Yok Overlay */}
                    {product.inStock === false && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <span className="bg-red-500 text-white px-4 py-2 rounded-full font-semibold">
                          Stokta Yok
                        </span>
                      </div>
                    )}
                  </Link>
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <Link href={`/urunler/${product.id}`}>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="text-gray-600 mb-4 line-clamp-2">
                    {product.description}
                  </p>
                  
                  {/* Stok Durumu */}
                  {product.inStock === false && (
                    <div className="mb-4">
                      <span className="inline-block bg-red-100 text-red-600 px-3 py-1 rounded-lg text-sm font-medium">
                        ⚠️ Stokta Yok
                      </span>
                    </div>
                  )}
                  
                  <div className="flex flex-col gap-3">
                    <Link href={`/satın-al?urun=${product.id}`}>
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

        {/* CTA Button */}
        {products.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center"
          >
            <Link
              href={content.buttonUrl || '/urunler?kategori=yedek-firca-basliklari'}
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              {content.buttonText || 'Tüm Yedek Başlıkları Görüntüle'}
              <FiArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
        )}
      </div>
    </section>
  )
}

