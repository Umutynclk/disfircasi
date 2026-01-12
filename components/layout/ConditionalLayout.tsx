'use client'

import { usePathname } from 'next/navigation'
import Navbar from './Navbar'
import Footer from './Footer'

export default function ClientLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  
  // Admin sayfalarında Navbar ve Footer gösterme
  if (pathname?.startsWith('/admin')) {
    return <>{children}</>
  }

  // Normal sayfalar için Navbar ve Footer göster
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

