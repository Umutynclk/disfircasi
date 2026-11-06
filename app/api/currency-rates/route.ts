import { NextRequest, NextResponse } from 'next/server'
import { fetchTCMBRates } from '@/lib/currency/tcmb'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const force = searchParams.get('force') === 'true'

    const tcmbData = await fetchTCMBRates(force)

    return NextResponse.json({
      success: true,
      data: tcmbData,
    })
  } catch (error: any) {
    console.error('API /currency-rates error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch TCMB currency rates',
      },
      { status: 500 }
    )
  }
}
