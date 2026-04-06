'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import type { AttendanceStatus } from '@/lib/clubs/types'

// ============================================================================
// 타입 정의
// ============================================================================

/** 부서별 신청 현황 */
export interface DivisionSummary {
  name: string
  max_teams: number | null
  entry_count: number
}

/** 대회 현황 카드 (모집 중 + 진행 중 통합) */
export interface ActiveTournament {
  id: string
  title: string
  location: string
  status: 'OPEN' | 'IN_PROGRESS'
  entry_end_date: string
  daysLeft: number
  division_count: number
  hasBracket: boolean
  entry_count: number
  max_participants: number
  divisions: DivisionSummary[]
}

/** @deprecated ActiveTournament으로 대체 */
export interface DeadlineTournament {
  id: string
  title: string
  location: string
  entry_end_date: string
  daysLeft: number
  poster_url: string | null
  division_count: number
}

/** 클럽 세션 + 클럽명 + 내 출석 상태 */
export interface ClubSessionWithClub {
  id: string
  club_id: string
  club_name: string
  title: string
  venue_name: string
  court_numbers: string[]
  session_date: string
  start_time: string
  end_time: string
  status: string
  myAttendance: AttendanceStatus | null
}

/** 진행 중인 대회 + 최근 경기 결과 */
export interface LiveTournament {
  id: string
  title: string
  bracketExists: boolean
  recentMatches: {
    id: string
    team1: string
    team2: string
    score1: number | null
    score2: number | null
    winnerEntryId: string | null
    team1EntryId: string | null
    team2EntryId: string | null
  }[]
}

/** 핀 고정 공지 */
export interface PinnedNotice {
  id: string
  title: string
  created_at: string
}

// ============================================================================
// 유틸
// ============================================================================

