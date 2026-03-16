'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeObject } from '@/lib/utils/validation'
import { createNotification } from '@/lib/notifications/actions'
import type { RescheduleRequest, RescheduleRequestInput } from './types'

function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

async function checkAdminAuth() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null }
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return { error: '관리자 권한이 필요합니다.', user: null }
  }
  return { error: null, user }
}

// ============================================================================
// 일정 변경 요청
// ============================================================================

/** 수강생이 일정 변경 요청 */
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
    .select('session_date, start_time, end_time, program_id')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '세션을 찾을 수 없습니다.' }

  // 수강생 본인 확인 (enrollment_id 제공 시)
  if (data.enrollment_id) {
    const { data: enrollment } = await admin
      .from('lesson_enrollments')
      .select('user_id')
      .eq('id', data.enrollment_id)
      .single()

    if (!enrollment) return { error: '수강 정보를 찾을 수 없습니다.' }
    if (enrollment.user_id !== user.id) return { error: '본인의 수강 일정만 변경 요청할 수 있습니다.' }
  }

  const sanitized = sanitizeObject(data)

  const { error } = await admin
    .from('lesson_reschedule_requests')
    .insert({
      session_id: sessionId,
      enrollment_id: sanitized.enrollment_id || null,
      requested_by: user.id,
      requester_type: 'MEMBER',
      original_date: session.session_date,
      original_start_time: session.start_time,
      original_end_time: session.end_time,
      requested_date: sanitized.requested_date,
      requested_start_time: sanitized.requested_start_time,
      requested_end_time: sanitized.requested_end_time,
      reason: sanitized.reason || null,
    })

  if (error) return { error: '일정 변경 요청에 실패했습니다.' }

  // SUPER_ADMIN/ADMIN에게 알림
  try {
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['SUPER_ADMIN', 'ADMIN'])

    if (admins) {
      for (const adm of admins) {
        await createNotification({
          user_id: adm.id,
          type: 'LESSON_INQUIRY',
          title: '레슨 일정 변경 요청',
          message: `수강생이 ${session.session_date} 세션 일정 변경을 요청했습니다.`,
          metadata: { session_id: sessionId },
        })
      }
    }
  } catch {
    // 알림 실패 무시
  }

  revalidatePath('/my/lessons')
  return { error: null }
}

/** 관리자가 일정 변경 요청 (코치 대리) */
export async function requestRescheduleByAdmin(
  sessionId: string,
  data: RescheduleRequestInput
): Promise<{ error: string | null }> {
  const idErr = validateId(sessionId, '세션 ID')
  if (idErr) return { error: idErr }

  const { error: authErr, user } = await checkAdminAuth()
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  if (!data.requested_date || !data.requested_start_time || !data.requested_end_time) {
    return { error: '변경할 날짜와 시간을 모두 입력해주세요.' }
  }

  const admin = createAdminClient()

  const { data: session } = await admin
    .from('lesson_sessions')
    .select('session_date, start_time, end_time')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '세션을 찾을 수 없습니다.' }

  const sanitized = sanitizeObject(data)

  const { error } = await admin
    .from('lesson_reschedule_requests')
    .insert({
      session_id: sessionId,
      enrollment_id: sanitized.enrollment_id || null,
      requested_by: user.id,
      requester_type: 'ADMIN',
      original_date: session.session_date,
      original_start_time: session.start_time,
      original_end_time: session.end_time,
      requested_date: sanitized.requested_date,
      requested_start_time: sanitized.requested_start_time,
      requested_end_time: sanitized.requested_end_time,
      reason: sanitized.reason || null,
    })

  if (error) return { error: '일정 변경 요청에 실패했습니다.' }

  // 해당 수강생에게 알림
  if (data.enrollment_id) {
    try {
      const { data: enrollment } = await admin
        .from('lesson_enrollments')
        .select('user_id')
        .eq('id', data.enrollment_id)
        .single()

      if (enrollment) {
        await createNotification({
          user_id: enrollment.user_id,
          type: 'LESSON_INQUIRY',
          title: '레슨 일정 변경 안내',
          message: `${session.session_date} 세션 일정이 변경될 예정입니다. 확인해주세요.`,
          metadata: { session_id: sessionId },
        })
      }
    } catch {
      // 알림 실패 무시
    }
  }

  revalidatePath('/lessons')
  return { error: null }
}

