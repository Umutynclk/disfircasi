import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'

export interface CompanyLegalInfo {
  title: string
  address: string
  mersis: string
  taxOffice: string
  taxNumber: string
  phone: string
  email: string
  kepAddress?: string
}

export interface PaymentTrustBadgeItem {
  id: string
  name: string
  logoUrl?: string
  badgeText?: string
  color?: string
  active: boolean
  isPreset?: boolean
}

export interface BankTransferConfig {
  enabled: boolean
  bankName: string
  accountHolder: string
  iban: string
  branchCode?: string
  description?: string
}

export interface LegalDocumentItem {
  title: string
  content: string
  updatedAt: string
}

export interface LegalDocumentsConfig {
  company: CompanyLegalInfo
  distanceSalesAgreement: LegalDocumentItem
  preliminaryInfoForm: LegalDocumentItem
  kvkkPolicy: LegalDocumentItem
  privacyAndSecurity: LegalDocumentItem
  cancellationAndReturn: LegalDocumentItem
  deliveryAndShipping: LegalDocumentItem
  paymentBadges: {
    items: PaymentTrustBadgeItem[]
    showInFooter: boolean
    showInCheckout: boolean
  }
  bankTransfer: BankTransferConfig
}

export const DEFAULT_LEGAL_CONFIG: LegalDocumentsConfig = {
  company: {
    title: 'Gülümse Dental & Sağlık Ürünleri Tic. Ltd. Şti.',
    address: 'Maslak Mah. Büyükdere Cad. No: 120 Sarıyer / İstanbul',
    mersis: '012345678900001',
    taxOffice: 'Maslak V.D.',
    taxNumber: '1234567890',
    phone: '0850 300 00 00',
    email: 'info@gulumse.com',
    kepAddress: 'gulumse@hs01.kep.tr',
  },
  distanceSalesAgreement: {
    title: 'Mesafeli Satış Sözleşmesi',
    content: `1. TARAFLAR
İşbu Mesafeli Satış Sözleşmesi ("Sözleşme"), aşağıda bilgileri yer alan SATICI ile ALICI (Tüketici) arasında, internet sitesi üzerinden siparişin elektronik ortamda onaylanması anında yürürlüğe girmiştir.

2. SÖZLEŞMENİN KONUSU
İşbu sözleşmenin konusu, ALICI'nın SATICI'ya ait internet sitesinden elektronik ortamda siparişini yaptığı ürünün satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin saptanmasıdır.

3. ÖDEME VE GÜVENLİK (PAYTR GÜVENCESİ)
Tüm kredi kartı ve banka kartı ödemeleri TCMB ve BDDK lisanslı PayTR Ödeme ve Elektronik Para Kuruluşu A.Ş. altyapısı üzerinden 256-Bit SSL şifrelemesi ve PCI-DSS Seviye 1 güvenlik standartlarında, 3D Secure güvencesi ile gerçekleştirilmektedir. ALICI'nın kart bilgileri SATICI sunucularında asla saklanmaz veya kaydedilmez.

4. TESLİMAT KOŞULLARI
Ürün, yasal 30 günlük süreyi aşmamak koşuluyla ALICI'nın sipariş formunda belirttiği adrese anlaşmalı kargo şirketi aracılığıyla teslim edilir. Gönderimler en geç 1-3 iş günü içerisinde kargoya verilir.

5. CAYMA HAKKI VE HİJYEN İSTİSNASI (Madde 15/ç)
ALICI, teslimden itibaren 14 gün içinde cayma hakkına sahiptir. Ancak hijyen ve sağlık açısından ambalajı veya koruyucu bandı açılmış diş fırçası, başlık vb. ürünlerde cayma hakkı kullanılamaz. İade için ambalajın açılmamış ve ürünün kullanılmamış olması şarttır.

6. UYUŞMAZLIKLARIN ÇÖZÜMÜ
Uyuşmazlıklarda Ticaret Bakanlığınca her yıl ilan edilen parasal sınırlar dahilinde ALICI'nın yerleşim yerindeki Tüketici Hakem Heyetleri veya Tüketici Mahkemeleri yetkilidir.`,
    updatedAt: '03 Eylül 2026',
  },
  preliminaryInfoForm: {
    title: 'Ön Bilgilendirme Koşulları Formu',
    content: `1. KONU VE KAPSAM
İşbu Ön Bilgilendirme Formu, 6502 Sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uyarınca, ALICI'nın satın alacağı ürünlere ilişkin sipariş öncesinde bilgilendirilmesini amaçlar.

2. SATICI VE İLETİŞİM BİLGİLERİ
Gülümse Dental & Sağlık Ürünleri Tic. Ltd. Şti.
Adres: Maslak Mah. Büyükdere Cad. No: 120 Sarıyer / İstanbul
Telefon: 0850 300 00 00 | E-Posta: info@gulumse.com | MERSİS: 012345678900001

3. ÜRÜN TEMEL NİTELİKLERİ VE FİYATI
Ürünün cinsi, türü, miktarı, rengi, tüm vergiler dahil satış bedeli ve kargo ücreti sipariş özeti ekranında yer almaktadır.

4. ÖDEME VE İFA BİLGİLERİ
Ödemeler PayTR güvenli 3D Secure kart ödeme altyapısı veya Havale/EFT ile yapılabilir. Sipariş onaylandıktan sonra ürün belirtilen kargo süresi içerisinde teslim edilir.

5. CAYMA HAKKI VE İADE ŞARTLARI
Tüketici 14 gün içinde cayma hakkına sahiptir. Ağız ve diş sağlığı ürünlerinde koruma bandı/ambalajı açılmamış, ürün denenmemiş ve hasar görmemiş olmalıdır.`,
    updatedAt: '03 Eylül 2026',
  },
  cancellationAndReturn: {
    title: 'İptal, İade ve Geri Ödeme Koşulları',
    content: `1. SİPARİŞ İPTALİ
Siparişiniz henüz kargoya teslim edilmemiş ise aynı gün içerisinde Müşteri Hizmetlerimize (0850 300 00 00 / info@gulumse.com) ulaşarak veya profiliniz üzerinden ücretsiz olarak siparişinizi iptal edebilirsiniz. Sipariş iptal edildiğinde ödemeniz PayTR aracılığıyla anında kesintisiz olarak kartınıza iade edilir.

2. CAYMA HAKKI (14 GÜN)
6502 sayılı Tüketicinin Korunması Hakkında Kanun gereğince, ALICI ürünün kendisine veya gösterdiği adresteki kişi/kuruluşa teslim tarihinden itibaren 14 (on dört) gün içinde hiçbir hukuki ve cezai sorumluluk üstlenmeksizin ve hiçbir gerekçe göstermeksizin cayma hakkını kullanabilir.

3. HİJYEN VE SAĞLIK İSTİSNASI (Yönetmelik Madde 15/ç)
Diş fırçaları, elektronik diş fırçası gövdeleri, değiştirilebilir fırça başlıkları ve ağız bakım ürünleri doğrudan insan sağlığı ve hijyen kategorisindedir.
Mevzuat gereği; koruyucu güvenlik bandı, jelatini veya ambalajı açılmış, denenmiş, kullanılmış veya hijyenik bütünlüğü bozulmuş ürünlerde cayma ve iade hakkı KULLANILAMAZ. İade kabulü için ürün ambalajının kesinlikle açılmamış ve tahrip edilmemiş olması zorunludur.

4. İADE SÜRECİ VE ÜCRETSİZ GÖNDERİM
Cayma hakkı şartlarını taşıyan ürünlerinizi orijinal kutusu, faturası ve tüm aksesuarlarıyla birlikte anlaşmalı kargo kodumuz ile tarafımıza ÜCRETSİZ olarak gönderebilirsiniz. Kargo takip kodunu almak için Müşteri Hizmetlerimizle iletişime geçebilirsiniz.

5. GERİ ÖDEME SÜRECİ (PAYTR GÜVENCESİ)
İade edilen ürün depomuza ulaştıktan sonra uzman ekibimiz tarafından 1-2 iş günü içinde hijyen ve sağlamlık kontrolü yapılır.
İadesi onaylanan siparişin bedeli, ödemenin yapıldığı kredi kartına veya banka kartına PayTR sistemi üzerinden anında aktarılır. Tutarın ekstrenize yansıması bankanızın işlem süreçlerine bağlı olarak 1-3 iş günü (banka kartlarında 2-7 iş günü) sürebilmektedir.

6. HASARLI / AYIPLI ÜRÜN DEĞİŞİMİ
Kargonuzu teslim alırken pakette ezilme, yırtılma veya ıslanma fark ederseniz lütfen kargo görevlisine "Hasar Tespit Tutanağı" tutturunuz. Üründe fabrikasyon bir kusur olması durumunda 2 yıl resmi garantimiz kapsamında birebir sıfır ürün değişimi veya tam ücret iadesi sağlanmaktadır.`,
    updatedAt: '03 Eylül 2026',
  },
  deliveryAndShipping: {
    title: 'Teslimat ve Kargo Koşulları',
    content: `1. GÖNDERİM VE TESLİMAT SÜRESİ
Hafta içi saat 16:00'a kadar verilen tüm siparişler aynı gün anlaşmalı kargo firmasına teslim edilir. Hafta sonu veya resmi tatillerde verilen siparişler takip eden ilk iş gününde kargoya verilir.
Türkiye genelinde teslimat süresi il ve ilçe merkezlerine 1-3 iş günüdür.

2. KARGO ÜCRETİ VE KAMPANYALAR
Belirli tutarın üzerindeki siparişlerde ve güncel kampanyalarımız dahilinde tüm Türkiye'ye kargo tamamen ÜCRETSİZDİR. Ücretsiz kargo limitinin altındaki siparişlerde sabit kargo ücreti sipariş özetinde şeffaf olarak belirtilir.

3. KARGO TAKİBİ
Siparişiniz kargoya verildiğinde, sisteme kayıtlı cep telefonu numaranıza SMS ve e-posta adresinize kargo takip numarası ve takip bağlantısı iletilir. Ayrıca sitemiz üzerinden "Profilim > Siparişlerim" veya "Kargo Takip" alanından anlık durum sorgulayabilirsiniz.

4. TESLİMAT ANINDA DİKKAT EDİLECEK HUSUSLAR
Ürününüz medikal hijyen standartlarına uygun, darbeye dayanıklı özel koruyucu kargo kutularında ve mühürlü olarak teslim edilmektedir.
Paketi teslim alırken kargo görevlisinin yanında dış ambalajı kontrol ediniz. Ambalajda hasar varsa paketi teslim almayıp görevliye "Hasar Tespit Tutanağı" tutturunuz ve derhal müşteri destek ekibimize bildiriniz.

5. ADRESTE BULUNAMAMA DURUMU
Kargo teslimatı sırasında adresinizde bulunmamanız halinde, kargo şirketi paketinizi en yakın dağıtım şubesinde 3 iş günü süreyle muhafaza eder. Bu süre içinde şubeden teslim alınmayan paketler firmamıza iade edilir.`,
    updatedAt: '03 Eylül 2026',
  },
  privacyAndSecurity: {
    title: 'Gizlilik ve Güvenlik Politikası',
    content: `1. VERİ GÜVENLİĞİ VE 256-BİT SSL
Sitemizde tüm veri trafiği uluslararası geçerliliğe sahip 256-Bit SSL (Secure Sockets Layer) şifreleme sertifikası ile korunmaktadır. Tarayıcınız ile sunucularımız arasındaki tüm iletişim şifrelenir ve üçüncü şahıslar tarafından dinlenemez.

2. ÖDEME GÜVENLİĞİ (PAYTR & 3D SECURE)
Kredi kartı ve banka kartı ödemeleriniz TCMB ve BDDK lisanslı PayTR Ödeme Kuruluşu güvencesiyle ve bankanızın 3D Secure SMS şifre onay ekranında gerçekleştirilir.
Kart numaranız, CVV kodunuz ve son kullanma tarihiniz dahil hiçbir finansal bilginiz sunucularımızda ASLA TUTULMAZ, SAKLANMAZ veya İŞLENMEZ.

3. KİŞİSEL VERİLERİN KORUNMASI
Üyelik ve sipariş sırasında sağladığınız isim, e-posta, telefon ve adres bilgileri yalnızca siparişinizin teslimi, faturalandırma ve müşteri hizmetleri süreçlerinde kullanılır. Bilgileriniz yasal zorunluluklar haricinde hiçbir şekilde üçüncü taraflarla paylaşılmaz veya ticari amaçla satılmaz.

4. ÇEREZ (COOKIE) KULLANIMI
Sitemizin sorunsuz çalışması, sepetinizin hatırlanması ve kullanıcı deneyiminizin iyileştirilmesi amacıyla güvenli çerezler (cookies) kullanılmaktadır. Tarayıcı ayarlarınızdan çerez tercihlerinizi dilediğiniz zaman yönetebilirsiniz.`,
    updatedAt: '03 Eylül 2026',
  },
  kvkkPolicy: {
    title: 'KVKK Aydınlatma Metni ve Kişisel Veri Politikası',
    content: `1. VERİ SORUMLUSU
6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, veri sorumlusu sıfatıyla Gülümse Dental & Sağlık Ürünleri Tic. Ltd. Şti. olarak kişisel verilerinizi mevzuata uygun şekilde işlemekte ve korumaktayız.

2. KİŞİSEL VERİLERİN İŞLENME AMACI
Toplanan kimlik (ad, soyad), iletişim (telefon, e-posta, teslimat adresi), müşteri işlem ve finansal işlem verileriniz;
- Siparişlerin oluşturulması, faturalandırılması ve adrese teslimatı,
- Satış sonrası destek, garanti ve iade süreçlerinin yürütülmesi,
- Yasal mevzuattan doğan bilgi saklama ve bildirim yükümlülüklerinin yerine getirilmesi amaçlarıyla işlenmektedir.

3. KİŞİSEL VERİLERİN AKTARILMASI
Kişisel verileriniz, yalnızca sipariş teslimatının sağlanması amacıyla anlaşmalı kargo firmalarına, ödeme işlemlerinin tamamlanması için PayTR ödeme kuruluşuna ve yasal zorunluluk halinde yetkili kamu kurumlarına aktarılmaktadır.

4. VERİ SAHİBİNİN HAKLARI (KVKK Madde 11)
KVKK'nın 11. maddesi uyarınca veri sahipleri; kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, düzeltilmesini veya silinmesini isteme haklarına sahiptir.
Taleplerinizi info@gulumse.com adresine iletebilirsiniz.`,
    updatedAt: '03 Eylül 2026',
  },
  paymentBadges: {
    showInFooter: true,
    showInCheckout: true,
    items: [
      { id: 'paytr', name: 'PayTR Güvenli Ödeme', badgeText: 'PayTR', active: true, isPreset: true, color: 'text-sky-400' },
      { id: 'ssl256', name: '256-Bit SSL Şifreleme', badgeText: '256-Bit SSL', active: true, isPreset: true, color: 'text-emerald-400' },
      { id: 'secure3d', name: '3D Secure Koruma', badgeText: '3D Secure', active: true, isPreset: true, color: 'text-indigo-400' },
      { id: 'mastercard', name: 'Mastercard', badgeText: 'Mastercard', active: true, isPreset: true, color: 'text-amber-400' },
      { id: 'visa', name: 'Visa', badgeText: 'Visa', active: true, isPreset: true, color: 'text-blue-400' },
      { id: 'troy', name: 'Troy', badgeText: 'Troy', active: true, isPreset: true, color: 'text-cyan-400' },
      { id: 'pcidss', name: 'PCI-DSS Seviye 1', badgeText: 'PCI-DSS Seviye 1', active: true, isPreset: true, color: 'text-purple-400' },
    ],
  },
  bankTransfer: {
    enabled: false,
    bankName: 'Garanti BBVA',
    accountHolder: 'Gülümse Dental & Sağlık Ürünleri Tic. Ltd. Şti.',
    iban: 'TR00 0000 0000 0000 0000 0000 00',
    branchCode: 'Maslak Ticari Şube (1234)',
    description: 'Lütfen havale/EFT yaparken açıklama kısmına Ad-Soyad ve Sipariş Numaranızı yazınız.',
  },
}

