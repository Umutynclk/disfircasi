'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiTag,
  FiArrowUp, FiArrowDown, FiEye, FiEyeOff, FiImage,
} from 'react-icons/fi'
import { subscribeToCategories, createCategory, updateCategory, deleteCategory, Category } from '@/lib/firebase/categories'
import { uploadImage } from '@/lib/firebase/storage'

const EMPTY_FORM: Omit<Category, 'id'> = {
  name: '',
  slug: '',
  description: '',
  image: '',
  order: 1,
  active: true,
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Category, 'id'>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    const unsub = subscribeToCategories((cats) => {
      setCategories(cats)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, order: categories.length + 1 })
    setModalOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditingId(cat.id)
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      image: cat.image || '',
      order: cat.order,
      active: cat.active,
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const handleNameChange = (name: string) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: editingId ? prev.slug : generateSlug(name),
    }))
  }

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    try {
      const url = await uploadImage(file, 'categories')
      setForm((prev) => ({ ...prev, image: url }))
    } catch (err) {
      console.error('Image upload error:', err)
      alert('Görsel yüklenemedi!')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSave = async () => {
    if (!form.name.trim()) { alert('Kategori adı zorunludur!'); return }
    if (!form.slug.trim()) { alert('Slug zorunludur!'); return }
    setSaving(true)
    try {
      if (editingId) {
        await updateCategory(editingId, form)
      } else {
        await createCategory(form)
      }
      closeModal()
    } catch (err) {
      console.error('Save error:', err)
      alert('Kategori kaydedilemedi!')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id)
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Delete error:', err)
      alert('Kategori silinemedi!')
    }
  }

  const toggleActive = async (cat: Category) => {
    try {
      await updateCategory(cat.id, { active: !cat.active })
    } catch (err) {
      console.error('Toggle error:', err)
    }
  }

  const reorder = async (idx: number, direction: 'up' | 'down') => {
    const newList = [...categories]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newList.length) return

    const temp = newList[idx]
    newList[idx] = newList[targetIdx]
    newList[targetIdx] = temp

    // Update order field for both
    try {
      await updateCategory(newList[idx].id, { order: idx + 1 })
      await updateCategory(newList[targetIdx].id, { order: targetIdx + 1 })
    } catch (err) {
      console.error('Reorder error:', err)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kategori Yönetimi</h1>
          <p className="text-gray-500 mt-1">Ürün kategorilerini düzenleyin ve sıralayın</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={openCreate}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold shadow-md hover:bg-primary-700 transition-colors"
        >
          <FiPlus className="w-5 h-5" />
          Yeni Kategori
        </motion.button>
      </div>

      {/* Categories List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200">
          <FiTag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Henüz kategori yok</p>
          <p className="text-gray-400 text-sm mt-1">İlk kategorinizi oluşturun</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, idx) => (
            <motion.div
              key={cat.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-xl border transition-all ${
                cat.active ? 'border-gray-200' : 'border-gray-100 opacity-60'
              } p-4 flex items-center gap-4`}
            >
              {/* Category Image */}
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                {cat.image ? (
                  <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <FiTag className="w-5 h-5 text-gray-300" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 truncate">{cat.name}</p>
                  {!cat.active && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Gizli</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 font-mono">/urunler?kategori={cat.slug}</p>
                {cat.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{cat.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Reorder */}
                <button
                  onClick={() => reorder(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
                >
                  <FiArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => reorder(idx, 'down')}
                  disabled={idx === categories.length - 1}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
                >
                  <FiArrowDown className="w-3.5 h-3.5" />
                </button>

                {/* Toggle visibility */}
                <button
                  onClick={() => toggleActive(cat)}
                  className={`p-1.5 rounded-lg transition-colors ${
                    cat.active
                      ? 'text-emerald-600 hover:bg-emerald-50'
                      : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={cat.active ? 'Gizle' : 'Göster'}
                >
                  {cat.active ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
                </button>

                {/* Edit */}
                <button
                  onClick={() => openEdit(cat)}
                  className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                >
                  <FiEdit2 className="w-4 h-4" />
                </button>

                {/* Delete */}
                {deleteConfirm === cat.id ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="px-2 py-1 bg-red-600 text-white text-xs rounded-lg font-medium"
                    >
                      Sil
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-lg"
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(cat.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <FiTrash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingId ? 'Kategoriyi Düzenle' : 'Yeni Kategori'}
                </h2>
                <button
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Kategori Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Örn: Otomatik Diş Fırçası"
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-colors"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    URL Slug <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden focus-within:border-primary-500 transition-colors">
                    <span className="px-3 py-2.5 bg-gray-50 text-gray-400 text-sm border-r border-gray-200">/urunler?kategori=</span>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))}
                      className="flex-1 px-3 py-2.5 focus:outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Açıklama</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Kısa kategori açıklaması..."
                    className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none resize-none transition-colors"
                  />
                </div>

                {/* Image */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori Görseli</label>
                  {form.image && (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border-2 border-gray-200 mb-2">
                      <img src={form.image} alt="Category" className="w-full h-full object-cover" />
                      <button
                        onClick={() => setForm((prev) => ({ ...prev, image: '' }))}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg"
                      >
                        <FiX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50/30 transition-colors text-sm text-gray-500">
                    <FiImage className="w-4 h-4" />
                    {uploadingImage ? 'Yükleniyor...' : 'Görsel Yükle'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingImage}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleImageUpload(file)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Aktif</p>
                    <p className="text-xs text-gray-500">Pasif kategoriler sitede gösterilmez</p>
                  </div>
                  <button
                    onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      form.active ? 'bg-primary-600' : 'bg-gray-300'
                    }`}
                  >
                    <div
                      className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        form.active ? 'translate-x-7' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
                <button
                  onClick={closeModal}
                  className="px-5 py-2.5 text-gray-600 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors"
                >
                  İptal
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <FiSave className="w-4 h-4" />
                  )}
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
