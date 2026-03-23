'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeObject, validateLessonInquiryInput, hasValidationErrors } from '@/lib/utils/validation'
import { createNotification } from '@/lib/notifications/actions'
import { NotificationType } from '@/lib/notifications/types'
import {
  sendLessonApplyAlimtalk,
  sendLessonReservationAlimtalk,
  sendLessonApplyToCoachAlimtalk,
  sendLessonConfirmAlimtalk,
  sendAdminLessonNotification,
  sendLessonInquiryReplyAlimtalk,
} from '@/lib/solapi/alimtalk'
import type {
  LessonProgram,
  LessonSession,
  LessonEnrollment,
  LessonAttendance,
  LessonInquiry,
  LessonPayment,
  LessonProgramStatus,
  LessonSessionStatus,
  LessonInquiryStatus,
  EnrollmentStatus,
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
      session_duration_minutes: data.session_duration_minutes,
      fee_weekday_1: data.fee_weekday_1 ?? null,
      fee_weekday_2: data.fee_weekday_2 ?? null,
      fee_weekend_1: data.fee_weekend_1 ?? null,
      fee_weekend_2: data.fee_weekend_2 ?? null,
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
  if (data.session_duration_minutes !== undefined) updateData.session_duration_minutes = data.session_duration_minutes
  if (data.fee_weekday_1 !== undefined) updateData.fee_weekday_1 = data.fee_weekday_1
  if (data.fee_weekday_2 !== undefined) updateData.fee_weekday_2 = data.fee_weekday_2
  if (data.fee_weekend_1 !== undefined) updateData.fee_weekend_1 = data.fee_weekend_1
  if (data.fee_weekend_2 !== undefined) updateData.fee_weekend_2 = data.fee_weekend_2
  if (data.is_visible !== undefined) updateData.is_visible = data.is_visible

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

/** 레슨 프로그램 삭제 (관리자 전용) */
export async function deleteLessonProgram(programId: string): Promise<{ error: string | null }> {
  const idErr = validateId(programId, '프로그램 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { error } = await admin
    .from('lesson_programs')
    .delete()
    .eq('id', programId)

  if (error) return { error: '프로그램 삭제에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null }
}

/** 전체 공개 레슨 프로그램 목록 (OPEN 상태) */
/** 코치별 레슨 카드 데이터 (공개 페이지용) */
export interface CoachLessonCard {
  coachId: string
  coachName: string
  profileImageUrl: string | null
  /** 대표 프로그램 ID (가장 최신 OPEN) */
  programId: string
  sessionDurationMinutes: number
  /** 설정된 요금만 포함 */
  fees: Array<{ label: string; amount: number }>
  /** 오늘 이후 OPEN 슬롯 수 */
  openSlotCount: number
}

/** 코치 단위로 그룹핑된 레슨 카드 목록 조회 (공개) */
export async function getCoachLessonCards(): Promise<{
  error: string | null
  data: CoachLessonCard[]
}> {
  const admin = createAdminClient()

  // OPEN + is_visible 프로그램만 → 코치별 최신 1개 대표
  const { data: programs, error } = await admin
    .from('lesson_programs')
    .select('*, coach:coaches(id, name, profile_image_url)')
    .eq('status', 'OPEN')
    .eq('is_visible', true)
    .order('created_at', { ascending: false })

  if (error) return { error: '레슨 목록 조회에 실패했습니다.', data: [] }
  if (!programs || programs.length === 0) return { error: null, data: [] }

  // 코치별 최신 프로그램 그룹핑
  const coachMap = new Map<string, typeof programs[number]>()
  for (const p of programs) {
    const coachId = p.coach_id
    if (!coachMap.has(coachId)) {
      coachMap.set(coachId, p)
    }
  }

  const representativePrograms = [...coachMap.values()]
  const programIds = representativePrograms.map((p) => p.id)

  // OPEN 슬롯 수 집계 (오늘 이후)
  const today = new Date().toISOString().substring(0, 10)
  const { data: slots } = await admin
    .from('lesson_slots')
    .select('program_id')
    .in('program_id', programIds)
    .eq('status', 'OPEN')
    .gte('slot_date', today)

  const slotCountMap = new Map<string, number>()
  for (const s of slots || []) {
    slotCountMap.set(s.program_id, (slotCountMap.get(s.program_id) || 0) + 1)
  }

  // 요금 라벨 생성
  const FEE_LABELS: Array<{ key: keyof LessonProgram; label: string }> = [
    { key: 'fee_weekday_1', label: '주중 1회' },
    { key: 'fee_weekday_2', label: '주중 2회' },
    { key: 'fee_weekend_1', label: '주말 1회' },
    { key: 'fee_weekend_2', label: '주말 2회' },
    { key: 'fee_mixed_2', label: '혼합 2회' },
  ]

  const cards: CoachLessonCard[] = representativePrograms.map((p) => {
    const coachRaw = p.coach
    const coach = Array.isArray(coachRaw) ? coachRaw[0] : coachRaw

    const fees: CoachLessonCard['fees'] = []
    for (const { key, label } of FEE_LABELS) {
      const amount = p[key as keyof typeof p]
      if (typeof amount === 'number' && amount > 0) {
        fees.push({ label, amount })
      }
    }

    return {
      coachId: p.coach_id,
      coachName: coach?.name || '미정',
      profileImageUrl: coach?.profile_image_url || null,
      programId: p.id,
      sessionDurationMinutes: p.session_duration_minutes,
      fees,
      openSlotCount: slotCountMap.get(p.id) || 0,
    }
  })

  return { error: null, data: cards }
}

export async function getAllOpenLessonPrograms(): Promise<{
  error: string | null
  data: LessonProgram[]
}> {
  const admin = createAdminClient()

  const { data: programs, error } = await admin
    .from('lesson_programs')
    .select('*, coach:coaches(*)')
    .eq('status', 'OPEN')
    .eq('is_visible', true)
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

/** 레슨 세션 삭제 (관리자 전용) */
export async function deleteLessonSession(sessionId: string): Promise<{ error: string | null }> {
  const idErr = validateId(sessionId, '세션 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { error } = await admin
    .from('lesson_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) return { error: '세션 삭제에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null }
}

/** 전체 프로그램 세션 목록 (관리자용 — 날짜 범위 필터) */
export async function getAllLessonSessions(options?: {
  from?: string  // YYYY-MM-DD
  to?: string
  status?: LessonSessionStatus
}): Promise<{ error: string | null; data: (LessonSession & { program_title: string; coach_name: string | null })[] }> {
  const admin = createAdminClient()

  let query = admin
    .from('lesson_sessions')
    .select('*, program:lesson_programs(title, coach:coaches(name))')
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (options?.from) query = query.gte('session_date', options.from)
  if (options?.to) query = query.lte('session_date', options.to)
  if (options?.status) query = query.eq('status', options.status)

  const { data, error } = await query

  if (error) return { error: '세션 목록 조회에 실패했습니다.', data: [] }

  return {
    error: null,
    data: (data || []).map((s) => ({
      ...s,
      program_title: (s.program as unknown as { title: string } | null)?.title ?? '알 수 없음',
      coach_name: (s.program as unknown as { coach: { name: string } | null } | null)?.coach?.name ?? null,
    })),
  }
}

// ============================================================================
// 알림 헬퍼 (fire-and-forget)
// ============================================================================

/** 수강 신청 시 코치에게 인앱 알림 */
async function sendEnrollNotificationToCoach(
  admin: ReturnType<typeof createAdminClient>,
  program: { coach?: unknown },
  customerName: string,
  programId: string,
) {
  try {
    const coach = program.coach as { name?: string; phone?: string; user_id?: string } | null
    if (!coach) return

    // coaches 테이블에서 user_id 조회 (join 결과에 user_id가 없을 수 있음)
    const { data: coachRow } = await admin
      .from('coaches')
      .select('user_id')
      .eq('phone', coach.phone || '')
      .maybeSingle()

    if (coachRow?.user_id) {
      await createNotification({
        user_id: coachRow.user_id,
        type: NotificationType.LESSON_ENROLLED,
        title: '새 수강 신청',
        message: `${customerName}님이 수강 신청했습니다.`,
        metadata: { link: '/admin/lessons', programId },
      })
    }
  } catch { /* 알림 실패는 메인 로직에 영향 없음 */ }
}

// ============================================================================
// 수강 신청
// ============================================================================

/** 수강 신청 완료 알림톡 발송 헬퍼 (고객 + 코치 fire-and-forget) */
async function sendLessonAlimtalk(
  user: { name?: string | null; phone?: string | null },
  program: { title?: string | null; coach?: { name?: string | null; phone?: string | null; lesson_location?: string | null } | null },
  status: string,
) {
  if (status === 'WAITLISTED') return

  const coach = program.coach as { name?: string | null; phone?: string | null; lesson_location?: string | null } | null

  // 고객에게 신청 결과 안내
  if (user.phone) {
    const result = await sendLessonApplyAlimtalk({
      phone: user.phone,
      customerName: user.name || '회원',
      lessonName: program.title || '레슨',
      coachName: coach?.name || '-',
      lessonStartDate: '-',
      lessonInfo: '-',
      lessonDays: '-',
      venue: coach?.lesson_location || '-',
    })
    if (!result.success) {
      console.error('[Alimtalk] 레슨 신청 결과(고객) 발송 실패:', result.error)
    }
  }

  // 코치에게 신청 알림
  if (coach?.phone && user.phone) {
    const coachResult = await sendLessonApplyToCoachAlimtalk({
      coachPhone: coach.phone,
      customerName: user.name || '회원',
      customerPhone: user.phone,
      lessonStartDate: '-',
      lessonDays: '-',
    })
    if (!coachResult.success) {
      console.error('[Alimtalk] 레슨 신청 알림(코치) 발송 실패:', coachResult.error)
    }
  }

  // 관리자에게 신청 알림
  if (user.phone) {
    const adminResult = await sendAdminLessonNotification({
      customerName: user.name || '회원',
      customerPhone: user.phone,
      lessonStartDate: '-',
      lessonDays: '-',
    })
    if (!adminResult.success) {
      console.error('[Alimtalk] 레슨 신청 알림(관리자) 발송 실패:', adminResult.error)
    }
  }
}

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
    .select('max_participants, status, title, coach:coaches(name, phone, lesson_location)')
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
    await sendLessonAlimtalk(user, program as unknown as { title?: string | null; coach?: { name?: string | null; phone?: string | null; lesson_location?: string | null } | null }, enrollStatus)
    // 인앱 알림: 코치에게 수강 신청 알림 (fire-and-forget)
    sendEnrollNotificationToCoach(admin, program, user.name || '회원', programId)
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
  await sendLessonAlimtalk(user, program as unknown as { title?: string | null; coach?: { name?: string | null; phone?: string | null; lesson_location?: string | null } | null }, enrollStatus)
  // 인앱 알림: 코치에게 수강 신청 알림 (fire-and-forget)
  sendEnrollNotificationToCoach(admin, program, user.name || '회원', programId)
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

  // 알림: 코치에게 수강 취소 인앱 알림 (fire-and-forget)
  try {
    const { data: program } = await admin
      .from('lesson_programs')
      .select('title, coach:coaches(user_id, name)')
      .eq('id', enrollment.program_id)
      .single()

    const coach = program?.coach as { user_id?: string; name?: string } | null
    if (coach?.user_id) {
      await createNotification({
        user_id: coach.user_id,
        type: NotificationType.LESSON_ENROLLMENT_CANCELLED,
        title: '수강 취소',
        message: `${user.name || '회원'}님이 ${program?.title || '레슨'} 수강을 취소했습니다.`,
        metadata: { link: '/admin/lessons' },
      })
    }
  } catch { /* 알림 실패는 메인 로직에 영향 없음 */ }

  return { error: null }
}

/** 수강 신청 목록 조회 (관리자) */
export async function getAdminEnrollments(programId?: string): Promise<{
  error: string | null
  data: (LessonEnrollment & { user_name: string; user_email: string | null })[]
}> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, data: [] }

  const admin = createAdminClient()

  let query = admin
    .from('lesson_enrollments')
    .select('*, user:profiles(id, name, email)')
    .order('enrolled_at', { ascending: false })

  if (programId) query = query.eq('program_id', programId)

  const { data, error } = await query

  if (error) return { error: '수강 목록 조회에 실패했습니다.', data: [] }

  return {
    error: null,
    data: (data || []).map((e) => ({
      ...e,
      user_name: (e.user as unknown as { name: string } | null)?.name ?? '알 수 없음',
      user_email: (e.user as unknown as { email: string } | null)?.email ?? null,
    })),
  }
}

// ─── 전체 수강생 목록 (어드민 테이블 뷰용) ───────────────────────────────────

export type AdminEnrollmentRow = {
  id: string
  program_id: string
  user_id: string
  user_name: string
  user_email: string | null
  status: EnrollmentStatus
  enrolled_at: string
  program_title: string
  coach_id: string
  coach_name: string
  /** 납부 완료된 월 목록 ('YYYY-MM' 형식) */
  paid_periods: string[]
}

/** 전체 코치/프로그램의 수강생 목록 조회 (관리자 테이블 뷰) */
export async function getAdminAllEnrollments(): Promise<{
  error: string | null
  data: AdminEnrollmentRow[]
}> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, data: [] }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('lesson_enrollments')
    .select(
      'id, program_id, user_id, status, enrolled_at, user:profiles(id, name, email), program:lesson_programs(id, title, coach:coaches(id, name)), payments:lesson_payments(period)',
    )
    .neq('status', 'CANCELLED')
    .order('enrolled_at', { ascending: false })

  if (error) return { error: '수강 목록 조회에 실패했습니다.', data: [] }

  return {
    error: null,
    data: (data || []).map((e) => {
      const user = e.user as unknown as { name: string; email: string } | null
      const program = e.program as unknown as {
        id: string
        title: string
        coach: { id: string; name: string } | null
      } | null
      const payments = (e.payments as unknown as { period: string }[] | null) ?? []

      return {
        id: e.id,
        program_id: e.program_id,
        user_id: e.user_id,
        user_name: user?.name ?? '알 수 없음',
        user_email: user?.email ?? null,
        status: e.status,
        enrolled_at: e.enrolled_at,
        program_title: program?.title ?? '알 수 없음',
        coach_id: program?.coach?.id ?? '',
        coach_name: program?.coach?.name ?? '알 수 없음',
        paid_periods: payments.map((p) => p.period),
      }
    }),
  }
}

