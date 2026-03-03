'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeInput, sanitizeObject } from '@/lib/utils/validation'
import type {
  ClubSession,
  ClubSessionDetail,
  ClubSessionStatus,
  ClubMatchResult,
  ClubMemberStat,
  ClubMemberStatWithMember,
  SessionAttendanceDetail,
  CreateSessionInput,
  UpdateSessionInput,
  RespondSessionInput,
  CreateMatchInput,
  ReportResultInput,
  ResolveDisputeInput,
  ClubMemberRole,
  MatchType,
  ClubSessionGuest,
  SchedulePlayer,
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

/** Supabase !inner JOIN 결과에서 club_id 추출 (배열/객체 모두 대응) */
function extractClubId(joinResult: unknown): string {
  if (Array.isArray(joinResult)) return (joinResult[0] as { club_id: string }).club_id
  return (joinResult as { club_id: string }).club_id
}

/** 클럽 임원 권한 확인 (OWNER/ADMIN/MATCH_DIRECTOR) */
async function checkSessionOfficerAuth(clubId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null, memberId: null }

  // 시스템 관리자
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return { error: null, user, memberId: null }
  }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('club_members')
    .select('id, role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member || !['OWNER', 'ADMIN', 'MATCH_DIRECTOR'].includes(member.role)) {
    return { error: '클럽 관리 권한이 없습니다.', user: null, memberId: null }
  }

  return { error: null, user, memberId: member.id as string }
}

/** 클럽 ACTIVE 멤버 확인 */
async function checkClubMemberAuth(clubId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null, memberId: null }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('club_members')
    .select('id, role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member) {
    return { error: '클럽 멤버가 아닙니다.', user: null, memberId: null }
  }

  return { error: null, user, memberId: member.id as string, role: member.role as ClubMemberRole }
}

// ============================================================================
// 세션 CRUD
// ============================================================================

/** 모임 생성 */
export async function createClubSession(
  input: CreateSessionInput
): Promise<{ data?: ClubSession; error?: string }> {
  const idError = validateId(input.club_id, '클럽 ID')
  if (idError) return { error: idError }

  const { error: authError, user } = await checkSessionOfficerAuth(input.club_id)
  if (authError || !user) return { error: authError || '인증 오류' }

  const sanitized = sanitizeObject(input) as CreateSessionInput

  // 시간 검증
  if (sanitized.start_time >= sanitized.end_time) {
    return { error: '종료 시간은 시작 시간 이후여야 합니다.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('club_sessions')
    .insert({
      club_id: sanitized.club_id,
      title: sanitized.title,
      venue_name: sanitized.venue_name,
      court_numbers: sanitized.court_numbers,
      session_date: sanitized.session_date,
      start_time: sanitized.start_time,
      end_time: sanitized.end_time,
      max_attendees: sanitized.max_attendees || null,
      rsvp_deadline: sanitized.rsvp_deadline || null,
      notes: sanitized.notes || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: `모임 생성 실패: ${error.message}` }

  revalidatePath(`/clubs/${input.club_id}`)
  return { data: data as ClubSession }
}

/** 모임 목록 조회 */
export async function getClubSessions(
  clubId: string,
  options?: { status?: ClubSessionStatus[]; limit?: number; offset?: number }
): Promise<ClubSession[]> {
  const admin = createAdminClient()
  const user = await getCurrentUser()

  // sessions + attendances JOIN, myMember 병렬 조회
  let query = admin
    .from('club_sessions')
    .select('id, club_id, title, venue_name, court_numbers, session_date, start_time, end_time, max_attendees, status, rsvp_deadline, notes, created_by, created_at, updated_at, club_session_attendances(status, club_member_id)')
    .eq('club_id', clubId)
    .order('session_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (options?.status && options.status.length > 0) {
    query = query.in('status', options.status)
  }
  if (options?.limit !== undefined) {
    const offset = options.offset ?? 0
    query = query.range(offset, offset + options.limit - 1)
  }

  const [{ data: sessions, error }, { data: myMember }] = await Promise.all([
    query,
    user
      ? admin
          .from('club_members')
          .select('id')
          .eq('club_id', clubId)
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .single()
      : Promise.resolve({ data: null }),
  ])

  if (error || !sessions) return []

  return (sessions as (ClubSession & { club_session_attendances: { session_id: string; status: string; club_member_id: string }[] })[]).map((session) => {
    const att = session.club_session_attendances ?? []
    return {
      ...session,
      club_session_attendances: undefined,
      _attending_count: att.filter((a) => a.status === 'ATTENDING').length,
      _not_attending_count: att.filter((a) => a.status === 'NOT_ATTENDING').length,
      _undecided_count: att.filter((a) => a.status === 'UNDECIDED').length,
      _my_attendance: myMember
        ? (att.find((a) => a.club_member_id === myMember.id)?.status as ClubSession['_my_attendance'])
        : undefined,
    }
  })
}

/** 모임 상세 조회 (참석 + 경기) */
export async function getClubSessionDetail(
  sessionId: string
): Promise<ClubSessionDetail | null> {
  const admin = createAdminClient()

  const { data: session, error } = await admin
    .from('club_sessions')
    .select('*')
    .eq('id', sessionId)
    .single()

  if (error || !session) return null

  // 참석 현황
  const { data: attendances } = await admin
    .from('club_session_attendances')
    .select(`
      *,
      club_members!inner(id, name, rating, is_registered, gender)
    `)
    .eq('session_id', sessionId)
    .order('responded_at', { ascending: true })

  // 경기 결과 + 게스트 JOIN
  const fullMatchSel = `
    *,
    player1:club_members!club_match_results_player1_member_id_fkey(id, name),
    player2:club_members!club_match_results_player2_member_id_fkey(id, name),
    player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
    player2b:club_members!club_match_results_player2b_member_id_fkey(id, name),
    player1_guest:club_session_guests!club_match_results_player1_guest_id_fkey(id, name),
    player2_guest:club_session_guests!club_match_results_player2_guest_id_fkey(id, name),
    player1b_guest:club_session_guests!club_match_results_player1b_guest_id_fkey(id, name),
    player2b_guest:club_session_guests!club_match_results_player2b_guest_id_fkey(id, name)
  `
  const baseSel = `
    *,
    player1:club_members!club_match_results_player1_member_id_fkey(id, name),
    player2:club_members!club_match_results_player2_member_id_fkey(id, name)
  `
  let matchResult = await admin.from('club_match_results').select(fullMatchSel)
    .eq('session_id', sessionId).order('scheduled_time', { ascending: true })
  if (matchResult.error?.code === 'PGRST200') {
    matchResult = await admin.from('club_match_results').select(baseSel)
      .eq('session_id', sessionId).order('scheduled_time', { ascending: true })
  }
  const { data: matches } = matchResult

  // 게스트 목록
  const { data: guests } = await admin
    .from('club_session_guests')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })

  const formattedAttendances = (attendances || []).map(
    (a: Record<string, unknown>) => ({
      id: a.id as string,
      session_id: a.session_id as string,
      club_member_id: a.club_member_id as string,
      status: a.status as SessionAttendanceDetail['status'],
      available_from: a.available_from as string | null,
      available_until: a.available_until as string | null,
      notes: a.notes as string | null,
      responded_at: a.responded_at as string | null,
      member: a.club_members as SessionAttendanceDetail['member'],
    })
  ) satisfies SessionAttendanceDetail[]

  return {
    ...(session as ClubSession),
    attendances: formattedAttendances,
    matches: (matches || []) as ClubMatchResult[],
    guests: (guests || []) as ClubSessionGuest[],
  }
}

/** 모임 수정 (OPEN 상태만) */
export async function updateClubSession(
  sessionId: string,
  input: UpdateSessionInput
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  // 세션 조회
  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.' }
  if (session.status !== 'OPEN') return { error: 'OPEN 상태에서만 수정할 수 있습니다.' }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError }

  const sanitized = sanitizeObject(input) as UpdateSessionInput

  if (sanitized.start_time && sanitized.end_time && sanitized.start_time >= sanitized.end_time) {
    return { error: '종료 시간은 시작 시간 이후여야 합니다.' }
  }

  const { error } = await admin
    .from('club_sessions')
    .update({ ...sanitized, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) return { error: `수정 실패: ${error.message}` }

  revalidatePath(`/clubs/${session.club_id}`)
  return {}
}

/** 모임 취소 */
export async function cancelClubSession(
  sessionId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.' }
  if (session.status === 'COMPLETED') return { error: '완료된 세션은 취소할 수 없습니다.' }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError }

  const { error } = await admin
    .from('club_sessions')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) return { error: `취소 실패: ${error.message}` }

  revalidatePath(`/clubs/${session.club_id}`)
  return {}
}

