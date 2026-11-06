export type SupportedLocale = 'tr' | 'en' | 'de' | 'fr' | 'it'

export interface TranslationDictionary {
  nav: {
    topPromo1: string
    topPromo2: string
    topPromo3: string
    home: string
    products: string
    automaticToothbrush: string
    disposableToothbrush: string
    allProducts: string
    campaigns: string
    about: string
    faq: string
    contact: string
    search: string
    cart: string
    profile: string
    login: string
    register: string
    logout: string
  }
  showcase: {
    or: string
    leftCategorySubtitle: string
    leftTitleBadge: string
    leftHighlight: string
    leftHighlightSub: string
    leftDefaultDesc: string
    rightCategorySubtitle: string
    rightTitleBadge: string
    rightHighlight: string
    rightHighlightSub: string
    rightDefaultDesc: string
    buyNow: string
    outOfStock: string
    bottomBarCta: string
    priceLabel: string
    viewProducts: string
  }

  features: {
    f1Title: string
    f1Desc: string
    f2Title: string
    f2Desc: string
    f3Title: string
    f3Desc: string
    f4Title: string
    f4Desc: string
    f5Title: string
    f5Desc: string
  }
  productsSection: {
    badge: string
    title: string
    subtitle: string
    allCategory: string
    automaticCategory: string
    disposableCategory: string
    addToCart: string
    addedToCart: string
    buyNow: string
    inStock: string
    outOfStock: string
    viewAll: string
  }
  whyGulumse: {
    badge: string
    title: string
    subtitle: string
    b1Title: string
    b1Desc: string
    b2Title: string
    b2Desc: string
    b3Title: string
    b3Desc: string
    b4Title: string
    b4Desc: string
    b5Title: string
    b5Desc: string
  }
  editorial: {
    s1Badge: string
    s1Subtitle: string
    s1Title: string
    s1Desc: string
    s1Bullet1: string
    s1Bullet2: string
    s1Bullet3: string
    s1Cta: string
    s2Badge: string
    s2Subtitle: string
    s2Title: string
    s2Desc: string
    s2Bullet1: string
    s2Bullet2: string
    s2Bullet3: string
    s2Cta: string
  }
  cta: {
    badge: string
    title: string
    titleHighlight: string
    description: string
    primaryButtonText: string
    secondaryButtonText: string
    guarantee1: string
    guarantee2: string
    guarantee3: string
  }
  footer: {
    badge1Title: string
    badge1Desc: string
    badge2Title: string
    badge2Desc: string
    badge3Title: string
    badge3Desc: string
    sloganLead: string
    sloganHighlight: string
    desc: string
    productGroups: string
    automatic: string
    disposable: string
    refills: string
    travelSets: string
    corporate: string
    about: string
    contact: string
    faq: string
    customerCare: string
    shipping: string
    returns: string
    orderTracking: string
    contactUs: string
    customerSupport: string
    rightsReserved: string
    privacyPolicy: string
    termsOfUse: string
    cookieSettings: string
  }
  cart: {
    title: string
    emptyTitle: string
    emptyDesc: string
    subtotal: string
    shipping: string
    freeShipping: string
    checkoutBtn: string
    continueShopping: string
  }
  auth: {
    loginTitle: string
    loginDesc: string
    registerTitle: string
    registerDesc: string
    email: string
    password: string
    firstName: string
    lastName: string
    alreadyHaveAccount: string
    dontHaveAccount: string
    checkoutAuthGateTitle: string
    checkoutAuthGateDesc: string
  }
  search: {
    placeholder: string
    noResults: string
    popularSearches: string
  }
  common: {
    loading: string
    error: string
    success: string
    currency: string
  }
}

