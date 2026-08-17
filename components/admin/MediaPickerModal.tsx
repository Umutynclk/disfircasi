'use client'

import { useState, useEffect } from 'react'
import { ref, listAll, getDownloadURL } from 'firebase/storage'
import { getFirebaseStorage } from '@/firebase/config'
import { uploadImage } from '@/lib/firebase/storage'
import { FiX, FiImage, FiUpload, FiCheck } from 'react-icons/fi'

interface MediaPickerModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (url: string) => void
  title?: string
}

export default function MediaPickerModal({
  isOpen,
  onClose,
  onSelect,
  title = 'Görsel Seç veya Yükle',
}: MediaPickerModalProps) {
  const [mediaList, setMediaList] = useState<{ name: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const loadMedia = async () => {
      setLoading(true)
      try {
        const storage = getFirebaseStorage()
        const folders = ['images/products', 'images/content', 'images/banner', 'images']
        const allItems: { name: string; url: string }[] = []

        for (const folder of folders) {
          try {
            const listRef = ref(storage, folder)
            const res = await listAll(listRef)
            for (const item of res.items) {
              const url = await getDownloadURL(item)
              if (!allItems.some((i) => i.url === url)) {
                allItems.push({ name: item.name, url })
              }
            }
          } catch (e) {
            // folder might not exist yet, ignore
          }
        }

        setMediaList(allItems)
      } catch (err) {
        console.error('Media load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadMedia()
  }, [isOpen])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const url = await uploadImage(file, 'content')
      setMediaList((prev) => [{ name: file.name, url }, ...prev])
      setSelectedUrl(url)
    } catch (err: any) {
      alert(`Görsel yüklenemedi: ${err.message || 'Hata'}`)
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = () => {
    if (selectedUrl) {
      onSelect(selectedUrl)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center">
              <FiImage className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">Mevcut medyadan seçin veya yeni bir dosya yükleyin</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition-colors"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        {/* Upload Bar */}
        <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm">
            <FiUpload className="w-4 h-4" />
            <span>{uploading ? 'Yükleniyor...' : 'Bilgisayardan Yeni Görsel Yükle'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <span className="text-xs text-gray-400">
            {mediaList.length} kayıtlı medya bulundu
          </span>
        </div>

        {/* Media Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-gray-500 font-medium">Görseller taranıyor...</p>
            </div>
          ) : mediaList.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <FiImage className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p className="text-sm font-medium">Henüz yüklenmiş bir medya bulunamadı.</p>
              <p className="text-xs mt-1">Yukarıdaki butonu kullanarak yeni bir görsel yükleyebilirsiniz.</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {mediaList.map((item, idx) => {
                const isSelected = selectedUrl === item.url
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedUrl(item.url)}
                    className={`relative aspect-square rounded-2xl border-2 overflow-hidden cursor-pointer transition-all ${
                      isSelected
                        ? 'border-primary-600 ring-4 ring-primary-100 scale-95 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:scale-102'
                    }`}
                  >
                    <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
                    {isSelected && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-md">
                        <FiCheck className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="text-xs text-gray-500 truncate max-w-sm">
            {selectedUrl ? 'Görsel seçildi' : 'Lütfen bir görsel seçin'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl text-xs font-semibold text-gray-700 transition-colors"
            >
              Vazgeç
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedUrl}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              Seçilen Görseli Kullan
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
