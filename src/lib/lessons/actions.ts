'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeObject, validateLessonInquiryInput, hasValidationErrors } from '@/lib/utils/validation'
import { createNotification } from '@/lib/notifications/actions'
import type {
  LessonProgram,
  LessonSession,
  LessonEnrollment,
  LessonAttendance,
  LessonProgramStatus,
  AttendanceLessonStatus,
  CreateProgramInput,
  UpdateProgramInput,
  CreateSessionInput,
} from './types'

// ============================================================================
// 검증 헬퍼
// ============================================================================

function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

/** 클럽 OWNER/ADMIN 권한 확인 */
async function checkClubAdminAuth(clubId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null }

  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return { error: null, user }
  }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    return { error: '클럽 관리 권한이 없습니다.', user: null }
  }

  return { error: null, user }
}

// ============================================================================
// 레슨 프로그램 CRUD
// ============================================================================

/** 레슨 프로그램 생성 */
export async function createLessonProgram(
  clubId: string,
  data: CreateProgramInput
): Promise<{ error: string | null; data?: LessonProgram }> {
  const idErr = validateId(clubId, '클럽 ID')
  if (idErr) return { error: idErr }

  const { error: authErr, user } = await checkClubAdminAuth(clubId)
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  if (!data.title || data.title.trim().length < 2) {
    return { error: '프로그램 제목은 2자 이상이어야 합니다.' }
  }
  if (!data.coach_id) return { error: '코치를 선택해주세요.' }
  if (data.max_participants < 1 || data.max_participants > 100) {
    return { error: '정원은 1~100명 사이여야 합니다.' }
  }

  const sanitized = sanitizeObject(data)
  const admin = createAdminClient()

  const { data: program, error } = await admin
    .from('lesson_programs')
    .insert({
      club_id: clubId,
      coach_id: sanitized.coach_id,
      title: sanitized.title,
      description: sanitized.description || null,
      target_level: sanitized.target_level,
      max_participants: sanitized.max_participants,
      fee_description: sanitized.fee_description || null,
      created_by: user.id,
    })
    .select('*, coach:coaches(*)')
    .single()

  if (error) return { error: '프로그램 생성에 실패했습니다.' }

  revalidatePath(`/clubs/${clubId}`)
  return { error: null, data: program }
}

/** 레슨 프로그램 수정 */
export async function updateLessonProgram(
  programId: string,
  data: UpdateProgramInput
): Promise<{ error: string | null }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  const { data: program } = await admin
    .from('lesson_programs')
    .select('club_id')
    .eq('id', programId)
    .single()

  if (!program) return { error: '프로그램을 찾을 수 없습니다.' }

  const { error: authErr } = await checkClubAdminAuth(program.club_id)
  if (authErr) return { error: authErr }

  const sanitized = sanitizeObject(data)
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (sanitized.title !== undefined) updateData.title = sanitized.title
  if (sanitized.coach_id !== undefined) updateData.coach_id = sanitized.coach_id
  if (sanitized.description !== undefined) updateData.description = sanitized.description || null
  if (sanitized.target_level !== undefined) updateData.target_level = sanitized.target_level
  if (sanitized.max_participants !== undefined) updateData.max_participants = sanitized.max_participants
  if (sanitized.fee_description !== undefined) updateData.fee_description = sanitized.fee_description || null

  const { error } = await admin
    .from('lesson_programs')
    .update(updateData)
    .eq('id', programId)

  if (error) return { error: '프로그램 수정에 실패했습니다.' }

  revalidatePath(`/clubs/${program.club_id}`)
  return { error: null }
}

/** 프로그램 상태 변경 */
export async function updateProgramStatus(
  programId: string,
  status: LessonProgramStatus
): Promise<{ error: string | null }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  const { data: program } = await admin
    .from('lesson_programs')
    .select('club_id')
    .eq('id', programId)
    .single()

  if (!program) return { error: '프로그램을 찾을 수 없습니다.' }

  const { error: authErr } = await checkClubAdminAuth(program.club_id)
  if (authErr) return { error: authErr }

  const { error } = await admin
    .from('lesson_programs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', programId)

  if (error) return { error: '상태 변경에 실패했습니다.' }

  revalidatePath(`/clubs/${program.club_id}`)
  return { error: null }
}

