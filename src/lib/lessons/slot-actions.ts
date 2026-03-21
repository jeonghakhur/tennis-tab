'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeObject } from '@/lib/utils/validation'
import type {
  LessonSlot,
  LessonBooking,
  LessonSlotStatus,
  LessonBookingStatus,
  CreateSlotInput,
  CreateBookingInput,
  SlotSession,
} from './slot-types'
import { getDayType, isTimeInRange, calculateBookingType, getBookingTypeForPackageSlot, getFeeFieldByBookingType } from './slot-types'
import type { LessonInquiry, LessonInquiryStatus } from './types'
import { createNotification } from '@/lib/notifications/actions'
import { NotificationType } from '@/lib/notifications/types'
import {
  sendLessonConfirmAlimtalk,
  sendLessonBookingCancelAlimtalk,
} from '@/lib/solapi/alimtalk'

// ============================================================================
// 알림 헬퍼 — fire-and-forget (실패해도 메인 로직 차단 안 함)
// ============================================================================

/** 예약의 코치 정보 조회 (슬롯 → 코치) */
async function getCoachInfoForSlots(
  admin: ReturnType<typeof createAdminClient>,
  slotIds: string[]
): Promise<{ coachUserId: string | null; coachName: string; coachPhone: string | null; bankAccount: string | null } | null> {
  const { data: slot } = await admin
    .from('lesson_slots')
    .select('coach_id')
    .in('id', slotIds)
    .limit(1)
    .maybeSingle()
  if (!slot) return null

  const { data: coach } = await admin
    .from('coaches')
    .select('user_id, name, phone, bank_account')
    .eq('id', slot.coach_id)
    .single()
  if (!coach) return null

  return {
    coachUserId: coach.user_id,
    coachName: coach.name || '코치',
    coachPhone: coach.phone || null,
    bankAccount: coach.bank_account || null,
  }
}

/** 회원 ID → user_id + 이름 + 전화번호 조회 */
async function getMemberInfo(
  admin: ReturnType<typeof createAdminClient>,
  memberId: string
): Promise<{ userId: string; name: string; phone: string | null } | null> {
  const { data: member } = await admin
    .from('club_members')
    .select('user_id, name')
    .eq('id', memberId)
    .single()
  if (!member?.user_id) return null

  const { data: profile } = await admin
    .from('profiles')
    .select('phone')
    .eq('id', member.user_id)
    .single()

  return {
    userId: member.user_id,
    name: member.name || '회원',
    phone: profile?.phone || null,
  }
}

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
    return { error: '관리자 권한이 없습니다.', user: null }
  }
  return { error: null, user }
}

/**
 * 관리자이거나 본인 코치 프로필이 있는 경우 허용
 * - isAdmin: true → 모든 데이터 접근 가능
 * - coachId: string → 해당 coachId 데이터만 접근 가능
 */
async function checkCoachOrAdminAuth(): Promise<{
  error: string | null
  coachId: string | null
  isAdmin: boolean
}> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', coachId: null, isAdmin: false }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  if (isAdmin) return { error: null, coachId: null, isAdmin: true }

  const admin = createAdminClient()
  const { data: coach } = await admin
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!coach) return { error: '접근 권한이 없습니다.', coachId: null, isAdmin: false }
  return { error: null, coachId: coach.id, isAdmin: false }
}

/**
 * 코치가 해당 슬롯의 소유자인지 확인
 * - coachId가 null이면 관리자 → 항상 통과
 * - coachId가 있으면 slot.coach_id와 일치해야 함
 */
async function assertCoachOwnsSlot(coachId: string | null, slotId: string): Promise<string | null> {
  if (!coachId) return null // 관리자는 통과
  const admin = createAdminClient()
  const { data: slot } = await admin
    .from('lesson_slots')
    .select('coach_id')
    .eq('id', slotId)
    .maybeSingle()
  if (!slot) return '슬롯을 찾을 수 없습니다.'
  if (slot.coach_id !== coachId) return '본인 슬롯만 수정할 수 있습니다.'
  return null
}

/**
 * 코치가 해당 예약의 슬롯 소유자인지 확인
 */
async function assertCoachOwnsBooking(coachId: string | null, bookingSlotIds: string[]): Promise<string | null> {
  if (!coachId) return null // 관리자는 통과
  const admin = createAdminClient()
  const { data: slots } = await admin
    .from('lesson_slots')
    .select('coach_id')
    .in('id', bookingSlotIds)
    .limit(1)
  if (!slots?.length) return '슬롯을 찾을 수 없습니다.'
  if (slots[0].coach_id !== coachId) return '본인 슬롯의 예약만 관리할 수 있습니다.'
  return null
}

/**
 * 현재 로그인 유저의 coach ID 반환 (코치가 아니면 null)
 * 클라이언트 컴포넌트에서 코치 모드 감지용
 */
export async function getMyCoachId(): Promise<string | null> {
  const user = await getCurrentUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: coach } = await admin
    .from('coaches')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  return coach?.id ?? null
}

const REVALIDATE_PATH = '/admin/lessons'

// ============================================================================
// 슬롯 CRUD
// ============================================================================

/** 슬롯 단건 생성 (단일 세션용, 레거시) */
export async function createSlot(
  programId: string,
  coachId: string,
  data: SlotSession
): Promise<{ error: string | null; data?: LessonSlot }> {
  const { error: authErr, user } = await checkAdminAuth()
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  const idErr = validateId(programId, '프로그램 ID') || validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr }

  if (!data.slot_date || !data.start_time || !data.end_time) {
    return { error: '날짜와 시간을 입력해주세요.' }
  }

  if (!isTimeInRange(data.slot_date, data.start_time, data.end_time)) {
    return { error: '해당 요일의 레슨 가능 시간 범위를 벗어납니다.' }
  }

  const dayType = getDayType(data.slot_date)
  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('lesson_slots')
    .select('id')
    .eq('coach_id', coachId)
    .eq('slot_date', data.slot_date)
    .eq('start_time', data.start_time)
    .neq('status', 'CANCELLED')
    .limit(1)

  if (existing && existing.length > 0) {
    return { error: '같은 시간에 이미 슬롯이 존재합니다.' }
  }

  const { data: slot, error } = await admin
    .from('lesson_slots')
    .insert({
      program_id: programId,
      coach_id: coachId,
      slot_date: data.slot_date,
      start_time: data.start_time,
      end_time: data.end_time,
      day_type: dayType,
      status: 'OPEN',
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: '슬롯 생성에 실패했습니다.' }

  revalidatePath(REVALIDATE_PATH)
  return { error: null, data: slot }
}

