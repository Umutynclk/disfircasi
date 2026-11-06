import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

export type SupportedCurrency = 'TRY' | 'USD' | 'EUR' | 'GBP'

export interface CurrencyItemConfig {
  symbol: string
  rate: number // 1 TRY to Currency multiplier (e.g. 1 / 47.897)
  label: string
  code: SupportedCurrency
  sellingTRY?: number // How many TRY is 1 unit of this currency (e.g. 47.8970 for USD)
  buyingTRY?: number
}

export interface FullCurrencyConfig {
  baseCurrency: 'TRY'
  mode: 'auto' | 'manual' // 'auto' uses TCMB rates, 'manual' uses admin overrides
  source: 'TCMB' | 'MANUAL'
  rateDate: string
  bultenNo: string
  updatedAt: string
  isStale?: boolean
  rates: {
    TRY: CurrencyItemConfig
    USD: CurrencyItemConfig
    EUR: CurrencyItemConfig
    GBP: CurrencyItemConfig
  }
  // Backward compatibility mappings for locale-based references
  tr: CurrencyItemConfig
  en: CurrencyItemConfig
  de: CurrencyItemConfig
  fr: CurrencyItemConfig
  it: CurrencyItemConfig
}

// Backward compatible alias
export type CurrencyConfig = FullCurrencyConfig

export const DEFAULT_CURRENCY_CONFIG: FullCurrencyConfig = {
  baseCurrency: 'TRY',
  mode: 'auto',
  source: 'TCMB',
  rateDate: new Date().toLocaleDateString('tr-TR'),
  bultenNo: '2026/152',
  updatedAt: new Date().toISOString(),
  isStale: false,
  rates: {
    TRY: { symbol: '₺', rate: 1, sellingTRY: 1, buyingTRY: 1, label: 'Türk Lirası (₺)', code: 'TRY' },
    USD: { symbol: '$', rate: 1 / 47.897, sellingTRY: 47.897, buyingTRY: 47.8109, label: 'US Dollar ($)', code: 'USD' },
    EUR: { symbol: '€', rate: 1 / 55.545, sellingTRY: 55.545, buyingTRY: 55.4451, label: 'Euro (€)', code: 'EUR' },
    GBP: { symbol: '£', rate: 1 / 64.46, sellingTRY: 64.46, buyingTRY: 64.125, label: 'British Pound (£)', code: 'GBP' },
  },
  tr: { symbol: '₺', rate: 1, label: 'Türk Lirası (₺)', code: 'TRY' },
  en: { symbol: '$', rate: 1 / 47.897, label: 'US Dollar ($)', code: 'USD' },
  de: { symbol: '€', rate: 1 / 55.545, label: 'Euro (€)', code: 'EUR' },
  fr: { symbol: '€', rate: 1 / 55.545, label: 'Euro (€)', code: 'EUR' },
  it: { symbol: '€', rate: 1 / 55.545, label: 'Euro (€)', code: 'EUR' },
}

export const subscribeToCurrencyConfig = (
  callback: (config: FullCurrencyConfig) => void
): Unsubscribe => {
  try {
    const db = getFirestoreDB()
    const ref = doc(db, 'settings', 'currency')

    return onSnapshot(
      ref,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Partial<FullCurrencyConfig>
          const rates = {
            TRY: { ...DEFAULT_CURRENCY_CONFIG.rates.TRY, ...data.rates?.TRY },
            USD: { ...DEFAULT_CURRENCY_CONFIG.rates.USD, ...data.rates?.USD },
            EUR: { ...DEFAULT_CURRENCY_CONFIG.rates.EUR, ...data.rates?.EUR },
            GBP: { ...DEFAULT_CURRENCY_CONFIG.rates.GBP, ...data.rates?.GBP },
          }

          callback({
            baseCurrency: 'TRY',
            mode: data.mode || 'auto',
            source: data.source || 'TCMB',
            rateDate: data.rateDate || DEFAULT_CURRENCY_CONFIG.rateDate,
            bultenNo: data.bultenNo || DEFAULT_CURRENCY_CONFIG.bultenNo,
            updatedAt: data.updatedAt || new Date().toISOString(),
            isStale: data.isStale || false,
            rates,
            tr: rates.TRY,
            en: rates.USD,
            de: rates.EUR,
            fr: rates.EUR,
            it: rates.EUR,
          })
        } else {
          callback(DEFAULT_CURRENCY_CONFIG)
        }
      },
      (error) => {
        console.error('Currency realtime subscription error:', error)
        callback(DEFAULT_CURRENCY_CONFIG)
      }
    )
  } catch (err) {
    console.error('Currency Firestore error:', err)
    callback(DEFAULT_CURRENCY_CONFIG)
    return () => {}
  }
}

export const saveCurrencyConfig = async (config: Partial<FullCurrencyConfig>): Promise<void> => {
  const db = getFirestoreDB()
  const ref = doc(db, 'settings', 'currency')
  await setDoc(
    ref,
    {
      ...config,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  )
}
