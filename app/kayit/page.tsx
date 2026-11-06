'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { registerUser, getCurrentUser } from '@/lib/firebase/userAuth'
import { FiLock, FiMail, FiUser } from 'react-icons/fi'
import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'

const REGISTER_TRANSLATIONS = {
  tr: {
    title: 'Hesap Oluşturun',
    subCheckout: 'Siparişinizi tamamlamak için lütfen kayıt olun veya giriş yapın.',
    subGeneral: 'Ayrıcalıklı diş bakımı deneyimine hemen katılın.',
    firstNameLabel: 'Ad *',
    firstNamePlaceholder: 'Adınız',
    lastNameLabel: 'Soyad',
    lastNamePlaceholder: 'Soyadınız',
    emailLabel: 'E-posta Adresi *',
    emailPlaceholder: 'ornek@email.com',
    passwordLabel: 'Şifre * (En az 6 karakter)',
    confirmPasswordLabel: 'Şifre Tekrar *',
    submitBtn: 'Kayıt Ol ve Devam Et',
    registering: 'Hesap Oluşturuluyor...',
    alreadyHaveAccount: 'Zaten hesabınız var mı?',
    loginLink: 'Giriş Yap',
    errName: 'Lütfen adınızı girin.',
    errMismatch: 'Girdiğiniz şifreler birbiriyle eşleşmiyor.',
    errLength: 'Şifre en az 6 karakterden oluşmalıdır.',
    errGeneral: 'Kayıt işlemi başarısız oldu.',
  },
  en: {
    title: 'Create an Account',
    subCheckout: 'Please register or sign in to complete your checkout.',
    subGeneral: 'Join the premium oral care experience today.',
    firstNameLabel: 'First Name *',
    firstNamePlaceholder: 'First name',
    lastNameLabel: 'Last Name',
    lastNamePlaceholder: 'Last name',
    emailLabel: 'Email Address *',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'Password * (Min 6 characters)',
    confirmPasswordLabel: 'Confirm Password *',
    submitBtn: 'Register & Continue',
    registering: 'Creating account...',
    alreadyHaveAccount: 'Already have an account?',
    loginLink: 'Sign In',
    errName: 'Please enter your first name.',
    errMismatch: 'Passwords do not match.',
    errLength: 'Password must be at least 6 characters.',
    errGeneral: 'Registration failed. Please try again.',
  },
  de: {
    title: 'Konto Erstellen',
    subCheckout: 'Bitte registrieren Sie sich, um Ihre Bestellung abzuschließen.',
    subGeneral: 'Erleben Sie moderne Zahnpflege auf höchstem Niveau.',
    firstNameLabel: 'Vorname *',
    firstNamePlaceholder: 'Vorname',
    lastNameLabel: 'Nachname',
    lastNamePlaceholder: 'Nachname',
    emailLabel: 'E-Mail-Adresse *',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'Passwort * (Mind. 6 Zeichen)',
    confirmPasswordLabel: 'Passwort wiederholen *',
    submitBtn: 'Registrieren & Weiter',
    registering: 'Konto wird erstellt...',
    alreadyHaveAccount: 'Haben Sie bereits ein Konto?',
    loginLink: 'Anmelden',
    errName: 'Bitte geben Sie Ihren Vornamen ein.',
    errMismatch: 'Die Passwörter stimmen nicht überein.',
    errLength: 'Das Passwort muss mindestens 6 Zeichen lang sein.',
    errGeneral: 'Registrierung fehlgeschlagen.',
  },
  fr: {
    title: 'Créer un Compte',
    subCheckout: 'Veuillez vous inscrire pour finaliser votre commande.',
    subGeneral: 'Rejoignez l’expérience de soins dentaires haut de gamme.',
    firstNameLabel: 'Prénom *',
    firstNamePlaceholder: 'Prénom',
    lastNameLabel: 'Nom',
    lastNamePlaceholder: 'Nom',
    emailLabel: 'Adresse E-mail *',
    emailPlaceholder: 'nom@example.com',
    passwordLabel: 'Mot de passe * (Min 6 caractères)',
    confirmPasswordLabel: 'Confirmer le mot de passe *',
    submitBtn: 'S’inscrire & Continuer',
    registering: 'Création du compte...',
    alreadyHaveAccount: 'Vous avez déjà un compte ?',
    loginLink: 'Se connecter',
    errName: 'Veuillez entrer votre prénom.',
    errMismatch: 'Les mots de passe ne correspondent pas.',
    errLength: 'Le mot de passe doit comporter au moins 6 caractères.',
    errGeneral: 'Échec de l’inscription.',
  },
  it: {
    title: 'Crea un Account',
    subCheckout: 'Registrati per completare il tuo acquisto.',
    subGeneral: 'Unisciti all\'esperienza di cura dentale premium.',
    firstNameLabel: 'Nome *',
    firstNamePlaceholder: 'Nome',
    lastNameLabel: 'Cognome',
    lastNamePlaceholder: 'Cognome',
    emailLabel: 'Indirizzo E-mail *',
    emailPlaceholder: 'nome@example.com',
    passwordLabel: 'Password * (Min 6 caratteri)',
    confirmPasswordLabel: 'Conferma Password *',
    submitBtn: 'Registrati & Continua',
    registering: 'Creazione account...',
    alreadyHaveAccount: 'Hai già un account?',
    loginLink: 'Accedi',
    errName: 'Inserisci il tuo nome.',
    errMismatch: 'Le password non corrispondono.',
    errLength: 'La password deve contenere almeno 6 caratteri.',
    errGeneral: 'Registrazione fallita. Riprova.',
  },
}

function RegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect') || '/'
  const { locale, getLocalizedPath } = useLocale()
  const loc = REGISTER_TRANSLATIONS[locale] || REGISTER_TRANSLATIONS.tr

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAuth = async () => {
      const user = await getCurrentUser()
      if (user) {
        router.push(redirectPath)
      }
      setChecking(false)
    }
    checkAuth()
  }, [router, redirectPath])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!firstName.trim()) {
      setError(loc.errName)
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError(loc.errMismatch)
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setError(loc.errLength)
      setLoading(false)
      return
    }

    const result = await registerUser(email, password, firstName, lastName)
    
    if (result.success) {
      router.push(redirectPath)
      router.refresh()
    } else {
      setError(result.error || loc.errGeneral)
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50/50 via-white to-emerald-50/40 py-28 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-3xl shadow-xl border border-slate-200/80 p-8 sm:p-10">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-600 to-emerald-500 flex items-center justify-center text-white font-black text-xl mx-auto mb-4 shadow-sm">
              G
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-2">{loc.title}</h1>
            <p className="text-xs text-slate-500">
              {redirectPath.includes('satin-al') ? loc.subCheckout : loc.subGeneral}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-semibold">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {loc.firstNameLabel}
                </label>
                <div className="relative">
                  <FiUser className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
                    placeholder={loc.firstNamePlaceholder}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  {loc.lastNameLabel}
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
                  placeholder={loc.lastNamePlaceholder}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {loc.emailLabel}
              </label>
              <div className="relative">
                <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
                  placeholder={loc.emailPlaceholder}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {loc.passwordLabel}
              </label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                {loc.confirmPasswordLabel}
              </label>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div className="pt-2">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={loading}
                className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-full font-black text-xs uppercase tracking-wider transition-colors shadow-md shadow-sky-600/20 disabled:opacity-50"
              >
                {loading ? loc.registering : loc.submitBtn}
              </motion.button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-600">
              {loc.alreadyHaveAccount}{' '}
              <Link
                href={`${getLocalizedPath('/giris')}${redirectPath !== '/' ? `?redirect=${encodeURIComponent(redirectPath)}` : ''}`}
                className="text-sky-600 hover:underline font-bold"
              >
                {loc.loginLink}
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin"></div>
        </div>
      }
    >
      <RegisterContent />
    </Suspense>
  )
}
