/**
 * KALIPORT / SONRAKAM.COM - Firestore Safe Data Utilities
 * 
 * Firestore veritabanına yazılırken undefined değerler hata verir:
 * "Cannot use undefined as a Firestore value"
 * 
 * Bu yardımcı fonksiyon nesneleri ve dizileri özyinelemeli (recursively) temizler:
 * - undefined olan alanları nesneden tamamen çıkarır.
 * - null, string, number, boolean, Date ve Firestore Timestamp/FieldValue değerlerini korur.
 * - ignoreUndefinedProperties hilesine başvurmadan veriyi güvenli biçimde hazırlar.
 */

export function cleanFirestoreData<T = any>(data: T): T {
  if (data === null || data === undefined) {
    return (data === undefined ? null : data) as any
  }

  if (typeof data !== 'object') {
    return data
  }

  // Date nesnelerini koru
  if (data instanceof Date) {
    return data
  }

  // Firestore Timestamp veya FieldValue nesnelerini koru
  if (
    typeof (data as any).toMillis === 'function' ||
    typeof (data as any).isEqual === 'function' ||
    (data as any)._methodName
  ) {
    return data
  }

  // Dizileri temizle (undefined öğeleri ayıkla, elemanları recursive temizle)
  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => cleanFirestoreData(item)) as any
  }

  // Düz nesneleri temizle
  const cleaned: Record<string, any> = {}
  for (const [key, val] of Object.entries(data as Record<string, any>)) {
    if (val !== undefined) {
      cleaned[key] = cleanFirestoreData(val)
    }
  }

  return cleaned as T
}
