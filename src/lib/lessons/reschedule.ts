'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeObject } from '@/lib/utils/validation'
import type { RescheduleRequest, RescheduleRequestInput } from './types'

// ============================================================================
// 검증 헬퍼
// ============================================================================

function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

/** 세션의 클럽 ID 조회 */
async function getClubIdFromSession(admin: ReturnType<typeof createAdminClient>, sessionId: string) {
  const { data: session } = await admin
    .from('lesson_sessions')
    .select('program_id, lesson_programs(club_id)')
    .eq('id', sessionId)
    .single()

  if (!session) return null
  return (session as unknown as { lesson_programs: { club_id: string } }).lesson_programs.club_id
}

// ============================================================================
// 일정 변경 요청
// ============================================================================

/** 일정 변경 요청 생성 */
export async function requestReschedule(
  sessionId: string,
  data: RescheduleRequestInput
): Promise<{ error: string | null }> {
  const idErr = validateId(sessionId, '세션 ID')
  if (idErr) return { error: idErr }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  if (!data.requested_date || !data.requested_start_time || !data.requested_end_time) {
    return { error: '변경할 날짜와 시간을 모두 입력해주세요.' }
  }

  const admin = createAdminClient()

  // 원본 세션 조회
  const { data: session } = await admin
    .from('lesson_sessions')
    .select('session_date, start_time, end_time, program_id, lesson_programs(club_id)')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '세션을 찾을 수 없습니다.' }

  const clubId = (session as unknown as { lesson_programs: { club_id: string } }).lesson_programs.club_id

  // 요청자 유형 판별 (어드민 or 회원)
  const { data: adminMember } = await admin
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  const isClubAdmin = adminMember && ['OWNER', 'ADMIN'].includes(adminMember.role)
  const requesterType = isClubAdmin ? 'ADMIN' : 'MEMBER'

  const sanitized = sanitizeObject(data)

  const { error } = await admin
    .from('lesson_reschedule_requests')
    .insert({
      session_id: sessionId,
      enrollment_id: sanitized.enrollment_id || null,
      requested_by: user.id,
      requester_type: requesterType,
      original_date: session.session_date,
      original_start_time: session.start_time,
      original_end_time: session.end_time,
      requested_date: sanitized.requested_date,
      requested_start_time: sanitized.requested_start_time,
      requested_end_time: sanitized.requested_end_time,
      reason: sanitized.reason || null,
    })

  if (error) return { error: '일정 변경 요청에 실패했습니다.' }

  revalidatePath(`/clubs/${clubId}`)
  return { error: null }
}

/** 일정 변경 수락 */
export async function approveReschedule(
  requestId: string
): Promise<{ error: string | null }> {
  const idErr = validateId(requestId, '요청 ID')
  if (idErr) return { error: idErr }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: request } = await admin
    .from('lesson_reschedule_requests')
    .select('*, session:lesson_sessions(id, program_id)')
    .eq('id', requestId)
    .eq('status', 'PENDING')
    .single()

  if (!request) return { error: '대기 중인 요청을 찾을 수 없습니다.' }

  const sessionData = request.session as unknown as { id: string; program_id: string }
  const clubId = await getClubIdFromSession(admin, sessionData.id)
  if (!clubId) return { error: '세션을 찾을 수 없습니다.' }

  // 어드민 권한 확인
  const { data: adminMember } = await admin
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!adminMember || !['OWNER', 'ADMIN'].includes(adminMember.role)) {
    return { error: '클럽 관리 권한이 없습니다.' }
  }

  // 요청 승인
  const { error: updateErr } = await admin
    .from('lesson_reschedule_requests')
    .update({
      status: 'APPROVED',
      responded_by: user.id,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (updateErr) return { error: '요청 수락에 실패했습니다.' }

  // 세션 일정 반영
  const { error: sessionErr } = await admin
    .from('lesson_sessions')
    .update({
      session_date: request.requested_date,
      start_time: request.requested_start_time,
      end_time: request.requested_end_time,
    })
    .eq('id', sessionData.id)

  if (sessionErr) return { error: '세션 일정 변경에 실패했습니다.' }

  revalidatePath(`/clubs/${clubId}`)
  return { error: null }
}

/** 일정 변경 거절 */
export async function rejectReschedule(
  requestId: string
): Promise<{ error: string | null }> {
  const idErr = validateId(requestId, '요청 ID')
  if (idErr) return { error: idErr }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: request } = await admin
    .from('lesson_reschedule_requests')
    .select('session_id')
    .eq('id', requestId)
    .eq('status', 'PENDING')
    .single()

  if (!request) return { error: '대기 중인 요청을 찾을 수 없습니다.' }

  const clubId = await getClubIdFromSession(admin, request.session_id)
  if (!clubId) return { error: '세션을 찾을 수 없습니다.' }

  // 어드민 권한 확인
  const { data: adminMember } = await admin
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!adminMember || !['OWNER', 'ADMIN'].includes(adminMember.role)) {
    return { error: '클럽 관리 권한이 없습니다.' }
  }

  const { error } = await admin
    .from('lesson_reschedule_requests')
    .update({
      status: 'REJECTED',
      responded_by: user.id,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) return { error: '요청 거절에 실패했습니다.' }

  revalidatePath(`/clubs/${clubId}`)
  return { error: null }
}

/** 월별 세션 횟수 재계산 */
export async function recalculateMonthlyCount(
  enrollmentId: string
): Promise<{ error: string | null }> {
  const idErr = validateId(enrollmentId, '신청 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  // 해당 수강의 모든 출석 기록 조회 (PRESENT + LATE)
  const { data: attendances, error: attendErr } = await admin
    .from('lesson_attendances')
    .select('session_id, status, session:lesson_sessions(session_date)')
    .eq('enrollment_id', enrollmentId)
    .in('status', ['PRESENT', 'LATE'])

  if (attendErr) return { error: '출석 기록 조회에 실패했습니다.' }

  // 월별 카운트 집계
  const monthlyCounts: Record<string, number> = {}
  for (const a of attendances || []) {
    const sessionData = a.session as unknown as { session_date: string }
    if (sessionData?.session_date) {
      // "2026-03-18" → "2026-03"
      const month = sessionData.session_date.substring(0, 7)
      monthlyCounts[month] = (monthlyCounts[month] || 0) + 1
    }
  }

  const { error } = await admin
    .from('lesson_enrollments')
    .update({ monthly_session_count: monthlyCounts })
    .eq('id', enrollmentId)

  if (error) return { error: '월별 횟수 업데이트에 실패했습니다.' }

  return { error: null }
}

/** 세션별 변경 요청 목록 조회 */
export async function getRescheduleRequests(
  sessionId: string
): Promise<{ error: string | null; data: RescheduleRequest[] }> {
  const idErr = validateId(sessionId, '세션 ID')
  if (idErr) return { error: idErr, data: [] }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('lesson_reschedule_requests')
    .select('*, requester:profiles!requested_by(name)')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) return { error: '변경 요청 조회에 실패했습니다.', data: [] }

  return { error: null, data: data || [] }
}
