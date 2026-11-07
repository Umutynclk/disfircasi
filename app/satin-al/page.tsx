'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { doc, getDoc, collection, addDoc, setDoc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import {
  FiCheck,
  FiArrowLeft,
  FiUser,
  FiPhone,
  FiMail,
  FiMapPin,
  FiShield,
  FiLock,
  FiLogIn,
  FiUserPlus,
  FiCreditCard,
  FiFileText,
  FiInfo,
  FiX,
  FiCheckCircle,
  FiAlertCircle,
  FiCopy,
  FiAward,
  FiTruck,
  FiRefreshCw,
  FiPlus,
  FiHome,
  FiBriefcase,
  FiTrash2,
} from 'react-icons/fi'
import { getCart, clearCart, CartItem } from '@/lib/utils/cart'
import {
  onUserAuthStateChanged,
  getUserData,
  getUserSavedAddresses,
  saveUserAddress,
  UserAddress,
} from '@/lib/firebase/userAuth'
import { CITIES_LIST, TURKEY_LOCATIONS } from '@/lib/data/locations'
import { subscribeToLegalConfig, DEFAULT_LEGAL_CONFIG, LegalDocumentsConfig } from '@/lib/firebase/legal'
import { validateTCKimlik, validateVergiNo, validateCorporateTaxNumber } from '@/lib/utils/taxValidation'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocale } from '@/context/LocaleContext'

const CHECKOUT_TRANSLATIONS = {
  tr: {
    backToCart: 'Sepete Dön',
    authRequiredBadge: 'Üyelik Girişi Gerekli',
    authRequiredTitle: 'Satın alma işlemine devam etmek için giriş yapmalısınız.',
    authRequiredDesc: 'Sipariş takibi, garanti belgesi ve fatura güvenliğiniz için alışverişinizi hesabınız üzerinden tamamlamanız gerekmektedir.',
    loginBtn: 'Giriş Yap',
    registerBtn: 'Hesap Oluştur (Kayıt Ol)',
    orderReceivedTitle: 'Siparişiniz Alındı!',
    orderNumberLabel: 'Sipariş Numaranız:',
    orderSuccessDesc: 'Sipariş detayları ve kargo takip bilgileriniz e-posta adresinize iletilecektir.',
    backToHome: 'Ana Sayfaya Dön',
    deliveryHeading: 'Teslimat & İletişim Bilgileri',
    deliverySub: 'Lütfen siparişinizin ulaşacağı adresi eksiksiz doldurun.',
    fullName: 'Ad Soyad *',
    email: 'E-Posta Adresi *',
    phone: 'Telefon *',
    city: 'Şehir *',
    district: 'İlçe *',
    address: 'Açık Adres *',
    addressPlaceholder: 'Mahalle, sokak, bina ve daire numarası...',
    orderNote: 'Sipariş Notu (Opsiyonel)',
    notePlaceholder: 'Zil çalışmıyor, kargocu arasın vb.',
    paymentHeading: 'Ödeme Yöntemi & Güvenlik',
    paymentSub: 'Tüm ödemeler 256-Bit SSL ve 3D Secure güvencesiyle PayTR altyapısında gerçekleşir.',
    payCard: 'Kredi / Banka Kartı (PayTR 3D Secure)',
    payHavale: 'Havale / EFT ile Ödeme',
    submitOrder: 'Siparişi Onayla & 3D Secure ile Öde',
    submitting: 'Güvenli Ödeme Ekranı Hazırlanıyor...',
    orderSummary: 'Sipariş Özeti',
    itemsCount: 'Kalem',
    qty: 'Adet:',
    subtotal: 'Ara Toplam',
    shipping: 'Kargo Ücreti',
    freeShipping: 'Ücretsiz Kargo',
    total: 'Toplam Tutar',
    sslNotice: 'Ödemeniz 256-Bit SSL şifrelemesi ve PayTR PCI-DSS Seviye 1 güvencesiyle korunmaktadır.',
    paytrGuarantee: 'Kart bilgileriniz sunucularımızda asla saklanmaz. Ödeme işlemi doğrudan BDDK ve TCMB lisanslı PayTR güvenli ödeme geçidi ve bankanızın 3D Secure SMS onay ekranında tamamlanır.',
    agreementText: 'Ön Bilgilendirme Koşulları\'nı ve Mesafeli Satış Sözleşmesi\'ni okudum, onaylıyorum.',
    kvkkText: 'KVKK Aydınlatma Metni\'ni ve Gizlilik ve Güvenlik Politikası\'nı okudum, kabul ediyorum.',
    alertLogin: 'Sipariş vermek için lütfen önce giriş yapın.',
    alertFill: 'Lütfen gerekli iletişim ve adres bilgilerini doldurun.',
    alertAgreement: 'Lütfen Mesafeli Satış Sözleşmesi ve KVKK onay kutularını işaretleyin.',
    alertError: 'Siparişiniz oluşturulurken bir hata oluştu. Lütfen tekrar deneyin.',
  },
  en: {
    backToCart: 'Back to Cart',
    authRequiredBadge: 'Account Required',
    authRequiredTitle: 'Please sign in to proceed with checkout.',
    authRequiredDesc: 'For order tracking, digital warranty, and secure invoicing, please sign in or register an account.',
    loginBtn: 'Sign In',
    registerBtn: 'Create an Account',
    orderReceivedTitle: 'Order Received!',
    orderNumberLabel: 'Order Number:',
    orderSuccessDesc: 'Order details and tracking updates will be emailed to you.',
    backToHome: 'Back to Home',
    deliveryHeading: 'Shipping & Contact Details',
    deliverySub: 'Please enter the delivery destination address accurately.',
    fullName: 'Full Name *',
    email: 'Email Address *',
    phone: 'Phone *',
    city: 'City *',
    district: 'District *',
    address: 'Street Address *',
    addressPlaceholder: 'Street name, house number, apartment, floor...',
    orderNote: 'Order Notes (Optional)',
    notePlaceholder: 'Delivery instructions, gate code, etc.',
    paymentHeading: 'Payment Method & Security',
    paymentSub: 'All payments are processed via PayTR with 256-Bit SSL and 3D Secure.',
    payCard: 'Credit / Debit Card (PayTR 3D Secure)',
    payHavale: 'Bank Wire / EFT Transfer',
    submitOrder: 'Confirm & Pay Securely',
    submitting: 'Preparing Secure Checkout...',
    orderSummary: 'Order Summary',
    itemsCount: 'Items',
    qty: 'Qty:',
    subtotal: 'Subtotal',
    shipping: 'Shipping',
    freeShipping: 'Free Shipping',
    total: 'Total Amount',
    sslNotice: 'Your payment is protected by 256-Bit SSL and PayTR PCI-DSS Level 1 certification.',
    paytrGuarantee: 'Your card details are never stored on our servers. Transactions are handled directly by PayTR secure gateway and bank 3D Secure SMS verification.',
    agreementText: 'I have read and agree to the Preliminary Information Form and Distance Sales Agreement.',
    kvkkText: 'I have read and agree to the Privacy Policy and Personal Data (KVKK) Terms.',
    alertLogin: 'Please log in to place an order.',
    alertFill: 'Please complete all required shipping fields.',
    alertAgreement: 'Please accept the mandatory sales agreement and privacy terms.',
    alertError: 'An error occurred while placing your order. Please try again.',
  },
  de: {
    backToCart: 'Zurück zum Warenkorb',
    authRequiredBadge: 'Konto Erforderlich',
    authRequiredTitle: 'Bitte melden Sie sich an, um zur Kasse zu gehen.',
    authRequiredDesc: 'Für Sendungsverfolgung, Garantienachweis und sichere Rechnungserstellung ist eine Anmeldung erforderlich.',
    loginBtn: 'Anmelden',
    registerBtn: 'Konto Erstellen',
    orderReceivedTitle: 'Bestellung Eingegangen!',
    orderNumberLabel: 'Bestellnummer:',
    orderSuccessDesc: 'Bestelldetails und Tracking-Informationen werden an Ihre E-Mail-Adresse gesendet.',
    backToHome: 'Zur Startseite',
    deliveryHeading: 'Liefer- & Kontaktdaten',
    deliverySub: 'Bitte geben Sie Ihre vollständige Lieferadresse ein.',
    fullName: 'Vollständiger Name *',
    email: 'E-Mail-Adresse *',
    phone: 'Telefonnummer *',
    city: 'Stadt *',
    district: 'Bezirk *',
    address: 'Lieferadresse *',
    addressPlaceholder: 'Straße, Hausnummer, Etage, Zusatz...',
    orderNote: 'Bestellhinweis (Optional)',
    notePlaceholder: 'Hinweise für den Zusteller etc.',
    paymentHeading: 'Zahlungsmethode & Sicherheit',
    paymentSub: 'Alle Zahlungen erfolgen über PayTR mit 256-Bit-SSL und 3D Secure.',
    payCard: 'Kredit- / Debitkarte (PayTR 3D Secure)',
    payHavale: 'Banküberweisung / Vorkasse',
    submitOrder: 'Zahlungspflichtig Bestellen',
    submitting: 'Sichere Verbindung wird aufgebaut...',
    orderSummary: 'Bestellübersicht',
    itemsCount: 'Artikel',
    qty: 'Menge:',
    subtotal: 'Zwischensumme',
    shipping: 'Versandkosten',
    freeShipping: 'Kostenloser Versand',
    total: 'Gesamtbetrag',
    sslNotice: 'Ihre Zahlung ist durch 256-Bit-SSL und PayTR PCI-DSS Level 1 geschützt.',
    paytrGuarantee: 'Ihre Kartendaten werden niemals auf unseren Servern gespeichert. Die Abwicklung erfolgt direkt über PayTR und 3D Secure.',
    agreementText: 'Ich habe die Vorabinformationen und den Fernabsatzvertrag gelesen und akzeptiere sie.',
    kvkkText: 'Ich habe die Datenschutzrichtlinie gelesen und stimme der Datenverarbeitung zu.',
    alertLogin: 'Bitte melden Sie sich an, um zu bestellen.',
    alertFill: 'Bitte füllen Sie alle erforderlichen Lieferfelder aus.',
    alertAgreement: 'Bitte akzeptieren Sie die Vertragsbedingungen.',
    alertError: 'Fehler beim Erstellen der Bestellung. Bitte erneut versuchen.',
  },
  fr: {
    backToCart: 'Retour au Panier',
    authRequiredBadge: 'Compte Requis',
    authRequiredTitle: 'Veuillez vous connecter pour procéder au paiement.',
    authRequiredDesc: 'Pour le suivi des commandes, la garantie et la facturation sécurisée, veuillez vous identifier.',
    loginBtn: 'Se Connecter',
    registerBtn: 'Créer un Compte',
    orderReceivedTitle: 'Commande Confirmée !',
    orderNumberLabel: 'Numéro de commande :',
    orderSuccessDesc: 'Les détails de la commande et le lien de suivi vous seront envoyés par e-mail.',
    backToHome: 'Retour à l’Accueil',
    deliveryHeading: 'Informations de Livraison & Contact',
    deliverySub: 'Veuillez renseigner votre adresse de livraison complète.',
    fullName: 'Nom et Prénom *',
    email: 'Adresse E-mail *',
    phone: 'Téléphone *',
    city: 'Ville *',
    district: 'Quartier *',
    address: 'Adresse de Livraison *',
    addressPlaceholder: 'Rue, numéro, bâtiment, étage...',
    orderNote: 'Note de commande (Optionnel)',
    notePlaceholder: 'Instructions pour le livreur...',
    paymentHeading: 'Moyen de Paiement & Sécurité',
    paymentSub: 'Paiements sécurisés par PayTR avec cryptage SSL 256 bits et 3D Secure.',
    payCard: 'Carte Bancaire / Crédit (PayTR 3D Secure)',
    payHavale: 'Virement Bancaire',
    submitOrder: 'Confirmer et Payer en Toute Sécurité',
    submitting: 'Connexion sécurisée en cours...',
    orderSummary: 'Récapitulatif de Commande',
    itemsCount: 'Articles',
    qty: 'Qté :',
    subtotal: 'Sous-total',
    shipping: 'Frais de Port',
    freeShipping: 'Livraison Gratuite',
    total: 'Montant Total',
    sslNotice: 'Paiement sécurisé par cryptage SSL 256 bits et certification PayTR PCI-DSS.',
    paytrGuarantee: 'Vos données bancaires ne sont jamais enregistrées sur nos serveurs. Le traitement s’effectue via le protocole sécurisé PayTR et 3D Secure.',
    agreementText: 'J\'ai lu et j\'accepte le Formulaire d\'Information Préalable et le Contrat de Vente à Distance.',
    kvkkText: 'J\'ai lu et j\'accepte la Politique de Confidentialité et le Traitement des Données.',
    alertLogin: 'Veuillez vous connecter pour commander.',
    alertFill: 'Veuillez remplir tous les champs obligatoires.',
    alertAgreement: 'Veuillez accepter les conditions de vente et la politique de confidentialité.',
    alertError: 'Une erreur est survenue lors de la commande.',
  },
  it: {
    backToCart: "Torna al Carrello",
    authRequiredBadge: "Account Richiesto",
    authRequiredTitle: "Accedi per procedere al pagamento.",
    authRequiredDesc: "Per tracciare il tuo ordine e ricevere la garanzia, effettua l'accesso o registrati.",
    loginBtn: "Accedi",
    registerBtn: "Crea un Account",
    orderReceivedTitle: "Ordine Confermato!",
    orderNumberLabel: "Numero ordine:",
    orderSuccessDesc: "I dettagli dell'ordine e il link di tracciamento ti verranno inviati via e-mail.",
    backToHome: "Torna alla Home",
    deliveryHeading: "Dati di Spedizione & Contatto",
    deliverySub: "Inserisci il tuo indirizzo di consegna completo.",
    fullName: "Nome e Cognome *",
    email: "Indirizzo E-mail *",
    phone: "Telefono *",
    city: "Città *",
    district: "Distretto *",
    address: "Indirizzo di Spedizione *",
    addressPlaceholder: "Via, numero civico, piano, interno...",
    orderNote: "Note sull'ordine (Facoltativo)",
    notePlaceholder: "Istruzioni per il corriere...",
    paymentHeading: "Metodo di Pagamento & Sicurezza",
    paymentSub: "Tutti i pagamenti sono protetti da crittografia SSL a 256 bit e 3D Secure tramite PayTR.",
    payCard: "Carta di Credito / Debito (PayTR 3D Secure)",
    payHavale: "Bonifico Bancario",
    submitOrder: "Conferma e Paga in Modo Sicuro",
    submitting: "Connessione sicura in corso...",
    orderSummary: "Riepilogo Ordine",
    itemsCount: "Articoli",
    qty: "Qtà:",
    subtotal: "Subtotale",
    shipping: "Spedizione",
    freeShipping: "Spedizione Gratuita",
    total: "Totale",
    sslNotice: "Il tuo pagamento è protetto da crittografia SSL a 256 bit e certificazione PayTR PCI-DSS.",
    paytrGuarantee: "I dati della tua carta non vengono mai memorizzati sui nostri server. La transazione avviene tramite gateway PayTR e 3D Secure.",
    agreementText: "Ho letto e accetto il Modulo Informativo Preliminare e il Contratto di Vendita a Distanza.",
    kvkkText: "Ho letto e accetto l'Informativa sulla Privacy e il Trattamento dei Dati Personali.",
    alertLogin: "Accedi per effettuare un ordine.",
    alertFill: "Compila tutti i campi obbligatori di spedizione.",
    alertAgreement: "Accetta le condizioni contrattuali e la normativa sulla privacy.",
    alertError: "Si è verificato un errore durante l'ordine. Riprova.",
  },
}

