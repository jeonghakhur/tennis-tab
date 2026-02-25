import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { confirmPayment } from '@/lib/payment/actions'

/**
 * 토스 결제 성공 콜백 Route Handler
 * - Page Component 렌더 중에는 revalidatePath 호출 불가
 * - Route Handler에서는 정상 호출 가능
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tournamentId } = await params
  const searchParams = request.nextUrl.searchParams

  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')

  const baseUrl = request.nextUrl.origin

  if (!paymentKey || !orderId || !amount) {
    return NextResponse.redirect(new URL(`/tournaments/${tournamentId}`, baseUrl))
  }

  const result = await confirmPayment({
    paymentKey,
    orderId,
    amount: Number(amount),
  })

  if (!result.success) {
    const message = encodeURIComponent(result.error ?? '결제 승인에 실패했습니다.')
    return NextResponse.redirect(
      new URL(`/tournaments/${tournamentId}/payment/fail?message=${message}`, baseUrl)
    )
  }

  revalidatePath(`/tournaments/${tournamentId}`)
  revalidatePath('/my/entries')

  return NextResponse.redirect(new URL(`/tournaments/${tournamentId}?paid=1`, baseUrl))
}
