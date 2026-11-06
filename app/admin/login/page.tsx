'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { loginAdmin, registerAdmin, getCurrentUser, isUserAdmin, logoutAdmin } from '@/lib/firebase/auth'
import { FiLock, FiMail, FiShield, FiUserPlus, FiLogIn, FiAlertCircle } from 'react-icons/fi'
import { startSession } from '@/lib/services/sessionManager'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 5 * 60 * 1000 // 5 dakika kilit

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    if (searchParams?.get('error') === 'unauthorized') {
      setError('Yetkisiz Erişim: Bu hesap admin paneline erişim yetkisine sahip değildir.')
    }
    if (searchParams?.get('error') === 'session_expired') {
      const reason = searchParams?.get('reason')
      setError(
        reason === 'max_duration'
          ? 'Yönetici oturumunuz azami 7 günlük süresini doldurmuştur. Lütfen tekrar giriş yapınız.'
          : 'Yönetici oturumunuz 15 dakika hareketsizlik nedeniyle güvenlik için sonlandırılmıştır. Lütfen tekrar giriş yapınız.'
      )
    }

    const checkAuth = async () => {
      const user = await getCurrentUser()
      if (user) {
        const isAdmin = await isUserAdmin(user)
        if (isAdmin) {
          router.push('/admin')
          return
        } else {
          await logoutAdmin()
          setError('Giriş yapılan hesap yetkili bir admin hesabı değildir.')
        }
      }
      setChecking(false)
    }
    checkAuth()
  }, [router, searchParams])

  const checkRateLimit = (): { blocked: boolean; remainingSec: number } => {
    try {
      const attemptsStr = localStorage.getItem('gulumse_admin_failed_attempts')
      const lockoutUntilStr = localStorage.getItem('gulumse_admin_lockout_until')
      const now = Date.now()

      if (lockoutUntilStr) {
        const lockoutUntil = parseInt(lockoutUntilStr, 10)
        if (now < lockoutUntil) {
          return { blocked: true, remainingSec: Math.ceil((lockoutUntil - now) / 1000) }
        } else {
          localStorage.removeItem('gulumse_admin_lockout_until')
          localStorage.removeItem('gulumse_admin_failed_attempts')
        }
      }

      return { blocked: false, remainingSec: 0 }
    } catch {
      return { blocked: false, remainingSec: 0 }
    }
  }

  const recordFailedAttempt = () => {
    try {
      const attemptsStr = localStorage.getItem('gulumse_admin_failed_attempts')
      const current = attemptsStr ? parseInt(attemptsStr, 10) : 0
      const nextCount = current + 1
      localStorage.setItem('gulumse_admin_failed_attempts', String(nextCount))

      if (nextCount >= MAX_FAILED_ATTEMPTS) {
        const lockoutTime = Date.now() + LOCKOUT_DURATION_MS
        localStorage.setItem('gulumse_admin_lockout_until', String(lockoutTime))
      }
    } catch {
      // localStorage erişim hatası
    }
  }

  const resetFailedAttempts = () => {
    try {
      localStorage.removeItem('gulumse_admin_failed_attempts')
      localStorage.removeItem('gulumse_admin_lockout_until')
    } catch {
      // ignore
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Rate limit kontrolü
    const rateLimit = checkRateLimit()
    if (rateLimit.blocked) {
      setError(`Çok fazla başarısız deneme yapıldı. Güvenlik nedeniyle ${rateLimit.remainingSec} saniye sonra tekrar deneyebilirsiniz.`)
      return
    }

    setLoading(true)

    const result = await loginAdmin(email, password)
    if (result.success) {
      resetFailedAttempts()
      startSession(rememberMe, 'admin', email)
      router.push('/admin')
    } else {
      recordFailedAttempt()
      const postRateLimit = checkRateLimit()
      if (postRateLimit.blocked) {
        setError(`Çok fazla başarısız deneme yapıldı. Güvenlik nedeniyle hesabınız 5 dakika kilitlendi.`)
      } else {
        setError(result.error || 'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.')
      }
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 py-12 px-4 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="bg-slate-900 rounded-3xl shadow-2xl border border-slate-800 p-8 sm:p-10 text-white">
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-sky-500/10">
              <FiShield className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight mb-1">
              Yönetim Paneli Girişi
            </h1>
            <p className="text-xs text-slate-400">
              Yalnızca yetkilendirilmiş sistem yöneticileri giriş yapabilir
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-xl flex items-start gap-2.5">
                <FiAlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Yetkili E-posta Adresi
              </label>
              <div className="relative">
                <FiMail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-sm text-white placeholder-slate-500"
                  placeholder="admin@gulumse.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2">
                Şifre
              </label>
              <div className="relative">
                <FiLock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-500 w-4 h-4" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-800/80 border border-slate-700 rounded-xl focus:border-sky-500 focus:ring-1 focus:ring-sky-500 focus:outline-none transition-colors text-sm text-white placeholder-slate-500"
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
                  className="w-4 h-4 rounded text-sky-500 focus:ring-sky-500 border-slate-700 bg-slate-800"
                />
                <span className="font-semibold text-slate-300">Beni Hatırla (7 Gün)</span>
              </label>
              <span className="text-[10px] text-slate-400" title="İşaretsiz ise 15 dakika hareketsizlik sonrası oturum sonlanır (admin@gmail.com hesabı süresizdir)">
                {rememberMe ? '7 gün geçerli' : '15 dk hareketsizlik'}
              </span>
            </div>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <FiLogIn className="w-4 h-4" />
                  <span>Güvenli Giriş Yap</span>
                </>
              )}
            </motion.button>

            <div className="pt-2 text-center text-[11px] text-slate-500">
              Güvenli 256-Bit SSL Şifreli Bağlantı • KALIPORT Güvenlik Mimarisi
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  )
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