/** 응답 마감 (OPEN → CLOSED) */
export async function closeSessionRsvp(
  sessionId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.' }
  if (session.status !== 'OPEN') return { error: 'OPEN 상태에서만 마감할 수 있습니다.' }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError }

  const { error } = await admin
    .from('club_sessions')
    .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) return { error: `마감 실패: ${error.message}` }

  revalidatePath(`/clubs/${session.club_id}`)
  return {}
}

/** 모임 완료 처리 (CLOSED → COMPLETED) */
export async function completeSession(
  sessionId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.' }
  if (session.status !== 'CLOSED') return { error: 'CLOSED 상태에서만 완료할 수 있습니다.' }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError }

  // 참석자 통계 갱신 (sessions_attended)
  const { data: attendingMembers } = await admin
    .from('club_session_attendances')
    .select('club_member_id')
    .eq('session_id', sessionId)
    .eq('status', 'ATTENDING')

  if (attendingMembers && attendingMembers.length > 0) {
    const season = new Date().getFullYear().toString()
    for (const a of attendingMembers) {
      // upsert sessions_attended
      const { data: existing } = await admin
        .from('club_member_stats')
        .select('id, sessions_attended')
        .eq('club_id', session.club_id)
        .eq('club_member_id', a.club_member_id)
        .eq('season', season)
        .single()

      if (existing) {
        await admin
          .from('club_member_stats')
          .update({
            sessions_attended: existing.sessions_attended + 1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      } else {
        await admin.from('club_member_stats').insert({
          club_id: session.club_id,
          club_member_id: a.club_member_id,
          season,
          sessions_attended: 1,
        })
      }
    }
  }

  const { error } = await admin
    .from('club_sessions')
    .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) return { error: `완료 처리 실패: ${error.message}` }

  revalidatePath(`/clubs/${session.club_id}`)
  return {}
}

// ============================================================================
// 참석 응답
// ============================================================================

/** 참석 응답 등록/수정 (upsert) */
export async function respondToSession(
  input: RespondSessionInput
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 세션 상태 + 마감 체크
  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, status, rsvp_deadline, session_date, start_time')
    .eq('id', input.session_id)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.' }
  if (session.status !== 'OPEN') return { error: '응답 기간이 아닙니다.' }

  // 마감 시간 체크
  const now = new Date()
  if (session.rsvp_deadline && new Date(session.rsvp_deadline) < now) {
    return { error: '응답 마감 시간이 지났습니다.' }
  }

  // 본인 멤버십 확인
  const { data: member } = await admin
    .from('club_members')
    .select('id')
    .eq('id', input.club_member_id)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member) return { error: '클럽 멤버 정보가 올바르지 않습니다.' }

  const sanitized = sanitizeObject(input) as RespondSessionInput

  const { error } = await admin
    .from('club_session_attendances')
    .upsert(
      {
        session_id: sanitized.session_id,
        club_member_id: sanitized.club_member_id,
        status: sanitized.status,
        available_from: sanitized.available_from || null,
        available_until: sanitized.available_until || null,
        notes: sanitized.notes || null,
        responded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,club_member_id' }
    )

  if (error) return { error: `응답 등록 실패: ${error.message}` }

  revalidatePath(`/clubs/${session.club_id}`)
  return {}
}

/** 참석자 목록 조회 (관리자용 — 미응답 포함) */
export async function getSessionAttendances(
  sessionId: string
): Promise<SessionAttendanceDetail[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('club_session_attendances')
    .select(`
      *,
      club_members!inner(id, name, rating, is_registered)
    `)
    .eq('session_id', sessionId)
    .order('status', { ascending: true })

  if (error || !data) return []

  return data.map((a: Record<string, unknown>) => ({
    id: a.id as string,
    session_id: a.session_id as string,
    club_member_id: a.club_member_id as string,
    status: a.status as SessionAttendanceDetail['status'],
    available_from: a.available_from as string | null,
    available_until: a.available_until as string | null,
    notes: a.notes as string | null,
    responded_at: a.responded_at as string | null,
    member: a.club_members as SessionAttendanceDetail['member'],
  })) satisfies SessionAttendanceDetail[]
}

// ============================================================================
// 게스트 관리
// ============================================================================

/** 세션 게스트 목록 조회 */
export async function getSessionGuests(sessionId: string): Promise<ClubSessionGuest[]> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('club_session_guests')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data as ClubSessionGuest[]
}

/** 게스트 추가 (임원 전용) */
export async function addSessionGuest(
  sessionId: string,
  input: { name: string; gender?: 'MALE' | 'FEMALE' | null; notes?: string }
): Promise<{ data?: ClubSessionGuest; error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, status')
    .eq('id', sessionId)
    .single()
  if (!session) return { error: '모임을 찾을 수 없습니다.' }

  const { error: authError, user } = await checkSessionOfficerAuth(session.club_id)
  if (authError || !user) return { error: authError || '인증 오류' }

  // OPEN / CLOSED 상태에서만 게스트 추가 가능
  if (!['OPEN', 'CLOSED'].includes(session.status)) {
    return { error: '완료되거나 취소된 모임에는 게스트를 추가할 수 없습니다.' }
  }

  const name = sanitizeInput(input.name).trim()
  if (!name) return { error: '게스트 이름을 입력해주세요.' }

  const { data, error } = await admin
    .from('club_session_guests')
    .insert({
      session_id: sessionId,
      name,
      gender: input.gender ?? null,
      notes: input.notes ? sanitizeInput(input.notes) : null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: `게스트 추가 실패: ${error.message}` }

  revalidatePath(`/clubs/${session.club_id}`)
  return { data: data as ClubSessionGuest }
}

/** 게스트 삭제 (임원 전용) */
export async function removeSessionGuest(
  guestId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: guest } = await admin
    .from('club_session_guests')
    .select('id, session_id, club_sessions!inner(club_id)')
    .eq('id', guestId)
    .single()

  if (!guest) return { error: '게스트를 찾을 수 없습니다.' }

  const clubId = extractClubId((guest as Record<string, unknown>).club_sessions)
  const { error: authError } = await checkSessionOfficerAuth(clubId)
  if (authError) return { error: authError }

  // 완료된 경기에 참여한 게스트는 삭제 불가
  const { data: completedMatch } = await admin
    .from('club_match_results')
    .select('id')
    .or(
      `player1_guest_id.eq.${guestId},player2_guest_id.eq.${guestId},` +
      `player1b_guest_id.eq.${guestId},player2b_guest_id.eq.${guestId}`
    )
    .eq('status', 'COMPLETED')
    .limit(1)
    .maybeSingle()
  if (completedMatch) {
    return { error: '완료된 경기에 참여한 게스트는 삭제할 수 없습니다.' }
  }

  const { error } = await admin
    .from('club_session_guests')
    .delete()
    .eq('id', guestId)

  if (error) return { error: `게스트 삭제 실패: ${error.message}` }

  revalidatePath(`/clubs/${clubId}`)
  return {}
}

