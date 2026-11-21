'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiTag,
  FiArrowUp, FiArrowDown, FiEye, FiEyeOff, FiImage,
  FiStar, FiAlertCircle, FiExternalLink, FiLayers,
} from 'react-icons/fi'
import {
  subscribeToCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  seedDefaultCategories,
  buildCategoryUrl,
  validateFeaturedCategoryInput,
  Category,
} from '@/lib/firebase/categories'
import { uploadImage } from '@/lib/firebase/storage'

interface CategoryFormState {
  name: string
  slug: string
  description: string
  image: string
  order: number
  active: boolean
  isFeatured: boolean
  featuredOrder: number
  featured: {
    badge: string
    subtitle: string
    title: string
    description: string
    ctaLabel: string
    image: string
  }
}

const EMPTY_FORM: CategoryFormState = {
  name: '',
  slug: '',
  description: '',
  image: '',
  order: 1,
  active: true,
  isFeatured: false,
  featuredOrder: 1,
  featured: {
    badge: 'ÖNE ÇIKAN',
    subtitle: '',
    title: '',
    description: '',
    ctaLabel: 'Ürünleri Keşfet',
    image: '',
  },
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<CategoryFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadingFeaturedImage, setUploadingFeaturedImage] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    const unsub = subscribeToCategories((cats) => {
      setCategories(cats)
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const featuredCount = categories.filter((c) => c.active !== false && c.isFeatured === true).length
  const activeCount = categories.filter((c) => c.active !== false).length

  const handleSeed = async () => {
    if (!confirm('Varsayılan kategoriler (Otomatik, Kullan-At, Yedek Başlık) veritabanına eklensin mi?')) return
    setSeeding(true)
    try {
      await seedDefaultCategories()
      alert('Varsayılan kategoriler başarıyla oluşturuldu!')
    } catch (err: any) {
      console.error('Seed error:', err)
      alert('Kategoriler eklenirken hata oluştu: ' + (err?.message || 'Firebase izin hatası'))
    } finally {
      setSeeding(false)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setFormError(null)
    const nextFeaturedOrder =
      categories.filter((c) => c.isFeatured).reduce((max, c) => Math.max(max, c.featuredOrder || 0), 0) + 1
    setForm({
      ...EMPTY_FORM,
      order: categories.length + 1,
      featuredOrder: nextFeaturedOrder,
      featured: { ...EMPTY_FORM.featured },
    })
    setModalOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditingId(cat.id)
    setFormError(null)
    setForm({
      name: cat.name,
      slug: cat.slug,
      description: cat.description || '',
      image: cat.image || '',
      order: cat.order ?? 1,
      active: cat.active !== false,
      isFeatured: Boolean(cat.isFeatured),
      featuredOrder: cat.featuredOrder ?? cat.order ?? 1,
      featured: {
        badge: cat.featured?.badge || 'ÖNE ÇIKAN',
        subtitle: cat.featured?.subtitle || '',
        title: cat.featured?.title || cat.name || '',
        description: cat.featured?.description || cat.description || '',
        ctaLabel: cat.featured?.ctaLabel || 'Ürünleri Keşfet',
        image: cat.featured?.image || '',
      },
    })
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingId(null)
    setFormError(null)
    setForm({ ...EMPTY_FORM, featured: { ...EMPTY_FORM.featured } })
  }

  const generateSlug = (name: string) =>
    name
      .toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/İ/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const handleNameChange = (name: string) => {
    setFormError(null)
    setForm((prev) => ({
      ...prev,
      name,
      slug: editingId ? prev.slug : generateSlug(name),
      featured: {
        ...prev.featured,
        title: !editingId && (!prev.featured.title || prev.featured.title === prev.name) ? name : prev.featured.title,
      },
    }))
  }

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true)
    try {
      const url = await uploadImage(file, 'categories')
      setForm((prev) => ({ ...prev, image: url }))
    } catch (err) {
      console.error('Image upload error:', err)
      setFormError('Kategori görseli yüklenemedi. Lütfen tekrar deneyin.')
    } finally {
      setUploadingImage(false)
    }
  }

  const handleFeaturedImageUpload = async (file: File) => {
    setUploadingFeaturedImage(true)
    try {
      const url = await uploadImage(file, 'categories/featured')
      setForm((prev) => ({
        ...prev,
        featured: { ...prev.featured, image: url },
      }))
    } catch (err) {
      console.error('Featured image upload error:', err)
      setFormError('Vitrin görseli yüklenemedi. Lütfen tekrar deneyin.')
    } finally {
      setUploadingFeaturedImage(false)
    }
  }

  const handleSave = async () => {
    setFormError(null)
    const validation = validateFeaturedCategoryInput(form)
    if (!validation.valid) {
      setFormError(validation.error || 'Lütfen zorunlu alanları doldurunuz.')
      return
    }

    setSaving(true)
    try {
      const payload: Omit<Category, 'id'> = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        description: form.description.trim(),
        image: form.image.trim(),
        order: Number(form.order) || 1,
        active: Boolean(form.active),
        isFeatured: Boolean(form.isFeatured),
        featuredOrder: Number(form.featuredOrder) || 1,
        featured: {
          badge: form.featured.badge.trim(),
          subtitle: form.featured.subtitle.trim(),
          title: form.featured.title.trim(),
          description: form.featured.description.trim(),
          ctaLabel: form.featured.ctaLabel.trim(),
          image: form.featured.image.trim(),
        },
      }

      if (editingId) {
        await updateCategory(editingId, payload)
      } else {
        await createCategory(payload)
      }
      closeModal()
    } catch (err: any) {
      console.error('Save error:', err)
      setFormError('Kategori kaydedilemedi: ' + (err?.message || 'Firebase izinlerini kontrol edin'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteCategory(id)
      setDeleteConfirm(null)
    } catch (err: any) {
      console.error('Delete error:', err)
      alert('Kategori silinemedi: ' + (err?.message || 'Firebase Firestore izin hatası. Lütfen Firestore kurallarında categories koleksiyonu iznini kontrol edin.'))
    } finally {
      setDeletingId(null)
    }
  }

  const toggleActive = async (cat: Category) => {
    try {
      await updateCategory(cat.id, { active: !cat.active })
    } catch (err: any) {
      console.error('Toggle error:', err)
      alert('Güncelleme hatası: ' + (err?.message || 'Firebase izin hatası'))
    }
  }

  const reorder = async (idx: number, direction: 'up' | 'down') => {
    const newList = [...categories]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newList.length) return

    const temp = newList[idx]
    newList[idx] = newList[targetIdx]
    newList[targetIdx] = temp

    try {
      await updateCategory(newList[idx].id, { order: idx + 1 })
      await updateCategory(newList[targetIdx].id, { order: targetIdx + 1 })
    } catch (err) {
      console.error('Reorder error:', err)
    }
  }

  const autoCtaPreview = buildCategoryUrl({ id: editingId || '', slug: form.slug || 'kategori-slug' }, '/tr/urunler')

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kategori &amp; Vitrin Yönetimi</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Kategorileri yönetin, sıralayın ve istediğiniz sayıda kategoriyi Ana Sayfa Vitrininde gösterin.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {categories.length === 0 && !loading && (
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium text-sm transition-colors disabled:opacity-50"
            >
              {seeding ? 'Ekleniyor...' : 'Varsayılanları Yükle'}
            </button>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold shadow-md hover:bg-primary-700 transition-colors cursor-pointer"
          >
            <FiPlus className="w-5 h-5" />
            Yeni Kategori
          </motion.button>
        </div>
      </div>

      {/* Summary Strip */}
      {!loading && categories.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Toplam Kategori</span>
            <span className="text-lg font-black text-gray-900">{categories.length}</span>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Aktif (Menüde)</span>
            <span className="text-lg font-black text-emerald-700">{activeCount}</span>
          </div>
          <div className="bg-amber-50/70 rounded-xl border border-amber-200 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <FiStar className="w-3.5 h-3.5 text-amber-500" />
              Ana Sayfa Vitrini
            </span>
            <span className="text-lg font-black text-amber-800">{featuredCount}</span>
          </div>
        </div>
      )}

      {/* Categories List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-200 p-8">
          <FiTag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-700 font-semibold text-lg">Henüz kategori bulunmuyor</p>
          <p className="text-gray-500 text-sm mt-1 mb-6">Yeni bir kategori ekleyebilir veya varsayılan kategorileri yükleyebilirsiniz.</p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleSeed}
              disabled={seeding}
              className="px-5 py-2.5 bg-primary-50 text-primary-700 border border-primary-200 rounded-xl font-semibold text-sm hover:bg-primary-100 transition-colors"
            >
              {seeding ? 'Yükleniyor...' : 'Varsayılan Kategorileri Yükle'}
            </button>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
            >
              Yeni Kategori Ekle
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat, idx) => {
            const thumb = cat.featured?.image || cat.image
            return (
              <motion.div
                key={cat.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-white rounded-xl border transition-all ${
                  cat.active ? 'border-gray-200' : 'border-gray-100 opacity-60'
                } p-4 flex flex-col sm:flex-row sm:items-center gap-4`}
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {/* Category Image */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-100">
                    {thumb ? (
                      <img src={thumb} alt={cat.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FiTag className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-2">
                      <p className="font-semibold text-gray-900 truncate">{cat.name}</p>
                      {!cat.active && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">Gizli</span>
                      )}
                      {cat.isFeatured && cat.active !== false && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 rounded-full text-xs font-bold">
                          <FiStar className="w-3 h-3 text-amber-600" />
                          Ana Sayfa Vitrini #{cat.featuredOrder ?? cat.order ?? 1}
                        </span>
                      )}
                      {cat.isFeatured && cat.active === false && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full text-xs font-medium">
                          Vitrin (Pasif)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 font-mono truncate">
                      {buildCategoryUrl(cat, '/urunler')}
                    </p>
                    {cat.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{cat.description}</p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1 flex-shrink-0">
                  <button
                    onClick={() => reorder(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
                    title="Yukarı Taşı"
                  >
                    <FiArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => reorder(idx, 'down')}
                    disabled={idx === categories.length - 1}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-30"
                    title="Aşağı Taşı"
                  >
                    <FiArrowDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => toggleActive(cat)}
                    className={`p-1.5 rounded-lg transition-colors ${
                      cat.active
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                    title={cat.active ? 'Pasife Al (Gizle)' : 'Aktife Al (Göster)'}
                  >
                    {cat.active ? <FiEye className="w-4 h-4" /> : <FiEyeOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => openEdit(cat)}
                    className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    title="Düzenle"
                  >
                    <FiEdit2 className="w-4 h-4" />
                  </button>

                  {deleteConfirm === cat.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDelete(cat.id)}
                        disabled={deletingId === cat.id}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        {deletingId === cat.id ? (
                          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          'Sil'
                        )}
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        disabled={deletingId === cat.id}
                        className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded-lg transition-colors"
                      >
                        İptal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(cat.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Kategoriyi Sil (Ürünler silinmez)"
                    >
                      <FiTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
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
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
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

              {/* Modal Body */}
              <div className="p-6 space-y-6 overflow-y-auto flex-1">
                {formError && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-start gap-2.5">
                    <FiAlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* SECTION 1: GENEL KATEGORİ BİLGİLERİ */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                    <FiLayers className="w-4 h-4 text-primary-600" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider">
                      Genel Kategori Bilgileri
                    </h3>
                  </div>

                  {/* Name & Slug */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Kategori Adı <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        placeholder="Örn: Ağız Bakımı"
                        className="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-colors text-sm"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        URL Slug <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.slug}
                        onChange={(e) => {
                          setFormError(null)
                          setForm((prev) => ({ ...prev, slug: e.target.value }))
                        }}
                        placeholder="agiz-bakimi"
                        className="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none transition-colors text-sm font-mono"
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
                      className="w-full px-3.5 py-2.5 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:outline-none resize-none transition-colors text-sm"
                    />
                  </div>

                  {/* Category Image */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Kategori Görseli</label>
                    {form.image && (
                      <div className="relative w-full h-32 rounded-xl overflow-hidden border-2 border-gray-200 mb-2 bg-gray-50">
                        <img src={form.image} alt="Category" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, image: '' }))}
                          className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg"
                        >
                          <FiX className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <label className="flex items-center gap-2 cursor-pointer w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-xl hover:border-primary-400 hover:bg-primary-50/30 transition-colors text-sm text-gray-500">
                      <FiImage className="w-4 h-4" />
                      {uploadingImage ? 'Yükleniyor...' : 'Kategori Görseli Yükle'}
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
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200/70">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Aktif</p>
                      <p className="text-xs text-gray-500">Pasif kategoriler menüde ve ana sayfa vitrininde gösterilmez</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, active: !prev.active }))}
                      className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${
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

                {/* SECTION 2: ANA SAYFA VİTRİN AYARLARI */}
                <div className="space-y-4 rounded-2xl border-2 border-amber-200/80 bg-amber-50/30 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                        <FiStar className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-gray-900">Ana Sayfa Vitrininde Göster</h3>
                        <p className="text-xs text-gray-500">
                          Etkinleştirildiğinde bu kategori ana sayfanın üst vitrin alanında kart olarak görünür.
                        </p>
                      </div>
                    </div>

                    <label className="inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={form.isFeatured}
                        onChange={(e) => {
                          setFormError(null)
                          const checked = e.target.checked
                          setForm((prev) => ({
                            ...prev,
                            isFeatured: checked,
                            featured: {
                              ...prev.featured,
                              title: prev.featured.title || prev.name,
                              description: prev.featured.description || prev.description,
                              ctaLabel: prev.featured.ctaLabel || 'Ürünleri Keşfet',
                            },
                          }))
                        }}
                        className="w-5 h-5 accent-amber-600 rounded cursor-pointer"
                      />
                    </label>
                  </div>

                  {form.isFeatured && (
                    <div className="space-y-4 pt-3 border-t border-amber-200/70">
                      {/* Auto CTA URL Preview */}
                      <div className="p-3 rounded-xl bg-white border border-amber-200/80 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-bold text-gray-600 uppercase tracking-wider text-[10px] block">
                            Otomatik CTA Bağlantısı
                          </span>
                          <span className="font-mono text-primary-700 font-semibold break-all">
                            {autoCtaPreview}
                          </span>
                        </div>
                        <FiExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Üst Rozet</label>
                          <input
                            type="text"
                            value={form.featured.badge}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                featured: { ...prev.featured, badge: e.target.value },
                              }))
                            }
                            placeholder="Örn: ÖNE ÇIKAN"
                            className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Gösterim Sırası</label>
                          <input
                            type="number"
                            min={1}
                            value={form.featuredOrder}
                            onChange={(e) =>
                              setForm((prev) => ({
                                ...prev,
                                featuredOrder: Math.max(1, parseInt(e.target.value || '1', 10) || 1),
                              }))
                            }
                            className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none text-sm"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Alt Başlık</label>
                        <input
                          type="text"
                          value={form.featured.subtitle}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              featured: { ...prev.featured, subtitle: e.target.value },
                            }))
                          }
                          placeholder="Örn: Ağız Bakım Koleksiyonu"
                          className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Büyük Başlık <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.featured.title}
                          onChange={(e) => {
                            setFormError(null)
                            setForm((prev) => ({
                              ...prev,
                              featured: { ...prev.featured, title: e.target.value },
                            }))
                          }}
                          placeholder="Örn: Gülümsemenize İyi Bakın"
                          className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Tanıtım Metni</label>
                        <textarea
                          rows={2}
                          value={form.featured.description}
                          onChange={(e) =>
                            setForm((prev) => ({
                              ...prev,
                              featured: { ...prev.featured, description: e.target.value },
                            }))
                          }
                          placeholder="Örn: Günlük ağız bakım rutininiz için ihtiyaç duyduğunuz ürünleri keşfedin."
                          className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none resize-none text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          CTA Buton Yazısı <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.featured.ctaLabel}
                          onChange={(e) => {
                            setFormError(null)
                            setForm((prev) => ({
                              ...prev,
                              featured: { ...prev.featured, ctaLabel: e.target.value },
                            }))
                          }}
                          placeholder="Örn: Ürünleri Keşfet"
                          className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none text-sm"
                        />
                      </div>

                      {/* Featured Visual */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Vitrin Görseli <span className="font-normal text-gray-400">(Boşsa kategori görseli kullanılır)</span>
                        </label>
                        {form.featured.image && (
                          <div className="relative w-full h-36 rounded-xl overflow-hidden border border-amber-200 mb-2 bg-white">
                            <img src={form.featured.image} alt="Vitrin" className="w-full h-full object-contain p-2" />
                            <button
                              type="button"
                              onClick={() =>
                                setForm((prev) => ({
                                  ...prev,
                                  featured: { ...prev.featured, image: '' },
                                }))
                              }
                              className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg"
                            >
                              <FiX className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <label className="flex items-center gap-2 cursor-pointer w-full px-4 py-2.5 bg-white border-2 border-dashed border-amber-300 rounded-xl hover:border-amber-500 hover:bg-amber-50/40 transition-colors text-xs font-medium text-gray-600">
                          <FiImage className="w-4 h-4 text-amber-600" />
                          {uploadingFeaturedImage ? 'Vitrin görseli yükleniyor...' : 'Vitrin Görseli Yükle'}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={uploadingFeaturedImage}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleFeaturedImageUpload(file)
                              e.target.value = ''
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 flex-shrink-0 bg-gray-50/50">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-2.5 text-gray-600 bg-gray-100 rounded-xl font-medium hover:bg-gray-200 transition-colors cursor-pointer"
                >
                  İptal
                </button>
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={saving || uploadingImage || uploadingFeaturedImage}
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 transition-colors disabled:opacity-50 cursor-pointer"
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
