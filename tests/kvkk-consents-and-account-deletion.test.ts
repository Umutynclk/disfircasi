import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import {
  CONSENT_PREFERENCE_KEYS,
  resolveConsentPreferenceKey,
  resolveUserConsentPreferences,
} from '../lib/kvkk/consents'
import {
  ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  DATA_RETENTION_MATRIX,
  buildErasureAuditRecord,
  calculateKvkkDeadlineIso,
  classifyUserOrdersForDeletion,
  hashUserIdentifier,
  validateAccountDeletionRequest,
  verifyRecentReauth,
} from '../lib/kvkk/accountDeletion'

const ROOT = path.resolve(__dirname, '..')
const read = (relPath: string) => fs.readFileSync(path.join(ROOT, relPath), 'utf8')

// =========================================================================
// 1. UI "İSTEĞE BAĞLI" İBARESİ KALDIRMA & ZORUNSUZLUK TESTLERİ
// =========================================================================

test('UI-1: Kayıt ve satın alma ekranlarında "İsteğe bağlı" ibaresi görünmez ama izinler varsayılan boş ve zorunsuz kalır', () => {
  const registerSrc = read('app/kayit/page.tsx')
  const checkoutSrc = read('app/satin-al/page.tsx')

  assert.ok(!registerSrc.includes('(İsteğe bağlı)'), 'Kayıt ekranında "(İsteğe bağlı)" yazısı olmamalı')
  assert.ok(!checkoutSrc.includes('(İsteğe bağlı)'), 'Satın alma ekranında "(İsteğe bağlı)" yazısı olmamalı')
  assert.ok(!checkoutSrc.includes('İsteğe Bağlı İzinler'), 'Satın alma ekranında "İsteğe Bağlı İzinler" başlığı olmamalı')

  // Varsayılan tüm izin state'leri false olmalı
  assert.ok(registerSrc.includes('useState(false)'), 'Kayıt izin kutuları varsayılan boş (false) başlamalı')
  assert.ok(checkoutSrc.includes('const [explicitConsent, setExplicitConsent] = useState(false)'))
  assert.ok(checkoutSrc.includes('const [commercialEmailConsent, setCommercialEmailConsent] = useState(false)'))
  assert.ok(checkoutSrc.includes('const [commercialSmsConsent, setCommercialSmsConsent] = useState(false)'))
  assert.ok(checkoutSrc.includes('const [commercialPhoneConsent, setCommercialPhoneConsent] = useState(false)'))
})

// =========================================================================
// 2. İZİN SENKRONİZASYONU, KANAL AYRIMI VE ESKİ KAYIT KURTARMA TESTLERİ
// =========================================================================

test('CONSENT-1: Kayıtta verilen açık rıza ve kanal bazlı (SMS/E-posta/Telefon) izinler doğru çözülür', () => {
  const prefs = resolveUserConsentPreferences(
    {
      consentPreferences: {
        acik_riza: { granted: true, docVersion: 2, grantedAt: '2026-11-23T10:00:00.000Z', updatedAt: '2026-11-23T10:00:00.000Z' },
        ticari_ileti_sms: { granted: true, docVersion: 1, grantedAt: '2026-11-23T10:00:00.000Z', updatedAt: '2026-11-23T10:00:00.000Z' },
        ticari_ileti_email: { granted: true, docVersion: 1, grantedAt: '2026-11-23T10:00:00.000Z', updatedAt: '2026-11-23T10:00:00.000Z' },
      },
    },
    []
  )

  assert.equal(prefs.acik_riza.granted, true)
  assert.equal(prefs.acik_riza.docVersion, 2)
  assert.equal(prefs.ticari_ileti_sms.granted, true)
  assert.equal(prefs.ticari_ileti_email.granted, true)
  assert.equal(prefs.ticari_ileti_phone.granted, false)
})

test('CONSENT-2: Eski Firestore dot-key hatasıyla yazılmış izin kayıtları profilde doğru kurtarılır', () => {
  const legacyUserDoc = {
    'consentPreferences.acik_riza': {
      granted: true,
      docVersion: 1,
      channel: 'web',
      updatedAt: '2026-11-22T09:00:00.000Z',
    },
    'consentPreferences.ticari_ileti': {
      granted: true,
      docVersion: 1,
      channel: 'email',
      updatedAt: '2026-11-22T09:00:00.000Z',
    },
  }

  const prefs = resolveUserConsentPreferences(legacyUserDoc, [])
  assert.equal(prefs.acik_riza.granted, true)
  assert.equal(prefs.ticari_ileti_email.granted, true)
  assert.equal(prefs.ticari_ileti_sms.granted, false)
  assert.equal(prefs.ticari_ileti_phone.granted, false)
})

