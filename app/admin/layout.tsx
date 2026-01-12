'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser } from '@/lib/firebase/auth'
import { User } from 'firebase/auth'
import Link from 'next/link'
import { FiPackage, FiSettings, FiLogOut, FiImage, FiHome, FiShield, FiEdit3 } from 'react-icons/fi'
import { motion } from 'framer-motion'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Login sayfasında auth kontrolü yapma
    if (pathname === '/admin/login') {
      setLoading(false)
      return
    }

    const checkAuth = async () => {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        router.push('/admin/login')
      } else {
        setUser(currentUser)
      }
      setLoading(false)
    }
    checkAuth()
  }, [router, pathname])

  const handleLogout = async () => {
    const { logoutAdmin } = await import('@/lib/firebase/auth')
    await logoutAdmin()
    router.push('/admin/login')
  }

  // İlk render'da loading göster (hydration uyumu için)
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Login sayfasında sadece children göster
  if (pathname === '/admin/login') {
    return <>{children}</>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed left-0 top-0 h-screen">
        <div className="p-6 border-b border-gray-200">
          <Link href="/admin" className="flex items-center gap-2">
            <FiShield className="w-6 h-6 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">Admin Panel</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <Link
            href="/admin"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname === '/admin' || pathname?.startsWith('/admin/urunler')
                ? 'bg-primary-50 text-primary-600 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FiPackage className="w-5 h-5" />
            Ürün Yönetimi
          </Link>

          <Link
            href="/admin/medya"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname?.startsWith('/admin/medya')
                ? 'bg-primary-50 text-primary-600 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FiImage className="w-5 h-5" />
            Medya Kütüphanesi
          </Link>

          <Link
            href="/admin/icerik"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname?.startsWith('/admin/icerik')
                ? 'bg-primary-50 text-primary-600 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FiEdit3 className="w-5 h-5" />
            Site İçeriği
          </Link>

          <Link
            href="/admin/ayarlar"
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              pathname?.startsWith('/admin/ayarlar')
                ? 'bg-primary-50 text-primary-600 font-medium'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FiSettings className="w-5 h-5" />
            Ayarlar
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-2">
          <Link
            href="/"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <FiHome className="w-5 h-5" />
            Siteye Dön
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            <FiLogOut className="w-5 h-5" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <Link href="/admin" className="flex items-center gap-2">
            <FiShield className="w-5 h-5 text-primary-600" />
            <span className="font-bold text-gray-900">Admin</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-600 hidden sm:block">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <FiLogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64">
        {pathname !== '/admin/login' && (
          <div className="lg:hidden bg-white border-b border-gray-200">
            <nav className="flex overflow-x-auto p-2 space-x-2">
              <Link
                href="/admin"
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                  pathname === '/admin' || pathname?.startsWith('/admin/urunler')
                    ? 'bg-primary-50 text-primary-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Ürünler
              </Link>
              <Link
                href="/admin/medya"
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                  pathname?.startsWith('/admin/medya')
                    ? 'bg-primary-50 text-primary-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Medya
              </Link>
              <Link
                href="/admin/icerik"
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                  pathname?.startsWith('/admin/icerik')
                    ? 'bg-primary-50 text-primary-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                İçerik
              </Link>
              <Link
                href="/admin/ayarlar"
                className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
                  pathname?.startsWith('/admin/ayarlar')
                    ? 'bg-primary-50 text-primary-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                Ayarlar
              </Link>
            </nav>
          </div>
        )}

        <div className="pt-16 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  )
}

