/**
 * Saf TypeScript Code128B Barcode SVG Üreteci
 * Dış bağımlılık gerektirmez, termal etiket ve lazer yazıcılar için 100% taranabilir net SVG üretir.
 */

const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
]

const START_CODE_B = 104
const STOP_CODE = 106

export function generateBarcodeSvg(text: string, height = 60, barWidth = 2): string {
  if (!text) return ''

  const safeText = text.replace(/[^\x20-\x7E]/g, '')
  const codes: number[] = [START_CODE_B]

  for (let i = 0; i < safeText.length; i++) {
    codes.push(safeText.charCodeAt(i) - 32)
  }

  // Checksum hesapla
  let checksum = START_CODE_B
  for (let i = 1; i < codes.length; i++) {
    checksum += codes[i] * i
  }
  codes.push(checksum % 103)
  codes.push(STOP_CODE)

  // Pattern'e dönüştür
  let binaryString = ''
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || ''
    for (let j = 0; j < pattern.length; j++) {
      const count = parseInt(pattern[j], 10)
      const bit = j % 2 === 0 ? '1' : '0'
      binaryString += bit.repeat(count)
    }
  }

  const quietZone = 10
  const totalWidth = binaryString.length * barWidth + quietZone * 2

  // SVG bar çizimleri
  let x = quietZone
  const rects: string[] = []

  for (let i = 0; i < binaryString.length; i++) {
    if (binaryString[i] === '1') {
      rects.push(`<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="#000000" />`)
    }
    x += barWidth
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${height}" width="100%" height="${height}" preserveAspectRatio="none">
    ${rects.join('')}
  </svg>`
}