// ============================================================================
// 경기 결과
// ============================================================================

/** 대진 생성 (관리자 — 1건) */
export async function createMatchResult(
  input: CreateMatchInput
): Promise<{ data?: ClubMatchResult; error?: string }> {
  const admin = createAdminClient()

  // 세션 → 클럽 확인
  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id')
    .eq('id', input.session_id)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.' }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError }

  // 중복 선수 체크 (같은 멤버를 두 슬롯에 배정 불가)
  const memberIds = [
    input.player1_member_id, input.player2_member_id,
    input.player1b_member_id, input.player2b_member_id,
  ].filter(Boolean) as string[]
  if (new Set(memberIds).size !== memberIds.length) {
    return { error: '같은 선수를 중복 배정할 수 없습니다.' }
  }

  const insertData: Record<string, unknown> = {
    session_id: input.session_id,
    court_number: input.court_number || null,
    scheduled_time: input.scheduled_time || null,
  }
  if (input.match_type) insertData.match_type = input.match_type
  // player1/2 (member or guest)
  insertData.player1_member_id = input.player1_member_id ?? null
  insertData.player2_member_id = input.player2_member_id ?? null
  if (input.player1b_member_id !== undefined) insertData.player1b_member_id = input.player1b_member_id ?? null
  if (input.player2b_member_id !== undefined) insertData.player2b_member_id = input.player2b_member_id ?? null
  if (input.player1_guest_id !== undefined) insertData.player1_guest_id = input.player1_guest_id ?? null
  if (input.player2_guest_id !== undefined) insertData.player2_guest_id = input.player2_guest_id ?? null
  if (input.player1b_guest_id !== undefined) insertData.player1b_guest_id = input.player1b_guest_id ?? null
  if (input.player2b_guest_id !== undefined) insertData.player2b_guest_id = input.player2b_guest_id ?? null

  const { data, error } = await admin
    .from('club_match_results')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    return { error: `대진 생성 실패: ${error.message}` }
  }

  revalidatePath(`/clubs/${session.club_id}`)
  return { data: data as ClubMatchResult }
}

/** 참석 시간 기반 자동 대진표 생성 */
export async function createAutoScheduleMatches(
  sessionId: string,
  matchDurationMinutes = 30
): Promise<{ count: number; error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, court_numbers, start_time, end_time')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.', count: 0 }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError, count: 0 }

  const [attendancesResult, guestsResult] = await Promise.all([
    admin
      .from('club_session_attendances')
      .select('club_member_id, available_from, available_until')
      .eq('session_id', sessionId)
      .eq('status', 'ATTENDING'),
    admin
      .from('club_session_guests')
      .select('id, name, gender')
      .eq('session_id', sessionId),
  ])
  const attendances = attendancesResult.data
  const guests = guestsResult.data

  const totalPlayers = (attendances?.length ?? 0) + (guests?.length ?? 0)
  if (totalPlayers < 4) {
    return { error: '복식 자동 대진은 최소 4명 이상 필요합니다.', count: 0 }
  }

  const courts: string[] = session.court_numbers || []

  // HH:MM[:SS] → 분 단위 정수
  const toMinutes = (t: string): number => {
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    return h * 60 + m
  }
  const toTimeStr = (minutes: number): string => {
    const h = Math.floor(minutes / 60) % 24
    const m = minutes % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const sessionStart = toMinutes(session.start_time)
  const sessionEnd = toMinutes(session.end_time)

  // SchedulePlayer 풀 구성: 회원 + 게스트
  const playerPool: SchedulePlayer[] = [
    ...(attendances || []).map((a): SchedulePlayer => ({
      type: 'member',
      id: a.club_member_id as string,
      memberId: a.club_member_id as string,
      guestId: null,
      name: '',
      gender: null,
      availableFrom: a.available_from ? toMinutes(a.available_from as string) : sessionStart,
      availableUntil: a.available_until ? toMinutes(a.available_until as string) : sessionEnd,
    })),
    ...(guests || []).map((g): SchedulePlayer => ({
      type: 'guest',
      id: g.id as string,
      memberId: null,
      guestId: g.id as string,
      name: g.name as string,
      gender: g.gender as 'MALE' | 'FEMALE' | null,
      availableFrom: sessionStart,   // 게스트는 세션 전체 시간
      availableUntil: sessionEnd,
    })),
  ]

  // 배정된 게임 수 (공정 배분용)
  const gameCount: Record<string, number> = Object.fromEntries(playerPool.map((p) => [p.id, 0]))

  type DoubleMatchRow = {
    session_id: string
    match_type: string
    player1_member_id: string | null
    player1b_member_id: string | null
    player2_member_id: string | null
    player2b_member_id: string | null
    player1_guest_id: string | null
    player1b_guest_id: string | null
    player2_guest_id: string | null
    player2b_guest_id: string | null
    court_number: string | null
    scheduled_time: string
  }
  const matches: DoubleMatchRow[] = []

  // 중복 대전 방지 (같은 4인 조합은 한 번만)
  const matchedGroups = new Set<string>()

  for (let slotStart = sessionStart; slotStart + matchDurationMinutes <= sessionEnd; slotStart += matchDurationMinutes) {
    const slotEnd = slotStart + matchDurationMinutes

    // 이 슬롯에 포함되는 가용 플레이어 (게임 수 오름차순 → 덜 뛴 사람 우선)
    const available = playerPool
      .filter((p) => p.availableFrom <= slotStart && p.availableUntil >= slotEnd)
      .sort((a, b) => gameCount[a.id] - gameCount[b.id])

    const assignedInSlot = new Set<string>()
    const maxMatches = courts.length > 0 ? courts.length : Math.floor(available.length / 4)
    let courtIdx = 0
    let matchesInSlot = 0

    while (matchesInSlot < maxMatches) {
      const pool = available.filter((p) => !assignedInSlot.has(p.id))
      if (pool.length < 4) break

      let placed = false
      outer: for (let a = 0; a < pool.length - 3; a++) {
        for (let b = a + 1; b < pool.length - 2; b++) {
          for (let c = b + 1; c < pool.length - 1; c++) {
            for (let d = c + 1; d < pool.length; d++) {
              const pa = pool[a], pb = pool[b], pc = pool[c], pd = pool[d]
              // 균형 팀: (a위, d위) vs (b위, c위) — 강약 교차
              const t1 = [pa.id, pd.id].sort().join('+')
              const t2 = [pb.id, pc.id].sort().join('+')
              const matchKey = [t1, t2].sort().join('|')
              if (matchedGroups.has(matchKey)) continue

              const court = courts.length > 0 ? courts[courtIdx % courts.length] : null
              matches.push({
                session_id: sessionId,
                match_type: 'doubles',
                player1_member_id: pa.type === 'member' ? pa.memberId : null,
                player1b_member_id: pd.type === 'member' ? pd.memberId : null,
                player2_member_id: pb.type === 'member' ? pb.memberId : null,
                player2b_member_id: pc.type === 'member' ? pc.memberId : null,
                player1_guest_id: pa.type === 'guest' ? pa.guestId : null,
                player1b_guest_id: pd.type === 'guest' ? pd.guestId : null,
                player2_guest_id: pb.type === 'guest' ? pb.guestId : null,
                player2b_guest_id: pc.type === 'guest' ? pc.guestId : null,
                court_number: court,
                scheduled_time: toTimeStr(slotStart),
              })

              assignedInSlot.add(pa.id); assignedInSlot.add(pb.id)
              assignedInSlot.add(pc.id); assignedInSlot.add(pd.id)
              matchedGroups.add(matchKey)
              gameCount[pa.id]++; gameCount[pb.id]++
              gameCount[pc.id]++; gameCount[pd.id]++
              courtIdx++; matchesInSlot++
              placed = true
              break outer
            }
          }
        }
      }
      if (!placed) break
    }
  }

  if (matches.length === 0) {
    return { error: '자동 생성할 경기가 없습니다. 참석 가능 시간 또는 코트 정보를 확인해주세요.', count: 0 }
  }

  const { error } = await admin.from('club_match_results').insert(matches)
  if (error) return { error: `대진 생성 실패: ${error.message}`, count: 0 }

  revalidatePath(`/clubs/${session.club_id}`)
  return { count: matches.length }
}

