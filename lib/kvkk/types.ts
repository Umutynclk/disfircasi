export type KvkkDocumentType =
  | 'kvkk_aydinlatma'
  | 'acik_riza'
  | 'ticari_ileti'
  | 'on_bilgilendirme'
  | 'mesafeli_satis'
  | 'cerez_politikasi'

export type KvkkDocumentStatus = 'draft' | 'published' | 'unpublished'

export interface KvkkManagedDocument {
  docType: KvkkDocumentType
  label: string
  category: 'bilgilendirme' | 'riza' | 'sozlesme' | 'politika'
  title: string
  content: string
  draftTitle: string
  draftContent: string
  status: KvkkDocumentStatus
  active: boolean
  version: number
  updatedAt: string
  publishedAt?: string
  updatedBy?: string
}

export interface KvkkDocumentVersionSnapshot {
  id: string
  docType: KvkkDocumentType
  version: number
  title: string
  content: string
  publishedAt: string
  publishedBy?: string
}

export type ConsentEventType =
  | 'notice_shown'
  | 'consent_granted'
  | 'consent_denied'
  | 'consent_withdrawn'
  | 'contract_confirmed'

export type ConsentStage = 'register' | 'checkout' | 'profile'
export type ConsentChannel = 'web' | 'email' | 'sms' | 'phone'

export interface ConsentRecord {
  id: string
  subjectType: 'user' | 'guest'
  userId?: string
  guestOrderRef?: string
  email?: string
  eventType: ConsentEventType
  docType: KvkkDocumentType
  docVersion: number
  docTitle?: string
  stage: ConsentStage
  purpose: string
  channel: ConsentChannel
  status: 'shown' | 'granted' | 'denied' | 'withdrawn' | 'confirmed'
  createdAt: string
  withdrawnAt?: string
}

export interface CompanyInfoCheckResult {
  isComplete: boolean
  missingFields: string[]
}

/**
 * Firma bilgilerinin yasal belgeler için eksiksiz olup olmadığını denetler.
 * Eksik alanları uydurmaz, açıkça listeler.
 */
export function checkCompanyLegalCompleteness(company?: {
  title?: string
  address?: string
  mersis?: string
  taxOffice?: string
  taxNumber?: string
  phone?: string
  email?: string
}): CompanyInfoCheckResult {
  const missing: string[] = []
  if (!company?.title?.trim()) missing.push('Ticaret Unvanı')
  if (!company?.address?.trim()) missing.push('Açık Adres')
  if (!company?.phone?.trim()) missing.push('Telefon')
  if (!company?.email?.trim()) missing.push('E-posta')
  if (!company?.taxNumber?.trim()) missing.push('Vergi Numarası')
  return {
    isComplete: missing.length === 0,
    missingFields: missing,
  }
}

export const KVKK_DOCUMENT_META: Record<
  KvkkDocumentType,
  {
    label: string
    category: 'bilgilendirme' | 'riza' | 'sozlesme' | 'politika'
    legalNote: string
    defaultTitle: string
  }
> = {
  kvkk_aydinlatma: {
    label: 'KVKK Aydınlatma Metni',
    category: 'bilgilendirme',
    legalNote: 'Bilgilendirme yükümlülüğüdür (KVKK md. 10). Açık rıza şartı olarak kullanılamaz.',
    defaultTitle: 'KVKK Aydınlatma Metni',
  },
  acik_riza: {
    label: 'Açık Rıza Metni',
    category: 'riza',
    legalNote: 'Yalnızca isteğe bağlı veri işleme faaliyetleri için ayrı alınır; zorunlu tutulamaz.',
    defaultTitle: 'Kişisel Verilerin İşlenmesine İlişkin Açık Rıza Metni',
  },
  ticari_ileti: {
    label: 'Ticari Elektronik İleti İzni',
    category: 'riza',
    legalNote: 'Kampanya, indirim ve tanıtım iletileri (E-posta/SMS) içindir. İsteğe bağlıdır; İYS entegrasyonu mevcut değildir.',
    defaultTitle: 'Ticari Elektronik İleti Aydınlatma ve Onay Metni',
  },
  on_bilgilendirme: {
    label: 'Ön Bilgilendirme Formu',
    category: 'sozlesme',
    legalNote: '6502 sayılı Kanun kapsamında sipariş öncesi zorunlu tüketici bilgilendirmesidir.',
    defaultTitle: 'Ön Bilgilendirme Formu',
  },
  mesafeli_satis: {
    label: 'Mesafeli Satış Sözleşmesi',
    category: 'sozlesme',
    legalNote: 'Siparişin sözleşmesel koşullarını düzenler; açık rıza kutusundan ayrı teyit edilir.',
    defaultTitle: 'Mesafeli Satış Sözleşmesi',
  },
  cerez_politikasi: {
    label: 'Çerez Politikası ve Tercihleri',
    category: 'politika',
    legalNote: 'Zorunlu çerezler dışındaki analitik/pazarlama çerezleri kullanıcının tercihine bağlıdır.',
    defaultTitle: 'Çerez Politikası ve Çerez Tercihleri',
  },
}