/** 레슨 슬롯 패키지 생성 (1건 = 전체 N회 세션) */
export async function createLessonSlot(
  coachId: string,
  input: CreateSlotInput
): Promise<{ error: string | null }> {
  const { error: authErr, coachId: myCoachId, isAdmin } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }
  // 코치는 본인 슬롯만 생성 가능
  if (!isAdmin && myCoachId !== coachId) return { error: '본인 슬롯만 생성할 수 있습니다.' }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  if (!input.sessions.length) return { error: '생성할 세션이 없습니다.' }

  // 각 세션 시간 범위 검증
  for (const s of input.sessions) {
    if (!isTimeInRange(s.slot_date, s.start_time, s.end_time)) {
      const d = new Date(s.slot_date + 'T00:00:00')
      const dayLabel = d.toLocaleDateString('ko-KR', { weekday: 'short' })
      return { error: `${s.slot_date}(${dayLabel}) ${s.start_time}~${s.end_time}은 가능 시간 범위를 벗어납니다.` }
    }
  }

  // 첫 번째 세션 기준으로 slot_date/start_time/end_time 설정
  const first = input.sessions[0]
  const admin = createAdminClient()

  const { error } = await admin
    .from('lesson_slots')
    .insert({
      coach_id: coachId,
      slot_date: first.slot_date,
      start_time: first.start_time,
      end_time: first.end_time,
      day_type: getDayType(first.slot_date),
      frequency: input.frequency,
      duration_minutes: input.duration_minutes,
      total_sessions: input.total_sessions,
      sessions: input.sessions,
      last_session_date: input.sessions[input.sessions.length - 1].slot_date,
      fee_amount: input.fee_amount,
      status: 'OPEN',
      created_by: user.id,
    })

  if (error) return { error: '슬롯 생성에 실패했습니다.' }

  revalidatePath(REVALIDATE_PATH)
  return { error: null }
}

/** 슬롯 상태 변경 (OPEN ↔ BLOCKED) */
export async function updateSlotStatus(
  slotId: string,
  status: LessonSlotStatus
): Promise<{ error: string | null }> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const idErr = validateId(slotId, '슬롯 ID')
  if (idErr) return { error: idErr }

  const ownerErr = await assertCoachOwnsSlot(coachId, slotId)
  if (ownerErr) return { error: ownerErr }

  if (!['OPEN', 'BLOCKED'].includes(status)) {
    return { error: '유효하지 않은 상태입니다.' }
  }

  const admin = createAdminClient()

  // 현재 상태 확인 — BOOKED/LOCKED 슬롯은 변경 불가
  const { data: current } = await admin
    .from('lesson_slots')
    .select('status')
    .eq('id', slotId)
    .single()

  if (!current) return { error: '슬롯을 찾을 수 없습니다.' }
  if (current.status === 'BOOKED' || current.status === 'LOCKED') {
    return { error: `${current.status === 'BOOKED' ? '예약된' : '배정된'} 슬롯은 상태를 변경할 수 없습니다.` }
  }

  const { error } = await admin
    .from('lesson_slots')
    .update({ status })
    .eq('id', slotId)

  if (error) return { error: '상태 변경에 실패했습니다.' }

  revalidatePath(REVALIDATE_PATH)
  return { error: null }
}

/** 어드민 직접 배정 (LOCKED) */
export async function lockSlot(
  slotId: string,
  memberId: string,
  memberName?: string
): Promise<{ error: string | null }> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const idErr = validateId(slotId, '슬롯 ID') || validateId(memberId, '회원 ID')
  if (idErr) return { error: idErr }

  const ownerErr = await assertCoachOwnsSlot(coachId, slotId)
  if (ownerErr) return { error: ownerErr }

  const admin = createAdminClient()

  // OPEN 슬롯만 배정 가능
  const { data: current } = await admin
    .from('lesson_slots')
    .select('status')
    .eq('id', slotId)
    .single()

  if (!current) return { error: '슬롯을 찾을 수 없습니다.' }
  if (current.status !== 'OPEN') {
    return { error: '빈 슬롯만 회원을 배정할 수 있습니다.' }
  }

  const { error } = await admin
    .from('lesson_slots')
    .update({
      status: 'LOCKED',
      locked_member_id: memberId,
      notes: memberName ? `${memberName} 배정` : null,
    })
    .eq('id', slotId)

  if (error) return { error: '회원 배정에 실패했습니다.' }

  revalidatePath(REVALIDATE_PATH)

  // 알림: 배정된 회원에게 인앱 알림 (fire-and-forget)
  try {
    const memberInfo = await getMemberInfo(admin, memberId)
    const coachInfo = await getCoachInfoForSlots(admin, [slotId])
    if (memberInfo) {
      await createNotification({
        user_id: memberInfo.userId,
        type: NotificationType.LESSON_SLOT_LOCKED,
        title: '레슨 배정 안내',
        message: `${coachInfo?.coachName || '코치'}님의 레슨에 배정되었습니다.`,
        metadata: { link: '/my/lessons' },
      })
    }
  } catch { /* 알림 실패는 메인 로직에 영향 없음 */ }

  return { error: null }
}

/** LOCKED 해제 → OPEN 복구 */
export async function unlockSlot(slotId: string): Promise<{ error: string | null }> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const ownerErr = await assertCoachOwnsSlot(coachId, slotId)
  if (ownerErr) return { error: ownerErr }

  const admin = createAdminClient()

  const { error } = await admin
    .from('lesson_slots')
    .update({ status: 'OPEN', locked_member_id: null, notes: null })
    .eq('id', slotId)
    .eq('status', 'LOCKED')

  if (error) return { error: '배정 해제에 실패했습니다.' }

  revalidatePath(REVALIDATE_PATH)
  return { error: null }
}

/** 슬롯 삭제 (OPEN/BLOCKED만) */
export async function deleteSlot(slotId: string): Promise<{ error: string | null }> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const ownerErr = await assertCoachOwnsSlot(coachId, slotId)
  if (ownerErr) return { error: ownerErr }

  const admin = createAdminClient()

  const { data: current } = await admin
    .from('lesson_slots')
    .select('status')
    .eq('id', slotId)
    .single()

  if (!current) return { error: '슬롯을 찾을 수 없습니다.' }
  if (current.status === 'BOOKED' || current.status === 'LOCKED') {
    return { error: '예약/배정된 슬롯은 삭제할 수 없습니다. 먼저 취소해주세요.' }
  }

  const { error } = await admin
    .from('lesson_slots')
    .delete()
    .eq('id', slotId)

  if (error) return { error: '슬롯 삭제에 실패했습니다.' }

  revalidatePath(REVALIDATE_PATH)
  return { error: null }
}

// ============================================================================
// 슬롯 조회
// ============================================================================

