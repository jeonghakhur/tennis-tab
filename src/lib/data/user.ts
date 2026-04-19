'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/actions'
import type { EntryStatus, PaymentStatus, PartnerData, TeamMember, TournamentStatus } from '@/lib/supabase/types'

/** 사용자의 엔트리 정보 (대회/부서 정보 포함) */
export interface MyEntry {
  id: string
  tournamentId: string
  tournamentTitle: string
  tournamentStartDate: string
  tournamentEndDate: string
  tournamentStatus: string
  tournamentLocation: string
  divisionName: string
  status: EntryStatus
  paymentStatus: PaymentStatus
  playerName: string
  phone: string
  playerRating: number | null
  clubName: string | null
  teamOrder: string | null
  partnerData: PartnerData | null
  teamMembers: TeamMember[] | null
  createdAt: string
}

/**
 * 사용자의 참가 대회 목록 조회
 */
export async function getMyTournaments() {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: entries, error } = await supabase
    .from('tournament_entries')
    .select(`
      *,
      tournament:tournaments(*),
      division:tournament_divisions(id, name)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  // 공개된 대진표가 있는 division_id 집합 조회
  // publish_groups/publish_preliminary/publish_main 중 하나라도 true인 config
  const divisionIds = entries
    .map((e) => (e.division as { id: string } | null)?.id)
    .filter((id): id is string => Boolean(id))

  const bracketDivisionSet = new Set<string>()
  if (divisionIds.length > 0) {
    const { data: bracketRows } = await supabase
      .from('bracket_configs')
      .select('division_id')
      .in('division_id', divisionIds)
      .or('publish_groups.eq.true,publish_preliminary.eq.true,publish_main.eq.true')
    bracketRows?.forEach((r) => bracketDivisionSet.add(r.division_id))
  }

  // 취소되지 않은 엔트리의 대기 순번 계산 (같은 division 내 created_at 순)
  const activeEntries = entries.filter((e) => e.status !== 'CANCELLED');
  const rankMap: Record<string, number> = {};
  if (activeEntries.length > 0) {
    const rankResults = await Promise.all(
      activeEntries.map(async (e) => {
        const divId = (e.division as { id: string } | null)?.id;
        if (!divId) return { id: e.id, rank: 1 };
        const { count } = await supabase
          .from('tournament_entries')
          .select('*', { count: 'exact', head: true })
          .eq('division_id', divId)
          .neq('status', 'CANCELLED')
          .lte('created_at', e.created_at);
        return { id: e.id, rank: count ?? 1 };
      })
    );
    rankResults.forEach((r) => { rankMap[r.id] = r.rank; });
  }

  const enrichedEntries = entries.map((e) => ({
    ...e,
    hasBracket: (e.division as { id: string } | null)?.id
      ? bracketDivisionSet.has((e.division as { id: string }).id)
      : false,
    current_rank: rankMap[e.id] ?? null,
  }))

  return { entries: enrichedEntries }
}

// Supabase join 결과 타입 (1:1 관계는 object로 반환)
interface EntryJoinResult {
  id: string
  tournament_id: string
  status: EntryStatus
  payment_status: PaymentStatus
  player_name: string
  phone: string
  player_rating: number | null
  club_name: string | null
  team_order: string | null
  partner_data: PartnerData | null
  team_members: TeamMember[] | null
  created_at: string
  tournament: {
    id: string
    title: string
    start_date: string
    end_date: string
    status: TournamentStatus
    location: string
  }
  division: {
    name: string
  }
}

/**
 * 사용자의 엔트리(참가 신청) 목록 조회
 * - RLS 적용 (본인 데이터만)
 * - CANCELLED 포함 (클라이언트에서 필터링)
 * - 에러 시 빈 배열 반환
 */
export async function getMyEntries(statusFilter?: EntryStatus): Promise<MyEntry[]> {
  try {
    const supabase = await createClient()
    const user = await getCurrentUser()

    if (!user) {
      return []
    }

    let query = supabase
      .from('tournament_entries')
      .select(`
        id,
        tournament_id,
        status,
        payment_status,
        player_name,
        phone,
        player_rating,
        club_name,
        team_order,
        partner_data,
        team_members,
        created_at,
        tournament:tournaments!inner(id, title, start_date, end_date, status, location),
        division:tournament_divisions!inner(name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data, error } = await query

    if (error) {
      return []
    }

    // Supabase join 결과를 플랫한 MyEntry로 변환
    return (data as unknown as EntryJoinResult[]).map((entry) => ({
      id: entry.id,
      tournamentId: entry.tournament_id,
      tournamentTitle: entry.tournament.title,
      tournamentStartDate: entry.tournament.start_date,
      tournamentEndDate: entry.tournament.end_date,
      tournamentStatus: entry.tournament.status,
      tournamentLocation: entry.tournament.location,
      divisionName: entry.division.name,
      status: entry.status,
      paymentStatus: entry.payment_status,
      playerName: entry.player_name,
      phone: entry.phone,
      playerRating: entry.player_rating,
      clubName: entry.club_name,
      teamOrder: entry.team_order,
      partnerData: entry.partner_data,
      teamMembers: entry.team_members,
      createdAt: entry.created_at,
    }))
  } catch {
    return []
  }
}

