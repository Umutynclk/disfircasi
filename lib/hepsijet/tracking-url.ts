/**
 * lib/hepsijet/tracking-url.ts
 *
 * Client-safe HepsiJET takip URL oluşturucu.
 * Browser veya server tarafında hiçbir Node/Admin bağımlılığı olmadan çalışır.
 */

export function buildHepsiJetTrackingUrl(barcode: string): string {
  if (!barcode) return ''
  return `https://hepsijet.com/gonderi-takibi/${encodeURIComponent(barcode.trim())}`
}

