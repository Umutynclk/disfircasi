import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import {
  ThermalPrintSettings,
  DEFAULT_PRINT_SETTINGS,
  PRESET_100X150_PORTRAIT,
  HepsiJetSettings,
} from '@/lib/hepsijet/types'
import { sanitizePdfText, wrapText } from '@/lib/hepsijet/sampleLabel'
import { maskTCKimlik, maskVergiNo } from '@/lib/utils/taxValidation'

export interface OrderItemForSlip {
  name?: string
  title?: string
  quantity: number
  price?: number
  selectedColor?: { name?: string; title?: string }
  color?: string
  sku?: string
  barcode?: string
}

export interface OrderForCombinedLabel {
  id: string
  orderNumber?: string
  createdAt?: string
  status?: string
  paymentStatus?: string
  paymentMethod?: string
  customerType?: 'individual' | 'corporate'
  billingInfo?: {
    type?: 'individual' | 'corporate'
    companyName?: string
    taxOffice?: string
    taxNumber?: string
    fullName?: string
    tcKimlikNo?: string
    authorizedPerson?: { firstName?: string; lastName?: string }
    address?: string
    city?: string
    district?: string
  }
  totalAmount?: number
  total?: number
  customer?: {
    name?: string
    email?: string
    phone?: string
  }
  shippingAddress?: {
    fullName?: string
    phone?: string
    city?: string
    district?: string
    town?: string
    address?: string
  }
  items?: OrderItemForSlip[]
  shipping?: {
    carrier?: string
    status?: string
    barcode?: string
    trackingNumber?: string
    customerDeliveryNo?: string
    desi?: number
    weight?: number
    packageCount?: number
    liveRequestMade?: boolean
  }
  notes?: string
  customerNotes?: string
}

export interface GenerateCombinedLabelOptions {
  order: OrderForCombinedLabel
  hepsijetPdfBuffer: Buffer
  settings?: HepsiJetSettings
  customPrintSettings?: Partial<ThermalPrintSettings>
}

// 1 mm = 72 / 25.4 point (PDF point)
const MM_TO_PT = 72 / 25.4

/**
 * HepsiJET kargo etiketi ile KALIPORT sipariş hazırlama bilgi fişini tek bir termal PDF sayfasında birleştirir.
 * 
 * Varsayılan: Yatay 150 × 100 mm (15 × 10 cm)
 * Sol Bölüm: 100 × 100 mm HepsiJET Kargo Etiketi (Oranı korunmuş vektörel sayfa)
 * Sağ Bölüm: 50 × 100 mm KALIPORT Sipariş Bilgi Fişi (Kompakt ürün ve paket hazırlama detayları)
 */