/** 코치별 슬롯 조회 (기간 필터) — BOOKED 슬롯에 예약자 정보 포함 */
export async function getSlotsByCoach(
  coachId: string,
  startDate: string,
  endDate: string
): Promise<{ error: string | null; data: LessonSlot[] }> {
  const { error: authErr, coachId: myCoachId, isAdmin } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr, data: [] }
  // 코치는 본인 슬롯만 조회 가능
  if (!isAdmin && myCoachId !== coachId) return { error: '접근 권한이 없습니다.', data: [] }

  const admin = createAdminClient()

  // slot_date <= endDate AND (last_session_date >= startDate OR slot_date >= startDate)
  // → 뷰 기간과 겹치는 패키지 모두 포함 (월 경계 넘는 패키지 지원)
  const { data: slots, error } = await admin
    .from('lesson_slots')
    .select('*, locked_member:club_members!locked_member_id(id, name)')
    .eq('coach_id', coachId)
    .lte('slot_date', endDate)
    .or(`last_session_date.gte.${startDate},slot_date.gte.${startDate}`)
    .neq('status', 'CANCELLED')
    .order('slot_date')
    .order('start_time')

  if (error) return { error: '슬롯 조회에 실패했습니다.', data: [] }

  // BOOKED 슬롯의 예약자 정보 JOIN
  const bookedSlotIds = (slots || []).filter((s) => s.status === 'BOOKED').map((s) => s.id)
  const bookingMap = new Map<string, LessonBooking>()

  if (bookedSlotIds.length > 0) {
    const { data: bookings } = await admin
      .from('lesson_bookings')
      .select('*, member:club_members!member_id(id, name)')
      .overlaps('slot_ids', bookedSlotIds)
      .neq('status', 'CANCELLED')

    // 회원별 session number 계산 (몇 번째 레슨인지)
    const memberIds = [...new Set((bookings || []).filter((b) => b.member_id).map((b) => b.member_id as string))]
    const memberSessionMap = new Map<string, Map<string, number>>() // memberId → (bookingId → sessionNumber)

    if (memberIds.length > 0) {
      const { data: allMemberBookings } = await admin
        .from('lesson_bookings')
        .select('id, member_id, created_at')
        .in('member_id', memberIds)
        .neq('status', 'CANCELLED')
        .order('created_at')

      for (const mb of allMemberBookings || []) {
        const mid = mb.member_id as string
        if (!memberSessionMap.has(mid)) memberSessionMap.set(mid, new Map())
        const map = memberSessionMap.get(mid)!
        map.set(mb.id, map.size + 1)
      }
    }

    for (const b of bookings || []) {
      const sessionNumber = b.member_id
        ? (memberSessionMap.get(b.member_id)?.get(b.id) ?? 1)
        : 1
      const bookingWithSession = { ...b, sessionNumber } as LessonBooking

      for (const sid of b.slot_ids as string[]) {
        if (bookedSlotIds.includes(sid)) {
          bookingMap.set(sid, bookingWithSession)
        }
      }
    }
  }

  const result = (slots || []).map((s) => ({
    ...s,
    booking: bookingMap.get(s.id) ?? null,
  }))

  return { error: null, data: result as LessonSlot[] }
}

/** BOOKED 예약 상세 + 회차 정보 조회 (어드민용) — bookingId로 직접 조회 */
export async function getBookingWithSessionInfo(bookingId: string): Promise<{
  error: string | null
  data: (LessonBooking & { sessionNumber: number; memberPhone: string | null; slotDates: string[] }) | null
}> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, data: null }

  const admin = createAdminClient()

  // 예약 조회 (회원 전화번호 포함)
  const { data: booking, error: bookingErr } = await admin
    .from('lesson_bookings')
    .select('*, member:club_members!member_id(id, name, phone)')
    .eq('id', bookingId)
    .single()

  if (bookingErr || !booking) return { error: null, data: null }

  let sessionNumber = 1
  let memberPhone: string | null = null

  if (booking.member_id) {
    const member = booking.member as { id: string; name: string; phone?: string | null } | null
    memberPhone = member?.phone ?? null

    // 이 회원의 전체 레슨 예약 중 날짜순 순번 계산
    const { data: allBookings } = await admin
      .from('lesson_bookings')
      .select('id, created_at')
      .eq('member_id', booking.member_id)
      .neq('status', 'CANCELLED')
      .order('created_at')

    const idx = allBookings?.findIndex((b) => b.id === booking.id) ?? -1
    sessionNumber = idx >= 0 ? idx + 1 : 1
  } else {
    memberPhone = booking.guest_phone ?? null
  }

  // 예약된 슬롯 날짜 조회 (시작일~마감일 표시용)
  const slotIds = booking.slot_ids as string[]
  const { data: slotRows } = await admin
    .from('lesson_slots')
    .select('slot_date')
    .in('id', slotIds)
    .order('slot_date')

  const slotDates = (slotRows ?? []).map((s) => s.slot_date as string)

  return {
    error: null,
    data: {
      ...(booking as LessonBooking),
      sessionNumber,
      memberPhone,
      slotDates,
    },
  }
}

/** 빈 슬롯 조회 (비회원 포함 공개) — 프로그램별 + 코치별 */
export async function getOpenSlotsByProgram(
  programId: string,
  coachId: string
): Promise<{ error: string | null; data: LessonSlot[] }> {
  const admin = createAdminClient()

  // 오늘 이후의 OPEN 슬롯만
  const today = new Date().toISOString().substring(0, 10)

  const { data: slots, error } = await admin
    .from('lesson_slots')
    .select('*')
    .eq('program_id', programId)
    .eq('coach_id', coachId)
    .eq('status', 'OPEN')
    .gte('slot_date', today)
    .order('slot_date')
    .order('start_time')

  if (error) return { error: '슬롯 조회에 실패했습니다.', data: [] }
  return { error: null, data: (slots || []) as LessonSlot[] }
}

/** OPEN 슬롯 공개 조회 — 코치별, 향후 3개월, 비로그인 접근 가능 */
export async function getPublicOpenSlots(
  coachId: string
): Promise<{ error: string | null; data: LessonSlot[] }> {
  const idErr = validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr, data: [] }

  const admin = createAdminClient()
  const today = new Date()
  const startDate = today.toISOString().substring(0, 10)
  // 3개월 뒤
  const end = new Date(today.getFullYear(), today.getMonth() + 3, 0)
  const endDate = end.toISOString().substring(0, 10)

  const { data: slots, error } = await admin
    .from('lesson_slots')
    .select('*, locked_member:club_members!locked_member_id(id, name)')
    .eq('coach_id', coachId)
    .eq('status', 'OPEN')
    .lte('slot_date', endDate)
    .or(`last_session_date.gte.${startDate},slot_date.gte.${startDate}`)
    .order('slot_date')
    .order('start_time')

  if (error) return { error: '슬롯 조회에 실패했습니다.', data: [] }
  return { error: null, data: (slots || []) as LessonSlot[] }
}

