'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiMenu,
  FiX,
  FiShoppingBag,
  FiChevronDown,
  FiUser,
  FiSearch,
  FiZap,
  FiFeather,
  FiArrowRight,
  FiShield,
} from 'react-icons/fi'
import { getCurrentUser, logoutUser, onUserAuthStateChanged } from '@/lib/firebase/userAuth'
import { getCartItemCount } from '@/lib/utils/cart'
import SearchModal from '@/components/search/SearchModal'

interface SiteSettings {
  siteName?: string
  siteDescription?: string
}

export default function Navbar() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [siteName, setSiteName] = useState('GÜLÜMSE')
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [cartItemCount, setCartItemCount] = useState(0)
  const [searchModalOpen, setSearchModalOpen] = useState(false)

  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const unsubscribe = onUserAuthStateChanged((currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const settingsRef = doc(db, 'settings', 'site')
      const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as SiteSettings
          if (data.siteName) setSiteName(data.siteName)
        }
      })
      return () => unsubscribe()
    } catch (error) {
      console.error('Navbar settings error:', error)
    }
  }, [])

  useEffect(() => {
    const updateCartCount = () => {
      setCartItemCount(getCartItemCount())
    }
    updateCartCount()
    window.addEventListener('cartUpdated', updateCartCount)
    return () => window.removeEventListener('cartUpdated', updateCartCount)
  }, [])

  // Close user dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleOpenCart = () => {
    window.dispatchEvent(new CustomEvent('openCartDrawer'))
  }

  const handleMouseEnterProducts = () => {
    if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
    setProductsDropdownOpen(true)
  }

  const handleMouseLeaveProducts = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setProductsDropdownOpen(false)
    }, 150)
  }

  return (
    <>
      <motion.header
        initial={{ y: -80 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'py-3 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 shadow-xs'
            : 'py-5 bg-white/60 backdrop-blur-md border-b border-slate-100/50'
        }`}
      >
        <div className="container-custom section-padding">
          <div className="flex items-center justify-between">
            {/* Logo & Brand Message */}
            <Link href="/" className="flex items-center gap-2 group">
              <motion.div
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex items-center gap-2.5"
              >
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-blue to-brand-green flex items-center justify-center text-white font-black text-lg shadow-sm">
                  G
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-black tracking-tight text-brand-navy group-hover:text-brand-blue transition-colors leading-none">
                    {siteName}
                  </span>
                  <span className="text-[10px] font-bold tracking-[0.18em] text-brand-green uppercase mt-0.5">
                    dental care
                  </span>
                </div>
              </motion.div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1 lg:space-x-2 text-sm font-semibold text-slate-700">
              <Link
                href="/"
                className="px-3.5 py-2 rounded-full hover:text-brand-blue hover:bg-brand-softBlue/60 transition-all"
              >
                Ana Sayfa
              </Link>

              {/* Products Mega Dropdown */}
              <div
                className="relative"
                onMouseEnter={handleMouseEnterProducts}
                onMouseLeave={handleMouseLeaveProducts}
              >
                <button
                  onClick={() => setProductsDropdownOpen(!productsDropdownOpen)}
                  className="px-3.5 py-2 rounded-full hover:text-brand-blue hover:bg-brand-softBlue/60 transition-all flex items-center gap-1.5"
                >
                  <span>Ürünler</span>
                  <FiChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      productsDropdownOpen ? 'rotate-180 text-brand-blue' : 'text-slate-400'
                    }`}
                  />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {productsDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      transition={{ duration: 0.18 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-80 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3 z-50 overflow-hidden"
                    >
                      <div className="space-y-1">
                        <Link
                          href="/urunler?kategori=otomatik"
                          onClick={() => setProductsDropdownOpen(false)}
                          className="flex items-start gap-3 p-3 rounded-2xl hover:bg-brand-softBlue/70 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <FiZap className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 group-hover:text-brand-blue flex items-center gap-1">
                              Otomatik Diş Fırçası
                              <FiArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">360° Sonic titreşim ve akıllı zamanlayıcı</p>
                          </div>
                        </Link>

                        <Link
                          href="/urunler?kategori=kullan-at"
                          onClick={() => setProductsDropdownOpen(false)}
                          className="flex items-start gap-3 p-3 rounded-2xl hover:bg-brand-softGreen/70 transition-colors group"
                        >
                          <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                            <FiFeather className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 group-hover:text-brand-green flex items-center gap-1">
                              Kullan At Diş Fırçası
                              <FiArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all" />
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">Hijyenik, pratik ve seyahat için ideal</p>
                          </div>
                        </Link>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-100">
                        <Link
                          href="/urunler"
                          onClick={() => setProductsDropdownOpen(false)}
                          className="block text-center py-2 text-xs font-bold text-brand-blue hover:underline"
                        >
                          Tüm Ürünleri İncele →
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <Link
                href="/hakkimizda"
                className="px-3.5 py-2 rounded-full hover:text-brand-blue hover:bg-brand-softBlue/60 transition-all"
              >
                Hakkımızda
              </Link>

              <Link
                href="/sss"
                className="px-3.5 py-2 rounded-full hover:text-brand-blue hover:bg-brand-softBlue/60 transition-all"
              >
                SSS
              </Link>

              <Link
                href="/iletisim"
                className="px-3.5 py-2 rounded-full hover:text-brand-blue hover:bg-brand-softBlue/60 transition-all"
              >
                İletişim
              </Link>
            </nav>

            {/* Action Buttons: Search, Cart, User, Mobile Toggle */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              {/* Search Button */}
              <button
                onClick={() => setSearchModalOpen(true)}
                className="p-2.5 rounded-full bg-slate-100 hover:bg-brand-softBlue hover:text-brand-blue transition-all text-slate-700 flex items-center justify-center"
                aria-label="Ürün Ara"
              >
                <FiSearch className="w-4 h-4" />
              </button>

              {/* Cart Trigger */}
              <button
                onClick={handleOpenCart}
                className="relative p-2.5 rounded-full bg-slate-100 hover:bg-brand-softBlue hover:text-brand-blue transition-all text-slate-700 flex items-center justify-center group"
                aria-label="Sepeti Aç"
              >
                <FiShoppingBag className="w-4 h-4 group-hover:scale-110 transition-transform" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-tr from-brand-blue to-blue-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-scale-in">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </span>
                )}
              </button>

              {/* Account Dropdown */}
              <div className="relative" ref={userMenuRef}>
                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="p-2 sm:px-3.5 sm:py-2 rounded-full bg-slate-100 hover:bg-slate-200/80 transition-all flex items-center gap-2 text-slate-800"
                    >
                      <FiUser className="w-4 h-4 text-brand-blue" />
                      <span className="text-xs font-bold hidden lg:block max-w-[100px] truncate">
                        {user.displayName || user.email?.split('@')[0] || 'Hesabım'}
                      </span>
                    </button>

                    <AnimatePresence>
                      {userMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="absolute right-0 mt-3 w-56 bg-white rounded-3xl shadow-2xl border border-slate-100 py-2 z-50 overflow-hidden"
                        >
                          <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/50">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Giriş Yapıldı</p>
                            <p className="text-xs font-bold text-slate-800 truncate mt-0.5">{user.email}</p>
                          </div>
                          <Link
                            href="/profil"
                            onClick={() => setUserMenuOpen(false)}
                            className="block px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-brand-softBlue hover:text-brand-blue transition-colors"
                          >
                            Profilim & Siparişlerim
                          </Link>
                          <button
                            onClick={async () => {
                              await logoutUser()
                              setUser(null)
                              setUserMenuOpen(false)
                              router.push('/')
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            Çıkış Yap
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    href="/giris"
                    className="p-2 sm:px-4 sm:py-2 rounded-full bg-slate-100 hover:bg-brand-softBlue hover:text-brand-blue transition-all flex items-center gap-1.5 text-slate-800 text-xs font-bold"
                  >
                    <FiUser className="w-4 h-4" />
                    <span className="hidden sm:inline">Giriş Yap</span>
                  </Link>
                )}
              </div>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-2.5 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-800"
                aria-label="Menüyü Aç"
              >
                {isOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white/98 backdrop-blur-2xl border-t border-slate-100 px-6 py-6 space-y-4 shadow-xl"
            >
              <Link
                href="/"
                onClick={() => setIsOpen(false)}
                className="block py-2 text-base font-bold text-slate-800 hover:text-brand-blue"
              >
                Ana Sayfa
              </Link>
              <div className="py-2 border-y border-slate-100 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Ürün Kategorileri</span>
                <Link
                  href="/urunler?kategori=otomatik"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 py-1 text-sm font-semibold text-slate-700 hover:text-brand-blue"
                >
                  <FiZap className="w-4 h-4 text-brand-blue" /> Otomatik Diş Fırçaları
                </Link>
                <Link
                  href="/urunler?kategori=kullan-at"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 py-1 text-sm font-semibold text-slate-700 hover:text-brand-green"
                >
                  <FiFeather className="w-4 h-4 text-brand-green" /> Kullan At Diş Fırçaları
                </Link>
                <Link
                  href="/urunler"
                  onClick={() => setIsOpen(false)}
                  className="block py-1 text-xs font-bold text-brand-blue hover:underline"
                >
                  Tüm Ürün Kataloğu →
                </Link>
              </div>
              <Link
                href="/hakkimizda"
                onClick={() => setIsOpen(false)}
                className="block py-2 text-base font-semibold text-slate-800 hover:text-brand-blue"
              >
                Hakkımızda
              </Link>
              <Link
                href="/sss"
                onClick={() => setIsOpen(false)}
                className="block py-2 text-base font-semibold text-slate-800 hover:text-brand-blue"
              >
                SSS
              </Link>
              <Link
                href="/iletisim"
                onClick={() => setIsOpen(false)}
                className="block py-2 text-base font-semibold text-slate-800 hover:text-brand-blue"
              >
                İletişim
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>

      {/* Global Live Search Modal */}
      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    </>
  )
}
