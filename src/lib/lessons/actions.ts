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
  LessonInquiry,
  LessonPayment,
  LessonProgramStatus,
  LessonInquiryStatus,
  AttendanceLessonStatus,
  CreateProgramInput,
  UpdateProgramInput,
  CreateSessionInput,
  CreatePaymentInput,
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

/** SUPER_ADMIN / ADMIN 권한 확인 */
async function checkAdminAuth() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null }
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return { error: '관리자 권한이 필요합니다.', user: null }
  }
  return { error: null, user }
}

// ============================================================================
// 레슨 프로그램 CRUD
// ============================================================================

/** 레슨 프로그램 생성 */
export async function createLessonProgram(
  data: CreateProgramInput
): Promise<{ error: string | null; data?: LessonProgram }> {
  const { error: authErr, user } = await checkAdminAuth()
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

  revalidatePath('/lessons')
  return { error: null, data: program }
}

/** 레슨 프로그램 수정 */
export async function updateLessonProgram(
  programId: string,
  data: UpdateProgramInput
): Promise<{ error: string | null }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const sanitized = sanitizeObject(data)
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (sanitized.title !== undefined) updateData.title = sanitized.title
  if (sanitized.coach_id !== undefined) updateData.coach_id = sanitized.coach_id
  if (sanitized.description !== undefined) updateData.description = sanitized.description || null
  if (sanitized.target_level !== undefined) updateData.target_level = sanitized.target_level
  if (sanitized.max_participants !== undefined) updateData.max_participants = sanitized.max_participants
  if (sanitized.fee_description !== undefined) updateData.fee_description = sanitized.fee_description || null

  const admin = createAdminClient()
  const { error } = await admin
    .from('lesson_programs')
    .update(updateData)
    .eq('id', programId)

  if (error) return { error: '프로그램 수정에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null }
}

/** 프로그램 상태 변경 */
export async function updateProgramStatus(
  programId: string,
  status: LessonProgramStatus
): Promise<{ error: string | null }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { error } = await admin
    .from('lesson_programs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', programId)

  if (error) return { error: '상태 변경에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null }
}

/** 전체 공개 레슨 프로그램 목록 (OPEN 상태) */
export async function getAllOpenLessonPrograms(): Promise<{
  error: string | null
  data: LessonProgram[]
}> {
  const admin = createAdminClient()

  const { data: programs, error } = await admin
    .from('lesson_programs')
    .select('*, coach:coaches(*)')
    .eq('status', 'OPEN')
    .order('created_at', { ascending: false })

  if (error) return { error: '레슨 목록 조회에 실패했습니다.', data: [] }
  if (!programs || programs.length === 0) return { error: null, data: [] }

  const programIds = programs.map((p) => p.id)
  const { data: counts } = await admin
    .from('lesson_enrollments')
    .select('program_id')
    .in('program_id', programIds)
    .in('status', ['CONFIRMED', 'PENDING'])

  const countMap = new Map<string, number>()
  for (const c of counts || []) {
    countMap.set(c.program_id, (countMap.get(c.program_id) || 0) + 1)
  }

  return {
    error: null,
    data: programs.map((p) => ({ ...p, _enrollment_count: countMap.get(p.id) || 0 })),
  }
}

/** 레슨 프로그램 목록 (관리자용 — 전체 상태 포함) */
export async function getAllLessonPrograms(): Promise<{
  error: string | null
  data: LessonProgram[]
}> {
  const admin = createAdminClient()

  const { data: programs, error } = await admin
    .from('lesson_programs')
    .select('*, coach:coaches(*)')
    .order('created_at', { ascending: false })

  if (error) return { error: '레슨 목록 조회에 실패했습니다.', data: [] }
  if (!programs || programs.length === 0) return { error: null, data: [] }

  const programIds = programs.map((p) => p.id)
  const { data: counts } = await admin
    .from('lesson_enrollments')
    .select('program_id')
    .in('program_id', programIds)
    .in('status', ['CONFIRMED', 'PENDING'])

  const countMap = new Map<string, number>()
  for (const c of counts || []) {
    countMap.set(c.program_id, (countMap.get(c.program_id) || 0) + 1)
  }

  return {
    error: null,
    data: programs.map((p) => ({ ...p, _enrollment_count: countMap.get(p.id) || 0 })),
  }
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

  const { data: sessions } = await admin
    .from('lesson_sessions')
    .select('*')
    .eq('program_id', programId)
    .order('session_date', { ascending: true })

  const { data: enrollments } = await admin
    .from('lesson_enrollments')
    .select('*, user:profiles(id, name)')
    .eq('program_id', programId)
    .neq('status', 'CANCELLED')

  const enrollCount = (enrollments || []).filter(
    (e) => e.status === 'CONFIRMED' || e.status === 'PENDING'
  ).length

  return {
    error: null,
    data: {
      ...program,
      _enrollment_count: enrollCount,
      sessions: sessions || [],
      enrollments: enrollments || [],
    },
  }
}

