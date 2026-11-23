import { ConsentChannel, ConsentRecord, KvkkDocumentType } from './types'

export type ConsentPreferenceKey =
  | 'acik_riza'
  | 'ticari_ileti_sms'
  | 'ticari_ileti_email'
  | 'ticari_ileti_phone'

export const CONSENT_PREFERENCE_KEYS: ConsentPreferenceKey[] = [
  'acik_riza',
  'ticari_ileti_sms',
  'ticari_ileti_email',
  'ticari_ileti_phone',
]

export interface ConsentPreferenceEntry {
  key: ConsentPreferenceKey
  granted: boolean
  docType: 'acik_riza' | 'ticari_ileti'
  channel: ConsentChannel
  purpose: string
  docVersion: number
  grantedAt?: string
  withdrawnAt?: string
  updatedAt?: string
  recordId?: string
}

export type NormalizedConsentPreferences = Record<ConsentPreferenceKey, ConsentPreferenceEntry>

export const CONSENT_PREFERENCE_META: Record<
  ConsentPreferenceKey,
  {
    docType: 'acik_riza' | 'ticari_ileti'
    channel: ConsentChannel
    defaultPurpose: string
    label: string
    activeLabel: string
    inactiveLabel: string
    description: string
  }
> = {
  acik_riza: {
    docType: 'acik_riza',
    channel: 'web',
    defaultPurpose: 'personalized_marketing',
    label: 'Açık Rıza (Kişiselleştirilmiş Öneri & Analiz)',
    activeLabel: 'Onaylandı',
    inactiveLabel: 'Onay verilmedi',
    description: 'Alışveriş tercihlerinize göre kişiselleştirilmiş ürün önerileri ve analiz faaliyetleri.',
  },
  ticari_ileti_email: {
    docType: 'ticari_ileti',
    channel: 'email',
    defaultPurpose: 'commercial_electronic_message_email',
    label: 'E-posta İzni',
    activeLabel: 'Açık',
    inactiveLabel: 'Kapalı',
    description: 'Kampanya, indirim ve duyuru iletilerinin e-posta yoluyla gönderilmesi.',
  },
  ticari_ileti_sms: {
    docType: 'ticari_ileti',
    channel: 'sms',
    defaultPurpose: 'commercial_electronic_message_sms',
    label: 'SMS İzni',
    activeLabel: 'Açık',
    inactiveLabel: 'Kapalı',
    description: 'Kampanya, indirim ve duyuru iletilerinin SMS yoluyla gönderilmesi.',
  },
  ticari_ileti_phone: {
    docType: 'ticari_ileti',
    channel: 'phone',
    defaultPurpose: 'commercial_electronic_message_phone',
    label: 'Telefon İzni',
    activeLabel: 'Açık',
    inactiveLabel: 'Kapalı',
    description: 'Kampanya, indirim ve bilgilendirme amaçlı telefon aramaları.',
  },
}

/**
 * Verilen docType + channel çiftini kanonik izin anahtarına dönüştürür.
 */
export function resolveConsentPreferenceKey(
  docType: KvkkDocumentType | string,
  channel?: ConsentChannel | string,
  explicitKey?: string
): ConsentPreferenceKey | null {
  if (explicitKey && CONSENT_PREFERENCE_KEYS.includes(explicitKey as ConsentPreferenceKey)) {
    return explicitKey as ConsentPreferenceKey
  }
  if (docType === 'acik_riza') return 'acik_riza'
  if (docType === 'ticari_ileti') {
    const ch = String(channel || '').toLowerCase()
    if (ch === 'sms') return 'ticari_ileti_sms'
    if (ch === 'phone') return 'ticari_ileti_phone'
    return 'ticari_ileti_email'
  }
  return null
}

export function createEmptyConsentPreferences(): NormalizedConsentPreferences {
  const result = {} as NormalizedConsentPreferences
  for (const key of CONSENT_PREFERENCE_KEYS) {
    const meta = CONSENT_PREFERENCE_META[key]
    result[key] = {
      key,
      granted: false,
      docType: meta.docType,
      channel: meta.channel,
      purpose: meta.defaultPurpose,
      docVersion: 1,
    }
  }
  return result
}

