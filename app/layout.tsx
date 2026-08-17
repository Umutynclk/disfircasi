import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper'
import AnalyticsProvider from '@/components/providers/AnalyticsProvider'
import CookieProvider from '@/components/providers/CookieProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'GÜLÜMSE | 360° Sonic Diş Fırçası & Ağız Bakımı',
    template: '%s | GÜLÜMSE Dental Care',
  },
  description: 'Yeni nesil 360° sonic otomatik diş fırçaları ve kullan-at hijyenik diş fırçalarıyla gülüşünüzü parlatın. Klinik onaylı, 2 yıl garantili premium ağız bakım ürünleri.',
  keywords: ['diş fırçası', 'sonic diş fırçası', 'otomatik diş fırçası', 'kullan at diş fırçası', 'ağız bakımı', 'dental care', 'gülümse'],
  authors: [{ name: 'GÜLÜMSE Dental Care' }],
  openGraph: {
    title: 'GÜLÜMSE | 360° Sonic Diş Fırçası & Ağız Bakımı',
    description: 'Yeni nesil sonic otomatik diş fırçaları ve kullan-at hijyenik ürünlerle premium ağız bakımı.',
    type: 'website',
    locale: 'tr_TR',
    siteName: 'GÜLÜMSE',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className={inter.className}>
        <CookieProvider>
          <AnalyticsProvider>
            <ClientLayoutWrapper>
              {children}
            </ClientLayoutWrapper>
          </AnalyticsProvider>
        </CookieProvider>
      </body>
    </html>
  )
}

