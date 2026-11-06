import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sonrakam.com'

export const metadata: Metadata = {
  title: 'İptal & İade Koşulları',
  description: 'GÜLÜMSE iptal, iade ve değişim koşulları. Satın aldığınız ürünü iade etmek veya iptal etmek için gerekli adımları öğrenin.',
  alternates: {
    canonical: `${BASE_URL}/iptal`,
  },
  openGraph: {
    title: 'İptal & İade Koşulları | GÜLÜMSE',
    description: 'Satın aldığınız ürünü iade etmek veya iptal etmek için gerekli adımları öğrenin.',
    url: `${BASE_URL}/iptal`,
    type: 'website',
    locale: 'tr_TR',
    siteName: 'GÜLÜMSE',
  },
}

export default function IptalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