/** 클럽 레슨 프로그램 목록 조회 */
export async function getLessonPrograms(
  clubId: string
): Promise<{ error: string | null; data: LessonProgram[] }> {
  const idErr = validateId(clubId, '클럽 ID')
  if (idErr) return { error: idErr, data: [] }

  const admin = createAdminClient()

  const { data: programs, error } = await admin
    .from('lesson_programs')
    .select('*, coach:coaches(*)')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })

  if (error) return { error: '프로그램 목록 조회에 실패했습니다.', data: [] }

  // 수강 인원 카운트
  const programIds = (programs || []).map((p) => p.id)
  if (programIds.length === 0) return { error: null, data: [] }

  const { data: counts } = await admin
    .from('lesson_enrollments')
    .select('program_id')
    .in('program_id', programIds)
    .in('status', ['CONFIRMED', 'PENDING'])

  const countMap = new Map<string, number>()
  for (const c of counts || []) {
    countMap.set(c.program_id, (countMap.get(c.program_id) || 0) + 1)
  }

  const result = (programs || []).map((p) => ({
    ...p,
    _enrollment_count: countMap.get(p.id) || 0,
  }))

  return { error: null, data: result }
}

/** 레슨 프로그램 상세 조회 */
export async function getLessonProgramDetail(
  programId: string
): Promise<{ error: string | null; data?: LessonProgram & { sessions: LessonSession[]; enrollments: LessonEnrollment[] } }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  const { data: program, error } = await admin
    .from('lesson_programs')
    .select('*, coach:coaches(*)')
    .eq('id', programId)
    .single()

  if (error || !program) return { error: '프로그램을 찾을 수 없습니다.' }

  // 세션 목록
  const { data: sessions } = await admin
    .from('lesson_sessions')
    .select('*')
    .eq('program_id', programId)
    .order('session_date', { ascending: true })

  // 수강 신청 목록 (어드민용)
  const { data: enrollments } = await admin
    .from('lesson_enrollments')
    .select('*, member:club_members(id, name, phone)')
    .eq('program_id', programId)
    .neq('status', 'CANCELLED')
    .order('enrolled_at', { ascending: true })

  const enrollmentCount = (enrollments || []).filter(
    (e) => e.status === 'CONFIRMED' || e.status === 'PENDING'
  ).length

  return {
    error: null,
    data: {
      ...program,
      _enrollment_count: enrollmentCount,
      sessions: sessions || [],
      enrollments: enrollments || [],
    },
  }
}

// ============================================================================
// 레슨 세션 CRUD
// ============================================================================

/** 세션 추가 */
export async function createLessonSession(
  programId: string,
  data: CreateSessionInput
): Promise<{ error: string | null }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  const { data: program } = await admin
    .from('lesson_programs')
    .select('club_id')
    .eq('id', programId)
    .single()

  if (!program) return { error: '프로그램을 찾을 수 없습니다.' }

  const { error: authErr } = await checkClubAdminAuth(program.club_id)
  if (authErr) return { error: authErr }

  if (!data.session_date || !data.start_time || !data.end_time) {
    return { error: '날짜와 시간을 모두 입력해주세요.' }
  }

  const sanitized = sanitizeObject(data)
  const { error } = await admin
    .from('lesson_sessions')
    .insert({
      program_id: programId,
      session_date: sanitized.session_date,
      start_time: sanitized.start_time,
      end_time: sanitized.end_time,
      location: sanitized.location || null,
      notes: sanitized.notes || null,
    })

  if (error) return { error: '세션 추가에 실패했습니다.' }

  revalidatePath(`/clubs/${program.club_id}`)
  return { error: null }
}

