'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { sendExtensionRequestAlimtalk } from '@/lib/solapi/alimtalk'
import { BOOKING_TYPE_LABEL } from './slot-types'
import type { LessonBooking, LessonSlot } from './slot-types'

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
  requestedWeeks: number
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

  if (input.requestedWeeks < 1 || input.requestedWeeks > 8) {
    return { error: '연장 가능 범위는 1~8주입니다.' }
  }

  // 연장 신청 저장
  const { error: insertErr } = await admin
    .from('lesson_extension_requests')
    .insert({
      booking_id:      input.bookingId,
      slot_id:         input.slotId,
      member_id:       member.id,
      requested_weeks: input.requestedWeeks,
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
        requestedWeeks: input.requestedWeeks,
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

// ── 어드민: 조회 ─────────────────────────────────────────────────────────────

export async function getExtensionRequests(filters?: {
  status?: ExtensionStatus
}): Promise<{ error: string | null; data: LessonExtensionRequest[] }> {
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr, data: [] }

  const admin = createAdminClient()

  let query = admin
    .from('lesson_extension_requests')
    .select(`
      *,
      member:club_members!member_id(id, name),
      booking:lesson_bookings!booking_id(id, booking_type, fee_amount, status),
      slot:lesson_slots!slot_id(id, total_sessions, sessions, coach_id,
        coach:coaches!coach_id(id, name))
    `)
    .order('created_at', { ascending: false })

  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

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
  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()

  const { error } = await admin
    .from('lesson_extension_requests')
    .update({ status, admin_note: adminNote ?? null })
    .eq('id', requestId)
    .eq('status', 'PENDING') // PENDING인 것만 처리

  if (error) return { error: '연장 신청 처리에 실패했습니다.' }
  return { error: null }
}