/** 경기 결과 보고 (선수) */
export async function reportMatchResult(
  matchId: string,
  input: ReportResultInput
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 경기 정보 조회
  const { data: match } = await admin
    .from('club_match_results')
    .select(`
      *,
      club_sessions!inner(club_id)
    `)
    .eq('id', matchId)
    .single()

  if (!match) return { error: '경기를 찾을 수 없습니다.' }
  if (match.status !== 'SCHEDULED' && match.status !== 'DISPUTED') {
    return { error: '결과를 보고할 수 없는 상태입니다.' }
  }

  // 게스트 포함 경기는 임원만 입력 가능 (선수 자가 보고 불가)
  if (
    match.player1_guest_id || match.player2_guest_id ||
    match.player1b_guest_id || match.player2b_guest_id
  ) {
    return { error: '게스트 포함 경기는 임원이 직접 점수를 입력해야 합니다.' }
  }

  // 본인이 player1/player2인지 확인
  const { data: myMember } = await admin
    .from('club_members')
    .select('id')
    .eq('club_id', extractClubId(match.club_sessions))
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!myMember) return { error: '클럽 멤버가 아닙니다.' }

  const isPlayer1 = myMember.id === match.player1_member_id
  const isPlayer2 = myMember.id === match.player2_member_id
  if (!isPlayer1 && !isPlayer2) return { error: '이 경기의 참가자가 아닙니다.' }

  // 자신의 점수 보고
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (isPlayer1) {
    // player1이 보고: 자신(p1) 점수 + 상대(p2) 점수
    updateData.player1_reported_score_p1 = input.my_score
    updateData.player1_reported_score_p2 = input.opponent_score
  } else {
    // player2가 보고: 자신(p2) 점수 + 상대(p1) 점수
    updateData.player2_reported_score_p2 = input.my_score
    updateData.player2_reported_score_p1 = input.opponent_score
  }

  // 현재 저장된 상대방 보고 확인
  const otherP1 = isPlayer1 ? match.player2_reported_score_p1 : input.opponent_score
  const otherP2 = isPlayer1 ? match.player2_reported_score_p2 : input.my_score
  const myP1 = isPlayer1 ? input.my_score : (match.player1_reported_score_p1 as number | null)
  const myP2 = isPlayer1 ? input.opponent_score : (match.player1_reported_score_p2 as number | null)

  // 양측 모두 보고 완료?
  const bothReported = isPlayer1
    ? match.player2_reported_score_p1 != null
    : match.player1_reported_score_p1 != null

  if (bothReported) {
    // 일치 여부 확인
    const p1ScoreMatch = myP1 === otherP1
    const p2ScoreMatch = myP2 === otherP2

    if (p1ScoreMatch && p2ScoreMatch && myP1 != null && myP2 != null) {
      // 일치 → COMPLETED (팀 캡틴을 winner로 기록)
      const team1Captain = match.player1_member_id ?? match.player1b_member_id ?? null
      const team2Captain = match.player2_member_id ?? match.player2b_member_id ?? null
      const winnerId =
        myP1 > myP2
          ? team1Captain
          : myP2 > myP1
            ? team2Captain
            : null // 무승부
      updateData.status = 'COMPLETED'
      updateData.player1_score = myP1
      updateData.player2_score = myP2
      updateData.winner_member_id = winnerId

      // 통계 갱신은 update 후 처리
    } else {
      // 불일치 → DISPUTED
      updateData.status = 'DISPUTED'
    }
  }

  const { error } = await admin
    .from('club_match_results')
    .update(updateData)
    .eq('id', matchId)

  if (error) return { error: `결과 보고 실패: ${error.message}` }

  // 통계 갱신 (COMPLETED인 경우)
  if (updateData.status === 'COMPLETED') {
    const updatedMatch = {
      ...match,
      ...updateData,
    } as ClubMatchResult
    await updateStatsAfterMatch(
      updatedMatch,
      extractClubId(match.club_sessions)
    )
  }

  revalidatePath(`/clubs/${extractClubId(match.club_sessions)}`)
  return {}
}

/** 분쟁 해결 (관리자) */
export async function resolveMatchDispute(
  matchId: string,
  input: ResolveDisputeInput
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: match } = await admin
    .from('club_match_results')
    .select(`
      *,
      club_sessions!inner(club_id)
    `)
    .eq('id', matchId)
    .single()

  if (!match) return { error: '경기를 찾을 수 없습니다.' }
  if (match.status !== 'DISPUTED') return { error: '분쟁 상태가 아닙니다.' }

  const clubId = extractClubId(match.club_sessions)
  const { error: authError, user } = await checkSessionOfficerAuth(clubId)
  if (authError || !user) return { error: authError || '인증 오류' }

  const team1Captain = match.player1_member_id ?? match.player1b_member_id ?? null
  const team2Captain = match.player2_member_id ?? match.player2b_member_id ?? null
  const winnerId =
    input.player1_score > input.player2_score
      ? team1Captain
      : input.player2_score > input.player1_score
        ? team2Captain
        : null

  const { error } = await admin
    .from('club_match_results')
    .update({
      player1_score: input.player1_score,
      player2_score: input.player2_score,
      winner_member_id: winnerId,
      status: 'COMPLETED',
      dispute_resolved_by: user.id,
      dispute_resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)

  if (error) return { error: `분쟁 해결 실패: ${error.message}` }

  // 통계 갱신
  await updateStatsAfterMatch(
    {
      ...match,
      player1_score: input.player1_score,
      player2_score: input.player2_score,
      winner_member_id: winnerId,
    } as ClubMatchResult,
    clubId
  )

  revalidatePath(`/clubs/${clubId}`)
  return {}
}

