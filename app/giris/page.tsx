'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { loginUser, getCurrentUser, sendUserPasswordReset } from '@/lib/firebase/userAuth'
import { FiLock, FiMail, FiX, FiCheckCircle, FiAlertCircle, FiArrowLeft } from 'react-icons/fi'
import Link from 'next/link'
import { useLocale } from '@/context/LocaleContext'
import { startSession } from '@/lib/services/sessionManager'

const LOGIN_TRANSLATIONS = {
  tr: {
    title: 'Giriş Yapın',
    subCheckout: 'Siparişinize devam etmek için lütfen hesabınıza giriş yapın.',
    subGeneral: 'Gülümse Dental Care hesabınıza erişin.',
    emailLabel: 'E-posta Adresi',
    emailPlaceholder: 'ornek@email.com',
    passwordLabel: 'Şifre',
    submitBtn: 'Giriş Yap ve Devam Et',
    loggingIn: 'Giriş Yapılıyor...',
    noAccount: 'Hesabınız yok mu?',
    registerLink: 'Hemen Kayıt Olun',
    errorGeneral: 'Giriş yapılamadı. E-posta ve şifrenizi kontrol edin.',
    forgotPassword: 'Şifremi Unuttum?',
    resetModalTitle: 'Şifrenizi mi Unuttunuz?',
    resetModalDesc: 'Kayıtlı e-posta adresinizi girin. Size güvenli bir şifre sıfırlama bağlantısı göndereceğiz.',
    sendResetBtn: 'Sıfırlama Bağlantısı Gönder',
    sendingReset: 'Bağlantı Gönderiliyor...',
    backToLogin: 'Giriş ekranına dön',
  },
  en: {
    title: 'Sign In',
    subCheckout: 'Please sign in to your account to complete your order.',
    subGeneral: 'Access your Gülümse Dental Care account.',
    emailLabel: 'Email Address',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'Password',
    submitBtn: 'Sign In & Continue',
    loggingIn: 'Signing in...',
    noAccount: "Don't have an account?",
    registerLink: 'Create an Account',
    errorGeneral: 'Login failed. Please verify your email and password.',
    forgotPassword: 'Forgot Password?',
    resetModalTitle: 'Forgot Your Password?',
    resetModalDesc: 'Enter your registered email address and we will send you a secure password reset link.',
    sendResetBtn: 'Send Reset Link',
    sendingReset: 'Sending...',
    backToLogin: 'Back to sign in',
  },
  de: {
    title: 'Anmelden',
    subCheckout: 'Bitte melden Sie sich an, um Ihre Bestellung abzuschließen.',
    subGeneral: 'Greifen Sie auf Ihr Gülümse Dental Care Konto zu.',
    emailLabel: 'E-Mail-Adresse',
    emailPlaceholder: 'name@example.com',
    passwordLabel: 'Passwort',
    submitBtn: 'Anmelden & Weiter',
    loggingIn: 'Wird angemeldet...',
    noAccount: 'Noch kein Konto?',
    registerLink: 'Jetzt registrieren',
    errorGeneral: 'Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Daten.',
    forgotPassword: 'Passwort vergessen?',
    resetModalTitle: 'Passwort vergessen?',
    resetModalDesc: 'Geben Sie Ihre E-Mail-Adresse ein, um einen Link zum Zurücksetzen Ihres Passworts zu erhalten.',
    sendResetBtn: 'Link zum Zurücksetzen senden',
    sendingReset: 'Wird gesendet...',
    backToLogin: 'Zurück zur Anmeldung',
  },
  fr: {
    title: 'Se Connecter',
    subCheckout: 'Veuillez vous connecter pour finaliser votre commande.',
    subGeneral: 'Accédez à votre compte Gülümse Dental Care.',
    emailLabel: 'Adresse E-mail',
    emailPlaceholder: 'nom@example.com',
    passwordLabel: 'Mot de passe',
    submitBtn: 'Se Connecter & Continuer',
    loggingIn: 'Connexion en cours...',
    noAccount: 'Vous n’avez pas de compte ?',
    registerLink: 'Créer un compte',
    errorGeneral: 'Échec de connexion. Veuillez vérifier vos identifiants.',
    forgotPassword: 'Mot de passe oublié ?',
    resetModalTitle: 'Mot de passe oublié ?',
    resetModalDesc: 'Entrez votre adresse e-mail pour recevoir un lien de réinitialisation sécurisé.',
    sendResetBtn: 'Envoyer le lien de réinitialisation',
    sendingReset: 'Envoi en cours...',
    backToLogin: 'Retour à la connexion',
  },
  it: {
    title: 'Accedi',
    subCheckout: 'Accedi al tuo account per completare il tuo ordine.',
    subGeneral: 'Accedi al tuo account Gülümse Dental Care.',
    emailLabel: 'Indirizzo E-mail',
    emailPlaceholder: 'nome@example.com',
    passwordLabel: 'Password',
    submitBtn: 'Accedi & Continua',
    loggingIn: 'Accesso in corso...',
    noAccount: 'Non hai un account?',
    registerLink: 'Crea un account',
    errorGeneral: 'Accesso fallito. Controlla le tue credenziali.',
    forgotPassword: 'Password dimenticata?',
    resetModalTitle: 'Password dimenticata?',
    resetModalDesc: 'Inserisci il tuo indirizzo email per ricevere un link per reimpostare la password.',
    sendResetBtn: 'Invia link di reimpostazione',
    sendingReset: 'Invio in corso...',
    backToLogin: 'Torna al login',
  },
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect') || '/'
  const { locale, getLocalizedPath } = useLocale()
  const loc = LOGIN_TRANSLATIONS[locale] || LOGIN_TRANSLATIONS.tr

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  // Şifremi Unuttum State
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('')
  const [forgotErrorMsg, setForgotErrorMsg] = useState('')

  useEffect(() => {
    if (searchParams.get('error') === 'session_expired') {
      const reason = searchParams.get('reason')
      setError(
        reason === 'max_duration'
          ? 'Oturumunuz azami 7 günlük süresini doldurduğu için sonlandırıldı. Lütfen tekrar giriş yapın.'
          : 'Oturumunuz 15 dakika boyunca işlem yapılmadığı için güvenlik nedeniyle sonlandırıldı. Lütfen tekrar giriş yapın.'
      )
    }

    const checkAuth = async () => {
      const user = await getCurrentUser()
      if (user) {
        router.push(redirectPath)
      }
      setChecking(false)
    }
    checkAuth()
  }, [router, redirectPath, searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const result = await loginUser(email, password)
    
    if (result.success) {
      startSession(rememberMe, 'user', email)
      router.push(redirectPath)
      router.refresh()
    } else {
      setError(result.error || loc.errorGeneral)
      setLoading(false)
    }
  }

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    setForgotErrorMsg('')
    setForgotSuccessMsg('')

    const result = await sendUserPasswordReset(forgotEmail)

    if (result.success) {
      setForgotSuccessMsg(result.message)
    } else {
      setForgotErrorMsg(result.error || 'Şifre sıfırlama isteği gönderilemedi.')
    }
    setForgotLoading(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50/50 via-white to-emerald-50/40 py-28 px-4 relative">
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
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
                <FiAlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{error}</span>
              </div>
            )}

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
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {loc.passwordLabel}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email)
                    setForgotErrorMsg('')
                    setForgotSuccessMsg('')
                    setShowForgotModal(true)
                  }}
                  className="text-xs text-sky-600 hover:text-sky-700 font-bold hover:underline transition-colors"
                >
                  {loc.forgotPassword}
                </button>
              </div>
              <div className="relative">
                <FiLock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Beni Hatırla Seçeneği */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
                />
                <span className="font-semibold text-slate-700">Beni Hatırla (7 Gün)</span>
              </label>
              <span className="text-[10px] text-slate-400" title="İşaretsiz ise 15 dakika hareketsizlik sonrası otomatik çıkış yapılır">
                {rememberMe ? '7 gün aktif' : '15 dk hareketsizlik'}
              </span>
            </div>

            <div className="pt-2">
              <motion.button
                type="submit"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                disabled={loading}
                className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-full font-black text-xs uppercase tracking-wider transition-colors shadow-md shadow-sky-600/20 disabled:opacity-50"
              >
                {loading ? loc.loggingIn : loc.submitBtn}
              </motion.button>
            </div>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs text-slate-600">
              {loc.noAccount}{' '}
              <Link
                href={`${getLocalizedPath('/kayit')}${redirectPath !== '/' ? `?redirect=${encodeURIComponent(redirectPath)}` : ''}`}
                className="text-sky-600 hover:underline font-bold"
              >
                {loc.registerLink}
              </Link>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Şifremi Unuttum Modalı */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 sm:p-8 relative"
            >
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Kapat"
              >
                <FiX className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <FiLock className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-slate-900 mb-1">
                  {loc.resetModalTitle}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  {loc.resetModalDesc}
                </p>
              </div>

              {forgotSuccessMsg ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs leading-relaxed flex items-start gap-3">
                    <FiCheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                    <span>{forgotSuccessMsg}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-full transition-colors flex items-center justify-center gap-2"
                  >
                    <FiArrowLeft className="w-4 h-4" />
                    <span>{loc.backToLogin}</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                  {forgotErrorMsg && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2">
                      <FiAlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                      <span>{forgotErrorMsg}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      {loc.emailLabel}
                    </label>
                    <div className="relative">
                      <FiMail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:border-sky-500 focus:bg-white focus:outline-none transition-colors"
                        placeholder={loc.emailPlaceholder}
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full py-4 bg-sky-600 hover:bg-sky-700 text-white rounded-full font-black text-xs uppercase tracking-wider transition-colors shadow-md shadow-sky-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {forgotLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        loc.sendResetBtn
                      )}
                    </button>
                  </div>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-semibold transition-colors"
                    >
                      {loc.backToLogin}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
