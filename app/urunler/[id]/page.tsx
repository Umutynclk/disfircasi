'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { doc, onSnapshot } from 'firebase/firestore'
import { getFirestoreDB } from '@/firebase/config'
import { motion, AnimatePresence } from 'framer-motion'
import { FiShoppingBag, FiCheck, FiShield, FiTruck, FiRefreshCw, FiArrowLeft, FiPlus, FiMinus } from 'react-icons/fi'
import Link from 'next/link'
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
  images?: string[]
  image?: string
  video?: string
  model3dUrl?: string
  description: any
  features?: string[]
  specifications?: Record<string, string>
  inStock?: boolean
  category?: string
  colors?: ColorOption[]
}

const DETAIL_TRANSLATIONS = {
  tr: {
    backToProducts: 'Tüm Ürünlere Dön',
    colorOption: 'Renk Seçeneği',
    quantity: 'Adet',
    addToCart: 'Sepete Ekle',
    addedToCart: 'Sepete Eklendi!',
    buyNow: 'Hemen Satın Al',
    freeShipping: 'Ücretsiz Kargo',
    warranty: '2 Yıl Garanti',
    returns: '14 Gün İade',
    featuresTitle: 'Öne Çıkan Özellikler',
    notFound: 'Ürün bulunamadı.',
  },
  en: {
    backToProducts: 'Back to All Products',
    colorOption: 'Color Option',
    quantity: 'Quantity',
    addToCart: 'Add to Cart',
    addedToCart: 'Added to Cart!',
    buyNow: 'Buy Now',
    freeShipping: 'Free Shipping',
    warranty: '2-Year Warranty',
    returns: '14-Day Returns',
    featuresTitle: 'Key Features',
    notFound: 'Product not found.',
  },
  de: {
    backToProducts: 'Zurück zu allen Produkten',
    colorOption: 'Farboption',
    quantity: 'Menge',
    addToCart: 'In den Warenkorb',
    addedToCart: 'Hinzugefügt!',
    buyNow: 'Jetzt Kaufen',
    freeShipping: 'Kostenloser Versand',
    warranty: '2 Jahre Garantie',
    returns: '14 Tage Rückgabe',
    featuresTitle: 'Hauptmerkmale',
    notFound: 'Produkt nicht gefunden.',
  },
  fr: {
    backToProducts: 'Retour à tous les produits',
    colorOption: 'Option de couleur',
    quantity: 'Quantité',
    addToCart: 'Ajouter au Panier',
    addedToCart: 'Ajouté au panier !',
    buyNow: 'Acheter Maintenant',
    freeShipping: 'Livraison Gratuite',
    warranty: 'Garantie 2 Ans',
    returns: 'Retours 14 Jours',
    featuresTitle: 'Caractéristiques Principales',
    notFound: 'Produit non trouvé.',
  },
  it: {
    backToProducts: "Torna a Tutti i Prodotti",
    colorOption: "Opzione Colore",
    quantity: "Quantità",
    addToCart: "Aggiungi al Carrello",
    addedToCart: "Aggiunto al Carrello!",
    buyNow: "Acquista Ora",
    freeShipping: "Spedizione Gratuita",
    warranty: "2 Anni di Garanzia",
    returns: "Reso entro 14 Giorni",
    featuresTitle: "Caratteristiche Principali",
    notFound: "Prodotto non trovato.",
  },
}