/** 세션 상태 변경 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
): Promise<{ error: string | null }> {
  const idErr = validateId(sessionId, '세션 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  const { data: session } = await admin
    .from('lesson_sessions')
    .select('program_id, lesson_programs(club_id)')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '세션을 찾을 수 없습니다.' }

  const clubId = (session as unknown as { lesson_programs: { club_id: string } }).lesson_programs.club_id
  const { error: authErr } = await checkClubAdminAuth(clubId)
  if (authErr) return { error: authErr }

  const { error } = await admin
    .from('lesson_sessions')
    .update({ status })
    .eq('id', sessionId)

  if (error) return { error: '세션 상태 변경에 실패했습니다.' }

  revalidatePath(`/clubs/${clubId}`)
  return { error: null }
}

// ============================================================================
// 수강 신청
// ============================================================================

/** 수강 신청 */
export async function enrollLesson(
  programId: string
): Promise<{ error: string | null; data?: LessonEnrollment }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 프로그램 조회
  const { data: program } = await admin
    .from('lesson_programs')
    .select('club_id, max_participants, status')
    .eq('id', programId)
    .single()

  if (!program) return { error: '프로그램을 찾을 수 없습니다.' }
  if (program.status !== 'OPEN') return { error: '모집 중인 프로그램이 아닙니다.' }

  // 클럽 회원 확인
  const { data: member } = await admin
    .from('club_members')
    .select('id')
    .eq('club_id', program.club_id)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member) return { error: '클럽 회원만 수강 신청할 수 있습니다.' }

  // 이미 신청했는지 확인
  const { data: existing } = await admin
    .from('lesson_enrollments')
    .select('id, status')
    .eq('program_id', programId)
    .eq('member_id', member.id)
    .single()

  if (existing && existing.status !== 'CANCELLED') {
    return { error: '이미 수강 신청한 프로그램입니다.' }
  }

  // 현재 수강 인원 확인
  const { count } = await admin
    .from('lesson_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)
    .in('status', ['CONFIRMED', 'PENDING'])

  const currentCount = count || 0
  const enrollStatus = currentCount < program.max_participants ? 'CONFIRMED' : 'WAITLISTED'

  // 기존 취소 건이 있으면 업데이트, 없으면 신규 생성
  if (existing && existing.status === 'CANCELLED') {
    const { data: enrollment, error } = await admin
      .from('lesson_enrollments')
      .update({
        status: enrollStatus,
        enrolled_at: new Date().toISOString(),
        cancelled_at: null,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return { error: '수강 신청에 실패했습니다.' }
    revalidatePath(`/clubs/${program.club_id}`)
    return { error: null, data: enrollment }
  }

  const { data: enrollment, error } = await admin
    .from('lesson_enrollments')
    .insert({
      program_id: programId,
      member_id: member.id,
      status: enrollStatus,
    })
    .select()
    .single()

  if (error) return { error: '수강 신청에 실패했습니다.' }

  revalidatePath(`/clubs/${program.club_id}`)
  return { error: null, data: enrollment }
}

/** 수강 취소 */
export async function cancelEnrollment(
  enrollmentId: string
): Promise<{ error: string | null }> {
  const idErr = validateId(enrollmentId, '신청 ID')
  if (idErr) return { error: idErr }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: enrollment } = await admin
    .from('lesson_enrollments')
    .select('id, program_id, member_id, status, member:club_members(user_id)')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) return { error: '신청 정보를 찾을 수 없습니다.' }

  // 본인 확인
  const memberUserId = (enrollment as unknown as { member: { user_id: string } }).member.user_id
  if (memberUserId !== user.id) {
    return { error: '본인의 신청만 취소할 수 있습니다.' }
  }

  if (enrollment.status === 'CANCELLED') {
    return { error: '이미 취소된 신청입니다.' }
  }

  const wasCONFIRMED = enrollment.status === 'CONFIRMED'

  const { error } = await admin
    .from('lesson_enrollments')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
    })
    .eq('id', enrollmentId)

  if (error) return { error: '수강 취소에 실패했습니다.' }

  // 대기자 자동 승격: CONFIRMED 취소 시 첫 번째 WAITLISTED를 CONFIRMED로
  if (wasCONFIRMED) {
    const { data: nextWaiting } = await admin
      .from('lesson_enrollments')
      .select('id')
      .eq('program_id', enrollment.program_id)
      .eq('status', 'WAITLISTED')
      .order('enrolled_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (nextWaiting) {
      await admin
        .from('lesson_enrollments')
        .update({ status: 'CONFIRMED' })
        .eq('id', nextWaiting.id)
    }
  }

  // 프로그램의 클럽 ID 조회 후 revalidate
  const { data: program } = await admin
    .from('lesson_programs')
    .select('club_id')
    .eq('id', enrollment.program_id)
    .single()

  if (program) revalidatePath(`/clubs/${program.club_id}`)
  revalidatePath('/my/lessons')
  return { error: null }
}

