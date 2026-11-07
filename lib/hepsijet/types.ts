export interface HepsiJetSettings {
  // Çalışma Modu
  mode: 'live' | 'test'
  baseUrl?: string

  // Şirket / Gönderici Bilgileri
  companyName: string
  abbreviationCode: string // HepsiJET tarafından verilen şirket kısaltması (örn: KLP, GLM vb.)
  contactName: string
  contactPhone: string
  contactEmail: string

  // Konya Çıkış Deposu & Adres Bilgileri
  warehouseCode?: string // HepsiJET Çıkış Depo / Şube Kodu (companyAddressId, örn: kali-kaliport-73)
  currentXdock?: string // HepsiJET Aktarma Merkezi Kodu (CurrentXdock.abbreviationCode, örn: KALIPORTSELCUKLU)
  senderCountry?: string // Türkiye
  senderCity: string // Konya
  senderTown: string // SELÇUKLU
  senderDistrict?: string // BÜYÜKKAYACIK
  senderAddress: string // büyükkayacık mah. Ankara cad. no:312/H ( Gnc sanayi sitesi ) Selçuklu / KONYA
  senderPostalCode?: string

  // Paketleme & Desi Varsayılanları
  defaultDesi: number
  defaultWeight: number // kg
  defaultPackageCount: number
  productCode: string // HepsiJET ürün teslimat tipi kodu (örn: HX_STD, HX_RETAIL)
  deliveryType: 'RETAIL' | 'EXPRESS' | 'STANDARD'

  // Termal Baskı & Birleşik Etiket Ayarları (150x100mm varsayılan)
  printSettings?: ThermalPrintSettings

  // Metadata
  updatedAt?: string
  updatedBy?: string
}

export type ThermalPrintPreset = '150x100_landscape' | '100x150_portrait' | 'custom'

export interface ThermalPrintSettings {
  // Preset Seçimi (Opsiyonel / Geriye Dönük Uyumlu)
  preset?: ThermalPrintPreset

  // Ölçüler (mm) - Başlangıç varsayılanı: 150 × 100 mm (15 × 10 cm yatay)
  totalWidthMm: number // Varsayılan: 150 (dikeyde 100)
  totalHeightMm: number // Varsayılan: 100 (dikeyde 150)
  labelWidthMm: number // HepsiJET etiketi alanı genişliği (mm)
  labelHeightMm: number // HepsiJET etiketi alanı yüksekliği (mm)
  slipWidthMm: number // KALIPORT sipariş bilgi fişi alanı genişliği (mm)
  slipHeightMm: number // KALIPORT sipariş bilgi fişi alanı yüksekliği (mm)
  gapMm: number // İki alan arasındaki boşluk (mm)
  marginMm: number // Dış kenar boşluğu (mm)
  orientation: 'landscape' | 'portrait' // 'landscape' (yatay) veya 'portrait' (dikey)

  // KALIPORT Sipariş Bilgi Fişi Ayarları
  companyTitle: string // Varsayılan: KALIPORT
  logoUrl?: string // İsteğe bağlı logo URL
  fontSize: 'compact' | 'small' | 'medium' // Varsayılan: compact (sıkıştırılmış fiş düzeni)
  showPrice: boolean // Fiyat gösterimi (varsayılan: false)
  showCustomerPhone: boolean // Alıcı telefon gösterimi (varsayılan: true)
  showFullAddress: boolean // Tam adres yerine il/ilçe (varsayılan: false)
  showPackerField: boolean // Hazırlayan kişi & paket kontrol kutusu (varsayılan: true)
  showNotes: boolean // Müşteri / iç sipariş notu (varsayılan: true)
  showItemSku: boolean // Ürün SKU gösterimi (varsayılan: true)
  showItemVariant: boolean // Ürün varyantı/seçenek gösterimi (varsayılan: true)
}

/**
 * Varsayılan 150 × 100 mm Yatay Termal Baskı Düzeni (Mevcut çalışan ayarlar korunur)
 */
export const DEFAULT_PRINT_SETTINGS: ThermalPrintSettings = {
  preset: '150x100_landscape',
  totalWidthMm: 150,
  totalHeightMm: 100,
  labelWidthMm: 96,
  labelHeightMm: 96,
  slipWidthMm: 48,
  slipHeightMm: 96,
  gapMm: 2,
  marginMm: 2,
  orientation: 'landscape',
  companyTitle: 'KALIPORT',
  logoUrl: '',
  fontSize: 'compact',
  showPrice: false,
  showCustomerPhone: true,
  showFullAddress: false,
  showPackerField: true,
  showNotes: true,
  showItemSku: true,
  showItemVariant: true,
}

/**
 * 100 × 150 mm Dikey Termal Baskı Düzeni (Standart kargo rulosu: Üstte kargo etiketi, altta sipariş fişi)
 */
