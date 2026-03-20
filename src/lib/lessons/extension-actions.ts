'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { sendExtensionRequestAlimtalk } from '@/lib/solapi/alimtalk'
import { BOOKING_TYPE_LABEL } from './slot-types'
import type { LessonBooking, LessonSlot, SlotSession, CreateSlotInput } from './slot-types'
import { extendSlot, extendSlotWithWizard } from './slot-actions'

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type ExtensionStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface LessonExtensionRequest {
  id: string
  booking_id: string
  slot_id: string
  member_id: string
  requested_weeks: number
  message: string | null
  status: ExtensionStatus
  admin_note: string | null
  kakao_sent: boolean
  created_at: string
  updated_at: string
  // JOIN 결과
  booking?: LessonBooking | null
  slot?: LessonSlot | null
  member?: { id: string; name: string } | null
}

// ── 권한 헬퍼 ────────────────────────────────────────────────────────────────

async function checkAdminAuth() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null }
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return { error: '관리자 권한이 필요합니다.', user: null }
  }
  return { error: null, user }
}

// ── 연장 신청 (회원) ─────────────────────────────────────────────────────────

/**
 * 레슨 연장 신청
 * - DB에 저장
 * - 코치에게 카카오 알림톡 발송
 */
export async function requestLessonExtension(input: {
  bookingId: string
  slotId: string
  message?: string
}): Promise<{ error: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 본인 회원 확인
  const { data: member } = await admin
    .from('club_members')
    .select('id, name')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle()

  if (!member) return { error: '회원 정보를 찾을 수 없습니다.' }

  // 예약 본인 소유 확인
  const { data: booking } = await admin
    .from('lesson_bookings')
    .select('id, status, booking_type, fee_amount, slot_ids')
    .eq('id', input.bookingId)
    .eq('member_id', member.id)
    .single()

  if (!booking) return { error: '예약을 찾을 수 없습니다.' }
  if (booking.status !== 'CONFIRMED') return { error: '확정된 예약만 연장 신청할 수 있습니다.' }

  // 중복 신청 방지 (PENDING 상태 신청 존재 시)
  const { data: existing } = await admin
    .from('lesson_extension_requests')
    .select('id')
    .eq('booking_id', input.bookingId)
    .eq('status', 'PENDING')
    .limit(1)
    .maybeSingle()

  if (existing) return { error: '이미 처리 중인 연장 신청이 있습니다.' }

  // 슬롯 세션에서 연장 주수 자동 계산 (기존 패키지 기간과 동일하게)
  const { data: slotForWeeks } = await admin
    .from('lesson_slots')
    .select('sessions')
    .eq('id', input.slotId)
    .single()

  const activeSessions = ((slotForWeeks?.sessions ?? []) as SlotSession[]).filter(
    (s) => s.status !== 'CANCELLED',
  )
  const uniqueDows = new Set(activeSessions.map((s) => new Date(s.slot_date + 'T00:00:00').getDay()))
  const sessionsPerWeek = uniqueDows.size || 1
  const computedWeeks = Math.max(1, Math.round(activeSessions.length / sessionsPerWeek))

  // 연장 신청 저장
  const { error: insertErr } = await admin
    .from('lesson_extension_requests')
    .insert({
      booking_id:      input.bookingId,
      slot_id:         input.slotId,
      member_id:       member.id,
      requested_weeks: computedWeeks,
      message:         input.message?.trim() || null,
      status:          'PENDING',
    })

  if (insertErr) return { error: '연장 신청에 실패했습니다.' }

  // 코치 정보 + 전화번호 조회 (coach.user_id → profiles.phone)
  const { data: slot } = await admin
    .from('lesson_slots')
    .select('coach_id, coach:coaches!coach_id(id, name, user_id)')
    .eq('id', input.slotId)
    .single()

  const coachRaw = (slot?.coach as unknown) as { id: string; name: string; user_id: string | null } | null

  let kakaoSent = false
  if (coachRaw?.user_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('phone')
      .eq('id', coachRaw.user_id)
      .maybeSingle()

    const phone = profile?.phone
    if (phone) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://tennistab.kr'
      const result = await sendExtensionRequestAlimtalk({
        coachPhone:     phone,
        coachName:      coachRaw.name,
        memberName:     member.name,
        currentPackage: BOOKING_TYPE_LABEL[booking.booking_type as keyof typeof BOOKING_TYPE_LABEL] ?? booking.booking_type,
        requestedWeeks: computedWeeks,
        message:        input.message ?? '',
        adminUrl:       `${siteUrl}/admin/lessons`,
      })
      kakaoSent = result.success
    }
  }

  // 알림톡 발송 결과 업데이트
  if (kakaoSent) {
    await admin
      .from('lesson_extension_requests')
      .update({ kakao_sent: true })
      .eq('booking_id', input.bookingId)
      .eq('status', 'PENDING')
  }

  return { error: null }
}

