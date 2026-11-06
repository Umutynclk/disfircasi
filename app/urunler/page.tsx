'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { collection, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { subscribeToCategories, Category } from '@/lib/firebase/categories'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { FiShoppingBag, FiSearch, FiCheck } from 'react-icons/fi'
import { addToCart } from '@/lib/utils/cart'
import { useLocale } from '@/context/LocaleContext'

interface ColorOption {
  name: string
  code: string
  images?: string[]
  price?: number
  discountPrice?: number | null
}

interface Product {
  id: string
  name: any
  price: number
  discountPrice?: number | null
  discountPercentage?: number | null
  priceUSD?: number | null
  discountPriceUSD?: number | null
  priceEUR?: number | null
  discountPriceEUR?: number | null
  image?: string
  images?: string[]
  description: any
  category?: string
  categoryId?: string
  inStock?: boolean
  features?: string[]
  colors?: ColorOption[]
  rating?: number
  isPopular?: boolean
}

const PRODUCTS_TRANSLATIONS = {
  tr: {
    badge: 'Premium Koleksiyon',
    title: 'Tüm Diş Fırçaları & Ağız Bakımı',
    subtitle: 'Yeni nesil 360° sonic otomatik fırçalar, hijyenik kullan-at ürünler ve yedek başlıklar.',
    searchPlaceholder: 'Ürün veya özellik ara...',
    allCategory: 'Tüm Ürünler',
    noResultsTitle: 'Aradığınız kriterde ürün bulunamadı',
    noResultsDesc: 'Farklı bir arama terimi veya kategori seçmeyi deneyin.',
    showAllBtn: 'Tüm Ürünleri Göster',
    discountBadge: 'İndirim',
    popularBadge: 'Öne Çıkan',
    inStock: 'Stokta Var',
    outOfStock: 'Tükendi',
    addToCart: 'Sepete Ekle',
    addedToCart: 'Eklendi',
  },
  en: {
    badge: 'Premium Collection',
    title: 'All Toothbrushes & Oral Care',
    subtitle: 'Next-gen 360° sonic automatic brushes, hygienic travel essentials, and replacement heads.',
    searchPlaceholder: 'Search products or features...',
    allCategory: 'All Products',
    noResultsTitle: 'No products found',
    noResultsDesc: 'Try a different search term or category.',
    showAllBtn: 'Show All Products',
    discountBadge: 'OFF',
    popularBadge: 'Featured',
    inStock: 'In Stock',
    outOfStock: 'Sold Out',
    addToCart: 'Add to Cart',
    addedToCart: 'Added',
  },
  de: {
    badge: 'Premium Kollektion',
    title: 'Alle Zahnbürsten & Zahnpflege',
    subtitle: '360° Schallzahnbürsten der nächsten Generation, hygienische Reisezahnbürsten und Ersatzköpfe.',
    searchPlaceholder: 'Produkte oder Funktionen suchen...',
    allCategory: 'Alle Produkte',
    noResultsTitle: 'Keine Produkte gefunden',
    noResultsDesc: 'Versuchen Sie einen anderen Suchbegriff oder eine andere Kategorie.',
    showAllBtn: 'Alle Produkte anzeigen',
    discountBadge: 'Rabatt',
    popularBadge: 'Bestseller',
    inStock: 'Auf Lager',
    outOfStock: 'Ausverkauft',
    addToCart: 'In den Warenkorb',
    addedToCart: 'Hinzugefügt',
  },
  fr: {
    badge: 'Collection Premium',
    title: 'Toutes les Brosses à Dents & Soins',
    subtitle: 'Brosses soniques 360° nouvelle génération, brosses de voyage hygiéniques et têtes de rechange.',
    searchPlaceholder: 'Rechercher un produit...',
    allCategory: 'Tous les Produits',
    noResultsTitle: 'Aucun produit trouvé',
    noResultsDesc: 'Essayez un autre terme de recherche ou une autre catégorie.',
    showAllBtn: 'Afficher tous les produits',
    discountBadge: 'Promo',
    popularBadge: 'En Vedette',
    inStock: 'En Stock',
    outOfStock: 'Épuisé',
    addToCart: 'Ajouter au Panier',
    addedToCart: 'Ajouté',
  },
  it: {
    badge: "Collezione Esclusiva",
    title: "Tutti gli Spazzolini & Igiene Orale",
    subtitle: "Spazzolini sonici 360° di nuova generazione, soluzioni igieniche da viaggio e testine di ricambio.",
    searchPlaceholder: "Cerca prodotti o caratteristiche...",
    allCategory: "Tutti i Prodotti",
    noResultsTitle: "Nessun prodotto trovato",
    noResultsDesc: "Prova a cercare con un altro termine o seleziona un’altra categoria.",
    showAllBtn: "Mostra Tutti i Prodotti",
    discountBadge: "Sconto",
    popularBadge: "In Evidenza",
    inStock: "Disponibile",
    outOfStock: "Esaurito",
    addToCart: "Aggiungi al Carrello",
    addedToCart: "Aggiunto",
  },
}