test('CONSENT-3: Sadece notice_shown veya contract_confirmed kaydından ASLA açık rıza veya ticari ileti izni çıkarılmaz', () => {
  const prefs = resolveUserConsentPreferences(
    {},
    [
      {
        id: 'rec-1',
        eventType: 'notice_shown',
        docType: 'kvkk_aydinlatma',
        docVersion: 1,
        channel: 'web',
        createdAt: '2026-11-23T10:00:00.000Z',
      },
      {
        id: 'rec-2',
        eventType: 'contract_confirmed',
        docType: 'mesafeli_satis',
        docVersion: 1,
        channel: 'web',
        createdAt: '2026-11-23T10:01:00.000Z',
      },
    ]
  )

  for (const key of CONSENT_PREFERENCE_KEYS) {
    assert.equal(prefs[key].granted, false, `${key} izin verilmediği halde açık görünmemeli`)
  }
})

test('CONSENT-4: SMS izninin geri çekilmesi E-posta ve Açık Rıza izinlerini etkilemez', () => {
  const prefs = resolveUserConsentPreferences(
    {},
    [
      {
        id: 'r1',
        eventType: 'consent_granted',
        docType: 'acik_riza',
        channel: 'web',
        docVersion: 1,
        createdAt: '2026-11-23T08:00:00.000Z',
      },
      {
        id: 'r2',
        eventType: 'consent_granted',
        docType: 'ticari_ileti',
        channel: 'email',
        docVersion: 1,
        createdAt: '2026-11-23T08:00:00.000Z',
      },
      {
        id: 'r3',
        eventType: 'consent_granted',
        docType: 'ticari_ileti',
        channel: 'sms',
        docVersion: 1,
        createdAt: '2026-11-23T08:00:00.000Z',
      },
      {
        id: 'r4',
        eventType: 'consent_withdrawn',
        docType: 'ticari_ileti',
        channel: 'sms',
        docVersion: 1,
        createdAt: '2026-11-23T09:00:00.000Z',
        withdrawnAt: '2026-11-23T09:00:00.000Z',
      },
    ]
  )

  assert.equal(prefs.ticari_ileti_sms.granted, false)
  assert.ok(prefs.ticari_ileti_sms.withdrawnAt)
  assert.equal(prefs.ticari_ileti_email.granted, true)
  assert.equal(prefs.acik_riza.granted, true)
  assert.equal(prefs.ticari_ileti_phone.granted, false)
})

test('CONSENT-5: /api/consents/record artık dot-key değil gerçek nested consentPreferences yazar', () => {
  const recordRouteSrc = read('app/api/consents/record/route.ts')
  assert.ok(!recordRouteSrc.includes('consentPreferences.${'), 'Dot-key yazımı kaldırılmış olmalı')
  assert.ok(recordRouteSrc.includes('consentPreferences: nestedConsentPrefs'), 'Nested consentPreferences yazılmalı')
  assert.equal(resolveConsentPreferenceKey('ticari_ileti', 'sms'), 'ticari_ileti_sms')
  assert.equal(resolveConsentPreferenceKey('ticari_ileti', 'email'), 'ticari_ileti_email')
  assert.equal(resolveConsentPreferenceKey('ticari_ileti', 'phone'), 'ticari_ileti_phone')
  assert.equal(resolveConsentPreferenceKey('acik_riza', 'web'), 'acik_riza')
})

// =========================================================================
// 3. KVKK UYUMLU HESAP SİLME & VERİ İMHA TESTLERİ
// =========================================================================

test('DELETE-1: Başka kullanıcının UID hedeflemesi ve süresi geçmiş oturum engellenir', () => {
  const nowSec = 1_800_000_000

  // Başka kullanıcının UID'si -> FORBIDDEN_TARGET
  const crossUser = validateAccountDeletionRequest({
    authenticatedUid: 'user-A',
    requestedTargetUid: 'user-B',
    confirmationText: ACCOUNT_DELETION_CONFIRMATION_PHRASE,
    authTimeSeconds: nowSec - 30,
    nowSeconds: nowSec,
  })
  assert.equal(crossUser.valid, false)
  assert.equal(crossUser.code, 'FORBIDDEN_TARGET')

  // Eski oturum (> 5 dk) -> REAUTH_REQUIRED
  const staleAuth = validateAccountDeletionRequest({
    authenticatedUid: 'user-A',
    confirmationText: ACCOUNT_DELETION_CONFIRMATION_PHRASE,
    authTimeSeconds: nowSec - 600,
    nowSeconds: nowSec,
  })
  assert.equal(staleAuth.valid, false)
  assert.equal(staleAuth.code, 'REAUTH_REQUIRED')

  // Yanlış onay metni -> INVALID_CONFIRMATION
  const wrongConfirm = validateAccountDeletionRequest({
    authenticatedUid: 'user-A',
    confirmationText: 'SIL',
    authTimeSeconds: nowSec - 10,
    nowSeconds: nowSec,
  })
  assert.equal(wrongConfirm.valid, false)
  assert.equal(wrongConfirm.code, 'INVALID_CONFIRMATION')

  // Geçerli kendi hesabı + taze reauth + doğru onay metni
  const valid = validateAccountDeletionRequest({
    authenticatedUid: 'user-A',
    requestedTargetUid: 'user-A',
    confirmationText: ACCOUNT_DELETION_CONFIRMATION_PHRASE,
    authTimeSeconds: nowSec - 20,
    nowSeconds: nowSec,
  })
  assert.equal(valid.valid, true)
  assert.equal(verifyRecentReauth(nowSec - 20, nowSec).ok, true)
})

