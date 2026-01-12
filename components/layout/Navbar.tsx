'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import { FiMenu, FiX, FiShoppingCart, FiChevronDown, FiUser } from 'react-icons/fi'
import { getCurrentUser, logoutUser, onUserAuthStateChanged } from '@/lib/firebase/userAuth'

interface SiteSettings {
  siteName?: string
  siteDescription?: string
}


export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [siteName, setSiteName] = useState('SmileBrush')
  const [productsMenuOpen, setProductsMenuOpen] = useState(false)
  const [mobileProductsMenuOpen, setMobileProductsMenuOpen] = useState(false)
  const [productsMenuContent, setProductsMenuContent] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Kullanıcı durumunu dinle
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
      
      // Real-time listener - Firebase değişikliklerini dinle
      const unsubscribe = onSnapshot(
        settingsRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as SiteSettings
            if (data.siteName) {
              setSiteName(data.siteName)
            }
          }
        },
        (error) => {
          console.error('❌ Navbar settings error:', error)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Navbar initialization error:', error)
    }
  }, [])

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const productsMenuRef = doc(db, 'siteContent', 'productsMenu')
      
      const unsubscribe = onSnapshot(
        productsMenuRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data()
            setProductsMenuContent(data)
            console.log('✅ Products menu loaded from Firebase:', data)
          } else {
            console.warn('⚠️ Products menu not found in Firebase')
            setProductsMenuContent(null)
          }
        },
        (error) => {
          console.error('❌ Products menu snapshot error:', error)
        }
      )
      
      return () => unsubscribe()
    } catch (error) {
      console.error('❌ Products menu initialization error:', error)
    }
  }, [])

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-white/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}
    >
      <div className="container-custom section-padding">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-2xl font-bold bg-gradient-to-r from-primary-600 to-primary-400 bg-clip-text text-transparent"
            >
              {siteName}
            </motion.div>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-gray-700 hover:text-primary-600 transition-colors">
              Ana Sayfa
            </Link>
            {/* Products Dropdown Menu */}
            {productsMenuContent ? (
              <div 
                className="relative"
                onMouseEnter={() => setProductsMenuOpen(true)}
                onMouseLeave={() => setProductsMenuOpen(false)}
              >
                <button className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all duration-200 ${
                  productsMenuOpen 
                    ? 'text-primary-600 bg-primary-50' 
                    : 'text-gray-700 hover:text-primary-600 hover:bg-gray-50'
                }`}>
                  <span className="font-medium">Ürünler</span>
                  <FiChevronDown className={`w-4 h-4 transition-transform duration-200 ${productsMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                
                <AnimatePresence>
                  {productsMenuOpen && (
                    <>
                      {/* Backdrop */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 z-40 -top-20 left-0 right-0 bottom-0"
                        onClick={() => setProductsMenuOpen(false)}
                      />
                      
                      {/* Dropdown Content */}
                      <motion.div
                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 15, scale: 0.95 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="absolute top-full left-0 mt-3 w-[600px] max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
                      >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-primary-50 via-primary-100 to-primary-50 px-6 py-4 border-b border-primary-100">
                          <h2 className="text-lg font-bold text-gray-900">Ürünlerimiz</h2>
                          <p className="text-sm text-gray-600 mt-1">Kategorilerimize göz atın</p>
                        </div>
                        
                        {/* Menu Items */}
                        <div className="p-6 space-y-4">
                          {productsMenuContent.sections && productsMenuContent.sections.map((section: any, index: number) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="border-2 border-gray-100 rounded-xl p-5 hover:border-primary-200 hover:shadow-md transition-all duration-200 bg-gradient-to-br from-gray-50 to-white"
                            >
                              <h3 className="font-bold text-gray-900 text-lg mb-2">{section.title}</h3>
                              {section.description && (
                                <p className="text-sm text-gray-600 mb-4">{section.description}</p>
                              )}
                              <Link
                                href={section.url || '/urunler'}
                                onClick={() => setProductsMenuOpen(false)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-all duration-200 hover:scale-105 shadow-md hover:shadow-lg"
                              >
                                {section.buttonText || 'Keşfet'}
                                <FiChevronDown className="w-4 h-4 rotate-[-90deg]" />
                              </Link>
                            </motion.div>
                          ))}
                          
                          {(!productsMenuContent.sections || productsMenuContent.sections.length === 0) && (
                            <Link
                              href="/urunler"
                              onClick={() => setProductsMenuOpen(false)}
                              className="block w-full px-5 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors text-center"
                            >
                              Tüm Ürünleri Görüntüle
                            </Link>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <Link href="/urunler" className="text-gray-700 hover:text-primary-600 transition-colors">
                Ürünler
              </Link>
            )}
            
            <Link href="/hakkimizda" className="text-gray-700 hover:text-primary-600 transition-colors">
              Hakkımızda
            </Link>
            <Link href="/iletisim" className="text-gray-700 hover:text-primary-600 transition-colors">
              İletişim
            </Link>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  // Sepet modalını aç (basit bir alert şimdilik)
                  alert('Sepet özelliği yakında eklenecek!')
                }}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors relative"
              >
                <FiShoppingCart className="w-5 h-5" />
                {/* Sepet sayısı badge'i (opsiyonel) */}
                {/* <span className="absolute top-0 right-0 w-4 h-4 bg-primary-600 text-white text-xs rounded-full flex items-center justify-center">0</span> */}
              </button>
              
              {/* Kullanıcı Menüsü */}
              <div className="relative">
                {user ? (
                  <div className="relative">
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                      <FiUser className="w-5 h-5" />
                      <span className="text-sm font-medium text-gray-700 hidden lg:block">
                        {user.email?.split('@')[0] || 'Kullanıcı'}
                      </span>
                    </button>
                    <AnimatePresence>
                      {userMenuOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50"
                        >
                          <Link
                            href="/profil"
                            onClick={() => setUserMenuOpen(false)}
                            className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            Profilim
                          </Link>
                          <button
                            onClick={async () => {
                              await logoutUser()
                              setUser(null)
                              setUserMenuOpen(false)
                              window.location.href = '/'
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
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
                    className="p-2 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2"
                  >
                    <FiUser className="w-5 h-5" />
                    <span className="text-sm font-medium text-gray-700 hidden lg:block">Giriş Yap</span>
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isOpen ? <FiX className="w-6 h-6" /> : <FiMenu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-t"
          >
            <div className="container-custom section-padding py-4 space-y-4">
              <Link href="/" className="block py-2 text-gray-700 hover:text-primary-600" onClick={() => setIsOpen(false)}>
                Ana Sayfa
              </Link>
              {/* Mobile Products Menu */}
              {productsMenuContent ? (
                <div className="space-y-2">
                  <button
                    onClick={() => setMobileProductsMenuOpen(!mobileProductsMenuOpen)}
                    className="w-full flex items-center justify-between py-3 px-4 bg-gradient-to-r from-primary-50 to-transparent rounded-lg hover:from-primary-100 transition-all duration-200"
                  >
                    <span className="font-semibold text-gray-900">Ürünler</span>
                    <FiChevronDown className={`w-5 h-5 text-primary-600 transition-transform duration-200 ${mobileProductsMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {mobileProductsMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="ml-4 space-y-3 border-l-2 border-primary-200 pl-4"
                    >
                      {productsMenuContent.sections && productsMenuContent.sections.map((section: any, index: number) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <h3 className="font-bold text-gray-900 mb-2">{section.title}</h3>
                          {section.description && (
                            <p className="text-sm text-gray-600 mb-3">{section.description}</p>
                          )}
                          <Link
                            href={section.url || '/urunler'}
                            onClick={() => {
                              setIsOpen(false)
                              setMobileProductsMenuOpen(false)
                            }}
                            className="block w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors text-center text-sm"
                          >
                            {section.buttonText || 'Keşfet'}
                          </Link>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>
              ) : (
                <Link href="/urunler" className="block py-2 text-gray-700 hover:text-primary-600" onClick={() => setIsOpen(false)}>
                  Ürünler
                </Link>
              )}
              
              <Link href="/hakkimizda" className="block py-2 text-gray-700 hover:text-primary-600" onClick={() => setIsOpen(false)}>
                Hakkımızda
              </Link>
              <Link href="/iletisim" className="block py-2 text-gray-700 hover:text-primary-600" onClick={() => setIsOpen(false)}>
                İletişim
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}