// ============================================================================
// 레슨 세션 CRUD
// ============================================================================

/** 레슨 세션 등록 */
export async function createLessonSession(
  programId: string,
  data: CreateSessionInput
): Promise<{ error: string | null; data?: LessonSession }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { data: session, error } = await admin
    .from('lesson_sessions')
    .insert({ program_id: programId, ...data })
    .select()
    .single()

  if (error) return { error: '세션 등록에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null, data: session }
}

/** 레슨 세션 상태 변경 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'COMPLETED' | 'CANCELLED'
): Promise<{ error: string | null }> {
  const idErr = validateId(sessionId, '세션 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { error } = await admin
    .from('lesson_sessions')
    .update({ status })
    .eq('id', sessionId)

  if (error) return { error: '세션 상태 변경에 실패했습니다.' }

  revalidatePath('/lessons')
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

  const { data: program } = await admin
    .from('lesson_programs')
    .select('max_participants, status')
    .eq('id', programId)
    .single()

  if (!program) return { error: '프로그램을 찾을 수 없습니다.' }
  if (program.status !== 'OPEN') return { error: '모집 중인 프로그램이 아닙니다.' }

  // 이미 신청했는지 확인
  const { data: existing } = await admin
    .from('lesson_enrollments')
    .select('id, status')
    .eq('program_id', programId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing && existing.status !== 'CANCELLED') {
    return { error: '이미 수강 신청한 프로그램입니다.' }
  }

  // 현재 수강 인원 확인
  const { count } = await admin
    .from('lesson_enrollments')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', programId)
    .in('status', ['CONFIRMED', 'PENDING'])

  const enrollStatus = (count || 0) < program.max_participants ? 'CONFIRMED' : 'WAITLISTED'

  // 기존 취소 건 재신청
  if (existing && existing.status === 'CANCELLED') {
    const { data: enrollment, error } = await admin
      .from('lesson_enrollments')
      .update({ status: enrollStatus, enrolled_at: new Date().toISOString(), cancelled_at: null })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return { error: '수강 신청에 실패했습니다.' }
    revalidatePath('/lessons')
    revalidatePath('/my/lessons')
    return { error: null, data: enrollment }
  }

  const { data: enrollment, error } = await admin
    .from('lesson_enrollments')
    .insert({ program_id: programId, user_id: user.id, status: enrollStatus })
    .select()
    .single()

  if (error) return { error: '수강 신청에 실패했습니다.' }

  revalidatePath('/lessons')
  revalidatePath('/my/lessons')
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
    .select('id, program_id, user_id, status')
    .eq('id', enrollmentId)
    .single()

  if (!enrollment) return { error: '신청 정보를 찾을 수 없습니다.' }
  if (enrollment.user_id !== user.id) return { error: '본인의 신청만 취소할 수 있습니다.' }
  if (enrollment.status === 'CANCELLED') return { error: '이미 취소된 신청입니다.' }

  const wasCONFIRMED = enrollment.status === 'CONFIRMED'

  const { error } = await admin
    .from('lesson_enrollments')
    .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() })
    .eq('id', enrollmentId)

  if (error) return { error: '수강 취소에 실패했습니다.' }

  // 대기자 자동 승격
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

  revalidatePath('/lessons')
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

  const { data: enrollments, error } = await admin
    .from('lesson_enrollments')
    .select('*, program:lesson_programs(id, title, coach:coaches(name))')
    .eq('user_id', user.id)
    .neq('status', 'CANCELLED')
    .order('enrolled_at', { ascending: false })

  if (error) return { error: '수강 목록 조회에 실패했습니다.', data: [] }

  return { error: null, data: enrollments || [] }
}

// ============================================================================
// 출석 관리
// ============================================================================

/** 출석 기록 (관리자) */
export async function recordAttendance(
  sessionId: string,
  enrollmentId: string,
  status: AttendanceLessonStatus
): Promise<{ error: string | null }> {
  const sessionErr = validateId(sessionId, '세션 ID')
  if (sessionErr) return { error: sessionErr }
  const enrollErr = validateId(enrollmentId, '신청 ID')
  if (enrollErr) return { error: enrollErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

  const { error } = await admin
    .from('lesson_attendances')
    .upsert(
      { session_id: sessionId, enrollment_id: enrollmentId, status, recorded_at: new Date().toISOString() },
      { onConflict: 'session_id,enrollment_id' }
    )

  if (error) return { error: '출석 기록에 실패했습니다.' }

  revalidatePath('/lessons')
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
    .select('*, enrollment:lesson_enrollments(id, user:profiles(id, name))')
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
  preferred_session_id?: string | null
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

  const { data: program } = await admin
    .from('lesson_programs')
    .select('title')
    .eq('id', programId)
    .single()

  if (!program) return { error: '프로그램을 찾을 수 없습니다.' }

  const { error } = await admin
    .from('lesson_inquiries')
    .insert({
      program_id: programId,
      name: sanitized.name,
      phone: sanitized.phone,
      message: sanitized.message,
      preferred_session_id: data.preferred_session_id || null,
    })

  if (error) return { error: '문의 등록에 실패했습니다.' }

  // SUPER_ADMIN / ADMIN에게 알림 발송 (실패 무시)
  try {
    const { data: admins } = await admin
      .from('profiles')
      .select('id')
      .in('role', ['SUPER_ADMIN', 'ADMIN'])

    if (admins && admins.length > 0) {
      for (const adm of admins) {
        await createNotification({
          user_id: adm.id,
          type: 'LESSON_INQUIRY',
          title: '레슨 문의가 접수되었습니다',
          message: `[${program.title}] ${sanitized.name}님이 문의를 남겼습니다.`,
          metadata: { program_id: programId },
        })
      }
    }
  } catch {
    // 알림 실패는 무시
  }

  return { error: null }
}

/** 레슨 문의 목록 조회 (관리자) */
export async function getAdminLessonInquiries(): Promise<{
  error: string | null
  data: LessonInquiry[]
}> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, data: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lesson_inquiries')
    .select('*, program:lesson_programs(id, title, coach:coaches(name)), preferred_session:lesson_sessions(id, session_date, start_time, end_time)')
    .order('created_at', { ascending: false })

  if (error) return { error: '문의 목록 조회에 실패했습니다.', data: [] }
  return { error: null, data: data || [] }
}

