'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
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

import { useLocale } from '@/context/LocaleContext'
import { subscribeToBrandLogos, BrandLogoConfig } from '@/lib/firebase/content'
import { SupportedLocale } from '@/lib/i18n/dictionaries'

interface SiteSettings {
  siteName?: string
  siteDescription?: string
}

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { locale, setLocale, currency, setCurrency, currencyConfig, t, getLocalizedPath } = useLocale()

  const [isOpen, setIsOpen] = useState(false)
  const [siteName, setSiteName] = useState('GÜLÜMSE')
  const [brandLogos, setBrandLogos] = useState<BrandLogoConfig>({ tr: '', en: '', de: '', fr: '', it: '', default: '' })
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false)
  const [langDropdownOpen, setLangDropdownOpen] = useState(false)
  const [currencyDropdownOpen, setCurrencyDropdownOpen] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [cartItemCount, setCartItemCount] = useState(0)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [hoveredNav, setHoveredNav] = useState<string | null>(null)

  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)
  const langMenuRef = useRef<HTMLDivElement>(null)
  const currencyMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unsubscribe = onUserAuthStateChanged((currentUser) => {
      setUser(currentUser)
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const unsubLogos = subscribeToBrandLogos((logos) => {
      setBrandLogos(logos)
    })
    return () => unsubLogos()
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

  // Close user & language dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false)
      }
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setLangDropdownOpen(false)
      }
      if (currencyMenuRef.current && !currencyMenuRef.current.contains(event.target as Node)) {
        setCurrencyDropdownOpen(false)
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
    setHoveredNav('products')
  }

  const handleMouseLeaveProducts = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setProductsDropdownOpen(false)
    }, 150)
  }

  // Active navigation detection from pathname
  const getActiveNavId = () => {
    if (!pathname) return 'home'
    const path = pathname.toLowerCase()
    if (path === '/' || path === '/tr' || path === '/en' || path === '/de' || path === '/fr' || path === '/it') return 'home'
    if (path.includes('urunler') || path.includes('products') || path.includes('produkte') || path.includes('produits') || path.includes('prodotti')) return 'products'
    if (path.includes('kampanyalar') || path.includes('campaigns') || path.includes('angebote') || path.includes('promotions') || path.includes('offerte')) return 'campaigns'
    if (path.includes('hakkimizda') || path.includes('about') || path.includes('uber-uns') || path.includes('a-propos') || path.includes('chi-siamo')) return 'about'
    if (path.includes('sss') || path.includes('faq')) return 'faq'
    if (path.includes('iletisim') || path.includes('contact') || path.includes('kontakt') || path.includes('contatti')) return 'contact'
    return 'home'
  }

  const activeNavId = getActiveNavId()
  const currentHighlightedNav = hoveredNav || activeNavId

  // Ana marka logosu dile göre değişir (her dil için farklı logo)
  const currentLogo = brandLogos[locale] || brandLogos.default || brandLogos.tr

  const languages: { code: SupportedLocale; name: string; flag: string }[] = [
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  ]

  const navItems = [
    { id: 'home', label: t.nav.home, href: getLocalizedPath('/'), isHome: true },
    { id: 'products', label: t.nav.products, href: getLocalizedPath('/urunler'), isDropdown: true },
    { id: 'campaigns', label: t.nav.campaigns, href: getLocalizedPath('/urunler') },
    { id: 'about', label: t.nav.about, href: getLocalizedPath('/hakkimizda') },
    { id: 'faq', label: t.nav.faq, href: getLocalizedPath('/sss') },
    { id: 'contact', label: t.nav.contact, href: getLocalizedPath('/iletisim') },
  ]

  return (
    <>
      {/* STRICTLY STICKY HEADER WRAPPER */}
      <div className="sticky top-0 left-0 right-0 z-50 w-full bg-white shadow-xs border-b border-slate-100">
        
        {/* 0. TOP ANNOUNCEMENT BAR */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-600 text-white text-xs font-bold py-2 px-4 border-b border-white/10 shadow-2xs">
          <div className="container-custom section-padding flex items-center justify-between text-[11px] sm:text-xs">
            <div className="flex items-center gap-2">
              <span>🚚</span>
              <span>{t.nav.topPromo1}</span>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span>🛡️</span>
              <span>{t.nav.topPromo2}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>💚</span>
              <span>{t.nav.topPromo3}</span>
            </div>
          </div>
        </div>

        {/* 1. MAIN HEADER ROW: Big Brand Logo, Enormous Center Slogan, Right Action Buttons */}
        <div className="py-3 sm:py-4 bg-white">
          <div className="container-custom section-padding flex items-center justify-between gap-4">
            
            {/* LEFT: Large Brand Logo — Changes per active language */}
            <Link href={getLocalizedPath('/')} className="flex items-center gap-2 group flex-shrink-0">
              {currentLogo ? (
                <img
                  src={currentLogo}
                  alt={siteName}
                  className="h-16 sm:h-20 md:h-24 w-auto max-w-[280px] object-contain transition-transform group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-sky-600 via-blue-600 to-emerald-500 flex items-center justify-center text-white font-black text-3xl shadow-sm">
                    G
                  </div>
                  <div className="flex flex-col">
                    <span className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 leading-none">
                      {siteName}
                    </span>
                    <span className="text-[11px] tracking-widest text-slate-400 font-bold uppercase mt-1">
                      DENTAL CARE
                    </span>
                  </div>
                </div>
              )}
            </Link>

            {/* CENTER: Enormous Slogan Tagline Typography "hayata gülümse" */}
            <div className="hidden md:flex flex-col items-center justify-center text-center select-none px-4">
              <span className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight bg-gradient-to-r from-sky-600 via-blue-600 to-emerald-500 bg-clip-text text-transparent italic leading-none py-1">
                hayata gülümse
              </span>
              <span className="text-xs lg:text-sm uppercase font-extrabold tracking-[0.3em] text-slate-400 mt-1">
                PREMIUM ORAL CARE
              </span>
            </div>

            {/* RIGHT: Actions (Currency Dropdown, Language Dropdown, Search, Cart, User, Mobile Toggle) */}
            <div className="flex items-center space-x-2 sm:space-x-3.5 flex-shrink-0">

              {/* Currency Selector Dropdown (TCMB Gösterge Kuru) */}
              <div className="relative" ref={currencyMenuRef}>
                <button
                  onClick={() => setCurrencyDropdownOpen(!currencyDropdownOpen)}
                  className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5 transition-all border border-slate-200/80 shadow-2xs group"
                  aria-label="Para Birimi Seçimi"
                  title="TCMB Güncel Gösterge Kuru"
                >
                  <span className="text-emerald-600 font-black text-sm sm:text-base">
                    {currency === 'TRY' ? '₺' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£'}
                  </span>
                  <span className="uppercase font-black text-slate-800">{currency}</span>
                  <FiChevronDown
                    className={`w-3.5 h-3.5 text-slate-500 transition-transform ${
                      currencyDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {currencyDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 z-50 overflow-hidden"
                    >
                      <div className="px-3.5 py-1.5 border-b border-slate-100 bg-slate-50/80">
                        <div className="text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          TCMB Gösterge Kuru
                        </div>
                        <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                          TCMB Bülten: {currencyConfig.rateDate || 'Güncel'}
                        </p>
                      </div>

                      {[
                        { code: 'TRY' as const, symbol: '₺', label: 'TRY (Türk Lirası)', flag: '🇹🇷', sub: 'Baz Fiyat' },
                        { code: 'USD' as const, symbol: '$', label: 'USD (US Dollar)', flag: '🇺🇸', sub: currencyConfig.rates.USD.sellingTRY ? `1$ = ${currencyConfig.rates.USD.sellingTRY.toFixed(2)}₺` : '' },
                        { code: 'EUR' as const, symbol: '€', label: 'EUR (Euro)', flag: '🇪🇺', sub: currencyConfig.rates.EUR.sellingTRY ? `1€ = ${currencyConfig.rates.EUR.sellingTRY.toFixed(2)}₺` : '' },
                        { code: 'GBP' as const, symbol: '£', label: 'GBP (British Pound)', flag: '🇬🇧', sub: currencyConfig.rates.GBP.sellingTRY ? `1£ = ${currencyConfig.rates.GBP.sellingTRY.toFixed(2)}₺` : '' },
                      ].map((currItem) => (
                        <button
                          key={currItem.code}
                          onClick={() => {
                            setCurrency(currItem.code)
                            setCurrencyDropdownOpen(false)
                          }}
                          className={`w-full text-left px-3.5 py-2 text-xs font-bold flex items-center justify-between transition-colors ${
                            currency === currItem.code
                              ? 'bg-emerald-50 text-emerald-700 font-black'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-base">{currItem.flag}</span>
                            <span>{currItem.label}</span>
                          </div>
                          {currItem.sub && (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              {currItem.sub}
                            </span>
                          )}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Language Selector Dropdown */}
              <div className="relative" ref={langMenuRef}>
                <button
                  onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                  className="px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 text-xs sm:text-sm font-extrabold text-slate-800 flex items-center gap-1.5 transition-all border border-slate-200/80 shadow-2xs"
                  aria-label="Dil Seçimi"
                >
                  <span className="text-lg">{languages.find((l) => l.code === locale)?.flag}</span>
                  <span className="uppercase font-black">{locale}</span>
                  <FiChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform ${
                      langDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {langDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 overflow-hidden"
                    >
                      {languages.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => {
                            setLocale(l.code)
                            setLangDropdownOpen(false)
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs sm:text-sm font-bold flex items-center gap-3 transition-colors ${
                            locale === l.code
                              ? 'bg-emerald-50 text-emerald-700 font-black'
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="text-xl">{l.flag}</span>
                          <span>{l.name}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Search Button */}
              <button
                onClick={() => setSearchModalOpen(true)}
                className="p-3 rounded-full bg-slate-100 hover:bg-sky-50 hover:text-sky-600 transition-all text-slate-700 flex items-center justify-center shadow-2xs"
                aria-label="Ürün Ara"
              >
                <FiSearch className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              {/* Cart Trigger */}
              <button
                onClick={handleOpenCart}
                className="relative p-3 rounded-full bg-slate-100 hover:bg-emerald-50 hover:text-emerald-600 transition-all text-slate-700 flex items-center justify-center group shadow-2xs"
                aria-label="Sepeti Aç"
              >
                <FiShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-tr from-emerald-500 to-teal-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-scale-in">
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
                      className="p-2 sm:px-4 sm:py-2.5 rounded-full bg-slate-100 hover:bg-slate-200/80 transition-all flex items-center gap-2 text-slate-800 shadow-2xs"
                    >
                      <FiUser className="w-4 h-4 text-sky-600" />
                      <span className="text-xs sm:text-sm font-bold hidden lg:block max-w-[110px] truncate">
                        {user.displayName || user.email?.split('@')[0] || t.nav.profile}
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
                            href={getLocalizedPath('/profil')}
                            onClick={() => setUserMenuOpen(false)}
                            className="block px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-sky-50 hover:text-sky-600 transition-colors"
                          >
                            {t.nav.profile}
                          </Link>
                          <button
                            onClick={async () => {
                              await logoutUser()
                              setUser(null)
                              setUserMenuOpen(false)
                              router.push(getLocalizedPath('/'))
                            }}
                            className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            {t.nav.logout}
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ) : (
                  <Link
                    href={getLocalizedPath('/giris')}
                    className="p-2 sm:px-4 sm:py-2.5 rounded-full bg-slate-100 hover:bg-sky-50 hover:text-sky-600 transition-all flex items-center gap-1.5 text-slate-800 text-xs sm:text-sm font-bold shadow-2xs"
                  >
                    <FiUser className="w-4 h-4 text-sky-600" />
                    <span className="hidden sm:inline">{t.nav.login}</span>
                  </Link>
                )}
              </div>

              {/* Mobile Menu Toggle */}
              <button
                onClick={() => setIsOpen(!isOpen)}
                className="md:hidden p-3 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors text-slate-800 shadow-2xs"
                aria-label="Menüyü Aç"
              >
                {isOpen ? <FiX className="w-5 h-5" /> : <FiMenu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* 2. NAVIGATION ROW: Centered, Enlarged, with Interactive Moving Green Pill Indicator */}
        <div className="hidden md:block py-2 bg-slate-50/90 border-t border-slate-100">
          <div
            className="container-custom section-padding flex items-center justify-center"
            onMouseLeave={() => {
              setHoveredNav(null)
              if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current)
              setProductsDropdownOpen(false)
            }}
          >
            <nav className="flex items-center justify-center space-x-1 lg:space-x-3 bg-white/70 p-1.5 rounded-full border border-slate-200/60 shadow-2xs">
              
              {/* 1. Home */}
              <Link
                href={getLocalizedPath('/')}
                onMouseEnter={() => setHoveredNav('home')}
                className={`relative px-6 py-2.5 sm:px-7 sm:py-3 rounded-full text-sm sm:text-base font-black transition-colors duration-200 flex items-center gap-2 select-none ${
                  currentHighlightedNav === 'home'
                    ? 'text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {currentHighlightedNav === 'home' && (
                  <motion.div
                    layoutId="navPillHighlight"
                    className="absolute inset-0 bg-emerald-600 rounded-full shadow-md shadow-emerald-600/30 z-0"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10 text-base sm:text-lg">🏠</span>
                <span className="relative z-10">{t.nav.home}</span>
              </Link>

              {/* 2. Products (with Dropdown) */}
              <div
                className="relative"
                onMouseEnter={handleMouseEnterProducts}
              >
                <Link
                  href={getLocalizedPath('/urunler')}
                  className={`relative px-6 py-2.5 sm:px-7 sm:py-3 rounded-full text-sm sm:text-base font-black transition-colors duration-200 flex items-center gap-1.5 select-none ${
                    currentHighlightedNav === 'products'
                      ? 'text-white'
                      : 'text-slate-700 hover:text-slate-900'
                  }`}
                >
                  {currentHighlightedNav === 'products' && (
                    <motion.div
                      layoutId="navPillHighlight"
                      className="absolute inset-0 bg-emerald-600 rounded-full shadow-md shadow-emerald-600/30 z-0"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">{t.nav.products}</span>
                  <FiChevronDown className={`relative z-10 w-4 h-4 transition-transform ${productsDropdownOpen ? 'rotate-180' : ''}`} />
                </Link>

                <AnimatePresence>
                  {productsDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.98 }}
                      className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-84 bg-white rounded-3xl shadow-2xl border border-slate-100 p-3.5 z-50 overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        <Link
                          href={`${getLocalizedPath('/urunler')}?kategori=otomatik`}
                          onClick={() => setProductsDropdownOpen(false)}
                          className="flex items-start gap-3.5 p-3 rounded-2xl hover:bg-sky-50 transition-colors group"
                        >
                          <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
                            <FiZap className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 group-hover:text-sky-600 flex items-center gap-1">
                              {t.nav.automaticToothbrush}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{t.showcase.leftHighlight} 360°</p>
                          </div>
                        </Link>

                        <Link
                          href={`${getLocalizedPath('/urunler')}?kategori=kullan-at`}
                          onClick={() => setProductsDropdownOpen(false)}
                          className="flex items-start gap-3.5 p-3 rounded-2xl hover:bg-emerald-50 transition-colors group"
                        >
                          <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                            <FiFeather className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-600 flex items-center gap-1">
                              {t.nav.disposableToothbrush}
                            </div>
                            <p className="text-xs text-slate-500 mt-0.5">{t.showcase.rightHighlight}</p>
                          </div>
                        </Link>

                        <Link
                          href={getLocalizedPath('/urunler')}
                          onClick={() => setProductsDropdownOpen(false)}
                          className="block py-2.5 text-center text-xs font-black text-emerald-600 hover:underline border-t border-slate-100 mt-1"
                        >
                          {t.productsSection.viewAll} →
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* 3. Campaigns */}
              <Link
                href={getLocalizedPath('/urunler')}
                onMouseEnter={() => setHoveredNav('campaigns')}
                className={`relative px-6 py-2.5 sm:px-7 sm:py-3 rounded-full text-sm sm:text-base font-black transition-colors duration-200 flex items-center select-none ${
                  currentHighlightedNav === 'campaigns'
                    ? 'text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {currentHighlightedNav === 'campaigns' && (
                  <motion.div
                    layoutId="navPillHighlight"
                    className="absolute inset-0 bg-emerald-600 rounded-full shadow-md shadow-emerald-600/30 z-0"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{t.nav.campaigns}</span>
              </Link>

              {/* 4. About Us */}
              <Link
                href={getLocalizedPath('/hakkimizda')}
                onMouseEnter={() => setHoveredNav('about')}
                className={`relative px-6 py-2.5 sm:px-7 sm:py-3 rounded-full text-sm sm:text-base font-black transition-colors duration-200 flex items-center select-none ${
                  currentHighlightedNav === 'about'
                    ? 'text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {currentHighlightedNav === 'about' && (
                  <motion.div
                    layoutId="navPillHighlight"
                    className="absolute inset-0 bg-emerald-600 rounded-full shadow-md shadow-emerald-600/30 z-0"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{t.nav.about}</span>
              </Link>

              {/* 5. FAQ */}
              <Link
                href={getLocalizedPath('/sss')}
                onMouseEnter={() => setHoveredNav('faq')}
                className={`relative px-6 py-2.5 sm:px-7 sm:py-3 rounded-full text-sm sm:text-base font-black transition-colors duration-200 flex items-center select-none ${
                  currentHighlightedNav === 'faq'
                    ? 'text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {currentHighlightedNav === 'faq' && (
                  <motion.div
                    layoutId="navPillHighlight"
                    className="absolute inset-0 bg-emerald-600 rounded-full shadow-md shadow-emerald-600/30 z-0"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{t.nav.faq}</span>
              </Link>

              {/* 6. Contact */}
              <Link
                href={getLocalizedPath('/iletisim')}
                onMouseEnter={() => setHoveredNav('contact')}
                className={`relative px-6 py-2.5 sm:px-7 sm:py-3 rounded-full text-sm sm:text-base font-black transition-colors duration-200 flex items-center select-none ${
                  currentHighlightedNav === 'contact'
                    ? 'text-white'
                    : 'text-slate-700 hover:text-slate-900'
                }`}
              >
                {currentHighlightedNav === 'contact' && (
                  <motion.div
                    layoutId="navPillHighlight"
                    className="absolute inset-0 bg-emerald-600 rounded-full shadow-md shadow-emerald-600/30 z-0"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">{t.nav.contact}</span>
              </Link>

            </nav>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden bg-white border-t border-slate-100 shadow-xl overflow-hidden"
            >
              <div className="px-4 py-5 space-y-1 pb-safe">

                {/* User info strip */}
                {user ? (
                  <div className="flex items-center gap-3 p-3 mb-3 rounded-2xl bg-sky-50 border border-sky-100">
                    <div className="w-9 h-9 rounded-full bg-sky-600 flex items-center justify-center text-white font-black text-sm flex-shrink-0">
                      {(user.displayName || user.email || 'K')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">{user.displayName || user.email?.split('@')[0]}</p>
                      <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <Link href={getLocalizedPath('/profil')} onClick={() => setIsOpen(false)} className="ml-auto px-3 py-1.5 text-[10px] font-bold bg-sky-600 text-white rounded-xl">
                      Profil
                    </Link>
                  </div>
                ) : (
                  <Link
                    href={getLocalizedPath('/giris')}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-center gap-2 p-3 mb-3 rounded-2xl bg-gradient-to-r from-brand-blue to-brand-green text-white font-black text-sm"
                  >
                    <FiUser className="w-4 h-4" />
                    {t.nav.login}
                  </Link>
                )}

                {/* Nav links */}
                <Link
                  href={getLocalizedPath('/')}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-3 py-3 text-base font-bold text-slate-800 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  {t.nav.home}
                </Link>

                {/* Products submenu */}
                <div className="rounded-xl bg-slate-50 overflow-hidden">
                  <p className="px-3 pt-2.5 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">{t.nav.products}</p>
                  <Link
                    href={`${getLocalizedPath('/urunler')}?kategori=otomatik`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:text-sky-600 hover:bg-white transition-colors"
                  >
                    <FiZap className="w-4 h-4 text-sky-600 flex-shrink-0" />
                    {t.nav.automaticToothbrush}
                    <FiArrowRight className="w-3.5 h-3.5 ml-auto text-slate-300" />
                  </Link>
                  <Link
                    href={`${getLocalizedPath('/urunler')}?kategori=kullan-at`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-slate-700 hover:text-emerald-600 hover:bg-white transition-colors"
                  >
                    <FiFeather className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    {t.nav.disposableToothbrush}
                    <FiArrowRight className="w-3.5 h-3.5 ml-auto text-slate-300" />
                  </Link>
                  <Link
                    href={getLocalizedPath('/urunler')}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 pb-2.5 text-xs font-black text-emerald-600 hover:bg-white transition-colors"
                  >
                    {t.productsSection.viewAll} →
                  </Link>
                </div>

                <Link href={getLocalizedPath('/urunler')} onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-3 text-base font-semibold text-slate-800 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition-colors">
                  {t.nav.campaigns}
                </Link>
                <Link href={getLocalizedPath('/hakkimizda')} onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-3 text-base font-semibold text-slate-800 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition-colors">
                  {t.nav.about}
                </Link>
                <Link href={getLocalizedPath('/sss')} onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-3 text-base font-semibold text-slate-800 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition-colors">
                  {t.nav.faq}
                </Link>
                <Link href={getLocalizedPath('/iletisim')} onClick={() => setIsOpen(false)} className="flex items-center gap-3 px-3 py-3 text-base font-semibold text-slate-800 hover:text-emerald-600 hover:bg-slate-50 rounded-xl transition-colors">
                  {t.nav.contact}
                </Link>

                {/* Cart & Sepet shortcut */}
                <button
                  onClick={() => { handleOpenCart(); setIsOpen(false) }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 mt-2 rounded-2xl bg-slate-900 text-white font-black text-sm"
                >
                  <div className="flex items-center gap-2">
                    <FiShoppingBag className="w-5 h-5" />
                    <span>Sepet</span>
                  </div>
                  {cartItemCount > 0 && (
                    <span className="px-2.5 py-0.5 bg-emerald-500 text-white text-xs font-black rounded-full">
                      {cartItemCount}
                    </span>
                  )}
                </button>

                {/* Logout if logged in */}
                {user && (
                  <button
                    onClick={async () => {
                      await logoutUser()
                      setUser(null)
                      setIsOpen(false)
                      router.push(getLocalizedPath('/'))
                    }}
                    className="w-full text-center text-xs font-bold text-red-500 py-2 hover:text-red-700 transition-colors"
                  >
                    {t.nav.logout}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Global Live Search Modal */}
      <SearchModal isOpen={searchModalOpen} onClose={() => setSearchModalOpen(false)} />
    </>
  )
}
