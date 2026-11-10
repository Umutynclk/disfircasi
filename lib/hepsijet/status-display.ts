/**
 * lib/hepsijet/status-display.ts
 *
 * Admin Siparişler ve Müşteri Profil sayfaları için ortak durum hesaplayıcı.
 * Her iki ekranda da birebir aynı Firestore alanlarını esas alır ve tutarlı
 * durum rozeti (badge) ve metni döndürür.
 */

export interface OrderStatusBadgeInfo {
  key:
    | 'cancelled'
    | 'delivered'
    | 'out_for_delivery'
    | 'in_transit'
    | 'accepted'
    | 'label_created'
    | 'processing'
    | 'pending'
    | 'returned'
    | 'unknown'
  text: string
  color: string
  bg: string
  border: string
}

export function getCommonOrderDisplayStatus(order: any): OrderStatusBadgeInfo {
  if (!order) {
    return {
      key: 'unknown',
      text: 'Belirsiz',
      color: 'text-slate-700',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
    }
  }

  const shipping = order.shipping || {}
  const hasRealBarcode =
    Boolean(shipping.barcode) &&
    !/NUMUNE|SAMPLE|TEST/i.test(shipping.barcode) &&
    !shipping.barcode.startsWith('SIM-')

  const rawOrderStatus = String(order.status || '').toLowerCase()
  const rawShippingStatus = String(shipping.status || '').toLowerCase()
  const providerStatus = String(shipping.providerStatus || '').toUpperCase()

  // 1. İade Durumu (Kargo taşıyıcısının iade süreci veya iade kaydı)
  if (
    rawShippingStatus === 'returned' ||
    providerStatus === 'RETURNED' ||
    providerStatus === 'RETURN_STARTED' ||
    providerStatus === 'RETURN_DELIVERED' ||
    rawOrderStatus === 'returned' ||
    rawOrderStatus === 'refunded'
  ) {
    return {
      key: 'returned',
      text: 'İade Edildi',
      color: 'text-purple-700',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
    }
  }

  // 2. Gerçek Sipariş İptal Durumu (Müşteri veya Admin tarafından sipariş iptal edilmişse)
  if (
    rawOrderStatus === 'cancelled' ||
    rawShippingStatus === 'cancelled' ||
    order.isCancelled === true
  ) {
    return {
      key: 'cancelled',
      text: 'İptal Edildi',
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
    }
  }

  // 3. Teslim Edildi Durumu
  if (
    rawOrderStatus === 'delivered' ||
    rawOrderStatus === 'completed' ||
    rawShippingStatus === 'delivered' ||
    providerStatus === 'DELIVERED'
  ) {
    return {
      key: 'delivered',
      text: 'Teslim Edildi',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    }
  }

  // 4. Dağıtımda Durumu
  if (
    rawShippingStatus === 'out_for_delivery' ||
    providerStatus === 'OUT_FOR_DELIVERY' ||
    providerStatus === 'ON_DISTRIBUTION' ||
    providerStatus === 'COURIER_ASSIGNED'
  ) {
    return {
      key: 'out_for_delivery',
      text: 'Dağıtımda',
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    }
  }

  // 5. Yolda / Transfer Sürecinde
  if (
    rawShippingStatus === 'in_transit' ||
    providerStatus === 'IN_TRANSIT' ||
    providerStatus === 'TRANSFER' ||
    providerStatus === 'X_DOCK_IN' ||
    providerStatus === 'X_DOCK_OUT' ||
    providerStatus === 'ON_WAY'
  ) {
    return {
      key: 'in_transit',
      text: 'Yolda',
      color: 'text-indigo-700',
      bg: 'bg-indigo-50',
      border: 'border-indigo-200',
    }
  }

  // 6. HepsiJET Gönderiyi Teslim Aldı (Kargoya Verildi)
  if (
    rawShippingStatus === 'accepted' ||
    providerStatus === 'ACCEPTED' ||
    providerStatus === 'DELIVERY_ACCEPTED' ||
    providerStatus === 'COLLECTED' ||
    rawOrderStatus === 'shipped'
  ) {
    return {
      key: 'accepted',
      text: 'Kargoya Verildi',
      color: 'text-sky-700',
      bg: 'bg-sky-50',
      border: 'border-sky-200',
    }
  }

  // 7. Kargo Etiketi Oluşturuldu (Barkod var fakat henüz HepsiJET hareket detayı yok)
  if (hasRealBarcode || rawShippingStatus === 'created') {
    return {
      key: 'label_created',
      text: shipping.displayStatus || 'Kargo Etiketi Oluşturuldu',
      color: 'text-slate-700',
      bg: 'bg-slate-100',
      border: 'border-slate-200',
    }
  }

  // 8. Hazırlanıyor
  if (rawOrderStatus === 'paid' || rawOrderStatus === 'processing') {
    return {
      key: 'processing',
      text: 'Hazırlanıyor',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    }
  }

  // 9. Bekliyor
  return {
    key: 'pending',
    text: 'Sipariş Alındı',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  }
}

