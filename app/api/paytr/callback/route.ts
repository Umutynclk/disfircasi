import { NextRequest, NextResponse } from 'next/server'
import {
  verifyPayTRCallbackHash,
  PayTRCallbackData,
} from '@/lib/paytr'
import { getAdminFirestore } from '@/lib/firebase/admin'
import { processOrderAutoDispatchAndPrint } from '@/lib/hepsijet/autoDispatch'

function plainOkResponse() {
  return new NextResponse('OK', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

function errorResponse(
  message: string,
  status = 400,
) {
  return new NextResponse(message, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

function isValidMerchantOid(
  value: string,
): boolean {
  return /^[A-Za-z0-9]{1,64}$/.test(value)
}

function isValidKurus(
  value: string,
): boolean {
  return /^\d+$/.test(value)
}

function normalizeCurrency(
  value: string,
): string {
  const currency = value
    .trim()
    .toUpperCase()

  if (currency === 'TRY') {
    return 'TL'
  }

  return currency
}

export async function POST(
  req: NextRequest,
) {
  try {
    // --------------------------------------------------
    // 1. PAYTR CALLBACK FORM DATA
    // --------------------------------------------------

    const formData = await req.formData()

    const merchant_oid =
      formData
        .get('merchant_oid')
        ?.toString()
        .trim() || ''

    const statusRaw =
      formData
        .get('status')
        ?.toString()
        .trim() || ''

    const total_amount =
      formData
        .get('total_amount')
        ?.toString()
        .trim() || ''

    const hash =
      formData
        .get('hash')
        ?.toString()
        .trim() || ''

    const failed_reason_code =
      formData
        .get('failed_reason_code')
        ?.toString()
        .trim() || ''

    const failed_reason_msg =
      formData
        .get('failed_reason_msg')
        ?.toString()
        .trim() || ''

    const payment_type =
      formData
        .get('payment_type')
        ?.toString()
        .trim() || ''

    const payment_amount =
      formData
        .get('payment_amount')
        ?.toString()
        .trim() || ''

    const currency =
      formData
        .get('currency')
        ?.toString()
        .trim() || ''

    const test_mode =
      formData
        .get('test_mode')
        ?.toString()
        .trim() || ''

    // --------------------------------------------------
    // 2. BASIC VALIDATION
    // --------------------------------------------------

    if (
      !merchant_oid ||
      !statusRaw ||
      !total_amount ||
      !hash
    ) {
      console.warn(
        '❌ PayTR Callback: Eksik parametre.',
        {
          merchant_oid,
          status: statusRaw,
        },
      )

      return errorResponse(
        'PAYTR notification failed: missing parameters',
        400,
      )
    }

    if (
      !isValidMerchantOid(
        merchant_oid,
      )
    ) {
      console.warn(
        '❌ PayTR Callback: Geçersiz merchant_oid.',
        {
          merchant_oid,
        },
      )

      return errorResponse(
        'PAYTR notification failed: invalid merchant_oid',
        400,
      )
    }

    if (
      statusRaw !== 'success' &&
      statusRaw !== 'failed'
    ) {
      console.warn(
        '❌ PayTR Callback: Geçersiz status.',
        {
          merchant_oid,
          status: statusRaw,
        },
      )

      return errorResponse(
        'PAYTR notification failed: invalid status',
        400,
      )
    }

    if (
      !isValidKurus(
        total_amount,
      )
    ) {
      console.warn(
        '❌ PayTR Callback: Geçersiz total_amount.',
        {
          merchant_oid,
          total_amount,
        },
      )

      return errorResponse(
        'PAYTR notification failed: invalid total_amount',
        400,
      )
    }

    const totalAmountKurus =
      Number(total_amount)

    if (
      !Number.isSafeInteger(
        totalAmountKurus,
      ) ||
      totalAmountKurus <= 0
    ) {
      return errorResponse(
        'PAYTR notification failed: invalid total_amount',
        400,
      )
    }

    // --------------------------------------------------
    // 3. CALLBACK DATA
    // --------------------------------------------------

    const status =
      statusRaw as
      | 'success'
      | 'failed'

    const callbackData: PayTRCallbackData =
    {
      merchant_oid,
      status,
      total_amount,
      hash,
      failed_reason_code:
        failed_reason_code ||
        undefined,
      failed_reason_msg:
        failed_reason_msg ||
        undefined,
      payment_type:
        payment_type ||
        undefined,
      payment_amount:
        payment_amount ||
        undefined,
      currency:
        currency ||
        undefined,
      test_mode:
        test_mode ||
        undefined,
    }

    // --------------------------------------------------
    // 4. HMAC HASH VALIDATION
    // --------------------------------------------------

    const isHashValid =
      verifyPayTRCallbackHash(
        callbackData,
      )

    if (!isHashValid) {
      console.error(
        '❌ PayTR Callback: GEÇERSİZ HASH. Sipariş güncellenmedi.',
        {
          merchant_oid,
        },
      )

      return errorResponse(
        'PAYTR notification failed: bad hash',
        400,
      )
    }

    console.log(
      `🔐 PayTR Callback Hash doğrulandı: OID=${merchant_oid}, STATUS=${status}, TOTAL=${total_amount}`,
    )

    // --------------------------------------------------
    // 5. FIRESTORE
    // --------------------------------------------------

    const db =
      getAdminFirestore()

    const orderRef =
      db
        .collection('orders')
        .doc(merchant_oid)

    // --------------------------------------------------
    // 6. FIRESTORE TRANSACTION
    // --------------------------------------------------

    const transactionResult =
      await db.runTransaction(
        async (transaction) => {
          const orderDoc =
            await transaction.get(
              orderRef,
            )

          // Sipariş bulunamadıysa OK dönmüyoruz.
          // PayTR tekrar callback gönderebilir.
          if (!orderDoc.exists) {
            throw new Error(
              `PAYTR_ORDER_NOT_FOUND:${merchant_oid}`,
            )
          }

          const orderData =
            orderDoc.data() || {}

          // ------------------------------------------------
          // EXISTING PAID ORDER
          // ------------------------------------------------

          if (
            orderData.paymentStatus ===
            'PAID'
          ) {
            return {
              action: 'already_paid' as const,
            }
          }

          // ------------------------------------------------
          // EXPECTED PAYMENT AMOUNT
          // ------------------------------------------------
          //
          // Yeni siparişlerde:
          // paymentAmountKurus
          //
          // Eski siparişlerde fallback:
          // total * 100
          //

          let expectedAmountKurus =
            Number(
              orderData.paymentAmountKurus,
            )

          if (
            !Number.isSafeInteger(
              expectedAmountKurus,
            ) ||
            expectedAmountKurus <= 0
          ) {
            const legacyTotal =
              Number(
                orderData.total,
              )

            if (
              !Number.isFinite(
                legacyTotal,
              ) ||
              legacyTotal <= 0
            ) {
              throw new Error(
                `PAYTR_INVALID_ORDER_AMOUNT:${merchant_oid}`,
              )
            }

            expectedAmountKurus =
              Math.round(
                legacyTotal * 100,
              )
          }

          // ------------------------------------------------
          // SUCCESS PAYMENT VALIDATION
          // ------------------------------------------------

          if (status === 'success') {
            // PayTR Step 2 callback'inde
            // payment_amount beklenen Step 1
            // ödeme tutarıdır.
            if (!payment_amount) {
              throw new Error(
                `PAYTR_MISSING_PAYMENT_AMOUNT:${merchant_oid}`,
              )
            }

            if (
              !isValidKurus(
                payment_amount,
              )
            ) {
              throw new Error(
                `PAYTR_INVALID_PAYMENT_AMOUNT:${merchant_oid}`,
              )
            }

            const paymentAmountKurus =
              Number(
                payment_amount,
              )

            if (
              !Number.isSafeInteger(
                paymentAmountKurus,
              ) ||
              paymentAmountKurus <= 0
            ) {
              throw new Error(
                `PAYTR_INVALID_PAYMENT_AMOUNT:${merchant_oid}`,
              )
            }

            // ------------------------------------------------
            // EXACT STEP-1 AMOUNT MATCH
            // ------------------------------------------------

            if (
              paymentAmountKurus !==
              expectedAmountKurus
            ) {
              console.error(
                '🚨 PayTR Callback: ÖDEME TUTARI EŞLEŞMEDİ!',
                {
                  merchant_oid,
                  expectedAmountKurus,
                  receivedPaymentAmountKurus:
                    paymentAmountKurus,
                  receivedTotalAmountKurus:
                    totalAmountKurus,
                },
              )

              throw new Error(
                `PAYTR_PAYMENT_AMOUNT_MISMATCH:${merchant_oid}`,
              )
            }

            // ------------------------------------------------
            // TOTAL AMOUNT VALIDATION
            // ------------------------------------------------
            //
            // PayTR dokümantasyonuna göre total_amount,
            // taksit / alternatif ödeme yöntemlerinde
            // payment_amount'dan daha yüksek olabilir.
            //
            // Bu nedenle:
            //
            // total_amount >= payment_amount
            //
            // kontrolü yapıyoruz.
            //

            if (
              totalAmountKurus <
              expectedAmountKurus
            ) {
              console.error(
                '🚨 PayTR Callback: total_amount beklenen tutardan düşük!',
                {
                  merchant_oid,
                  expectedAmountKurus,
                  totalAmountKurus,
                },
              )

              throw new Error(
                `PAYTR_TOTAL_AMOUNT_TOO_LOW:${merchant_oid}`,
              )
            }

            // ------------------------------------------------
            // CURRENCY VALIDATION
            // ------------------------------------------------

            const orderCurrency =
              normalizeCurrency(
                String(
                  orderData.currency ||
                  'TRY',
                ),
              )

            if (
              currency &&
              normalizeCurrency(
                currency,
              ) !== orderCurrency
            ) {
              console.error(
                '🚨 PayTR Callback: Para birimi uyuşmuyor!',
                {
                  merchant_oid,
                  orderCurrency,
                  callbackCurrency:
                    currency,
                },
              )

              throw new Error(
                `PAYTR_CURRENCY_MISMATCH:${merchant_oid}`,
              )
            }

            const paidAt =
              new Date().toISOString()

            // ------------------------------------------------
            // MARK PAID
            // ------------------------------------------------

            transaction.update(
              orderRef,
              {
                paymentStatus:
                  'PAID',

                status:
                  'processing',

                paidAt,

                updatedAt:
                  paidAt,

                paytr: {
                  merchant_oid,

                  payment_amount:
                    paymentAmountKurus,

                  total_amount:
                    totalAmountKurus,

                  expected_amount:
                    expectedAmountKurus,

                  payment_type:
                    payment_type ||
                    'card',

                  currency:
                    currency ||
                    'TL',

                  test_mode:
                    test_mode === '1',

                  paidAt,
                },
              },
            )

            return {
              action: 'paid' as const,
            }
          }

          // ------------------------------------------------
          // FAILED PAYMENT
          // ------------------------------------------------

          // Daha önce FAILED callback geldiyse
          // aynı callback'in tekrar işlenmesine gerek yok.
          if (
            orderData.paymentStatus ===
            'FAILED'
          ) {
            return {
              action: 'already_failed' as const,
            }
          }

          const failedAt =
            new Date().toISOString()

          transaction.update(
            orderRef,
            {
              paymentStatus:
                'FAILED',

              status:
                'failed',

              updatedAt:
                failedAt,

              paytrError: {
                merchant_oid,

                failed_reason_code:
                  failed_reason_code ||
                  'UNKNOWN',

                failed_reason_msg:
                  failed_reason_msg ||
                  'Ödeme başarısız oldu.',

                total_amount:
                  totalAmountKurus,

                payment_amount:
                  payment_amount
                    ? Number(
                      payment_amount,
                    )
                    : null,

                payment_type:
                  payment_type ||
                  null,

                currency:
                  currency ||
                  null,

                test_mode:
                  test_mode === '1',

                failedAt,
              },
            },
          )

          return {
            action: 'failed' as const,
          }
        },
      )

    // --------------------------------------------------
    // 7. RESULT LOGGING
    // --------------------------------------------------

    if (
      transactionResult.action ===
      'already_paid'
    ) {
      console.log(
        `ℹ️ PayTR Callback: ${merchant_oid} zaten PAID. Duplicate callback OK.`,
      )

      return plainOkResponse()
    }

    if (
      transactionResult.action ===
      'already_failed'
    ) {
      console.log(
        `ℹ️ PayTR Callback: ${merchant_oid} zaten FAILED. Duplicate callback OK.`,
      )

      return plainOkResponse()
    }

    if (
      transactionResult.action ===
      'paid'
    ) {
      console.log(
        `✅ PayTR Callback: ${merchant_oid} PAID olarak kaydedildi.`,
      )

      // Anlık Otomatik HepsiJET Gönderisi Oluştur ve Yazdırma Kuyruğuna Ekle
      try {
        await processOrderAutoDispatchAndPrint(merchant_oid, { triggeredBy: 'paytr_callback' })
      } catch (autoErr: any) {
        console.error('PayTR auto-dispatch error:', autoErr?.message || autoErr)
      }

      return plainOkResponse()
    }

    console.warn(
      `⚠️ PayTR Callback: ${merchant_oid} FAILED olarak kaydedildi.`,
    )

    return plainOkResponse()
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : String(error)

    // --------------------------------------------------
    // ORDER NOT FOUND
    // --------------------------------------------------

    if (
      message.startsWith(
        'PAYTR_ORDER_NOT_FOUND:',
      )
    ) {
      console.error(
        '🚨 PayTR Callback: Sipariş bulunamadı. OK DÖNÜLMÜYOR; PayTR yeniden deneyecek.',
        message,
      )

      return errorResponse(
        'PAYTR notification failed: order not found',
        500,
      )
    }

    // --------------------------------------------------
    // AMOUNT / CURRENCY / CALLBACK VALIDATION
    // --------------------------------------------------

    if (
      message.startsWith(
        'PAYTR_',
      )
    ) {
      console.error(
        '🚨 PayTR Callback doğrulama hatası:',
        message,
      )

      return errorResponse(
        'PAYTR notification failed: validation error',
        400,
      )
    }

    // --------------------------------------------------
    // UNEXPECTED SERVER ERROR
    // --------------------------------------------------

    console.error(
      '❌ PayTR Callback Handler Hatası:',
      error,
    )

    // 500 dönüyoruz ki PayTR tekrar deneyebilsin.
    return errorResponse(
      'PAYTR notification handler error',
      500,
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'active',
    service:
      'PayTR Callback Webhook Endpoint',
    method:
      'POST only (application/x-www-form-urlencoded)',
  })
}