/** 일정 변경 수락 (관리자) */
export async function approveReschedule(
  requestId: string
): Promise<{ error: string | null }> {
  const idErr = validateId(requestId, '요청 ID')
  if (idErr) return { error: idErr }

  const { error: authErr, user } = await checkAdminAuth()
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  const admin = createAdminClient()

  const { data: request } = await admin
    .from('lesson_reschedule_requests')
    .select('*')
    .eq('id', requestId)
    .eq('status', 'PENDING')
    .single()

  if (!request) return { error: '대기 중인 요청을 찾을 수 없습니다.' }

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
    .eq('id', request.session_id)

  if (sessionErr) return { error: '세션 일정 변경에 실패했습니다.' }

  // 요청자에게 알림
  try {
    await createNotification({
      user_id: request.requested_by,
      type: 'LESSON_INQUIRY',
      title: '레슨 일정 변경 수락',
      message: `${request.requested_date} ${request.requested_start_time.slice(0, 5)} 일정 변경이 확정되었습니다.`,
      metadata: { request_id: requestId },
    })
  } catch {
    // 알림 실패 무시
  }

  revalidatePath('/lessons')
  revalidatePath('/my/lessons')
  return { error: null }
}

/** 일정 변경 거절 (관리자) */
export async function rejectReschedule(
  requestId: string
): Promise<{ error: string | null }> {
  const idErr = validateId(requestId, '요청 ID')
  if (idErr) return { error: idErr }

  const { error: authErr, user } = await checkAdminAuth()
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  const admin = createAdminClient()

  const { data: request } = await admin
    .from('lesson_reschedule_requests')
    .select('requested_by, original_date, original_start_time')
    .eq('id', requestId)
    .eq('status', 'PENDING')
    .single()

  if (!request) return { error: '대기 중인 요청을 찾을 수 없습니다.' }

  const { error } = await admin
    .from('lesson_reschedule_requests')
    .update({
      status: 'REJECTED',
      responded_by: user.id,
      responded_at: new Date().toISOString(),
    })
    .eq('id', requestId)

  if (error) return { error: '요청 거절에 실패했습니다.' }

  // 요청자에게 알림
  try {
    await createNotification({
      user_id: request.requested_by,
      type: 'LESSON_INQUIRY',
      title: '레슨 일정 변경 거절',
      message: `${request.original_date} 일정 변경 요청이 거절되었습니다. 원래 일정으로 진행됩니다.`,
      metadata: { request_id: requestId },
    })
  } catch {
    // 알림 실패 무시
  }

  revalidatePath('/lessons')
  revalidatePath('/my/lessons')
  return { error: null }
}

/** 월별 세션 횟수 재계산 */
export async function recalculateMonthlyCount(
  enrollmentId: string
): Promise<{ error: string | null }> {
  const idErr = validateId(enrollmentId, '신청 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  const { data: attendances, error: attendErr } = await admin
    .from('lesson_attendances')
    .select('session_id, status, session:lesson_sessions(session_date)')
    .eq('enrollment_id', enrollmentId)
    .in('status', ['PRESENT', 'LATE'])

  if (attendErr) return { error: '출석 기록 조회에 실패했습니다.' }

  const monthlyCounts: Record<string, number> = {}
  for (const a of attendances || []) {
    const sessionData = a.session as unknown as { session_date: string }
    if (sessionData?.session_date) {
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

export interface RescheduleRequestWithSession extends RescheduleRequest {
  session: { session_date: string; start_time: string; end_time: string } | null
}

/** 내 일정 변경 요청 목록 조회 (수강생) */
export async function getMyRescheduleRequests(): Promise<{
  error: string | null
  data: RescheduleRequestWithSession[]
}> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', data: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lesson_reschedule_requests')
    .select('*, session:lesson_sessions(session_date, start_time, end_time)')
    .eq('requested_by', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return { error: '변경 요청 조회에 실패했습니다.', data: [] }
  return { error: null, data: (data || []) as unknown as RescheduleRequestWithSession[] }
}
