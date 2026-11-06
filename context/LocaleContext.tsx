'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { SupportedLocale, getDictionary, Dictionary } from '@/lib/i18n/dictionaries'
import {
  FullCurrencyConfig,
  DEFAULT_CURRENCY_CONFIG,
  subscribeToCurrencyConfig,
  SupportedCurrency,
  saveCurrencyConfig,
} from '@/lib/firebase/currency'
import { formatMoney, formatPrice } from '@/lib/utils/format'

export type LocalizedField = string | { tr?: string; en?: string; de?: string; fr?: string; it?: string }

// Map paths between languages
const PATH_MAP: Record<string, Record<SupportedLocale, string>> = {
  '/': { tr: '/', en: '/en', de: '/de', fr: '/fr', it: '/it' },
  '/urunler': { tr: '/tr/urunler', en: '/en/products', de: '/de/produkte', fr: '/fr/produits', it: '/it/prodotti' },
  '/hakkimizda': { tr: '/tr/hakkimizda', en: '/en/about', de: '/de/uber-uns', fr: '/fr/a-propos', it: '/it/chi-siamo' },
  '/sss': { tr: '/tr/sss', en: '/en/faq', de: '/de/faq', fr: '/fr/faq', it: '/it/faq' },
  '/iletisim': { tr: '/tr/iletisim', en: '/en/contact', de: '/de/kontakt', fr: '/fr/contact', it: '/it/contatti' },
  '/sepet': { tr: '/tr/sepet', en: '/en/cart', de: '/de/warenkorb', fr: '/fr/panier', it: '/it/carrello' },
  '/satin-al': { tr: '/tr/satin-al', en: '/en/checkout', de: '/de/kasse', fr: '/fr/commander', it: '/it/cassa' },
  '/profil': { tr: '/tr/profil', en: '/en/profile', de: '/de/profil', fr: '/fr/profil', it: '/it/profil' },
  '/giris': { tr: '/tr/giris', en: '/en/login', de: '/de/anmelden', fr: '/fr/se-connecter', it: '/it/accedi' },
  '/kayit': { tr: '/tr/kayit', en: '/en/register', de: '/de/registrieren', fr: '/fr/creer-un-compte', it: '/it/registrati' },
  '/kargo': { tr: '/tr/kargo', en: '/en/shipping', de: '/de/versand', fr: '/fr/livraison', it: '/it/spedizione' },
  '/iptal': { tr: '/tr/iptal', en: '/en/returns', de: '/de/widerruf', fr: '/fr/annulation', it: '/it/recesso' },
}

interface LocaleContextType {
  locale: SupportedLocale
  setLocale: (locale: SupportedLocale) => void
  currency: SupportedCurrency
  setCurrency: (currency: SupportedCurrency) => void
  t: Dictionary
  getLocalizedText: (field?: LocalizedField | null, fallback?: string) => string
  getLocalizedPath: (basePath: string) => string
  currencyConfig: FullCurrencyConfig
  formatPriceWithCurrency: (price?: number | string | null, customUSD?: number | string | null, customEUR?: number | string | null) => string
  getConvertedNumericPrice: (priceTRY?: number | string | null) => number
  rateDate: string
  isAutoTCMB: boolean
}

const LocaleContext = createContext<LocaleContextType | undefined>(undefined)

