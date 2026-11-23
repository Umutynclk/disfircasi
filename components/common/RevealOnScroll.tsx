'use client'

import React, { useEffect, useRef, useState } from 'react'

interface RevealOnScrollProps {
  children: React.ReactNode
  className?: string
  delayMs?: number
  yOffset?: number
}

/**
 * Hafif, IntersectionObserver tabanlı aşağıdan yukarı görünme bileşeni.
 * - İçeriği DOM'dan gizlemez (SSR / SEO dostu).
 * - prefers-reduced-motion: reduce tercihine saygı gösterir.
 * - Yalnızca GPU-hızlandırmalı transform ve opacity kullanır.
 */
export default function RevealOnScroll({
  children,
  className = '',
  delayMs = 0,
  yOffset = 14,
}: RevealOnScrollProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches) {
      setReducedMotion(true)
      setVisible(true)
      return
    }

    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        }
      },
      { rootMargin: '0px 0px -40px 0px', threshold: 0.05 }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  if (reducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0.01,
        transform: visible ? 'translate3d(0, 0, 0)' : `translate3d(0, ${yOffset}px, 0)`,
        transition: `opacity 450ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms, transform 450ms cubic-bezier(0.22, 1, 0.36, 1) ${delayMs}ms`,
        willChange: visible ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  )
}
