'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeObject } from '@/lib/utils/validation'
import type { LessonProgram } from './types'
import type {
  LessonSlot,
  LessonBooking,
  LessonSlotStatus,
  LessonBookingStatus,
  LessonBookingType,
  CreateSlotInput,
  CreateBookingInput,
} from './slot-types'
import { getDayType, isTimeInRange, calculateBookingType, getFeeFieldByBookingType } from './slot-types'

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

const REVALIDATE_PATH = '/admin/lessons'

// ============================================================================
// 슬롯 CRUD
// ============================================================================

/** 슬롯 단건 생성 */
export async function createSlot(
  programId: string,
  coachId: string,
  data: CreateSlotInput
): Promise<{ error: string | null; data?: LessonSlot }> {
  const { error: authErr, user } = await checkAdminAuth()
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  const idErr = validateId(programId, '프로그램 ID') || validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr }

  if (!data.slot_date || !data.start_time || !data.end_time) {
    return { error: '날짜와 시간을 입력해주세요.' }
  }

  // 가용 시간 범위 검증
  if (!isTimeInRange(data.slot_date, data.start_time, data.end_time)) {
    return { error: '해당 요일의 레슨 가능 시간 범위를 벗어납니다.' }
  }

  const dayType = getDayType(data.slot_date)
  const admin = createAdminClient()

  // 중복 슬롯 체크
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

/** 반복 슬롯 일괄 생성 */
export async function createRepeatingSlots(
  programId: string,
  coachId: string,
  slots: CreateSlotInput[]
): Promise<{ error: string | null; count: number }> {
  const { error: authErr, user } = await checkAdminAuth()
  if (authErr || !user) return { error: authErr || '권한이 없습니다.', count: 0 }

  if (!slots.length) return { error: '생성할 슬롯이 없습니다.', count: 0 }

  // 시간 범위 검증
  for (const s of slots) {
    if (!isTimeInRange(s.slot_date, s.start_time, s.end_time)) {
      const d = new Date(s.slot_date + 'T00:00:00')
      const dayLabel = d.toLocaleDateString('ko-KR', { weekday: 'short' })
      return { error: `${s.slot_date}(${dayLabel}) ${s.start_time}~${s.end_time}은 가능 시간 범위를 벗어납니다.`, count: 0 }
    }
  }

  const admin = createAdminClient()
  const rows = slots.map((s) => ({
    program_id: programId,
    coach_id: coachId,
    slot_date: s.slot_date,
    start_time: s.start_time,
    end_time: s.end_time,
    day_type: getDayType(s.slot_date),
    status: 'OPEN' as const,
    created_by: user.id,
  }))

  const { data, error } = await admin
    .from('lesson_slots')
    .upsert(rows, {
      onConflict: 'coach_id,slot_date,start_time',
      ignoreDuplicates: true,
    })
    .select('id')

  if (error) return { error: '슬롯 일괄 생성에 실패했습니다.', count: 0 }

  revalidatePath(REVALIDATE_PATH)
  return { error: null, count: data?.length ?? rows.length }
}

/** 슬롯 상태 변경 (OPEN ↔ BLOCKED) */
export async function updateSlotStatus(
  slotId: string,
  status: LessonSlotStatus
): Promise<{ error: string | null }> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const idErr = validateId(slotId, '슬롯 ID')
  if (idErr) return { error: idErr }

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
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const idErr = validateId(slotId, '슬롯 ID') || validateId(memberId, '회원 ID')
  if (idErr) return { error: idErr }

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
  return { error: null }
}

/** LOCKED 해제 → OPEN 복구 */
export async function unlockSlot(slotId: string): Promise<{ error: string | null }> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

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
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

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

/** 코치별 슬롯 조회 (기간 필터) */
export async function getSlotsByCoach(
  coachId: string,
  startDate: string,
  endDate: string
): Promise<{ error: string | null; data: LessonSlot[] }> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, data: [] }

  const admin = createAdminClient()

  const { data: slots, error } = await admin
    .from('lesson_slots')
    .select('*, locked_member:club_members!locked_member_id(id, name)')
    .eq('coach_id', coachId)
    .gte('slot_date', startDate)
    .lte('slot_date', endDate)
    .neq('status', 'CANCELLED')
    .order('slot_date')
    .order('start_time')

  if (error) return { error: '슬롯 조회에 실패했습니다.', data: [] }
  return { error: null, data: (slots || []) as LessonSlot[] }
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

// ============================================================================
// 예약 CRUD
// ============================================================================