/** 관리자 점수 직접 수정 (상태 무관, 대진 생성 후 언제든 가능) */
export async function adminOverrideMatchResult(
  matchId: string,
  input: { player1_score: number; player2_score: number }
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: match } = await admin
    .from('club_match_results')
    .select('*, club_sessions!inner(club_id)')
    .eq('id', matchId)
    .single()

  if (!match) return { error: '경기를 찾을 수 없습니다.' }
  if (match.status === 'CANCELLED') return { error: '취소된 경기는 수정할 수 없습니다.' }

  const clubId = extractClubId(match.club_sessions)
  const { error: authError } = await checkSessionOfficerAuth(clubId)
  if (authError) return { error: authError }

  const team1Captain = match.player1_member_id ?? match.player1b_member_id ?? null
  const team2Captain = match.player2_member_id ?? match.player2b_member_id ?? null
  const winnerId =
    input.player1_score > input.player2_score
      ? team1Captain
      : input.player2_score > input.player1_score
        ? team2Captain
        : null

  const { error } = await admin
    .from('club_match_results')
    .update({
      player1_score: input.player1_score,
      player2_score: input.player2_score,
      winner_member_id: winnerId,
      status: 'COMPLETED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', matchId)

  if (error) return { error: `점수 수정 실패: ${error.message}` }

  await updateStatsAfterMatch(
    { ...match, player1_score: input.player1_score, player2_score: input.player2_score, winner_member_id: winnerId } as ClubMatchResult,
    clubId
  )

  revalidatePath(`/clubs/${clubId}`)
  return {}
}

/** 경기 목록 조회 */
export async function getSessionMatches(
  sessionId: string
): Promise<ClubMatchResult[]> {
  const admin = createAdminClient()

  const doublesMatchSelect = `
    *,
    player1:club_members!club_match_results_player1_member_id_fkey(id, name),
    player2:club_members!club_match_results_player2_member_id_fkey(id, name),
    player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
    player2b:club_members!club_match_results_player2b_member_id_fkey(id, name),
    player1_guest:club_session_guests!club_match_results_player1_guest_id_fkey(id, name),
    player2_guest:club_session_guests!club_match_results_player2_guest_id_fkey(id, name),
    player1b_guest:club_session_guests!club_match_results_player1b_guest_id_fkey(id, name),
    player2b_guest:club_session_guests!club_match_results_player2b_guest_id_fkey(id, name)
  `
  const baseMatchSelect = `
    *,
    player1:club_members!club_match_results_player1_member_id_fkey(id, name),
    player2:club_members!club_match_results_player2_member_id_fkey(id, name)
  `

  let result = await admin.from('club_match_results').select(doublesMatchSelect)
    .eq('session_id', sessionId).order('scheduled_time', { ascending: true })

  if (result.error?.code === 'PGRST200') {
    result = await admin.from('club_match_results').select(baseMatchSelect)
      .eq('session_id', sessionId).order('scheduled_time', { ascending: true })
  }

  if (result.error || !result.data) return []
  return result.data as ClubMatchResult[]
}

/** 경기 삭제 (관리자) */
export async function deleteMatchResult(
  matchId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: match } = await admin
    .from('club_match_results')
    .select(`
      id, status,
      club_sessions!inner(club_id)
    `)
    .eq('id', matchId)
    .single()

  if (!match) return { error: '경기를 찾을 수 없습니다.' }
  if (match.status === 'COMPLETED') return { error: '완료된 경기는 삭제할 수 없습니다.' }

  const clubId = extractClubId(match.club_sessions)
  const { error: authError } = await checkSessionOfficerAuth(clubId)
  if (authError) return { error: authError }

  const { error } = await admin
    .from('club_match_results')
    .delete()
    .eq('id', matchId)

  if (error) return { error: `삭제 실패: ${error.message}` }

  revalidatePath(`/clubs/${clubId}`)
  return {}
}

// ============================================================================
// 통계
// ============================================================================

/** 클럽 순위 조회 */
export async function getClubRankings(
  clubId: string,
  season?: string
): Promise<ClubMemberStatWithMember[]> {
  const currentSeason = season || new Date().getFullYear().toString()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('club_member_stats')
    .select(`
      *,
      club_members!inner(id, name, rating)
    `)
    .eq('club_id', clubId)
    .eq('season', currentSeason)
    .gt('total_games', 0)
    .order('win_rate', { ascending: false })
    .order('total_games', { ascending: false })

  if (error || !data) return []

  return data.map((s: Record<string, unknown>) => ({
    ...(s as unknown as ClubMemberStat),
    member: s.club_members as ClubMemberStatWithMember['member'],
  }))
}

/** 내 통계 조회 */
export async function getMyClubStats(
  clubId: string,
  season?: string
): Promise<ClubMemberStat | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const admin = createAdminClient()
  const currentSeason = season || new Date().getFullYear().toString()

  // 멤버 ID 조회
  const { data: member } = await admin
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member) return null

  const { data, error } = await admin
    .from('club_member_stats')
    .select('*')
    .eq('club_id', clubId)
    .eq('club_member_id', member.id)
    .eq('season', currentSeason)
    .single()

  if (error || !data) return null
  return data as ClubMemberStat
}

// ============================================================================
// 내부 함수: 통계 갱신
// ============================================================================