// ============================================================================
// 예약 CRUD
// ============================================================================

/** 예약 신청 (회원/비회원) */
export async function createBooking(
  input: CreateBookingInput
): Promise<{ error: string | null; data?: LessonBooking }> {
  if (!input.slot_ids || input.slot_ids.length === 0 || input.slot_ids.length > 2) {
    return { error: '슬롯을 1~2개 선택해주세요.' }
  }

  const sanitized = sanitizeObject(input)
  const admin = createAdminClient()

  // 로그인 사용자 자동 감지 → club_members.id 매핑
  let resolvedMemberId = input.member_id || null
  const currentUser = await getCurrentUser()

  if (currentUser && !resolvedMemberId) {
    const { data: member } = await admin
      .from('club_members')
      .select('id')
      .eq('user_id', currentUser.id)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle()

    if (member) {
      resolvedMemberId = member.id
    }
  }

  const isGuest = !resolvedMemberId
  if (isGuest) {
    if (!input.guest_name?.trim()) return { error: '이름을 입력해주세요.' }
    if (!input.guest_phone?.trim()) return { error: '연락처를 입력해주세요.' }
  }

  // 슬롯들 조회 + OPEN 확인
  const { data: slots, error: slotErr } = await admin
    .from('lesson_slots')
    .select('*')
    .in('id', input.slot_ids)

  if (slotErr || !slots || slots.length !== input.slot_ids.length) {
    return { error: '선택한 슬롯을 찾을 수 없습니다.' }
  }

  const nonOpen = slots.find((s) => s.status !== 'OPEN')
  if (nonOpen) {
    return { error: '이미 예약된 슬롯이 포함되어 있습니다. 다른 슬롯을 선택해주세요.' }
  }

  // booking_type 계산
  // 패키지 슬롯 단건(frequency 있음) → getBookingTypeForPackageSlot
  // 레거시 슬롯 또는 다중 선택 → calculateBookingType (역호환)
  const bookingType =
    slots.length === 1 && (slots[0] as LessonSlot).frequency !== null
      ? getBookingTypeForPackageSlot(slots[0] as LessonSlot)
      : calculateBookingType(slots as LessonSlot[])

  // 요금: 슬롯에 직접 저장된 fee_amount 사용
  const feeAmount = (slots[0] as LessonSlot).fee_amount ?? null

  // 슬롯 상태 BOOKED으로 변경
  const { error: updateErr } = await admin
    .from('lesson_slots')
    .update({ status: 'BOOKED' })
    .in('id', input.slot_ids)
    .eq('status', 'OPEN')

  if (updateErr) {
    return { error: '슬롯 예약 처리에 실패했습니다.' }
  }

  // 예약 생성
  const { data: booking, error: bookingErr } = await admin
    .from('lesson_bookings')
    .insert({
      member_id: isGuest ? null : resolvedMemberId,
      guest_name: isGuest ? sanitized.guest_name : null,
      guest_phone: isGuest ? sanitized.guest_phone : null,
      is_guest: isGuest,
      slot_ids: input.slot_ids,
      slot_count: input.slot_ids.length,
      booking_type: bookingType,
      fee_amount: feeAmount,
      status: 'PENDING',
      admin_note: input.note?.trim() || null,
    })
    .select()
    .single()

  if (bookingErr) {
    // 롤백: 슬롯 상태 복구
    await admin
      .from('lesson_slots')
      .update({ status: 'OPEN' })
      .in('id', input.slot_ids)
    return { error: '예약 생성에 실패했습니다.' }
  }

  revalidatePath(REVALIDATE_PATH)

  // 알림: 코치에게 새 예약 접수 인앱 알림 (fire-and-forget)
  try {
    const coachInfo = await getCoachInfoForSlots(admin, input.slot_ids)
    const customerName = isGuest ? (input.guest_name || '비회원') : '회원'
    if (coachInfo?.coachUserId) {
      await createNotification({
        user_id: coachInfo.coachUserId,
        type: NotificationType.LESSON_BOOKING_NEW,
        title: '새 레슨 예약 접수',
        message: `${customerName}님이 레슨을 예약했습니다. 확인 후 확정/거절해주세요.`,
        metadata: { link: '/admin/lessons' },
      })
    }
  } catch { /* 알림 실패는 메인 로직에 영향 없음 */ }

  return { error: null, data: booking as LessonBooking }
}

/** 예약 확정 (어드민/코치) */
export async function confirmBooking(bookingId: string): Promise<{ error: string | null }> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('lesson_bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: '예약을 찾을 수 없습니다.' }
  if (booking.status !== 'PENDING') return { error: '대기 중인 예약만 확정할 수 있습니다.' }

  const ownerErr = await assertCoachOwnsBooking(coachId, booking.slot_ids as string[])
  if (ownerErr) return { error: ownerErr }

  const { error } = await admin
    .from('lesson_bookings')
    .update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) return { error: '예약 확정에 실패했습니다.' }

  revalidatePath(REVALIDATE_PATH)

  // 알림: 고객에게 확정 알림 (fire-and-forget)
  try {
    const slotIds = booking.slot_ids as string[]
    const coachInfo = await getCoachInfoForSlots(admin, slotIds)

    if (booking.is_guest) {
      // 비회원: 알림톡만 발송
      if (booking.guest_phone) {
        await sendLessonConfirmAlimtalk({
          customerPhone: booking.guest_phone,
          customerName: booking.guest_name || '고객',
          bankInfo: coachInfo?.bankAccount || '-',
          lessonStartDate: '-',
          lessonInfo: coachInfo?.coachName ? `${coachInfo.coachName} 코치` : '-',
          lessonDays: '-',
        })
      }
    } else if (booking.member_id) {
      // 회원: 인앱 알림 + 알림톡
      const memberInfo = await getMemberInfo(admin, booking.member_id)
      if (memberInfo) {
        await createNotification({
          user_id: memberInfo.userId,
          type: NotificationType.LESSON_BOOKING_CONFIRMED,
          title: '레슨 예약 확정',
          message: `${coachInfo?.coachName || '코치'}님의 레슨 예약이 확정되었습니다.`,
          metadata: { link: '/my/lessons' },
        })
        if (memberInfo.phone) {
          await sendLessonConfirmAlimtalk({
            customerPhone: memberInfo.phone,
            customerName: memberInfo.name,
            bankInfo: coachInfo?.bankAccount || '-',
            lessonStartDate: '-',
            lessonInfo: coachInfo?.coachName ? `${coachInfo.coachName} 코치` : '-',
            lessonDays: '-',
          })
        }
      }
    }
  } catch { /* 알림 실패는 메인 로직에 영향 없음 */ }

  return { error: null }
}

