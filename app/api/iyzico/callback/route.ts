import { NextRequest, NextResponse } from 'next/server'
import { retrieveIyzicoCheckoutForm } from '@/lib/iyzico'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { processOrderAutoDispatchAndPrint } from '@/lib/hepsijet/autoDispatch'

function normalizeCurrency(val?: string): string {
  const c = (val || '').trim().toUpperCase()
  return c === 'TL' ? 'TRY' : c || 'TRY'
}

export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'

  try {
    const formData = await req.formData()
    const token = formData.get('token')?.toString()?.trim() || ''

    if (!token) {
      console.warn('❌ iyzico Callback: Eksik token.')
      return NextResponse.redirect(`${protocol}://${host}/satin-al?odeme=hata&reason=missing_token`, 303)
    }

    // 1. iyzico Resmi API üzerinden Ödeme Durumunu Sorgula (Checkout Form Detail)
    const result = await retrieveIyzicoCheckoutForm({ token })

    if (result.status !== 'success') {
      console.error('❌ iyzico Callback Doğrulama Başarısız:', {
        token,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      })
      const fallbackOid = result.basketId || ''
      return NextResponse.redirect(
        `${protocol}://${host}/satin-al?odeme=hata${fallbackOid ? `&oid=${fallbackOid}` : ''}`,
        303
      )
    }

    const orderNumber = result.basketId || result.conversationId || ''
    const db = getAdminFirestore()

    // 2. Siparişi Bul (basketId veya iyzicoToken üzerinden)
    let orderRef = orderNumber ? db.collection('orders').doc(orderNumber) : null
    if (!orderRef) {
      const snap = await db.collection('orders').where('iyzicoToken', '==', token).limit(1).get()
      if (!snap.empty) {
        orderRef = snap.docs[0].ref
      }
    }

    if (!orderRef) {
      console.error('🚨 iyzico Callback: Sipariş bulunamadı.', { token, orderNumber })
      return NextResponse.redirect(`${protocol}://${host}/satin-al?odeme=hata&reason=order_not_found`, 303)
    }

    const targetOrderNumber = orderRef.id

    // 3. Firestore Transaction ile Atomik & İdempotent Güncelleme
    const transactionResult = await db.runTransaction(async (transaction) => {
      const orderDoc = await transaction.get(orderRef!)
      if (!orderDoc.exists) {
        throw new Error(`ORDER_NOT_FOUND:${targetOrderNumber}`)
      }

      const orderData = orderDoc.data() || {}

      // A. Daha Önce Ödenmiş mi? (Duplicate Callback Koruması)
      if (orderData.paymentStatus === 'PAID') {
        return { action: 'already_paid' as const }
      }

      // B. iyzico Ödeme Başarılı mı?
      if (result.paymentStatus === 'SUCCESS') {
        const expectedTotal = Number(orderData.total || 0)
        const paidPrice = Number(result.paidPrice || 0)

        // Tutar Doğrulaması (Kuruş hassasiyeti)
        if (Math.abs(expectedTotal - paidPrice) > 0.05) {
          console.error('🚨 iyzico Callback: Tutar Uyuşmazlığı!', {
            orderNumber: targetOrderNumber,
            expectedTotal,
            paidPrice,
          })

          const failedAt = new Date().toISOString()
          transaction.update(orderRef!, {
            paymentStatus: 'FAILED',
            status: 'failed',
            updatedAt: failedAt,
            iyzicoError: {
              reason: 'AMOUNT_MISMATCH',
              expectedTotal,
              paidPrice,
              paymentId: result.paymentId,
              failedAt,
            },
          })

          return { action: 'amount_mismatch' as const }
        }

        // Para Birimi Doğrulaması
        const orderCurrency = normalizeCurrency(orderData.currency)
        const iyzicoCurrency = normalizeCurrency(result.currency)
        if (orderCurrency !== iyzicoCurrency) {
          console.error('🚨 iyzico Callback: Para Birimi Uyuşmazlığı!', {
            orderCurrency,
            iyzicoCurrency,
          })
          return { action: 'currency_mismatch' as const }
        }

        // Başarılı Ödeme Güncellemesi
        const paidAt = new Date().toISOString()
        transaction.update(orderRef!, {
          paymentStatus: 'PAID',
          status: 'processing',
          paidAt,
          updatedAt: paidAt,
          iyzico: {
            paymentId: result.paymentId,
            token,
            paidPrice,
            price: Number(result.price || 0),
            currency: result.currency || 'TRY',
            installment: result.installment || 1,
            cardType: result.cardType || null,
            cardAssociation: result.cardAssociation || null,
            cardFamily: result.cardFamily || null,
            binNumber: result.binNumber || null,
            lastFourDigits: result.lastFourDigits || null,
            fraudStatus: result.fraudStatus || 1,
            paidAt,
          },
        })

        return { action: 'paid' as const }
      }

      // C. iyzico Ödeme Başarısız
      if (orderData.paymentStatus === 'FAILED') {
        return { action: 'already_failed' as const }
      }

      const failedAt = new Date().toISOString()
      transaction.update(orderRef!, {
        paymentStatus: 'FAILED',
        status: 'failed',
        updatedAt: failedAt,
        iyzicoError: {
          token,
          paymentStatus: result.paymentStatus,
          errorMessage: result.errorMessage || 'Ödeme iyzico tarafından onaylanmadı.',
          errorCode: result.errorCode || 'UNKNOWN',
          failedAt,
        },
      })

      return { action: 'failed' as const }
    })

    // 4. Sonuca Göre Güvenli Yönlendirme (app/satin-al/page.tsx ile tam uyumlu)
    if (transactionResult.action === 'paid' || transactionResult.action === 'already_paid') {
      console.log(`✅ iyzico Callback: ${targetOrderNumber} başarıyla PAID olarak teyit edildi.`)

      // Anlık Otomatik HepsiJET Gönderisi Oluştur ve Yazdırma Kuyruğuna Ekle
      try {
        await processOrderAutoDispatchAndPrint(targetOrderNumber, { triggeredBy: 'iyzico_callback' })
      } catch (autoErr: any) {
        console.error('iyzico callback auto-dispatch error:', autoErr?.message || autoErr)
      }

      return NextResponse.redirect(`${protocol}://${host}/satin-al?odeme=basarili&oid=${targetOrderNumber}`, 303)
    }

    console.warn(`⚠️ iyzico Callback: ${targetOrderNumber} ödeme başarısız (${transactionResult.action}).`)
    return NextResponse.redirect(`${protocol}://${host}/satin-al?odeme=hata&oid=${targetOrderNumber}`, 303)
  } catch (error: any) {
    console.error('Iyzico Callback Exception:', error)
    return NextResponse.redirect(`${protocol}://${host}/satin-al?odeme=hata`, 303)
  }
}

/**
 * GET callback tek başına asla ödeme başarısı oluşturamaz.
 * Doğrudan erişimler veya sayfa yenilemeleri güvenli şekilde hata sayfasına yönlendirilir.
 */
export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'

  return NextResponse.redirect(`${protocol}://${host}/satin-al?odeme=hata&reason=invalid_callback_method`, 303)
}
