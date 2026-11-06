import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LOCALES = ['tr', 'en', 'de', 'fr', 'it']

// Localized path route map
const ROUTE_MAP: Record<string, string> = {
  // Products
  'urunler': '/urunler',
  'products': '/urunler',
  'produkte': '/urunler',
  'produits': '/urunler',
  'prodotti': '/urunler',
  // Campaigns
  'kampanyalar': '/urunler',
  'campaigns': '/urunler',
  'angebote': '/urunler',
  'promotions': '/urunler',
  'offerte': '/urunler',
  // About
  'hakkimizda': '/hakkimizda',
  'about': '/hakkimizda',
  'uber-uns': '/hakkimizda',
  'a-propos': '/hakkimizda',
  'chi-siamo': '/hakkimizda',
  // FAQ
  'sss': '/sss',
  'faq': '/sss',
  // Contact
  'iletisim': '/iletisim',
  'contact': '/iletisim',
  'kontakt': '/iletisim',
  'contatti': '/iletisim',
  // Cart
  'sepet': '/sepet',
  'cart': '/sepet',
  'warenkorb': '/sepet',
  'panier': '/sepet',
  'carrello': '/sepet',
  // Checkout
  'satin-al': '/satin-al',
  'satın-al': '/satin-al',
  'checkout': '/satin-al',
  'kasse': '/satin-al',
  'commander': '/satin-al',
  'cassa': '/satin-al',
  // Profile
  'profil': '/profil',
  'profile': '/profil',
  // Auth
  'giris': '/giris',
  'login': '/giris',
  'signin': '/giris',
  'anmelden': '/giris',
  'se-connecter': '/giris',
  'accedi': '/giris',
  'kayit': '/kayit',
  'register': '/kayit',
  'signup': '/kayit',
  'registrieren': '/kayit',
  'creer-un-compte': '/kayit',
  'registrati': '/kayit',
  // Info
  'kargo': '/kargo',
  'shipping': '/kargo',
  'versand': '/kargo',
  'livraison': '/kargo',
  'spedizione': '/kargo',
  'iptal': '/iptal',
  'returns': '/iptal',
  'widerruf': '/iptal',
  'annulation': '/iptal',
  'recesso': '/iptal',
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Ignore static files, API routes, admin routes, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const segments = pathname.split('/').filter(Boolean)
  const firstSeg = segments[0]?.toLowerCase()

  if (LOCALES.includes(firstSeg)) {
    const locale = firstSeg
    const subRoute = segments[1]?.toLowerCase()
    const targetSub = segments.slice(2).join('/')

    let destination = '/'

    if (subRoute) {
      const mapped = ROUTE_MAP[subRoute] || `/${subRoute}`
      destination = targetSub ? `${mapped}/${targetSub}` : mapped
    }

    const response = NextResponse.rewrite(new URL(destination, request.url))
    response.cookies.set('gulumse_locale', locale, { path: '/' })
    response.headers.set('x-locale', locale)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
}
