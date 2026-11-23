'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getCurrentUser, isUserAdmin, logoutAdmin } from '@/lib/firebase/auth'
import { User } from 'firebase/auth'
import Link from 'next/link'
import {
  FiPackage,
  FiSettings,
  FiLogOut,
  FiImage,
  FiHome,
  FiShield,
  FiEdit3,
  FiShoppingBag,
  FiTag,
  FiGrid,
  FiMenu,
  FiX,
} from 'react-icons/fi'
import { AnimatePresence, motion } from 'framer-motion'

const ADMIN_NAV_ITEMS = [
  { href: '/admin', label: 'Kontrol Paneli', shortLabel: 'Panel', icon: FiGrid, exact: true },
  { href: '/admin/siparisler', label: 'Siparişler', shortLabel: 'Siparişler', icon: FiShoppingBag, exact: false },
  { href: '/admin/urunler', label: 'Ürün Yönetimi', shortLabel: 'Ürünler', icon: FiPackage, exact: false },
  { href: '/admin/kategoriler', label: 'Kategoriler', shortLabel: 'Kategoriler', icon: FiTag, exact: false },
  { href: '/admin/medya', label: 'Medya Kütüphanesi', shortLabel: 'Medya', icon: FiImage, exact: false },
  { href: '/admin/icerik', label: 'Site İçeriği', shortLabel: 'İçerik', icon: FiEdit3, exact: false },
  { href: '/admin/ayarlar', label: 'Ayarlar', shortLabel: 'Ayarlar', icon: FiSettings, exact: false },
]

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Sayfa değiştiğinde mobil menüyü otomatik kapat
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    setMounted(true)
    if (pathname === '/admin/login') {
      setLoading(false)
      return
    }

    const checkAuth = async () => {
      const currentUser = await getCurrentUser()
      if (!currentUser) {
        router.push('/admin/login')
        setLoading(false)
        return
      }

      const isAdmin = await isUserAdmin(currentUser)
      if (!isAdmin) {
        await logoutAdmin()
        router.push('/admin/login?error=unauthorized')
        setLoading(false)
        return
      }

      setUser(currentUser)
      setLoading(false)
    }
    checkAuth()
  }, [router, pathname])

  const handleLogout = async () => {
    await logoutAdmin()
    router.push('/admin/login')
  }

  const isNavActive = (href: string, exact: boolean) => {
    if (!pathname) return false
    if (exact) return pathname === href || pathname === '/admin/kontrolpaneli'
    return pathname.startsWith(href)
  }

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    )
  }

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
    <div className="min-h-screen bg-gray-50 flex w-full overflow-x-hidden">
      {/* Desktop Sidebar (Masaüstü görünüm birebir korunur) */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed left-0 top-0 h-screen z-30">
        <div className="p-6 border-b border-gray-200">
          <Link href="/admin" className="flex items-center gap-2">
            <FiShield className="w-6 h-6 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">Admin Panel</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {ADMIN_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isNavActive(item.href, item.exact)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
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
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
          >
            <FiLogOut className="w-5 h-5" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* Mobile Fixed Top Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 shadow-2xs">
        <div className="h-full px-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Yönetim Menüsünü Aç/Kapat"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors flex-shrink-0 cursor-pointer"
            >
              {mobileMenuOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
            </button>
            <Link href="/admin" className="flex items-center gap-1.5 min-w-0">
              <FiShield className="w-5 h-5 text-primary-600 flex-shrink-0" />
              <span className="font-bold text-gray-900 text-sm sm:text-base truncate">Admin Panel</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Link
              href="/"
              title="Siteye Dön"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <FiHome className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              title="Çıkış Yap"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
            >
              <FiLogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer Sidebar */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.22 }}
              className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] bg-white shadow-2xl flex flex-col"
            >
              <div className="h-14 px-4 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiShield className="w-5 h-5 text-primary-600" />
                  <span className="font-bold text-gray-900">SONRAKAM Admin</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Menüyü Kapat"
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 cursor-pointer"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {user?.email && (
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Yönetici</p>
                  <p className="text-xs font-semibold text-gray-700 truncate">{user.email}</p>
                </div>
              )}

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {ADMIN_NAV_ITEMS.map((item) => {
                  const Icon = item.icon
                  const active = isNavActive(item.href, item.exact)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-colors ${
                        active
                          ? 'bg-primary-50 text-primary-700 font-semibold'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </nav>

              <div className="p-3 border-t border-gray-200 space-y-1">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <FiHome className="w-5 h-5" />
                  Siteye Dön
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 cursor-pointer"
                >
                  <FiLogOut className="w-5 h-5" />
                  Çıkış Yap
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 min-w-0 w-full lg:ml-64 pt-14 lg:pt-0 overflow-x-hidden">
        {/* Mobile Quick Section Bar (Header altında çakışmadan görünür) */}
        <div className="lg:hidden sticky top-14 z-30 bg-white/95 backdrop-blur-sm border-b border-gray-200">
          <nav className="flex items-center overflow-x-auto px-2.5 py-2 gap-1.5 scrollbar-none">
            {ADMIN_NAV_ITEMS.map((item) => {
              const active = isNavActive(item.href, item.exact)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 ${
                    active
                      ? 'bg-primary-600 text-white shadow-2xs'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {item.shortLabel}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="w-full max-w-full overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