export async function generateCombinedThermalLabelPdf({
  order,
  hepsijetPdfBuffer,
  settings,
  customPrintSettings,
}: GenerateCombinedLabelOptions): Promise<Buffer> {
  const isPortrait =
    customPrintSettings?.preset === '100x150_portrait' ||
    customPrintSettings?.orientation === 'portrait' ||
    (!customPrintSettings?.preset &&
      (settings?.printSettings?.preset === '100x150_portrait' ||
        settings?.printSettings?.orientation === 'portrait'))

  const basePreset = isPortrait ? PRESET_100X150_PORTRAIT : DEFAULT_PRINT_SETTINGS

  const ps: ThermalPrintSettings = {
    ...basePreset,
    ...(settings?.printSettings || {}),
    ...(customPrintSettings || {}),
  }

  // Ölçü Dönüşümleri (mm -> point)
  const totalWidthPt = ps.totalWidthMm * MM_TO_PT
  const totalHeightPt = ps.totalHeightMm * MM_TO_PT
  const marginPt = ps.marginMm * MM_TO_PT
  const gapPt = ps.gapMm * MM_TO_PT

  const isLandscape = ps.orientation === 'landscape'

  // 0. BASKI ÖLÇÜLERİNİN DOĞRULANMASI (Sessiz küçültme yerine açık hata)
  const { validatePrintSettings } = await import('@/lib/hepsijet/types')
  const validation = validatePrintSettings(ps)
  if (!validation.isValid) {
    throw new Error(`Baskı ölçüleri sayfa sınırlarına sığmıyor: ${validation.error}`)
  }

  // Yeni Birleşik PDF Dokümanı
  const combinedDoc = await PDFDocument.create()
  const page = combinedDoc.addPage([totalWidthPt, totalHeightPt])

  const fontBold = await combinedDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await combinedDoc.embedFont(StandardFonts.Helvetica)
  const fontOblique = await combinedDoc.embedFont(StandardFonts.HelveticaOblique)

  // 1. HEPSIJET KAYNAK PDF'İNİ YÜKLE VE SAYFAYI GÖM (EMBED)
  let sourceDoc: PDFDocument
  try {
    sourceDoc = await PDFDocument.load(hepsijetPdfBuffer)
  } catch (err: any) {
    throw new Error(`HepsiJET kargo etiketi PDF'si okunamadı veya bozuk: ${err.message}`)
  }

  const sourcePages = sourceDoc.getPages()
  if (sourcePages.length === 0) {
    throw new Error('HepsiJET kargo etiketinde geçerli bir sayfa bulunamadı.')
  }

  const [embeddedHepsiJetPage] = await combinedDoc.embedPdf(sourceDoc, [0])
  const srcWidth = embeddedHepsiJetPage.width
  const srcHeight = embeddedHepsiJetPage.height

  // 2. BÖLÜM ALANLARININ HESAPLANMASI (Yatay 150x100mm veya Dikey 100x150mm)
  let labelBoxX: number
  let labelBoxY: number
  let labelBoxW: number
  let labelBoxH: number

  let slipBoxX: number
  let slipBoxY: number
  let slipBoxW: number
  let slipBoxH: number

  if (isLandscape) {
    // Yatay Düzen (örn: 150 × 100 mm): Sol kargo etiketi, sağ KALIPORT bilgi fişi
    labelBoxX = marginPt
    labelBoxY = marginPt
    labelBoxW = ps.labelWidthMm * MM_TO_PT
    labelBoxH = ps.labelHeightMm * MM_TO_PT

    slipBoxX = labelBoxX + labelBoxW + gapPt
    slipBoxY = marginPt
    slipBoxW = ps.slipWidthMm * MM_TO_PT
    slipBoxH = ps.slipHeightMm * MM_TO_PT
  } else {
    // Dikey Düzen (örn: 100 × 150 mm): Altta KALIPORT bilgi fişi, üstte kargo etiketi
    slipBoxX = marginPt
    slipBoxY = marginPt
    slipBoxW = ps.slipWidthMm * MM_TO_PT
    slipBoxH = ps.slipHeightMm * MM_TO_PT

    labelBoxX = marginPt
    labelBoxY = slipBoxY + slipBoxH + gapPt
    labelBoxW = ps.labelWidthMm * MM_TO_PT
    labelBoxH = ps.labelHeightMm * MM_TO_PT
  }

  // 3. HEPSIJET ETİKETİNİ ORANI KORUYARAK (ASPECT RATIO) ALANA MERKEZLE
  const scale = Math.min(labelBoxW / srcWidth, labelBoxH / srcHeight)
  const renderedLabelW = srcWidth * scale
  const renderedLabelH = srcHeight * scale
  // Merkeze yerleştir
  const labelOffsetX = labelBoxX + (labelBoxW - renderedLabelW) / 2
  const labelOffsetY = labelBoxY + (labelBoxH - renderedLabelH) / 2

  page.drawPage(embeddedHepsiJetPage, {
    x: labelOffsetX,
    y: labelOffsetY,
    width: renderedLabelW,
    height: renderedLabelH,
  })

  // Bölümler Arası Ayırıcı Çizgi (Kesikli / Noktalı Termal Çizgi)
  if (isLandscape) {
    const dividerX = labelBoxX + labelBoxW + gapPt / 2
    page.drawLine({
      start: { x: dividerX, y: marginPt },
      end: { x: dividerX, y: totalHeightPt - marginPt },
      thickness: 0.8,
      color: rgb(0.7, 0.7, 0.7),
      dashArray: [3, 3],
    })
  } else {
    const dividerY = slipBoxY + slipBoxH + gapPt / 2
    page.drawLine({
      start: { x: marginPt, y: dividerY },
      end: { x: totalWidthPt - marginPt, y: dividerY },
      thickness: 0.8,
      color: rgb(0.7, 0.7, 0.7),
      dashArray: [3, 3],
    })
  }

  // 4. KALIPORT SİPARİŞ BİLGİ FİŞİNİ ÇİZ (SAĞ VEYA ALT BÖLÜM)
  renderOrderInfoSlip({
    page,
    boxX: slipBoxX,
    boxY: slipBoxY,
    boxW: slipBoxW,
    boxH: slipBoxH,
    order,
    settings: ps,
    hepsijetSettings: settings,
    fontBold,
    fontRegular,
    fontOblique,
  })

  const combinedBytes = await combinedDoc.save()
  return Buffer.from(combinedBytes)
}

