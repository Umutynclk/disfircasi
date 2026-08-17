'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import Footer from './Footer'
import SmoothScrollProvider from '@/components/animation/SmoothScrollProvider'
import CartDrawer from '@/components/cart/CartDrawer'

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
  
  if (mounted && isAdmin) {
    return <>{children}</>
  }

  return (
    <SmoothScrollProvider>
      <Navbar />
      <main className="min-h-screen relative overflow-hidden">
        {children}
      </main>
      <Footer />
      <CartDrawer />
    </SmoothScrollProvider>
  )
}

