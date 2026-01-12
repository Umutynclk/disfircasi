'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { getCurrentUser, getUserData, logoutUser, onUserAuthStateChanged } from '@/lib/firebase/userAuth'
import { FiUser, FiMail, FiLock, FiLogOut, FiEdit2, FiSave, FiX } from 'react-icons/fi'
import { doc, updateDoc } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

interface UserData {
  name?: string
  email?: string
  createdAt?: any
  phone?: string
  address?: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [userData, setUserData] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: ''
  })

  useEffect(() => {
    const unsubscribe = onUserAuthStateChanged((currentUser) => {
      if (!currentUser) {
        router.push('/giris')
        return
      }
      setUser(currentUser)
      loadUserData(currentUser.uid)
    })
    return () => unsubscribe()
  }, [router])

  const loadUserData = async (userId: string) => {
    try {
      const result = await getUserData(userId)
      if (result.success && result.data) {
        const data = result.data as UserData
        setUserData(data)
        setFormData({
          name: data.name || '',
          phone: data.phone || '',
          address: data.address || ''
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Kullanıcı bilgileri yüklenirken hata:', error)
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user) return
    
    setSaving(true)
    try {
      const db = getFirestoreDB()
      const userRef = doc(db, 'users', user.uid)
      
      const updateData: any = {
        name: formData.name,
        updatedAt: new Date()
      }
      
      if (formData.phone) {
        updateData.phone = formData.phone
      }
      
      if (formData.address) {
        updateData.address = formData.address
      }
      
      await updateDoc(userRef, updateData)
      await loadUserData(user.uid)
      setEditing(false)
      alert('Bilgileriniz güncellendi!')
    } catch (error) {
      console.error('Güncelleme hatası:', error)
      alert('Güncelleme sırasında bir hata oluştu')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    await logoutUser()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white pt-32">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="pt-32 pb-20 min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <div className="container-custom section-padding max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-8 py-12 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">Profilim</h1>
                <p className="text-primary-100">Hesap bilgilerinizi yönetin</p>
              </div>
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <FiUser className="w-10 h-10" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-8">
            {/* Kullanıcı Bilgileri */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Kişisel Bilgiler</h2>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <FiEdit2 className="w-4 h-4" />
                    Düzenle
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      <FiSave className="w-4 h-4" />
                      {saving ? 'Kaydediliyor...' : 'Kaydet'}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        if (userData) {
                          setFormData({
                            name: userData.name || '',
                            phone: userData.phone || '',
                            address: userData.address || ''
                          })
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      <FiX className="w-4 h-4" />
                      İptal
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {/* E-posta (Değiştirilemez) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiMail className="inline w-4 h-4 mr-2" />
                    E-posta
                  </label>
                  <input
                    type="email"
                    value={user.email || ''}
                    disabled
                    className="w-full px-4 py-3 bg-gray-100 border-2 border-gray-200 rounded-lg text-gray-600 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-gray-500">E-posta adresi değiştirilemez</p>
                </div>

                {/* İsim */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiUser className="inline w-4 h-4 mr-2" />
                    Ad Soyad
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                      placeholder="Adınız ve soyadınız"
                    />
                  ) : (
                    <div className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg text-gray-900">
                      {userData?.name || 'Belirtilmemiş'}
                    </div>
                  )}
                </div>

                {/* Telefon */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiMail className="inline w-4 h-4 mr-2" />
                    Telefon
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-600 focus:outline-none transition-colors"
                      placeholder="05XX XXX XX XX"
                    />
                  ) : (
                    <div className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg text-gray-900">
                      {userData?.phone || 'Belirtilmemiş'}
                    </div>
                  )}
                </div>

                {/* Adres */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    <FiMail className="inline w-4 h-4 mr-2" />
                    Adres
                  </label>
                  {editing ? (
                    <textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-primary-600 focus:outline-none transition-colors resize-none"
                      placeholder="Adres bilgilerinizi girin"
                    />
                  ) : (
                    <div className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-lg text-gray-900 min-h-[100px]">
                      {userData?.address || 'Belirtilmemiş'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Hesap İşlemleri */}
            <div className="border-t-2 border-gray-200 pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Hesap İşlemleri</h2>
              <div className="space-y-4">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-red-50 border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-100 transition-colors font-semibold"
                >
                  <FiLogOut className="w-5 h-5" />
                  Çıkış Yap
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}