test('DELETE-2: Devam eden sipariş/iade ile geçmiş siparişler doğru sınıflandırılır', () => {
  const result = classifyUserOrdersForDeletion([
    { id: 'o1', orderNumber: 'GS-1', status: 'processing', shipping: { status: 'in_transit' } },
    { id: 'o2', orderNumber: 'GS-2', status: 'delivered', returnRequests: [{ status: 'approved' }] },
    { id: 'o3', orderNumber: 'GS-3', status: 'delivered', shipping: { status: 'delivered' } },
    { id: 'o4', orderNumber: 'GS-4', status: 'cancelled' },
  ])

  assert.equal(result.activeOrders.length, 2)
  assert.equal(result.historicalOrders.length, 2)
})

test('DELETE-3: Silme denetim kaydı ham PII içermez, 30 günlük KVKK süresini hesaplar ve tüm 10 kategoriyi kapsar', () => {
  assert.equal(DATA_RETENTION_MATRIX.length, 10)
  const requestedAt = '2026-11-23T12:00:00.000Z'
  const deadline = calculateKvkkDeadlineIso(requestedAt)
  assert.equal(deadline, '2026-12-23T12:00:00.000Z')

  const uid = 'uid-test-12345'
  const audit = buildErasureAuditRecord({
    requestRef: 'KVKK-DEL-TEST01',
    uid,
    requestedAt,
    completedAt: '2026-11-23T12:00:05.000Z',
    status: 'completed',
    stepsCompleted: ['orders_retained_and_restricted', 'firebase_auth_deleted'],
    stepsFailed: [],
    activeOrdersPreservedCount: 1,
    historicalOrdersRetainedCount: 2,
  })

  const serialized = JSON.stringify(audit)
  assert.ok(!serialized.includes(uid), 'Denetim kaydı ham UID içermemeli')
  assert.equal(audit.uidHash, hashUserIdentifier(uid))
  assert.ok(audit.deletedCategories.includes('profile_account'))
  assert.ok(audit.deletedCategories.includes('addresses'))
  assert.ok(audit.deletedCategories.includes('storage_fcm'))
  assert.ok(audit.retainedCategories.includes('orders_payments'))
  assert.ok(audit.retainedCategories.includes('invoices_accounting'))
})

test('DELETE-4: Hesap silme API ve UI güvenlik/KVKK gereksinimlerini uygular', () => {
  const apiSrc = read('app/api/account/delete/route.ts')
  const uiSrc = read('components/profile/AccountDeletionCard.tsx')
  const profileSrc = read('app/profil/page.tsx')

  // API güvenlik kontrolleri
  assert.ok(apiSrc.includes('verifyIdToken(token, true)'), 'Revoked token kontrolü ile ID token doğrulanmalı')
  assert.ok(apiSrc.includes('listCollections()'), 'Alt koleksiyonlar da silinmeli')
  assert.ok(apiSrc.includes('prefix: `users/${user.uid}/`'), 'Storage silme sadece users/{uid}/ ile sınırlı olmalı')
  assert.ok(apiSrc.includes('revokeRefreshTokens(user.uid)'), 'Oturum tokenları iptal edilmeli')
  assert.ok(apiSrc.includes('deleteUser(user.uid)'), 'Firebase Auth hesabı silinmeli')
  assert.ok(apiSrc.includes('dataRetentionRestricted: true'), 'Siparişler silinmemeli, kısıtlı saklama işaretlenmeli')

  // UI kontrolleri
  assert.ok(profileSrc.includes('AccountDeletionCard'), 'Profil sayfasında Hesabımı Sil bileşeni yer almalı')
  assert.ok(uiSrc.includes('reauthenticateWithCredential'), 'UI yeniden kimlik doğrulaması yapmalı')
  assert.ok(
    !uiSrc.includes('Tüm kişisel verileriniz kalıcı olarak silindi'),
    'Yasal saklanan kayıtlar varken yanıltıcı "Tüm kişisel verileriniz kalıcı olarak silindi" ifadesi kullanılmamalı'
  )
})