export const PRESET_100X150_PORTRAIT: ThermalPrintSettings = {
  preset: '100x150_portrait',
  totalWidthMm: 100,
  totalHeightMm: 150,
  labelWidthMm: 96,
  labelHeightMm: 96,
  slipWidthMm: 96,
  slipHeightMm: 46,
  gapMm: 2,
  marginMm: 2,
  orientation: 'portrait',
  companyTitle: 'KALIPORT',
  logoUrl: '',
  fontSize: 'compact',
  showPrice: false,
  showCustomerPhone: true,
  showFullAddress: false,
  showPackerField: true,
  showNotes: true,
  showItemSku: true,
  showItemVariant: true,
}

/**
 * Baskı ve etiket ölçülerinin matematiksel olarak birbirine sığıp sığmadığını doğrular (Client-safe).
 * Alanlar sayfayı aşıyorsa otomatik küçültmek yerine açık bir doğrulama hatası döndürür.
 */
export function validatePrintSettings(ps?: Partial<ThermalPrintSettings>): { isValid: boolean; error?: string } {
  if (!ps) return { isValid: true }

  const orientation =
    ps.orientation ??
    (ps.preset === '100x150_portrait' || (ps.totalHeightMm && ps.totalWidthMm && ps.totalHeightMm > ps.totalWidthMm)
      ? 'portrait'
      : 'landscape')
  const isPortrait = orientation === 'portrait' || ps.preset === '100x150_portrait'

  const totalW = ps.totalWidthMm ?? (isPortrait ? 100 : 150)
  const totalH = ps.totalHeightMm ?? (isPortrait ? 150 : 100)
  const labelW = ps.labelWidthMm ?? 96
  const labelH = ps.labelHeightMm ?? 96
  const slipW = ps.slipWidthMm ?? (isPortrait ? 96 : 48)
  const slipH = ps.slipHeightMm ?? (isPortrait ? 46 : 96)
  const gap = ps.gapMm ?? 2
  const margin = ps.marginMm ?? 2

  if (totalW < 50 || totalW > 300) {
    return { isValid: false, error: 'Toplam baskı genişliği 50 mm ile 300 mm arasında olmalıdır.' }
  }
  if (totalH < 50 || totalH > 300) {
    return { isValid: false, error: 'Toplam baskı yüksekliği 50 mm ile 300 mm arasında olmalıdır.' }
  }
  if (margin < 0 || margin > 15) {
    return { isValid: false, error: 'Kenar boşluğu 0 mm ile 15 mm arasında olmalıdır.' }
  }
  if (gap < 0 || gap > 15) {
    return { isValid: false, error: 'Bölümler arası boşluk 0 mm ile 15 mm arasında olmalıdır.' }
  }
  if (labelW < 20 || labelW > 250) {
    return { isValid: false, error: 'Kargo etiketi genişliği 20 mm ile 250 mm arasında olmalıdır.' }
  }
  if (labelH < 20 || labelH > 250) {
    return { isValid: false, error: 'Kargo etiketi yüksekliği 20 mm ile 250 mm arasında olmalıdır.' }
  }
  if (slipW < 20 || slipW > 250) {
    return { isValid: false, error: 'Sipariş fişi genişliği 20 mm ile 250 mm arasında olmalıdır.' }
  }
  if (slipH < 20 || slipH > 250) {
    return { isValid: false, error: 'Sipariş fişi yüksekliği 20 mm ile 250 mm arasında olmalıdır.' }
  }

  if (orientation === 'landscape') {
    const requiredWidth = labelW + slipW + gap + margin * 2
    if (requiredWidth > totalW + 0.1) {
      return {
        isValid: false,
        error: `Yatay düzende alan genişlikleri toplamı (${labelW}mm kargo + ${slipW}mm fiş + ${gap}mm boşluk + ${margin * 2}mm kenar = ${requiredWidth.toFixed(1)}mm) sayfa genişliğini (${totalW}mm) aşıyor!`,
      }
    }
    const maxNeededHeight = Math.max(labelH, slipH) + margin * 2
    if (maxNeededHeight > totalH + 0.1) {
      return {
        isValid: false,
        error: `Yatay düzende alan yüksekliği (${Math.max(labelH, slipH)}mm + ${margin * 2}mm kenar = ${maxNeededHeight.toFixed(1)}mm) sayfa yüksekliğini (${totalH}mm) aşıyor!`,
      }
    }
  } else {
    // Dikey (portrait) düzende: Üstte kargo etiketi, altta bilgi fişi
    const requiredHeight = labelH + slipH + gap + margin * 2
    if (requiredHeight > totalH + 0.1) {
      return {
        isValid: false,
        error: `Dikey düzende alan yükseklikleri toplamı (${labelH}mm kargo + ${slipH}mm fiş + ${gap}mm boşluk + ${margin * 2}mm kenar = ${requiredHeight.toFixed(1)}mm) sayfa yüksekliğini (${totalH}mm) aşıyor!`,
      }
    }
    const maxNeededWidth = Math.max(labelW, slipW) + margin * 2
    if (maxNeededWidth > totalW + 0.1) {
      return {
        isValid: false,
        error: `Dikey düzende alan genişliği (${Math.max(labelW, slipW)}mm + ${margin * 2}mm kenar = ${maxNeededWidth.toFixed(1)}mm) sayfa genişliğini (${totalW}mm) aşıyor!`,
      }
    }
  }

  return { isValid: true }
}

