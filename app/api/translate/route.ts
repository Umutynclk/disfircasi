import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { text, targets } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 })
    }

    // Basic AI / Dictionary Translation Map
    const translations: Record<string, string> = {
      en: text,
      de: text,
      fr: text,
    }

    const lower = text.toLowerCase().trim()

    // Key translations map
    if (lower.includes('otomatik diş fırçası')) {
      translations.en = text.replace(/Otomatik Diş Fırçası/gi, 'Automatic Toothbrush').replace(/otomatik diş fırçası/gi, 'automatic toothbrush')
      translations.de = text.replace(/Otomatik Diş Fırçası/gi, 'Automatische Zahnbürste').replace(/otomatik diş fırçası/gi, 'automatische zahnbürste')
      translations.fr = text.replace(/Otomatik Diş Fırçası/gi, 'Brosse à dents automatique').replace(/otomatik diş fırçası/gi, 'brosse à dents automatique')
    } else if (lower.includes('kullan at') || lower.includes('kullan-at')) {
      translations.en = text.replace(/Kullan At Diş Fırçası/gi, 'Disposable Toothbrush').replace(/kullan at/gi, 'disposable')
      translations.de = text.replace(/Kullan At Diş Fırçası/gi, 'Einweg-Zahnbürste').replace(/kullan at/gi, 'einweg')
      translations.fr = text.replace(/Kullan At Diş Fırçası/gi, 'Brosse à dents jetable').replace(/kullan at/gi, 'jetable')
    } else if (lower === 'satın al') {
      translations.en = 'Buy Now'
      translations.de = 'Jetzt kaufen'
      translations.fr = 'Acheter maintenant'
    } else if (lower.includes('dünyanin ilk')) {
      translations.en = text.replace(/DÜNYANIN İLK/gi, "WORLD'S FIRST")
      translations.de = text.replace(/DÜNYANIN İLK/gi, 'DIE ERSTE DER WELT')
      translations.fr = text.replace(/DÜNYANIN İLK/gi, 'PREMIÈRE AU MONDE')
    } else if (lower.includes('dönebilen diş fırçası')) {
      translations.en = text.replace(/DÖNEBİLEN DİŞ FIRÇASI/gi, 'ROTATING TOOTHBRUSH')
      translations.de = text.replace(/DÖNEBİLEN DİŞ FIRÇASI/gi, 'ZAHNBÜRSTE MIT ROTATION')
      translations.fr = text.replace(/DÖNEBİLEN DİŞ FIRÇASI/gi, 'BROSSE À DENTS ROTATIVE')
    } else if (lower.includes('başlik değişmeli')) {
      translations.en = text.replace(/BAŞLIK DEĞİŞMELİ/gi, 'REPLACEABLE HEAD')
      translations.de = text.replace(/BAŞLIK DEĞİŞMELİ/gi, 'AUSTAUSCHBARER KOPF')
      translations.fr = text.replace(/BAŞLIK DEĞİŞMELİ/gi, 'TÊTE INTERCHANGEABLE')
    }

    return NextResponse.json(translations)
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Translation failed' }, { status: 500 })
  }
}