export const subscribeToLegalConfig = (callback: (data: LegalDocumentsConfig) => void) => {
  try {
    const db = getFirestoreDB()
    const unsub = onSnapshot(doc(db, 'settings', 'legal'), (snap) => {
      if (snap.exists()) {
        const d = snap.data() as Partial<LegalDocumentsConfig>
        callback({
          company: { ...DEFAULT_LEGAL_CONFIG.company, ...(d.company || {}) },
          distanceSalesAgreement: { ...DEFAULT_LEGAL_CONFIG.distanceSalesAgreement, ...(d.distanceSalesAgreement || {}) },
          preliminaryInfoForm: { ...DEFAULT_LEGAL_CONFIG.preliminaryInfoForm, ...(d.preliminaryInfoForm || {}) },
          kvkkPolicy: { ...DEFAULT_LEGAL_CONFIG.kvkkPolicy, ...(d.kvkkPolicy || {}) },
          privacyAndSecurity: { ...DEFAULT_LEGAL_CONFIG.privacyAndSecurity, ...(d.privacyAndSecurity || {}) },
          cancellationAndReturn: { ...DEFAULT_LEGAL_CONFIG.cancellationAndReturn, ...(d.cancellationAndReturn || {}) },
          deliveryAndShipping: { ...DEFAULT_LEGAL_CONFIG.deliveryAndShipping, ...(d.deliveryAndShipping || {}) },
          paymentBadges: {
            showInFooter: d.paymentBadges?.showInFooter ?? DEFAULT_LEGAL_CONFIG.paymentBadges.showInFooter,
            showInCheckout: d.paymentBadges?.showInCheckout ?? DEFAULT_LEGAL_CONFIG.paymentBadges.showInCheckout,
            items: d.paymentBadges?.items && d.paymentBadges.items.length > 0
              ? d.paymentBadges.items
              : DEFAULT_LEGAL_CONFIG.paymentBadges.items,
          },
          bankTransfer: {
            ...DEFAULT_LEGAL_CONFIG.bankTransfer,
            ...(d.bankTransfer || {}),
          },
        })
      } else {
        callback(DEFAULT_LEGAL_CONFIG)
      }
    })
    return unsub
  } catch (err) {
    console.error('Legal config subscribe error:', err)
    callback(DEFAULT_LEGAL_CONFIG)
    return () => {}
  }
}

export const saveLegalConfig = async (config: LegalDocumentsConfig): Promise<void> => {
  const db = getFirestoreDB()
  await setDoc(doc(db, 'settings', 'legal'), config, { merge: true })
}