/** 경기 확정 시 통계 갱신 (admin client) */
async function updateStatsAfterMatch(
  match: ClubMatchResult,
  clubId: string
): Promise<void> {
  const admin = createAdminClient()
  const season = new Date().getFullYear().toString()
  const isDraw = match.winner_member_id === null

  // 팀 승리 여부: winner_member_id = 팀 캡틴(player1 or player2)
  const team1Win = !isDraw && (
    match.winner_member_id === match.player1_member_id ||
    match.winner_member_id === match.player1b_member_id
  )
  const team2Win = !isDraw && (
    match.winner_member_id === match.player2_member_id ||
    match.winner_member_id === match.player2b_member_id
  )

  // 통계 갱신 대상: memberId가 null이 아닌 슬롯만 (게스트 슬롯 제외)
  const players = [
    { memberId: match.player1_member_id, isWinner: team1Win },
    { memberId: match.player1b_member_id ?? null, isWinner: team1Win },
    { memberId: match.player2_member_id, isWinner: team2Win },
    { memberId: match.player2b_member_id ?? null, isWinner: team2Win },
  ].filter((p): p is { memberId: string; isWinner: boolean } => p.memberId != null)

  for (const player of players) {
    const { data: existing } = await admin
      .from('club_member_stats')
      .select('id, total_games, wins, losses')
      .eq('club_id', clubId)
      .eq('club_member_id', player.memberId)
      .eq('season', season)
      .single()

    if (existing) {
      await admin
        .from('club_member_stats')
        .update({
          total_games: existing.total_games + 1,
          wins: existing.wins + (player.isWinner ? 1 : 0),
          losses: existing.losses + (!player.isWinner && !isDraw ? 1 : 0),
          last_played_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await admin.from('club_member_stats').insert({
        club_id: clubId,
        club_member_id: player.memberId,
        season,
        total_games: 1,
        wins: player.isWinner ? 1 : 0,
        losses: !player.isWinner && !isDraw ? 1 : 0,
        last_played_at: new Date().toISOString(),
      })
    }
  }
}

/** 모임 상세 + 내 멤버십 한 번에 조회 (라운드트립 1회) */
export async function getSessionPageData(
  sessionId: string,
  clubId: string
): Promise<{
  session: ClubSessionDetail | null
  myMemberId: string | null
  myRole: import('./types').ClubMemberRole | null
}> {
  const admin = createAdminClient()
  const user = await getCurrentUser()

  const [
    { data: session },
    { data: attendances },
    { data: matches },
    { data: myMember },
    { data: guests },
  ] = await Promise.all([
    admin.from('club_sessions').select('*').eq('id', sessionId).single(),
    admin
      .from('club_session_attendances')
      .select('*, club_members!inner(id, name, rating, is_registered, gender)')
      .eq('session_id', sessionId)
      .order('responded_at', { ascending: true }),
    (async () => {
      const dSel = `*,player1:club_members!club_match_results_player1_member_id_fkey(id,name),player2:club_members!club_match_results_player2_member_id_fkey(id,name),player1b:club_members!club_match_results_player1b_member_id_fkey(id,name),player2b:club_members!club_match_results_player2b_member_id_fkey(id,name),player1_guest:club_session_guests!club_match_results_player1_guest_id_fkey(id,name),player2_guest:club_session_guests!club_match_results_player2_guest_id_fkey(id,name),player1b_guest:club_session_guests!club_match_results_player1b_guest_id_fkey(id,name),player2b_guest:club_session_guests!club_match_results_player2b_guest_id_fkey(id,name)`
      const bSel = `*,player1:club_members!club_match_results_player1_member_id_fkey(id,name),player2:club_members!club_match_results_player2_member_id_fkey(id,name)`
      let r = await admin.from('club_match_results').select(dSel).eq('session_id', sessionId).order('scheduled_time', { ascending: true })
      if (r.error?.code === 'PGRST200') r = await admin.from('club_match_results').select(bSel).eq('session_id', sessionId).order('scheduled_time', { ascending: true })
      return r
    })(),
    user
      ? admin
          .from('club_members')
          .select('id, role')
          .eq('club_id', clubId)
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .single()
      : Promise.resolve({ data: null }),
    admin
      .from('club_session_guests')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true }),
  ])

  if (!session) return { session: null, myMemberId: null, myRole: null }

  const formattedAttendances = (attendances || []).map(
    (a: Record<string, unknown>) => ({
      id: a.id as string,
      session_id: a.session_id as string,
      club_member_id: a.club_member_id as string,
      status: a.status as SessionAttendanceDetail['status'],
      available_from: a.available_from as string | null,
      available_until: a.available_until as string | null,
      notes: a.notes as string | null,
      responded_at: a.responded_at as string | null,
      member: a.club_members as SessionAttendanceDetail['member'],
    })
  ) satisfies SessionAttendanceDetail[]

  return {
    session: {
      ...(session as ClubSession),
      attendances: formattedAttendances,
      matches: (matches || []) as ClubMatchResult[],
      guests: (guests || []) as ClubSessionGuest[],
    },
    myMemberId: myMember?.id ?? null,
    myRole: (myMember?.role ?? null) as import('./types').ClubMemberRole | null,
  }
}

/** 참석 응답 취소 (삭제) */
export async function cancelAttendance(
  sessionId: string,
  clubMemberId: string
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 본인 멤버십 확인
  const { data: member } = await admin
    .from('club_members')
    .select('id, club_id')
    .eq('id', clubMemberId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member) return { error: '클럽 멤버 정보가 올바르지 않습니다.' }

  const { error } = await admin
    .from('club_session_attendances')
    .delete()
    .eq('session_id', sessionId)
    .eq('club_member_id', clubMemberId)

  if (error) return { error: `취소 실패: ${error.message}` }

  revalidatePath(`/clubs/${member.club_id}`)
  return {}
}

export async function changeSessionStatus(
  sessionId: string,
  newStatus: 'OPEN' | 'CLOSED' | 'COMPLETED' | 'CANCELLED'
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.' }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError }

  const { error } = await admin
    .from('club_sessions')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  if (error) return { error: `상태 변경 실패: ${error.message}` }

  revalidatePath(`/clubs/${session.club_id}`)
  return {}
}

export async function deleteClubSession(
  sessionId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.' }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError }

  const { error } = await admin
    .from('club_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) return { error: `삭제 실패: ${error.message}` }

  revalidatePath(`/clubs/${session.club_id}`)
  return { }
}

/** 경기 수정 (관리자) */
export async function updateMatchResult(
  matchId: string,
  input: {
    player1_member_id?: string
    player2_member_id?: string
    court_number?: string | null
    scheduled_time?: string | null
    player1_score?: number | null
    player2_score?: number | null
    status?: string
  }
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: match } = await admin
    .from('club_match_results')
    .select(`id, status, player1_member_id, player2_member_id, club_sessions!inner(club_id)`)
    .eq('id', matchId)
    .single()

  if (!match) return { error: '경기를 찾을 수 없습니다.' }

  const clubId = extractClubId(match.club_sessions)
  const { error: authError } = await checkSessionOfficerAuth(clubId)
  if (authError) return { error: authError }

  if (input.player1_member_id && input.player1_member_id === input.player2_member_id) {
    return { error: '같은 선수를 배정할 수 없습니다.' }
  }

  const updateData: Record<string, unknown> = { ...input, updated_at: new Date().toISOString() }
  if (input.player1_score != null && input.player2_score != null) {
    const p1 = Number(input.player1_score)
    const p2 = Number(input.player2_score)
    // 팀 캡틴: 업데이트 입력값 우선, 없으면 DB 값
    const team1Captain = input.player1_member_id || match.player1_member_id || null
    const team2Captain = input.player2_member_id || match.player2_member_id || null
    updateData.winner_member_id = p1 > p2 ? team1Captain : p2 > p1 ? team2Captain : null
    if (!input.status) updateData.status = 'COMPLETED'
  }

  const { error } = await admin
    .from('club_match_results')
    .update(updateData)
    .eq('id', matchId)

  if (error) return { error: `수정 실패: ${error.message}` }

  revalidatePath(`/clubs/${clubId}`)
  return {}
}

/** 세션 전체 대진 삭제 (관리자) */
export async function deleteAllMatchResults(
  sessionId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.' }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError }

  const { error } = await admin
    .from('club_match_results')
    .delete()
    .eq('session_id', sessionId)

  if (error) return { error: `전체 삭제 실패: ${error.message}` }

  revalidatePath(`/clubs/${session.club_id}`)
  return {}
}

