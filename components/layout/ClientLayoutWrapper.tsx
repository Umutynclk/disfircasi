'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import Footer from './Footer'

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [mounted, setMounted] = useState(false)
  
  useEffect(() => {
    setMounted(true)
    if (pathname?.startsWith('/admin')) {
      setIsAdmin(true)
    } else {
      setIsAdmin(false)
    }
  }, [pathname])
  
  // Admin sayfalarında Navbar ve Footer gösterme (sadece client-side'da)
  // İlk render'da her zaman normal layout'u göster (hydration uyumu için)
  // mounted kontrolü hydration hatasını önler
  if (mounted && isAdmin) {
    return <>{children}</>
  }

  // Normal sayfalar için Navbar ve Footer göster
  // İlk render'da da bu yapıyı göster (hydration uyumu için)
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {children}
      </main>
      <Footer />
    </>
  )
}