/** 내 수강 신청 목록 */
export async function getMyEnrollments(): Promise<{
  error: string | null
  data: LessonEnrollment[]
}> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', data: [] }

  const admin = createAdminClient()

  // 유저의 모든 club_member ID
  const { data: members } = await admin
    .from('club_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  if (!members || members.length === 0) return { error: null, data: [] }

  const memberIds = members.map((m) => m.id)

  const { data: enrollments, error } = await admin
    .from('lesson_enrollments')
    .select('*, program:lesson_programs(id, title, club_id, coach:coaches(name))')
    .in('member_id', memberIds)
    .neq('status', 'CANCELLED')
    .order('enrolled_at', { ascending: false })

  if (error) return { error: '수강 목록 조회에 실패했습니다.', data: [] }

  return { error: null, data: enrollments || [] }
}

// ============================================================================
// 출석 관리
// ============================================================================

/** 출석 기록 (어드민) */
export async function recordAttendance(
  sessionId: string,
  enrollmentId: string,
  status: AttendanceLessonStatus
): Promise<{ error: string | null }> {
  const sessionErr = validateId(sessionId, '세션 ID')
  if (sessionErr) return { error: sessionErr }
  const enrollErr = validateId(enrollmentId, '신청 ID')
  if (enrollErr) return { error: enrollErr }

  const admin = createAdminClient()

  // 세션 → 프로그램 → 클럽 확인
  const { data: session } = await admin
    .from('lesson_sessions')
    .select('program_id, lesson_programs(club_id)')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '세션을 찾을 수 없습니다.' }

  const clubId = (session as unknown as { lesson_programs: { club_id: string } }).lesson_programs.club_id
  const { error: authErr } = await checkClubAdminAuth(clubId)
  if (authErr) return { error: authErr }

  // upsert — 같은 세션+수강에 대해 중복 방지
  const { error } = await admin
    .from('lesson_attendances')
    .upsert(
      {
        session_id: sessionId,
        enrollment_id: enrollmentId,
        status,
        recorded_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,enrollment_id' }
    )

  if (error) return { error: '출석 기록에 실패했습니다.' }

  revalidatePath(`/clubs/${clubId}`)
  return { error: null }
}

/** 세션 출석 목록 조회 */
export async function getSessionAttendances(
  sessionId: string
): Promise<{ error: string | null; data: LessonAttendance[] }> {
  const idErr = validateId(sessionId, '세션 ID')
  if (idErr) return { error: idErr, data: [] }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('lesson_attendances')
    .select('*, enrollment:lesson_enrollments(id, member:club_members(id, name))')
    .eq('session_id', sessionId)
    .order('recorded_at', { ascending: true })

  if (error) return { error: '출석 목록 조회에 실패했습니다.', data: [] }

  return { error: null, data: data || [] }
}

// ============================================================================
// 레슨 문의 (비회원 포함)
// ============================================================================

interface LessonInquiryInput {
  name: string
  phone: string
  message: string
}

/** 레슨 문의 제출 — 비로그인도 가능 */
export async function submitLessonInquiry(
  programId: string,
  data: LessonInquiryInput
): Promise<{ error: string | null }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const sanitized = sanitizeObject(data)
  const validationErrors = validateLessonInquiryInput(sanitized)
  if (hasValidationErrors(validationErrors)) {
    const firstError = Object.values(validationErrors).find(Boolean)
    return { error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()

  // 프로그램 → 클럽 ID 조회
  const { data: program } = await admin
    .from('lesson_programs')
    .select('club_id, title')
    .eq('id', programId)
    .single()

  if (!program) return { error: '프로그램을 찾을 수 없습니다.' }

  // 문의 저장
  const { error } = await admin
    .from('lesson_inquiries')
    .insert({
      program_id: programId,
      club_id: program.club_id,
      name: sanitized.name,
      phone: sanitized.phone,
      message: sanitized.message,
    })

  if (error) return { error: '문의 등록에 실패했습니다.' }

  // 클럽 어드민에게 알림 발송 (실패해도 문의 등록은 성공)
  try {
    const { data: admins } = await admin
      .from('club_members')
      .select('user_id')
      .eq('club_id', program.club_id)
      .in('role', ['OWNER', 'ADMIN'])
      .eq('status', 'ACTIVE')

    if (admins && admins.length > 0) {
      for (const adm of admins) {
        await createNotification({
          user_id: adm.user_id,
          type: 'LESSON_INQUIRY',
          title: '레슨 문의가 접수되었습니다',
          message: `[${program.title}] ${sanitized.name}님이 문의를 남겼습니다.`,
          club_id: program.club_id,
          metadata: { program_id: programId },
        })
      }
    }
  } catch {
    // 알림 실패는 무시 — 문의 저장은 이미 완료
  }

  return { error: null }
}
