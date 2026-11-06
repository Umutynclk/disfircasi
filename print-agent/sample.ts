/**
 * KALIPORT PALMX TXP 400 Numune Etiket Üreticisi
 * Bağımsızdır; harici npm paketi gerektirmeden geçerli bir termal PDF üretir.
 */

export function createMinimalSampleLabelPdf(options: {
  barcode?: string
  widthMm?: number
  heightMm?: number
  recipientName?: string
  city?: string
} = {}): Buffer {
  const barcode = options.barcode || 'HJ-TEST-9876543210TR'
  const recipientName = options.recipientName || 'Ahmet Yilmaz'
  const city = options.city || 'ISTANBUL'
  const widthMm = options.widthMm || 150
  const heightMm = options.heightMm || 100

  // 1 mm = 72 / 25.4 pt
  const widthPt = (widthMm * 72) / 25.4
  const heightPt = (heightMm * 72) / 25.4

  const streamContent = `
q
1 1 1 rg
0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)} re f
0 0 0 RG
2 w
4 4 ${(widthPt - 8).toFixed(2)} ${(heightPt - 8).toFixed(2)} re S
0.96 0.45 0.05 rg
4 ${(heightPt - 38).toFixed(2)} ${(widthPt - 8).toFixed(2)} 34 re f
BT
/F1 18 Tf
1 1 1 rg
14 ${(heightPt - 26).toFixed(2)} Td
(hepsijet - NUMUNE TESTI) Tj
ET
BT
/F1 11 Tf
0 0 0 rg
14 ${(heightPt - 60).toFixed(2)} Td
(KONYA >> ${city}) Tj
ET
BT
/F1 9 Tf
0 0 0 rg
14 ${(heightPt - 80).toFixed(2)} Td
(Alici: ${recipientName}) Tj
ET
BT
/F1 12 Tf
0 0 0 rg
30 ${(heightPt - 130).toFixed(2)} Td
(* ${barcode} (NUMUNE) *) Tj
ET
BT
/F1 8 Tf
0.85 0.1 0.1 rg
14 15 Td
(NUMUNE / TEST - CANLI SEVKIYAT ICIN GECERSIZDIR - PALMX TXP 400) Tj
ET
Q
`.trim()

  const streamLength = Buffer.byteLength(streamContent, 'utf-8')

  const pdf = `%PDF-1.4
1 0 obj
<<
  /Type /Catalog
  /Pages 2 0 R
>>
endobj

2 0 obj
<<
  /Type /Pages
  /Kids [3 0 R]
  /Count 1
>>
endobj

3 0 obj
<<
  /Type /Page
  /Parent 2 0 R
  /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}]
  /Resources <<
    /Font <<
      /F1 <<
        /Type /Font
        /Subtype /Type1
        /BaseFont /Helvetica-Bold
      >>
    >>
  >>
  /Contents 4 0 R
>>
endobj

4 0 obj
<<
  /Length ${streamLength}
>>
stream
${streamContent}
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000318 00000 n 
trailer
<<
  /Size 5
  /Root 1 0 R
>>
startxref
${400 + streamLength}
%%EOF`

  return Buffer.from(pdf, 'utf-8')
}