/** 레슨 문의 상태 변경 (관리자) */
export async function updateInquiryStatus(
  inquiryId: string,
  status: LessonInquiryStatus,
  adminNote?: string
): Promise<{ error: string | null }> {
  const idErr = validateId(inquiryId, '문의 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const updateData: Record<string, unknown> = { status }
  if (adminNote !== undefined) updateData.admin_note = adminNote || null

  const { error } = await admin
    .from('lesson_inquiries')
    .update(updateData)
    .eq('id', inquiryId)

  if (error) return { error: '상태 변경에 실패했습니다.' }
  return { error: null }
}

// ============================================================================
// 레슨 결제 관리
// ============================================================================

/** 결제 기록 등록 (관리자) */
export async function createLessonPayment(
  enrollmentId: string,
  data: CreatePaymentInput
): Promise<{ error: string | null; data?: LessonPayment }> {
  const idErr = validateId(enrollmentId, '수강 ID')
  if (idErr) return { error: idErr }

  const { error: authErr, user } = await checkAdminAuth()
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  if (!data.amount || data.amount <= 0) return { error: '금액을 올바르게 입력해주세요.' }
  if (!data.paid_at) return { error: '입금 날짜를 입력해주세요.' }
  if (!data.period || !/^\d{4}-\d{2}$/.test(data.period)) {
    return { error: '납부 월을 올바르게 입력해주세요. (예: 2026-03)' }
  }

  const admin = createAdminClient()
  const { data: payment, error } = await admin
    .from('lesson_payments')
    .insert({
      enrollment_id: enrollmentId,
      amount: data.amount,
      paid_at: data.paid_at,
      method: data.method,
      period: data.period,
      note: data.note || null,
      recorded_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: '결제 기록 등록에 실패했습니다.' }
  revalidatePath('/my/lessons')
  return { error: null, data: payment }
}

/** 수강 결제 목록 조회 */
export async function getEnrollmentPayments(
  enrollmentId: string
): Promise<{ error: string | null; data: LessonPayment[] }> {
  const idErr = validateId(enrollmentId, '수강 ID')
  if (idErr) return { error: idErr, data: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lesson_payments')
    .select('*')
    .eq('enrollment_id', enrollmentId)
    .order('period', { ascending: false })

  if (error) return { error: '결제 목록 조회에 실패했습니다.', data: [] }
  return { error: null, data: data || [] }
}

/** 결제 삭제 (관리자) */
export async function deleteLessonPayment(
  paymentId: string
): Promise<{ error: string | null }> {
  const idErr = validateId(paymentId, '결제 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { error } = await admin
    .from('lesson_payments')
    .delete()
    .eq('id', paymentId)

  if (error) return { error: '결제 기록 삭제에 실패했습니다.' }
  revalidatePath('/my/lessons')
  return { error: null }
}

// ============================================================================
// 나의 레슨 상세 (수강생용)
// ============================================================================

export interface MyLessonDetail {
  enrollment: LessonEnrollment & {
    program: LessonProgram & { coach: { name: string; profile_image_url: string | null } | null }
  }
  upcomingSessions: LessonSession[]
  payments: LessonPayment[]
  totalAttendances: number
  thisMonthAttendances: number
}

/** 내 레슨 상세 (결제/세션/출석 포함) */
export async function getMyLessonDetails(): Promise<{
  error: string | null
  data: MyLessonDetail[]
}> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', data: [] }

  const admin = createAdminClient()

  // 확정된 내 수강 목록
  const { data: enrollments, error: enrollErr } = await admin
    .from('lesson_enrollments')
    .select('*, program:lesson_programs(*, coach:coaches(name, profile_image_url))')
    .eq('user_id', user.id)
    .in('status', ['CONFIRMED', 'PENDING'])
    .order('enrolled_at', { ascending: false })

  if (enrollErr) return { error: '수강 목록 조회에 실패했습니다.', data: [] }
  if (!enrollments || enrollments.length === 0) return { error: null, data: [] }

  const now = new Date().toISOString().substring(0, 10)
  const thisMonth = new Date().toISOString().substring(0, 7)

  const details: MyLessonDetail[] = []

  for (const enrollment of enrollments) {
    // 다가오는 세션
    const { data: sessions } = await admin
      .from('lesson_sessions')
      .select('*')
      .eq('program_id', enrollment.program_id)
      .eq('status', 'SCHEDULED')
      .gte('session_date', now)
      .order('session_date', { ascending: true })
      .limit(5)

    // 결제 기록
    const { data: payments } = await admin
      .from('lesson_payments')
      .select('*')
      .eq('enrollment_id', enrollment.id)
      .order('period', { ascending: false })

    // 출석 집계
    const { count: totalAttendances } = await admin
      .from('lesson_attendances')
      .select('id', { count: 'exact', head: true })
      .eq('enrollment_id', enrollment.id)
      .in('status', ['PRESENT', 'LATE'])

    // 이번 달 출석
    const monthlyCount = (enrollment.monthly_session_count as Record<string, number>)?.[thisMonth] || 0

    details.push({
      enrollment: enrollment as unknown as MyLessonDetail['enrollment'],
      upcomingSessions: sessions || [],
      payments: payments || [],
      totalAttendances: totalAttendances || 0,
      thisMonthAttendances: monthlyCount,
    })
  }

  return { error: null, data: details }
}

/** 일괄 세션 생성 (반복 패턴) */
export async function createRecurringSessions(
  programId: string,
  slots: CreateSessionInput[]
): Promise<{ error: string | null; count: number }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr, count: 0 }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, count: 0 }

  if (slots.length === 0) return { error: '생성할 슬롯이 없습니다.', count: 0 }
  if (slots.length > 100) return { error: '한 번에 최대 100개까지 생성 가능합니다.', count: 0 }

  const admin = createAdminClient()
  const rows = slots.map((s) => ({
    program_id: programId,
    session_date: s.session_date,
    start_time: s.start_time,
    end_time: s.end_time,
    location: s.location || null,
    notes: s.notes || null,
  }))

  const { data, error } = await admin
    .from('lesson_sessions')
    .insert(rows)
    .select('id')

  if (error) return { error: '세션 일괄 생성에 실패했습니다.', count: 0 }

  revalidatePath('/lessons')
  return { error: null, count: data?.length || 0 }
}
