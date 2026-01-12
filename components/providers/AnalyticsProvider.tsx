'use client'

import { useEffect } from 'react'
import { getFirebaseAnalytics } from '@/firebase/config'
import { usePathname } from 'next/navigation'

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    // Analytics'i initialize et
    const initAnalytics = async () => {
      try {
        await getFirebaseAnalytics()
      } catch (error) {
        console.warn('Analytics initialize edilemedi:', error)
      }
    }

    initAnalytics()
  }, [])

  useEffect(() => {
    // Sayfa değişikliklerinde page_view event'i gönder
    const logPageView = async () => {
      try {
        const analytics = await getFirebaseAnalytics()
        if (analytics) {
          // Analytics otomatik olarak Next.js route değişikliklerini takip eder
          // Manuel olarak da logEvent kullanabilirsiniz
        }
      } catch (error) {
        // Analytics mevcut değilse sessizce geç
      }
    }

    if (pathname) {
      logPageView()
    }
  }, [pathname])

  return <>{children}</>
}



