import { TURKEY_LOCATIONS } from '@/lib/data/locations'

/**
 * Firestore özel tiplerini (Timestamp, FieldValue, GeoPoint, DocumentReference, Date)
 * bozmadan, yalnızca plain object ve dizilerdeki `undefined` değerleri temizler.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  if (value instanceof Date || value instanceof RegExp) return false
  const proto = Object.getPrototypeOf(value)
  if (proto !== Object.prototype && proto !== null) return false
  // Duck-typing koruması: Firestore Timestamp / GeoPoint / FieldValue benzeri yapılar
  const record = value as Record<string, unknown>
  if (typeof record.toDate === 'function') return false
  if (typeof record._methodName === 'string') return false
  if (typeof record.latitude === 'number' && typeof record.longitude === 'number' && Object.keys(record).length <= 3) {
    return false
  }
  return true
}

export function removeUndefined<T>(input: T): T {
  if (input === null || input === undefined) {
    return input
  }

  if (Array.isArray(input)) {
    return input
      .filter((item) => item !== undefined)
      .map((item) => removeUndefined(item)) as unknown as T
  }

  if (isPlainObject(input)) {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) continue
      result[key] = removeUndefined(value)
    }
    return result as T
  }

  return input
}

export interface AddressInput {
  title?: string
  type?: 'delivery' | 'billing' | 'both'
  fullName?: string
  phone?: string
  city?: string
  district?: string
  neighborhood?: string
  address?: string
  postalCode?: string
  isDefaultDelivery?: boolean
  isDefaultBilling?: boolean
  isCorporate?: boolean
  tcKimlikNo?: string
  companyName?: string
  taxOffice?: string
  taxNumber?: string
  authorizedPerson?: string | { firstName?: string; lastName?: string } | null
  billingAddress?: {
    address?: string
    city?: string
    district?: string
  } | null
}

export interface AddressValidationResult {
  valid: boolean
  error?: string
  field?: 'title' | 'fullName' | 'phone' | 'city' | 'district' | 'address'
}

/**
 * Seçilen ilin benzersiz ilçe listesini döndürür.
 */
export function getDistrictsForCity(city: string): string[] {
  const trimmed = (city || '').trim()
  if (!trimmed) return []
  const list = TURKEY_LOCATIONS[trimmed]
  if (!Array.isArray(list)) return []
  return Array.from(new Set(list))
}

/**
 * Profil / teslimat adresi zorunlu alanlarını doğrular.
 */
export function validateAddressInput(input: AddressInput): AddressValidationResult {
  if (!input.title || !input.title.trim()) {
    return { valid: false, error: 'Lütfen adres başlığı giriniz (örn. Ev, İş).', field: 'title' }
  }
  if (!input.fullName || !input.fullName.trim()) {
    return { valid: false, error: 'Lütfen alıcı ad soyad bilgisini giriniz.', field: 'fullName' }
  }
  if (!input.phone || !input.phone.trim()) {
    return { valid: false, error: 'Lütfen geçerli bir telefon numarası giriniz.', field: 'phone' }
  }
  if (!input.city || !input.city.trim()) {
    return { valid: false, error: 'Lütfen il seçiniz.', field: 'city' }
  }
  if (!input.district || !input.district.trim()) {
    return { valid: false, error: 'Lütfen ilçe seçiniz.', field: 'district' }
  }
  if (!input.address || !input.address.trim()) {
    return { valid: false, error: 'Lütfen açık adres bilgisini giriniz.', field: 'address' }
  }

  return { valid: true }
}

/**
 * Adres kaydını Firestore'a güvenle yazılabilecek şekilde normalize eder.
 * Opsiyonel alanlar boşsa nesneden çıkarılır; asla `undefined` üretilmez.
 */
export function buildCleanAddressRecord(
  input: AddressInput,
  meta: {
    id: string
    isDefaultDelivery: boolean
    isDefaultBilling: boolean
    createdAt: string
    updatedAt: string
  }
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    id: meta.id,
    title: (input.title || '').trim(),
    type: input.type || 'both',
    fullName: (input.fullName || '').trim(),
    phone: (input.phone || '').trim(),
    city: (input.city || '').trim(),
    district: (input.district || '').trim(),
    address: (input.address || '').trim(),
    isDefaultDelivery: Boolean(meta.isDefaultDelivery),
    isDefaultBilling: Boolean(meta.isDefaultBilling),
    isCorporate: Boolean(input.isCorporate),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
  }

  const optionalStrings: Array<
    keyof Pick<
      AddressInput,
      'neighborhood' | 'postalCode' | 'tcKimlikNo' | 'companyName' | 'taxOffice' | 'taxNumber'
    >
  > = [
    'neighborhood',
    'postalCode',
    'tcKimlikNo',
    'companyName',
    'taxOffice',
    'taxNumber',
  ]

  for (const field of optionalStrings) {
    const val = input[field]
    if (typeof val === 'string' && val.trim().length > 0) {
      record[field] = val.trim()
    }
  }

  if (typeof input.authorizedPerson === 'string' && input.authorizedPerson.trim().length > 0) {
    record.authorizedPerson = input.authorizedPerson.trim()
  } else if (input.authorizedPerson && typeof input.authorizedPerson === 'object') {
    const fn = (input.authorizedPerson.firstName || '').trim()
    const ln = (input.authorizedPerson.lastName || '').trim()
    if (fn || ln) {
      record.authorizedPerson = { firstName: fn, lastName: ln }
    }
  }

  if (input.billingAddress && typeof input.billingAddress === 'object') {
    const bAddr = (input.billingAddress.address || '').trim()
    const bCity = (input.billingAddress.city || '').trim()
    const bDist = (input.billingAddress.district || '').trim()
    if (bAddr || bCity || bDist) {
      record.billingAddress = {
        address: bAddr,
        city: bCity,
        district: bDist,
      }
    }
  }

  return removeUndefined(record)
}
