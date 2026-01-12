import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ClientLayoutWrapper from '@/components/layout/ClientLayoutWrapper'
import AnalyticsProvider from '@/components/providers/AnalyticsProvider'
import CookieProvider from '@/components/providers/CookieProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Elektrikli Diş Fırçası | Premium Bakım',
  description: 'Modern elektrikli diş fırçası çözümleri ile gülüşünüzü parlatın',
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

