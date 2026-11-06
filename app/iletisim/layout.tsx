import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sonrakam.com'

export const metadata: Metadata = {
  title: 'İletişim — Bize Ulaşın',
  description: 'GÜLÜMSE Dental Care ile iletişime geçin. Ürünler, sipariş, toptan satış ve her türlü soru için bize mesaj bırakın.',
  alternates: {
    canonical: `${BASE_URL}/iletisim`,
  },
  openGraph: {
    title: 'İletişim | GÜLÜMSE Dental Care',
    description: 'Ürünler, sipariş, toptan satış ve her türlü soru için bize mesaj bırakın.',
    url: `${BASE_URL}/iletisim`,
    type: 'website',
    locale: 'tr_TR',
    siteName: 'GÜLÜMSE',
  },
}

export default function IletisimLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
