// Sepet yönetimi için utility fonksiyonları

export interface CartItem {
  id: string
  productId: string
  name: string
  price: number
  discountPrice?: number | null
  image?: string
  quantity: number
  selectedColor?: {
    name: string
    code: string
    price?: number
    discountPrice?: number | null
  }
}

const CART_STORAGE_KEY = 'smilebrush_cart'

export const getCart = (): CartItem[] => {
  if (typeof window === 'undefined') return []
  try {
    const cartData = localStorage.getItem(CART_STORAGE_KEY)
    return cartData ? JSON.parse(cartData) : []
  } catch (error) {
    console.error('Sepet okuma hatası:', error)
    return []
  }
}

export const saveCart = (cart: CartItem[]): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    // Event dispatch for cart updates
    window.dispatchEvent(new CustomEvent('cartUpdated'))
  } catch (error) {
    console.error('Sepet kaydetme hatası:', error)
  }
}

export const addToCart = (item: Omit<CartItem, 'id' | 'quantity'>): CartItem => {
  const cart = getCart()
  const existingItemIndex = cart.findIndex(
    (cartItem) => 
      cartItem.productId === item.productId && 
      cartItem.selectedColor?.code === item.selectedColor?.code
  )

  if (existingItemIndex >= 0) {
    // Ürün zaten sepette, miktarı artır
    cart[existingItemIndex].quantity += 1
    saveCart(cart)
    return cart[existingItemIndex]
  } else {
    // Yeni ürün ekle
    const newItem: CartItem = {
      ...item,
      id: `${item.productId}_${Date.now()}_${Math.random()}`,
      quantity: 1
    }
    cart.push(newItem)
    saveCart(cart)
    return newItem
  }
}

export const removeFromCart = (itemId: string): void => {
  const cart = getCart()
  const filteredCart = cart.filter((item) => item.id !== itemId)
  saveCart(filteredCart)
}

export const updateCartItemQuantity = (itemId: string, quantity: number): void => {
  if (quantity <= 0) {
    removeFromCart(itemId)
    return
  }
  const cart = getCart()
  const itemIndex = cart.findIndex((item) => item.id === itemId)
  if (itemIndex >= 0) {
    cart[itemIndex].quantity = quantity
    saveCart(cart)
  }
}

export const clearCart = (): void => {
  saveCart([])
}

export const getCartTotal = (): number => {
  const cart = getCart()
  return cart.reduce((total, item) => {
    const price = item.discountPrice || item.selectedColor?.discountPrice || item.selectedColor?.price || item.price
    return total + price * item.quantity
  }, 0)
}

export const getCartItemCount = (): number => {
  const cart = getCart()
  return cart.reduce((total, item) => total + item.quantity, 0)
}
