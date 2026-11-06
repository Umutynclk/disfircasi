import type { Metadata } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sonrakam.com'

export const metadata: Metadata = {
  title: 'Tüm Diş Fırçaları & Ağız Bakımı Ürünleri',
  description: '360° sonic otomatik diş fırçaları, kullan-at hijyenik diş fırçaları ve yedek başlıklar. Klinik onaylı, premium ağız bakım ürünleri en uygun fiyatlarla.',
  keywords: ['diş fırçası', 'sonic diş fırçası', 'kullan at diş fırçası', 'ağız bakımı ürünleri', 'yedek diş fırçası başlığı'],
  alternates: {
    canonical: `${BASE_URL}/urunler`,
  },
  openGraph: {
    title: 'Tüm Diş Fırçaları & Ağız Bakımı Ürünleri | GÜLÜMSE',
    description: '360° sonic otomatik diş fırçaları, kullan-at hijyenik diş fırçaları ve yedek başlıklar.',
    url: `${BASE_URL}/urunler`,
    type: 'website',
    locale: 'tr_TR',
    siteName: 'GÜLÜMSE',
  },
}

export default function UrunlerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
