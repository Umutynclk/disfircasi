export type DataDisposalAction = 'delete' | 'anonymize' | 'retain_restricted'

export interface DataRetentionCategory {
  id: string
  label: string
  action: DataDisposalAction
  actionLabel: string
  purpose: string
  legalBasis: string
  retentionPeriod: string
  details: string
}

/**
 * 6698 sayılı KVKK m. 7 & m. 13 ve Kişisel Verilerin Silinmesi, Yok Edilmesi
 * veya Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca veri kategorisi bazlı
 * saklama ve imha matrisi.
 */
export const DATA_RETENTION_MATRIX: DataRetentionCategory[] = [
  {
    id: 'profile_account',
    label: 'Kullanıcı Hesabı ve Profil Bilgileri',
    action: 'delete',
    actionLabel: 'Silinir (Hesap Kapatılır)',
    purpose: 'Üyelik yönetimi ve kimlik doğrulama',
    legalBasis: 'KVKK m. 5/2-c (Sözleşmenin kurulması/ifası) — hesap kapatma ile sona erer',
    retentionPeriod: 'Hesap silme talebinde derhâl',
    details: 'Firebase Authentication hesabı ve Firestore `users/{uid}` profil dokümanı silinir, aktif oturumlar iptal edilir.',
  },
  {
    id: 'addresses',
    label: 'Kayıtlı Teslimat ve Fatura Adresleri',
    action: 'delete',
    actionLabel: 'Silinir',
    purpose: 'Hızlı teslimat ve fatura adresi seçimi',
    legalBasis: 'KVKK m. 5/2-c — üyelik sona erdiğinde işleme amacı ortadan kalkar',
    retentionPeriod: 'Hesap silme talebinde derhâl',
    details: 'Kullanıcı profilindeki `savedAddresses` listesi ve kullanıcı alt koleksiyonlarındaki adres kayıtları silinir.',
  },
  {
    id: 'cart_favorites',
    label: 'Sepet ve Favoriler',
    action: 'delete',
    actionLabel: 'Silinir',
    purpose: 'Alışveriş deneyiminin sürdürülmesi',
    legalBasis: 'KVKK m. 5/2-f (Meşru menfaat) — hesap kapatma ile sona erer',
    retentionPeriod: 'Hesap silme talebinde derhâl',
    details: 'Tarayıcıdaki yerel sepet verisi ve varsa kullanıcı alt koleksiyonundaki sepet/favori kayıtları temizlenir.',
  },
  {
    id: 'user_preferences',
    label: 'Kullanıcı Tercihleri ve Güncel İzin Durumu',
    action: 'delete',
    actionLabel: 'Silinir',
    purpose: 'Aktif iletişim ve kişiselleştirme tercihleri',
    legalBasis: 'KVKK m. 5/1 (Açık rıza) — hesap kapatma ile aktif izinler sonlandırılır',
    retentionPeriod: 'Hesap silme talebinde derhâl',
    details: 'Aktif iletişim/kişiselleştirme tercihleri silinir; pazarlama veya profilleme gönderimi yapılmaz.',
  },
  {
    id: 'consent_audit_records',
    label: 'KVKK Aydınlatma ve Rıza İspat Kayıtları',
    action: 'retain_restricted',
    actionLabel: 'Hukuki İspat İçin Kısıtlı Saklanır',
    purpose: 'Açık rıza, aydınlatma ve ret/geri çekme ispatı',
    legalBasis: '6698 sayılı KVKK m. 5/2-ç & 6563 sayılı ETK / Yönetmelik ispat yükümlülüğü',
    retentionPeriod: 'Onayın geçerliliğinin sona ermesinden itibaren en az 3 yıl (uyuşmazlık zamanaşımına kadar en fazla 10 yıl)',
    details: 'Değiştirilemez denetim kayıtları yalnızca yetkili erişimle saklanır; pazarlama amacıyla kullanılmaz.',
  },
  {
    id: 'orders_payments',
    label: 'Sipariş ve Ödeme Kayıtları',
    action: 'retain_restricted',
    actionLabel: 'Yasal Zorunlulukla Kısıtlı Saklanır',
    purpose: 'Mesafeli satış sözleşmesi ifası, ödeme mutabakatı ve yasal zamanaşımı',
    legalBasis: '6102 sayılı TTK m. 82, 6502 sayılı TKHK ve 6098 sayılı TBK m. 146',
    retentionPeriod: '10 yıl',
    details: 'Siparişler silinmez; kullanıcı hesabı kapatıldı olarak işaretlenir ve erişimi yalnızca yetkili operasyon/hukuk süreçleriyle sınırlandırılır.',
  },
  {
    id: 'invoices_accounting',
    label: 'Fatura ve Muhasebe Belgeleri',
    action: 'retain_restricted',
    actionLabel: 'Yasal Zorunlulukla Kısıtlı Saklanır',
    purpose: 'Vergi ve ticaret mevzuatı uyarınca belge saklama',
    legalBasis: '213 sayılı VUK m. 253 (5 yıl) ve 6102 sayılı TTK m. 82 (10 yıl)',
    retentionPeriod: '5–10 yıl (Vergi ve Ticaret Kanunu)',
    details: 'Fatura ve vergi kimlik bilgileri yasal saklama süresi boyunca korunur; süresi dolduğunda periyodik imha kapsamında silinir/anonimleştirilir.',
  },
  {
    id: 'returns_disputes',
    label: 'Devam Eden Teslimat, İade ve Uyuşmazlık Kayıtları',
    action: 'retain_restricted',
    actionLabel: 'Süreç Tamamlanana ve Zamanaşımı Süresince Saklanır',
    purpose: 'Kargo teslimatı, iade/geri ödeme ve tüketici hakem heyeti süreçleri',
    legalBasis: '6502 sayılı TKHK ve KVKK m. 5/2-e (Bir hakkın tesisi, kullanılması veya korunması)',
    retentionPeriod: 'Süreç tamamlanana ve yasal zamanaşımı süresi (10 yıl) dolana kadar',
    details: 'Devam eden kargo (HepsiJET) veya iade süreçleri hesap silme işleminden olumsuz etkilenmez.',
  },
  {
    id: 'storage_fcm',
    label: 'Kullanıcı Dosyaları (Storage) ve Bildirim (FCM) Tokenları',
    action: 'delete',
    actionLabel: 'Silinir',
    purpose: 'Kullanıcıya özel dosya depolama ve anlık bildirim',
    legalBasis: 'KVKK m. 5/2-c & m. 5/1 — hesap kapatma ile sona erer',
    retentionPeriod: 'Hesap silme talebinde derhâl',
    details: 'Yalnızca ilgili kullanıcıya ait `users/{uid}/` depolama nesneleri ve bildirim tokenları silinir; ürün görsellerine ve diğer kullanıcılara dokunulmaz.',
  },
  {
    id: 'third_party_processors',
    label: 'Üçüncü Taraf Hizmet Sağlayıcılar (PayTR, iyzico, HepsiJET)',
    action: 'retain_restricted',
    actionLabel: 'Sağlayıcı Mevzuatına Tabi (Bilgilendirme / Bildirim)',
    purpose: 'Ödeme aracılığı ve kargo taşımacılığı',
    legalBasis: '6493 sayılı Ödeme Hizmetleri Kanunu, 4925 sayılı Karayolu Taşıma Kanunu, BDDK/TCMB mevzuatı',
    retentionPeriod: 'İlgili sağlayıcıların tabi olduğu yasal saklama süreleri (genellikle 5–10 yıl)',
    details: 'Ödeme ve kargo sağlayıcılarına aktarılan işlem verileri ilgili özel mevzuat kapsamında saklanır; pazarlama amacıyla kullanılmaz.',
  },
]