function ProductsListContent() {
  const { locale, getLocalizedText, getLocalizedPath, formatPriceWithCurrency } = useLocale()
  const loc = PRODUCTS_TRANSLATIONS[locale] || PRODUCTS_TRANSLATIONS.tr

  const searchParams = useSearchParams()
  const categoryParam = searchParams.get('kategori')

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategorySlug, setSelectedCategorySlug] = useState<string>(categoryParam || 'all')
  const [addedId, setAddedId] = useState<string | null>(null)

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategorySlug(categoryParam)
    }
  }, [categoryParam])

  useEffect(() => {
    const unsubCats = subscribeToCategories((cats) => {
      const activeCats = cats.filter((c) => c.active !== false)
      setCategories(activeCats)
    })
    return () => unsubCats()
  }, [])

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const productsRef = collection(db, 'products')

      const unsubscribe = onSnapshot(
        productsRef,
        (snapshot) => {
          const productsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Product[]
          setProducts(productsData)
          setLoading(false)
        },
        (error) => {
          console.error('Products fetch error:', error)
          setLoading(false)
        }
      )
      return () => unsubscribe()
    } catch (error) {
      console.error('Products init error:', error)
      setLoading(false)
    }
  }, [])

  const filteredProducts = products.filter((product) => {
    const prodName = getLocalizedText(product.name, typeof product.name === 'string' ? product.name : '')
    const prodDesc = getLocalizedText(product.description, typeof product.description === 'string' ? product.description : '')
    const matchesSearch =
      prodName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prodDesc.toLowerCase().includes(searchTerm.toLowerCase())

    if (!matchesSearch) return false
    if (selectedCategorySlug === 'all') return true

    const targetCat = categories.find(
      (c) => c.slug === selectedCategorySlug || c.id === selectedCategorySlug
    )

    if (targetCat) {
      const pCat = (product.category || '').toLowerCase()
      const pCatId = product.categoryId || ''
      const targetSlug = targetCat.slug.toLowerCase()
      const targetId = targetCat.id

      return (
        pCat === targetSlug ||
        pCatId === targetId ||
        pCat === targetId ||
        (targetSlug === 'otomatik' && (pCat.includes('otomatik') || pCat.includes('elektrikli'))) ||
        (targetSlug === 'kullan-at' && (pCat.includes('kullan') || pCat.includes('seyahat'))) ||
        (targetSlug === 'yedek-firca-basliklari' && (pCat.includes('yedek') || pCat.includes('baslik')))
      )
    }

    return (
      (product.category || '').toLowerCase() === selectedCategorySlug.toLowerCase() ||
      product.categoryId === selectedCategorySlug
    )
  })

  const handleAddToCart = (product: Product, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const itemImage = product.images?.[0] || product.image
    const prodTitle = getLocalizedText(product.name, typeof product.name === 'string' ? product.name : 'Ürün')
    addToCart({
      productId: product.id,
      name: prodTitle,
      price: product.price,
      discountPrice: product.discountPrice,
      image: itemImage,
    })

    setAddedId(product.id)
    setTimeout(() => setAddedId(null), 1800)
  }

  return (
    <div className="min-h-screen bg-slate-50 pt-28 pb-24">
      <div className="container-custom section-padding">
        
        {/* Header Title & Subtitle */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block text-xs font-black uppercase tracking-[0.2em] text-sky-600 bg-sky-100 px-4 py-1.5 rounded-full border border-sky-200 mb-4"
          >
            {loc.badge}
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mb-4"
          >
            {loc.title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-slate-600 text-base sm:text-lg"
          >
            {loc.subtitle}
          </motion.p>
        </div>

        {/* Search & Dynamic Category Filter Bar */}
        <div className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-slate-200/80 mb-12 space-y-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={loc.searchPlaceholder}
                className="w-full pl-11 pr-4 py-3 bg-slate-50 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:border-sky-500 focus:bg-white transition-colors"
              />
            </div>

            {/* Dynamic Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
              <button
                onClick={() => setSelectedCategorySlug('all')}
                className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategorySlug === 'all'
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {loc.allCategory} ({products.length})
              </button>

              {categories.map((cat) => {
                const isSelected = selectedCategorySlug === cat.slug || selectedCategorySlug === cat.id
                const catTitle = getLocalizedText(cat.name as any, cat.name)
                return (
                  <button
                    key={cat.id || cat.slug}
                    onClick={() => setSelectedCategorySlug(cat.slug)}
                    className={`px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                      isSelected
                        ? 'bg-sky-600 text-white shadow-md shadow-sky-600/25'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {catTitle}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Product Cards Grid */}
        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-24 text-center bg-white rounded-3xl border border-slate-200 p-12">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
              <FiShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{loc.noResultsTitle}</h3>
            <p className="text-sm text-slate-500 mb-6">{loc.noResultsDesc}</p>
            <button
              onClick={() => {
                setSelectedCategorySlug('all')
                setSearchTerm('')
              }}
              className="px-6 py-3 bg-sky-600 text-white text-xs font-bold rounded-full hover:bg-sky-700 transition-colors"
            >
              {loc.showAllBtn}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 sm:gap-8">
            {filteredProducts.map((product) => {
              const productImage = product.images?.[0] || product.image
              const isAdded = addedId === product.id
              const discount = product.discountPrice
                ? Math.round(((product.price - product.discountPrice) / product.price) * 100)
                : null
              const prodTitle = getLocalizedText(product.name, typeof product.name === 'string' ? product.name : 'Ürün')
              const prodDesc = getLocalizedText(product.description, typeof product.description === 'string' ? product.description : '')

              return (
                <div
                  key={product.id}
                  className="group bg-white rounded-[2rem] p-6 border border-slate-200/80 hover:border-sky-300 shadow-sm hover:shadow-xl hover:shadow-slate-200/60 transition-all duration-300 flex flex-col justify-between"
                >
                  <div>
                    {/* Card Top Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      {discount ? (
                        <span className="text-[11px] font-extrabold text-white bg-emerald-600 px-3 py-1 rounded-full shadow-xs">
                          %{discount} {loc.discountBadge}
                        </span>
                      ) : product.isPopular ? (
                        <span className="text-[11px] font-extrabold text-sky-600 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
                          {loc.popularBadge}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                          {product.inStock !== false ? loc.inStock : loc.outOfStock}
                        </span>
                      )}
                    </div>

                    {/* Product Image Link */}
                    <Link
                      href={`${getLocalizedPath('/urunler')}/${product.id}`}
                      className="relative aspect-square w-full rounded-2xl bg-slate-50 flex items-center justify-center p-4 my-2 overflow-hidden block"
                    >
                      {productImage ? (
                        <Image
                          src={productImage}
                          alt={prodTitle}
                          fill
                          className="object-contain p-2 group-hover:scale-108 transition-transform duration-500"
                          sizes="(max-width: 768px) 100vw, 300px"
                        />
                      ) : (
                        <FiShoppingBag className="w-12 h-12 text-slate-300" />
                      )}
                    </Link>

                    {/* Product Title & Info */}
                    <div className="mt-4">
                      <Link href={`${getLocalizedPath('/urunler')}/${product.id}`}>
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-600 transition-colors line-clamp-1 mb-1">
                          {prodTitle}
                        </h3>
                      </Link>
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4">
                        {prodDesc}
                      </p>
                    </div>
                  </div>

                  {/* Card Bottom: Multi-Currency Price & Add to Cart Action */}
                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      {product.discountPrice ? (
                        <div className="flex flex-col">
                          <span className="text-xs text-slate-400 line-through leading-none">
                            {formatPriceWithCurrency(product.price, product.priceUSD, product.priceEUR)}
                          </span>
                          <span className="text-lg font-black text-emerald-600 leading-tight">
                            {formatPriceWithCurrency(product.discountPrice, product.discountPriceUSD, product.discountPriceEUR)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-lg font-black text-slate-900">
                          {formatPriceWithCurrency(product.price, product.priceUSD, product.priceEUR)}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => handleAddToCart(product, e)}
                      disabled={product.inStock === false}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm ${
                        isAdded
                          ? 'bg-emerald-600 text-white'
                          : product.inStock === false
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-slate-900 hover:bg-sky-600 text-white'
                      }`}
                    >
                      {isAdded ? (
                        <>
                          <FiCheck className="w-3.5 h-3.5" />
                          <span>{loc.addedToCart}</span>
                        </>
                      ) : (
                        <>
                          <FiShoppingBag className="w-3.5 h-3.5" />
                          <span>{loc.addToCart}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

export default function ProductsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin" />
        </div>
      }
    >
      <ProductsListContent />
    </Suspense>
  )
}