/**
 * 사용자의 경기 결과 조회 (bracket_matches 기반)
 */
export async function getMyMatches() {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 본인이 신청했거나 파트너로 등록된 확정 entry IDs 조회
  const { data: entries, error: entryError } = await supabase
    .from('tournament_entries')
    .select('id')
    .or(`user_id.eq.${user.id},partner_user_id.eq.${user.id}`)
    .eq('status', 'CONFIRMED')

  if (entryError) {
    return { error: entryError.message }
  }

  const entryIds = entries?.map(e => e.id) || []
  if (entryIds.length === 0) {
    return { matches: [] }
  }

  // bracket_matches에서 예정/완료 경기 조회
  const matchFilter = entryIds.map(id => `team1_entry_id.eq.${id},team2_entry_id.eq.${id}`).join(',')
  const { data: bracketMatches, error: matchError } = await supabase
    .from('bracket_matches')
    .select(`
      id,
      phase,
      round_number,
      match_number,
      team1_entry_id,
      team2_entry_id,
      team1_score,
      team2_score,
      winner_entry_id,
      status,
      sets_detail,
      completed_at,
      court_number,
      bracket_config:bracket_configs!bracket_matches_bracket_config_id_fkey(
        id,
        active_phase,
        active_round,
        division:tournament_divisions(
          name,
          tournament:tournaments(id, title, location, match_type, team_match_count)
        )
      ),
      team1_entry:tournament_entries!bracket_matches_team1_entry_id_fkey(
        id, player_name, partner_data
      ),
      team2_entry:tournament_entries!bracket_matches_team2_entry_id_fkey(
        id, player_name, partner_data
      )
    `)
    .or(matchFilter)
    .in('status', ['SCHEDULED', 'COMPLETED'])
    .order('completed_at', { ascending: false, nullsFirst: false })

  if (matchError) {
    return { error: matchError.message }
  }

  // 플랫하게 가공 — Supabase nested join은 1:1이면 object, 1:N이면 array로 반환
  const matches = (bracketMatches || []).flatMap(m => {
    // SCHEDULED 경기는 양쪽 모두 배정된 경우만 표시
    if (m.status === 'SCHEDULED' && (!m.team1_entry_id || !m.team2_entry_id)) return []

    const config = m.bracket_config as unknown as {
      id: string
      active_phase: string | null
      active_round: number | null
      division: { name: string; tournament: { id: string; title: string; location: string; match_type: string | null; team_match_count: number | null } }
    } | null
    const division = config?.division ?? null
    const tournament = division?.tournament ?? null
    // 이 경기가 현재 점수 입력 활성화 라운드에 해당하는지 판단
    // - 예선: active_phase='PRELIMINARY' → phase가 'PRELIMINARY'인 경기 전체
    // - 본선: active_phase='MAIN' → match.phase는 ROUND_16·SEMI·FINAL 등이므로
    //         phase 비교가 아닌 round_number로만 판단
    const isInProgress = (() => {
      if (!config?.active_phase) return false
      if (config.active_phase === 'PRELIMINARY') {
        return m.phase === 'PRELIMINARY'
      }
      if (config.active_phase === 'MAIN') {
        const isMainPhase = m.phase !== 'PRELIMINARY'
        return isMainPhase && (config.active_round === null || m.round_number === config.active_round)
      }
      return false
    })()

    const t1 = m.team1_entry as unknown as { id: string; player_name: string; partner_data: { name: string; club?: string } | null } | null
    const t2 = m.team2_entry as unknown as { id: string; player_name: string; partner_data: { name: string; club?: string } | null } | null

    return [{
      id: m.id,
      phase: m.phase,
      roundNumber: m.round_number,
      matchNumber: m.match_number,
      status: m.status,
      setsDetail: m.sets_detail,
      team1Score: m.team1_score,
      team2Score: m.team2_score,
      winnerEntryId: m.winner_entry_id,
      completedAt: m.completed_at,
      courtNumber: m.court_number,
      configId: config?.id || '',
      tournamentId: tournament?.id || null,
      tournamentTitle: tournament?.title || '',
      tournamentLocation: tournament?.location || '',
      isInProgress,
      divisionName: division?.name || '',
      matchType: tournament?.match_type || null,
      teamMatchCount: tournament?.team_match_count || null,
      myEntryId: entryIds.find(id => id === m.team1_entry_id || id === m.team2_entry_id) || '',
      team1: {
        entryId: m.team1_entry_id,
        name: t1?.player_name || 'TBD',
        partnerData: t1?.partner_data || null,
      },
      team2: {
        entryId: m.team2_entry_id,
        name: t2?.player_name || 'TBD',
        partnerData: t2?.partner_data || null,
      },
    }]
  })

  // 예정 경기 먼저, 완료된 경기는 최신순
  matches.sort((a, b) => {
    if (a.status === 'SCHEDULED' && b.status !== 'SCHEDULED') return -1
    if (a.status !== 'SCHEDULED' && b.status === 'SCHEDULED') return 1
    return 0
  })

  return { matches }
}