export const ACCOUNT_DELETION_CONFIRMATION_PHRASE = 'HESABIMI SİL'
export const RECENT_AUTH_MAX_AGE_SECONDS = 300 // 5 dakika
export const KVKK_RESPONSE_DEADLINE_DAYS = 30

export function verifyRecentReauth(authTimeSeconds?: number, nowSeconds?: number): {
  ok: boolean
  ageSeconds: number
} {
  const now = nowSeconds ?? Math.floor(Date.now() / 1000)
  if (!authTimeSeconds || !Number.isFinite(authTimeSeconds)) {
    return { ok: false, ageSeconds: Infinity }
  }
  const ageSeconds = Math.max(0, now - authTimeSeconds)
  return {
    ok: ageSeconds <= RECENT_AUTH_MAX_AGE_SECONDS,
    ageSeconds,
  }
}

export function validateAccountDeletionRequest(input: {
  authenticatedUid?: string | null
  requestedTargetUid?: string | null
  confirmationText?: string
  authTimeSeconds?: number
  nowSeconds?: number
}): { valid: boolean; code?: string; error?: string } {
  if (!input.authenticatedUid) {
    return { valid: false, code: 'UNAUTHENTICATED', error: 'Oturum doğrulaması gereklidir.' }
  }
  if (input.requestedTargetUid && input.requestedTargetUid !== input.authenticatedUid) {
    return {
      valid: false,
      code: 'FORBIDDEN_TARGET',
      error: 'Yalnızca kendi hesabınızı silebilirsiniz.',
    }
  }
  if ((input.confirmationText || '').trim().toUpperCase() !== ACCOUNT_DELETION_CONFIRMATION_PHRASE) {
    return {
      valid: false,
      code: 'INVALID_CONFIRMATION',
      error: `İşlemi onaylamak için "${ACCOUNT_DELETION_CONFIRMATION_PHRASE}" yazmalısınız.`,
    }
  }
  const reauth = verifyRecentReauth(input.authTimeSeconds, input.nowSeconds)
  if (!reauth.ok) {
    return {
      valid: false,
      code: 'REAUTH_REQUIRED',
      error: 'Güvenliğiniz için hesabınızı silmeden önce şifrenizle kimliğinizi yeniden doğrulamanız gerekir.',
    }
  }
  return { valid: true }
}

