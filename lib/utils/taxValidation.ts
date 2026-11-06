/**
 * TC Kimlik Numarası ve Vergi Kimlik Numarası Doğrulama ve Maskeleme Araçları
 * KVKK ve Veri Koruma İlkelerine Uyumlu
 */

/**
 * 11 Haneli Türkiye Cumhuriyeti Kimlik Numarası Doğrulaması
 */
export function validateTCKimlik(tcRaw?: string | null): { isValid: boolean; error?: string } {
  if (!tcRaw) {
    return { isValid: false, error: 'T.C. Kimlik Numarası boş bırakılamaz.' }
  }

  const tc = String(tcRaw).trim()

  if (!/^\d{11}$/.test(tc)) {
    return { isValid: false, error: 'T.C. Kimlik Numarası 11 haneli rakamlardan oluşmalıdır.' }
  }

  if (tc[0] === '0') {
    return { isValid: false, error: 'T.C. Kimlik Numarası 0 ile başlayamaz.' }
  }

  const digits = tc.split('').map(Number)

  // 1, 3, 5, 7, 9. basamakların toplamı
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8]
  // 2, 4, 6, 8. basamakların toplamı
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7]

  // 10. basamak kontrolü: ((oddSum * 7) - evenSum) % 10
  let digit10 = (oddSum * 7 - evenSum) % 10
  if (digit10 < 0) digit10 += 10

  if (digit10 !== digits[9]) {
    return { isValid: false, error: 'Geçersiz T.C. Kimlik Numarası.' }
  }

  // 11. basamak kontrolü: ilk 10 basamağın toplamının modu 10
  const first10Sum = digits.slice(0, 10).reduce((acc, curr) => acc + curr, 0)
  if (first10Sum % 10 !== digits[10]) {
    return { isValid: false, error: 'Geçersiz T.C. Kimlik Numarası.' }
  }

  return { isValid: true }
}

/**
 * 10 Haneli Vergi Kimlik Numarası (VKN) Doğrulaması
 */
export function validateVergiNo(vknRaw?: string | null): { isValid: boolean; error?: string } {
  if (!vknRaw) {
    return { isValid: false, error: 'Vergi Numarası boş bırakılamaz.' }
  }

  const vkn = String(vknRaw).trim()

  if (!/^\d{10}$/.test(vkn)) {
    return { isValid: false, error: 'Vergi Kimlik Numarası 10 haneli rakamlardan oluşmalıdır.' }
  }

  // Türkiye Gelir İdaresi Başkanlığı (GİB) VKN Algoritması
  const digits = vkn.split('').map(Number)
  let sum = 0

  for (let i = 0; i < 9; i++) {
    const v1 = (digits[i] + (9 - i)) % 10
    const v2 = (v1 * Math.pow(2, 9 - i)) % 9
    const val = v1 !== 0 && v2 === 0 ? 9 : v2
    sum += val
  }

  const checkDigit = (10 - (sum % 10)) % 10
  if (checkDigit !== digits[9]) {
    return { isValid: false, error: 'Geçersiz Vergi Kimlik Numarası.' }
  }

  return { isValid: true }
}

/**
 * T.C. Kimlik Numarasını Maskeler (KVKK & Fiziksel Baskı Koruması)
 * Örn: 12345678901 -> 12*******01
 */
export function maskTCKimlik(tcRaw?: string | null): string {
  if (!tcRaw) return ''
  const tc = String(tcRaw).trim()
  if (tc.length < 11) {
    return tc.length > 4 ? `${tc.slice(0, 2)}***${tc.slice(-2)}` : '***'
  }
  return `${tc.slice(0, 2)}*******${tc.slice(-2)}`
}

/**
 * Vergi Numarasını Maskeler
 * Örn: 1234567890 -> 123****890
 */
export function maskVergiNo(vknRaw?: string | null): string {
  if (!vknRaw) return ''
  const vkn = String(vknRaw).trim()
  if (vkn.length < 6) return '****'
  return `${vkn.slice(0, 3)}****${vkn.slice(-3)}`
}

/**
 * Kurumsal / Şahıs Şirketi Vergi Kimlik Numarası Doğrulaması
 * - Tüzel işletmeler için 10 haneli VKN (validateVergiNo)
 * - Şahıs işletmeleri için 11 haneli TCKN (validateTCKimlik)
 */
export function validateCorporateTaxNumber(taxNumberRaw?: string | null): { isValid: boolean; type?: 'vkn' | 'tckn'; error?: string } {
  if (!taxNumberRaw) {
    return { isValid: false, error: 'Vergi Numarası veya T.C. Kimlik Numarası boş bırakılamaz.' }
  }

  const taxNum = String(taxNumberRaw).trim()

  if (taxNum.length === 10) {
    const vknRes = validateVergiNo(taxNum)
    return {
      isValid: vknRes.isValid,
      type: 'vkn',
      error: vknRes.isValid ? undefined : (vknRes.error || 'Geçersiz Vergi Kimlik Numarası (10 haneli).'),
    }
  }

  if (taxNum.length === 11) {
    const tcknRes = validateTCKimlik(taxNum)
    return {
      isValid: tcknRes.isValid,
      type: 'tckn',
      error: tcknRes.isValid ? undefined : (tcknRes.error || 'Geçersiz T.C. Kimlik Numarası (Şahıs işletmesi için 11 haneli).'),
    }
  }

  return {
    isValid: false,
    error: 'Vergi numarası tüzel işletmeler için 10 haneli VKN, şahıs işletmeleri için 11 haneli TCKN olmalıdır.',
  }
}

/**
 * Kurumsal / Şahıs Şirketi Vergi Numarasını Maskeler
 */
export function maskCorporateTaxNumber(taxNumberRaw?: string | null): string {
  if (!taxNumberRaw) return ''
  const taxNum = String(taxNumberRaw).trim()
  if (taxNum.length === 11) return maskTCKimlik(taxNum)
  return maskVergiNo(taxNum)
}

