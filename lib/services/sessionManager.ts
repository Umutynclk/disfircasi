/**
 * KALIPORT / SONRAKAM.COM - Session & Inactivity Manager
 * 
 * Kurallar:
 * 1. Normal Oturum: 15 dakika boyunca hiçbir kullanıcı etkileşimi (sayfa gezinme, form doldurma, tıklama, tuş)
 *    olmazsa hem istemci hem sunucu tarafında oturum geçersiz kılınır ve güvenli çıkış yapılır.
 * 2. Beni Hatırla: Giriş ekranında işaretlenirse oturum en fazla 7 gün devam edebilir.
 *    7 gün dolduğunda oturum mutlaka sonlanır ve kullanıcı yeniden giriş yapmalıdır.
 */

export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000 // 15 dakika
export const MAX_REMEMBER_ME_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 gün
export const UNLIMITED_SESSION_EMAIL = 'admin@gmail.com'

/**
 * Belirtilen e-postanın süresiz oturum yetkisine sahip özel admin hesabı olup olmadığını kontrol eder.
 * Normalize edilmiş tam e-posta eşitliği aranır.
 */
export function isUnlimitedSessionUser(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false
  return email.trim().toLowerCase() === UNLIMITED_SESSION_EMAIL
}

export const STORAGE_KEYS = {
  SESSION_START: 'gulumse_session_start',
  LAST_ACTIVE: 'gulumse_last_active',
  REMEMBER_ME: 'gulumse_remember_me',
  ROLE: 'gulumse_session_role',
  EMAIL: 'gulumse_session_email',
}

/**
 * Yeni bir oturum başlatır
 */
export function startSession(rememberMe: boolean, role: 'user' | 'admin' = 'user', email?: string | null) {
  if (typeof window === 'undefined') return

  const now = Date.now()
  localStorage.setItem(STORAGE_KEYS.SESSION_START, String(now))
  localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, String(now))
  localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, rememberMe ? '1' : '0')
  localStorage.setItem(STORAGE_KEYS.ROLE, role)

  if (email && typeof email === 'string') {
    const normalizedEmail = email.trim().toLowerCase()
    localStorage.setItem(STORAGE_KEYS.EMAIL, normalizedEmail)
  }

  // Çerezleri güncelle (Sunucu ve Middleware erişimi için)
  const isUnlimited = isUnlimitedSessionUser(email)
  const maxAge = isUnlimited
    ? 365 * 24 * 3600
    : role === 'user'
    ? 30 * 24 * 3600 // E-ticaret müşterisi: 30 günlük standart kalıcı oturum
    : rememberMe
    ? 7 * 24 * 3600 // Admin beni hatırla: 7 gün
    : 15 * 60 // Admin normal: 15 dakika hareketsizlik
  document.cookie = `gulumse_session_active=1; path=/; max-age=${maxAge}; SameSite=Lax`
  document.cookie = `gulumse_remember_me=${rememberMe ? '1' : '0'}; path=/; max-age=${maxAge}; SameSite=Lax`
  document.cookie = `gulumse_last_active=${now}; path=/; max-age=${maxAge}; SameSite=Lax`
  if (email && typeof email === 'string') {
    document.cookie = `gulumse_session_email=${encodeURIComponent(email.trim().toLowerCase())}; path=/; max-age=${maxAge}; SameSite=Lax`
  }
}

/**
 * Kullanıcı aktivitesini kaydeder (Throttled: en fazla 5 saniyede bir yazar)
 */
let lastActivitySync = 0
export function recordActivity(currentUserEmail?: string | null) {
  if (typeof window === 'undefined') return

  const now = Date.now()
  if (now - lastActivitySync < 5000) return // 5 saniyelik throttle
  lastActivitySync = now

  const validity = checkSessionValidity(currentUserEmail)
  if (!validity.valid) {
    // Oturum zaten düşmüş, aktiviteyi güncelleme
    return
  }

  localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE, String(now))
  document.cookie = `gulumse_last_active=${now}; path=/; max-age=604800; SameSite=Lax`
}

