import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { ReturnRequest } from '@/lib/returns/types'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

interface ReviewRequestBody {
  orderId: string
  returnId: string
  action: 'approve' | 'reject'
  rejectionReason?: string
  notes?: string
}

export async function POST(req: NextRequest) {
  const auth = await verifyAdminRequest(req)
  if (!auth.isAuthorized) {
    return NextResponse.json(
      { success: false, error: auth.error || 'Yönetici yetkisi gereklidir.' },
      { status: 401 }
    )
  }

  try {
    const body = (await req.json()) as ReviewRequestBody
    const { orderId, returnId, action, rejectionReason, notes } = body

    if (!orderId || !returnId || !action) {
      return NextResponse.json(
        { success: false, error: 'orderId, returnId ve action alanları zorunludur.' },
        { status: 400 }
      )
    }

    if (action === 'reject' && !rejectionReason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'İade talebini reddederken geçerli bir gerekçe belirtilmelidir.' },
        { status: 400 }
      )
    }

    const db = getAdminFirestore()
    const orderRef = db.collection('orders').doc(orderId)
    const orderDoc = await orderRef.get()

    if (!orderDoc.exists) {
      return NextResponse.json({ success: false, error: 'Sipariş bulunamadı.' }, { status: 404 })
    }

    const orderData = orderDoc.data() || {}
    const returnRequests: ReturnRequest[] = Array.isArray(orderData.returnRequests) ? orderData.returnRequests : []
    const targetIdx = returnRequests.findIndex((r) => r.id === returnId)

    if (targetIdx === -1) {
      return NextResponse.json({ success: false, error: 'İade talebi bulunamadı.' }, { status: 404 })
    }

    const targetReturn = returnRequests[targetIdx]
    const nowIso = new Date().toISOString()
    const adminEmail = auth.email || 'admin'

    let newStatus = targetReturn.status
    let approvalStatus: 'approved' | 'rejected' = 'approved'

    if (action === 'approve') {
      newStatus = 'approved'
      approvalStatus = 'approved'
    } else {
      newStatus = 'rejected'
      approvalStatus = 'rejected'
    }

    const updatedReturn: ReturnRequest = {
      ...targetReturn,
      status: newStatus,
      updatedAt: nowIso,
      approval: {
        type: 'manual',
        status: approvalStatus,
        reviewedAt: nowIso,
        reviewedBy: adminEmail,
        rejectionReason: action === 'reject' ? rejectionReason : null,
        notes: notes || null,
      },
      history: [
        ...(targetReturn.history || []),
        {
          status: newStatus,
          action: action === 'approve'
            ? `İade talebi yönetici (${adminEmail}) tarafından onaylandı. Müşteri HepsiJET randevusu seçebilir.`
            : `İade talebi yönetici (${adminEmail}) tarafından reddedildi. Gerekçe: ${rejectionReason}`,
          actor: 'admin',
          actorEmail: adminEmail,
          timestamp: nowIso,
          note: notes || rejectionReason,
        },
      ],
    }

    returnRequests[targetIdx] = updatedReturn

    await db.runTransaction(async (transaction) => {
      const subDocRef = orderRef.collection('returnRequests').doc(returnId)
      transaction.set(subDocRef, cleanFirestoreData(updatedReturn), { merge: true })

      transaction.update(orderRef, cleanFirestoreData({
        returnRequests: cleanFirestoreData(returnRequests),
        lastReturnStatus: newStatus,
        updatedAt: nowIso,
      }))
    })

    return NextResponse.json({
      success: true,
      message: action === 'approve' ? 'İade talebi başarıyla onaylandı.' : 'İade talebi reddedildi.',
      returnRequest: updatedReturn,
    })
  } catch (err: any) {
    console.error('İade inceleme hatası:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'İade talebi güncellenirken bir hata oluştu.' },
      { status: 500 }
    )
  }
}