/** 수강 상태 변경 (관리자) */
export async function updateEnrollmentStatus(
  enrollmentId: string,
  status: EnrollmentStatus
): Promise<{ error: string | null }> {
  const idErr = validateId(enrollmentId, '수강 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

  const updateData: Record<string, unknown> = { status }
  if (status === 'CANCELLED') updateData.cancelled_at = new Date().toISOString()

  const { error } = await admin
    .from('lesson_enrollments')
    .update(updateData)
    .eq('id', enrollmentId)

  if (error) return { error: '수강 상태 변경에 실패했습니다.' }

  // 상태 변경 시 고객에게 알림 발송 (fire-and-forget)
  try {
    const { data: enrollment } = await admin
      .from('lesson_enrollments')
      .select('user_id, program:lesson_programs(title, coach:coaches(name, bank_account))')
      .eq('id', enrollmentId)
      .single()

    if (enrollment) {
      const { data: profile } = await admin
        .from('profiles')
        .select('name, phone')
        .eq('id', enrollment.user_id)
        .single()

      const program = enrollment.program as unknown as {
        title: string
        coach: { name: string; bank_account: string | null } | null
      } | null

      if (status === 'CONFIRMED') {
        // 확정: 인앱 알림 + 알림톡
        await createNotification({
          user_id: enrollment.user_id,
          type: NotificationType.LESSON_BOOKING_CONFIRMED,
          title: '수강 확정',
          message: `${program?.title || '레슨'} 수강이 확정되었습니다.`,
          metadata: { link: '/my/lessons' },
        })
        if (profile?.phone) {
          await sendLessonConfirmAlimtalk({
            customerPhone: profile.phone,
            customerName: profile.name || '회원',
            bankInfo: program?.coach?.bank_account || '-',
            lessonStartDate: '-',
            lessonInfo: program?.title || '-',
            lessonDays: '-',
          })
        }
      } else if (status === 'CANCELLED') {
        // 거절/취소: 인앱 알림
        await createNotification({
          user_id: enrollment.user_id,
          type: NotificationType.LESSON_BOOKING_CANCELLED,
          title: '수강 취소',
          message: `${program?.title || '레슨'} 수강이 취소되었습니다.`,
          metadata: { link: '/my/lessons' },
        })
      }
    }
  } catch { /* 알림 실패는 메인 로직에 영향 없음 */ }

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
    .select('title, coach:coaches(phone)')
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

  // 알림톡: 코치에게 예약 알림 (fire-and-forget)
  const coachPhone = (program.coach as unknown as { phone?: string | null } | null)?.phone
  if (coachPhone) {
    const coachAlimtalkResult = await sendLessonReservationAlimtalk({
      coachPhone,
      customerName: sanitized.name,
      customerPhone: sanitized.phone,
      lessonStartDate: '-',
      lessonDays: '-',
    })
    if (!coachAlimtalkResult.success) {
      console.error('[Alimtalk] 레슨 예약 알림(코치) 발송 실패:', coachAlimtalkResult.error)
    }
  }

  // 관리자에게 예약 알림톡 발송 (fire-and-forget)
  const adminAlimtalkResult = await sendAdminLessonNotification({
    customerName: sanitized.name,
    customerPhone: sanitized.phone,
    lessonStartDate: '-',
    lessonDays: '-',
  })
  if (!adminAlimtalkResult.success) {
    console.error('[Alimtalk] 레슨 예약 알림(관리자) 발송 실패:', adminAlimtalkResult.error)
  }

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

  // 답변 완료(RESPONDED) 시 고객에게 알림톡 발송 (fire-and-forget)
  if (status === 'RESPONDED' && adminNote) {
    sendInquiryReplyAlimtalkAsync(admin, inquiryId, adminNote)
  }

  return { error: null }
}

/** 문의 답변 알림톡 비동기 발송 (fire-and-forget) */
function sendInquiryReplyAlimtalkAsync(
  admin: ReturnType<typeof createAdminClient>,
  inquiryId: string,
  adminNote: string,
): void {
  void (async () => {
    try {
      // 문의 정보 조회 (코치 이름 포함)
      const { data: inquiry } = await admin
        .from('lesson_inquiries')
        .select('name, phone, message, coach_id, coach:coaches(name)')
        .eq('id', inquiryId)
        .single()

      if (!inquiry?.phone) return

      // Supabase FK join은 1:1이면 객체, 1:N이면 배열 반환
      const coachData = inquiry.coach as { name: string } | { name: string }[] | null
      const coachName = Array.isArray(coachData)
        ? coachData[0]?.name || '담당 코치'
        : coachData?.name || '담당 코치'

      await sendLessonInquiryReplyAlimtalk({
        customerPhone: inquiry.phone,
        customerName: inquiry.name,
        coachName,
        inquiryContent: inquiry.message,
        replyContent: adminNote,
        lessonsUrl: 'https://mapo-tennis.com/lessons',
      })
    } catch (err) {
      console.error('[Alimtalk] 문의 답변 알림톡 발송 실패:', err)
    }
  })()
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

  // SUPER_ADMIN 전용
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }
  if (user.role !== 'SUPER_ADMIN') return { error: '최고 관리자 권한이 필요합니다.' }

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

/** 달력용: 특정 프로그램 목록의 월별 세션 조회 */
export async function getCoachSessionsForMonth(
  programIds: string[],
  year: number,
  month: number,
): Promise<{ error: string | null; data: Array<LessonSession & { program_title: string }> }> {
  if (!programIds.length) return { error: null, data: [] }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, data: [] }

  const admin = createAdminClient()
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  const { data, error } = await admin
    .from('lesson_sessions')
    .select('*, program:lesson_programs(title)')
    .in('program_id', programIds)
    .gte('session_date', startDate)
    .lte('session_date', endDate)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true })

  if (error) return { error: '세션 조회에 실패했습니다.', data: [] }

  return {
    error: null,
    data: (data || []).map((s) => ({
      ...s,
      program_title: (s.program as unknown as { title: string } | null)?.title ?? '',
    })),
  }
}