export const KVKK_DOCUMENT_TYPES: KvkkDocumentType[] = [
  'kvkk_aydinlatma',
  'acik_riza',
  'ticari_ileti',
  'on_bilgilendirme',
  'mesafeli_satis',
  'cerez_politikasi',
]

export function buildDefaultKvkkDocuments(company?: {
  title?: string
  address?: string
  mersis?: string
  taxOffice?: string
  taxNumber?: string
  phone?: string
  email?: string
}): Record<KvkkDocumentType, KvkkManagedDocument> {
  const title = company?.title?.trim() || '[TİCARET UNVANI EKSİK — DOLDURULMALI]'
  const address = company?.address?.trim() || '[ADRES EKSİK — DOLDURULMALI]'
  const phone = company?.phone?.trim() || '[TELEFON EKSİK — DOLDURULMALI]'
  const email = company?.email?.trim() || '[E-POSTA EKSİK — DOLDURULMALI]'
  const mersis = company?.mersis?.trim() || '[MERSİS EKSİK]'
  const taxInfo = company?.taxOffice?.trim() && company?.taxNumber?.trim()
    ? `${company.taxOffice.trim()} / ${company.taxNumber.trim()}`
    : '[VERGİ BİLGİSİ EKSİK]'

  const now = new Date().toISOString()

  const templates: Record<KvkkDocumentType, string> = {
    kvkk_aydinlatma: `1. VERİ SORUMLUSU
6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu:
Unvan: ${title}
Adres: ${address}
MERSİS: ${mersis} | Vergi Dairesi / No: ${taxInfo}
Telefon: ${phone} | E-posta: ${email}

2. İŞLENEN KİŞİSEL VERİLER VE HUKUKİ SEBEPLER
Sipariş oluşturma, teslimat, faturalandırma, iade/iptal ve üyelik süreçlerinde kimlik, iletişim, teslimat/fatura adresi ve işlem güvenliği verileriniz KVKK m. 5/2 (c) "sözleşmenin kurulması veya ifası", (ç) "hukuki yükümlülüğün yerine getirilmesi" ve (f) "meşru menfaat" hukuki sebeplerine dayanarak işlenmektedir. Bu zorunlu süreçler için açık rıza aranmaz.

3. AKTARIM
Kişisel verileriniz; teslimat için anlaşmalı kargo şirketlerine (HepsiJET), ödeme doğrulaması için lisanslı ödeme kuruluşlarına (PayTR / iyzico) ve yasal zorunluluk halinde yetkili kamu kurumlarına aktarılabilir.

4. KVKK MADDE 11 KAPSAMINDA HAKLARINIZ
Kişisel verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini/silinmesini talep etme ve verdiğiniz isteğe bağlı açık rızaları dilediğiniz zaman geri çekme haklarına sahipsiniz. Başvurularınızı ${email} adresine iletebilirsiniz.`,

    acik_riza: `1. KAPSAM VE İSTEĞE BAĞLILIK
İşbu Açık Rıza Metni, ${title} tarafından sunulan üyelik ve satın alma hizmetlerinin zorunlu bir koşulu DEĞİLDİR. Rıza vermemeniz hâlinde üyelik oluşturabilir ve siparişinizi eksiksiz tamamlayabilirsiniz.

2. AÇIK RIZA KONUSU FAALİYETLER
Onay vermeniz hâlinde; alışveriş alışkanlıklarınıza uygun kişiselleştirilmiş ürün önerileri sunulması ve kampanya/segmentasyon analizlerinin yapılması amacıyla sınırlı olarak işlem ve tercih verileriniz işlenebilecektir.

3. RIZANIN GERİ ÇEKİLMESİ
Verdiğiniz açık rızayı dilediğiniz zaman Profil > KVKK & İletişim İzinlerim ekranından veya ${email} adresine bildirimde bulunarak ücretsiz olarak geri çekebilirsiniz.`,

    ticari_ileti: `1. TİCARİ ELEKTRONİK İLETİ BİLGİLENDİRMESİ
${title} tarafından kampanya, indirim, yeni ürün ve tanıtım içerikli ticari elektronik iletilerin (e-posta ve/veya SMS) tarafınıza gönderilmesi yalnızca açık onayınıza bağlıdır.

2. İSTEĞE BAĞLILIK VE RET HAKKI
Bu onay üyelik veya satın alma işlemi için zorunlu değildir. Onayınızı dilediğiniz zaman Profil > KVKK & İletişim İzinlerim bölümünden veya ${email} adresi üzerinden geri çekebilirsiniz.`,

    on_bilgilendirme: `1. SATICI BİLGİLERİ
Unvan: ${title}
Adres: ${address}
MERSİS: ${mersis} | Vergi: ${taxInfo}
Telefon: ${phone} | E-posta: ${email}

2. ÜRÜN VE FİYAT BİLGİLERİ
Sipariş konusu ürünlerin temel nitelikleri, adetleri, tüm vergiler dâhil satış fiyatları ve kargo bedeli sipariş özeti ekranında açıkça gösterilmektedir.

3. TESLİMAT VE CAYMA HAKKI
Ürünler yasal 30 günlük süreyi aşmamak üzere anlaşmalı kargo ile teslim edilir. Tüketici teslimden itibaren 14 gün içinde cayma hakkını kullanabilir; ancak Yönetmelik m. 15/ç uyarınca ambalajı/hijyen bandı açılmış ağız bakım ürünlerinde cayma hakkı kullanılamaz.`,

    mesafeli_satis: `1. TARAFLAR
İşbu Mesafeli Satış Sözleşmesi, ${title} ("SATICI") ile internet sitesi üzerinden sipariş veren müşteri ("ALICI") arasında 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca elektronik ortamda akdedilmiştir.

2. SÖZLEŞMENİN KONUSU VE BEDEL
Sözleşmenin konusu, ALICI'nın sipariş özetinde belirtilen ürünlerin satışı ve teslimidir. Tüm vergiler dâhil toplam tutar ve kargo bedeli ödeme öncesinde ALICI'nın onayına sunulur.

3. İFA, İADE VE UYUŞMAZLIK
Ödeme onayı sonrası sipariş hazırlanır ve kargoya teslim edilir. İade ve iptal koşulları 6502 sayılı Kanun hükümlerine tabidir. Uyuşmazlıklarda ALICI'nın yerleşim yerindeki Tüketici Hakem Heyetleri ve Tüketici Mahkemeleri yetkilidir.`,

    cerez_politikasi: `1. ÇEREZ (COOKIE) KULLANIMI
${title} internet sitesinde oturum yönetimi, sepetin korunması ve güvenlik amacıyla zorunlu çerezler kullanılmaktadır.

2. ÇEREZ TERCİHLERİ
Zorunlu çerezler dışındaki performans ve pazarlama çerezleri kullanıcının tercihine bağlıdır; tarayıcı ayarlarınızdan veya çerez tercih panelinden dilediğiniz zaman yönetebilirsiniz.`,
  }

  const docs = {} as Record<KvkkDocumentType, KvkkManagedDocument>
  for (const docType of KVKK_DOCUMENT_TYPES) {
    const meta = KVKK_DOCUMENT_META[docType]
    docs[docType] = {
      docType,
      label: meta.label,
      category: meta.category,
      title: meta.defaultTitle,
      content: templates[docType],
      draftTitle: meta.defaultTitle,
      draftContent: templates[docType],
      status: 'published',
      active: true,
      version: 1,
      updatedAt: now,
      publishedAt: now,
    }
  }
  return docs
}

/**
 * Kayıt veya satın alma formunda hukuki doğrulama:
 * - Kayıtta hiçbir açık rıza/ticari ileti zorunlu DEĞİLDİR.
 * - Satın almada yalnızca sözleşmesel teyit (Ön Bilgilendirme + Mesafeli Satış) zorunludur;
 *   KVKK Aydınlatma Metni bilgilendirmedir, açık rıza ve ticari ileti isteğe bağlıdır.
 */
export function validateCheckoutLegalRequirements(input: {
  contractConfirmed: boolean
  explicitConsent?: boolean
  commercialConsent?: boolean
}): { valid: boolean; error?: string } {
  if (!input.contractConfirmed) {
    return {
      valid: false,
      error: 'Siparişi tamamlamak için Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi teyidini işaretlemeniz gerekmektedir.',
    }
  }
  return { valid: true }
}