/** 예약 취소 (어드민/코치) — 슬롯 OPEN 복구 */
export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ error: string | null }> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('lesson_bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: '예약을 찾을 수 없습니다.' }
  if (booking.status === 'CANCELLED') return { error: '이미 취소된 예약입니다.' }

  const ownerErr = await assertCoachOwnsBooking(coachId, booking.slot_ids as string[])
  if (ownerErr) return { error: ownerErr }

  // 예약 취소
  const { error } = await admin
    .from('lesson_bookings')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancel_reason: reason || null,
    })
    .eq('id', bookingId)

  if (error) return { error: '예약 취소에 실패했습니다.' }

  // 슬롯 상태 OPEN으로 복구
  await admin
    .from('lesson_slots')
    .update({ status: 'OPEN' })
    .in('id', booking.slot_ids)
    .eq('status', 'BOOKED')

  revalidatePath(REVALIDATE_PATH)

  // 알림: 고객에게 취소 알림 (fire-and-forget)
  try {
    const slotIds = booking.slot_ids as string[]
    const coachInfo = await getCoachInfoForSlots(admin, slotIds)

    if (booking.is_guest) {
      // 비회원: 알림톡만 발송
      if (booking.guest_phone) {
        await sendLessonBookingCancelAlimtalk({
          customerPhone: booking.guest_phone,
          customerName: booking.guest_name || '고객',
          coachName: coachInfo?.coachName || '-',
          reason: reason || '사유 없음',
        })
      }
    } else if (booking.member_id) {
      // 회원: 인앱 알림 + 알림톡
      const memberInfo = await getMemberInfo(admin, booking.member_id)
      if (memberInfo) {
        await createNotification({
          user_id: memberInfo.userId,
          type: NotificationType.LESSON_BOOKING_CANCELLED,
          title: '레슨 예약 취소',
          message: reason
            ? `${coachInfo?.coachName || '코치'}님의 레슨 예약이 취소되었습니다. 사유: ${reason}`
            : `${coachInfo?.coachName || '코치'}님의 레슨 예약이 취소되었습니다.`,
          metadata: { link: '/my/lessons' },
        })
        if (memberInfo.phone) {
          await sendLessonBookingCancelAlimtalk({
            customerPhone: memberInfo.phone,
            customerName: memberInfo.name,
            coachName: coachInfo?.coachName || '-',
            reason: reason || '사유 없음',
          })
        }
      }
    }
  } catch { /* 알림 실패는 메인 로직에 영향 없음 */ }

  return { error: null }
}

/** 예약 메모 업데이트 (어드민/코치) */
export async function updateBookingNote(
  bookingId: string,
  note: string
): Promise<{ error: string | null }> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

  // 코치 소유권 확인
  if (coachId) {
    const { data: booking } = await admin
      .from('lesson_bookings')
      .select('slot_ids')
      .eq('id', bookingId)
      .single()
    const ownerErr = await assertCoachOwnsBooking(coachId, (booking?.slot_ids as string[]) ?? [])
    if (ownerErr) return { error: ownerErr }
  }

  const { error } = await admin
    .from('lesson_bookings')
    .update({ admin_note: note || null })
    .eq('id', bookingId)

  if (error) return { error: '메모 저장에 실패했습니다.' }

  revalidatePath(REVALIDATE_PATH)
  return { error: null }
}

// ============================================================================
// 예약 조회
// ============================================================================

/** 예약 목록 조회 (어드민) */
export async function getBookings(filters?: {
  status?: LessonBookingStatus
  isGuest?: boolean
  programId?: string
  coachId?: string // 코치 모드: 해당 코치 슬롯의 예약만 조회
}): Promise<{ error: string | null; data: LessonBooking[] }> {
  const { error: authErr, coachId: myCoachId, isAdmin } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr, data: [] }

  // 코치는 본인 slotId 목록으로만 조회 가능
  const filterCoachId = isAdmin ? filters?.coachId : myCoachId
  const admin = createAdminClient()

  let slotIdFilter: string[] | null = null
  if (filterCoachId) {
    const { data: coachSlots } = await admin
      .from('lesson_slots')
      .select('id')
      .eq('coach_id', filterCoachId)
    slotIdFilter = (coachSlots ?? []).map((s) => s.id)
    if (slotIdFilter.length === 0) return { error: null, data: [] }
  }

  let query = admin
    .from('lesson_bookings')
    .select('*, member:club_members!member_id(id, name)')
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.isGuest !== undefined) query = query.eq('is_guest', filters.isGuest)
  // slot_ids는 배열 컬럼 — overlaps로 필터
  if (slotIdFilter) query = query.overlaps('slot_ids', slotIdFilter)

  const { data: bookings, error } = await query

  if (error) return { error: '예약 목록 조회에 실패했습니다.', data: [] }

  // 슬롯 정보 조인
  if (bookings && bookings.length > 0) {
    const allSlotIds = bookings.flatMap((b) => b.slot_ids)
    const uniqueSlotIds = [...new Set(allSlotIds)]

    const { data: slots } = await admin
      .from('lesson_slots')
      .select('*')
      .in('id', uniqueSlotIds)

    const slotMap = new Map((slots || []).map((s) => [s.id, s]))

    for (const booking of bookings) {
      ;(booking as LessonBooking).slots = booking.slot_ids
        .map((id: string) => slotMap.get(id))
        .filter(Boolean) as LessonSlot[]
    }
  }

  return { error: null, data: (bookings || []) as LessonBooking[] }
}


// ============================================================================
// 세션 관리 (진행 여부 · 연기 · 연장)
// ============================================================================

/** 로컬 타임존 기준 YYYY-MM-DD 변환 (toISOString은 UTC로 변환되어 +9 환경에서 날짜가 밀림) */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 슬롯의 sessions JSONB 전체를 업데이트 (진행 여부 토글 등)
 * - sessions 배열을 통째로 교체하므로 클라이언트에서 변경된 배열을 전달
 */
export interface UpdatedSlotMeta {
  sessions: SlotSession[]
  totalSessions: number
  lastSessionDate: string | null
}

/**
 * 슬롯의 sessions JSONB 전체를 업데이트 (진행 여부 토글 등)
 * - 성공 시 클라이언트가 로컬 상태를 직접 갱신할 수 있도록 updated 메타 반환
 * - revalidatePath 미사용 — router refresh 없이 클라이언트 상태로만 동기화
 */