export const dictionaries: Record<SupportedLocale, TranslationDictionary> = {
  tr: {
    nav: {
      topPromo1: 'Hızlı ve Güvenli Teslimat',
      topPromo2: '%100 Müşteri Memnuniyeti',
      topPromo3: 'Sağlıklı Gülüşler',
      home: 'Ana Sayfa',
      products: 'Ürünler',
      automaticToothbrush: 'Otomatik Diş Fırçası',
      disposableToothbrush: 'Kullan At Diş Fırçası',
      allProducts: 'Tüm Ürünler',
      campaigns: 'Kampanyalar',
      about: 'Hakkımızda',
      faq: 'SSS',
      contact: 'İletişim',
      search: 'Ürün Ara',
      cart: 'Sepetim',
      profile: 'Profilim & Siparişlerim',
      login: 'Giriş Yap',
      register: 'Kayıt Ol',
      logout: 'Çıkış Yap',
    },
    showcase: {
      or: 'veya',
      leftCategorySubtitle: 'Otomatik Diş Fırçası',
      leftTitleBadge: 'DÜNYANIN İLK',
      leftHighlight: '360° DÖNEBİLEN',
      leftHighlightSub: 'DİŞ FIRÇASI',
      leftDefaultDesc: '360° sonic titreşim teknolojisi ve mikro silikon fırça başlığı ile diş minesine zarar vermeden derinlemesine temizlik.',
      rightCategorySubtitle: 'Kullan At Diş Fırçası',
      rightTitleBadge: 'DÜNYANIN İLK',
      rightHighlight: 'BAŞLIK DEĞİŞMELİ',
      rightHighlightSub: 'DİŞ FIRÇASI',
      rightDefaultDesc: 'Pratik, hijyenik ve seyahat dostu. Başlık değiştirmeli özel tasarımıyla her an taze ve steril gülüş deneyimi.',
      buyNow: 'Satın Al',
      outOfStock: 'Tükendi',
      bottomBarCta: 'Gülümse, Daha İyi Hisset!',
      priceLabel: 'Fiyat',
      viewProducts: 'Ürünleri Gör',

    },
    features: {
      f1Title: 'Daha Sağlıklı Dişler',
      f1Desc: 'Klinik onaylı diş eti koruması ve plak temizliği.',
      f2Title: 'Güvenli ve Doğal Temizlik',
      f2Desc: 'BPA içermeyen ultra yumuşak silikon kıllar.',
      f3Title: 'Aile Boyu Kullanım',
      f3Desc: 'Yetişkin ve çocuklar için özel boyutlar.',
      f4Title: 'Seyahatler İçin İdeal',
      f4Desc: 'Hafif, taşınabilir ve hijyenik koruma kapaklı.',
      f5Title: 'Daha Beyaz Bir Gülüş',
      f5Desc: 'Günlük lekeleri gidermeye yardımcı lekeleri önleme.',
    },
    productsSection: {
      badge: 'Ürün Koleksiyonu',
      title: 'En Çok Tercih Edilenler',
      subtitle: 'Klinik onaylı, patentli teknolojimizle tasarlanan yeni nesil ağız bakım serimiz.',
      allCategory: 'Tüm Ürünler',
      automaticCategory: 'Otomatik Seri',
      disposableCategory: 'Kullan At Seri',
      addToCart: 'Sepete Ekle',
      addedToCart: 'Sepete Eklendi',
      buyNow: 'Satın Al',
      inStock: 'Stokta Var',
      outOfStock: 'Tükendi',
      viewAll: 'Tüm Ürünleri İncele',
    },
    whyGulumse: {
      badge: 'Neden Gülümse?',
      title: 'Fark Yaratan 5 Marka Değeri.',
      subtitle: 'Ağız ve diş sağlığında en yüksek standartları estetikle buluşturuyoruz.',
      b1Title: 'Daha Sağlıklı Dişler',
      b1Desc: 'Plağa karşı %99.4 daha etkili koruma ile diş eti sağlığınızı güçlendirin.',
      b2Title: 'Güvenli ve Doğal Temizlik',
      b2Desc: 'BPA içermeyen medikal malzeme ve mikro aktif karbon kıl teknolojisi.',
      b3Title: 'Aile Boyu Kullanım',
      b3Desc: 'Değiştirilebilir renkli başlıklar ve yetişkin/çocuk hassas modları.',
      b4Title: 'Seyahatler İçin İdeal',
      b4Desc: 'Ultra hafif ergonomik kılıf, 45 günlük pil ve katlanabilir seçenekler.',
      b5Title: 'Daha Beyaz Bir Gülüş',
      b5Desc: 'İlk haftadan itibaren çay, kahve ve lekelere karşı görünür parlatma.',
    },
    editorial: {
      s1Badge: 'Her 3 Ayda Bir Yenileyin',
      s1Subtitle: 'Ağız Sağlığı Rutini',
      s1Title: 'Fırçanı Düzenli Yenile, Maksimum Koruma Sağla.',
      s1Desc: 'Diş hekimleri, optimum plak temizliği ve bakteri birikimini önlemek için fırça başlıklarının en geç 3 ayda bir yenilenmesini tavsiye ediyor.',
      s1Bullet1: '%99.8 Plak Temizleme Verimi',
      s1Bullet2: 'Kolay Geçmeli Uyumlu Başlık',
      s1Bullet3: 'Bakteri Tutmayan Medikal Silikon Yapı',
      s1Cta: 'Yedek Başlıkları İncele',
      s2Badge: 'Klinik Hassasiyet',
      s2Subtitle: 'Nazik & Etkili Bakım',
      s2Title: 'Hassas Diş Etlerine Özel Yumuşak Dokunuş.',
      s2Desc: 'Mikro incelikteki medikal fırça kılları, diş minenizi çizmeden ve diş etlerinize baskı yapmadan en zorlu aralıklara kadar ulaşır.',
      s2Bullet1: 'Hassas Diş Eti Dostu Yumuşak Kıllar',
      s2Bullet2: 'BPA İçermeyen Güvenli Malzeme',
      s2Bullet3: 'Diş Minesini Koruyan Mikro Titreşim',
      s2Cta: 'Hassas Seri Ürünleri Keşfet',
    },
    cta: {
      badge: 'HAYATA GÜLÜMSE',
      title: 'Gülümsemeye bugün başla.',
      titleHighlight: 'Sağlığı ve estetiği keşfet.',
      description: 'Hızlı kargo, 2 yıl resmi garanti ve %100 memnuniyet güvencesiyle sana en uygun ürünü hemen sipariş et.',
      primaryButtonText: 'Tüm Ürünleri İncele',
      secondaryButtonText: 'İletişime Geç',
      guarantee1: 'Aynı Gün Kargo Teslimatı',
      guarantee2: '2 Yıl Birebir Değişim Garantisi',
      guarantee3: '%100 Hijyen ve Müşteri Memnuniyeti',
    },
    footer: {
      badge1Title: 'Hızlı ve Güvenli Teslimat',
      badge1Desc: 'Tüm siparişlerde özenli kargo',
      badge2Title: '2 Yıl Resmi Garanti',
      badge2Desc: '%100 Orijinal ürün ve destek',
      badge3Title: '14 Gün Kolay İade',
      badge3Desc: 'Kesintisiz iade ve değişim',
      sloganLead: 'Gülümse.',
      sloganHighlight: 'Daha iyi hisset.',
      desc: 'Modern ağız ve diş bakımında yüksek teknoloji ve estetik deneyim.',
      productGroups: 'Ürün Grupları',
      automatic: 'Otomatik Diş Fırçası',
      disposable: 'Kullan At Diş Fırçaları',
      refills: 'Yedek Başlık Setleri',
      travelSets: 'Seyahat Paketleri',
      corporate: 'Kurumsal',
      about: 'Hakkımızda',
      contact: 'İletişim & Konum',
      faq: 'Sık Sorulan Sorular',
      customerCare: 'Müşteri Destek',
      shipping: 'Kargo ve Teslimat',
      returns: 'İptal ve İade Koşulları',
      orderTracking: 'Sipariş Takibi',
      contactUs: 'Bize Ulaşın',
      customerSupport: 'Müşteri Hizmetleri',
      rightsReserved: 'tüm hakları saklıdır.',
      privacyPolicy: 'Gizlilik Politikası',
      termsOfUse: 'Kullanım Koşulları',
      cookieSettings: 'Çerez Ayarları',
    },
    cart: {
      title: 'Alışveriş Sepetim',
      emptyTitle: 'Sepetiniz Boş',
      emptyDesc: 'Sepetinize henüz ürün eklemediniz. Ağız bakım ürünlerimizi keşfedin.',
      subtotal: 'Ara Toplam',
      shipping: 'Kargo',
      freeShipping: 'Ücretsiz Kargo',
      checkoutBtn: 'Satın Almaya Devam Et',
      continueShopping: 'Alışverişe Devam Et',
    },
    auth: {
      loginTitle: 'Giriş Yapın',
      loginDesc: 'Gülümse Dental Care hesabınıza erişin.',
      registerTitle: 'Hesap Oluşturun',
      registerDesc: 'Gülümse dünyasına katılarak siparişlerinizi yönetin.',
      email: 'E-posta Adresi',
      password: 'Şifre',
      firstName: 'Ad',
      lastName: 'Soyad',
      alreadyHaveAccount: 'Zaten hesabınız var mı?',
      dontHaveAccount: 'Hesabınız yok mu?',
      checkoutAuthGateTitle: 'Satın alma işlemine devam etmek için giriş yapmalısınız.',
      checkoutAuthGateDesc: 'Sipariş takibi ve fatura güvenliğiniz için alışverişinizi hesabınız üzerinden tamamlamanız gerekmektedir.',
    },
    search: {
      placeholder: 'Ürün veya kategori ara...',
      noResults: 'Aramanızla eşleşen ürün bulunamadı.',
      popularSearches: 'Popüler Aramalar',
    },
    common: {
      loading: 'Yükleniyor...',
      error: 'Bir hata oluştu.',
      success: 'İşlem başarılı.',
      currency: '₺',
    },
  },
  en: {
    nav: {
      topPromo1: 'Fast & Secure Delivery',
      topPromo2: '100% Customer Satisfaction',
      topPromo3: 'Healthy Smiles',
      home: 'Home',
      products: 'Products',
      automaticToothbrush: 'Automatic Toothbrush',
      disposableToothbrush: 'Disposable Toothbrush',
      allProducts: 'All Products',
      campaigns: 'Campaigns',
      about: 'About Us',
      faq: 'FAQ',
      contact: 'Contact',
      search: 'Search Products',
      cart: 'My Cart',
      profile: 'Profile & Orders',
      login: 'Sign In',
      register: 'Register',
      logout: 'Sign Out',
    },
    showcase: {
      or: 'or',
      leftCategorySubtitle: 'Automatic Toothbrush',
      leftTitleBadge: "WORLD'S FIRST",
      leftHighlight: '360° ROTATING',
      leftHighlightSub: 'TOOTHBRUSH',
      leftDefaultDesc: 'Deep clean without damaging enamel using 360° sonic vibration technology and micro-silicone bristles.',
      rightCategorySubtitle: 'Disposable Toothbrush',
      rightTitleBadge: "WORLD'S FIRST",
      rightHighlight: 'REPLACEABLE HEAD',
      rightHighlightSub: 'TOOTHBRUSH',
      rightDefaultDesc: 'Practical, hygienic, and travel-friendly. Fresh and sterile smiles anytime with replaceable head design.',
      buyNow: 'Buy Now',
      outOfStock: 'Out of Stock',
      bottomBarCta: 'Smile, Feel Better!',
      priceLabel: 'Price',
      viewProducts: 'View Products',

    },
    features: {
      f1Title: 'Healthier Teeth',
      f1Desc: 'Clinically approved gum protection and plaque removal.',
      f2Title: 'Safe & Natural Clean',
      f2Desc: 'BPA-free ultra-soft silicone bristles.',
      f3Title: 'Family Size Use',
      f3Desc: 'Custom sizes designed for adults and children.',
      f4Title: 'Ideal for Travel',
      f4Desc: 'Lightweight, portable with hygienic protective caps.',
      f5Title: 'A Whiter Smile',
      f5Desc: 'Helps remove daily stains and prevent yellowing.',
    },
    productsSection: {
      badge: 'Product Collection',
      title: 'Bestselling Dental Care',
      subtitle: 'Our next-generation dental care series engineered with clinically approved patented technology.',
      allCategory: 'All Products',
      automaticCategory: 'Automatic Series',
      disposableCategory: 'Disposable Series',
      addToCart: 'Add to Cart',
      addedToCart: 'Added to Cart',
      buyNow: 'Buy Now',
      inStock: 'In Stock',
      outOfStock: 'Out of Stock',
      viewAll: 'View All Products',
    },
    whyGulumse: {
      badge: 'Why Smile?',
      title: '5 Core Brand Values.',
      subtitle: 'We combine the highest clinical standards with aesthetics in dental hygiene.',
      b1Title: 'Healthier Teeth',
      b1Desc: 'Strengthen gum health with 99.4% more effective protection against plaque.',
      b2Title: 'Safe & Natural Clean',
      b2Desc: 'BPA-free medical silicone and micro active-charcoal bristle technology.',
      b3Title: 'Family Size Use',
      b3Desc: 'Interchangeable color-coded heads with adult & kid sensitive modes.',
      b4Title: 'Ideal for Travel',
      b4Desc: 'Ultra-lightweight travel case, 45-day battery life, and compact builds.',
      b5Title: 'A Whiter Smile',
      b5Desc: 'Visible stain removal against tea, coffee, and daily pigmentation in 1 week.',
    },
    editorial: {
      s1Badge: 'Replace Every 3 Months',
      s1Subtitle: 'Oral Health Routine',
      s1Title: 'Renew Your Brush Regularly for Maximum Protection.',
      s1Desc: 'Dentists recommend replacing brush heads every 3 months for optimum plaque removal and hygiene.',
      s1Bullet1: '99.8% Plaque Removal Efficiency',
      s1Bullet2: 'Easy Snap-On Compatible Heads',
      s1Bullet3: 'Antibacterial Medical Silicone',
      s1Cta: 'Explore Replacement Heads',
      s2Badge: 'Clinical Precision',
      s2Subtitle: 'Gentle & Effective Care',
      s2Title: 'Soft Touch Specially Designed for Sensitive Gums.',
      s2Desc: 'Micro-fine medical bristles reach difficult tooth gaps without scratching enamel or irritating gums.',
      s2Bullet1: 'Sensitive Gum Friendly Soft Bristles',
      s2Bullet2: 'BPA-Free Certified Safe Materials',
      s2Bullet3: 'Enamel Protecting Micro Vibrations',
      s2Cta: 'Explore Sensitive Care Series',
    },
    cta: {
      badge: 'SMILE TO LIFE',
      title: 'Start smiling today.',
      titleHighlight: 'Discover health & aesthetics.',
      description: 'Order the ideal dental care companion today with fast shipping, 2-year warranty, and 100% satisfaction guarantee.',
      primaryButtonText: 'Explore All Products',
      secondaryButtonText: 'Contact Us',
      guarantee1: 'Same Day Express Shipping',
      guarantee2: '2-Year Direct Replacement Warranty',
      guarantee3: '100% Hygiene & Customer Satisfaction',
    },
    footer: {
      badge1Title: 'Fast & Secure Delivery',
      badge1Desc: 'Carefully packaged on all orders',
      badge2Title: '2-Year Official Warranty',
      badge2Desc: '100% Authentic products & support',
      badge3Title: '14-Day Easy Returns',
      badge3Desc: 'Hassle-free return & replacement',
      sloganLead: 'Smile.',
      sloganHighlight: 'Feel better.',
      desc: 'High-tech aesthetics and clinical excellence in modern oral care.',
      productGroups: 'Product Lines',
      automatic: 'Automatic Toothbrush',
      disposable: 'Disposable Toothbrushes',
      refills: 'Replacement Head Sets',
      travelSets: 'Travel Packages',
      corporate: 'Corporate',
      about: 'About Us',
      contact: 'Contact & Location',
      faq: 'Frequently Asked Questions',
      customerCare: 'Customer Support',
      shipping: 'Shipping & Delivery',
      returns: 'Cancellation & Return Policy',
      orderTracking: 'Order Tracking',
      contactUs: 'Get in Touch',
      customerSupport: 'Customer Service',
      rightsReserved: 'all rights reserved.',
      privacyPolicy: 'Privacy Policy',
      termsOfUse: 'Terms of Service',
      cookieSettings: 'Cookie Settings',
    },
    cart: {
      title: 'Shopping Cart',
      emptyTitle: 'Your Cart is Empty',
      emptyDesc: 'You have not added any products yet. Discover our premium dental products.',
      subtotal: 'Subtotal',
      shipping: 'Shipping',
      freeShipping: 'Free Shipping',
      checkoutBtn: 'Proceed to Checkout',
      continueShopping: 'Continue Shopping',
    },
    auth: {
      loginTitle: 'Sign In',
      loginDesc: 'Access your Smile Dental Care account.',
      registerTitle: 'Create Account',
      registerDesc: 'Join Smile world to manage your orders effortlessly.',
      email: 'Email Address',
      password: 'Password',
      firstName: 'First Name',
      lastName: 'Last Name',
      alreadyHaveAccount: 'Already have an account?',
      dontHaveAccount: "Don't have an account?",
      checkoutAuthGateTitle: 'You must sign in to proceed with checkout.',
      checkoutAuthGateDesc: 'Please log in to ensure order tracking and invoice security.',
    },
    search: {
      placeholder: 'Search products or categories...',
      noResults: 'No products matched your search.',
      popularSearches: 'Popular Searches',
    },
    common: {
      loading: 'Loading...',
      error: 'An error occurred.',
      success: 'Operation successful.',
      currency: '$',
    },
  },
  de: {
    nav: {
      topPromo1: 'Schnelle & Sichere Lieferung',
      topPromo2: '100% Kundenzufriedenheit',
      topPromo3: 'Gesunde Lächeln',
      home: 'Startseite',
      products: 'Produkte',
      automaticToothbrush: 'Automatische Zahnbürste',
      disposableToothbrush: 'Einweg-Zahnbürste',
      allProducts: 'Alle Produkte',
      campaigns: 'Angebote',
      about: 'Über uns',
      faq: 'FAQ',
      contact: 'Kontakt',
      search: 'Produkte suchen',
      cart: 'Warenkorb',
      profile: 'Profil & Bestellungen',
      login: 'Anmelden',
      register: 'Registrieren',
      logout: 'Abmelden',
    },
    showcase: {
      or: 'oder',
      leftCategorySubtitle: 'Automatische Zahnbürste',
      leftTitleBadge: 'DIE ERSTE DER WELT',
      leftHighlight: '360° DREHBARE',
      leftHighlightSub: 'ZAHNBÜRSTE',
      leftDefaultDesc: 'Tiefenreinigung ohne Zahnschmelzschädigung mit 360° Schallvibrationstechnologie.',
      rightCategorySubtitle: 'Einweg-Zahnbürste',
      rightTitleBadge: 'DIE ERSTE DER WELT',
      rightHighlight: 'WECHSELKOPF',
      rightHighlightSub: 'ZAHNBÜRSTE',
      rightDefaultDesc: 'Praktisch, hygienisch und ideal für Reisen. Frisches Lächeln mit austauschbarem Kopf.',
      buyNow: 'Jetzt kaufen',
      outOfStock: 'Ausverkauft',
      bottomBarCta: 'Lächeln, besser fühlen!',
      priceLabel: 'Preis',
      viewProducts: 'Produkte Ansehen',

    },
    features: {
      f1Title: 'Gesündere Zähne',
      f1Desc: 'Klinisch geprüfter Zahnfleischschutz und Plaque-Entfernung.',
      f2Title: 'Sichere & Natürliche Reinigung',
      f2Desc: 'BPA-freie ultraweiche Silikonborsten.',
      f3Title: 'Für die ganze Familie',
      f3Desc: 'Spezielle Größen für Erwachsene und Kinder.',
      f4Title: 'Ideal für Reisen',
      f4Desc: 'Leicht, tragbar und mit Schutzkappe.',
      f5Title: 'Ein weißeres Lächeln',
      f5Desc: 'Hilft tägliche Verfärbungen sanft zu entfernen.',
    },
    productsSection: {
      badge: 'Produktkollektion',
      title: 'Bestseller Mundpflege',
      subtitle: 'Unsere patentierte Mundpflegeserie der nächsten Generation mit klinischer Zulassung.',
      allCategory: 'Alle Produkte',
      automaticCategory: 'Automatische Serie',
      disposableCategory: 'Einweg-Serie',
      addToCart: 'In den Warenkorb',
      addedToCart: 'Hinzugefügt',
      buyNow: 'Jetzt kaufen',
      inStock: 'Auf Lager',
      outOfStock: 'Ausverkauft',
      viewAll: 'Alle Produkte ansehen',
    },
    whyGulumse: {
      badge: 'Warum Lächeln?',
      title: '5 Wichtige Markenwerte.',
      subtitle: 'Wir verbinden höchste klinische Standards mit erstklassiger Ästhetik.',
      b1Title: 'Gesündere Zähne',
      b1Desc: 'Stärkt das Zahnfleisch mit 99,4% wirksamerem Schutz gegen Plaque.',
      b2Title: 'Sichere & Natürliche Reinigung',
      b2Desc: 'BPA-freies medizinisches Silikon und Aktivkohle-Bürstentechnologie.',
      b3Title: 'Für die ganze Familie',
      b3Desc: 'Austauschbare Farbköpfe mit speziellen Sensitiv-Modi.',
      b4Title: 'Ideal für Reisen',
      b4Desc: 'Ultraleichtes Reiseetui, 45 Tage Akkulaufzeit und kompaktes Format.',
      b5Title: 'Ein weißeres Lächeln',
      b5Desc: 'Sichtbare Zahnaufhellung gegen Kaffee- und Teeverfärbungen.',
    },
    editorial: {
      s1Badge: 'Alle 3 Monate wechseln',
      s1Subtitle: 'Mundpflege-Routine',
      s1Title: 'Regelmäßig wechseln für optimalen Schutz.',
      s1Desc: 'Zahnärzte empfehlen den Bürstenkopf alle 3 Monate zu erneuern.',
      s1Bullet1: '99,8% Plaque-Entfernung',
      s1Bullet2: 'Einfaches Klicksystem',
      s1Bullet3: 'Antibakterielles Silikon',
      s1Cta: 'Ersatzköpfe entdecken',
      s2Badge: 'Klinische Präzision',
      s2Subtitle: 'Sanfte & Effektive Pflege',
      s2Title: 'Sanfte Berührung für empfindliches Zahnfleisch.',
      s2Desc: 'Mikrofeine Borsten reinigen Zahnzwischenräume sanft und gründlich.',
      s2Bullet1: 'Zahnfleischfreundliche Borsten',
      s2Bullet2: 'BPA-freie sichere Materialien',
      s2Bullet3: 'Schallvibrationen zum Schutz des Schmelzes',
      s2Cta: 'Sensitive Serie entdecken',
    },
    cta: {
      badge: 'LÄCHLE DEM LEBEN ZU',
      title: 'Beginnen Sie heute zu lächeln.',
      titleHighlight: 'Gesundheit & Ästhetik entdecken.',
      description: 'Bestellen Sie heute mit schnellem Versand, 2 Jahren Garantie und 100% Zufriedenheitsgarantie.',
      primaryButtonText: 'Alle Produkte ansehen',
      secondaryButtonText: 'Kontakt aufnehmen',
      guarantee1: 'Expressversand am selben Tag',
      guarantee2: '2 Jahre direkte Austauschgarantie',
      guarantee3: '100% Hygiene & Kundenzufriedenheit',
    },
    footer: {
      badge1Title: 'Schnelle & Sichere Lieferung',
      badge1Desc: 'Sorgfältig verpackte Bestellungen',
      badge2Title: '2 Jahre Offizielle Garantie',
      badge2Desc: '100% Originalprodukte & Service',
      badge3Title: '14 Tage Rückgaberecht',
      badge3Desc: 'Unkomplizierte Rückgabe & Umtausch',
      sloganLead: 'Lächeln.',
      sloganHighlight: 'Besser fühlen.',
      desc: 'High-Tech Ästhetik und klinische Spitzenleistung in moderner Mundpflege.',
      productGroups: 'Produktgruppen',
      automatic: 'Automatische Zahnbürste',
      disposable: 'Einweg-Zahnbürsten',
      refills: 'Ersatzkopf-Sets',
      travelSets: 'Reisesets',
      corporate: 'Unternehmen',
      about: 'Über uns',
      contact: 'Kontakt & Standort',
      faq: 'Häufig gestellte Fragen',
      customerCare: 'Kundenservice',
      shipping: 'Versand & Lieferung',
      returns: 'Widerrufsbelehrung',
      orderTracking: 'Bestellverfolgung',
      contactUs: 'Kontaktieren Sie uns',
      customerSupport: 'Kundendienst',
      rightsReserved: 'alle Rechte vorbehalten.',
      privacyPolicy: 'Datenschutz',
      termsOfUse: 'Nutzungsbedingungen',
      cookieSettings: 'Cookie-Einstellungen',
    },
    cart: {
      title: 'Warenkorb',
      emptyTitle: 'Ihr Warenkorb ist leer',
      emptyDesc: 'Sie haben noch keine Produkte hinzugefügt. Entdecken Sie unsere Produkte.',
      subtotal: 'Zwischensumme',
      shipping: 'Versand',
      freeShipping: 'Kostenloser Versand',
      checkoutBtn: 'Zur Kasse',
      continueShopping: 'Weiter einkaufen',
    },
    auth: {
      loginTitle: 'Anmelden',
      loginDesc: 'Zugriff auf Ihr Smile Dental Care Konto.',
      registerTitle: 'Konto erstellen',
      registerDesc: 'Werden Sie Teil der Smile Welt und verwalten Sie Ihre Bestellungen.',
      email: 'E-Mail-Adresse',
      password: 'Passwort',
      firstName: 'Vorname',
      lastName: 'Nachname',
      alreadyHaveAccount: 'Bereits ein Konto?',
      dontHaveAccount: 'Noch kein Konto?',
      checkoutAuthGateTitle: 'Sie müssen sich anmelden, um fortzufahren.',
      checkoutAuthGateDesc: 'Für Bestellverfolgung und Rechnungs-Sicherheit bitte anmelden.',
    },
    search: {
      placeholder: 'Produkte oder Kategorien suchen...',
      noResults: 'Keine Produkte gefunden.',
      popularSearches: 'Beliebte Suchanfragen',
    },
    common: {
      loading: 'Wird geladen...',
      error: 'Ein Fehler ist aufgetreten.',
      success: 'Erfolgreich ausgeführt.',
      currency: '€',
    },
  },
  fr: {
    nav: {
      topPromo1: 'Livraison Rapide & Sécurisée',
      topPromo2: '100% Satisfaction Client',
      topPromo3: 'Des Sourires Éclatants',
      home: 'Accueil',
      products: 'Produits',
      automaticToothbrush: 'Brosse à dents automatique',
      disposableToothbrush: 'Brosse à dents jetable',
      allProducts: 'Tous les produits',
      campaigns: 'Promotions',
      about: 'À propos',
      faq: 'FAQ',
      contact: 'Contact',
      search: 'Rechercher un produit',
      cart: 'Mon Panier',
      profile: 'Profil & Commandes',
      login: 'Se connecter',
      register: 'S’inscrire',
      logout: 'Déconnexion',
    },
    showcase: {
      or: 'ou',
      leftCategorySubtitle: 'Brosse à dents automatique',
      leftTitleBadge: 'PREMIÈRE AU MONDE',
      leftHighlight: 'PIVOTANTE À 360°',
      leftHighlightSub: 'BROSSE À DENTS',
      leftDefaultDesc: 'Nettoyage en profondeur sans abîmer l’émail grâce à la technologie de vibration sonique à 360°.',
      rightCategorySubtitle: 'Brosse à dents jetable',
      rightTitleBadge: 'PREMIÈRE AU MONDE',
      rightHighlight: 'TÊTE INTERCHANGEABLE',
      rightHighlightSub: 'BROSSE À DENTS',
      rightDefaultDesc: 'Pratique, hygiénique et idéale pour le voyage. Un sourire frais et stérile à tout moment.',
      buyNow: 'Acheter maintenant',
      outOfStock: 'Épuisé',
      bottomBarCta: 'Sourire, se sentir mieux !',
      priceLabel: 'Prix',
      viewProducts: 'Voir les Produits',
    },
    features: {
      f1Title: 'Dents plus saines',
      f1Desc: 'Protection des gencives et élimination de la plaque approuvées en clinique.',
      f2Title: 'Nettoyage sûr & naturel',
      f2Desc: 'Poils en silicone ultra-doux sans BPA.',
      f3Title: 'Usage familial',
      f3Desc: 'Tailles adaptées pour adultes et enfants.',
      f4Title: 'Idéal pour le voyage',
      f4Desc: 'Léger, portable et doté d’un capuchon de protection hygiénique.',
      f5Title: 'Un sourire plus blanc',
      f5Desc: 'Aide à éliminer les taches quotidiennes.',
    },
    productsSection: {
      badge: 'Collection Produits',
      title: 'Nos Meilleures Ventes',
      subtitle: 'Notre gamme de soins bucco-dentaires de nouvelle génération brevetée et approuvée cliniquement.',
      allCategory: 'Tous les produits',
      automaticCategory: 'Gamme Automatique',
      disposableCategory: 'Gamme Jetable',
      addToCart: 'Ajouter au Panier',
      addedToCart: 'Ajouté au Panier',
      buyNow: 'Acheter',
      inStock: 'En Stock',
      outOfStock: 'Épuisé',
      viewAll: 'Voir tous les produits',
    },
    whyGulumse: {
      badge: 'Pourquoi Sourire ?',
      title: '5 Valeurs Fondamentales.',
      subtitle: 'Nous allions les normes cliniques les plus strictes à l’esthétique des soins dentaires.',
      b1Title: 'Dents plus saines',
      b1Desc: 'Renforce les gencives avec 99,4% de protection en plus contre la plaque dentaire.',
      b2Title: 'Nettoyage sûr & naturel',
      b2Desc: 'Silicone médical sans BPA et technologie de poils au charbon actif.',
      b3Title: 'Usage familial',
      b3Desc: 'Têtes interchangeables à code couleur avec modes sensibles adultes/enfants.',
      b4Title: 'Idéal pour le voyage',
      b4Desc: 'Étui de voyage ultra-léger, 45 jours d’autonomie et format compact.',
      b5Title: 'Un sourire plus blanc',
      b5Desc: 'Élimination visible des taches de café, thé et colorations quotidiennes.',
    },
    editorial: {
      s1Badge: 'À renouveler tous les 3 mois',
      s1Subtitle: 'Routine Bucco-Dentaire',
      s1Title: 'Renouvelez votre brosse pour une protection maximale.',
      s1Desc: 'Les dentistes recommandent de changer la tête de brosse tous les 3 mois pour une hygiène optimale.',
      s1Bullet1: 'Efficacité d’élimination de plaque à 99,8%',
      s1Bullet2: 'Têtes clipsables faciles à installer',
      s1Bullet3: 'Silicone médical antibactérien',
      s1Cta: 'Découvrir les têtes de rechange',
      s2Badge: 'Précision Clinique',
      s2Subtitle: 'Soin Doux & Efficace',
      s2Title: 'Une douceur absolue pour les gencives sensibles.',
      s2Desc: 'Les poils ultra-fins atteignent les zones difficiles sans rayer l’émail ni irriter les gencives.',
      s2Bullet1: 'Poils ultra-doux protecteurs',
      s2Bullet2: 'Matériaux certifiés sans BPA',
      s2Bullet3: 'Micro-vibrations préservant l’émail',
      s2Cta: 'Découvrir la gamme Sensible',
    },
    cta: {
      badge: 'SOURIEZ À LA VIE',
      title: 'Commencez à sourire dès aujourd’hui.',
      titleHighlight: 'Découvrez santé & esthétique.',
      description: 'Commandez dès maintenant votre compagnon de soin avec livraison rapide, 2 ans de garantie et 100% de satisfaction.',
      primaryButtonText: 'Découvrir tous les produits',
      secondaryButtonText: 'Nous contacter',
      guarantee1: 'Expédition Express le jour même',
      guarantee2: 'Garantie échange direct 2 ans',
      guarantee3: '100% Hygiène & Satisfaction Client',
    },
    footer: {
      badge1Title: 'Livraison Rapide & Sécurisée',
      badge1Desc: 'Emballage soigné sur toutes les commandes',
      badge2Title: 'Garantie Officielle 2 Ans',
      badge2Desc: 'Produits 100% authentiques & assistance',
      badge3Title: 'Retours Faciles 14 Jours',
      badge3Desc: 'Retour et échange sans tracas',
      sloganLead: 'Sourire.',
      sloganHighlight: 'Se sentir mieux.',
      desc: 'L’excellence clinique et l’esthétique haute technologie pour vos soins dentaires.',
      productGroups: 'Nos Gammes',
      automatic: 'Brosse à dents automatique',
      disposable: 'Brosses à dents jetables',
      refills: 'Lots de têtes de rechange',
      travelSets: 'Packs de voyage',
      corporate: 'Entreprise',
      about: 'À propos de nous',
      contact: 'Contact & Adresse',
      faq: 'Foire aux Questions',
      customerCare: 'Service Client',
      shipping: 'Livraison & Expédition',
      returns: 'Politique de retour et annulation',
      orderTracking: 'Suivi de commande',
      contactUs: 'Nous Contacter',
      customerSupport: 'Assistance Client',
      rightsReserved: 'tous droits réservés.',
      privacyPolicy: 'Politique de confidentialité',
      termsOfUse: 'Conditions d’utilisation',
      cookieSettings: 'Paramètres des cookies',
    },
    cart: {
      title: 'Mon Panier',
      emptyTitle: 'Votre panier est vide',
      emptyDesc: 'Vous n’avez pas encore ajouté de produit. Découvrez notre sélection dentaire.',
      subtotal: 'Sous-total',
      shipping: 'Frais de port',
      freeShipping: 'Livraison Gratuite',
      checkoutBtn: 'Commander',
      continueShopping: 'Continuer mes achats',
    },
    auth: {
      loginTitle: 'Se connecter',
      loginDesc: 'Accédez à votre compte Smile Dental Care.',
      registerTitle: 'Créer un compte',
      registerDesc: 'Rejoignez l’univers Smile pour gérer facilement vos commandes.',
      email: 'Adresse e-mail',
      password: 'Mot de passe',
      firstName: 'Prénom',
      lastName: 'Nom',
      alreadyHaveAccount: 'Vous avez déjà un compte ?',
      dontHaveAccount: 'Pas encore de compte ?',
      checkoutAuthGateTitle: 'Vous devez vous connecter pour poursuivre la commande.',
      checkoutAuthGateDesc: 'Veuillez vous connecter pour assurer le suivi de votre commande.',
    },
    search: {
      placeholder: 'Rechercher un produit ou une catégorie...',
      noResults: 'Aucun produit ne correspond à votre recherche.',
      popularSearches: 'Recherches Populaires',
    },
    common: {
      loading: 'Chargement...',
      error: 'Une erreur est survenue.',
      success: 'Opération réussie.',
      currency: '€',
    },
  },
  it: {
    nav: {
      topPromo1: 'Spedizione Rapida e Gratuita',
      topPromo2: '100% Soddisfazione Garantita',
      topPromo3: 'Sorrisi Sani e Splendenti',
      home: 'Home',
      products: 'Prodotti',
      automaticToothbrush: 'Spazzolino Automatico',
      disposableToothbrush: 'Spazzolino Monouso',
      allProducts: 'Tutti i Prodotti',
      campaigns: 'Offerte',
      about: 'Chi Siamo',
      faq: 'FAQ',
      contact: 'Contatti',
      search: 'Cerca Prodotto',
      cart: 'Carrello',
      profile: 'Profilo & Ordini',
      login: 'Accedi',
      register: 'Registrati',
      logout: 'Esci',
    },
    showcase: {
      or: 'oppure',
      leftCategorySubtitle: 'Spazzolino Automatico',
      leftTitleBadge: 'IL PRIMO AL MONDO',
      leftHighlight: 'GIRANTE A 360°',
      leftHighlightSub: 'SPAZZOLINO',
      leftDefaultDesc: 'Tecnologia sonica rotativa a 360° e setole in micro-silicone per una pulizia profonda nel rispetto dello smalto.',
      rightCategorySubtitle: 'Spazzolino Monouso',
      rightTitleBadge: 'IL PRIMO AL MONDO',
      rightHighlight: 'TESTINA INTERCAMBIABILE',
      rightHighlightSub: 'SPAZZOLINO',
      rightDefaultDesc: 'Pratico, igienico e ideale per i viaggi. Design con testine intercambiabili per una freschezza costante ovunque ti trovi.',
      buyNow: 'Acquista Ora',
      outOfStock: 'Esaurito',
      bottomBarCta: 'Sorridi, Sentiti Meglio!',
      priceLabel: 'Prezzo',
      viewProducts: 'Vedi Prodotti',

    },
    features: {
      f1Title: 'Denti Più Sani',
      f1Desc: 'Protezione gengivale clinicamente testata e rimozione efficace della placca.',
      f2Title: 'Pulizia Naturale e Sicura',
      f2Desc: 'Setole in silicone medico alimentare senza sostanze nocive.',
      f3Title: 'Adatto a Denti Sensibili',
      f3Desc: 'Micro-vibrazioni morbide che proteggono lo smalto.',
      f4Title: 'Ideale per i Viaggi',
      f4Desc: 'Design compatto con cappuccio protettivo igienico.',
      f5Title: 'Garanzia Ufficiale 2 Anni',
      f5Desc: 'Sostituzione diretta e assistenza clienti dedicata.',
    },
    productsSection: {
      badge: 'Collezione Esclusiva',
      title: 'I Più Venduti & Consigliati',
      subtitle: 'Scopri i nostri spazzolini sonici all’avanguardia e gli accessori per la cura del tuo sorriso.',
      allCategory: 'Tutti',
      automaticCategory: 'Automatici',
      disposableCategory: 'Monouso & Viaggio',
      addToCart: 'Aggiungi al Carrello',
      addedToCart: 'Aggiunto!',
      buyNow: 'Acquista Ora',
      inStock: 'Disponibile',
      outOfStock: 'Esaurito',
      viewAll: 'Tutti i Prodotti',
    },
    whyGulumse: {
      badge: 'PERCHÉ GÜLÜMSE?',
      title: 'Standard Clinico & Cura Dentale Avanzata',
      subtitle: 'Uniamo tecnologia sonica e design ergonomico per la salute e la bellezza del tuo sorriso.',
      b1Title: 'Rimozione Placca 99.8%',
      b1Desc: 'Pulisce le superfici dentali in soli 45 secondi grazie a 32.000 vibrazioni/min.',
      b2Title: 'Micro Silicone Morbido',
      b2Desc: 'Testine in silicone medicale per massaggiare le gengive senza graffiare lo smalto.',
      b3Title: 'Autonomia di 45 Giorni',
      b3Desc: 'Una sola ricarica rapida dura fino a un mese e mezzo di utilizzo quotidiano.',
      b4Title: 'Impermeabile IPX7',
      b4Desc: 'Lavabile al 100% sotto l’acqua e sicuro anche sotto la doccia.',
      b5Title: 'Garanzia e Assistenza 2 Anni',
      b5Desc: 'Qualità certificata con reso facile entro 14 giorni e sostituzione diretta.',
    },
    editorial: {
      s1Badge: 'TECNOLOGIA SONICA 360°',
      s1Subtitle: 'PULIZIA PROFESSIONALE A CASA',
      s1Title: 'Il Futuro della Cura Dentale',
      s1Desc: 'Sperimenta una pulizia impeccabile e senza sforzo grazie all’innovativa rotazione a 360 gradi.',
      s1Bullet1: '45 secondi per una copertura totale',
      s1Bullet2: 'Sensori di pressione intelligenti',
      s1Bullet3: '3 modalità di pulizia personalizzate',
      s1Cta: 'Scopri lo Spazzolino Automatico',
      s2Badge: 'SERIE VIAGGIO & IGIENE',
      s2Subtitle: 'TESTINE INTERCAMBIABILI',
      s2Title: 'Igiene Quotidiana Sempre con Te',
      s2Desc: 'Compatto, pratico e igienico. Portalo sempre con te in ufficio, in palestra o in viaggio.',
      s2Bullet1: 'Cappuccio protettivo antibatterico',
      s2Bullet2: 'Dentifricio integrato monodose',
      s2Bullet3: 'Design tascabile e leggero',
      s2Cta: 'Scopri lo Spazzolino Monouso',
    },
    cta: {
      badge: 'SORRIDI ALLA VITA',
      title: 'Inizia a sorridere oggi.',
      titleHighlight: 'Scopri salute ed estetica.',
      description: 'Ordina ora il tuo compagno per l’igiene orale con spedizione rapida, 2 anni di garanzia e 100% di soddisfazione.',
      primaryButtonText: 'Scopri Tutti i Prodotti',
      secondaryButtonText: 'Contattaci',
      guarantee1: 'Spedizione Rapida in Giornata',
      guarantee2: 'Garanzia Sostituzione 2 Anni',
      guarantee3: '100% Igiene & Soddisfazione',
    },
    footer: {
      badge1Title: 'Spedizione Rapida & Gratuita',
      badge1Desc: 'Imballaggio protettivo su tutti gli ordini',
      badge2Title: 'Garanzia Ufficiale 2 Anni',
      badge2Desc: 'Prodotti 100% autentici e certificati',
      badge3Title: 'Reso Facile 14 Giorni',
      badge3Desc: 'Rimborso semplice senza complicazioni',
      sloganLead: 'Sorridi.',
      sloganHighlight: 'Sentiti meglio.',
      desc: 'Eccellenza clinica e innovazione tecnologica per la salute e bellezza del tuo sorriso.',
      productGroups: 'Le Nostre Gamme',
      automatic: 'Spazzolino Automatico',
      disposable: 'Spazzolini Monouso',
      refills: 'Testine di Ricambio',
      travelSets: 'Set da Viaggio',
      corporate: 'Azienda',
      about: 'Chi Siamo',
      contact: 'Contatti & Sede',
      faq: 'Domande Frequenti (FAQ)',
      customerCare: 'Assistenza Clienti',
      shipping: 'Spedizione & Consegna',
      returns: 'Diritto di Recesso e Resi',
      orderTracking: 'Traccia Ordine',
      contactUs: 'Scrivici',
      customerSupport: 'Supporto Clienti',
      rightsReserved: 'tutti i diritti riservati.',
      privacyPolicy: 'Informativa sulla Privacy',
      termsOfUse: 'Termini di Utilizzo',
      cookieSettings: 'Impostazioni Cookie',
    },
    cart: {
      title: 'Il Mio Carrello',
      emptyTitle: 'Il tuo carrello è vuoto',
      emptyDesc: 'Non hai ancora aggiunto nessun prodotto. Esplora il nostro catalogo.',
      subtotal: 'Subtotale',
      shipping: 'Spedizione',
      freeShipping: 'Spedizione Gratuita',
      checkoutBtn: 'Procedi all’Acquisto',
      continueShopping: 'Continua lo Shopping',
    },
    auth: {
      loginTitle: 'Accedi',
      loginDesc: 'Accedi al tuo account Gülümse Dental Care.',
      registerTitle: 'Crea un Account',
      registerDesc: 'Registrati per gestire comodamente i tuoi ordini.',
      email: 'Indirizzo E-mail',
      password: 'Password',
      firstName: 'Nome',
      lastName: 'Cognome',
      alreadyHaveAccount: 'Hai già un account?',
      dontHaveAccount: 'Non hai un account?',
      checkoutAuthGateTitle: 'È necessario accedere per completare l’acquisto.',
      checkoutAuthGateDesc: 'Accedi al tuo account per visualizzare lo stato dell’ordine.',
    },
    search: {
      placeholder: 'Cerca prodotti o categorie...',
      noResults: 'Nessun prodotto corrisponde alla tua ricerca.',
      popularSearches: 'Ricerche Popolari',
    },
    common: {
      loading: 'Caricamento...',
      error: 'Si è verificato un errore.',
      success: 'Operazione completata con successo.',
      currency: '€',
    },
  },
}

export type Dictionary = TranslationDictionary

export const getDictionary = (locale: SupportedLocale): TranslationDictionary => {
  return dictionaries[locale] || dictionaries.tr
}