// ============================================================================
// 개인 게임 결과 조회
// ============================================================================

export type RankingPeriod = 'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom'

function getPeriodRange(
  period: RankingPeriod,
  customRange?: { from: string; to: string }
): { from: string | null; to: string | null } {
  if (period === 'custom') {
    return customRange ? { from: customRange.from, to: customRange.to } : { from: null, to: null }
  }

  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1

  if (period === 'all') return { from: null, to: null }
  if (period === 'this_month') {
    return {
      from: `${y}-${String(m).padStart(2, '0')}-01`,
      to: `${y}-${String(m).padStart(2, '0')}-31`,
    }
  }
  if (period === 'last_month') {
    const lm = m === 1 ? 12 : m - 1
    const ly = m === 1 ? y - 1 : y
    return {
      from: `${ly}-${String(lm).padStart(2, '0')}-01`,
      to: `${ly}-${String(lm).padStart(2, '0')}-31`,
    }
  }
  if (period === 'this_year') {
    return { from: `${y}-01-01`, to: `${y}-12-31` }
  }
  if (period === 'last_year') {
    return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
  }
  return { from: null, to: null }
}

export interface MemberGameResult {
  id: string
  session_id: string
  session_title: string
  session_date: string
  match_type: MatchType
  court_number: string | null
  scheduled_time: string | null
  my_score: number | null
  opponent_score: number | null
  is_win: boolean | null
  status: string
  partner?: { id: string; name: string } | null
  opponent1?: { id: string; name: string } | null
  opponent2?: { id: string; name: string } | null
}

/** 특정 멤버의 게임 결과 조회 */
export async function getMemberGameResults(
  clubId: string,
  memberId: string,
  period: RankingPeriod = 'all',
  customRange?: { from: string; to: string }
): Promise<{ results: MemberGameResult[]; stats: { total: number; wins: number; losses: number; win_rate: number } }> {
  const admin = createAdminClient()
  const { from, to } = getPeriodRange(period, customRange)

  // 해당 멤버가 포함된 모든 경기 조회 (player1, player2, player1b, player2b + 게스트)
  const baseSelect = `
    *,
    club_sessions!inner(id, title, session_date, club_id),
    player1:club_members!club_match_results_player1_member_id_fkey(id, name),
    player2:club_members!club_match_results_player2_member_id_fkey(id, name)
  `
  const doublesSelect = `
    *,
    club_sessions!inner(id, title, session_date, club_id),
    player1:club_members!club_match_results_player1_member_id_fkey(id, name),
    player2:club_members!club_match_results_player2_member_id_fkey(id, name),
    player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
    player2b:club_members!club_match_results_player2b_member_id_fkey(id, name),
    player1_guest:club_session_guests!club_match_results_player1_guest_id_fkey(id, name),
    player2_guest:club_session_guests!club_match_results_player2_guest_id_fkey(id, name),
    player1b_guest:club_session_guests!club_match_results_player1b_guest_id_fkey(id, name),
    player2b_guest:club_session_guests!club_match_results_player2b_guest_id_fkey(id, name)
  `

  const buildQuery = (selectStr: string, field: string, value: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = admin.from('club_match_results').select(selectStr)
      .eq('club_sessions.club_id', clubId)
      .eq(field, value)
      .eq('status', 'COMPLETED')
    if (from) q = q.gte('club_sessions.session_date', from)
    if (to) q = q.lte('club_sessions.session_date', to)
    return q
  }

  // Try with doubles joins, fall back to base if FK not found
  let allMatches: Record<string, unknown>[] = []
  {
    const testQ = await buildQuery(doublesSelect, 'player1_member_id', memberId)
    if (testQ.error?.code === 'PGRST200') {
      // Migration not yet run - use base select for all 2 positions
      const [r1, r2] = await Promise.all([
        buildQuery(baseSelect, 'player1_member_id', memberId),
        buildQuery(baseSelect, 'player2_member_id', memberId),
      ])
      allMatches = [...(r1.data || []), ...(r2.data || [])]
    } else {
      // Migration done - query all 4 positions
      const [r1, r2, r3, r4] = await Promise.all([
        testQ, // already fetched
        buildQuery(doublesSelect, 'player2_member_id', memberId),
        buildQuery(doublesSelect, 'player1b_member_id', memberId),
        buildQuery(doublesSelect, 'player2b_member_id', memberId),
      ])
      allMatches = [...(r1.data || []), ...(r2.data || []), ...(r3.data || []), ...(r4.data || [])]
    }
  }

  // Deduplicate by id
  const seen = new Set<string>()
  const unique = allMatches.filter((m: Record<string, unknown>) => {
    if (seen.has(m.id as string)) return false
    seen.add(m.id as string)
    return true
  })

  // Sort by session_date desc
  unique.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
    const sa = (a.club_sessions as Record<string, unknown>)?.session_date as string || ''
    const sb = (b.club_sessions as Record<string, unknown>)?.session_date as string || ''
    return sb.localeCompare(sa)
  })

  const formatted: MemberGameResult[] = unique.map((m: Record<string, unknown>) => {
    const isPlayer1 = m.player1_member_id === memberId || m.player1b_member_id === memberId
    const p1Score = m.player1_score as number | null
    const p2Score = m.player2_score as number | null
    const myScore = isPlayer1 ? p1Score : p2Score
    const oppScore = isPlayer1 ? p2Score : p1Score
    const winnerId = m.winner_member_id as string | null
    const isWin = winnerId === null ? null : (
      isPlayer1
        ? (winnerId === m.player1_member_id || winnerId === m.player1b_member_id)
        : (winnerId === m.player2_member_id || winnerId === m.player2b_member_id)
    )
    const sessions = m.club_sessions as Record<string, unknown>

    // Partner and opponents (member 우선, 없으면 guest 폴백)
    type NamedEntity = { id: string; name: string }
    const p1m = (m.player1 as NamedEntity | null) ?? null
    const p2m = (m.player2 as NamedEntity | null) ?? null
    const p1bm = (m.player1b as NamedEntity | null) ?? null
    const p2bm = (m.player2b as NamedEntity | null) ?? null
    const p1g = (m.player1_guest as NamedEntity | null) ?? null
    const p2g = (m.player2_guest as NamedEntity | null) ?? null
    const p1bg = (m.player1b_guest as NamedEntity | null) ?? null
    const p2bg = (m.player2b_guest as NamedEntity | null) ?? null

    let partner: NamedEntity | null = null
    let opponent1: NamedEntity | null = null
    let opponent2: NamedEntity | null = null

    if (isPlayer1) {
      if (m.player1_member_id === memberId) partner = p1bm ?? p1bg
      else partner = p1m ?? p1g
      opponent1 = p2m ?? p2g
      opponent2 = p2bm ?? p2bg
    } else {
      if (m.player2_member_id === memberId) partner = p2bm ?? p2bg
      else partner = p2m ?? p2g
      opponent1 = p1m ?? p1g
      opponent2 = p1bm ?? p1bg
    }

    return {
      id: m.id as string,
      session_id: sessions?.id as string,
      session_title: sessions?.title as string,
      session_date: sessions?.session_date as string,
      match_type: (m.match_type as MatchType) || 'singles',
      court_number: m.court_number as string | null,
      scheduled_time: m.scheduled_time as string | null,
      my_score: myScore,
      opponent_score: oppScore,
      is_win: isWin,
      status: m.status as string,
      partner: partner || undefined,
      opponent1: opponent1 || undefined,
      opponent2: opponent2 || undefined,
    }
  })

  const completed = formatted.filter((r) => r.is_win !== null)
  const wins = completed.filter((r) => r.is_win).length
  const losses = completed.filter((r) => r.is_win === false).length
  const winRate = completed.length > 0 ? Math.round((wins / completed.length) * 100) : 0

  return {
    results: formatted,
    stats: { total: completed.length, wins, losses, win_rate: winRate },
  }
}