/**
 * 사용자 통계 조회 (bracket_matches 기반)
 */
export async function getUserStats() {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 참가 대회 수
  const { count: tournamentCount } = await supabase
    .from('tournament_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'CONFIRMED')

  // 본인 entry_ids 조회 (bracket_matches 기반 통계용)
  const { data: entries } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'CONFIRMED')

  const entryIds = entries?.map(e => e.id) || []

  let totalMatches = 0
  let wins = 0

  if (entryIds.length > 0) {
    // bracket_matches에서 완료된 경기 수
    const matchFilter = entryIds.map(id => `team1_entry_id.eq.${id},team2_entry_id.eq.${id}`).join(',')
    const { count: bracketTotal } = await supabase
      .from('bracket_matches')
      .select('*', { count: 'exact', head: true })
      .or(matchFilter)
      .eq('status', 'COMPLETED')

    totalMatches = bracketTotal || 0

    // bracket_matches에서 승리 경기 수 (COMPLETED만 — BYE 제외)
    const winFilter = entryIds.map(id => `winner_entry_id.eq.${id}`).join(',')
    const { count: bracketWins } = await supabase
      .from('bracket_matches')
      .select('*', { count: 'exact', head: true })
      .or(winFilter)
      .eq('status', 'COMPLETED')

    wins = bracketWins || 0
  }

  return {
    stats: {
      tournaments: tournamentCount || 0,
      totalMatches,
      wins,
      losses: totalMatches - wins,
      winRate: totalMatches ? Math.round((wins / totalMatches) * 100) : 0,
    },
  }
}

/**
 * 다른 사람이 나를 파트너로 등록한 대회 목록 조회
 */
export async function getMyInvitedEntries() {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: entries, error } = await supabase
    .from('tournament_entries')
    .select(`
      *,
      tournament:tournaments(*),
      division:tournament_divisions(id, name)
    `)
    .eq('partner_user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  // 대진표 존재 여부 확인
  const divisionIds = entries
    .map((e) => (e.division as { id: string } | null)?.id)
    .filter((id): id is string => Boolean(id))

  const bracketDivisionSet = new Set<string>()
  if (divisionIds.length > 0) {
    const { data: bracketRows } = await supabase
      .from('bracket_configs')
      .select('division_id, bracket_matches!inner(id)')
      .in('division_id', divisionIds)
    bracketRows?.forEach((r) => bracketDivisionSet.add(r.division_id))
  }

  const enrichedEntries = entries.map((e) => ({
    ...e,
    hasBracket: (e.division as { id: string } | null)?.id
      ? bracketDivisionSet.has((e.division as { id: string }).id)
      : false,
    current_rank: null,
  }))

  return { entries: enrichedEntries }
}

/**
 * 다른 사용자의 프로필 조회
 */
export async function getUserProfile(userId: string) {
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    return { error: error.message }
  }

  // 해당 사용자의 통계 (bracket_matches 기반)
  const { count: tournamentCount } = await supabase
    .from('tournament_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'CONFIRMED')

  const { data: userEntries } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'CONFIRMED')

  const userEntryIds = userEntries?.map(e => e.id) || []

  let totalMatches = 0
  let wins = 0

  if (userEntryIds.length > 0) {
    const matchFilter = userEntryIds.map(id => `team1_entry_id.eq.${id},team2_entry_id.eq.${id}`).join(',')
    const { count: bracketTotal } = await supabase
      .from('bracket_matches')
      .select('*', { count: 'exact', head: true })
      .or(matchFilter)
      .eq('status', 'COMPLETED')

    totalMatches = bracketTotal || 0

    const winFilter = userEntryIds.map(id => `winner_entry_id.eq.${id}`).join(',')
    const { count: bracketWins } = await supabase
      .from('bracket_matches')
      .select('*', { count: 'exact', head: true })
      .or(winFilter)
      .eq('status', 'COMPLETED')

    wins = bracketWins || 0
  }

  return {
    profile,
    stats: {
      tournaments: tournamentCount || 0,
      totalMatches,
      wins,
      losses: totalMatches - wins,
      winRate: totalMatches ? Math.round((wins / totalMatches) * 100) : 0,
    },
  }
}
