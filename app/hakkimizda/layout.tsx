import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sonrakam.com'

export const metadata: Metadata = {
  title: 'Hakkımızda — Gülümse Dental Care',
  description: 'GÜLÜMSE Dental Care hakkında bilgi edinin. Modern 360° sonic diş fırçaları ve hijyenik kullan-at serisiyle premium ağız bakımını herkes için erişilebilir kılıyoruz.',
  alternates: {
    canonical: `${BASE_URL}/hakkimizda`,
  },
  openGraph: {
    title: 'Hakkımızda | GÜLÜMSE Dental Care',
    description: 'Modern 360° sonic diş fırçaları ve hijyenik kullan-at serisiyle premium ağız bakımını herkes için erişilebilir kılıyoruz.',
    url: `${BASE_URL}/hakkimizda`,
    type: 'website',
    locale: 'tr_TR',
    siteName: 'GÜLÜMSE',
  },
}

export default function HakkimizdaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