/**
 * Kullanıcının siparişlerini aktif (devam eden teslimat/iade) ve geçmiş (yasal saklama)
 * olarak sınıflandırır.
 */
export function classifyUserOrdersForDeletion(orders: Array<Record<string, any>>): {
  activeOrders: Array<{ id: string; orderNumber: string; status: string }>
  historicalOrders: Array<{ id: string; orderNumber: string; status: string }>
} {
  const activeOrders: Array<{ id: string; orderNumber: string; status: string }> = []
  const historicalOrders: Array<{ id: string; orderNumber: string; status: string }> = []

  for (const order of orders) {
    const rawStatus = String(order.status || '').toLowerCase()
    const rawShipStatus = String(order.shipping?.status || '').toLowerCase()
    const hasOpenReturn =
      Array.isArray(order.returnRequests) &&
      order.returnRequests.some(
        (r: any) => !['completed', 'refunded', 'rejected', 'cancelled'].includes(String(r?.status || '').toLowerCase())
      )

    const isClosed =
      !hasOpenReturn &&
      (rawStatus === 'delivered' ||
        rawStatus === 'completed' ||
        rawStatus === 'cancelled' ||
        rawStatus === 'refunded' ||
        rawShipStatus === 'delivered' ||
        rawShipStatus === 'cancelled')

    const summary = {
      id: String(order.id || ''),
      orderNumber: String(order.orderNumber || order.id || ''),
      status: String(order.status || 'unknown'),
    }

    if (isClosed) {
      historicalOrders.push(summary)
    } else {
      activeOrders.push(summary)
    }
  }

  return { activeOrders, historicalOrders }
}

/**
 * Silme denetim kayıtlarında ham UID veya kişisel veri (ad, e-posta, telefon)
 * saklamak yerine ortamdan bağımsız (Node/Browser uyumlu) tek yönlü özet üretir.
 */
export function hashUserIdentifier(uid: string): string {
  const input = `sonrakam-erasure:${uid}`
  const seeds = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]
  let hex = ''
  for (let s = 0; s < seeds.length; s++) {
    let h = seeds[s] >>> 0
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i) + s * 31
      h = Math.imul(h, 0x01000193) >>> 0
    }
    hex += h.toString(16).padStart(8, '0')
  }
  return hex
}

export function calculateKvkkDeadlineIso(fromIso: string): string {
  const baseMs = Date.parse(fromIso)
  const safeMs = Number.isFinite(baseMs) ? baseMs : Date.now()
  return new Date(safeMs + KVKK_RESPONSE_DEADLINE_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export interface ErasureAuditRecord {
  requestRef: string
  uidHash: string
  requestedAt: string
  completedAt?: string
  kvkkDeadlineAt: string
  status: 'in_progress' | 'completed' | 'partial_retry_required'
  stepsCompleted: string[]
  stepsFailed: string[]
  deletedCategories: string[]
  retainedCategories: string[]
  activeOrdersPreservedCount: number
  historicalOrdersRetainedCount: number
  thirdPartyNotificationNote: string
}

/**
 * Kişisel veri (PII) İÇERMEYEN asgari KVKK silme/imha denetim kaydı oluşturur.
 */
export function buildErasureAuditRecord(params: {
  requestRef: string
  uid: string
  requestedAt: string
  completedAt?: string
  status: ErasureAuditRecord['status']
  stepsCompleted: string[]
  stepsFailed: string[]
  activeOrdersPreservedCount: number
  historicalOrdersRetainedCount: number
}): ErasureAuditRecord {
  return {
    requestRef: params.requestRef,
    uidHash: hashUserIdentifier(params.uid),
    requestedAt: params.requestedAt,
    completedAt: params.completedAt,
    kvkkDeadlineAt: calculateKvkkDeadlineIso(params.requestedAt),
    status: params.status,
    stepsCompleted: params.stepsCompleted,
    stepsFailed: params.stepsFailed,
    deletedCategories: DATA_RETENTION_MATRIX.filter((c) => c.action === 'delete').map((c) => c.id),
    retainedCategories: DATA_RETENTION_MATRIX.filter((c) => c.action !== 'delete').map((c) => c.id),
    activeOrdersPreservedCount: params.activeOrdersPreservedCount,
    historicalOrdersRetainedCount: params.historicalOrdersRetainedCount,
    thirdPartyNotificationNote:
      'Ödeme (PayTR/iyzico) ve kargo (HepsiJET) sağlayıcılarındaki işlem verileri kendi özel yasal saklama sürelerine tabidir; pazarlama/profilleme amaçlı kullanılmaz.',
  }
}
