import { getAdminFirestore } from '@/lib/firebase/admin'
import {
  HepsiJetSettings,
  DEFAULT_HEPSIJET_SETTINGS,
  DEFAULT_PRINT_SETTINGS,
  PRESET_100X150_PORTRAIT,
  validatePrintSettings,
  HepsiJetAutomationSettings,
  DEFAULT_HEPSIJET_AUTOMATION_SETTINGS,
  OFFICIAL_HEPSIJET_CREDENTIALS,
} from './types'

const SETTINGS_COLLECTION = 'settings'
const SETTINGS_DOC = 'hepsijet'

/**
 * Server-side (Firebase Admin) ile HepsiJET ayarlarını Firestore'dan getirir.
 * Eğer veritabanında henüz kayıt yoksa varsayılan Konya çıkışlı ayarları döner.
 */
export async function getHepsiJetSettingsServer(): Promise<HepsiJetSettings> {
  try {
    const db = getAdminFirestore()
    const docSnap = await db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).get()

    if (docSnap.exists) {
      const data = docSnap.data() as Partial<HepsiJetSettings>
      const savedPreset = data.printSettings?.preset
      const isPortrait =
        savedPreset === '100x150_portrait' ||
        data.printSettings?.orientation === 'portrait' ||
        (data.printSettings?.totalHeightMm !== undefined &&
          data.printSettings?.totalWidthMm !== undefined &&
          data.printSettings.totalHeightMm > data.printSettings.totalWidthMm)

      const basePreset = isPortrait || !data.printSettings ? PRESET_100X150_PORTRAIT : DEFAULT_PRINT_SETTINGS

      return {
        ...DEFAULT_HEPSIJET_SETTINGS,
        ...data,
        // HepsiJET resmi canlı sözleşme bilgileri (veritabanındaki eski/hatalı değerler bu zorunlu alanları ezemez):
        companyName: OFFICIAL_HEPSIJET_CREDENTIALS.companyName,
        abbreviationCode: OFFICIAL_HEPSIJET_CREDENTIALS.abbreviationCode,
        warehouseCode: OFFICIAL_HEPSIJET_CREDENTIALS.warehouseCode,
        currentXdock: OFFICIAL_HEPSIJET_CREDENTIALS.currentXdock,
        senderCountry: OFFICIAL_HEPSIJET_CREDENTIALS.senderCountry,
        senderCity: OFFICIAL_HEPSIJET_CREDENTIALS.senderCity,
        senderTown: OFFICIAL_HEPSIJET_CREDENTIALS.senderTown,
        senderDistrict: OFFICIAL_HEPSIJET_CREDENTIALS.senderDistrict,
        senderAddress: OFFICIAL_HEPSIJET_CREDENTIALS.senderAddress,
        senderPostalCode: OFFICIAL_HEPSIJET_CREDENTIALS.senderPostalCode,
        printSettings: {
          ...basePreset,
          ...(data.printSettings || {}),
        },
      }
    }
  } catch (error) {
    console.error('getHepsiJetSettingsServer error:', error)
  }

  return DEFAULT_HEPSIJET_SETTINGS
}

/**
 * Server-side (Firebase Admin) ile HepsiJET ayarlarını Firestore'a kaydeder.
 */
export async function saveHepsiJetSettingsServer(
  settings: Partial<HepsiJetSettings>,
  updatedByEmail?: string
): Promise<HepsiJetSettings> {
  // Ölçü doğrulaması
  if (settings.printSettings) {
    const validation = validatePrintSettings(settings.printSettings)
    if (!validation.isValid) {
      throw new Error(`Geçersiz baskı ölçüleri: ${validation.error}`)
    }
  }

  const db = getAdminFirestore()
  const docRef = db.collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC)

  const current = await getHepsiJetSettingsServer()
  const toSave: HepsiJetSettings = {
    ...current,
    ...settings,
    companyName: OFFICIAL_HEPSIJET_CREDENTIALS.companyName,
    abbreviationCode: OFFICIAL_HEPSIJET_CREDENTIALS.abbreviationCode,
    warehouseCode: OFFICIAL_HEPSIJET_CREDENTIALS.warehouseCode,
    currentXdock: OFFICIAL_HEPSIJET_CREDENTIALS.currentXdock,
    senderCountry: OFFICIAL_HEPSIJET_CREDENTIALS.senderCountry,
    senderCity: OFFICIAL_HEPSIJET_CREDENTIALS.senderCity,
    senderTown: OFFICIAL_HEPSIJET_CREDENTIALS.senderTown,
    senderDistrict: OFFICIAL_HEPSIJET_CREDENTIALS.senderDistrict,
    senderAddress: OFFICIAL_HEPSIJET_CREDENTIALS.senderAddress,
    senderPostalCode: OFFICIAL_HEPSIJET_CREDENTIALS.senderPostalCode,
    printSettings: {
      ...current.printSettings!,
      ...(settings.printSettings || {}),
    },
    updatedAt: new Date().toISOString(),
    updatedBy: updatedByEmail || 'admin',
  }

  await docRef.set(toSave, { merge: true })
  return toSave
}

const AUTOMATION_DOC = 'hepsijet_automation'

/**
 * Günlük çalışma saatini (HH:mm) doğrular.
 */