export async function updateSlotSessions(
  slotId: string,
  sessions: SlotSession[],
): Promise<{ error: string | null } & Partial<UpdatedSlotMeta>> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const idErr = validateId(slotId, '슬롯 ID')
  if (idErr) return { error: idErr }

  const ownerErr = await assertCoachOwnsSlot(coachId, slotId)
  if (ownerErr) return { error: ownerErr }

  const admin = createAdminClient()

  // last_session_date: CANCELLED 제외한 세션 중 마지막 날짜
  const activeDates = sessions
    .filter((s) => s.status !== 'CANCELLED')
    .map((s) => s.slot_date)
    .sort()
  const lastSessionDate = activeDates[activeDates.length - 1] ?? null
  const totalSessions = sessions.filter((s) => s.status !== 'CANCELLED').length

  const { error } = await admin
    .from('lesson_slots')
    .update({ sessions, last_session_date: lastSessionDate, total_sessions: totalSessions })
    .eq('id', slotId)

  if (error) return { error: '세션 정보 업데이트에 실패했습니다.' }

  return { error: null, sessions, totalSessions, lastSessionDate }
}

/**
 * 특정 세션을 1주 연기
 * - 원래 세션: status → RESCHEDULED, note 기록
 * - 새 세션: 1주 뒤 같은 요일, 같은 시간으로 append
 */
export async function rescheduleSession(
  slotId: string,
  originalDate: string,
  makeupDate: string,
  makeupStartTime?: string,
  makeupEndTime?: string,
  reason?: string,
): Promise<{ error: string | null; newDate?: string } & Partial<UpdatedSlotMeta>> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const ownerErr = await assertCoachOwnsSlot(coachId, slotId)
  if (ownerErr) return { error: ownerErr }

  const admin = createAdminClient()
  const { data: slot, error: fetchErr } = await admin
    .from('lesson_slots')
    .select('sessions, last_session_date, total_sessions')
    .eq('id', slotId)
    .single()

  if (fetchErr || !slot) return { error: '슬롯 조회에 실패했습니다.' }

  const sessions: SlotSession[] = slot.sessions ?? []
  const target = sessions.find((s) => s.slot_date === originalDate)
  if (!target) return { error: '해당 날짜의 세션을 찾을 수 없습니다.' }

  const newDate = makeupDate

  // 보강 날짜가 원래 날짜 이후여야 함
  if (newDate <= originalDate) {
    return { error: '보강 날짜는 연기 날짜 이후여야 합니다.' }
  }

  // 이미 같은 날짜 세션이 있으면 거부
  if (sessions.some((s) => s.slot_date === newDate)) {
    return { error: `${newDate}에 이미 세션이 있습니다.` }
  }

  const updated: SlotSession[] = sessions.map((s) =>
    s.slot_date === originalDate
      ? { ...s, status: 'RESCHEDULED' as const, note: reason ?? s.note }
      : s,
  )
  // 연기된 새 세션 추가 (시간 지정 시 사용, 미지정 시 원본 시간 유지)
  updated.push({
    slot_date: newDate,
    start_time: makeupStartTime ?? target.start_time,
    end_time: makeupEndTime ?? target.end_time,
    status: 'SCHEDULED',
    original_date: originalDate,
    note: reason,
  })
  // 날짜 순 정렬
  updated.sort((a, b) => a.slot_date.localeCompare(b.slot_date))

  const result = await updateSlotSessions(slotId, updated)
  if (result.error) return result

  return { error: null, newDate, sessions: result.sessions, totalSessions: result.totalSessions, lastSessionDate: result.lastSessionDate }
}

/**
 * 패키지 연장: 현재 슬롯과 동일한 설정으로 신규 슬롯 + CONFIRMED 예약을 생성
 * - 기존 슬롯의 sessions는 변경하지 않음 (월별 독립 슬롯으로 관리)
 * - 마지막 활성 세션 이후 동일 요일 패턴으로 N주 세션 생성
 */