export default function ProductDetailPage() {
  const { locale, getLocalizedText, getLocalizedPath, formatPriceWithCurrency } = useLocale()
  const loc = DETAIL_TRANSLATIONS[locale] || DETAIL_TRANSLATIONS.tr

  const params = useParams()
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedColor, setSelectedColor] = useState<ColorOption | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [currentPrice, setCurrentPrice] = useState<number>(0)
  const [currentDiscountPrice, setCurrentDiscountPrice] = useState<number | null>(null)
  const [currentImages, setCurrentImages] = useState<string[]>([])
  const [added, setAdded] = useState(false)

  useEffect(() => {
    try {
      const db = getFirestoreDB()
      const productRef = doc(db, 'products', params.id as string)

      const unsubscribe = onSnapshot(
        productRef,
        (productSnap) => {
          if (productSnap.exists()) {
            const productData = { id: productSnap.id, ...productSnap.data() } as Product
            setProduct(productData)

            if (productData.colors && productData.colors.length > 0) {
              const firstColor = productData.colors[0]
              setSelectedColor(firstColor)
              setCurrentImages(firstColor.images || productData.images || [])
              setCurrentPrice(firstColor.price || productData.price)
              setCurrentDiscountPrice(firstColor.discountPrice || productData.discountPrice || null)
            } else {
              const images = productData.images || (productData.image ? [productData.image] : [])
              setCurrentImages(images)
              setCurrentPrice(productData.price)
              setCurrentDiscountPrice(productData.discountPrice || null)
            }
            setLoading(false)
          } else {
            setLoading(false)
          }
        },
        (error) => {
          console.error('Product detail fetch error:', error)
          setLoading(false)
        }
      )
      return () => unsubscribe()
    } catch (error) {
      console.error('Product detail init error:', error)
      setLoading(false)
    }
  }, [params.id])

  const handleColorSelect = (color: ColorOption) => {
    setSelectedColor(color)
    if (color.images && color.images.length > 0) {
      setCurrentImages(color.images)
    }
    if (color.price) {
      setCurrentPrice(color.price)
      setCurrentDiscountPrice(color.discountPrice || null)
    } else if (product) {
      setCurrentPrice(product.price)
      setCurrentDiscountPrice(product.discountPrice || null)
    }
  }

  const prodName = product ? getLocalizedText(product.name, typeof product.name === 'string' ? product.name : 'Ürün') : ''
  const prodDesc = product ? getLocalizedText(product.description, typeof product.description === 'string' ? product.description : '') : ''

  const handleAddToCart = () => {
    if (!product) return
    const itemImage = currentImages[0] || product.images?.[0] || product.image
    addToCart({
      productId: product.id,
      name: prodName,
      price: currentPrice,
      discountPrice: currentDiscountPrice,
      image: itemImage,
      selectedColor: selectedColor ? { name: selectedColor.name, code: selectedColor.code } : undefined,
      quantity: quantity,
    })

    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const handleBuyNow = () => {
    if (!product) return
    const itemImage = currentImages[0] || product.images?.[0] || product.image
    // suppressDrawer=true → sepet paneli açılmaz, doğrudan checkout'a yönlendirilir
    addToCart(
      {
        productId: product.id,
        name: prodName,
        price: currentPrice,
        discountPrice: currentDiscountPrice,
        image: itemImage,
        selectedColor: selectedColor ? { name: selectedColor.name, code: selectedColor.code } : undefined,
        quantity: quantity,
      },
      true // suppressDrawer
    )
    router.push(getLocalizedPath('/satin-al'))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-12 h-12 border-3 border-sky-600/20 border-t-sky-600 rounded-full animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
          <FiShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">{loc.notFound}</h2>
        <Link
          href={getLocalizedPath('/urunler')}
          className="px-6 py-3 bg-sky-600 text-white rounded-full text-xs font-bold hover:bg-sky-700 transition-colors"
        >
          {loc.backToProducts}
        </Link>
      </div>
    )
  }

  return (
    <div className="pt-32 pb-24 bg-slate-50 min-h-screen">
      <div className="container-custom section-padding">
        {/* Back Link */}
        <Link
          href={getLocalizedPath('/urunler')}
          className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 hover:text-sky-600 transition-colors mb-8"
        >
          <FiArrowLeft className="w-4 h-4" /> {loc.backToProducts}
        </Link>

        {/* Hero Product Detail Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start mb-20">
          {/* Left Column: Product Image Gallery */}
          <div className="lg:col-span-7 space-y-6">
            <div className="relative aspect-square w-full rounded-3xl bg-slate-50 border border-slate-200/80 flex items-center justify-center p-6 sm:p-10 overflow-hidden shadow-xs">
              {currentImages[0] || product.image ? (
                <img
                  src={currentImages[0] || product.image}
                  alt={prodName}
                  className="w-full h-full object-contain hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="text-slate-400 text-sm">Görsel bulunamadı</div>
              )}
            </div>

            {/* Thumbnail Carousel if multiple images */}
            {currentImages.length > 1 && (
              <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                {currentImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      const newImgs = [...currentImages]
                      const temp = newImgs[0]
                      newImgs[0] = newImgs[idx]
                      newImgs[idx] = temp
                      setCurrentImages(newImgs)
                    }}
                    className="w-20 h-20 rounded-2xl bg-white p-2 border border-slate-200 flex-shrink-0 hover:border-sky-500 transition-colors overflow-hidden"
                  >
                    <img src={img} alt={`Görsel ${idx}`} className="w-full h-full object-contain" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Product Configuration & Actions */}
          <div className="lg:col-span-5 bg-white p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
            <div>
              {product.category && (
                <span className="text-xs font-bold uppercase tracking-widest text-sky-600 bg-sky-50 px-3 py-1 rounded-full border border-sky-200">
                  {product.category}
                </span>
              )}
              <h1 className="text-3xl font-black text-slate-900 tracking-tight mt-3 mb-4">
                {prodName}
              </h1>

              {/* Price with Multi-Currency */}
              <div className="flex items-baseline gap-3 my-4">
                {currentDiscountPrice ? (
                  <>
                    <span className="text-3xl font-black text-emerald-600">
                      {formatPriceWithCurrency(currentDiscountPrice, product.discountPriceUSD, product.discountPriceEUR)}
                    </span>
                    <span className="text-sm text-slate-400 line-through">
                      {formatPriceWithCurrency(currentPrice, product.priceUSD, product.priceEUR)}
                    </span>
                  </>
                ) : (
                  <span className="text-3xl font-black text-slate-900">
                    {formatPriceWithCurrency(currentPrice, product.priceUSD, product.priceEUR)}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed border-t border-b border-slate-100 py-4 font-normal">
                {prodDesc}
              </p>
            </div>

            {/* Color Variants Selector */}
            {product.colors && product.colors.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block mb-3">
                  {loc.colorOption}: <span className="text-sky-600">{selectedColor?.name}</span>
                </label>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleColorSelect(color)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-bold transition-all ${
                        selectedColor?.code === color.code
                          ? 'border-sky-500 bg-sky-50 text-sky-600 shadow-xs'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ backgroundColor: color.code }}
                      />
                      <span>{color.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">{loc.quantity}</span>
              <div className="flex items-center gap-3 bg-slate-100 border border-slate-200 rounded-full px-3 py-1.5">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="text-slate-600 hover:text-slate-900 p-1"
                >
                  <FiMinus className="w-3.5 h-3.5" />
                </button>
                <span className="text-sm font-bold text-slate-900 w-6 text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="text-slate-600 hover:text-slate-900 p-1"
                >
                  <FiPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="space-y-3 pt-4">
              <button
                onClick={handleAddToCart}
                className={`w-full py-4 rounded-full font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 ${
                  added
                    ? 'bg-emerald-600 text-white scale-102'
                    : 'bg-sky-600 text-white hover:bg-sky-700 hover:shadow-sky-600/30'
                }`}
              >
                {added ? (
                  <>
                    <FiCheck className="w-5 h-5" />
                    <span>{loc.addedToCart}</span>
                  </>
                ) : (
                  <>
                    <FiShoppingBag className="w-5 h-5" />
                    <span>{loc.addToCart}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleBuyNow}
                className="w-full py-4 bg-slate-900 text-white rounded-full font-bold text-sm hover:bg-slate-800 transition-colors flex items-center justify-center"
              >
                {loc.buyNow}
              </button>
            </div>

            {/* Guarantee Pills */}
            <div className="grid grid-cols-3 gap-2 pt-6 border-t border-slate-100 text-[11px] text-slate-500 font-medium text-center">
              <div className="p-2 rounded-xl bg-slate-50 flex flex-col items-center gap-1">
                <FiTruck className="w-4 h-4 text-sky-600" />
                <span>{loc.freeShipping}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 flex flex-col items-center gap-1">
                <FiShield className="w-4 h-4 text-emerald-600" />
                <span>{loc.warranty}</span>
              </div>
              <div className="p-2 rounded-xl bg-slate-50 flex flex-col items-center gap-1">
                <FiRefreshCw className="w-4 h-4 text-cyan-500" />
                <span>{loc.returns}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Product Features List */}
        {product.features && product.features.length > 0 && (
          <div className="bg-white p-8 md:p-12 rounded-3xl border border-slate-200/80 shadow-xs max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">{loc.featuresTitle}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.features.map((feature, idx) => (
                <div key={idx} className="flex items-start gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <FiCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-slate-700 font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
