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
    // KRİTİK GÜVENLİK AYRIMI: 15 dakikalık katı hareketsizlik kuralı YALNIZCA /admin rotalarındaki yöneticiler için geçerlidir.
    // Normal e-ticaret müşterileri sepet, satın alma veya gezinme sırasında 15 dakikada atılmaz.
    // Müşterinin oturumu Firebase Authentication yerel kalıcılığı (browserLocalPersistence) ile korunur.
    const interval = setInterval(async () => {
      if (!isLoggedInRef.current) return

      const isAdminRoute = pathname?.startsWith('/admin')
      if (!isAdminRoute) {
        // Normal müşteri için 15 dakikalık zorla çıkış YAPILMAZ.
        return
      }

      const validity = checkSessionValidity(userEmailRef.current)
      if (!validity.valid) {
        clearSessionData()

        try {
          await logoutAdmin()
          router.push('/admin/login?error=session_expired&reason=' + (validity.reason || 'inactive'))
        } catch (err) {
          console.warn('Otomatik admin oturum sonlandırma uyarısı:', err)
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