interface RenderSlipParams {
  page: any
  boxX: number
  boxY: number
  boxW: number
  boxH: number
  order: OrderForCombinedLabel
  settings: ThermalPrintSettings
  hepsijetSettings?: HepsiJetSettings
  fontBold: any
  fontRegular: any
  fontOblique: any
}

function renderOrderInfoSlip(params: RenderSlipParams) {
  // Eğer fiş alanı 60 mm'den genişse (örn: 100x150mm dikey düzende 96mm x 46mm)
  // sıkışmayı önlemek için iki sütunlu geniş yerleşim kullanılır.
  if (params.boxW > 60 * MM_TO_PT) {
    renderWideOrderInfoSlip(params)
  } else {
    renderNarrowOrderInfoSlip(params)
  }
}

function renderWideOrderInfoSlip({
  page,
  boxX,
  boxY,
  boxW,
  boxH,
  order,
  settings,
  hepsijetSettings,
  fontBold,
  fontRegular,
  fontOblique,
}: RenderSlipParams) {
  // 100x150 mm Dikey Rulo Alt Fiş Alanı (96mm x 46mm)
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderWidth: 0.8,
    borderColor: rgb(0.85, 0.85, 0.85),
    color: rgb(1, 1, 1),
  })

  const padding = 4
  const usableW = boxW - padding * 2
  const col1W = Math.floor(usableW * 0.48) // ~126 pt
  const colGap = 8
  const col2X = boxX + padding + col1W + colGap
  const col2W = usableW - col1W - colGap // ~130 pt
  const col1X = boxX + padding

  // Sütunlar Arası Ayırıcı Dikey Çizgi
  page.drawLine({
    start: { x: col1X + col1W + colGap / 2, y: boxY + 4 },
    end: { x: col1X + col1W + colGap / 2, y: boxY + boxH - 4 },
    thickness: 0.6,
    color: rgb(0.8, 0.8, 0.8),
    dashArray: [2, 2],
  })

  // --- SOL SÜTUN (SİPARİŞ VE MÜŞTERİ BİLGİLERİ) ---
  let y1 = boxY + boxH - padding - 8

  // Firma Başlığı & Rozet
  const compTitle = sanitizePdfText(settings.companyTitle || 'KALIPORT')
  page.drawText(compTitle, {
    x: col1X,
    y: y1,
    size: 9.5,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  page.drawText('SIPARIS FISI', {
    x: col1X + col1W - fontBold.widthOfTextAtSize('SIPARIS FISI', 6) - 1,
    y: y1 + 1,
    size: 6,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  })

  y1 -= 3
  page.drawLine({
    start: { x: col1X, y: y1 },
    end: { x: col1X + col1W, y: y1 },
    thickness: 0.6,
    color: rgb(0, 0, 0),
  })

  // Sipariş No & Tarih
  y1 -= 8.5
  const orderNumStr = order.orderNumber || order.id.slice(-8).toUpperCase()
  page.drawText(`No: #${orderNumStr}`, {
    x: col1X,
    y: y1,
    size: 7.5,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  const dateStr = formatDateShort(order.createdAt)
  page.drawText(dateStr, {
    x: col1X + col1W - fontRegular.widthOfTextAtSize(dateStr, 6),
    y: y1,
    size: 6,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  })

  // Ödeme Durumu
  y1 -= 7.5
  const isPaid = order.paymentStatus === 'PAID'
  const payStatusText = isPaid ? 'ODENDI' : 'BEKLIYOR'
  page.drawText(`Odeme: ${payStatusText}`, {
    x: col1X,
    y: y1,
    size: 6.2,
    font: fontBold,
    color: isPaid ? rgb(0.1, 0.5, 0.1) : rgb(0.7, 0.4, 0.0),
  })

  // Alıcı
  y1 -= 8
  const isCorporate = order.customerType === 'corporate' || order.billingInfo?.type === 'corporate'
  const recipientName = sanitizePdfText(order.shippingAddress?.fullName || order.customer?.name || 'Musteri')
  page.drawText(`Alici: ${recipientName.slice(0, 22)}`, {
    x: col1X,
    y: y1,
    size: 7.2,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  // Fatura & Müşteri Türü (Kurumsal unvan / VKN veya Bireysel maskeli TC)
  y1 -= 7
  if (isCorporate) {
    const company = sanitizePdfText(order.billingInfo?.companyName || '')
    const vkn = order.billingInfo?.taxNumber ? maskVergiNo(order.billingInfo.taxNumber) : ''
    const taxOffice = sanitizePdfText(order.billingInfo?.taxOffice || '')
    const corpLine = company ? `Firma: ${company.slice(0, 20)}` : 'Kurumsal Fatura'
    page.drawText(corpLine, {
      x: col1X,
      y: y1,
      size: 5.8,
      font: fontBold,
      color: rgb(0.1, 0.25, 0.65),
    })
    y1 -= 6
    page.drawText(`VKN: ${vkn || '-'} ${taxOffice ? `(${taxOffice.slice(0, 10)})` : ''}`, {
      x: col1X,
      y: y1,
      size: 5.5,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    })
  } else {
    const rawTc = order.billingInfo?.tcKimlikNo || ''
    const maskedTc = rawTc ? maskTCKimlik(rawTc) : ''
    page.drawText(`Bireysel ${maskedTc ? `| TC: ${maskedTc}` : ''}`, {
      x: col1X,
      y: y1,
      size: 5.8,
      font: fontRegular,
      color: rgb(0.25, 0.25, 0.25),
    })
  }

  // Telefon
  if (settings.showCustomerPhone) {
    const phone = sanitizePdfText(order.shippingAddress?.phone || order.customer?.phone || '')
    if (phone) {
      y1 -= 6.5
      page.drawText(`Tel: ${phone}`, {
        x: col1X,
        y: y1,
        size: 5.8,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
      })
    }
  }

  // Bölge (İlçe / İl)
  const city = sanitizePdfText(order.shippingAddress?.city || '')
  const town = sanitizePdfText(order.shippingAddress?.district || order.shippingAddress?.town || '')
  if (city || town) {
    y1 -= 6.5
    page.drawText(`Bolge: ${town ? town + ' / ' : ''}${city}`.slice(0, 26), {
      x: col1X,
      y: y1,
      size: 5.8,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    })
  }

  y1 -= 3
  page.drawLine({
    start: { x: col1X, y: y1 },
    end: { x: col1X + col1W, y: y1 },
    thickness: 0.4,
    color: rgb(0.7, 0.7, 0.7),
  })

  // Toplam Adet ve Fiyat
  y1 -= 8
  const items = order.items || []
  const totalPieces = items.reduce((acc, it) => acc + (it.quantity || 1), 0)
  page.drawText(`Top. Urun: ${totalPieces} Adet`, {
    x: col1X,
    y: y1,
    size: 6.8,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  if (settings.showPrice && (order.totalAmount || order.total)) {
    const priceVal = (order.totalAmount || order.total || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })
    const priceStr = `${priceVal} TL`
    page.drawText(priceStr, {
      x: col1X + col1W - fontBold.widthOfTextAtSize(priceStr, 6.5),
      y: y1,
      size: 6.5,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
  }

  // Desi & Ağırlık
  y1 -= 7.5
  const desiVal =
    typeof order.shipping?.desi === 'number' && order.shipping.desi > 0
      ? order.shipping.desi
      : typeof (order as any).desi === 'number' && (order as any).desi > 0
      ? (order as any).desi
      : (hepsijetSettings?.defaultDesi || 1)
  const weightVal =
    typeof order.shipping?.weight === 'number' && order.shipping.weight > 0
      ? order.shipping.weight
      : typeof (order as any).weight === 'number' && (order as any).weight > 0
      ? (order as any).weight
      : (hepsijetSettings?.defaultWeight || 0.3)
  page.drawText(`HepsiJET | Desi: ${desiVal} | ${weightVal}kg`, {
    x: col1X,
    y: y1,
    size: 5.8,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  })

  // --- SAĞ SÜTUN (ÜRÜNLER & HAZIRLAMA KONTROL) ---
  let y2 = boxY + boxH - padding - 8

  page.drawText('URUNLER (HAZIRLAMA)', {
    x: col2X,
    y: y2,
    size: 6.8,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  y2 -= 3
  page.drawLine({
    start: { x: col2X, y: y2 },
    end: { x: col2X + col2W, y: y2 },
    thickness: 0.6,
    color: rgb(0, 0, 0),
  })

  const minItemsY = boxY + 16
  let printedCount = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (y2 - 8 < minItemsY) break

    y2 -= 8
    printedCount++

    const qtyStr = `${item.quantity || 1}x`
    page.drawText(qtyStr, {
      x: col2X,
      y: y2,
      size: 6.8,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    const rawTitle = item.name || item.title || 'Urun'
    const cleanTitle = sanitizePdfText(rawTitle)
    const availChars = Math.floor(col2W / 4.4) - 5
    const truncTitle = cleanTitle.length > availChars ? cleanTitle.slice(0, availChars - 1) + '..' : cleanTitle

    page.drawText(truncTitle, {
      x: col2X + 13,
      y: y2,
      size: 6.5,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    const variant = item.selectedColor?.name || item.selectedColor?.title || item.color || ''
    const sku = item.sku || ''
    const metaParts = []
    if (settings.showItemVariant && variant) metaParts.push(variant)
    if (settings.showItemSku && sku) metaParts.push(`SKU:${sku}`)

    if (metaParts.length > 0 && y2 - 6 >= minItemsY) {
      y2 -= 6
      const metaText = sanitizePdfText(metaParts.join(' | ')).slice(0, 28)
      page.drawText(`- ${metaText}`, {
        x: col2X + 13,
        y: y2,
        size: 5.5,
        font: fontOblique,
        color: rgb(0.4, 0.4, 0.4),
      })
    }
  }

  const unprinted = items.length - printedCount
  if (unprinted > 0 && y2 - 6 >= minItemsY) {
    y2 -= 6
    page.drawText(`(+${unprinted} diger urun)`, {
      x: col2X + 13,
      y: y2,
      size: 5.5,
      font: fontBold,
      color: rgb(0.7, 0.2, 0.2),
    })
  }

  // Sağ Sütun Altı: Paket Kontrol ve Hazırlayan Kutusu
  if (settings.showPackerField) {
    const checklistY = boxY + 5
    page.drawLine({
      start: { x: col2X, y: checklistY + 9 },
      end: { x: col2X + col2W, y: checklistY + 9 },
      thickness: 0.4,
      color: rgb(0.7, 0.7, 0.7),
    })

    page.drawRectangle({
      x: col2X,
      y: checklistY + 1,
      width: 6,
      height: 6,
      borderWidth: 0.7,
      borderColor: rgb(0, 0, 0),
      color: rgb(1, 1, 1),
    })

    page.drawText('Kontrol', {
      x: col2X + 8,
      y: checklistY + 2,
      size: 5.8,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    const hazText = 'Hazirlayan: ______'
    page.drawText(hazText, {
      x: col2X + col2W - fontRegular.widthOfTextAtSize(hazText, 5.8),
      y: checklistY + 2,
      size: 5.8,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    })
  }
}

function renderNarrowOrderInfoSlip({
  page,
  boxX,
  boxY,
  boxW,
  boxH,
  order,
  settings,
  hepsijetSettings,
  fontBold,
  fontRegular,
  fontOblique,
}: RenderSlipParams) {
  // Yazı Boyutu Profili
  const isCompact = settings.fontSize === 'compact'
  const titleSize = isCompact ? 10 : 11
  const bodySize = isCompact ? 7.2 : 8
  const smallSize = isCompact ? 6 : 6.8
  const lineHeight = isCompact ? 8.5 : 10

  const padding = 4
  const contentLeft = boxX + padding
  const contentRight = boxX + boxW - padding
  const usableWidth = contentRight - contentLeft

  let curY = boxY + boxH - padding

  // Çerçeve (opsiyonel hafif dış sınır)
  page.drawRectangle({
    x: boxX,
    y: boxY,
    width: boxW,
    height: boxH,
    borderWidth: 0.8,
    borderColor: rgb(0.85, 0.85, 0.85),
    color: rgb(1, 1, 1),
  })

  // 1. BAŞLIK BANTI: FİRMA BAŞLIĞI & BİLGİ FİŞİ ROZETİ
  curY -= 10
  const compTitle = sanitizePdfText(settings.companyTitle || 'KALIPORT')
  page.drawText(compTitle, {
    x: contentLeft,
    y: curY,
    size: titleSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  page.drawText('SIPARIS FISI', {
    x: contentRight - fontBold.widthOfTextAtSize('SIPARIS FISI', smallSize) - 2,
    y: curY + 1,
    size: smallSize,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  })

  // İnce çizgi
  curY -= 4
  page.drawLine({
    start: { x: contentLeft, y: curY },
    end: { x: contentRight, y: curY },
    thickness: 0.8,
    color: rgb(0, 0, 0),
  })

  // 2. SİPARİŞ NO & TARİH
  curY -= lineHeight
  const orderNumStr = order.orderNumber || order.id.slice(-8).toUpperCase()
  page.drawText(`No: #${orderNumStr}`, {
    x: contentLeft,
    y: curY,
    size: bodySize + 0.5,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  // Tarih (GG.AA.YYYY)
  const dateStr = formatDateShort(order.createdAt)
  page.drawText(dateStr, {
    x: contentRight - fontRegular.widthOfTextAtSize(dateStr, smallSize),
    y: curY,
    size: smallSize,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.4),
  })

  // 3. ÖDEME & DURUM BİLGİSİ
  curY -= lineHeight - 1
  const isPaid = order.paymentStatus === 'PAID'
  const payStatusText = isPaid ? 'ODENDI (PAID)' : 'BEKLIYOR'
  page.drawText(`Odeme: ${payStatusText}`, {
    x: contentLeft,
    y: curY,
    size: smallSize,
    font: fontBold,
    color: isPaid ? rgb(0.1, 0.5, 0.1) : rgb(0.7, 0.4, 0.0),
  })

  // 4. MÜŞTERİ BİLGİLERİ (İSİM, TELEFON, İL/İLÇE, FATURA)
  curY -= lineHeight + 1
  const isCorporateNarrow = order.customerType === 'corporate' || order.billingInfo?.type === 'corporate'
  const recipientName = sanitizePdfText(
    order.shippingAddress?.fullName || order.customer?.name || 'Musteri'
  )
  page.drawText(`Alici: ${recipientName.slice(0, 24)}`, {
    x: contentLeft,
    y: curY,
    size: bodySize,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  // Fatura & Müşteri Türü
  curY -= lineHeight - 1.5
  if (isCorporateNarrow) {
    const vkn = order.billingInfo?.taxNumber ? maskVergiNo(order.billingInfo.taxNumber) : ''
    page.drawText(`Kurumsal | VKN: ${vkn || '-'}`, {
      x: contentLeft,
      y: curY,
      size: smallSize - 0.5,
      font: fontBold,
      color: rgb(0.1, 0.25, 0.65),
    })
  } else {
    const rawTc = order.billingInfo?.tcKimlikNo || ''
    const maskedTc = rawTc ? maskTCKimlik(rawTc) : ''
    page.drawText(`Bireysel ${maskedTc ? `| TC: ${maskedTc}` : ''}`, {
      x: contentLeft,
      y: curY,
      size: smallSize - 0.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    })
  }

  // Telefon (Ayarlarda açıksa)
  if (settings.showCustomerPhone) {
    const phone = sanitizePdfText(order.shippingAddress?.phone || order.customer?.phone || '')
    if (phone) {
      curY -= lineHeight - 1
      page.drawText(`Tel: ${phone}`, {
        x: contentLeft,
        y: curY,
        size: smallSize,
        font: fontRegular,
        color: rgb(0.2, 0.2, 0.2),
      })
    }
  }

  // İl / İlçe
  const city = sanitizePdfText(order.shippingAddress?.city || '')
  const town = sanitizePdfText(order.shippingAddress?.district || order.shippingAddress?.town || '')
  if (city || town) {
    curY -= lineHeight - 1
    page.drawText(`Bolge: ${town ? town + ' / ' : ''}${city}`, {
      x: contentLeft,
      y: curY,
      size: smallSize,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    })
  }

  // Ayırıcı çizgi
  curY -= 3
  page.drawLine({
    start: { x: contentLeft, y: curY },
    end: { x: contentRight, y: curY },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })

  // 5. ÜRÜN LİSTESİ TABLOSU
  curY -= 8
  page.drawText('URUNLER (HAZIRLAMA)', {
    x: contentLeft,
    y: curY,
    size: smallSize,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  const items = order.items || []
  let totalPieces = 0

  // Ürün alanı için ayrılan alt sınır (Footer ve imza alanından önce bitmeli)
  const bottomReserved = 54
  const minItemsY = boxY + bottomReserved
  let printedItemsCount = 0

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    totalPieces += item.quantity || 1

    // Ürün satırı sığıyor mu kontrolü
    if (curY - lineHeight < minItemsY) {
      continue
    }

    curY -= lineHeight
    printedItemsCount++

    const qtyStr = `${item.quantity || 1}x`
    page.drawText(qtyStr, {
      x: contentLeft,
      y: curY,
      size: bodySize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })

    const rawTitle = item.name || item.title || 'Urun'
    const cleanTitle = sanitizePdfText(rawTitle)
    const availableTitleChars = Math.floor(usableWidth / 4.8) - 4
    const truncatedTitle = cleanTitle.length > availableTitleChars
      ? cleanTitle.slice(0, availableTitleChars - 1) + '..'
      : cleanTitle

    page.drawText(truncatedTitle, {
      x: contentLeft + 14,
      y: curY,
      size: bodySize,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    // Varyant / Renk veya SKU gösterimi
    const variant = item.selectedColor?.name || item.selectedColor?.title || item.color || ''
    const sku = item.sku || ''
    const metaParts = []
    if (settings.showItemVariant && variant) metaParts.push(variant)
    if (settings.showItemSku && sku) metaParts.push(`SKU:${sku}`)

    if (metaParts.length > 0 && curY - (lineHeight - 2) >= minItemsY) {
      curY -= lineHeight - 2
      const metaText = sanitizePdfText(metaParts.join(' | ')).slice(0, 32)
      page.drawText(`- ${metaText}`, {
        x: contentLeft + 14,
        y: curY,
        size: smallSize - 0.5,
        font: fontOblique,
        color: rgb(0.4, 0.4, 0.4),
      })
    }
  }

  // Dinamik taşma uyarısı (Gerçekten sığmayan ürün adedi)
  const unprintedItemsCount = items.length - printedItemsCount
  if (unprintedItemsCount > 0) {
    curY -= lineHeight - 2
    page.drawText(`(+${unprintedItemsCount} diger urun)`, {
      x: contentLeft + 14,
      y: curY,
      size: smallSize - 0.5,
      font: fontBold,
      color: rgb(0.7, 0.2, 0.2),
    })
  }

  // 6. ALT BÖLÜM: TOPLAM ADET & PAKET METRİKLERİ
  const footerY = boxY + 38
  page.drawLine({
    start: { x: contentLeft, y: footerY + 8 },
    end: { x: contentRight, y: footerY + 8 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  })

  page.drawText(`Top. Urun: ${totalPieces} Adet`, {
    x: contentLeft,
    y: footerY,
    size: bodySize,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  // Fiyat Gösterimi (Yalnızca ayarlarda açıksa)
  if (settings.showPrice && (order.totalAmount || order.total)) {
    const priceVal = (order.totalAmount || order.total || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })
    const priceStr = `${priceVal} TL`
    page.drawText(priceStr, {
      x: contentRight - fontBold.widthOfTextAtSize(priceStr, bodySize),
      y: footerY,
      size: bodySize,
      font: fontBold,
      color: rgb(0, 0, 0),
    })
  }

  // Kargo & Paket Özeti (Doğru desi ve ağırlık hesabı - labelWidthMm türetimi kaldırıldı)
  const desiVal =
    typeof order.shipping?.desi === 'number' && order.shipping.desi > 0
      ? order.shipping.desi
      : typeof (order as any).desi === 'number' && (order as any).desi > 0
      ? (order as any).desi
      : (hepsijetSettings?.defaultDesi || 1)

  const weightVal =
    typeof order.shipping?.weight === 'number' && order.shipping.weight > 0
      ? order.shipping.weight
      : typeof (order as any).weight === 'number' && (order as any).weight > 0
      ? (order as any).weight
      : (hepsijetSettings?.defaultWeight || 0.3)

  page.drawText(`HepsiJET | Desi: ${desiVal} | ${weightVal}kg`, {
    x: contentLeft,
    y: footerY - 9,
    size: smallSize,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  })

  // 7. PAKETLEME KONTROL KUTUSU & HAZIRLAYAN KİŞİ ALANI
  if (settings.showPackerField) {
    const checklistY = boxY + 8

    // Kontrol kutusu karesi
    page.drawRectangle({
      x: contentLeft,
      y: checklistY + 1,
      width: 7,
      height: 7,
      borderWidth: 0.8,
      borderColor: rgb(0, 0, 0),
      color: rgb(1, 1, 1),
    })

    page.drawText('Kontrol Edildi', {
      x: contentLeft + 11,
      y: checklistY + 2,
      size: smallSize,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })

    // Hazırlayan imza çizgisi
    page.drawText('Hazirlayan: ______', {
      x: contentRight - fontRegular.widthOfTextAtSize('Hazirlayan: ______', smallSize),
      y: checklistY + 2,
      size: smallSize,
      font: fontRegular,
      color: rgb(0.2, 0.2, 0.2),
    })
  }
}

function formatDateShort(isoString?: string): string {
  if (!isoString) return ''
  try {
    const d = new Date(isoString)
    const day = String(d.getDate()).padStart(2, '0')
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const year = d.getFullYear()
    return `${day}.${month}.${year}`
  } catch {
    return ''
  }
}
