'use server'

import { createAdminClient } from '@/lib/supabase/admin'

/** 토스 결제 승인 API URL */
const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm'

/** 시크릿 키 Basic 인증 헤더 생성 */
function makeTossAuthHeader(): string {
  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    throw new Error('TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다.')
  }
  return 'Basic ' + Buffer.from(`${secretKey}:`).toString('base64')
}

/**
 * 토스 결제 승인
 * - /api/tournaments/[id]/payment/success Route Handler에서 호출
 * - paymentKey, orderId, amount 검증 후 토스 승인 API 호출
 */
export async function confirmPayment(params: {
  paymentKey: string
  orderId: string   // "toss-{entryId}" 형식
  amount: number
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { paymentKey, orderId, amount } = params

    // orderId에서 entryId 파싱
    if (!orderId.startsWith('toss-')) {
      return { success: false, error: '유효하지 않은 주문번호입니다.' }
    }
    const entryId = orderId.replace('toss-', '')

    const admin = createAdminClient()

    // entry + tournament + division 조회
    const { data: entry, error: entryError } = await admin
      .from('tournament_entries')
      .select('id, tournament_id, division_id, payment_status, created_at, status, tournaments!inner(entry_fee)')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      return { success: false, error: '참가 신청 정보를 찾을 수 없습니다.' }
    }

    // 이미 결제 완료 — 멱등성 보장
    if (entry.payment_status === 'COMPLETED') {
      return { success: true }
    }

    // 금액 검증 (클라이언트 조작 방지)
    const tournament = entry.tournaments as unknown as { entry_fee: number }
    if (amount !== tournament.entry_fee) {
      return { success: false, error: '결제 금액이 참가비와 일치하지 않습니다.' }
    }

    // 토스 승인 API 호출
    const tossRes = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: makeTossAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    })

    if (!tossRes.ok) {
      const errorBody = await tossRes.json().catch(() => ({}))
      const message = (errorBody as { message?: string }).message ?? '결제 승인 실패'
      return { success: false, error: message }
    }

    const tossData = await tossRes.json() as { status: string }
    if (tossData.status !== 'DONE') {
      return { success: false, error: `예상치 못한 결제 상태: ${tossData.status}` }
    }

    // DB 업데이트
    const { error: updateError } = await admin
      .from('tournament_entries')
      .update({
        payment_status: 'COMPLETED',
        payment_key: paymentKey,
        toss_order_id: orderId,
        payment_confirmed_at: new Date().toISOString(),
      })
      .eq('id', entryId)

    if (updateError) {
      return { success: false, error: '결제 정보 저장 실패: ' + updateError.message }
    }

    // 결제 완료 후 자동 승인: 신청 순서가 max_teams 이내이면 CONFIRMED
    await autoConfirmIfWithinLimit(admin, entry)

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '결제 승인 중 오류 발생'
    return { success: false, error: message }
  }
}

/**
 * 결제 완료 후 신청 순서(created_at 기준)가 division max_teams 이내이면 CONFIRMED로 자동 승인
 */
async function autoConfirmIfWithinLimit(
  admin: ReturnType<typeof createAdminClient>,
  entry: {
    id: string
    division_id: string
    created_at: string
    status: string
  }
) {
  // 이미 CONFIRMED 상태면 건너뜀
  if (entry.status === 'CONFIRMED') return

  // division의 max_teams 조회
  const { data: division } = await admin
    .from('tournament_divisions')
    .select('max_teams')
    .eq('id', entry.division_id)
    .single()

  if (!division?.max_teams) return  // 정원 제한 없으면 CONFIRMED 처리

  // 신청 순서: 비취소 엔트리 중 created_at이 이 엔트리보다 앞선 것의 수 + 1
  const { count } = await admin
    .from('tournament_entries')
    .select('*', { count: 'exact', head: true })
    .eq('division_id', entry.division_id)
    .neq('status', 'CANCELLED')
    .lte('created_at', entry.created_at)

  const rank = count ?? 1
  if (rank <= division.max_teams) {
    await admin
      .from('tournament_entries')
      .update({ status: 'CONFIRMED' })
      .eq('id', entry.id)
  }
}

/**
 * 토스 결제 취소 (참가 취소 시 호출)
 * - payment_status가 COMPLETED인 경우에만 실제 취소 API 호출
 */
export async function cancelTossPayment(
  entryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const admin = createAdminClient()

    // entry 조회 (payment_key 포함)
    const { data: entry, error: entryError } = await admin
      .from('tournament_entries')
      .select('id, payment_status, payment_key')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      return { success: false, error: '참가 신청 정보를 찾을 수 없습니다.' }
    }

    // 결제 완료 상태가 아니면 취소 불필요
    if (entry.payment_status !== 'COMPLETED') {
      return { success: true }
    }

    const storedPaymentKey = (entry as unknown as { payment_key?: string | null }).payment_key
    if (!storedPaymentKey) {
      // payment_key 없으면 DB 상태만 CANCELLED로 변경
      await admin
        .from('tournament_entries')
        .update({ payment_status: 'CANCELLED' })
        .eq('id', entryId)
      return { success: true }
    }

    // 토스 취소 API 호출
    const tossRes = await fetch(
      `https://api.tosspayments.com/v1/payments/${storedPaymentKey}/cancel`,
      {
        method: 'POST',
        headers: {
          Authorization: makeTossAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cancelReason: '참가 신청 취소' }),
      }
    )

    if (!tossRes.ok) {
      const errorBody = await tossRes.json().catch(() => ({}))
      const message = (errorBody as { message?: string }).message ?? '결제 취소 실패'
      return { success: false, error: message }
    }

    // DB payment_status 업데이트
    const { error: updateError } = await admin
      .from('tournament_entries')
      .update({ payment_status: 'CANCELLED' })
      .eq('id', entryId)

    if (updateError) {
      return { success: false, error: '결제 취소 상태 저장 실패: ' + updateError.message }
    }

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : '결제 취소 중 오류 발생'
    return { success: false, error: message }
  }
}
