'use client'

import { useEffect } from 'react'
import { setCookie, getCookie } from '@/lib/utils/cookies'

export default function CookieProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // İlk ziyarette cookie kontrolü
    const visitCount = getCookie('visitCount')
    if (!visitCount) {
      setCookie('visitCount', '1', 365)
    } else {
      const count = parseInt(visitCount) + 1
      setCookie('visitCount', count.toString(), 365)
    }
    
    // Son ziyaret zamanı
    setCookie('lastVisit', new Date().toISOString(), 365)
    
    // Session ID (her oturum için)
    const sessionId = getCookie('sessionId')
    if (!sessionId) {
      const newSessionId = `${Date.now()}_${Math.random().toString(36).substring(7)}`
      setCookie('sessionId', newSessionId, 1) // 1 gün
    }
  }, [])

  return <>{children}</>
}