export function validateDailyRunTime(timeStr?: string): { isValid: boolean; error?: string } {
  if (!timeStr || typeof timeStr !== 'string') {
    return { isValid: false, error: 'Çalışma saati boş bırakılamaz.' }
  }
  const trimmed = timeStr.trim()
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/
  if (!regex.test(trimmed)) {
    return { isValid: false, error: 'Geçersiz saat formatı. Lütfen "HH:mm" (örn: "17:30") formatında giriniz.' }
  }
  return { isValid: true }
}

/**
 * Europe/Istanbul saat dilimine göre bir sonraki çalışma zamanını ISO formatında hesaplar.
 */
export function calculateNextRunTime(dailyRunTime: string = '17:30', timezone: string = 'Europe/Istanbul'): string {
  const validation = validateDailyRunTime(dailyRunTime)
  const safeTime = validation.isValid ? dailyRunTime.trim() : '17:30'
  const [targetH, targetM] = safeTime.split(':').map((n) => parseInt(n, 10))

  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const getPart = (type: string) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10)

  const currentYear = getPart('year')
  const currentMonth = getPart('month') // 1-12
  const currentDay = getPart('day')
  const currentHour = getPart('hour')
  const currentMinute = getPart('minute')

  const isTodayRemaining =
    currentHour < targetH || (currentHour === targetH && currentMinute < targetM)

  // Türkiye saatiyle hedef tarihi oluştur
  const pad = (n: number) => n.toString().padStart(2, '0')

  if (isTodayRemaining) {
    // Bugün hedef saatte (+03:00)
    const isoString = `${currentYear}-${pad(currentMonth)}-${pad(currentDay)}T${pad(targetH)}:${pad(targetM)}:00+03:00`
    return new Date(isoString).toISOString()
  } else {
    // Yarın hedef saatte
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const tParts = formatter.formatToParts(tomorrow)
    const tGet = (type: string) => parseInt(tParts.find((p) => p.type === type)?.value || '0', 10)
    const tYear = tGet('year')
    const tMonth = tGet('month')
    const tDay = tGet('day')
    const isoString = `${tYear}-${pad(tMonth)}-${pad(tDay)}T${pad(targetH)}:${pad(targetM)}:00+03:00`
    return new Date(isoString).toISOString()
  }
}

/**
 * Server-side (Firebase Admin) ile HepsiJET otomasyon ayarlarını Firestore'dan getirir.
 */
export async function getHepsiJetAutomationSettingsServer(): Promise<HepsiJetAutomationSettings> {
  try {
    const db = getAdminFirestore()
    const docSnap = await db.collection(SETTINGS_COLLECTION).doc(AUTOMATION_DOC).get()

    if (docSnap.exists) {
      const data = docSnap.data() as Partial<HepsiJetAutomationSettings>
      const dailyRunTime = data.dailyRunTime || DEFAULT_HEPSIJET_AUTOMATION_SETTINGS.dailyRunTime
      const timezone = data.timezone || DEFAULT_HEPSIJET_AUTOMATION_SETTINGS.timezone
      const nextRunAt = data.nextRunAt || calculateNextRunTime(dailyRunTime, timezone)

      return {
        ...DEFAULT_HEPSIJET_AUTOMATION_SETTINGS,
        ...data,
        nextRunAt,
      }
    }
  } catch (error) {
    console.error('getHepsiJetAutomationSettingsServer error:', error)
  }

  const nextRunAt = calculateNextRunTime(
    DEFAULT_HEPSIJET_AUTOMATION_SETTINGS.dailyRunTime,
    DEFAULT_HEPSIJET_AUTOMATION_SETTINGS.timezone
  )

  return {
    ...DEFAULT_HEPSIJET_AUTOMATION_SETTINGS,
    nextRunAt,
  }
}

/**
 * Server-side (Firebase Admin) ile HepsiJET otomasyon ayarlarını Firestore'a kaydeder.
 */
export async function saveHepsiJetAutomationSettingsServer(
  settings: Partial<HepsiJetAutomationSettings>,
  updatedByEmail?: string
): Promise<HepsiJetAutomationSettings> {
  if (settings.dailyRunTime) {
    const timeVal = validateDailyRunTime(settings.dailyRunTime)
    if (!timeVal.isValid) {
      throw new Error(timeVal.error)
    }
  }

  if (settings.maxBatchSize !== undefined) {
    const size = Number(settings.maxBatchSize)
    if (isNaN(size) || size < 1 || size > 200) {
      throw new Error('Bir çalıştırmada işlenecek azami sipariş sayısı 1 ile 200 arasında olmalıdır.')
    }
  }

  const db = getAdminFirestore()
  const docRef = db.collection(SETTINGS_COLLECTION).doc(AUTOMATION_DOC)

  const current = await getHepsiJetAutomationSettingsServer()
  const targetTime = settings.dailyRunTime || current.dailyRunTime
  const targetTz = settings.timezone || current.timezone || 'Europe/Istanbul'
  const nextRunAt = calculateNextRunTime(targetTime, targetTz)

  const toSave: HepsiJetAutomationSettings = {
    ...current,
    ...settings,
    dailyRunTime: targetTime.trim(),
    timezone: targetTz,
    nextRunAt,
    updatedAt: new Date().toISOString(),
    updatedBy: updatedByEmail || 'admin',
  }

  await docRef.set(toSave, { merge: true })
  return toSave
}
