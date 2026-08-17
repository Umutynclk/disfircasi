'use client'

import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function RedirectContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const query = searchParams.toString()
    router.replace(`/satin-al${query ? `?${query}` : ''}`)
  }, [router, searchParams])

  return (
    <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-blue"></div>
    </div>
  )
}

export default function SatinAlRedirectPage() {
  return (
    <Suspense fallback={
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-brand-blue"></div>
      </div>
    }>
      <RedirectContent />
    </Suspense>
  )
}
