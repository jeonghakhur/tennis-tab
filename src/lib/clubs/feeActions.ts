'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'

/** 연회비 연도 허용 범위 (DB CHECK와 동일) */
const MIN_FEE_YEAR = 2000
const MAX_FEE_YEAR = 2100

/** PostgREST: 테이블이 스키마 캐시에 없음 (마이그레이션 미적용) */
const PGRST_TABLE_NOT_FOUND = 'PGRST205'

/** DB 에러 코드 → 관리자에게 보여줄 메시지 (마이그레이션 미적용은 명시적으로 안내) */
function toFeeErrorMessage(code: string | undefined, fallback: string): string {
  if (code === PGRST_TABLE_NOT_FOUND) {
    return '연회비 테이블이 없습니다. 마이그레이션(58_club_fee_payments.sql)을 먼저 적용해주세요.'
  }
  return fallback
}

/**
 * 클럽 협회 연회비 납부 여부 설정 (시스템 ADMIN 이상 전용)
 * - paid=true  → (club_id, year) 행 upsert (납부 시각·처리자 기록)
 * - paid=false → 해당 연도 행 삭제
 */
export async function setClubFeePaid(
  clubId: string,
  year: number,
  paid: boolean
): Promise<{ error?: string; paidAt?: string | null }> {
  const user = await getCurrentUser()
  if (!user || !hasMinimumRole(user.role, 'ADMIN')) {
    return { error: '협회 관리자만 납부 여부를 변경할 수 있습니다.' }
  }

  if (!Number.isInteger(year) || year < MIN_FEE_YEAR || year > MAX_FEE_YEAR) {
    return { error: '유효하지 않은 연도입니다.' }
  }

  const admin = createAdminClient()

  if (paid) {
    const paidAt = new Date().toISOString()
    const { error } = await admin
      .from('club_fee_payments')
      .upsert(
        { club_id: clubId, year, paid_at: paidAt, recorded_by: user.id },
        { onConflict: 'club_id,year' }
      )
    if (error) return { error: toFeeErrorMessage(error.code, '납부 처리에 실패했습니다.') }

    revalidatePath('/admin/clubs')
    revalidatePath(`/admin/clubs/${clubId}`)
    return { paidAt }
  }

  const { error } = await admin
    .from('club_fee_payments')
    .delete()
    .eq('club_id', clubId)
    .eq('year', year)
  if (error) return { error: toFeeErrorMessage(error.code, '납부 취소에 실패했습니다.') }

  revalidatePath('/admin/clubs')
  revalidatePath(`/admin/clubs/${clubId}`)
  return { paidAt: null }
}