// ── 내 연장 신청 조회 ────────────────────────────────────────────────────────

/** 처리 중(PENDING)인 연장 신청의 booking_id 목록 조회 (마이페이지 버튼 숨김용) */
export async function getMyPendingExtensionBookingIds(): Promise<string[]> {
  const user = await getCurrentUser()
  if (!user) return []

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('club_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle()

  if (!member) return []

  const { data } = await admin
    .from('lesson_extension_requests')
    .select('booking_id')
    .eq('member_id', member.id)
    .eq('status', 'PENDING')

  return (data ?? []).map((r) => r.booking_id)
}

// ── 어드민: 조회 ─────────────────────────────────────────────────────────────

export async function getExtensionRequests(filters?: {
  status?: ExtensionStatus
  coachId?: string // 특정 코치 슬롯의 연장 신청만 조회 (관리자·코치 공용)
}): Promise<{ error: string | null; data: LessonExtensionRequest[] }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', data: [] }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const admin = createAdminClient()

  // 코치 본인 여부 확인 (관리자가 아닌 경우)
  let filterCoachId = filters?.coachId
  if (!isAdmin) {
    const { data: coach } = await admin
      .from('coaches')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!coach) return { error: '접근 권한이 없습니다.', data: [] }
    filterCoachId = coach.id // 코치는 본인 ID로 강제
  }

  // 코치 필터 시 슬롯 ID 목록 먼저 조회
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
    .from('lesson_extension_requests')
    .select(`
      *,
      member:club_members!member_id(id, name),
      booking:lesson_bookings!booking_id(id, booking_type, fee_amount, status),
      slot:lesson_slots!slot_id(id, total_sessions, sessions, coach_id,
        frequency, duration_minutes, fee_amount,
        coach:coaches!coach_id(id, name))
    `)
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (slotIdFilter) query = query.in('slot_id', slotIdFilter)

  const { data, error } = await query

  if (error) return { error: '연장 신청 목록 조회에 실패했습니다.', data: [] }
  return { error: null, data: (data ?? []) as LessonExtensionRequest[] }
}

// ── 어드민: 처리 ─────────────────────────────────────────────────────────────

export async function updateExtensionRequest(
  requestId: string,
  status: 'APPROVED' | 'REJECTED',
  adminNote?: string,
): Promise<{ error: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const admin = createAdminClient()

  // 코치인 경우 본인 슬롯의 연장 신청만 처리 가능
  if (!isAdmin) {
    const { data: coach } = await admin
      .from('coaches')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!coach) return { error: '접근 권한이 없습니다.' }

    // 해당 연장 신청의 슬롯이 본인 것인지 확인
    const { data: req } = await admin
      .from('lesson_extension_requests')
      .select('slot_id')
      .eq('id', requestId)
      .single()
    if (!req) return { error: '연장 신청을 찾을 수 없습니다.' }

    const { data: slot } = await admin
      .from('lesson_slots')
      .select('coach_id')
      .eq('id', req.slot_id)
      .single()
    if (!slot || slot.coach_id !== coach.id) return { error: '본인 슬롯의 연장 신청만 처리할 수 있습니다.' }
  }

  // 연장 신청 조회 (slot_id, requested_weeks 필요)
  const { data: req } = await admin
    .from('lesson_extension_requests')
    .select('slot_id, requested_weeks')
    .eq('id', requestId)
    .single()

  if (!req) return { error: '연장 신청을 찾을 수 없습니다.' }

  const { error } = await admin
    .from('lesson_extension_requests')
    .update({ status, admin_note: adminNote ?? null })
    .eq('id', requestId)
    .eq('status', 'PENDING') // PENDING인 것만 처리

  if (error) return { error: '연장 신청 처리에 실패했습니다.' }

  // 승인 시 새 슬롯 + 예약 자동 생성
  if (status === 'APPROVED') {
    const result = await extendSlot(req.slot_id, req.requested_weeks || 4)
    if (result.error) return { error: `승인 처리됐으나 슬롯 생성 실패: ${result.error}` }
  }

  return { error: null }
}