function toTimestampMs(iso?: string): number {
  if (!iso) return 0
  const parsed = Date.parse(iso)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Tek güvenilir izin durumu çözücüsü:
 * 1. Kullanıcının users/{uid}.consentPreferences nesnesini okur.
 * 2. Eski Firestore dot-key hatasıyla yazılmış ("consentPreferences.acik_riza" gibi) alanları kurtarır.
 * 3. Değiştirilemez `consent_records` denetim geçmişini kronolojik olarak uzlaştırır.
 *
 * ÖNEMLİ HUKUKİ KURAL:
 * - Yalnızca gerçek `consent_granted` ve `consent_withdrawn` kayıtları dikkate alınır.
 * - `notice_shown` veya `contract_confirmed` kayıtlarından ASLA açık rıza veya ticari ileti izni çıkarılmaz.
 */
export function resolveUserConsentPreferences(
  userDocData?: Record<string, any> | null,
  auditRecords?: Array<Partial<ConsentRecord> & { consentKey?: string }>
): NormalizedConsentPreferences {
  const prefs = createEmptyConsentPreferences()
  const lastUpdatedMs: Record<ConsentPreferenceKey, number> = {
    acik_riza: 0,
    ticari_ileti_sms: 0,
    ticari_ileti_email: 0,
    ticari_ileti_phone: 0,
  }

  const applyCandidate = (
    key: ConsentPreferenceKey,
    candidate: {
      granted: boolean
      docVersion?: number
      purpose?: string
      grantedAt?: string
      withdrawnAt?: string
      updatedAt?: string
      recordId?: string
    }
  ) => {
    const ts = toTimestampMs(candidate.updatedAt || candidate.withdrawnAt || candidate.grantedAt)
    // Aynı veya daha yeni zaman damgalı kayıt kazanır (eşitse geri çekme lehine güvenlik önceliği)
    if (ts > lastUpdatedMs[key] || (ts === lastUpdatedMs[key] && !candidate.granted)) {
      lastUpdatedMs[key] = ts
      const meta = CONSENT_PREFERENCE_META[key]
      prefs[key] = {
        key,
        granted: Boolean(candidate.granted),
        docType: meta.docType,
        channel: meta.channel,
        purpose: candidate.purpose || meta.defaultPurpose,
        docVersion: Number(candidate.docVersion) || 1,
        grantedAt: candidate.granted ? candidate.grantedAt || candidate.updatedAt : prefs[key].grantedAt,
        withdrawnAt: !candidate.granted ? candidate.withdrawnAt || candidate.updatedAt : undefined,
        updatedAt: candidate.updatedAt || candidate.withdrawnAt || candidate.grantedAt,
        recordId: candidate.recordId,
      }
    }
  }

  // 1. Nested consentPreferences alanı
  const nested = userDocData?.consentPreferences
  if (nested && typeof nested === 'object') {
    for (const key of CONSENT_PREFERENCE_KEYS) {
      const entry = nested[key]
      if (entry && typeof entry === 'object' && typeof entry.granted === 'boolean') {
        applyCandidate(key, {
          granted: entry.granted,
          docVersion: entry.docVersion,
          purpose: entry.purpose,
          grantedAt: entry.grantedAt || (entry.granted ? entry.updatedAt : undefined),
          withdrawnAt: entry.withdrawnAt,
          updatedAt: entry.updatedAt,
          recordId: entry.recordId,
        })
      }
    }

    // Geriye dönük uyumluluk: eski tekli `consentPreferences.ticari_ileti` alanı
    const legacyCommercial = nested.ticari_ileti
    if (legacyCommercial && typeof legacyCommercial === 'object' && typeof legacyCommercial.granted === 'boolean') {
      const mappedKey = resolveConsentPreferenceKey('ticari_ileti', legacyCommercial.channel || 'email')
      if (mappedKey) {
        applyCandidate(mappedKey, {
          granted: legacyCommercial.granted,
          docVersion: legacyCommercial.docVersion,
          purpose: legacyCommercial.purpose,
          grantedAt: legacyCommercial.granted ? legacyCommercial.updatedAt : undefined,
          withdrawnAt: legacyCommercial.withdrawnAt,
          updatedAt: legacyCommercial.updatedAt,
          recordId: legacyCommercial.recordId,
        })
      }
    }
  }

  // 2. Eski set(..., { merge: true }) dot-key bug kurtarma ("consentPreferences.acik_riza" vb.)
  if (userDocData && typeof userDocData === 'object') {
    const legacyDottedEntries: Array<[string, ConsentPreferenceKey | null]> = [
      ['consentPreferences.acik_riza', 'acik_riza'],
      ['consentPreferences.ticari_ileti_email', 'ticari_ileti_email'],
      ['consentPreferences.ticari_ileti_sms', 'ticari_ileti_sms'],
      ['consentPreferences.ticari_ileti_phone', 'ticari_ileti_phone'],
      ['consentPreferences.ticari_ileti', null],
    ]
    for (const [fieldName, fixedKey] of legacyDottedEntries) {
      const entry = userDocData[fieldName]
      if (entry && typeof entry === 'object' && typeof entry.granted === 'boolean') {
        const mappedKey = fixedKey || resolveConsentPreferenceKey('ticari_ileti', entry.channel || 'email')
        if (mappedKey) {
          applyCandidate(mappedKey, {
            granted: entry.granted,
            docVersion: entry.docVersion,
            purpose: entry.purpose,
            grantedAt: entry.granted ? entry.updatedAt : undefined,
            withdrawnAt: entry.withdrawnAt,
            updatedAt: entry.updatedAt,
            recordId: entry.recordId,
          })
        }
      }
    }
  }

  // 3. Immutable `consent_records` denetim kayıtları (kronolojik)
  if (Array.isArray(auditRecords) && auditRecords.length > 0) {
    const sorted = [...auditRecords].sort(
      (a, b) => toTimestampMs(a.createdAt) - toTimestampMs(b.createdAt)
    )
    for (const rec of sorted) {
      // Sadece gerçek rıza verme / geri çekme olayları; notice_shown ve contract_confirmed ASLA rıza sayılmaz!
      if (rec.eventType !== 'consent_granted' && rec.eventType !== 'consent_withdrawn') {
        continue
      }
      const key = resolveConsentPreferenceKey(rec.docType || '', rec.channel, rec.consentKey)
      if (!key) continue
      const isGranted = rec.eventType === 'consent_granted'
      applyCandidate(key, {
        granted: isGranted,
        docVersion: rec.docVersion,
        purpose: rec.purpose,
        grantedAt: isGranted ? rec.createdAt : undefined,
        withdrawnAt: !isGranted ? rec.withdrawnAt || rec.createdAt : undefined,
        updatedAt: rec.withdrawnAt || rec.createdAt,
        recordId: rec.id,
      })
    }
  }

  return prefs
}
