/**
 * TCMB (Türkiye Cumhuriyet Merkez Bankası) Official XML Currency Service
 * Direct fetch & parser for: https://www.tcmb.gov.tr/kurlar/today.xml
 */

export interface TCMBRateItem {
  code: 'TRY' | 'USD' | 'EUR' | 'GBP'
  symbol: string
  name: string
  buying: number // ForexBuying (Döviz Alış)
  selling: number // ForexSelling (Döviz Satış - Standard display rate)
  banknoteBuying?: number // BanknoteBuying (Efektif Alış)
  banknoteSelling?: number // BanknoteSelling (Efektif Satış)
  rate: number // 1 TRY to Currency multiplier (1 / selling)
  label: string
}

export interface TCMBData {
  source: 'TCMB'
  date: string // e.g. "17.08.2026"
  bultenNo: string // e.g. "2026/152"
  updatedAt: string
  isStale: boolean
  rates: {
    TRY: TCMBRateItem
    USD: TCMBRateItem
    EUR: TCMBRateItem
    GBP: TCMBRateItem
  }
}

// Fallback rates if TCMB is unreachable
export const FALLBACK_TCMB_DATA: TCMBData = {
  source: 'TCMB',
  date: new Date().toLocaleDateString('tr-TR'),
  bultenNo: 'MANUAL',
  updatedAt: new Date().toISOString(),
  isStale: true,
  rates: {
    TRY: {
      code: 'TRY',
      symbol: '₺',
      name: 'TÜRK LİRASI',
      buying: 1,
      selling: 1,
      banknoteBuying: 1,
      banknoteSelling: 1,
      rate: 1,
      label: 'Türk Lirası (₺)',
    },
    USD: {
      code: 'USD',
      symbol: '$',
      name: 'ABD DOLARI',
      buying: 47.8109,
      selling: 47.897,
      banknoteBuying: 47.7774,
      banknoteSelling: 47.9688,
      rate: 1 / 47.897,
      label: 'US Dollar ($)',
    },
    EUR: {
      code: 'EUR',
      symbol: '€',
      name: 'EURO',
      buying: 55.4451,
      selling: 55.545,
      banknoteBuying: 55.4063,
      banknoteSelling: 55.6284,
      rate: 1 / 55.545,
      label: 'Euro (€)',
    },
    GBP: {
      code: 'GBP',
      symbol: '£',
      name: 'İNGİLİZ STERLİNİ',
      buying: 64.125,
      selling: 64.46,
      banknoteBuying: 64.08,
      banknoteSelling: 64.557,
      rate: 1 / 64.46,
      label: 'British Pound (£)',
    },
  },
}