export async function extendSlot(
  slotId: string,
  additionalWeeks: number,
): Promise<{ error: string | null; newSlotId?: string }> {
  const { error: authErr, coachId } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const ownerErr = await assertCoachOwnsSlot(coachId, slotId)
  if (ownerErr) return { error: ownerErr }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  if (additionalWeeks < 1 || additionalWeeks > 8) {
    return { error: '연장 가능 범위는 1~8주입니다.' }
  }

  const admin = createAdminClient()

  // 현재 슬롯 전체 조회 (복사에 필요한 모든 필드)
  const { data: slot, error: fetchErr } = await admin
    .from('lesson_slots')
    .select('*')
    .eq('id', slotId)
    .single()

  if (fetchErr || !slot) return { error: '슬롯 조회에 실패했습니다.' }

  const sessions: SlotSession[] = slot.sessions ?? []
  if (sessions.length === 0) return { error: '세션 정보가 없습니다.' }

  // 취소되지 않은 세션에서 요일별 시간 패턴 추출
  const activeSessions = sessions.filter((s) => s.status !== 'CANCELLED')
  const dayTimeMap = new Map<number, { start_time: string; end_time: string }>()
  for (const s of activeSessions) {
    const dow = new Date(s.slot_date + 'T00:00:00').getDay()
    if (!dayTimeMap.has(dow)) {
      dayTimeMap.set(dow, { start_time: s.start_time, end_time: s.end_time })
    }
  }

  // 마지막 활성 세션 날짜 기준으로 새 세션 날짜 계산
  const lastDate = activeSessions.map((s) => s.slot_date).sort().reverse()[0]
  const lastDt = new Date(lastDate + 'T00:00:00')

  const newSessions: SlotSession[] = []
  const dowList = [...dayTimeMap.entries()].sort((a, b) => a[0] - b[0])

  for (let week = 1; week <= additionalWeeks; week++) {
    for (const [dow, times] of dowList) {
      const base = new Date(lastDt)
      const diffDays = ((dow - lastDt.getDay() + 7) % 7 || 7) + (week - 1) * 7
      base.setDate(lastDt.getDate() + diffDays)
      const newDate = toLocalDateStr(base)

      if (!newSessions.some((s) => s.slot_date === newDate)) {
        newSessions.push({
          slot_date: newDate,
          start_time: times.start_time,
          end_time: times.end_time,
          status: 'SCHEDULED',
        })
      }
    }
  }

  newSessions.sort((a, b) => a.slot_date.localeCompare(b.slot_date))
  if (newSessions.length === 0) return { error: '생성할 새 세션이 없습니다.' }

  const first = newSessions[0]
  const last = newSessions[newSessions.length - 1]

  // 신규 슬롯 생성 (기존 슬롯 설정 복사 + 새 세션)
  const { data: newSlot, error: slotErr } = await admin
    .from('lesson_slots')
    .insert({
      coach_id: slot.coach_id,
      program_id: slot.program_id,
      slot_date: first.slot_date,
      start_time: first.start_time,
      end_time: first.end_time,
      day_type: getDayType(first.slot_date),
      frequency: slot.frequency,
      duration_minutes: slot.duration_minutes,
      total_sessions: newSessions.length,
      sessions: newSessions,
      last_session_date: last.slot_date,
      fee_amount: slot.fee_amount,
      locked_member_id: slot.locked_member_id,
      status: 'BOOKED',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (slotErr || !newSlot) return { error: '신규 슬롯 생성에 실패했습니다.' }

  // 기존 예약에서 예약자 정보 조회
  const { data: booking } = await admin
    .from('lesson_bookings')
    .select('member_id, guest_name, guest_phone, is_guest, booking_type, fee_amount')
    .overlaps('slot_ids', [slotId])
    .neq('status', 'CANCELLED')
    .limit(1)
    .maybeSingle()

  if (booking) {
    const { error: bookingErr } = await admin
      .from('lesson_bookings')
      .insert({
        member_id: booking.member_id,
        guest_name: booking.guest_name,
        guest_phone: booking.guest_phone,
        is_guest: booking.is_guest,
        slot_ids: [newSlot.id],
        slot_count: 1,
        booking_type: booking.booking_type,
        fee_amount: booking.fee_amount,
        status: 'CONFIRMED',
        confirmed_at: new Date().toISOString(),
        admin_note: '패키지 연장',
      })

    if (bookingErr) {
      // 롤백: 새 슬롯 삭제
      await admin.from('lesson_slots').delete().eq('id', newSlot.id)
      return { error: '신규 예약 생성에 실패했습니다.' }
    }
  }

  // 구 슬롯에 연장 완료 표시
  await admin
    .from('lesson_slots')
    .update({ extended_at: new Date().toISOString() })
    .eq('id', slotId)

  revalidatePath(REVALIDATE_PATH)
  return { error: null, newSlotId: newSlot.id }
}

/**
 * 위자드로 직접 구성한 세션으로 패키지 연장
 * - 기존 슬롯의 예약자 정보를 복사하여 새 슬롯 + CONFIRMED 예약 생성
 */
export async function extendSlotWithWizard(
  oldSlotId: string,
  coachId: string,
  input: CreateSlotInput,
): Promise<{ error: string | null }> {
  const { error: authErr, coachId: myCoachId, isAdmin } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }
  if (!isAdmin && myCoachId !== coachId) return { error: '본인 슬롯만 연장할 수 있습니다.' }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  if (!input.sessions.length) return { error: '생성할 세션이 없습니다.' }

  const admin = createAdminClient()

  const first = input.sessions[0]
  const last = input.sessions[input.sessions.length - 1]

  // 신규 슬롯 생성 (BOOKED 상태 — 예약자 있음)
  const { data: newSlot, error: slotErr } = await admin
    .from('lesson_slots')
    .insert({
      coach_id:        coachId,
      slot_date:       first.slot_date,
      start_time:      first.start_time,
      end_time:        first.end_time,
      day_type:        getDayType(first.slot_date),
      frequency:       input.frequency,
      duration_minutes: input.duration_minutes,
      total_sessions:  input.total_sessions,
      sessions:        input.sessions,
      last_session_date: last.slot_date,
      fee_amount:      input.fee_amount,
      status:          'BOOKED',
      created_by:      user.id,
    })
    .select('id')
    .single()

  if (slotErr || !newSlot) return { error: '신규 슬롯 생성에 실패했습니다.' }

  // 기존 예약에서 예약자 정보 복사
  const { data: oldBooking } = await admin
    .from('lesson_bookings')
    .select('member_id, guest_name, guest_phone, is_guest, booking_type, fee_amount')
    .overlaps('slot_ids', [oldSlotId])
    .neq('status', 'CANCELLED')
    .limit(1)
    .maybeSingle()

  if (oldBooking) {
    const { error: bookingErr } = await admin
      .from('lesson_bookings')
      .insert({
        member_id:    oldBooking.member_id,
        guest_name:   oldBooking.guest_name,
        guest_phone:  oldBooking.guest_phone,
        is_guest:     oldBooking.is_guest,
        slot_ids:     [newSlot.id],
        slot_count:   1,
        booking_type: getBookingTypeForPackageSlot({ sessions: input.sessions, frequency: input.frequency } as LessonSlot),
        fee_amount:   input.fee_amount ?? oldBooking.fee_amount,
        status:       'CONFIRMED',
        confirmed_at: new Date().toISOString(),
        admin_note:   '패키지 연장',
      })

    if (bookingErr) {
      await admin.from('lesson_slots').delete().eq('id', newSlot.id)
      return { error: '신규 예약 생성에 실패했습니다.' }
    }
  }

  // 구 슬롯에 연장 완료 표시
  await admin
    .from('lesson_slots')
    .update({ extended_at: new Date().toISOString() })
    .eq('id', oldSlotId)

  revalidatePath(REVALIDATE_PATH)
  return { error: null }
}

// ============================================================================
// 내 예약 (마이페이지)
// ============================================================================

/** 내 예약에 필요한 슬롯+코치+프로그램 정보 */
export interface MyBookingDetail {
  booking: LessonBooking
  slots: Array<LessonSlot & {
    coach?: { name: string; profile_image_url: string | null } | null
    program?: { title: string; coach?: { name: string; profile_image_url: string | null } } | null
  }>
}

/** 로그인 회원의 예약 목록 조회 */
export async function getMyBookings(): Promise<{
  error: string | null
  data: MyBookingDetail[]
}> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', data: [] }

  const admin = createAdminClient()

  // user_id → club_members.id 조회
  const { data: members } = await admin
    .from('club_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  if (!members || members.length === 0) return { error: null, data: [] }

  const memberIds = members.map((m) => m.id)

  // 예약 목록 조회
  const { data: bookings, error: bookingErr } = await admin
    .from('lesson_bookings')
    .select('*')
    .in('member_id', memberIds)
    .order('created_at', { ascending: false })

  if (bookingErr) return { error: '예약 목록 조회에 실패했습니다.', data: [] }
  if (!bookings || bookings.length === 0) return { error: null, data: [] }

  // 슬롯 상세 조회 (프로그램+코치 포함)
  const allSlotIds = bookings.flatMap((b) => b.slot_ids)
  const uniqueSlotIds = [...new Set(allSlotIds)]

  const { data: slots } = await admin
    .from('lesson_slots')
    .select('*, coach:coaches!coach_id(name, profile_image_url), program:lesson_programs!program_id(title)')
    .in('id', uniqueSlotIds)

  const slotMap = new Map((slots || []).map((s) => [s.id, s]))

  const details: MyBookingDetail[] = bookings.map((booking) => ({
    booking: booking as LessonBooking,
    slots: booking.slot_ids
      .map((id: string) => slotMap.get(id))
      .filter(Boolean) as MyBookingDetail['slots'],
  }))

  return { error: null, data: details }
}

/** 내 예약 취소 (본인만) */
export async function cancelMyBooking(
  bookingId: string
): Promise<{ error: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const idErr = validateId(bookingId, '예약 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  // 본인 확인
  const { data: members } = await admin
    .from('club_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  if (!members || members.length === 0) return { error: '회원 정보를 찾을 수 없습니다.' }

  const memberIds = members.map((m) => m.id)

  const { data: booking } = await admin
    .from('lesson_bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: '예약을 찾을 수 없습니다.' }
  if (!memberIds.includes(booking.member_id)) return { error: '본인의 예약만 취소할 수 있습니다.' }
  if (booking.status === 'CANCELLED') return { error: '이미 취소된 예약입니다.' }

  // 예약 취소
  const { error } = await admin
    .from('lesson_bookings')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancel_reason: '회원 직접 취소',
    })
    .eq('id', bookingId)

  if (error) return { error: '예약 취소에 실패했습니다.' }

  // 슬롯 OPEN 복구
  await admin
    .from('lesson_slots')
    .update({ status: 'OPEN' })
    .in('id', booking.slot_ids)
    .eq('status', 'BOOKED')

  revalidatePath('/my/lessons')
  return { error: null }
}

/** 클럽 회원 검색 (어드민 배정용) */
export async function searchClubMembers(
  query: string
): Promise<{ error: string | null; data: Array<{ id: string; name: string }> }> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, data: [] }

  if (!query || query.trim().length < 1) return { error: null, data: [] }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('club_members')
    .select('id, name')
    .ilike('name', `%${query.trim()}%`)
    .limit(10)

  if (error) return { error: '회원 검색에 실패했습니다.', data: [] }
  return { error: null, data: data || [] }
}

