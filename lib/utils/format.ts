import { SupportedCurrency } from '@/lib/firebase/currency'

/**
 * Deterministic price formatter for Next.js SSR & Client hydration consistency
 */
export const formatPrice = (price?: number | string | null): string => {
  if (price === null || price === undefined || price === '') return '0'
  const num = Number(price)
  if (isNaN(num)) return '0'
  
  // Format with standard thousands separator
  return num.toLocaleString('tr-TR', {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format monetary amount with locale & currency symbols
 */
export const formatMoney = (
  amount: number,
  currency: SupportedCurrency = 'TRY',
  locale = 'tr-TR'
): string => {
  if (isNaN(amount) || amount === null || amount === undefined) {
    amount = 0
  }

  try {
    const currencyMap: Record<SupportedCurrency, { code: string; symbol: string; locale: string }> = {
      TRY: { code: 'TRY', symbol: '₺', locale: 'tr-TR' },
      USD: { code: 'USD', symbol: '$', locale: 'en-US' },
      EUR: { code: 'EUR', symbol: '€', locale: 'de-DE' },
      GBP: { code: 'GBP', symbol: '£', locale: 'en-GB' },
    }

    const curr = currencyMap[currency] || currencyMap.TRY
    const targetLocale = locale || curr.locale

    const formatted = new Intl.NumberFormat(targetLocale, {
      style: 'currency',
      currency: curr.code,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount)

    return formatted
  } catch (error) {
    // Fallback if Intl fails
    const symbols: Record<SupportedCurrency, string> = {
      TRY: '₺',
      USD: '$',
      EUR: '€',
      GBP: '£',
    }
    const sym = symbols[currency] || '₺'
    const rounded = Math.round(amount * 100) / 100
    return currency === 'TRY' ? `${rounded.toLocaleString('tr-TR')} ${sym}` : `${sym}${rounded.toLocaleString('en-US')}`
  }
}