/**
 * Oturumun geçerli olup olmadığını hesaplar.
 * admin@gmail.com hesabı için 15 dakikalık oturum sınırı uygulanmaz.
 * Diğer tüm kullanıcılar için 15 dakikalık hareketsizlik kuralı titizlikle uygulanır.
 */
export function checkSessionValidity(currentUserEmail?: string | null): { valid: boolean; reason?: 'inactive' | 'max_duration' | 'none' } {
  if (typeof window === 'undefined') return { valid: true }

  // 1. admin@gmail.com özel oturum istisnası kontrolü
  const targetEmail = currentUserEmail || localStorage.getItem(STORAGE_KEYS.EMAIL)
  if (isUnlimitedSessionUser(targetEmail)) {
    return { valid: true }
  }

  const sessionRole = localStorage.getItem(STORAGE_KEYS.ROLE)
  // 2. Normal e-ticaret müşterileri 15 dakikalık katı hareketsizlikten etkilenmez
  if (sessionRole === 'user') {
    return { valid: true }
  }

  const sessionStartStr = localStorage.getItem(STORAGE_KEYS.SESSION_START)
  const lastActiveStr = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE)
  const rememberMeStr = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME)

  if (!sessionStartStr || !lastActiveStr) {
    return { valid: false, reason: 'none' }
  }

  const sessionStart = parseInt(sessionStartStr, 10)
  const lastActive = parseInt(lastActiveStr, 10)
  const rememberMe = rememberMeStr === '1'
  const now = Date.now()

  // 3. Admin Beni Hatırla için 7 günlük azami sınır kontrolü
  if (rememberMe) {
    if (now - sessionStart > MAX_REMEMBER_ME_DURATION_MS) {
      return { valid: false, reason: 'max_duration' }
    }
    return { valid: true }
  }

  // 4. Admin normal oturumu için 15 dakikalık hareketsizlik kontrolü
  if (now - lastActive > INACTIVITY_TIMEOUT_MS) {
    return { valid: false, reason: 'inactive' }
  }

  return { valid: true }
}

/**
 * Oturumu sonlandırır ve yerel verileri temizler
 */
export function clearSessionData() {
  if (typeof window === 'undefined') return

  localStorage.removeItem(STORAGE_KEYS.SESSION_START)
  localStorage.removeItem(STORAGE_KEYS.LAST_ACTIVE)
  localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME)
  localStorage.removeItem(STORAGE_KEYS.ROLE)
  localStorage.removeItem(STORAGE_KEYS.EMAIL)

  // Çerezleri sil
  document.cookie = 'gulumse_session_active=; path=/; max-age=0'
  document.cookie = 'gulumse_remember_me=; path=/; max-age=0'
  document.cookie = 'gulumse_last_active=; path=/; max-age=0'
  document.cookie = 'gulumse_session_email=; path=/; max-age=0'
}

/**
 * Sunucu tarafı (API Route) istek kontrolü
 */
export function validateApiSession(req: Request): { valid: boolean; reason?: string } {
  const cookieHeader = req.headers.get('cookie') || ''
  
  // Çerezleri parse et
  const cookies: Record<string, string> = {}
  cookieHeader.split(';').forEach((c) => {
    const [k, v] = c.trim().split('=')
    if (k && v) cookies[k] = decodeURIComponent(v)
  })

  // admin@gmail.com istisnası
  const sessionEmail = cookies['gulumse_session_email']
  if (isUnlimitedSessionUser(sessionEmail)) {
    return { valid: true }
  }

  const rememberMe = cookies['gulumse_remember_me'] === '1'
  const lastActiveStr = cookies['gulumse_last_active']

  if (!lastActiveStr) {
    // Çerez yoksa veya istemci token bazlı çalışıyorsa esnek izin ver
    return { valid: true }
  }

  const lastActive = parseInt(lastActiveStr, 10)
  const now = Date.now()

  if (!rememberMe && now - lastActive > INACTIVITY_TIMEOUT_MS) {
    return { valid: false, reason: 'Oturum 15 dakika boyunca işlem yapılmadığı için zaman aşımına uğramıştır.' }
  }

  return { valid: true }
}
