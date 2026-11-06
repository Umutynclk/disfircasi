import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sonrakam.com'

export const metadata: Metadata = {
  title: 'Kargo & Teslimat Bilgileri',
  description: 'GÜLÜMSE kargo süreleri, teslimat koşulları, ücretsiz kargo limiti ve kargo takip bilgileri. Siparişinizin ne zaman elinize ulaşacağını öğrenin.',
  alternates: {
    canonical: `${BASE_URL}/kargo`,
  },
  openGraph: {
    title: 'Kargo & Teslimat | GÜLÜMSE',
    description: 'Kargo süreleri, teslimat koşulları ve ücretsiz kargo limiti hakkında bilgi alın.',
    url: `${BASE_URL}/kargo`,
    type: 'website',
    locale: 'tr_TR',
    siteName: 'GÜLÜMSE',
  },
}

export default function KargoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