// ── 어드민: 위자드로 승인 ─────────────────────────────────────────────────────

/**
 * 위자드로 구성한 세션으로 연장 신청 승인
 * - extendSlotWithWizard로 새 슬롯+예약 생성
 * - 연장 신청 status → APPROVED
 */
export async function approveExtensionWithWizard(
  requestId: string,
  adminNote: string | undefined,
  coachId: string,
  input: CreateSlotInput,
): Promise<{ error: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const admin = createAdminClient()

  // 코치인 경우 권한 확인
  if (!isAdmin) {
    const { data: coach } = await admin
      .from('coaches')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!coach) return { error: '접근 권한이 없습니다.' }

    const { data: reqForCheck } = await admin
      .from('lesson_extension_requests')
      .select('slot_id')
      .eq('id', requestId)
      .single()
    if (!reqForCheck) return { error: '연장 신청을 찾을 수 없습니다.' }

    const { data: slotForCheck } = await admin
      .from('lesson_slots')
      .select('coach_id')
      .eq('id', reqForCheck.slot_id)
      .single()
    if (!slotForCheck || slotForCheck.coach_id !== coach.id) {
      return { error: '본인 슬롯의 연장 신청만 처리할 수 있습니다.' }
    }
  }

  // 연장 신청 slot_id 조회
  const { data: req } = await admin
    .from('lesson_extension_requests')
    .select('slot_id')
    .eq('id', requestId)
    .eq('status', 'PENDING')
    .single()

  if (!req) return { error: '연장 신청을 찾을 수 없습니다.' }

  // 위자드 세션으로 새 슬롯 + 예약 생성
  const slotResult = await extendSlotWithWizard(req.slot_id, coachId, input)
  if (slotResult.error) return { error: slotResult.error }

  // 연장 신청 APPROVED 처리
  const { error } = await admin
    .from('lesson_extension_requests')
    .update({ status: 'APPROVED', admin_note: adminNote ?? null })
    .eq('id', requestId)
    .eq('status', 'PENDING')

  if (error) return { error: '연장 신청 승인 처리에 실패했습니다.' }

  return { error: null }
}

// ── 연장 신청 상태만 APPROVED로 업데이트 (슬롯 생성은 위자드에서 처리됨) ─────

/**
 * 위자드 완료 후 연장 신청 상태를 APPROVED로 업데이트
 * - 슬롯/예약 생성은 CreateSlotModal (extendSlotWithWizard)에서 선행 처리
 */
export async function markExtensionApproved(
  requestId: string,
  adminNote?: string,
): Promise<{ error: string | null }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN'
  const admin = createAdminClient()

  if (!isAdmin) {
    const { data: coach } = await admin
      .from('coaches')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    if (!coach) return { error: '접근 권한이 없습니다.' }

    const { data: req } = await admin
      .from('lesson_extension_requests')
      .select('slot_id')
      .eq('id', requestId)
      .single()
    if (!req) return { error: '연장 신청을 찾을 수 없습니다.' }

    const { data: slot } = await admin
      .from('lesson_slots')
      .select('coach_id')
      .eq('id', req.slot_id)
      .single()
    if (!slot || slot.coach_id !== coach.id) return { error: '본인 슬롯의 연장 신청만 처리할 수 있습니다.' }
  }

  const { error } = await admin
    .from('lesson_extension_requests')
    .update({ status: 'APPROVED', admin_note: adminNote ?? null })
    .eq('id', requestId)
    .eq('status', 'PENDING')

  if (error) return { error: '연장 신청 승인 처리에 실패했습니다.' }
  return { error: null }
}
