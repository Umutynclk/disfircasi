import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

export type WithdrawalReviewAction = 'approve' | 'mark_return_expected' | 'reject' | 'complete'

interface WithdrawalReviewBody {
  orderId: string
  withdrawalId?: string
  action: WithdrawalReviewAction
  adminNote?: string
  customerMessage?: string
}

const ACTION_TO_STATUS: Record<WithdrawalReviewAction, string> = {
  approve: 'approved',
  mark_return_expected: 'return_expected',
  reject: 'rejected',
  complete: 'completed',
}

const ACTION_DEFAULT_CUSTOMER_MSG: Record<WithdrawalReviewAction, string> = {
  approve:
    'Cayma talebiniz onaylanmıştır. Paket teslimat sırasında teslim alınmadığında veya tarafımıza iade ulaştığında kontrol edilerek ödeme iadesi yapılacaktır.',
  mark_return_expected:
    'Cayma talebiniz kayda alınmıştır; ürünün depomuza iade ulaşması beklenmektedir. Depo kontrolü sonrası ödeme iadeniz tamamlanacaktır.',
  reject:
    'Cayma talebiniz incelenmiş olup yasal koşullar nedeniyle reddedilmiştir. Ayrıntılar yönetici açıklamasında yer almaktadır.',
  complete:
    'Cayma talebiniz sonuçlandırılarak kapatılmıştır. Ödeme iadesi ve süreç detaylarını sipariş detayından takip edebilirsiniz.',
}

/**
 * POST /api/admin/withdrawals/review
 *
 * Admin'in `withdrawal_requests` (yasal cayma talebi) kayıtlarını yetki kontrolü,
 * durum geçiş doğrulaması, işlem geçmişi ve müşteri bilgilendirmesi ile
 * inceleyip sonuçlandırmasını sağlar.
 *
 * KURALLAR:
 * - Yeni HepsiJET gönderisi OLUŞTURMAZ.
 * - Otomatik PayTR/iyzico para iadesi BAŞLATMAZ (ödeme iadesi ayrı kontrollü adımdır).
 * - Gerçek `shipping.status` ve `paymentStatus` alanlarını bozmaz.
 */
export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Yetkisiz erişim. Yönetici yetkisi gereklidir.' },
      { status: 401 }
    )
  }

  try {
    const body = (await req.json()) as WithdrawalReviewBody
    const { orderId, withdrawalId, action, adminNote, customerMessage } = body

    if (!orderId || typeof orderId !== 'string') {
      return NextResponse.json({ success: false, error: 'orderId zorunludur.' }, { status: 400 })
    }

    if (!action || !(action in ACTION_TO_STATUS)) {
      return NextResponse.json(
        { success: false, error: 'Geçerli bir işlem türü (approve, mark_return_expected, reject, complete) belirtilmelidir.' },
        { status: 400 }
      )
    }

    const trimmedNote = (adminNote || '').trim()
    if (action === 'reject' && trimmedNote.length < 5) {
      return NextResponse.json(
        { success: false, error: 'Cayma talebini reddetmek için en az 5 karakterlik somut gerekçe girmelisiniz.' },
        { status: 400 }
      )
    }

    const db = getAdminFirestore()
    const orderRef = db.collection('orders').doc(orderId)
    const orderSnap = await orderRef.get()

    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, error: 'Sipariş bulunamadı.' }, { status: 404 })
    }

    const orderData = orderSnap.data() || {}
    const existingWithdrawal = orderData.withdrawalRequest

    if (!existingWithdrawal) {
      return NextResponse.json(
        { success: false, error: 'Bu siparişe ait aktif bir cayma talebi bulunamadı.' },
        { status: 404 }
      )
    }

    const targetWithdrawalId = withdrawalId || existingWithdrawal.id
    if (withdrawalId && existingWithdrawal.id && withdrawalId !== existingWithdrawal.id) {
      return NextResponse.json(
        { success: false, error: 'Belirtilen withdrawalId siparişin cayma talebi ile eşleşmiyor.' },
        { status: 400 }
      )
    }

    const currentStatus = String(existingWithdrawal.status || 'pending_review')
    if (currentStatus === 'completed' || currentStatus === 'rejected') {
      return NextResponse.json(
        { success: false, error: `Bu cayma talebi zaten sonuçlandırılmıştır (${currentStatus}).` },
        { status: 409 }
      )
    }

    const nextStatus = ACTION_TO_STATUS[action]
    const nowIso = new Date().toISOString()
    const resolvedCustomerMsg =
      (customerMessage || '').trim() ||
      (action === 'reject' && trimmedNote
        ? `Cayma talebiniz reddedildi. Gerekçe: ${trimmedNote}`
        : ACTION_DEFAULT_CUSTOMER_MSG[action])

    const existingHistory = Array.isArray(existingWithdrawal.history) ? existingWithdrawal.history : []
    const historyEntry = {
      status: nextStatus,
      action,
      actor: 'admin',
      actorEmail: auth.email || 'admin',
      note: trimmedNote || null,
      customerMessage: resolvedCustomerMsg,
      timestamp: nowIso,
    }

    const updatedWithdrawal = cleanFirestoreData({
      ...existingWithdrawal,
      status: nextStatus,
      reviewedBy: auth.email || 'admin',
      reviewedAt: nowIso,
      adminNote: trimmedNote || existingWithdrawal.adminNote || '',
      customerNotification: {
        message: resolvedCustomerMsg,
        notifiedAt: nowIso,
        status: nextStatus,
      },
      requiresAdminReview: nextStatus === 'pending_review' || nextStatus === 'return_expected',
      history: [...existingHistory, historyEntry],
      updatedAt: nowIso,
    })

    const batch = db.batch()
    batch.set(db.collection('withdrawal_requests').doc(targetWithdrawalId), updatedWithdrawal, { merge: true })
    batch.update(
      orderRef,
      cleanFirestoreData({
        withdrawalRequest: updatedWithdrawal,
        updatedAt: nowIso,
      })
    )

    // Müşteri bildirim kaydı oluştur (profil/bildirim geçmişi için)
    const notifRef = db.collection('notifications').doc()
    batch.set(
      notifRef,
      cleanFirestoreData({
        id: notifRef.id,
        userId: orderData.userId || existingWithdrawal.userId || null,
        email: orderData.userEmail || orderData.customer?.email || existingWithdrawal.userEmail || '',
        orderId: orderRef.id,
        orderNumber: orderData.orderNumber || orderRef.id,
        withdrawalId: targetWithdrawalId,
        type: 'withdrawal_status_update',
        status: nextStatus,
        title: `Cayma Talebi Güncellemesi (#${orderData.orderNumber || orderRef.id})`,
        message: resolvedCustomerMsg,
        read: false,
        createdAt: nowIso,
      })
    )

    await batch.commit()

    return NextResponse.json({
      success: true,
      withdrawalId: targetWithdrawalId,
      status: nextStatus,
      withdrawalRequest: updatedWithdrawal,
      message: 'Cayma talebi güncellendi ve müşteri bilgilendirmesi kaydedildi.',
    })
  } catch (err: any) {
    console.error('POST /api/admin/withdrawals/review error:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Cayma talebi güncellenirken hata oluştu.' },
      { status: 500 }
    )
  }
}