// Default currency per locale
const LOCALE_TO_CURRENCY: Record<SupportedLocale, SupportedCurrency> = {
  tr: 'TRY',
  en: 'USD',
  de: 'EUR',
  fr: 'EUR',
  it: 'EUR',
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [locale, setLocaleState] = useState<SupportedLocale>('tr')
  const [currency, setCurrencyState] = useState<SupportedCurrency>('TRY')
  const [currencyConfig, setCurrencyConfig] = useState<FullCurrencyConfig>(DEFAULT_CURRENCY_CONFIG)
  const [isManualCurrency, setIsManualCurrency] = useState(false)

  // 1. Detect locale from URL path or local storage
  useEffect(() => {
    if (pathname) {
      const seg = pathname.split('/')[1]?.toLowerCase()
      if (seg === 'tr' || seg === 'en' || seg === 'de' || seg === 'fr' || seg === 'it') {
        setLocaleState(seg as SupportedLocale)
        return
      }
    }
    const saved = localStorage.getItem('gulumse_locale') as SupportedLocale
    if (saved && (saved === 'tr' || saved === 'en' || saved === 'de' || saved === 'fr' || saved === 'it')) {
      setLocaleState(saved)
    }
  }, [pathname])

  // 2. Restore or synchronize currency
  useEffect(() => {
    const savedCurrency = localStorage.getItem('gulumse_currency') as SupportedCurrency
    if (savedCurrency && (savedCurrency === 'TRY' || savedCurrency === 'USD' || savedCurrency === 'EUR' || savedCurrency === 'GBP')) {
      setCurrencyState(savedCurrency)
      setIsManualCurrency(true)
    } else {
      // Set default currency according to locale
      setCurrencyState(LOCALE_TO_CURRENCY[locale] || 'TRY')
    }
  }, [locale])

  // 3. Realtime subscription to Firebase Currency Settings
  useEffect(() => {
    const unsub = subscribeToCurrencyConfig((newConfig) => {
      setCurrencyConfig(newConfig)
    })
    return () => unsub()
  }, [])

  // 4. Background check & sync with TCMB API on client start
  useEffect(() => {
    const syncTCMB = async () => {
      try {
        const res = await fetch('/api/currency-rates')
        if (res.ok) {
          const json = await res.json()
          if (json.success && json.data) {
            const tcmb = json.data
            // If mode is 'auto', update Firebase with latest TCMB rates
            if (currencyConfig.mode !== 'manual') {
              const rates = {
                TRY: { symbol: '₺', rate: 1, sellingTRY: 1, buyingTRY: 1, label: 'Türk Lirası (₺)', code: 'TRY' as SupportedCurrency },
                USD: { symbol: '$', rate: tcmb.rates.USD.rate, sellingTRY: tcmb.rates.USD.selling, buyingTRY: tcmb.rates.USD.buying, label: 'US Dollar ($)', code: 'USD' as SupportedCurrency },
                EUR: { symbol: '€', rate: tcmb.rates.EUR.rate, sellingTRY: tcmb.rates.EUR.selling, buyingTRY: tcmb.rates.EUR.buying, label: 'Euro (€)', code: 'EUR' as SupportedCurrency },
                GBP: { symbol: '£', rate: tcmb.rates.GBP.rate, sellingTRY: tcmb.rates.GBP.selling, buyingTRY: tcmb.rates.GBP.buying, label: 'British Pound (£)', code: 'GBP' as SupportedCurrency },
              }

              setCurrencyConfig((prev) => ({
                ...prev,
                rateDate: tcmb.date,
                bultenNo: tcmb.bultenNo,
                source: 'TCMB',
                isStale: tcmb.isStale,
                rates,
              }))
            }
          }
        }
      } catch (err) {
        console.warn('TCMB background sync warning:', err)
      }
    }

    syncTCMB()
  }, [])

  const setLocale = (newLocale: SupportedLocale) => {
    setLocaleState(newLocale)
    localStorage.setItem('gulumse_locale', newLocale)

    // If user hasn't explicitly locked a custom currency, auto-adjust currency with locale
    if (!isManualCurrency) {
      const targetCurr = LOCALE_TO_CURRENCY[newLocale] || 'TRY'
      setCurrencyState(targetCurr)
    }

    // Switch URL to target language
    if (pathname) {
      const segs = pathname.split('/').filter(Boolean)
      const first = segs[0]?.toLowerCase()

      if (first === 'tr' || first === 'en' || first === 'de' || first === 'fr' || first === 'it') {
        const sub = segs.slice(1).join('/')
        const normalizedSub = `/${sub.split('?')[0]}`
        
        let targetSub = normalizedSub
        for (const [key, mapping] of Object.entries(PATH_MAP)) {
          if (mapping[first as SupportedLocale] === pathname.split('?')[0]) {
            targetSub = mapping[newLocale]
            break
          }
        }

        if (targetSub.startsWith('/')) {
          window.location.href = targetSub
          return
        }
      }
      
      const newPath = getLocalizedPath(pathname)
      if (newPath !== pathname) {
        window.location.href = newPath
      }
    }
  }

  const setCurrency = (newCurrency: SupportedCurrency) => {
    setCurrencyState(newCurrency)
    setIsManualCurrency(true)
    localStorage.setItem('gulumse_currency', newCurrency)
    window.dispatchEvent(new CustomEvent('currencyUpdated', { detail: newCurrency }))
  }

  const t = getDictionary(locale)

  const getLocalizedText = (field?: LocalizedField | null, fallback = ''): string => {
    if (!field) return fallback
    if (typeof field === 'string') return field
    return field[locale] || field.tr || field.en || fallback
  }

  const getLocalizedPath = (basePath: string): string => {
    const cleanPath = basePath.split('?')[0]
    const query = basePath.includes('?') ? `?${basePath.split('?')[1]}` : ''

    if (PATH_MAP[cleanPath] && PATH_MAP[cleanPath][locale]) {
      return `${PATH_MAP[cleanPath][locale]}${query}`
    }

    if (locale === 'tr') return basePath
    return `/${locale}${basePath.startsWith('/') ? basePath : `/${basePath}`}`
  }

  /**
   * Convert base TRY price to active currency number
   */
  const getConvertedNumericPrice = (priceTRY?: number | string | null): number => {
    if (priceTRY === null || priceTRY === undefined || priceTRY === '') return 0
    const baseTRY = Number(priceTRY)
    if (isNaN(baseTRY) || baseTRY <= 0) return 0

    if (currency === 'TRY') return baseTRY

    const activeRate = currencyConfig.rates[currency]
    if (!activeRate) return baseTRY

    // If rate multiplier exists (1 / sellingPrice)
    // Example: 1000 TRY / 47.8970 = 20.878 USD
    if (activeRate.sellingTRY && activeRate.sellingTRY > 0) {
      return Math.round((baseTRY / activeRate.sellingTRY) * 100) / 100
    }

    if (activeRate.rate && activeRate.rate > 0) {
      return Math.round(baseTRY * activeRate.rate * 100) / 100
    }

    return baseTRY
  }

  /**
   * Format price in active currency with TCMB rates and Intl.NumberFormat
   */
  const formatPriceWithCurrency = (
    price?: number | string | null,
    customUSD?: number | string | null,
    customEUR?: number | string | null
  ): string => {
    // 1. If USD and manual custom product price exists
    if (currency === 'USD' && customUSD !== undefined && customUSD !== null && customUSD !== '') {
      const usdNum = Number(customUSD)
      if (!isNaN(usdNum) && usdNum > 0) {
        return formatMoney(usdNum, 'USD', 'en-US')
      }
    }

    // 2. If EUR and manual custom product price exists
    if (currency === 'EUR' && customEUR !== undefined && customEUR !== null && customEUR !== '') {
      const eurNum = Number(customEUR)
      if (!isNaN(eurNum) && eurNum > 0) {
        return formatMoney(eurNum, 'EUR', 'de-DE')
      }
    }

    // 3. Official TCMB exchange rate conversion from base TRY price
    if (price === null || price === undefined || price === '') {
      return formatMoney(0, currency)
    }

    const baseTRY = Number(price)
    if (isNaN(baseTRY) || baseTRY <= 0) {
      return formatMoney(0, currency)
    }

    if (currency === 'TRY') {
      return formatMoney(baseTRY, 'TRY', 'tr-TR')
    }

    const converted = getConvertedNumericPrice(baseTRY)
    const localeMap = {
      TRY: 'tr-TR',
      USD: 'en-US',
      EUR: 'de-DE',
      GBP: 'en-GB',
    }

    return formatMoney(converted, currency, localeMap[currency])
  }

  return (
    <LocaleContext.Provider
      value={{
        locale,
        setLocale,
        currency,
        setCurrency,
        t,
        getLocalizedText,
        getLocalizedPath,
        currencyConfig,
        formatPriceWithCurrency,
        getConvertedNumericPrice,
        rateDate: currencyConfig.rateDate,
        isAutoTCMB: currencyConfig.mode !== 'manual',
      }}
    >
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error('useLocale must be used within a LocaleProvider')
  }
  return context
}
