'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { loginAdmin, registerAdmin, getCurrentUser } from '@/lib/firebase/auth'
import { FiLock, FiMail, FiShield, FiUserPlus, FiLogIn } from 'react-icons/fi'

export default function AdminLoginPage() {
  const router = useRouter()
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser()
      if (user) {
        router.push('/admin')
      }
      setChecking(false)
    }
    checkAuth()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccessMsg('')

    if (isRegisterMode) {
      const result = await registerAdmin(email, password)
      if (result.success) {
        setSuccessMsg('Hesap başarıyla oluşturuldu! Yönlendiriliyorsunuz...')
        setTimeout(() => {
          router.push('/admin')
        }, 1000)
      } else {
        setError(result.error || 'Hesap oluşturulamadı')
        setLoading(false)
      }
    } else {
      const result = await loginAdmin(email, password)
      if (result.success) {
        router.push('/admin')
      } else {
        setError(result.error || 'Giriş başarısız')
        setLoading(false)
      }
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-primary-50 py-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FiShield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              {isRegisterMode ? 'Yeni Admin Hesabı' : 'Admin Girişi'}
            </h1>
            <p className="text-sm text-gray-500">
              {isRegisterMode
                ? 'İlk admin kullanıcısını oluşturun'
                : 'Yönetim paneline erişmek için giriş yapın'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
                {error}
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl">
                {successMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                E-posta
              </label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors text-sm"
                  placeholder="admin@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
                Şifre
              </label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl focus:border-primary-600 focus:ring-1 focus:ring-primary-600 focus:outline-none transition-colors text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={loading}
              className="w-full py-3.5 bg-primary-600 text-white rounded-xl font-bold text-sm hover:bg-primary-700 transition-colors shadow-md hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : isRegisterMode ? (
                <>
                  <FiUserPlus className="w-4 h-4" />
                  <span>Admin Hesabı Oluştur</span>
                </>
              ) : (
                <>
                  <FiLogIn className="w-4 h-4" />
                  <span>Giriş Yap</span>
                </>
              )}
            </motion.button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode(!isRegisterMode)
                  setError('')
                  setSuccessMsg('')
                }}
                className="text-xs text-primary-600 hover:text-primary-800 font-semibold transition-colors"
              >
                {isRegisterMode
                  ? 'Zaten bir hesabınız var mı? Giriş Yapın'
                  : 'İlk kez mi giriş yapıyorsunuz? Yeni Admin Oluşturun'}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}