/**
 * HepsiJET tarafından resmi olarak teyit edilmiş ve sözleşmeli canlı hesap parametreleri.
 * Bu değerler kullanıcı arayüzü veya Firestore'daki eski/hatalı kayıtlar tarafından ezilemez.
 */
export const OFFICIAL_HEPSIJET_CREDENTIALS = {
  companyName: 'KALIPORT',
  abbreviationCode: 'KALIPORT',
  warehouseCode: 'kali-kaliport-73',
  currentXdock: 'KALIPORTSELCUKLU',
  senderCountry: 'Türkiye',
  senderCity: 'Konya',
  senderTown: 'SELÇUKLU',
  senderDistrict: 'BÜYÜKKAYACIK',
  senderAddress: 'büyükkayacık mah. Ankara cad. no:312/H ( Gnc sanayi sitesi ) Selçuklu / KONYA',
  senderPostalCode: '42250',
} as const

export const DEFAULT_HEPSIJET_SETTINGS: HepsiJetSettings = {
  mode: 'live',
  baseUrl: 'https://integration.hepsijet.com',
  companyName: OFFICIAL_HEPSIJET_CREDENTIALS.companyName,
  abbreviationCode: OFFICIAL_HEPSIJET_CREDENTIALS.abbreviationCode,
  contactName: 'Yetkili',
  contactPhone: '05412731909',
  contactEmail: 'satinalma@voks.com.tr',
  warehouseCode: OFFICIAL_HEPSIJET_CREDENTIALS.warehouseCode,
  currentXdock: OFFICIAL_HEPSIJET_CREDENTIALS.currentXdock,
  senderCountry: OFFICIAL_HEPSIJET_CREDENTIALS.senderCountry,
  senderCity: OFFICIAL_HEPSIJET_CREDENTIALS.senderCity,
  senderTown: OFFICIAL_HEPSIJET_CREDENTIALS.senderTown,
  senderDistrict: OFFICIAL_HEPSIJET_CREDENTIALS.senderDistrict,
  senderAddress: OFFICIAL_HEPSIJET_CREDENTIALS.senderAddress,
  senderPostalCode: OFFICIAL_HEPSIJET_CREDENTIALS.senderPostalCode,
  defaultDesi: 1,
  defaultWeight: 0.3,
  defaultPackageCount: 1,
  productCode: 'HX_STD',
  deliveryType: 'RETAIL',
  printSettings: PRESET_100X150_PORTRAIT,
}

export type AutomationDecisionStatus = 'ready' | 'pending_review' | 'skipped' | 'failed' | 'unknown'
export type AutomationRunMode = 'hybrid' | 'manual'

export interface HepsiJetAutomationRunSummary {
  runId: string
  triggeredAt: string
  completedAt?: string
  status: 'running' | 'completed' | 'failed' | 'locked'
  totalChecked: number
  readyCount: number
  pendingReviewCount: number
  failedCount: number
  unknownCount: number
  isSimulated: boolean // true (Canlı API çağrısı kapalı)
  message?: string
}

export interface AutomationOrderItemResult {
  orderId: string
  orderNumber: string
  customerName: string
  totalAmount: number
  status: AutomationDecisionStatus
  reasons: string[]
  desi: number
  weight: number
  packageCount: number
  evaluatedAt: string
}

export interface HepsiJetAutomationSettings {
  enabled: boolean
  dailyRunTime: string // Format: 'HH:mm' (Örn: '17:30')
  timezone: string // 'Europe/Istanbul'
  mode: AutomationRunMode // 'hybrid'
  maxBatchSize: number // Bir çalıştırmada işlenecek azami sipariş (varsayılan: 50)
  lastRunAt?: string | null
  lastRunId?: string | null
  lastRunSummary?: HepsiJetAutomationRunSummary | null
  nextRunAt?: string | null
  updatedAt?: string
  updatedBy?: string
}

