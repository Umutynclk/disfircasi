import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

interface SampleLabelOptions {
  barcode?: string
  trackingNumber?: string
  recipientName?: string
  recipientCity?: string
  recipientTown?: string
  recipientAddress?: string
  senderCompany?: string
  senderCity?: string
  desi?: number
  weight?: number
  packageCount?: number
}

/**
 * Verilen barkod veya takip numarasının simülasyon / test verisi olup olmadığını teyit eder.
 * Sahte barkodların veritabanına gerçek kargo barkodu olarak kaydedilmesini önler.
 */
export function isSampleBarcode(barcode?: string): boolean {
  if (!barcode) return false
  const upper = barcode.toUpperCase().trim()
  return (
    upper.startsWith('HJ-TEST-') ||
    upper === 'HJ9876543210TR' ||
    upper.includes('SIMUL') ||
    upper.includes('SAMPLE') ||
    upper.includes('TEST')
  )
}

/**
 * Test ve simülasyon aşamalarında termal yazıcı için gerçekçi, vektörel 100x100mm HepsiJET kargo etiketi PDF'i üretir.
 * Canlı API çağrısı yapmadan birleşik baskı sisteminin ve termal yazıcının test edilmesini sağlar.
 */
export async function createSampleHepsiJetLabelPdf(options: SampleLabelOptions = {}): Promise<Buffer> {
  const barcode = options.barcode || 'HJ-TEST-9876543210TR'
  const trackingNumber = options.trackingNumber || barcode
  const recipientName = sanitizePdfText(options.recipientName || 'Ahmet Yilmaz')
  const recipientCity = sanitizePdfText(options.recipientCity || 'ISTANBUL')
  const recipientTown = sanitizePdfText(options.recipientTown || 'KADIKOY')
  const recipientAddress = sanitizePdfText(options.recipientAddress || 'Caferaga Mah. Moda Cad. No: 42 D: 5 Kadikoy / ISTANBUL')
  const senderCompany = sanitizePdfText(options.senderCompany || 'KALIPORT')
  const senderCity = sanitizePdfText(options.senderCity || 'KONYA')
  const desi = options.desi ?? 1
  const weight = options.weight ?? 0.3
  const packageCount = options.packageCount ?? 1

  // 100mm x 100mm = 283.46 pt x 283.46 pt (1 mm = 72/25.4 pt)
  const sizePt = 283.465
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([sizePt, sizePt])

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

  // Arka plan & Dış Çerçeve
  page.drawRectangle({
    x: 4,
    y: 4,
    width: sizePt - 8,
    height: sizePt - 8,
    borderWidth: 1.5,
    borderColor: rgb(0, 0, 0),
    color: rgb(1, 1, 1),
  })

  // 1. ÜST BANT: HEPSIJET LOGO & TESLİMAT TİPİ
  page.drawRectangle({
    x: 4,
    y: sizePt - 42,
    width: sizePt - 8,
    height: 38,
    color: rgb(0.96, 0.45, 0.05), // HepsiJET Turuncusu
  })

  page.drawText('hepsijet', {
    x: 14,
    y: sizePt - 28,
    size: 20,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  page.drawText('STANDART TESLIMAT', {
    x: sizePt - 130,
    y: sizePt - 26,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  })

  // 2. HAT VE BÖLGE BİLGİSİ (KONYA -> İSTANBUL)
  page.drawRectangle({
    x: 4,
    y: sizePt - 78,
    width: sizePt - 8,
    height: 36,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: rgb(0.95, 0.95, 0.95),
  })

  page.drawText(`${senderCity.toUpperCase()}  >>  ${recipientCity.toUpperCase()}`, {
    x: 14,
    y: sizePt - 62,
    size: 13,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  page.drawText(`Varis Dagitim Merkezi: ${recipientTown.toUpperCase()}`, {
    x: 14,
    y: sizePt - 74,
    size: 8,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  })

  // 3. VEKTÖREL BARKOD ALANI (CODE 128 SİMÜLASYONU)
  const barcodeY = sizePt - 135
  const barcodeHeight = 44
  const barcodeStartX = 24
  const barcodeTotalWidth = sizePt - 48

  // Barkod Arka Planı (Quiet Zone)
  page.drawRectangle({
    x: barcodeStartX - 6,
    y: barcodeY - 2,
    width: barcodeTotalWidth + 12,
    height: barcodeHeight + 4,
    color: rgb(1, 1, 1),
  })

  // Belirli bir desene göre dikey çizgiler (Code 128 stili)
  const seed = barcode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  let curX = barcodeStartX
  let bitIdx = 0
  while (curX < barcodeStartX + barcodeTotalWidth) {
    const isBar = ((seed * (bitIdx + 3)) ^ (bitIdx * 7)) % 3 !== 0
    const barWidth = isBar ? (((bitIdx + seed) % 3) + 1.2) : (((bitIdx + 1) % 2) + 1.2)
    if (isBar && curX + barWidth <= barcodeStartX + barcodeTotalWidth) {
      page.drawRectangle({
        x: curX,
        y: barcodeY,
        width: Math.min(barWidth, 3.5),
        height: barcodeHeight,
        color: rgb(0, 0, 0),
      })
    }
    curX += barWidth + 0.8
    bitIdx++
  }

  // Barkod Numarası Metni (Açık simülasyon uyarısıyla)
  const barcodeLabelText = `* ${barcode} (NUMUNE) *`
  page.drawText(barcodeLabelText, {
    x: (sizePt - fontBold.widthOfTextAtSize(barcodeLabelText, 8.5)) / 2,
    y: barcodeY - 10,
    size: 8.5,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  // 4. ALICI (RECIPIENT) BİLGİLERİ KUTUSU
  const recipientBoxY = 62
  page.drawRectangle({
    x: 8,
    y: recipientBoxY,
    width: sizePt - 16,
    height: 75,
    borderWidth: 1,
    borderColor: rgb(0, 0, 0),
    color: rgb(1, 1, 1),
  })

  page.drawText('ALICI:', {
    x: 14,
    y: recipientBoxY + 62,
    size: 8,
    font: fontBold,
    color: rgb(0.3, 0.3, 0.3),
  })

  // Alıcı İsmi (Türkçe karakterleri güvenli ASCII eşleniğe dönüştür)
  const safeName = sanitizePdfText(recipientName)
  page.drawText(safeName, {
    x: 48,
    y: recipientBoxY + 60,
    size: 11,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  const safeAddress = sanitizePdfText(recipientAddress)
  const lines = wrapText(safeAddress, 42)
  lines.slice(0, 3).forEach((line, idx) => {
    page.drawText(line, {
      x: 14,
      y: recipientBoxY + 44 - idx * 11,
      size: 8,
      font: fontRegular,
      color: rgb(0, 0, 0),
    })
  })

  page.drawText(`${sanitizePdfText(recipientTown)} / ${sanitizePdfText(recipientCity)}`, {
    x: 14,
    y: recipientBoxY + 10,
    size: 9,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  // 5. GÖNDERİCİ & PAKET DETAYLARI (ALT BİLGİLER)
  page.drawLine({
    start: { x: 8, y: 56 },
    end: { x: sizePt - 8, y: 56 },
    thickness: 0.8,
    color: rgb(0.7, 0.7, 0.7),
  })

  page.drawText(`Gonderici: ${sanitizePdfText(senderCompany)} (${sanitizePdfText(senderCity)})`, {
    x: 10,
    y: 44,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.2, 0.2, 0.2),
  })

  page.drawText(`Desi: ${desi} | Agirlik: ${weight} kg | Koli: ${packageCount}`, {
    x: 10,
    y: 32,
    size: 7.5,
    font: fontBold,
    color: rgb(0, 0, 0),
  })

  page.drawText(`Takip No: ${trackingNumber}`, {
    x: 10,
    y: 20,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.3, 0.3, 0.3),
  })

  // Belirgin Numune / Test Filigranı
  const bannerText = 'NUMUNE / TEST - CANLI SEVKIYAT ICIN GECERSIZDIR'
  page.drawText(bannerText, {
    x: sizePt - fontBold.widthOfTextAtSize(bannerText, 6) - 10,
    y: 10,
    size: 6,
    font: fontBold,
    color: rgb(0.85, 0.2, 0.2),
  })

  const pdfBytes = await pdfDoc.save()
  return Buffer.from(pdfBytes)
}

/**
 * StandardFonts için Türkçe karakterleri güvenli Latin-1 karakterlerine eşler.
 */
export function sanitizePdfText(str?: string): string {
  if (!str) return ''
  return str
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
}

/**
 * Belirli karakter sınırında metni satırlara böler.
 */
export function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim()
    } else {
      if (currentLine) lines.push(currentLine)
      currentLine = word
    }
  }
  if (currentLine) lines.push(currentLine)
  return lines
}