// ============================================================================
// 레슨 문의
// ============================================================================

/** 레슨 신청 문의 등록 (슬롯 없을 때 — 비로그인 접근 가능) */
export async function createLessonInquiry(input: {
  coachId: string
  name: string
  phone: string
  preferredDays: string[]
  preferredTime: string
  message: string
}): Promise<{ error: string | null }> {
  const { coachId, name, phone, preferredDays, preferredTime, message } = input

  if (!name.trim()) return { error: '이름을 입력해주세요.' }
  if (!phone.trim()) return { error: '연락처를 입력해주세요.' }
  if (preferredDays.length === 0) return { error: '희망 요일을 선택해주세요.' }
  if (!preferredTime.trim()) return { error: '희망 시간대를 입력해주세요.' }

  const admin = createAdminClient()
  const { error } = await admin
    .from('lesson_inquiries')
    .insert({
      coach_id: coachId,
      name: name.trim(),
      phone: phone.trim(),
      preferred_days: preferredDays,
      preferred_time: preferredTime.trim(),
      message: message.trim() || '',
      status: 'PENDING',
    })

  if (error) return { error: '신청 접수에 실패했습니다. 다시 시도해주세요.' }
  return { error: null }
}

/** 어드민: 전체 레슨 문의 조회 */
export async function getAdminLessonInquiries(filterCoachId?: string): Promise<{ data: LessonInquiry[]; error: string | null }> {
  const { error: authErr, coachId: myCoachId, isAdmin } = await checkCoachOrAdminAuth()
  if (authErr) return { data: [], error: authErr }

  // 코치는 본인 코치 ID로 강제 필터
  const coachIdFilter = isAdmin ? filterCoachId : (myCoachId ?? undefined)

  const admin = createAdminClient()
  let query = admin
    .from('lesson_inquiries')
    .select('id, name, phone, message, status, admin_note, created_at, coach_id, preferred_days, preferred_time, coach:coaches!coach_id(id, name)')
    .order('created_at', { ascending: false })

  if (coachIdFilter) query = query.eq('coach_id', coachIdFilter)

  const { data, error } = await query

  if (error) return { data: [], error: '문의 목록 조회에 실패했습니다.' }
  return { data: (data as unknown as LessonInquiry[]) || [], error: null }
}

/** 어드민/코치: 문의 상태 + 메모 업데이트 */
export async function updateInquiryStatus(
  inquiryId: string,
  status: LessonInquiryStatus,
  adminNote?: string
): Promise<{ error: string | null }> {
  const { error: authErr } = await checkCoachOrAdminAuth()
  if (authErr) return { error: authErr }

  const idErr = validateId(inquiryId, '문의 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()
  const { error } = await admin
    .from('lesson_inquiries')
    .update({ status, admin_note: adminNote ?? null })
    .eq('id', inquiryId)

  if (error) return { error: '문의 상태 업데이트에 실패했습니다.' }
  revalidatePath(REVALIDATE_PATH)
  return { error: null }
}

/** 로그인 회원의 프로필 조회 (예약 폼 자동 채움용) */
/**
 * 현재 로그인 유저의 활성 레슨 예약 여부 (CONFIRMED | PENDING)
 * Nav 메뉴 "레슨문의 → 레슨현황" 전환용 경량 체크
 */
export async function hasActiveLesson(): Promise<boolean> {
  const user = await getCurrentUser()
  if (!user) return false

  const admin = createAdminClient()

  const { data: members } = await admin
    .from('club_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  if (!members?.length) return false

  const memberIds = members.map((m) => m.id)

  const { count } = await admin
    .from('lesson_bookings')
    .select('id', { count: 'exact', head: true })
    .in('member_id', memberIds)
    .in('status', ['CONFIRMED', 'PENDING'])

  return (count ?? 0) > 0
}

export async function getCurrentMemberProfile(): Promise<{
  name: string
  phone: string
} | null> {
  // getCurrentUser()가 profiles 테이블에서 복호화된 name/phone 반환
  const currentUser = await getCurrentUser()
  if (!currentUser) return null
  return {
    name: currentUser.name ?? '',
    phone: currentUser.phone ?? '',
  }
}

/** 로그인 회원의 레슨 문의 목록 조회 (전화번호 기반) */
export async function getMyInquiries(): Promise<{
  error: string | null
  data: LessonInquiry[]
}> {
  const currentUser = await getCurrentUser()
  if (!currentUser) return { error: '로그인이 필요합니다.', data: [] }

  const phone = currentUser.phone?.trim()
  if (!phone) return { error: null, data: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('lesson_inquiries')
    .select('id, name, phone, message, status, admin_note, created_at, coach_id, preferred_days, preferred_time, coach:coaches!coach_id(id, name)')
    .eq('phone', phone)
    .order('created_at', { ascending: false })

  if (error) return { error: '문의 목록 조회에 실패했습니다.', data: [] }
  return { error: null, data: (data as unknown as LessonInquiry[]) || [] }
}