// In-memory server cache (1 hour TTL)
let inMemoryCache: { data: TCMBData; timestamp: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour

/**
 * Parses single currency tag from TCMB XML without external XML parser dependencies
 */
function extractCurrencyFromXML(xml: string, currencyCode: string): {
  buying: number
  selling: number
  banknoteBuying?: number
  banknoteSelling?: number
  name: string
} | null {
  const regex = new RegExp(
    `<Currency[^>]*CurrencyCode="${currencyCode}"[^>]*>([\\s\\S]*?)<\\/Currency>`,
    'i'
  )
  const match = xml.match(regex)
  if (!match || !match[1]) return null

  const content = match[1]

  const getTagValue = (tagName: string): string => {
    const tagMatch = content.match(new RegExp(`<${tagName}>([^<]*)<\\/${tagName}>`, 'i'))
    return tagMatch && tagMatch[1] ? tagMatch[1].trim() : ''
  }

  const forexBuying = parseFloat(getTagValue('ForexBuying')) || 0
  const forexSelling = parseFloat(getTagValue('ForexSelling')) || 0
  const banknoteBuying = parseFloat(getTagValue('BanknoteBuying')) || forexBuying
  const banknoteSelling = parseFloat(getTagValue('BanknoteSelling')) || forexSelling
  const name = getTagValue('Isim') || currencyCode

  return {
    buying: forexBuying || banknoteBuying,
    selling: forexSelling || banknoteSelling,
    banknoteBuying,
    banknoteSelling,
    name,
  }
}

/**
 * Fetch and parse TCMB XML directly from official source
 */
export async function fetchTCMBRates(force = false): Promise<TCMBData> {
  const now = Date.now()

  // Use memory cache if valid and not forcing refresh
  if (!force && inMemoryCache && now - inMemoryCache.timestamp < CACHE_TTL_MS) {
    return inMemoryCache.data
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 7000)

    const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GulumseDental/1.0; +https://gulumse.com)',
        Accept: 'application/xml, text/xml, */*',
      },
      next: { revalidate: 3600 }, // 1 hour ISR revalidation
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`TCMB HTTP error: ${response.status} ${response.statusText}`)
    }

    const xml = await response.text()
    if (!xml || !xml.includes('<Tarih_Date')) {
      throw new Error('Invalid TCMB XML payload received')
    }

    // Extract Date & Bulletin Number from root attributes
    const dateMatch = xml.match(/<Tarih_Date[^>]*Tarih="([^"]*)"/i)
    const bultenMatch = xml.match(/<Tarih_Date[^>]*Bulten_No="([^"]*)"/i)

    const date = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('tr-TR')
    const bultenNo = bultenMatch ? bultenMatch[1] : 'N/A'

    // Extract Currencies
    const usd = extractCurrencyFromXML(xml, 'USD')
    const eur = extractCurrencyFromXML(xml, 'EUR')
    const gbp = extractCurrencyFromXML(xml, 'GBP')

    const usdSelling = usd?.selling || FALLBACK_TCMB_DATA.rates.USD.selling
    const eurSelling = eur?.selling || FALLBACK_TCMB_DATA.rates.EUR.selling
    const gbpSelling = gbp?.selling || FALLBACK_TCMB_DATA.rates.GBP.selling

    const tcmbData: TCMBData = {
      source: 'TCMB',
      date,
      bultenNo,
      updatedAt: new Date().toISOString(),
      isStale: false,
      rates: {
        TRY: {
          code: 'TRY',
          symbol: '₺',
          name: 'TÜRK LİRASI',
          buying: 1,
          selling: 1,
          rate: 1,
          label: 'Türk Lirası (₺)',
        },
        USD: {
          code: 'USD',
          symbol: '$',
          name: usd?.name || 'ABD DOLARI',
          buying: usd?.buying || FALLBACK_TCMB_DATA.rates.USD.buying,
          selling: usdSelling,
          banknoteBuying: usd?.banknoteBuying,
          banknoteSelling: usd?.banknoteSelling,
          rate: 1 / usdSelling,
          label: 'US Dollar ($)',
        },
        EUR: {
          code: 'EUR',
          symbol: '€',
          name: eur?.name || 'EURO',
          buying: eur?.buying || FALLBACK_TCMB_DATA.rates.EUR.buying,
          selling: eurSelling,
          banknoteBuying: eur?.banknoteBuying,
          banknoteSelling: eur?.banknoteSelling,
          rate: 1 / eurSelling,
          label: 'Euro (€)',
        },
        GBP: {
          code: 'GBP',
          symbol: '£',
          name: gbp?.name || 'İNGİLİZ STERLİNİ',
          buying: gbp?.buying || FALLBACK_TCMB_DATA.rates.GBP.buying,
          selling: gbpSelling,
          banknoteBuying: gbp?.banknoteBuying,
          banknoteSelling: gbp?.banknoteSelling,
          rate: 1 / gbpSelling,
          label: 'British Pound (£)',
        },
      },
    }

    // Update in-memory cache
    inMemoryCache = {
      data: tcmbData,
      timestamp: now,
    }

    return tcmbData
  } catch (error: any) {
    console.error('⚠️ TCMB XML fetch failed, using fallback/cache:', error.message)

    if (inMemoryCache) {
      return {
        ...inMemoryCache.data,
        isStale: true,
      }
    }

    return FALLBACK_TCMB_DATA
  }
}
