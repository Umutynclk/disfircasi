import { NextRequest, NextResponse } from 'next/server'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { verifyAdminRequest } from '@/lib/hepsijet/serverAuth'
import { ReturnRequest } from '@/lib/returns/types'
import { cleanFirestoreData } from '@/lib/firebase/firestoreUtils'

interface InspectRequestBody {
  orderId: string
  returnId: string
  status: 'passed' | 'failed' | 'partial'
  notes?: string
  acceptedItemsCount?: number
  rejectedItemsCount?: number
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
    const body = (await req.json()) as InspectRequestBody
    const { orderId, returnId, status, notes, acceptedItemsCount, rejectedItemsCount } = body

    if (!orderId || !returnId || !status) {
      return NextResponse.json(
        { success: false, error: 'orderId, returnId ve status alanları zorunludur.' },
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

    // İnceleme durumuna göre iade talebi durumu belirlenir
    const nextStatus = status === 'passed' || status === 'partial' ? 'refund_pending' : 'rejected'

    const updatedReturn: ReturnRequest = {
      ...targetReturn,
      status: nextStatus,
      updatedAt: nowIso,
      inspection: {
        status,
        inspectedAt: nowIso,
        inspectedBy: adminEmail,
        notes: notes || null,
        acceptedItemsCount: Number(acceptedItemsCount) || 0,
        rejectedItemsCount: Number(rejectedItemsCount) || 0,
      },
      history: [
        ...(targetReturn.history || []),
        {
          status: nextStatus,
          action: status === 'passed'
            ? `Ürünler depoya ulaştı ve kontrol başarılı geçti (${adminEmail}). Para iadesi aşamasına geçildi.`
            : status === 'partial'
            ? `Ürünler depoda incelendi; kısmi onay verildi (${adminEmail}). Para iadesi aşamasına geçildi.`
            : `Ürünler depoda incelendi; iade reddedildi (${adminEmail}). Gerekçe: ${notes || 'Kullanılmış/hasarlı ürün'}`,
          actor: 'admin',
          actorEmail: adminEmail,
          timestamp: nowIso,
          note: notes,
        },
      ],
    }

    returnRequests[targetIdx] = updatedReturn

    await db.runTransaction(async (transaction) => {
      const subDocRef = orderRef.collection('returnRequests').doc(returnId)
      transaction.set(subDocRef, cleanFirestoreData(updatedReturn), { merge: true })

      transaction.update(orderRef, cleanFirestoreData({
        returnRequests: cleanFirestoreData(returnRequests),
        lastReturnStatus: nextStatus,
        updatedAt: nowIso,
      }))
    })

    return NextResponse.json({
      success: true,
      message: 'Ürün kontrol kaydı başarıyla işlendi.',
      returnRequest: updatedReturn,
    })
  } catch (err: any) {
    console.error('Ürün kontrol kaydı hatası:', err)
    return NextResponse.json(
      { success: false, error: err?.message || 'Kontrol kaydı işlenirken bir hata oluştu.' },
      { status: 500 }
    )
  }
}