/** 오늘 날짜(YYYY-MM-DD) 기준 daysLeft 계산 */
function calcDaysLeft(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * 모집 중 대회 (status=OPEN) 전체
 * entry_end_date 오름차순, 최대 6개
 */
export async function getUpcomingDeadlineTournaments(): Promise<DeadlineTournament[]> {
  const admin = createAdminClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const { data, error } = await admin
    .from('tournaments')
    .select('id, title, location, entry_end_date, poster_url')
    .eq('status', 'OPEN')
    // 마감일 있으면 이미 지난 건 제외, 없으면 포함
    .or(`entry_end_date.is.null,entry_end_date.gte.${todayStr}`)
    .order('entry_end_date', { ascending: true, nullsFirst: false })
    .limit(6)

  if (error || !data) return []

  // 부서 수 병렬 조회
  const withDivisions = await Promise.all(
    data.map(async (t) => {
      const { count } = await admin
        .from('tournament_divisions')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', t.id)

      return {
        id: t.id,
        title: t.title,
        location: t.location,
        entry_end_date: t.entry_end_date ?? '',
        daysLeft: t.entry_end_date ? calcDaysLeft(t.entry_end_date) : 999,
        poster_url: t.poster_url,
        division_count: count ?? 0,
      }
    })
  )

  return withDivisions
}

/**
 * 내 클럽 upcoming sessions (session_date ≤ 14일, status=OPEN)
 * userId가 ACTIVE 멤버인 클럽의 세션 최대 5개
 */
export async function getMyClubUpcomingSessions(userId: string): Promise<ClubSessionWithClub[]> {
  if (!userId) return []

  const admin = createAdminClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  const fourteenDaysLater = new Date(today)
  fourteenDaysLater.setDate(fourteenDaysLater.getDate() + 14)
  const fourteenDaysStr = fourteenDaysLater.toISOString().slice(0, 10)

  // 1) userId가 속한 ACTIVE 클럽 멤버 목록 조회
  const { data: memberships } = await admin
    .from('club_members')
    .select('id, club_id')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')

  if (!memberships || memberships.length === 0) return []

  const clubIds = memberships.map((m) => m.club_id)
  const memberMap = new Map(memberships.map((m) => [m.club_id, m.id]))

  // 2) 해당 클럽들의 upcoming sessions
  const { data: sessions, error } = await admin
    .from('club_sessions')
    .select('id, club_id, title, venue_name, court_numbers, session_date, start_time, end_time, status, clubs(name)')
    .in('club_id', clubIds)
    .eq('status', 'OPEN')
    .gte('session_date', todayStr)
    .lte('session_date', fourteenDaysStr)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(5)

  if (error || !sessions) return []

  // 3) 내 출석 상태 병렬 조회
  const result = await Promise.all(
    sessions.map(async (s) => {
      const memberId = memberMap.get(s.club_id)
      let myAttendance: AttendanceStatus | null = null

      if (memberId) {
        const { data: att } = await admin
          .from('club_session_attendances')
          .select('status')
          .eq('session_id', s.id)
          .eq('club_member_id', memberId)
          .maybeSingle()

        myAttendance = (att?.status as AttendanceStatus) ?? null
      }

      const clubData = s.clubs
      const clubName = Array.isArray(clubData)
        ? (clubData[0]?.name ?? '')
        : ((clubData as { name: string } | null)?.name ?? '')

      return {
        id: s.id,
        club_id: s.club_id,
        club_name: clubName,
        title: s.title,
        venue_name: s.venue_name,
        court_numbers: s.court_numbers,
        session_date: s.session_date,
        start_time: s.start_time,
        end_time: s.end_time,
        status: s.status,
        myAttendance,
      }
    })
  )

  return result
}

/**
 * IN_PROGRESS 대회 + 최근 완료된 경기 (대회별 최대 3건)
 * 대회 최대 5개
 */
export async function getLiveResults(): Promise<LiveTournament[]> {
  const admin = createAdminClient()

  const { data: tournaments, error: tErr } = await admin
    .from('tournaments')
    .select('id, title')
    .eq('status', 'IN_PROGRESS')
    .order('start_date', { ascending: false })
    .limit(5)

  if (tErr || !tournaments || tournaments.length === 0) return []

  const result = await Promise.all(
    tournaments.map(async (t) => {
      // tournaments → tournament_divisions → bracket_configs 경로로 조회
      const { data: divisions } = await admin
        .from('tournament_divisions')
        .select('id')
        .eq('tournament_id', t.id)

      if (!divisions || divisions.length === 0) {
        return { id: t.id, title: t.title, bracketExists: false, recentMatches: [] }
      }

      const divisionIds = divisions.map((d) => d.id)
      const { data: config } = await admin
        .from('bracket_configs')
        .select('id')
        .in('division_id', divisionIds)
        .limit(1)
        .maybeSingle()

      if (!config) return { id: t.id, title: t.title, bracketExists: false, recentMatches: [] }

      // 최근 완료된 경기 3건 조회
      const { data: matches } = await admin
        .from('bracket_matches')
        .select('id, team1_entry_id, team2_entry_id, team1_score, team2_score, winner_entry_id')
        .eq('bracket_config_id', config.id)
        .eq('status', 'COMPLETED')
        .not('team1_entry_id', 'is', null)
        .not('team2_entry_id', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(3)

      if (!matches || matches.length === 0) {
        return { id: t.id, title: t.title, bracketExists: true, recentMatches: [] }
      }

      // entry id 목록 수집 후 player_name 일괄 조회
      const entryIds = [...new Set(
        matches.flatMap((m) => [m.team1_entry_id!, m.team2_entry_id!])
      )]

      const { data: entries } = await admin
        .from('tournament_entries')
        .select('id, player_name')
        .in('id', entryIds)

      const nameMap = new Map((entries ?? []).map((e) => [e.id, e.player_name]))

      return {
        id: t.id,
        title: t.title,
        bracketExists: true,
        recentMatches: matches.map((m) => ({
          id: m.id,
          team1: nameMap.get(m.team1_entry_id!) ?? '미정',
          team2: nameMap.get(m.team2_entry_id!) ?? '미정',
          score1: m.team1_score,
          score2: m.team2_score,
          winnerEntryId: m.winner_entry_id,
          team1EntryId: m.team1_entry_id,
          team2EntryId: m.team2_entry_id,
        })),
      }
    })
  )

  // 대진표(bracket_config)가 없는 대회만 제외
  return result.filter((t) => t.bracketExists)
}

/**
 * 모집 중(OPEN) + 진행 중(IN_PROGRESS) 대회 통합 조회
 * entry_end_date 오름차순, 최대 8개
 */
export async function getActiveTournaments(): Promise<ActiveTournament[]> {
  const admin = createAdminClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().slice(0, 10)

  // IN_PROGRESS: entry_end_date 무관하게 포함
  // OPEN: 마감일 미도래인 것만 포함
  const { data, error } = await admin
    .from('tournaments')
    .select('id, title, location, status, entry_end_date, max_participants')
    .or(`status.eq.IN_PROGRESS,and(status.eq.OPEN,or(entry_end_date.is.null,entry_end_date.gte.${todayStr}))`)
    .order('entry_end_date', { ascending: true, nullsFirst: false })
    .limit(8)

  if (error || !data) return []

  const items = await Promise.all(
    data.map(async (t) => {
      // 부서 목록 + max_teams
      const { data: divData } = await admin
        .from('tournament_divisions')
        .select('id, name, max_teams')
        .eq('tournament_id', t.id)
        .order('name', { ascending: true })

      const divCount = divData?.length ?? 0

      // 부서별 신청 팀수
      const divisions: DivisionSummary[] = await Promise.all(
        (divData ?? []).map(async (div) => {
          const { count: dc } = await admin
            .from('tournament_entries')
            .select('*', { count: 'exact', head: true })
            .eq('division_id', div.id)
            .in('status', ['PENDING', 'CONFIRMED'])
          return {
            name: div.name,
            max_teams: div.max_teams ?? null,
            entry_count: dc ?? 0,
          }
        })
      )

      // 전체 신청자 수
      const entryCount = divisions.reduce((s, d) => s + d.entry_count, 0)

      // IN_PROGRESS는 대진표 존재 여부 확인
      let hasBracket = false
      if (t.status === 'IN_PROGRESS') {
        const { data: divs } = await admin
          .from('tournament_divisions')
          .select('id')
          .eq('tournament_id', t.id)

        if (divs && divs.length > 0) {
          const { count } = await admin
            .from('bracket_configs')
            .select('id, bracket_matches!inner(id)', { count: 'exact', head: true })
            .in('division_id', divs.map((d) => d.id))
          hasBracket = (count ?? 0) > 0
        }
      }

      return {
        id: t.id,
        title: t.title,
        location: t.location,
        status: t.status as 'OPEN' | 'IN_PROGRESS',
        entry_end_date: t.entry_end_date ?? '',
        daysLeft: t.entry_end_date ? calcDaysLeft(t.entry_end_date) : 999,
        division_count: divCount,
        hasBracket,
        entry_count: entryCount,
        max_participants: t.max_participants ?? 0,
        divisions,
      }
    })
  )

  // IN_PROGRESS 먼저, 그 다음 OPEN (entry_end_date 오름차순 유지)
  return items.sort((a, b) => {
    if (a.status === b.status) return 0
    return a.status === 'IN_PROGRESS' ? -1 : 1
  })
}

/**
 * 핀 고정된 공지 포스트 (category=NOTICE, is_pinned=true)
 * 최대 3개
 */
export async function getPinnedNotices(): Promise<PinnedNotice[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('posts')
    .select('id, title, created_at')
    .eq('is_pinned', true)
    .eq('category', 'NOTICE')
    .order('created_at', { ascending: false })
    .limit(3)

  if (error || !data) return []
  return data
}
