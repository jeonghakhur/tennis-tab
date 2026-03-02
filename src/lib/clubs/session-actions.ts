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
  options?: { status?: ClubSessionStatus[]; limit?: number }
): Promise<ClubSession[]> {
  const admin = createAdminClient()
  const user = await getCurrentUser()

  // sessions + attendances JOIN, myMember 병렬 조회
  let query = admin
    .from('club_sessions')
    .select('*, club_session_attendances(session_id, status, club_member_id)')
    .eq('club_id', clubId)
    .order('session_date', { ascending: false })

  if (options?.status && options.status.length > 0) {
    query = query.in('status', options.status)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
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
      club_members!inner(id, name, rating, is_registered)
    `)
    .eq('session_id', sessionId)
    .order('responded_at', { ascending: true })

  // 경기 결과
  const { data: matches } = await admin
    .from('club_match_results')
    .select(`
      *,
      player1:club_members!club_match_results_player1_member_id_fkey(id, name),
      player2:club_members!club_match_results_player2_member_id_fkey(id, name),
      player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
      player2b:club_members!club_match_results_player2b_member_id_fkey(id, name)
    `)
    .eq('session_id', sessionId)
    .order('scheduled_time', { ascending: true })

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

  if (input.player1_member_id === input.player2_member_id) {
    return { error: '같은 선수를 배정할 수 없습니다.' }
  }

  const insertData: Record<string, unknown> = {
    session_id: input.session_id,
    player1_member_id: input.player1_member_id,
    player2_member_id: input.player2_member_id,
    court_number: input.court_number || null,
    scheduled_time: input.scheduled_time || null,
  }
  // 복식 컬럼은 마이그레이션 후 사용 가능
  if (input.match_type) insertData.match_type = input.match_type
  if (input.player1b_member_id) insertData.player1b_member_id = input.player1b_member_id
  if (input.player2b_member_id) insertData.player2b_member_id = input.player2b_member_id

  const { data, error } = await admin
    .from('club_match_results')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    // 새 컬럼 없을 경우 fallback (마이그레이션 전)
    if (error.code === 'PGRST204' && (input.match_type || input.player1b_member_id)) {
      const fallback = await admin.from('club_match_results').insert({
        session_id: input.session_id,
        player1_member_id: input.player1_member_id,
        player2_member_id: input.player2_member_id,
        court_number: input.court_number || null,
        scheduled_time: input.scheduled_time || null,
      }).select().single()
      if (fallback.error) return { error: `대진 생성 실패: ${fallback.error.message}` }
      return { data: fallback.data as ClubMatchResult }
    }
    return { error: `대진 생성 실패: ${error.message}` }
  }

  revalidatePath(`/clubs/${session.club_id}`)
  return { data: data as ClubMatchResult }
}

/** 라운드로빈 대진 자동 생성 */
export async function createRoundRobinMatches(
  sessionId: string,
  memberIds: string[]
): Promise<{ count: number; error?: string }> {
  if (memberIds.length < 2) return { error: '최소 2명 이상 필요합니다.', count: 0 }

  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, court_numbers')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.', count: 0 }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError, count: 0 }

  // 단식 라운드로빈 조합 생성
  const matches: {
    session_id: string
    match_type: string
    player1_member_id: string
    player2_member_id: string
  }[] = []

  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      matches.push({
        session_id: sessionId,
        match_type: 'singles',
        player1_member_id: memberIds[i],
        player2_member_id: memberIds[j],
      })
    }
  }

  const { error } = await admin.from('club_match_results').insert(matches)

  if (error) return { error: `대진 생성 실패: ${error.message}`, count: 0 }

  revalidatePath(`/clubs/${session.club_id}`)
  return { count: matches.length }
}

/** 복식 라운드로빈 자동 생성 */
export async function createDoublesRoundRobinMatches(
  sessionId: string,
  attendingMembersWithGender: { id: string; gender: string | null }[]
): Promise<{ count: number; preview: { men: number; women: number; mixed: number }; error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, court_numbers, start_time')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '모임을 찾을 수 없습니다.', count: 0, preview: { men: 0, women: 0, mixed: 0 } }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError, count: 0, preview: { men: 0, women: 0, mixed: 0 } }

  const men = attendingMembersWithGender.filter((m) => m.gender === 'MALE').map((m) => m.id)
  const women = attendingMembersWithGender.filter((m) => m.gender === 'FEMALE').map((m) => m.id)

  type DoubleMatch = {
    session_id: string
    match_type: string
    player1_member_id: string
    player1b_member_id: string
    player2_member_id: string
    player2b_member_id: string
    scheduled_time: string | null
    court_number: string | null
  }

  const matches: DoubleMatch[] = []
  const courts: string[] = session.court_numbers || []

  // 코트 배분 + 시간 슬롯 (게임당 30분)
  let slotIndex = 0
  const baseTime = session.start_time ? session.start_time.slice(0, 5) : '10:00'
  const [bh, bm] = baseTime.split(':').map(Number)

  const getSlot = () => {
    const courtIndex = courts.length > 0 ? slotIndex % courts.length : -1
    const timeOffset = Math.floor(slotIndex / (courts.length || 1)) * 30
    const totalMinutes = bh * 60 + bm + timeOffset
    const h = Math.floor(totalMinutes / 60) % 24
    const m = totalMinutes % 60
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    slotIndex++
    return {
      court_number: courtIndex >= 0 ? courts[courtIndex] : null,
      scheduled_time: timeStr,
    }
  }

  // 남복: 남자 4명 이상 시 생성
  if (men.length >= 4) {
    for (let i = 0; i < men.length; i += 2) {
      for (let j = i + 2; j < men.length; j += 2) {
        if (i + 1 < men.length && j + 1 < men.length) {
          const slot = getSlot()
          matches.push({
            session_id: sessionId,
            match_type: 'doubles_men',
            player1_member_id: men[i],
            player1b_member_id: men[i + 1],
            player2_member_id: men[j],
            player2b_member_id: men[j + 1],
            ...slot,
          })
        }
      }
    }
  }

  // 여복: 여자 4명 이상 시 생성
  if (women.length >= 4) {
    for (let i = 0; i < women.length; i += 2) {
      for (let j = i + 2; j < women.length; j += 2) {
        if (i + 1 < women.length && j + 1 < women.length) {
          const slot = getSlot()
          matches.push({
            session_id: sessionId,
            match_type: 'doubles_women',
            player1_member_id: women[i],
            player1b_member_id: women[i + 1],
            player2_member_id: women[j],
            player2b_member_id: women[j + 1],
            ...slot,
          })
        }
      }
    }
  }

  // 혼복: 남녀 각 2명 이상 시 생성
  if (men.length >= 2 && women.length >= 2) {
    // 혼복 팀 조합: (남, 여) 쌍을 만들어서 vs
    const mixedTeams: [string, string][] = []
    for (let i = 0; i < Math.min(men.length, 4); i++) {
      for (let j = 0; j < Math.min(women.length, 4); j++) {
        mixedTeams.push([men[i % men.length], women[j % women.length]])
      }
    }
    for (let i = 0; i < mixedTeams.length; i++) {
      for (let j = i + 1; j < mixedTeams.length; j++) {
        const slot = getSlot()
        matches.push({
          session_id: sessionId,
          match_type: 'doubles_mixed',
          player1_member_id: mixedTeams[i][0],
          player1b_member_id: mixedTeams[i][1],
          player2_member_id: mixedTeams[j][0],
          player2b_member_id: mixedTeams[j][1],
          ...slot,
        })
      }
    }
  }

  if (matches.length === 0) {
    return { error: '복식 조합을 만들 수 없습니다. 남자 4명 이상, 여자 4명 이상, 또는 각 2명 이상 필요합니다.', count: 0, preview: { men: 0, women: 0, mixed: 0 } }
  }

  const preview = {
    men: matches.filter((m) => m.match_type === 'doubles_men').length,
    women: matches.filter((m) => m.match_type === 'doubles_women').length,
    mixed: matches.filter((m) => m.match_type === 'doubles_mixed').length,
  }

  const { error } = await admin.from('club_match_results').insert(matches)
  if (error) return { error: `대진 생성 실패: ${error.message}`, count: 0, preview }

  revalidatePath(`/clubs/${session.club_id}`)
  return { count: matches.length, preview }
}

/** 복식 대진 미리보기 (DB 저장 없음) */
export async function previewDoublesMatches(
  sessionId: string,
  membersWithGender: { id: string; gender: string | null }[]
): Promise<{ men: number; women: number; mixed: number; total: number }> {
  const men = membersWithGender.filter((m) => m.gender === 'MALE').length
  const women = membersWithGender.filter((m) => m.gender === 'FEMALE').length
  const menPairs = Math.floor(men / 2)
  const womenPairs = Math.floor(women / 2)

  let menMatches = 0
  let womenMatches = 0
  let mixedMatches = 0

  if (men >= 4) {
    menMatches = (menPairs * (menPairs - 1)) / 2
  }
  if (women >= 4) {
    womenMatches = (womenPairs * (womenPairs - 1)) / 2
  }
  if (men >= 2 && women >= 2) {
    const mixedTeams = Math.min(men, 4) * Math.min(women, 4)
    mixedMatches = (mixedTeams * (mixedTeams - 1)) / 2
  }

  return { men: menMatches, women: womenMatches, mixed: mixedMatches, total: menMatches + womenMatches + mixedMatches }
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
      // 일치 → COMPLETED
      const winnerId =
        myP1 > myP2
          ? match.player1_member_id
          : myP2 > myP1
            ? match.player2_member_id
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

  const winnerId =
    input.player1_score > input.player2_score
      ? match.player1_member_id
      : input.player2_score > input.player1_score
        ? match.player2_member_id
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

/** 경기 목록 조회 */
export async function getSessionMatches(
  sessionId: string
): Promise<ClubMatchResult[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('club_match_results')
    .select(`
      *,
      player1:club_members!club_match_results_player1_member_id_fkey(id, name),
      player2:club_members!club_match_results_player2_member_id_fkey(id, name),
      player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
      player2b:club_members!club_match_results_player2b_member_id_fkey(id, name)
    `)
    .eq('session_id', sessionId)
    .order('scheduled_time', { ascending: true })

  if (error || !data) return []
  return data as ClubMatchResult[]
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

  const players = [
    { memberId: match.player1_member_id, isWinner: match.winner_member_id === match.player1_member_id },
    { memberId: match.player2_member_id, isWinner: match.winner_member_id === match.player2_member_id },
  ]

  for (const player of players) {
    const { data: existing } = await admin
      .from('club_member_stats')
      .select('id, total_games, wins, losses')
      .eq('club_id', clubId)
      .eq('club_member_id', player.memberId)
      .eq('season', season)
      .single()

    // 무승부 (winner_member_id = null)인 경우: 둘 다 isWinner=false
    const isDraw = match.winner_member_id === null

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
  ] = await Promise.all([
    admin.from('club_sessions').select('*').eq('id', sessionId).single(),
    admin
      .from('club_session_attendances')
      .select('*, club_members!inner(id, name, rating, is_registered)')
      .eq('session_id', sessionId)
      .order('responded_at', { ascending: true }),
    admin
      .from('club_match_results')
      .select(`
        *,
        player1:club_members!club_match_results_player1_member_id_fkey(id, name),
        player2:club_members!club_match_results_player2_member_id_fkey(id, name),
        player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
        player2b:club_members!club_match_results_player2b_member_id_fkey(id, name)
      `)
      .eq('session_id', sessionId)
      .order('scheduled_time', { ascending: true }),
    user
      ? admin
          .from('club_members')
          .select('id, role')
          .eq('club_id', clubId)
          .eq('user_id', user.id)
          .eq('status', 'ACTIVE')
          .single()
      : Promise.resolve({ data: null }),
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
    const p1id = input.player1_member_id || match.player1_member_id
    const p2id = input.player2_member_id || match.player2_member_id
    updateData.winner_member_id = p1 > p2 ? p1id : p2 > p1 ? p2id : null
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

export type RankingPeriod = 'all' | 'this_month' | 'last_month' | 'this_year' | 'last_year'

function getPeriodRange(period: RankingPeriod): { from: string | null; to: string | null } {
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
  period: RankingPeriod = 'all'
): Promise<{ results: MemberGameResult[]; stats: { total: number; wins: number; losses: number; win_rate: number } }> {
  const admin = createAdminClient()
  const { from, to } = getPeriodRange(period)

  // 해당 멤버가 포함된 모든 경기 조회 (player1, player2, player1b, player2b)
  const queries = [
    admin.from('club_match_results').select(`
      *,
      club_sessions!inner(id, title, session_date, club_id),
      player1:club_members!club_match_results_player1_member_id_fkey(id, name),
      player2:club_members!club_match_results_player2_member_id_fkey(id, name),
      player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
      player2b:club_members!club_match_results_player2b_member_id_fkey(id, name)
    `).eq('club_sessions.club_id', clubId).eq('player1_member_id', memberId).eq('status', 'COMPLETED'),
    admin.from('club_match_results').select(`
      *,
      club_sessions!inner(id, title, session_date, club_id),
      player1:club_members!club_match_results_player1_member_id_fkey(id, name),
      player2:club_members!club_match_results_player2_member_id_fkey(id, name),
      player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
      player2b:club_members!club_match_results_player2b_member_id_fkey(id, name)
    `).eq('club_sessions.club_id', clubId).eq('player2_member_id', memberId).eq('status', 'COMPLETED'),
    admin.from('club_match_results').select(`
      *,
      club_sessions!inner(id, title, session_date, club_id),
      player1:club_members!club_match_results_player1_member_id_fkey(id, name),
      player2:club_members!club_match_results_player2_member_id_fkey(id, name),
      player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
      player2b:club_members!club_match_results_player2b_member_id_fkey(id, name)
    `).eq('club_sessions.club_id', clubId).eq('player1b_member_id', memberId).eq('status', 'COMPLETED'),
    admin.from('club_match_results').select(`
      *,
      club_sessions!inner(id, title, session_date, club_id),
      player1:club_members!club_match_results_player1_member_id_fkey(id, name),
      player2:club_members!club_match_results_player2_member_id_fkey(id, name),
      player1b:club_members!club_match_results_player1b_member_id_fkey(id, name),
      player2b:club_members!club_match_results_player2b_member_id_fkey(id, name)
    `).eq('club_sessions.club_id', clubId).eq('player2b_member_id', memberId).eq('status', 'COMPLETED'),
  ]

  const results = await Promise.all(queries.map(async (q) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = q
    if (from) query = query.gte('club_sessions.session_date', from)
    if (to) query = query.lte('club_sessions.session_date', to)
    return query
  }))
  const allMatches = results.flatMap((r) => r.data || [])

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

    // Partner and opponents
    let partner: { id: string; name: string } | null = null
    let opponent1: { id: string; name: string } | null = null
    let opponent2: { id: string; name: string } | null = null

    if (isPlayer1) {
      if (m.player1_member_id === memberId) partner = (m.player1b as { id: string; name: string } | null) ?? null
      else partner = (m.player1 as { id: string; name: string } | null) ?? null
      opponent1 = (m.player2 as { id: string; name: string } | null) ?? null
      opponent2 = (m.player2b as { id: string; name: string } | null) ?? null
    } else {
      if (m.player2_member_id === memberId) partner = (m.player2b as { id: string; name: string } | null) ?? null
      else partner = (m.player2 as { id: string; name: string } | null) ?? null
      opponent1 = (m.player1 as { id: string; name: string } | null) ?? null
      opponent2 = (m.player1b as { id: string; name: string } | null) ?? null
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
  period: RankingPeriod = 'all'
): Promise<Array<{ member: { id: string; name: string; rating: number | null }; total: number; wins: number; losses: number; win_rate: number }>> {
  const admin = createAdminClient()
  const { from, to } = getPeriodRange(period)

  let query = admin
    .from('club_match_results')
    .select(`
      *,
      club_sessions!inner(club_id, session_date),
      player1:club_members!club_match_results_player1_member_id_fkey(id, name, rating),
      player2:club_members!club_match_results_player2_member_id_fkey(id, name, rating),
      player1b:club_members!club_match_results_player1b_member_id_fkey(id, name, rating),
      player2b:club_members!club_match_results_player2b_member_id_fkey(id, name, rating)
    `)
    .eq('club_sessions.club_id', clubId)
    .eq('status', 'COMPLETED')

  if (from) query = query.gte('club_sessions.session_date', from)
  if (to) query = query.lte('club_sessions.session_date', to)

  const { data, error } = await query
  if (error || !data) return []

  // 멤버별 통계 집계
  const statsMap = new Map<string, { member: { id: string; name: string; rating: number | null }; total: number; wins: number; losses: number }>()

  const addPlayer = (
    memberId: string,
    memberInfo: { id: string; name: string; rating: number | null } | null,
    isWin: boolean | null,
    isDraw: boolean
  ) => {
    if (!memberId || !memberInfo) return
    if (!statsMap.has(memberId)) {
      statsMap.set(memberId, { member: memberInfo, total: 0, wins: 0, losses: 0 })
    }
    const s = statsMap.get(memberId)!
    s.total++
    if (isWin) s.wins++
    else if (!isDraw) s.losses++
  }

  for (const m of data as Record<string, unknown>[]) {
    const isDraw = m.winner_member_id === null
    const p1Win = !isDraw && m.winner_member_id === m.player1_member_id
    const p2Win = !isDraw && m.winner_member_id === m.player2_member_id

    addPlayer(m.player1_member_id as string, m.player1 as { id: string; name: string; rating: number | null }, p1Win, isDraw)
    addPlayer(m.player2_member_id as string, m.player2 as { id: string; name: string; rating: number | null }, p2Win, isDraw)
    if (m.player1b_member_id) addPlayer(m.player1b_member_id as string, m.player1b as { id: string; name: string; rating: number | null }, p1Win, isDraw)
    if (m.player2b_member_id) addPlayer(m.player2b_member_id as string, m.player2b as { id: string; name: string; rating: number | null }, p2Win, isDraw)
  }

  return Array.from(statsMap.values())
    .map((s) => ({
      ...s,
      win_rate: s.total > 0 ? Math.round((s.wins / s.total) * 100) : 0,
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.win_rate !== a.win_rate) return b.win_rate - a.win_rate
      return b.total - a.total
    })
}
