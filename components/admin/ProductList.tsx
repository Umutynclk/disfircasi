'use client'

import { useEffect, useState } from 'react'
import { collection, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { FiEdit, FiTrash2, FiEye, FiCheck, FiX, FiSave } from 'react-icons/fi'

interface Product {
  id: string
  name: string
  price: number
  discountPrice?: number | null
  discountPercentage?: number | null
  image?: string
  images?: string[]
  inStock?: boolean
  category?: string
}

const getProductImage = (product: Product): string | undefined => {
  if (product.images && product.images.length > 0) {
    return product.images[0]
  }
  return product.image
}

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState<string>('')
  const [editStock, setEditStock] = useState<boolean>(false)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    try {
      const db = getFirestoreDB()
      const productsRef = collection(db, 'products')
      const snapshot = await getDocs(productsRef)
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product))
      setProducts(productsData)
    } catch (error) {
      console.error('Ürünler yüklenirken hata:', error)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (product: Product) => {
    setEditingId(product.id)
    setEditPrice(product.price.toString())
    setEditStock(product.inStock ?? true)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditPrice('')
    setEditStock(false)
  }

  const handleQuickUpdate = async (id: string) => {
    setUpdating(id)
    try {
      const db = getFirestoreDB()
      const price = parseFloat(editPrice)
      if (isNaN(price) || price < 0) {
        alert('Geçerli bir fiyat girin')
        return
      }

      await updateDoc(doc(db, 'products', id), {
        price,
        inStock: editStock,
        updatedAt: new Date()
      })

      setProducts(products.map(p => 
        p.id === id ? { ...p, price, inStock: editStock } : p
      ))
      setEditingId(null)
      setEditPrice('')
      setEditStock(false)
    } catch (error) {
      console.error('Ürün güncellenirken hata:', error)
      alert('Ürün güncellenirken bir hata oluştu')
    } finally {
      setUpdating(null)
    }
  }

  const handleToggleStock = async (id: string, currentStock: boolean) => {
    try {
      const db = getFirestoreDB()
      await updateDoc(doc(db, 'products', id), {
        inStock: !currentStock,
        updatedAt: new Date()
      })

      setProducts(products.map(p => 
        p.id === id ? { ...p, inStock: !currentStock } : p
      ))
    } catch (error) {
      console.error('Stok güncellenirken hata:', error)
      alert('Stok güncellenirken bir hata oluştu')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Bu ürünü silmek istediğinizden emin misiniz?')) {
      return
    }

    try {
      const db = getFirestoreDB()
      await deleteDoc(doc(db, 'products', id))
      setProducts(products.filter(p => p.id !== id))
    } catch (error) {
      console.error('Ürün silinirken hata:', error)
      alert('Ürün silinirken bir hata oluştu')
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Henüz ürün eklenmemiş</p>
        <Link href="/admin/urunler/yeni">
          <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            İlk Ürünü Ekle
          </button>
        </Link>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Ürün</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Fiyat</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Kategori</th>
            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Stok</th>
            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">İşlemler</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <motion.tr
              key={product.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
            >
              <td className="py-4 px-4">
                <div className="flex items-center gap-3">
                  {getProductImage(product) ? (
                    <img
                      src={getProductImage(product)}
                      alt={product.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 rounded-lg flex items-center justify-center text-2xl">
                      🦷
                    </div>
                  )}
                  <span className="font-medium text-gray-900">{product.name}</span>
                </div>
              </td>
              <td className="py-4 px-4">
                {editingId === product.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                      autoFocus
                    />
                    <span className="text-sm text-gray-500">₺</span>
                  </div>
                ) : (
                  <div className="text-gray-700">
                    {product.price.toLocaleString('tr-TR')} ₺
                    {product.discountPrice && (
                      <div className="text-xs text-orange-600 mt-1">
                        İndirimli: {product.discountPrice.toLocaleString('tr-TR')} ₺
                      </div>
                    )}
                  </div>
                )}
              </td>
              <td className="py-4 px-4">
                <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                  {product.category || 'Genel'}
                </span>
              </td>
              <td className="py-4 px-4">
                {editingId === product.id ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditStock(!editStock)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        editStock
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      {editStock ? 'Stokta' : 'Yok'}
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleToggleStock(product.id, product.inStock ?? false)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer ${
                      product.inStock
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-700 hover:bg-red-200'
                    }`}
                  >
                    {product.inStock ? 'Stokta' : 'Yok'}
                  </button>
                )}
              </td>
              <td className="py-4 px-4">
                <div className="flex items-center justify-end gap-2">
                  {editingId === product.id ? (
                    <>
                      <button
                        onClick={() => handleQuickUpdate(product.id)}
                        disabled={updating === product.id}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {updating === product.id ? (
                          <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <FiSave className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <FiX className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href={`/urunler/${product.id}`}>
                        <button className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Görüntüle">
                          <FiEye className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => startEdit(product)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Hızlı Düzenle"
                      >
                        <FiEdit className="w-4 h-4" />
                      </button>
                      <Link href={`/admin/urunler/${product.id}`}>
                        <button className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Detaylı Düzenle">
                          <FiEdit className="w-4 h-4" />
                        </button>
                      </Link>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sil"
                      >
                        <FiTrash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