/** 기간별 클럽 순위 조회 (club_match_results 직접 집계) */
export async function getClubRankingsByPeriod(
  clubId: string,
  period: RankingPeriod = 'all',
  customRange?: { from: string; to: string }
): Promise<Array<{
  member: { id: string; name: string; rating: number | null }
  total: number; wins: number; losses: number; win_rate: number
  win_points: number; points_for: number; points_against: number; margin: number
}>> {
  const admin = createAdminClient()
  const { from, to } = getPeriodRange(period, customRange)

  const doublesSelectR = `
    *,
    club_sessions!inner(club_id, session_date),
    player1:club_members!club_match_results_player1_member_id_fkey(id, name, rating),
    player2:club_members!club_match_results_player2_member_id_fkey(id, name, rating),
    player1b:club_members!club_match_results_player1b_member_id_fkey(id, name, rating),
    player2b:club_members!club_match_results_player2b_member_id_fkey(id, name, rating),
    player1_guest:club_session_guests!club_match_results_player1_guest_id_fkey(id),
    player2_guest:club_session_guests!club_match_results_player2_guest_id_fkey(id),
    player1b_guest:club_session_guests!club_match_results_player1b_guest_id_fkey(id),
    player2b_guest:club_session_guests!club_match_results_player2b_guest_id_fkey(id)
  `
  const baseSelectR = `
    *,
    club_sessions!inner(club_id, session_date),
    player1:club_members!club_match_results_player1_member_id_fkey(id, name, rating),
    player2:club_members!club_match_results_player2_member_id_fkey(id, name, rating)
  `

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildRankQuery = (selectStr: string): any => {
    let q = admin.from('club_match_results').select(selectStr)
      .eq('club_sessions.club_id', clubId)
      .eq('status', 'COMPLETED')
    if (from) q = (q as any).gte('club_sessions.session_date', from)
    if (to) q = (q as any).lte('club_sessions.session_date', to)
    return q
  }

  // Try doubles join first
  let data: Record<string, unknown>[] | null = null
  const doublesResult = await buildRankQuery(doublesSelectR)
  if (doublesResult.error?.code === 'PGRST200') {
    // FK not ready - fall back to base select
    const baseResult = await buildRankQuery(baseSelectR)
    if (baseResult.error) return []
    data = baseResult.data
  } else {
    if (doublesResult.error) return []
    data = doublesResult.data
  }
  if (!data) return []

  // 멤버별 통계 집계
  const statsMap = new Map<string, {
    member: { id: string; name: string; rating: number | null }
    total: number; wins: number; losses: number
    points_for: number; points_against: number
  }>()

  const addPlayer = (
    memberId: string,
    memberInfo: { id: string; name: string; rating: number | null } | null,
    isWin: boolean | null,
    isDraw: boolean,
    myScore: number | null,
    oppScore: number | null
  ) => {
    if (!memberId || !memberInfo) return
    if (!statsMap.has(memberId)) {
      statsMap.set(memberId, { member: memberInfo, total: 0, wins: 0, losses: 0, points_for: 0, points_against: 0 })
    }
    const s = statsMap.get(memberId)!
    s.total++
    if (isWin) s.wins++
    else if (!isDraw) s.losses++
    if (myScore != null) s.points_for += myScore
    if (oppScore != null) s.points_against += oppScore
  }

  for (const m of data as Record<string, unknown>[]) {
    const isDraw = m.winner_member_id === null
    const p1Score = m.player1_score as number | null
    const p2Score = m.player2_score as number | null

    // 팀 승리: winner_member_id가 해당 팀의 멤버 슬롯(captain or partner)에 해당
    const team1Win = !isDraw && (
      m.winner_member_id === m.player1_member_id ||
      m.winner_member_id === m.player1b_member_id
    )
    const team2Win = !isDraw && (
      m.winner_member_id === m.player2_member_id ||
      m.winner_member_id === m.player2b_member_id
    )

    // 게스트 슬롯은 순위 집계 제외 (memberId null인 경우 addPlayer 내부에서 skip)
    addPlayer(m.player1_member_id as string, m.player1 as { id: string; name: string; rating: number | null }, team1Win, isDraw, p1Score, p2Score)
    addPlayer(m.player2_member_id as string, m.player2 as { id: string; name: string; rating: number | null }, team2Win, isDraw, p2Score, p1Score)
    if (m.player1b_member_id) addPlayer(m.player1b_member_id as string, m.player1b as { id: string; name: string; rating: number | null }, team1Win, isDraw, p1Score, p2Score)
    if (m.player2b_member_id) addPlayer(m.player2b_member_id as string, m.player2b as { id: string; name: string; rating: number | null }, team2Win, isDraw, p2Score, p1Score)
  }

  return Array.from(statsMap.values())
    .map((s) => ({
      ...s,
      win_rate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0,
      // 승점: 승 × 2 (무승부는 현재 없으므로 단순 wins × 2)
      win_points: s.wins * 2,
      margin: s.points_for - s.points_against,
    }))
    .sort((a, b) => {
      // 승점 → 마진 → 승률 순 정렬
      if (b.win_points !== a.win_points) return b.win_points - a.win_points
      if (b.margin !== a.margin) return b.margin - a.margin
      return b.win_rate - a.win_rate
    })
}

// ============================================================================
// 클럽 순위 기본 조회 기간 설정
// ============================================================================

/** 클럽의 순위 기본 조회 기간 조회 */
export async function getClubDefaultRankingPeriod(clubId: string): Promise<{
  period: RankingPeriod
  customFrom: string | null
  customTo: string | null
}> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('clubs')
    .select('default_ranking_period, default_ranking_from, default_ranking_to')
    .eq('id', clubId)
    .single()
  return {
    period: (data?.default_ranking_period as RankingPeriod) || 'all',
    customFrom: data?.default_ranking_from ?? null,
    customTo: data?.default_ranking_to ?? null,
  }
}

/** 클럽의 순위 기본 조회 기간 저장 (임원 전용) */
export async function updateClubDefaultRankingPeriod(
  clubId: string,
  period: RankingPeriod,
  customFrom?: string | null,
  customTo?: string | null
): Promise<{ error?: string }> {
  const { error: authError } = await checkSessionOfficerAuth(clubId)
  if (authError) return { error: authError }

  const admin = createAdminClient()
  const { error } = await admin
    .from('clubs')
    .update({
      default_ranking_period: period,
      default_ranking_from: period === 'custom' ? (customFrom ?? null) : null,
      default_ranking_to: period === 'custom' ? (customTo ?? null) : null,
    })
    .eq('id', clubId)
  return { error: error?.message }
}
