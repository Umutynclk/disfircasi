import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sonrakam.com'

export const metadata: Metadata = {
  title: 'Sıkça Sorulan Sorular (SSS)',
  description: 'Diş fırçaları, sipariş, kargo, iade ve garantiye dair en çok sorulan sorular ve cevapları. GÜLÜMSE SSS sayfasını ziyaret edin.',
  alternates: {
    canonical: `${BASE_URL}/sss`,
  },
  openGraph: {
    title: 'SSS — Sıkça Sorulan Sorular | GÜLÜMSE',
    description: 'Diş fırçaları, sipariş, kargo, iade ve garantiye dair en çok sorulan sorular ve cevapları.',
    url: `${BASE_URL}/sss`,
    type: 'website',
    locale: 'tr_TR',
    siteName: 'GÜLÜMSE',
  },
}

export default function SssLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
