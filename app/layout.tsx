import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { LocaleProvider } from '@/context/LocaleContext'
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper'
import AnalyticsProvider from '@/components/providers/AnalyticsProvider'
import CookieProvider from '@/components/providers/CookieProvider'
import SessionTracker from '@/components/common/SessionTracker'

const inter = Inter({ subsets: ['latin'] })

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://sonrakam.com'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#0284c7',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'GÜLÜMSE | 360° Sonic Diş Fırçası & Ağız Bakımı',
    template: '%s | GÜLÜMSE Dental Care',
  },
  description: 'Yeni nesil 360° sonic otomatik diş fırçaları ve kullan-at hijyenik diş fırçalarıyla gülüşünüzü parlatın. Klinik onaylı, 2 yıl garantili premium ağız bakım ürünleri.',
  keywords: ['diş fırçası', 'sonic diş fırçası', 'otomatik diş fırçası', 'kullan at diş fırçası', 'ağız bakımı', 'dental care', 'gülümse'],
  authors: [{ name: 'GÜLÜMSE Dental Care' }],
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: 'GÜLÜMSE | 360° Sonic Diş Fırçası & Ağız Bakımı',
    description: 'Yeni nesil sonic otomatik diş fırçaları ve kullan-at hijyenik ürünlerle premium ağız bakımı.',
    url: BASE_URL,
    type: 'website',
    locale: 'tr_TR',
    siteName: 'GÜLÜMSE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GÜLÜMSE | 360° Sonic Diş Fırçası & Ağız Bakımı',
    description: 'Yeni nesil sonic otomatik diş fırçaları ve kullan-at hijyenik ürünlerle premium ağız bakımı.',
    site: '@gulumse',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'GÜLÜMSE Dental Care',
    legalName: 'Kalıport Alüminyum Plastik Kalıp İmalat San. Tic. Ltd. Şti.',
    url: BASE_URL,
    logo: `${BASE_URL}/logo.png`,
    sameAs: [
      'https://instagram.com/gulumse',
    ],
  }

  const websiteJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'GÜLÜMSE',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/urunler?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <LocaleProvider>
          <SessionTracker />
          <CookieProvider>
            <AnalyticsProvider>
              <ClientLayoutWrapper>
                {children}
              </ClientLayoutWrapper>
            </AnalyticsProvider>
          </CookieProvider>
        </LocaleProvider>
      </body>
    </html>
  )
}