function CheckoutContent() {
  const { locale, currency, currencyConfig, getLocalizedPath, formatPriceWithCurrency } = useLocale()
  const loc = CHECKOUT_TRANSLATIONS[locale] || CHECKOUT_TRANSLATIONS.tr
  const router = useRouter()
  const searchParams = useSearchParams()

  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [baseShippingFee, setBaseShippingFee] = useState(0)
  const [freeShippingThreshold, setFreeShippingThreshold] = useState(0)

  // Auth States
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [authChecking, setAuthChecking] = useState(true)

  // Saved Addresses & Selection State
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<string>('new')
  const [saveToProfile, setSaveToProfile] = useState(true)
  const [makeDefaultAddress, setMakeDefaultAddress] = useState(false)
  const [makeDefaultBilling, setMakeDefaultBilling] = useState(false)
  const [addressTitle, setAddressTitle] = useState('Ev')

  // Zorunlu Müşteri Türü ve Fatura Durumu ('individual' | 'corporate')
  const [customerType, setCustomerType] = useState<'individual' | 'corporate'>('individual')
  const [tcKimlikNo, setTcKimlikNo] = useState('')
  const [sameAsDeliveryAddress, setSameAsDeliveryAddress] = useState(true)
  const [billingAddress, setBillingAddress] = useState({
    address: '',
    city: '',
    district: '',
  })
  const [corporateData, setCorporateData] = useState({
    companyName: '',
    taxOffice: '',
    taxNumber: '',
    authorizedPersonName: '',
    authorizedPersonSurname: '',
  })
  const [saveCardConsent, setSaveCardConsent] = useState(false)

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    district: '',
    postalCode: '',
    note: '',
  })

  // Payment Method
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'havale'>('card')

  // PayTR iFrame States
  const [paytrToken, setPaytrToken] = useState<string | null>(null)
  const [paytrOrderNumber, setPaytrOrderNumber] = useState('')
  const [showPaytrModal, setShowPaytrModal] = useState(false)

  // Legal Agreements Acceptance
  const [agreementAccepted, setAgreementAccepted] = useState(false)
  const [kvkkAccepted, setKvkkAccepted] = useState(false)

  // Modals
  const [activeModal, setActiveModal] = useState<'sozlesme' | 'onbilgi' | 'kvkk' | null>(null)
  const [legalConfig, setLegalConfig] = useState<LegalDocumentsConfig>(DEFAULT_LEGAL_CONFIG)

  // Legal Agreements Scroll & Reading Verification
  const [agreementRead, setAgreementRead] = useState(false)
  const [kvkkRead, setKvkkRead] = useState(false)
  const [modalScrolledToBottom, setModalScrolledToBottom] = useState(false)
  const modalScrollRef = useRef<HTMLDivElement>(null)

  // Reset scroll check when modal opens
  useEffect(() => {
    if (activeModal) {
      setModalScrolledToBottom(false)
      const timer = setTimeout(() => {
        if (modalScrollRef.current) {
          const { scrollHeight, clientHeight } = modalScrollRef.current
          if (scrollHeight <= clientHeight + 30) {
            setModalScrolledToBottom(true)
          }
        }
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [activeModal])

  const handleModalScroll = () => {
    if (modalScrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = modalScrollRef.current
      if (scrollTop + clientHeight >= scrollHeight - 35) {
        setModalScrolledToBottom(true)
      }
    }
  }

  const [submitting, setSubmitting] = useState(false)
  const [orderComplete, setOrderComplete] = useState(false)
  const [orderVerifying, setOrderVerifying] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [verifiedOrderData, setVerifiedOrderData] = useState<any>(null)
  const [copiedIban, setCopiedIban] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const [verifyTimedOut, setVerifyTimedOut] = useState(false)

  const iframeRef = useRef<HTMLIFrameElement>(null)

  // Detect return flow from URL params
  const odemeParam = searchParams.get('odeme')
  const oidParam = searchParams.get('oid')
  const isReturnFlow = odemeParam === 'basarili' && !!oidParam
  const isErrorReturn = odemeParam === 'hata'

  // 1. Subscribe to Legal & Payment Config
  useEffect(() => {
    const unsubLegal = subscribeToLegalConfig((cfg) => {
      setLegalConfig(cfg)
    })
    return () => unsubLegal()
  }, [])

  // 2. Auth State Changed — load profile + saved addresses
  useEffect(() => {
    const unsub = onUserAuthStateChanged(async (user) => {
      setCurrentUser(user)
      if (user) {
        try {
          const profileRes = await getUserData(user.uid)
          const profile = profileRes.success ? (profileRes.data as any) : {}
          setFormData((prev) => ({
            ...prev,
            name: user.displayName || profile.name || prev.name,
            email: user.email || prev.email,
            phone: profile.phone || prev.phone,
            address: profile.address || prev.address,
            city: profile.city || prev.city,
            district: profile.district || prev.district,
          }))

          // Load saved addresses
          try {
            const addrRes = await getUserSavedAddresses(user.uid)
            if (addrRes.success && addrRes.addresses && addrRes.addresses.length > 0) {
              setSavedAddresses(addrRes.addresses)
              // Auto-select default delivery address
              const defaultAddr = addrRes.addresses.find((a: UserAddress) => a.isDefaultDelivery) || addrRes.addresses[0]
              if (defaultAddr) {
                setSelectedAddressId(defaultAddr.id!)
                setFormData((prev) => ({
                  ...prev,
                  name: defaultAddr.fullName || prev.name,
                  phone: defaultAddr.phone || prev.phone,
                  address: defaultAddr.address || prev.address,
                  city: defaultAddr.city || prev.city,
                  district: defaultAddr.district || prev.district,
                  postalCode: defaultAddr.postalCode || prev.postalCode,
                }))

                if (defaultAddr.isCorporate) {
                  setCustomerType('corporate')
                  setCorporateData({
                    companyName: defaultAddr.companyName || '',
                    taxOffice: defaultAddr.taxOffice || '',
                    taxNumber: defaultAddr.taxNumber || '',
                    authorizedPersonName: defaultAddr.authorizedPerson?.firstName || '',
                    authorizedPersonSurname: defaultAddr.authorizedPerson?.lastName || '',
                  })
                } else if (defaultAddr.tcKimlikNo) {
                  setCustomerType('individual')
                  setTcKimlikNo(defaultAddr.tcKimlikNo)
                }

                if (defaultAddr.billingAddress && defaultAddr.billingAddress.address) {
                  setSameAsDeliveryAddress(false)
                  setBillingAddress(defaultAddr.billingAddress)
                }
              }
            }
          } catch (addrErr) {
            console.warn('Address preload warning:', addrErr)
          }
        } catch (e) {
          console.warn('Preload user data warning:', e)
        }
      }
      setAuthChecking(false)
    })
    return () => unsub()
  }, [])

  // 3. Load Shipping Fee
  useEffect(() => {
    const loadShippingFee = async () => {
      try {
        const db = getFirestoreDB()
        const shippingDoc = await getDoc(doc(db, 'siteContent', 'shipping'))
        if (shippingDoc.exists()) {
          const data = shippingDoc.data()
          setBaseShippingFee(Number(data.shippingFee || 0))
          setFreeShippingThreshold(Number(data.freeShippingThreshold || 0))
        }
      } catch (error) {
        console.error('Kargo ücreti okuma hatası:', error)
      }
    }
    loadShippingFee()
  }, [])

  // 4. Handle RETURN FLOW from PayTR (after auth is resolved)
  useEffect(() => {
    // Wait for auth to resolve before trying to read Firestore orders
    if (authChecking) return

    if (isReturnFlow && oidParam) {
      setOrderId(oidParam)
      setOrderVerifying(true)
      setLoading(false) // CRITICAL: prevent infinite loading spinner

      const db = getFirestoreDB()

      // First try getDoc (works even if onSnapshot has issues)
      const fetchOrder = async () => {
        try {
          const orderDocSnap = await getDoc(doc(db, 'orders', oidParam))
          if (orderDocSnap.exists()) {
            const data = orderDocSnap.data()
            setVerifiedOrderData(data)
            if (data?.paymentStatus === 'PAID') {
              setOrderComplete(true)
              setOrderVerifying(false)
              clearCart()
              setCartItems([])
              return // Already paid, no need for listener
            } else if (data?.paymentStatus === 'FAILED') {
              setPaymentError('Ödeme işlemi başarısız oldu. Lütfen tekrar deneyiniz.')
              setOrderVerifying(false)
              return
            }
          }
        } catch (err: any) {
          console.warn('Order getDoc error (will retry with listener):', err?.message)
        }

        // If still PENDING, set up real-time listener for callback updates
        try {
          const unsubOrder = onSnapshot(
            doc(db, 'orders', oidParam),
            (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.data()
                setVerifiedOrderData(data)
                if (data?.paymentStatus === 'PAID') {
                  setOrderComplete(true)
                  setOrderVerifying(false)
                  clearCart()
                  setCartItems([])
                } else if (data?.paymentStatus === 'FAILED') {
                  setPaymentError('Ödeme işlemi başarısız oldu. Lütfen tekrar deneyiniz.')
                  setOrderVerifying(false)
                }
              }
            },
            (error) => {
              console.error('onSnapshot error:', error)
              setVerifyError('Sipariş durumu kontrol edilirken bir bağlantı hatası oluştu. Lütfen sayfayı yenileyiniz veya siparişlerinizi profilinizden kontrol ediniz.')
              setOrderVerifying(false)
            }
          )

          // Timeout after 45 seconds if still verifying
          const timeout = setTimeout(() => {
            setVerifyTimedOut(true)
            setOrderVerifying(false)
            unsubOrder()
          }, 45000)

          return () => {
            unsubOrder()
            clearTimeout(timeout)
          }
        } catch (err: any) {
          console.error('Order listener setup error:', err)
          setVerifyError('Sipariş bilgilerinize şu anda erişilemiyor. Lütfen birkaç dakika sonra profilinizden kontrol ediniz.')
          setOrderVerifying(false)
        }
      }

      fetchOrder()
      return
    }

    if (isErrorReturn) {
      setPaymentError('Ödeme işlemi tamamlanamadı veya iptal edildi. Lütfen tekrar deneyiniz.')
      setLoading(false)
    }

    // Normal checkout flow (not return)
    if (!isReturnFlow && !isErrorReturn) {
      const cart = getCart()
      if (cart.length === 0) {
        router.push(getLocalizedPath('/sepet'))
        return
      }
      setCartItems(cart)
    }
    setLoading(false)
  }, [authChecking, isReturnFlow, isErrorReturn, oidParam, router, getLocalizedPath])

  // 5. PayTR iFrame Resizer Script
  useEffect(() => {
    if (showPaytrModal && paytrToken) {
      const script = document.createElement('script')
      script.src = 'https://www.paytr.com/js/iframeResizer.min.js'
      script.async = true
      script.onload = () => {
        if (typeof (window as any).iFrameResize === 'function') {
          ;(window as any).iFrameResize({}, '#paytriframe')
        }
      }
      document.body.appendChild(script)

      return () => {
        if (document.body.contains(script)) {
          document.body.removeChild(script)
        }
      }
    }
  }, [showPaytrModal, paytrToken])

  const subtotal = cartItems.reduce((total, item) => {
    const price = item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price
    return total + price * item.quantity
  }, 0)

  const isFreeShipping = freeShippingThreshold > 0 && subtotal >= freeShippingThreshold
  const shippingFee = isFreeShipping ? 0 : baseShippingFee
  const totalAmount = subtotal + shippingFee

  // 6. Retry order verification manually
  const handleRetryVerification = async () => {
    if (!oidParam) return
    setVerifyError(null)
    setVerifyTimedOut(false)
    setPaymentError(null)
    setOrderVerifying(true)

    try {
      const db = getFirestoreDB()
      const orderDocSnap = await getDoc(doc(db, 'orders', oidParam))
      if (orderDocSnap.exists()) {
        const data = orderDocSnap.data()
        setVerifiedOrderData(data)
        if (data?.paymentStatus === 'PAID') {
          setOrderComplete(true)
          setOrderVerifying(false)
          clearCart()
          setCartItems([])
          return
        } else if (data?.paymentStatus === 'FAILED') {
          setPaymentError('Ödeme işlemi başarısız oldu.')
          setOrderVerifying(false)
          return
        }
      }
      // Still pending
      setVerifyTimedOut(true)
      setOrderVerifying(false)
    } catch (err: any) {
      console.error('Retry verification error:', err)
      setVerifyError('Sipariş durumu kontrol edilemedi. Lütfen profilinizden siparişlerinizi kontrol ediniz.')
      setOrderVerifying(false)
    }
  }

  // 7. Submit Order / PayTR Initialization
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    setPaymentError(null)

    // Guest checkout allowed — soft prompt only
    if (!currentUser) {
      const proceed = window.confirm('Hesabınıza giriş yapmadan devam ediyorsunuz. Sipariş takibi için e-posta adresinizi kullanabilirsiniz.\n\nDevam etmek istiyor musunuz?')
      if (!proceed) return
    }

    if (!customerType) {
      alert('Lütfen müşteri türünü (Bireysel veya Kurumsal) seçiniz.')
      return
    }

    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim() ||
      !formData.address.trim() ||
      !formData.city.trim() ||
      !formData.district.trim()
    ) {
      alert('Lütfen Ad Soyad, E-posta, Telefon, Şehir, İlçe ve Açık Adres alanlarını eksiksiz doldurun.')
      return
    }

    if (customerType === 'corporate') {
      if (!corporateData.companyName.trim()) {
        alert('Lütfen kurumsal fatura için Firma / Şirket Unvanını giriniz.')
        return
      }
      if (!corporateData.taxNumber.trim()) {
        alert('Lütfen Vergi Kimlik Numarasını (VKN veya TCKN) giriniz.')
        return
      }
      const vknCheck = validateCorporateTaxNumber(corporateData.taxNumber.trim())
      if (!vknCheck.isValid) {
        alert(vknCheck.error || 'Lütfen geçerli bir Vergi Kimlik Numarası (10 haneli VKN veya şahıs işletmesi için 11 haneli TCKN) giriniz.')
        return
      }
      // Yetkili adı ve soyadı isteğe bağlıdır
    } else {
      // Bireysel
      if (tcKimlikNo.trim()) {
        const tcCheck = validateTCKimlik(tcKimlikNo.trim())
        if (!tcCheck.isValid) {
          alert(tcCheck.error || 'Lütfen geçerli bir T.C. Kimlik Numarası (11 haneli) giriniz.')
          return
        }
      }
    }

    if (!sameAsDeliveryAddress) {
      if (!billingAddress.address.trim() || !billingAddress.city.trim() || !billingAddress.district.trim()) {
        alert('Lütfen Fatura Adresi, Şehir ve İlçe alanlarını doldurunuz.')
        return
      }
    }

    if (!agreementAccepted || !kvkkAccepted) {
      alert(loc.alertAgreement)
      return
    }

    const resolvedBillingAddress = sameAsDeliveryAddress
      ? {
          address: formData.address.trim(),
          city: formData.city.trim(),
          district: formData.district.trim(),
        }
      : {
          address: billingAddress.address.trim(),
          city: billingAddress.city.trim(),
          district: billingAddress.district.trim(),
        }

    const hasAuthorizedPerson = Boolean(
      corporateData.authorizedPersonName.trim() || corporateData.authorizedPersonSurname.trim()
    )

    const resolvedBillingInfo = customerType === 'corporate'
      ? {
          type: 'corporate',
          companyName: corporateData.companyName.trim(),
          taxOffice: corporateData.taxOffice.trim() || '',
          taxNumber: corporateData.taxNumber.trim(),
          authorizedPerson: hasAuthorizedPerson
            ? {
                firstName: corporateData.authorizedPersonName.trim(),
                lastName: corporateData.authorizedPersonSurname.trim(),
              }
            : null,
          address: resolvedBillingAddress.address,
          city: resolvedBillingAddress.city,
          district: resolvedBillingAddress.district,
          phone: formData.phone.trim(),
          email: formData.email.trim(),
        }
      : {
          type: 'individual',
          fullName: formData.name.trim(),
          tcKimlikNo: tcKimlikNo.trim() || '',
          address: resolvedBillingAddress.address,
          city: resolvedBillingAddress.city,
          district: resolvedBillingAddress.district,
          phone: formData.phone.trim(),
          email: formData.email.trim(),
        }

    // Auto-save address to profile if user is logged in and opted in
    if (currentUser && saveToProfile && selectedAddressId === 'new') {
      try {
        const addressToSave: Omit<Partial<UserAddress>, 'createdAt' | 'updatedAt' | 'id'> = {
          title: addressTitle || (customerType === 'corporate' ? 'İş' : 'Ev'),
          fullName: formData.name.trim(),
          phone: formData.phone.trim(),
          address: formData.address.trim(),
          city: formData.city.trim(),
          district: formData.district.trim(),
          postalCode: formData.postalCode?.trim() || '',
          country: 'Türkiye',
          isDefaultDelivery: makeDefaultAddress,
          isDefaultBilling: makeDefaultBilling,
          isCorporate: customerType === 'corporate',
          tcKimlikNo: customerType === 'individual' ? tcKimlikNo.trim() : '',
          companyName: customerType === 'corporate' ? corporateData.companyName.trim() : '',
          taxOffice: customerType === 'corporate' ? corporateData.taxOffice.trim() : '',
          taxNumber: customerType === 'corporate' ? corporateData.taxNumber.trim() : '',
          authorizedPerson: (customerType === 'corporate' && hasAuthorizedPerson) ? {
            firstName: corporateData.authorizedPersonName.trim(),
            lastName: corporateData.authorizedPersonSurname.trim(),
          } : null,
          billingAddress: resolvedBillingAddress,
        }
        await saveUserAddress(currentUser.uid, cleanFirestoreData(addressToSave))
      } catch (saveErr) {
        console.warn('Address auto-save (non-critical):', saveErr)
      }
    }

    setSubmitting(true)

    // CASE 1: KREDİ KARTI / PAYTR IFRAME İLE ÖDEME
    if (paymentMethod === 'card') {
      try {
        const initRes = await fetch('/api/paytr/initialize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser?.uid || 'guest',
            userEmail: currentUser?.email || formData.email.trim(),
            currency,
            customerType,
            billingInfo: resolvedBillingInfo,
            customer: {
              name: formData.name.trim(),
              email: formData.email.trim(),
              phone: formData.phone.trim(),
            },
            shippingAddress: {
              fullName: formData.name.trim(),
              address: formData.address.trim(),
              city: formData.city.trim(),
              district: formData.district.trim(),
              zipCode: formData.postalCode?.trim() || '',
              country: 'Türkiye',
            },
            items: cartItems.map((item) => ({
              productId: item.productId,
              name: item.name,
              price: item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price,
              quantity: item.quantity,
              image: item.image || '',
              selectedColor: item.selectedColor || null,
            })),
            notes: formData.note?.trim() || '',
          }),
        })

        const initData = await initRes.json()

        if (!initData.success || !initData.token) {
          throw new Error(initData.error || 'PayTR ödeme oturumu başlatılamadı.')
        }

        setPaytrToken(initData.token)
        setPaytrOrderNumber(initData.orderNumber)
        setShowPaytrModal(true)
      } catch (err: any) {
        console.error('PayTR init error:', err)
        setPaymentError(err?.message || loc.alertError)
        alert(err?.message || loc.alertError)
      } finally {
        setSubmitting(false)
      }
      return
    }

    // CASE 2: HAVALE / EFT İLE ÖDEME
    try {
      const db = getFirestoreDB()
      const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '')
      const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase()
      const orderNumber = `GS-HV${datePrefix}-${randomSuffix}`

      const orderData = {
        id: orderNumber,
        orderNumber,
        merchant_oid: orderNumber,
        userId: currentUser?.uid || 'guest',
        userEmail: currentUser?.email || formData.email,
        customer: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
        },
        shippingAddress: {
          fullName: formData.name,
          address: formData.address,
          city: formData.city,
          district: formData.district,
          zipCode: formData.postalCode || '',
          country: 'Türkiye',
        },
        items: cartItems.map((item) => ({
          productId: item.productId,
          name: item.name,
          quantity: item.quantity,
          price: item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price,
          image: item.image || '',
          selectedColor: item.selectedColor || null,
        })),
        subtotal,
        shippingCost: shippingFee,
        total: totalAmount,
        totalAmountTRY: totalAmount,
        currency,
        displayTotal: formatPriceWithCurrency(totalAmount),
        exchangeRate: currencyConfig.rates[currency]?.sellingTRY || 1,
        rateDate: currencyConfig.rateDate || 'Güncel',
        notes: formData.note || '',
        customerType,
        billingInfo: resolvedBillingInfo,
        paymentMethod: 'havale_eft',
        agreementsAccepted: {
          distanceSalesAgreement: true,
          preliminaryInfoForm: true,
          kvkkAndPrivacy: true,
          acceptedAt: new Date().toISOString(),
          ip: 'client_secured',
        },
        locale: locale,
        status: 'pending',
        paymentStatus: 'awaiting_bank_transfer',
        createdAt: new Date().toISOString(),
      }

      await setDoc(doc(db, 'orders', orderNumber), cleanFirestoreData(orderData))
      setOrderId(orderNumber)
      setOrderComplete(true)
      clearCart()
      setCartItems([])
    } catch (error) {
      console.error('Havale Order error:', error)
      alert(loc.alertError)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || authChecking) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-600"></div>
      </div>
    )
  }


  // VERIFY ERROR STATE — Firestore erişim hatası
  if (verifyError) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="container-custom section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-lg space-y-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <FiAlertCircle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">Sipariş Durumu Kontrol Edilemiyor</h2>
              <p className="text-xs text-slate-500 leading-relaxed">{verifyError}</p>
            </div>

            {orderId && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 font-medium">Sipariş Referans Numaranız:</p>
                <p className="font-mono font-black text-lg text-sky-600 select-all mt-1">{orderId}</p>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                onClick={handleRetryVerification}
                className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-full font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-sky-600/20"
              >
                <FiRefreshCw className="w-4 h-4" />
                <span>Tekrar Kontrol Et</span>
              </button>
              <Link
                href={getLocalizedPath('/profil')}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <span>Siparişlerimi Profilimden Görüntüle</span>
              </Link>
              <Link
                href={getLocalizedPath('/')}
                className="w-full py-3 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <span>{loc.backToHome}</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // VERIFY TIMED OUT STATE — Callback henüz gelmedi
  if (verifyTimedOut && !orderComplete) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="container-custom section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-lg space-y-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center mx-auto border border-sky-200">
              <FiInfo className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-sky-700 bg-sky-100 px-3.5 py-1 rounded-full">
                İşleminiz Devam Ediyor
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-3 mb-2">
                Ödeme Onayı Bekleniyor
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ödemeniz PayTR tarafından işleniyor. Banka onay süreci birkaç dakika sürebilir. 
                Kartınızdan tutar çekildiyse endişelenmeyin, sipariş kısa süre içinde onaylanacaktır.
              </p>
            </div>

            {orderId && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500 font-medium">Sipariş Referans Numaranız:</p>
                <p className="font-mono font-black text-lg text-sky-600 select-all mt-1">{orderId}</p>
                <p className="text-[10px] text-slate-400 mt-1">Bu numarayı kaydediniz. Müşteri hizmetlerimizle iletişime geçerken kullanabilirsiniz.</p>
              </div>
            )}

            {verifiedOrderData && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-1.5">
                <p className="text-xs font-bold text-slate-700 mb-2">Sipariş Bilgileri:</p>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Ad Soyad:</span>
                  <span className="font-bold text-slate-800">{verifiedOrderData.customer?.name}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">E-Posta:</span>
                  <span className="font-bold text-slate-800">{verifiedOrderData.customer?.email}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Toplam Tutar:</span>
                  <span className="font-bold text-slate-800">{verifiedOrderData.total?.toFixed(2)} ₺</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Durum:</span>
                  <span className="font-bold text-amber-600">⏳ Onay Bekleniyor</span>
                </div>
              </div>
            )}

            <div className="space-y-3 pt-2">
              <button
                onClick={handleRetryVerification}
                className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-full font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-sky-600/20"
              >
                <FiRefreshCw className="w-4 h-4" />
                <span>Durumu Tekrar Kontrol Et</span>
              </button>
              <Link
                href={getLocalizedPath('/profil')}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <span>Profilimden Siparişlerimi Takip Et</span>
              </Link>
              <Link
                href={getLocalizedPath('/')}
                className="w-full py-3 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <FiArrowLeft className="w-3.5 h-3.5" />
                <span>{loc.backToHome}</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ORDER VERIFYING STATE (Callback bekleniyor — spinner)
  if (orderVerifying) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="container-custom section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-lg space-y-5"
          >
            <div className="animate-spin rounded-full h-14 w-14 border-t-3 border-b-3 border-sky-600 mx-auto"></div>
            <h3 className="text-lg font-black text-slate-900">Ödemeniz Doğrulanıyor</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              PayTR 3D Secure onayınız sunucumuz tarafından kontrol ediliyor. Lütfen sayfayı kapatmayınız...
            </p>
            <p className="text-xs font-mono text-sky-600 font-bold bg-sky-50 px-4 py-2 rounded-xl inline-block">Referans: {orderId}</p>
            <p className="text-[10px] text-slate-400">Bu işlem genellikle birkaç saniye sürer. 45 saniye içinde yanıt alınamazsa size alternatif yönlendirme sunulacaktır.</p>
          </motion.div>
        </div>
      </div>
    )
  }

  // PAYMENT ERROR RETURN (from PayTR hata URL)
  if (isErrorReturn && !orderComplete) {
    return (
      <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="container-custom section-padding">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center shadow-lg space-y-6"
          >
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
              <FiAlertCircle className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-rose-700 bg-rose-100 px-3.5 py-1 rounded-full">
                Ödeme Başarısız
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-3 mb-2">
                Ödeme İşlemi Tamamlanamadı
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Ödeme işleminiz iptal edildi veya bir hata nedeniyle tamamlanamadı. 
                Kartınızdan herhangi bir tutar çekilmemiştir. Lütfen tekrar deneyiniz.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left">
              <p className="text-xs font-bold text-amber-800 mb-1.5">Olası Sebepler:</p>
              <ul className="text-[11px] text-amber-700 space-y-1 list-disc list-inside">
                <li>3D Secure SMS onay kodunu yanlış girmiş olabilirsiniz</li>
                <li>Kartınızın bakiyesi yetersiz olabilir</li>
                <li>Bankanız işlemi reddetmiş olabilir</li>
                <li>İnternet bağlantınız kesilmiş olabilir</li>
                <li>İşlemi kendiniz iptal etmiş olabilirsiniz</li>
              </ul>
            </div>

            <div className="space-y-3 pt-2">
              <Link
                href={getLocalizedPath('/satin-al')}
                className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-full font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-sky-600/20"
              >
                <FiCreditCard className="w-4 h-4" />
                <span>Tekrar Ödeme Yap</span>
              </Link>
              <Link
                href={getLocalizedPath('/sepet')}
                className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <FiArrowLeft className="w-4 h-4" />
                <span>{loc.backToCart}</span>
              </Link>
              <Link
                href={getLocalizedPath('/')}
                className="w-full py-3 text-slate-500 hover:text-slate-800 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
              >
                <span>{loc.backToHome}</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ORDER SUCCESS SCREEN — with full order summary
  if (orderComplete) {
    return (
      <div className="pt-32 pb-24 min-h-screen bg-slate-50">
        <div className="container-custom max-w-3xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* Success Header Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-10 text-center shadow-xl space-y-5">
              <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-200 shadow-md shadow-emerald-500/10">
                <FiCheckCircle className="w-10 h-10" />
              </div>

              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-100 px-3.5 py-1 rounded-full">
                  Ödeme Başarılı
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-3 mb-2">
                  {loc.orderReceivedTitle}
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {loc.orderSuccessDesc}
                </p>
              </div>
            </div>

            {/* Order Details Card */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-5">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <FiFileText className="w-4 h-4 text-sky-600" />
                Sipariş Detayları
              </h3>

              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">{loc.orderNumberLabel}</span>
                  <span className="font-mono font-black text-sm text-sky-600 select-all">{orderId}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Teslim Edilecek Kişi:</span>
                  <span className="font-bold text-slate-800">{verifiedOrderData?.customer?.name || formData.name || currentUser?.displayName || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">E-Posta:</span>
                  <span className="font-bold text-slate-800">{verifiedOrderData?.customer?.email || formData.email || currentUser?.email || '-'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-medium">Telefon:</span>
                  <span className="font-bold text-slate-800">{verifiedOrderData?.customer?.phone || '-'}</span>
                </div>
                {(verifiedOrderData?.shippingAddress) && (
                  <div className="flex justify-between items-start text-xs">
                    <span className="text-slate-500 font-medium flex-shrink-0">Teslimat Adresi:</span>
                    <span className="font-bold text-slate-800 text-right ml-4">
                      {verifiedOrderData.shippingAddress.address}, {verifiedOrderData.shippingAddress.district}, {verifiedOrderData.shippingAddress.city}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center text-xs pt-1 border-t border-slate-200">
                  <span className="text-slate-500 font-medium">Ödeme Onayı:</span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <FiShield className="w-3.5 h-3.5" /> PayTR 3D Secure (Onaylandı)
                  </span>
                </div>
              </div>

              {/* Order Items */}
              {verifiedOrderData?.items && verifiedOrderData.items.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Sipariş Edilen Ürünler</h4>
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                    {verifiedOrderData.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50/50 transition-colors">
                        <div className="w-14 h-14 rounded-xl bg-slate-50 p-1.5 border border-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-2xl">🦷</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.quantity} adet
                            {item.selectedColor?.name ? ` • ${item.selectedColor.name}` : ''}
                          </p>
                        </div>
                        <span className="text-xs font-extrabold text-slate-900 whitespace-nowrap">
                          {(item.price * item.quantity).toFixed(2)} ₺
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order Totals */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{loc.subtotal}</span>
                  <span className="font-bold text-slate-900">{(verifiedOrderData?.subtotal || 0).toFixed(2)} ₺</span>
                </div>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{loc.shipping}</span>
                  <span className="font-bold text-emerald-600">
                    {(verifiedOrderData?.shippingCost || 0) === 0 ? loc.freeShipping : `${(verifiedOrderData?.shippingCost || 0).toFixed(2)} ₺`}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-slate-900">{loc.total}</span>
                  <span className="text-2xl font-black text-sky-600">{(verifiedOrderData?.total || 0).toFixed(2)} ₺</span>
                </div>
              </div>

              {/* Delivery Info */}
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-start gap-3 text-xs text-emerald-800">
                <FiTruck className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600" />
                <div>
                  <p className="font-bold mb-0.5">Kargo ile Teslim Edilecektir</p>
                  <p className="text-[11px] text-emerald-700 leading-relaxed">
                    Siparişiniz en kısa sürede hazırlanacak ve kargoya verilecektir. 
                    Kargo takip bilgileri e-posta adresinize gönderilecektir.
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link
                  href={getLocalizedPath('/urunler')}
                  className="py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-full font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-sky-600/20"
                >
                  <FiCreditCard className="w-4 h-4" />
                  <span>Alışverişe Devam Et</span>
                </Link>
                <Link
                  href={getLocalizedPath('/profil')}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                >
                  <FiFileText className="w-4 h-4" />
                  <span>Siparişlerimi Görüntüle</span>
                </Link>
                <Link
                  href={getLocalizedPath('/')}
                  className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-full font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
                >
                  <FiArrowLeft className="w-4 h-4" />
                  <span>{loc.backToHome}</span>
                </Link>
              </div>
            </div>

          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-32 pb-24 min-h-screen bg-slate-50/60">
      <div className="container-custom max-w-6xl mx-auto px-4 sm:px-6">

        {/* Back Link & Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={getLocalizedPath('/sepet')}
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 transition-colors bg-white px-4 py-2 rounded-xl border border-slate-200/80 shadow-xs"
          >
            <FiArrowLeft className="w-4 h-4" />
            <span>{loc.backToCart}</span>
          </Link>
          <div className="text-right">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
              🔒 256-Bit SSL & 3D Secure Korumalı
            </span>
          </div>
        </div>

        {/* Payment Error Alert */}
        {paymentError && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 text-xs text-rose-800 shadow-xs">
            <FiAlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
            <div className="flex-1 font-medium">{paymentError}</div>
            <button
              onClick={() => setPaymentError(null)}
              className="text-rose-500 hover:text-rose-700 p-1"
            >
              <FiX className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {/* Form Side */}
          <div className="lg:col-span-7 space-y-6">

            {/* Step 1: Delivery Details */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">{loc.deliveryHeading}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{loc.deliverySub}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-700 font-black text-xs flex items-center justify-center">
                  1
                </div>
              </div>

              {/* Guest Login Banner */}
              {!currentUser && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                  <FiLogIn className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-900">Üye girişi yaparak daha hızlı sipariş verin</p>
                    <p className="text-[11px] text-amber-700 mt-0.5">Kayıtlı adreslerinizi kullanabilir, siparişlerinizi takip edebilirsiniz.</p>
                  </div>
                  <Link
                    href={`${getLocalizedPath('/giris')}?redirect=${encodeURIComponent(getLocalizedPath('/satin-al'))}`}
                    className="flex-shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold transition-colors"
                  >
                    Giriş Yap
                  </Link>
                </div>
              )}

              {/* Saved Address Cards (only for logged-in users with saved addresses) */}
              {currentUser && savedAddresses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kayıtlı Adreslerim</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() => {
                          setSelectedAddressId(addr.id!)
                          setFormData((prev) => ({
                            ...prev,
                            name: addr.fullName || prev.name,
                            phone: addr.phone || prev.phone,
                            address: addr.address || prev.address,
                            city: addr.city || prev.city,
                            district: addr.district || prev.district,
                            postalCode: addr.postalCode || prev.postalCode,
                          }))
                          if (addr.isCorporate) {
                            setCustomerType('corporate')
                            setCorporateData({
                              companyName: addr.companyName || '',
                              taxOffice: addr.taxOffice || '',
                              taxNumber: addr.taxNumber || '',
                              authorizedPersonName: addr.authorizedPerson?.firstName || '',
                              authorizedPersonSurname: addr.authorizedPerson?.lastName || '',
                            })
                          } else {
                            setCustomerType('individual')
                            if (addr.tcKimlikNo) setTcKimlikNo(addr.tcKimlikNo)
                          }
                          if (addr.billingAddress && addr.billingAddress.address) {
                            setSameAsDeliveryAddress(false)
                            setBillingAddress(addr.billingAddress)
                          } else {
                            setSameAsDeliveryAddress(true)
                          }
                        }}
                        className={`text-left p-4 rounded-2xl border-2 transition-all ${
                          selectedAddressId === addr.id
                            ? 'border-sky-500 bg-sky-50/60 shadow-sm shadow-sky-600/10'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            {addr.isCorporate
                              ? <FiBriefcase className="w-3.5 h-3.5 text-slate-500" />
                              : <FiHome className="w-3.5 h-3.5 text-slate-500" />
                            }
                            <span className="text-xs font-black text-slate-900">{addr.title}</span>
                          </div>
                          {addr.isDefaultDelivery && (
                            <span className="text-[10px] font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">Varsayılan</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-600 font-semibold truncate">{addr.fullName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{addr.address}</p>
                        <p className="text-[11px] text-slate-500">{addr.district}, {addr.city}</p>
                      </button>
                    ))}
                    {/* New Address Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAddressId('new')
                        setFormData((prev) => ({ ...prev, name: '', phone: '', address: '', city: '', district: '', postalCode: '' }))
                      }}
                      className={`text-left p-4 rounded-2xl border-2 transition-all ${
                        selectedAddressId === 'new'
                          ? 'border-sky-500 bg-sky-50/60 shadow-sm shadow-sky-600/10'
                          : 'border-dashed border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FiPlus className="w-4 h-4 text-slate-500" />
                        <span className="text-xs font-bold text-slate-700">Yeni Adres Gir</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      {loc.fullName}
                    </label>
                    <div className="relative">
                      <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="text"
                        required
                        placeholder="Ahmet Yılmaz"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      {loc.email}
                    </label>
                    <div className="relative">
                      <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="email"
                        required
                        placeholder="ornek@email.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      {loc.phone}
                    </label>
                    <div className="relative">
                      <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="tel"
                        required
                        placeholder="05XX XXX XX XX"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      {loc.city}
                    </label>
                    <div className="relative">
                      <select
                        required
                        value={formData.city}
                        onChange={(e) => setFormData({ ...formData, city: e.target.value, district: '' })}
                        className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500 appearance-none cursor-pointer transition-colors"
                      >
                        <option value="">İl Seçiniz</option>
                        {CITIES_LIST.map((cityName) => (
                          <option key={cityName} value={cityName}>
                            {cityName}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                      {loc.district}
                    </label>
                    <div className="relative">
                      <select
                        required
                        disabled={!formData.city}
                        value={formData.district}
                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                        className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500 appearance-none cursor-pointer disabled:opacity-50 transition-colors"
                      >
                        <option value="">İlçe Seçiniz</option>
                        {((formData.city && TURKEY_LOCATIONS[formData.city]) || []).map((distName: string) => (
                          <option key={distName} value={distName}>
                            {distName}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">▼</div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    {loc.address}
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder={loc.addressPlaceholder}
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500 resize-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                    {loc.orderNote}
                  </label>
                  <input
                    type="text"
                    placeholder={loc.notePlaceholder}
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 rounded-2xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>

                {/* Zorunlu Müşteri ve Fatura Türü Seçimi */}
                <div className="pt-2 border-t border-slate-100 space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-1">
                      Müşteri & Fatura Türü <span className="text-rose-500">* (Zorunlu)</span>
                    </label>
                    <p className="text-[11px] text-slate-500 mb-2">Lütfen faturanızın düzenleneceği müşteri türünü seçiniz.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setCustomerType('individual')}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                          customerType === 'individual'
                            ? 'border-sky-600 bg-sky-50/70 shadow-xs ring-2 ring-sky-600/20'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          customerType === 'individual' ? 'border-sky-600 bg-sky-600' : 'border-slate-300 bg-white'
                        }`}>
                          {customerType === 'individual' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <FiUser className={`w-3.5 h-3.5 ${customerType === 'individual' ? 'text-sky-600' : 'text-slate-500'}`} />
                            <span className="text-xs font-bold text-slate-900">Bireysel Müşteri</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">Şahıs adına T.C. kimlik numaralı e-Arşiv fatura</p>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCustomerType('corporate')}
                        className={`p-3.5 rounded-2xl border-2 text-left transition-all flex items-start gap-3 ${
                          customerType === 'corporate'
                            ? 'border-sky-600 bg-sky-50/70 shadow-xs ring-2 ring-sky-600/20'
                            : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          customerType === 'corporate' ? 'border-sky-600 bg-sky-600' : 'border-slate-300 bg-white'
                        }`}>
                          {customerType === 'corporate' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <FiBriefcase className={`w-3.5 h-3.5 ${customerType === 'corporate' ? 'text-sky-600' : 'text-slate-500'}`} />
                            <span className="text-xs font-bold text-slate-900">Kurumsal Müşteri</span>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">Firma unvanı, VKN ve vergi dairesi ile e-Fatura</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Bireysel Ek Alanlar */}
                  {customerType === 'individual' && (
                    <div className="p-4 rounded-2xl bg-slate-50/60 border border-slate-200 space-y-3">
                      <div>
                        <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                          T.C. Kimlik Numarası <span className="text-slate-400 font-normal">(e-Arşiv Fatura İçin Opsiyonel / 11 Hane)</span>
                        </label>
                        <input
                          type="text"
                          maxLength={11}
                          placeholder="11 haneli T.C. Kimlik No (isteğe bağlı)"
                          value={tcKimlikNo}
                          onChange={(e) => setTcKimlikNo(e.target.value.replace(/\D/g, ''))}
                          className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Belirtilmediği takdirde fatura 11111111111 Nihai Tüketici olarak düzenlenir.</p>
                      </div>

                      {/* Fatura Adresi Teslimatla Aynı Mı? */}
                      <div className="pt-2 border-t border-slate-200/60">
                        <div
                          className="flex items-center gap-2.5 cursor-pointer select-none"
                          onClick={() => setSameAsDeliveryAddress(!sameAsDeliveryAddress)}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            sameAsDeliveryAddress ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {sameAsDeliveryAddress && <FiCheck className="w-2.5 h-2.5" />}
                          </div>
                          <span className="text-xs font-semibold text-slate-800">Fatura adresim teslimat adresim ile aynı</span>
                        </div>

                        {!sameAsDeliveryAddress && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Fatura Şehri *</label>
                              <select
                                required
                                value={billingAddress.city}
                                onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value, district: '' })}
                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                              >
                                <option value="">İl Seçiniz</option>
                                {CITIES_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Fatura İlçesi *</label>
                              <select
                                required
                                disabled={!billingAddress.city}
                                value={billingAddress.district}
                                onChange={(e) => setBillingAddress({ ...billingAddress, district: e.target.value })}
                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                              >
                                <option value="">İlçe Seçiniz</option>
                                {((billingAddress.city && TURKEY_LOCATIONS[billingAddress.city]) || []).map((d: string) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Fatura Açık Adresi *</label>
                              <textarea
                                rows={2}
                                required
                                placeholder="Faturanın kesileceği açık adres..."
                                value={billingAddress.address}
                                onChange={(e) => setBillingAddress({ ...billingAddress, address: e.target.value })}
                                className="w-full p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500 resize-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Kurumsal Ek Alanlar */}
                  {customerType === 'corporate' && (
                    <div className="p-4 rounded-2xl bg-sky-50/50 border border-sky-200 space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Firma / Şirket Unvanı *</label>
                          <input
                            type="text"
                            required
                            placeholder="ABC Teknoloji Ltd. Şti."
                            value={corporateData.companyName}
                            onChange={(e) => setCorporateData({ ...corporateData, companyName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">Vergi Dairesi (İsteğe Bağlı)</label>
                          <input
                            type="text"
                            placeholder="Kadıköy Vergi Dairesi"
                            value={corporateData.taxOffice}
                            onChange={(e) => setCorporateData({ ...corporateData, taxOffice: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            Vergi Numarası (VKN / TCKN) <span className="text-rose-500">* (Zorunlu)</span>
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={11}
                            placeholder="10 Haneli VKN veya 11 Haneli TCKN"
                            value={corporateData.taxNumber}
                            onChange={(e) => setCorporateData({ ...corporateData, taxNumber: e.target.value.replace(/\D/g, '') })}
                            className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">Tüzel işletmeler için 10 haneli VKN, şahıs işletmeleri için 11 haneli TCKN giriniz.</p>
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            Yetkili Kişi Adı <span className="text-slate-400 font-normal">(İsteğe Bağlı)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ahmet"
                            value={corporateData.authorizedPersonName}
                            onChange={(e) => setCorporateData({ ...corporateData, authorizedPersonName: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                            Yetkili Kişi Soyadı <span className="text-slate-400 font-normal">(İsteğe Bağlı)</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Yılmaz"
                            value={corporateData.authorizedPersonSurname}
                            onChange={(e) => setCorporateData({ ...corporateData, authorizedPersonSurname: e.target.value })}
                            className="w-full px-4 py-2.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500 transition-colors"
                          />
                        </div>
                      </div>

                      {/* Kurumsal Fatura Adresi Teslimatla Aynı Mı? */}
                      <div className="pt-2 border-t border-sky-200/60">
                        <div
                          className="flex items-center gap-2.5 cursor-pointer select-none"
                          onClick={() => setSameAsDeliveryAddress(!sameAsDeliveryAddress)}
                        >
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            sameAsDeliveryAddress ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {sameAsDeliveryAddress && <FiCheck className="w-2.5 h-2.5" />}
                          </div>
                          <span className="text-xs font-semibold text-slate-800">Fatura adresi teslimat adresi ile aynı</span>
                        </div>

                        {!sameAsDeliveryAddress && (
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Fatura Şehri *</label>
                              <select
                                required
                                value={billingAddress.city}
                                onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value, district: '' })}
                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                              >
                                <option value="">İl Seçiniz</option>
                                {CITIES_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Fatura İlçesi *</label>
                              <select
                                required
                                disabled={!billingAddress.city}
                                value={billingAddress.district}
                                onChange={(e) => setBillingAddress({ ...billingAddress, district: e.target.value })}
                                className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500"
                              >
                                <option value="">İlçe Seçiniz</option>
                                {((billingAddress.city && TURKEY_LOCATIONS[billingAddress.city]) || []).map((d: string) => (
                                  <option key={d} value={d}>{d}</option>
                                ))}
                              </select>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block mb-1">Fatura Açık Adresi *</label>
                              <textarea
                                rows={2}
                                required
                                placeholder="Kurumsal faturanın kesileceği yasal şirket adresi..."
                                value={billingAddress.address}
                                onChange={(e) => setBillingAddress({ ...billingAddress, address: e.target.value })}
                                className="w-full p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-sky-500 resize-none"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save to Profile */}
                {currentUser && selectedAddressId === 'new' && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-3">
                    <div className="flex items-start gap-3 cursor-pointer select-none" onClick={() => setSaveToProfile(!saveToProfile)}>
                      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${saveToProfile ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>
                        {saveToProfile && <FiCheck className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <div>
                        <span className="text-xs font-bold text-emerald-900">Bilgilerimi kaydet</span>
                        <span className="text-[11px] text-emerald-700 block">Bir sonraki alışverişinizde otomatik olarak doldurulur</span>
                      </div>
                    </div>
                    {saveToProfile && (
                      <div className="pl-7 space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-600 font-semibold">Adres Etiketi:</span>
                          {['Ev', 'İş', 'Diğer'].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setAddressTitle(t)}
                              className={`px-3 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                addressTitle === t ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setMakeDefaultAddress(!makeDefaultAddress)}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${makeDefaultAddress ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>
                            {makeDefaultAddress && <FiCheck className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="text-[11px] text-emerald-800 font-medium">Varsayılan teslimat adresim olarak kaydet</span>
                        </div>
                        <div className="flex items-center gap-2 cursor-pointer select-none" onClick={() => setMakeDefaultBilling(!makeDefaultBilling)}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${makeDefaultBilling ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white'}`}>
                            {makeDefaultBilling && <FiCheck className="w-2.5 h-2.5 text-white" />}
                          </div>
                          <span className="text-[11px] text-emerald-800 font-medium">Varsayılan fatura bilgilerim olarak kaydet</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>


            {/* Step 2: Payment Method */}
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900">{loc.paymentHeading}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{loc.paymentSub}</p>
                </div>
                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">
                  2
                </div>
              </div>

              {/* Payment Method Selector Tabs */}
              {legalConfig.bankTransfer?.enabled ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                      paymentMethod === 'card'
                        ? 'border-sky-600 bg-sky-50/50 text-sky-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      paymentMethod === 'card' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <FiCreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider">Kredi / Banka Kartı</div>
                      <div className="text-[11px] text-slate-500">PayTR 3D Secure ile Güvenli</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('havale')}
                    className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center gap-3 ${
                      paymentMethod === 'havale'
                        ? 'border-sky-600 bg-sky-50/50 text-sky-900 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-slate-50/50'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      paymentMethod === 'havale' ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <FiFileText className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider">Havale / EFT</div>
                      <div className="text-[11px] text-slate-500">Banka hesap numaralarımıza transfer</div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-50 via-sky-50/60 to-blue-50/40 border border-sky-200/80 text-sky-950 flex items-center justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-600/20 flex-shrink-0">
                      <FiCreditCard className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                        <span>Kredi / Banka Kartı ile Güvenli Ödeme</span>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">3D Secure Aktif</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">PayTR 256-Bit SSL şifreleme ve PCI-DSS Seviye 1 güvencesiyle</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Card Notice */}
              {paymentMethod === 'card' ? (
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <FiShield className="w-4 h-4 text-emerald-600" />
                    <span>PayTR Resmi Ödeme Geçidi</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {loc.paytrGuarantee}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md">Visa</span>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md">Mastercard</span>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md">Troy</span>
                    <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md">Bonus / Maximum / World / Axess</span>
                  </div>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 text-xs text-slate-700 space-y-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <FiFileText className="w-4 h-4 text-sky-600" />
                      {legalConfig.bankTransfer?.bankName || 'Banka'} Hesap Bilgilerimiz:
                    </p>
                    <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">Havale / EFT</span>
                  </div>

                  <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2.5 shadow-xs">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Banka:</span>
                      <span className="font-bold text-slate-900">{legalConfig.bankTransfer?.bankName || 'Garanti BBVA'}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Hesap Sahibi:</span>
                      <span className="font-bold text-slate-900">{legalConfig.bankTransfer?.accountHolder || legalConfig.company.title}</span>
                    </div>
                    {legalConfig.bankTransfer?.branchCode && (
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 font-medium">Şube / Kod:</span>
                        <span className="font-medium text-slate-800">{legalConfig.bankTransfer.branchCode}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">IBAN Numarası:</span>
                        <span className="font-mono font-black text-sm text-slate-900 tracking-wide select-all">
                          {legalConfig.bankTransfer?.iban || 'TR00 0000 0000 0000 0000 0000 00'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (legalConfig.bankTransfer?.iban) {
                            navigator.clipboard.writeText(legalConfig.bankTransfer.iban.replace(/\s+/g, ''))
                            setCopiedIban(true)
                            setTimeout(() => setCopiedIban(false), 2500)
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-sky-600 text-white rounded-lg text-xs font-bold transition-all self-start sm:self-auto"
                      >
                        {copiedIban ? <FiCheck className="w-3.5 h-3.5 text-emerald-400" /> : <FiCopy className="w-3.5 h-3.5" />}
                        <span>{copiedIban ? 'Kopyalandı!' : 'IBAN Kopyala'}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200/80 font-medium">
                    ⚠️ {legalConfig.bankTransfer?.description || 'Sipariş onayınızdan sonra açıklama kısmına Ad-Soyad ve Sipariş Numaranızı yazarak 2 iş günü içinde transferi tamamlayınız.'}
                  </p>
                </div>
              )}

              {/* Step 3: Mandatory Legal Agreements Checkboxes */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="space-y-1">
                  <label className="flex items-start gap-3 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      checked={agreementAccepted}
                      disabled={!agreementRead}
                      onChange={(e) => {
                        if (!agreementRead) {
                          setActiveModal('onbilgi')
                          return
                        }
                        setAgreementAccepted(e.target.checked)
                      }}
                      className={`mt-0.5 w-4 h-4 rounded border-slate-300 focus:ring-sky-500 ${
                        !agreementRead
                          ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                          : 'text-sky-600 cursor-pointer'
                      }`}
                    />
                    <span className="text-xs text-slate-600 leading-normal">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setActiveModal('onbilgi') }}
                        className="text-sky-600 font-bold hover:underline"
                      >
                        Ön Bilgilendirme Koşulları
                      </button>
                      &apos;nı ve{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setActiveModal('sozlesme') }}
                        className="text-sky-600 font-bold hover:underline"
                      >
                        Mesafeli Satış Sözleşmesi
                      </button>
                      &apos;ni okudum, kabul ediyorum. <span className="text-rose-500">*</span>
                    </span>
                  </label>
                  {!agreementRead && (
                    <p className="text-[10px] text-amber-600 font-semibold pl-7">
                      ℹ️ Kutucuğu işaretleyebilmek için lütfen önce Ön Bilgilendirme Formu&apos;nu açıp sonuna kadar okuyunuz.
                    </p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="flex items-start gap-3 cursor-pointer group select-none">
                    <input
                      type="checkbox"
                      checked={kvkkAccepted}
                      disabled={!kvkkRead}
                      onChange={(e) => {
                        if (!kvkkRead) {
                          setActiveModal('kvkk')
                          return
                        }
                        setKvkkAccepted(e.target.checked)
                      }}
                      className={`mt-0.5 w-4 h-4 rounded border-slate-300 focus:ring-sky-500 ${
                        !kvkkRead
                          ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400'
                          : 'text-sky-600 cursor-pointer'
                      }`}
                    />
                    <span className="text-xs text-slate-600 leading-normal">
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setActiveModal('kvkk') }}
                        className="text-sky-600 font-bold hover:underline"
                      >
                        KVKK Aydınlatma Metni
                      </button>
                      &apos;ni ve{' '}
                      <Link
                        href={getLocalizedPath('/gizlilik-ve-guvenlik')}
                        target="_blank"
                        className="text-sky-600 font-bold hover:underline"
                      >
                        Gizlilik & Güvenlik Politikası
                      </Link>
                      &apos;nı okudum, onaylıyorum. <span className="text-rose-500">*</span>
                    </span>
                  </label>
                  {!kvkkRead && (
                    <p className="text-[10px] text-amber-600 font-semibold pl-7">
                      ℹ️ Kutucuğu işaretleyebilmek için lütfen önce KVKK Aydınlatma Metni&apos;ni açıp sonuna kadar okuyunuz.
                    </p>
                  )}
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleSubmitOrder}
                  disabled={submitting || !agreementAccepted || !kvkkAccepted}
                  className={`w-full py-4.5 rounded-full font-black text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-lg ${
                    submitting || !agreementAccepted || !kvkkAccepted
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-sky-600 via-blue-600 to-sky-700 text-white shadow-sky-600/30 hover:scale-102 active:scale-98'
                  }`}
                >
                  <FiLock className="w-4 h-4" />
                  <span>
                    {submitting
                      ? loc.submitting
                      : paymentMethod === 'card'
                      ? loc.submitOrder
                      : 'Havale Bildirimli Siparişi Tamamla'}
                  </span>
                </button>
                {(!agreementAccepted || !kvkkAccepted) && (
                  <p className="text-[11px] text-amber-600 text-center mt-2 font-medium">
                    Siparişi tamamlamak için lütfen sözleşme ve KVKK onay kutularını işaretleyin.
                  </p>
                )}
              </div>
            </div>

            {/* Merchant Information Bar */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 text-[11px] text-slate-500 space-y-1">
              <p className="font-bold text-slate-800 text-xs mb-1">Satıcı & Firma Yasal Bilgileri (6502 Sayılı Kanun Gereği):</p>
              <p><strong>Unvan:</strong> {legalConfig.company.title}</p>
              <p><strong>Adres:</strong> {legalConfig.company.address}</p>
              <p><strong>MERSİS:</strong> {legalConfig.company.mersis} | <strong>Vergi No:</strong> {legalConfig.company.taxOffice} {legalConfig.company.taxNumber}</p>
              <p><strong>Müşteri Hizmetleri:</strong> {legalConfig.company.phone} | <strong>E-Posta:</strong> {legalConfig.company.email}</p>
              {legalConfig.company.kepAddress && <p><strong>KEP Adresi:</strong> {legalConfig.company.kepAddress}</p>}
            </div>

          </div>

          {/* Order Summary Side */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="text-lg font-black text-slate-900 pb-3 border-b border-slate-100 flex items-center justify-between">
                <span>{loc.orderSummary}</span>
                <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">{cartItems.length} {loc.itemsCount}</span>
              </h3>

              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {cartItems.map((item) => {
                  const price = item.discountPrice || item.price
                  return (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-slate-50 p-1 border border-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-contain" />
                          ) : (
                            <span>🦷</span>
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-800 line-clamp-1">{item.name}</p>
                          <p className="text-slate-400">{loc.qty} {item.quantity}</p>
                        </div>
                      </div>
                      <span className="font-extrabold text-slate-900 ml-2 whitespace-nowrap">
                        {formatPriceWithCurrency(price * item.quantity)}
                      </span>
                    </div>
                  )
                })}
              </div>

              <div className="pt-4 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>{loc.subtotal}</span>
                  <span className="font-bold text-slate-900">{formatPriceWithCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>{loc.shipping}</span>
                  <span className="font-bold text-emerald-600">
                    {shippingFee === 0 ? loc.freeShipping : formatPriceWithCurrency(shippingFee)}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline text-sm">
                  <span className="font-bold text-slate-900">{loc.total}</span>
                  <span className="text-2xl font-black text-sky-600">{formatPriceWithCurrency(totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* SSL Notice Box */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center gap-3 text-xs text-emerald-900 font-semibold shadow-xs">
              <FiCheckCircle className="w-6 h-6 flex-shrink-0 text-emerald-600" />
              <span>{loc.sslNotice}</span>
            </div>

            {/* Trust Badges */}
            {(legalConfig.paymentBadges?.showInCheckout ?? true) && (
              <div className="p-5 rounded-3xl bg-slate-900 text-white border border-slate-800 space-y-3.5 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiShield className="w-4 h-4 text-emerald-400" />
                    <p className="text-xs font-black uppercase tracking-wider text-slate-200">PayTR Güvenli Ödeme</p>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                    TCMB & BDDK Lisanslı
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                  {(legalConfig.paymentBadges?.items || DEFAULT_LEGAL_CONFIG.paymentBadges.items)
                    .filter((b) => b.active)
                    .map((b) => (
                      <div
                        key={b.id}
                        className="h-10 px-3 bg-slate-800/90 hover:bg-slate-800 rounded-xl border border-slate-700/80 flex items-center justify-center text-center shadow-xs transition-all hover:scale-105"
                      >
                        {b.logoUrl ? (
                          <img src={b.logoUrl} alt={b.name} className="h-6 max-w-[85px] object-contain inline-block" />
                        ) : (
                          <span className={`text-[11px] font-black tracking-wide ${b.color || 'text-slate-200'}`}>
                            {b.badgeText || b.name}
                          </span>
                        )}
                      </div>
                    ))}
                </div>
                <p className="text-[10px] text-slate-400 text-center pt-1 border-t border-slate-800">
                  Tüm işlemler 256-Bit SSL şifreleme ve banka 3D Secure SMS onayıyla korunur.
                </p>
              </div>
            )}

            {/* Fast Links to Legal Documents */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200/80 space-y-2 text-xs text-slate-500">
              <p className="font-bold text-slate-700">Yasal Bilgilendirme Linkleri:</p>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <Link href={getLocalizedPath('/mesafeli-satis-sozlesmesi')} target="_blank" className="text-sky-600 hover:underline">
                  • Mesafeli Satış Sözleşmesi
                </Link>
                <Link href={getLocalizedPath('/on-bilgilendirme-formu')} target="_blank" className="text-sky-600 hover:underline">
                  • Ön Bilgilendirme Formu
                </Link>
                <Link href={getLocalizedPath('/iptal')} target="_blank" className="text-sky-600 hover:underline">
                  • İptal ve İade Koşulları
                </Link>
                <Link href={getLocalizedPath('/gizlilik-ve-guvenlik')} target="_blank" className="text-sky-600 hover:underline">
                  • Gizlilik & Güvenlik
                </Link>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* PAYTR RESMİ IFRAME MODALI                                                 */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showPaytrModal && paytrToken && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center border border-sky-400/30">
                    <FiLock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-black tracking-wide text-white flex items-center gap-2">
                      <span>PayTR 3D Secure Güvenli Ödeme</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Sipariş No: {paytrOrderNumber} • Tutar: {formatPriceWithCurrency(totalAmount)}</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowPaytrModal(false)}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                  title="Kapat / İptal"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body: Resmi PayTR iFrame */}
              <div className="flex-1 p-2 sm:p-4 overflow-y-auto bg-slate-50 flex flex-col items-center justify-center min-h-[560px]">
                <iframe
                  ref={iframeRef}
                  src={`https://www.paytr.com/odeme/guvenli/${paytrToken}`}
                  id="paytriframe"
                  frameBorder="0"
                  scrolling="no"
                  style={{ width: '100%', minHeight: '560px', border: 'none' }}
                  title="PayTR Güvenli Ödeme Ekranı"
                />
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <FiShield className="w-3.5 h-3.5 text-emerald-600" />
                  256-Bit SSL Şifreleme ile Güvendesiniz
                </span>
                <button
                  type="button"
                  onClick={() => setShowPaytrModal(false)}
                  className="text-slate-500 hover:text-slate-800 font-bold underline"
                >
                  İptal Et
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* IN-PLACE MODAL VIEWER FOR LEGAL AGREEMENTS                               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FiFileText className="w-5 h-5 text-sky-600 flex-shrink-0" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900 line-clamp-1">
                    {activeModal === 'sozlesme' && legalConfig.distanceSalesAgreement.title}
                    {activeModal === 'onbilgi' && legalConfig.preliminaryInfoForm.title}
                    {activeModal === 'kvkk' && legalConfig.kvkkPolicy.title}
                  </h3>
                </div>
                <button
                  onClick={() => setActiveModal(null)}
                  className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>

              <div
                ref={modalScrollRef}
                onScroll={handleModalScroll}
                className="p-4 sm:p-6 overflow-y-auto text-xs text-slate-600 space-y-4 leading-relaxed"
              >
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-0.5">
                  <p className="font-bold text-slate-800">SATICI: {legalConfig.company.title}</p>
                  <p>Adres: {legalConfig.company.address}</p>
                  <p>MERSİS: {legalConfig.company.mersis} | Tel: {legalConfig.company.phone} | E-posta: {legalConfig.company.email}</p>
                </div>

                {activeModal === 'sozlesme' && (
                  <div className="whitespace-pre-line text-slate-700">
                    {legalConfig.distanceSalesAgreement.content}
                  </div>
                )}

                {activeModal === 'onbilgi' && (
                  <div className="whitespace-pre-line text-slate-700">
                    {legalConfig.preliminaryInfoForm.content}
                  </div>
                )}

                {activeModal === 'kvkk' && (
                  <div className="whitespace-pre-line text-slate-700">
                    {legalConfig.kvkkPolicy.content}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
                <span className="text-[11px] font-medium text-slate-500">
                  {!modalScrolledToBottom ? (
                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                      <span>⬇️</span>
                      <span>TAMAM butonunun aktif olması için metnin sonuna kadar kaydırınız.</span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                      <span>✅</span>
                      <span>Metin sonuna ulaşıldı. TAMAM butonuna basarak pencereyi kapatabilirsiniz.</span>
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={!modalScrolledToBottom}
                  onClick={() => {
                    if (activeModal === 'sozlesme' || activeModal === 'onbilgi') setAgreementRead(true)
                    if (activeModal === 'kvkk') setKvkkRead(true)
                    setActiveModal(null)
                  }}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex-shrink-0 ${
                    !modalScrolledToBottom
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 active:scale-95'
                  }`}
                >
                  TAMAM
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}

export default function SatinAlPage() {
  return (
    <Suspense
      fallback={
        <div className="pt-36 pb-24 min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-600"></div>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
