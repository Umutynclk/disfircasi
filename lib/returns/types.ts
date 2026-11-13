/**
 * lib/returns/types.ts
 *
 * SONRAKAM / KALIPORT - İade ve İptal Yönetimi Veri Tipleri
 */

export type ReturnScope = 'full' | 'partial'

export type ReturnStatus =
  | 'pending_admin_review'       // Yönetici İncelemesinde
  | 'auto_preapproved'          // Otomatik Ön Onaylandı (Randevu Seçimi Bekleniyor)
  | 'approved'                  // Yönetici Tarafından Onaylandı (Randevu Seçimi Bekleniyor)
  | 'rejected'                  // Reddedildi
  | 'awaiting_pickup_date'      // Randevu Tarihi Seçimi Bekleniyor
  | 'pickup_scheduled'          // Toplama Randevusu Seçildi
  | 'return_shipment_created'   // HepsiJET İade Kargo Kodu Oluşturuldu
  | 'return_in_transit'         // İade Kargosu Yolda
  | 'received_at_warehouse'     // Depoya Ulaştı
  | 'inspection'                // Ürün Kontrolü / İncelemede
  | 'refund_pending'            // Para İadesi Bekleniyor
  | 'refund_processing'         // Para İadesi İşleniyor
  | 'refunded'                  // Para İadesi Tamamlandı
  | 'completed'                 // İade Süreci Başarıyla Tamamlandı
  | 'cancelled'                 // Müşteri Tarafından İptal Edildi

export type ReturnReasonCode =
  | 'not_wanted'       // Ürünü artık istemiyorum
  | 'wrong_item'       // Yanlış ürün gönderildi
  | 'damaged'          // Ürün hasarlı geldi
  | 'not_as_described' // Ürün açıklamadan farklı
  | 'missing_item'     // Eksik ürün
  | 'other'            // Diğer

export const RETURN_REASONS: Record<ReturnReasonCode, string> = {
  not_wanted: 'Ürünü artık istemiyorum',
  wrong_item: 'Yanlış ürün gönderildi',
  damaged: 'Ürün hasarlı geldi',
  not_as_described: 'Ürün açıklamadan farklı',
  missing_item: 'Eksik ürün',
  other: 'Diğer',
}

export interface ReturnItem {
  orderItemId: string
  productId: string
  productName: string
  productImage?: string
  sku?: string
  quantityPurchased: number
  quantityRequested: number
  quantityApproved?: number
  unitPriceAtPurchase: number
  totalPriceAtPurchase: number
}

export interface ReturnApproval {
  type: 'manual' | 'automatic'
  status: 'pending' | 'approved' | 'rejected'
  reviewedAt?: string | null
  reviewedBy?: string | null
  rejectionReason?: string | null
  notes?: string | null
}

export interface ReturnShipmentData {
  carrier: 'HepsiJET'
  customerDeliveryNo?: string
  barcode?: string
  trackingUrl?: string
  appointmentDate?: string | null
  appointmentSlot?: number | null
  appointmentSlotDescription?: string | null
  status:
    | 'not_created'
    | 'date_selected'
    | 'created'
    | 'in_transit'
    | 'delivered_to_warehouse'
    | 'failed'
  createdAt?: string | null
  error?: string | null
}

export interface ReturnInspection {
  status: 'not_started' | 'passed' | 'failed' | 'partial'
  inspectedAt?: string | null
  inspectedBy?: string | null
  notes?: string | null
  acceptedItemsCount?: number
  rejectedItemsCount?: number
}

export interface ReturnRefundData {
  status: 'not_started' | 'pending' | 'processing' | 'refunded' | 'failed'
  amountTRY?: number | null
  provider?: 'paytr' | 'iyzico' | 'manual'
  transactionId?: string | null
  completedAt?: string | null
  error?: string | null
  refundDetails?: any
}

export interface ReturnRequest {
  id: string
  orderId: string
  orderNumber: string
  userId: string
  userEmail: string
  customerName: string
  customerPhone?: string
  scope: ReturnScope
  status: ReturnStatus
  reasonCode: ReturnReasonCode
  reason: string
  customerNote?: string
  items: ReturnItem[]
  approval: ReturnApproval
  returnShipment: ReturnShipmentData
  inspection: ReturnInspection
  refund: ReturnRefundData
  createdAt: string
  updatedAt: string
  history?: Array<{
    status: ReturnStatus
    action: string
    actor: 'customer' | 'admin' | 'system'
    actorEmail?: string
    timestamp: string
    note?: string
  }>
}

export interface AvailableDeliverySlot {
  slot: number
  slotDescription: string
  available: boolean
}

export interface AvailableDeliveryDate {
  date: string // YYYY-MM-DD
  available: boolean
  deliverySlot?: AvailableDeliverySlot[]
}