/** 예약 신청 (회원/비회원) */
export async function createBooking(
  programId: string,
  input: CreateBookingInput
): Promise<{ error: string | null; data?: LessonBooking }> {
  if (!input.slot_ids || input.slot_ids.length === 0 || input.slot_ids.length > 2) {
    return { error: '슬롯을 1~2개 선택해주세요.' }
  }

  const isGuest = !input.member_id
  if (isGuest) {
    if (!input.guest_name?.trim()) return { error: '이름을 입력해주세요.' }
    if (!input.guest_phone?.trim()) return { error: '연락처를 입력해주세요.' }
  }

  const sanitized = sanitizeObject(input)
  const admin = createAdminClient()

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
  const bookingType = calculateBookingType(slots as LessonSlot[])

  // 요금 계산
  const { data: program } = await admin
    .from('lesson_programs')
    .select('fee_weekday_1, fee_weekday_2, fee_weekend_1, fee_weekend_2, fee_mixed_2')
    .eq('id', programId)
    .single()

  const feeField = getFeeFieldByBookingType(bookingType)
  const feeAmount = program ? (program as Record<string, number | null>)[feeField] ?? null : null

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
      member_id: isGuest ? null : sanitized.member_id,
      guest_name: isGuest ? sanitized.guest_name : null,
      guest_phone: isGuest ? sanitized.guest_phone : null,
      is_guest: isGuest,
      slot_ids: input.slot_ids,
      slot_count: input.slot_ids.length,
      booking_type: bookingType,
      fee_amount: feeAmount,
      status: 'PENDING',
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
  return { error: null, data: booking as LessonBooking }
}

/** 예약 확정 (어드민) */
export async function confirmBooking(bookingId: string): Promise<{ error: string | null }> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('lesson_bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: '예약을 찾을 수 없습니다.' }
  if (booking.status !== 'PENDING') return { error: '대기 중인 예약만 확정할 수 있습니다.' }

  const { error } = await admin
    .from('lesson_bookings')
    .update({ status: 'CONFIRMED', confirmed_at: new Date().toISOString() })
    .eq('id', bookingId)

  if (error) return { error: '예약 확정에 실패했습니다.' }

  revalidatePath(REVALIDATE_PATH)
  return { error: null }
}

/** 예약 취소 (어드민) — 슬롯 OPEN 복구 */
export async function cancelBooking(
  bookingId: string,
  reason?: string
): Promise<{ error: string | null }> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

  const { data: booking } = await admin
    .from('lesson_bookings')
    .select('*')
    .eq('id', bookingId)
    .single()

  if (!booking) return { error: '예약을 찾을 수 없습니다.' }
  if (booking.status === 'CANCELLED') return { error: '이미 취소된 예약입니다.' }

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
  return { error: null }
}

/** 예약 메모 업데이트 (어드민) */
export async function updateBookingNote(
  bookingId: string,
  note: string
): Promise<{ error: string | null }> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

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
}): Promise<{ error: string | null; data: LessonBooking[] }> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, data: [] }

  const admin = createAdminClient()

  let query = admin
    .from('lesson_bookings')
    .select('*, member:club_members!member_id(id, name)')
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.isGuest !== undefined) query = query.eq('is_guest', filters.isGuest)

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

/** 프로그램의 코치 목록 조회 (공개) */
export async function getProgramCoaches(
  programId: string
): Promise<{ error: string | null; data: Array<{ id: string; name: string; profile_image_url: string | null }> }> {
  const admin = createAdminClient()

  // 해당 프로그램의 코치
  const { data: program } = await admin
    .from('lesson_programs')
    .select('coach_id, coach:coaches(id, name, profile_image_url)')
    .eq('id', programId)
    .single()

  if (!program?.coach) return { error: null, data: [] }

  const coach = program.coach as { id: string; name: string; profile_image_url: string | null }
  return { error: null, data: [coach] }
}

/** 프로그램 정보 조회 (요금 포함, 공개) */
export async function getProgramFees(
  programId: string
): Promise<{
  error: string | null
  data: Pick<LessonProgram, 'fee_weekday_1' | 'fee_weekday_2' | 'fee_weekend_1' | 'fee_weekend_2' | 'fee_mixed_2' | 'title'> | null
}> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('lesson_programs')
    .select('title, fee_weekday_1, fee_weekday_2, fee_weekend_1, fee_weekend_2, fee_mixed_2')
    .eq('id', programId)
    .single()

  if (error || !data) return { error: '프로그램 정보를 찾을 수 없습니다.', data: null }
  return { error: null, data: data as Pick<LessonProgram, 'fee_weekday_1' | 'fee_weekday_2' | 'fee_weekend_1' | 'fee_weekend_2' | 'fee_mixed_2' | 'title'> }
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
