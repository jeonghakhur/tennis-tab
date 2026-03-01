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

/** 세션 생성 */
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

  if (error) return { error: `세션 생성 실패: ${error.message}` }

  revalidatePath(`/clubs/${input.club_id}`)
  return { data: data as ClubSession }
}

/** 세션 목록 조회 */
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

/** 세션 상세 조회 (참석 + 경기) */
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
      player2:club_members!club_match_results_player2_member_id_fkey(id, name)
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

/** 세션 수정 (OPEN 상태만) */
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

  if (!session) return { error: '세션을 찾을 수 없습니다.' }
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

/** 세션 취소 */
export async function cancelClubSession(
  sessionId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '세션을 찾을 수 없습니다.' }
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

  if (!session) return { error: '세션을 찾을 수 없습니다.' }
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

/** 세션 완료 처리 (CLOSED → COMPLETED) */
export async function completeSession(
  sessionId: string
): Promise<{ error?: string }> {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('club_sessions')
    .select('id, club_id, status')
    .eq('id', sessionId)
    .single()

  if (!session) return { error: '세션을 찾을 수 없습니다.' }
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

  if (!session) return { error: '세션을 찾을 수 없습니다.' }
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

  if (!session) return { error: '세션을 찾을 수 없습니다.' }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError }

  if (input.player1_member_id === input.player2_member_id) {
    return { error: '같은 선수를 배정할 수 없습니다.' }
  }

  const { data, error } = await admin
    .from('club_match_results')
    .insert({
      session_id: input.session_id,
      player1_member_id: input.player1_member_id,
      player2_member_id: input.player2_member_id,
      court_number: input.court_number || null,
      scheduled_time: input.scheduled_time || null,
    })
    .select()
    .single()

  if (error) return { error: `대진 생성 실패: ${error.message}` }

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

  if (!session) return { error: '세션을 찾을 수 없습니다.', count: 0 }

  const { error: authError } = await checkSessionOfficerAuth(session.club_id)
  if (authError) return { error: authError, count: 0 }

  // 라운드로빈 조합 생성
  const matches: {
    session_id: string
    player1_member_id: string
    player2_member_id: string
  }[] = []

  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      matches.push({
        session_id: sessionId,
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
      player2:club_members!club_match_results_player2_member_id_fkey(id, name)
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

/** 세션 상세 + 내 멤버십 한 번에 조회 (라운드트립 1회) */
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
        player2:club_members!club_match_results_player2_member_id_fkey(id, name)
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