export const DEFAULT_HEPSIJET_AUTOMATION_SETTINGS: HepsiJetAutomationSettings = {
  enabled: false,
  dailyRunTime: '17:30',
  timezone: 'Europe/Istanbul',
  mode: 'hybrid',
  maxBatchSize: 50,
  lastRunAt: null,
  lastRunId: null,
  lastRunSummary: null,
  nextRunAt: null,
}

export interface OrderShippingData {
  carrier: 'hepsijet'
  status:
    | 'not_created'
    | 'pending'
    | 'creating'
    | 'created'
    | 'cancel_pending'
    | 'cancelled'
    | 'in_transit'
    | 'unknown'
    | 'cancel_failed'
    | 'failed'
    | 'simulated'
    | 'ready_for_dispatch'
    | 'pending_review'
  barcode?: string
  trackingNumber?: string
  customerDeliveryNo?: string
  trackingUrl?: string
  desi?: number
  weight?: number
  packageCount?: number
  senderCity?: string
  createdAt?: string
  updatedAt?: string
  error?: string
  lockTimestamp?: number
  liveRequestMade?: boolean
  automationStatus?: AutomationDecisionStatus
  automationReasons?: string[]
  automationRunId?: string
  automationEvaluatedAt?: string
  autoDispatchStatus?: 'created' | 'simulated' | 'failed' | 'requires_review' | 'paused' | 'queued' | 'print_queued'
  printStatus?: 'queued' | 'processing' | 'printed' | 'simulated' | 'failed'
  printJobId?: string
  printQueuedAt?: string
  printedAt?: string
  simulatedAt?: string
  printError?: string
  cancelReason?: string
  cancelledAt?: string
  cancelledBy?: string
  cancelResult?: 'SUCCESS' | 'FAILED' | 'REJECTED' | 'NOT_APPLICABLE' | 'UNKNOWN'
  cancelFailedReason?: string
  cancelLockTimestamp?: number
  alreadyDeletedOnHepsiJet?: boolean
  syncStatus?: string
  notificationSent?: boolean
  notifiedAt?: string
  notificationError?: string
  notificationChannel?: 'email' | 'sms' | 'audit_log'
}

export interface HepsiJetTokenResponse {
  status: string
  message?: string
  data?: {
    token: string
    expireDate?: string
  }
}

export interface HepsiJetDeliveryOrderPayload {
  company: {
    name: string
    abbreviationCode: string
  }
  delivery: {
    customerDeliveryNo: string
    customerOrderId: string
    totalParcels: number
    desi: number
    weight: number
    width?: number
    height?: number
    length?: number
    deliveryTotalPrice: number
    deliverySlotOriginal?: number
    deliveryDateOriginal: string
    deliveryType: string
    recipientPerson: string
    recipientPersonPhone1: string
    product: {
      productCode: string
    }
    receiver: {
      firstName: string
      lastName: string
      phone1: string
      email?: string
    }
    senderAddress: {
      companyAddressId?: string
      country: { name: string }
      city: { name: string }
      town: { name: string }
      district?: { name: string }
      addressLine1: string
    }
    recipientAddress: {
      addressLine1: string
      country: { name: string }
      city: { name: string }
      town: { name: string }
      district?: { name: string }
    }
    deliveryContent: Array<{
      sku?: string
      description?: string
      productCode?: string
      productDescription?: string
      quantity: number
    }>
  }
  currentXDock?: {
    abbreviationCode: string
  }
  currentXdock?: {
    abbreviationCode: string
  }
}

export interface HepsiJetCreateShipmentResponse {
  status: string
  message?: string
  data?: {
    customerDeliveryNo?: string
    barcode?: string
    trackingNumber?: string
    [key: string]: any
  }
}

export interface OrderCancellationRecord {
  orderId: string
  reason: string
  cancelledBy: {
    uid?: string
    email?: string
  }
  cancelledAt: string
  shipmentBarcode?: string
  shipmentCustomerDeliveryNo?: string
  httpStatus?: number
  firestoreUpdateStatus?: 'SUCCESS' | 'FAILED' | 'PENDING'
  hepsijetResponse?: {
    status?: string
    message?: string
    httpStatus?: number
    raw?: any
  }
  cancellationResult: 'SUCCESS' | 'FAILED' | 'REJECTED' | 'NOT_APPLICABLE' | 'UNKNOWN'
  requiresAdminReview?: boolean
  errorDetail?: string
}

export interface HepsiJetDeleteDeliveryOrderPayload {
  customerDeliveryNo?: string
  barcode?: string
  deleteReason?: string
}

export interface HepsiJetDeleteDeliveryOrderResponse {
  status: string
  message?: string
  alreadyDeleted?: boolean
  data?: {
    customerDeliveryNo?: string
    barcode?: string
    isSimulated?: boolean
    alreadyDeleted?: boolean
    [key: string]: any
  }
  error?: string
  errors?: any[]
}
