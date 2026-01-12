'use client'

import { useState, useEffect } from 'react'
import { ref, listAll, getDownloadURL, deleteObject } from 'firebase/storage'
import { getFirebaseStorage } from '@/firebase/config'
import { motion } from 'framer-motion'
import { FiImage, FiVideo, FiTrash2, FiDownload, FiX, FiUpload } from 'react-icons/fi'
import { uploadImage, uploadVideo } from '@/lib/firebase/storage'

interface MediaFile {
  name: string
  url: string
  type: 'image' | 'video'
  fullPath: string
}

export default function MediaLibraryPage() {
  const [images, setImages] = useState<MediaFile[]>([])
  const [videos, setVideos] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'images' | 'videos'>('images')

  useEffect(() => {
    fetchMedia()
  }, [])

  const fetchMedia = async () => {
    try {
      const storage = getFirebaseStorage()
      if (!storage) {
        setLoading(false)
        return
      }

      // Fetch images
      const imagesRef = ref(storage, 'images/products')
      try {
        const imagesList = await listAll(imagesRef)
        const imagePromises = imagesList.items.map(async (item) => {
          const url = await getDownloadURL(item)
          return {
            name: item.name,
            url,
            type: 'image' as const,
            fullPath: item.fullPath
          }
        })
        const imageData = await Promise.all(imagePromises)
        setImages(imageData)
      } catch (error) {
        console.error('Images fetch error:', error)
      }

      // Fetch videos
      const videosRef = ref(storage, 'videos/products')
      try {
        const videosList = await listAll(videosRef)
        const videoPromises = videosList.items.map(async (item) => {
          const url = await getDownloadURL(item)
          return {
            name: item.name,
            url,
            type: 'video' as const,
            fullPath: item.fullPath
          }
        })
        const videoData = await Promise.all(videoPromises)
        setVideos(videoData)
      } catch (error) {
        console.error('Videos fetch error:', error)
      }
    } catch (error) {
      console.error('Media fetch error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setUploading(true)
    try {
      for (const file of files) {
        const url = await uploadImage(file, 'products')
        setImages(prev => [...prev, {
          name: file.name,
          url,
          type: 'image',
          fullPath: `images/products/${file.name}`
        }])
      }
    } catch (error) {
      console.error('Upload error:', error)
      alert('Yükleme hatası: ' + (error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const url = await uploadVideo(file, 'products')
      setVideos(prev => [...prev, {
        name: file.name,
        url,
        type: 'video',
        fullPath: `videos/products/${file.name}`
      }])
    } catch (error) {
      console.error('Upload error:', error)
      alert('Yükleme hatası: ' + (error as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (file: MediaFile) => {
    if (!confirm(`"${file.name}" dosyasını silmek istediğinizden emin misiniz?`)) {
      return
    }

    try {
      const storage = getFirebaseStorage()
      if (!storage) return

      const fileRef = ref(storage, file.fullPath)
      await deleteObject(fileRef)

      if (file.type === 'image') {
        setImages(images.filter(img => img.fullPath !== file.fullPath))
      } else {
        setVideos(videos.filter(vid => vid.fullPath !== file.fullPath))
      }
    } catch (error) {
      console.error('Delete error:', error)
      alert('Silme hatası: ' + (error as Error).message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  const activeMedia = activeTab === 'images' ? images : videos

  return (
    <div className="p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Medya Kütüphanesi</h1>
          <p className="text-gray-600">Fotoğraf ve videolarınızı yönetin</p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('images')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'images'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FiImage className="w-5 h-5 inline-block mr-2" />
              Fotoğraflar ({images.length})
            </button>
            <button
              onClick={() => setActiveTab('videos')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'videos'
                  ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FiVideo className="w-5 h-5 inline-block mr-2" />
              Videolar ({videos.length})
            </button>
          </div>

          {/* Upload Area */}
          <div className="p-6 border-b border-gray-200">
            {activeTab === 'images' ? (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 transition-colors bg-gray-50">
                <FiUpload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Fotoğraf Yükle (Çoklu seçim mümkün)</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-600 transition-colors bg-gray-50">
                <FiUpload className="w-8 h-8 text-gray-400 mb-2" />
                <span className="text-sm text-gray-600">Video Yükle</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            )}
            {uploading && (
              <div className="mt-4 text-center text-sm text-primary-600">
                Yükleniyor...
              </div>
            )}
          </div>

          {/* Media Grid */}
          <div className="p-6">
            {activeMedia.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-600 mb-4">Henüz medya eklenmemiş</p>
                <p className="text-sm text-gray-500">Yukarıdaki alanı kullanarak yükleme yapabilirsiniz</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {activeMedia.map((file, index) => (
                  <motion.div
                    key={file.fullPath}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="group relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 hover:border-primary-400 transition-colors"
                  >
                    {file.type === 'image' ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={file.url}
                        className="w-full h-full object-cover"
                      />
                    )}
                    
                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <a
                        href={file.url}
                        download={file.name}
                        className="p-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FiDownload className="w-5 h-5" />
                      </a>
                      <button
                        onClick={() => handleDelete(file)}
                        className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                      >
                        <FiTrash2 className="w-5 h-5" />
                      </button>
                    </div>

                    {/* File Name */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white text-xs p-2 truncate">
                      {file.name}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}


