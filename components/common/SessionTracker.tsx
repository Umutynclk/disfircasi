'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { recordActivity, checkSessionValidity, clearSessionData } from '@/lib/services/sessionManager'
import { logoutUser, onUserAuthStateChanged } from '@/lib/firebase/userAuth'
import { logoutAdmin } from '@/lib/firebase/auth'

export default function SessionTracker() {
  const router = useRouter()
  const pathname = usePathname()
  const isLoggedInRef = useRef(false)
  const userEmailRef = useRef<string | null>(null)

  // Firebase auth durumunu dinle (Doğrulanmış Firebase Authentication hesabı)
  useEffect(() => {
    const unsub = onUserAuthStateChanged((user) => {
      isLoggedInRef.current = !!user
      userEmailRef.current = user?.email ? user.email.trim().toLowerCase() : null
    })
    return () => unsub()
  }, [])

  useEffect(() => {
    // 1. Kullanıcı etkileşimlerini dinle ve aktivite zamanını güncelle
    const handleUserInteraction = () => {
      if (isLoggedInRef.current) {
        recordActivity(userEmailRef.current)
      }
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((ev) => window.addEventListener(ev, handleUserInteraction, { passive: true }))

    // 2. Her 15 saniyede bir oturum geçerliliğini kontrol et
    // admin@gmail.com hesabı için 15 dakikalık hareketsizlik sınırı uygulanmaz
    const interval = setInterval(async () => {
      if (!isLoggedInRef.current) return

      const validity = checkSessionValidity(userEmailRef.current)
      if (!validity.valid) {
        const isAdminRoute = pathname?.startsWith('/admin')
        clearSessionData()

        try {
          if (isAdminRoute) {
            await logoutAdmin()
            router.push('/admin/login?error=session_expired&reason=' + (validity.reason || 'inactive'))
          } else {
            await logoutUser()
            router.push('/giris?error=session_expired&reason=' + (validity.reason || 'inactive'))
          }
        } catch (err) {
          console.warn('Otomatik oturum sonlandırma uyarısı:', err)
        }
      }
    }, 15000)

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handleUserInteraction))
      clearInterval(interval)
    }
  }, [pathname, router])

  return null
}
