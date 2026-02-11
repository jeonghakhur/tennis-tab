'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth/actions'

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
      tournament:tournaments(*)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { entries }
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

  // 본인의 확정된 entry IDs 조회
  const { data: entries, error: entryError } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'CONFIRMED')

  if (entryError) {
    return { error: entryError.message }
  }

  const entryIds = entries?.map(e => e.id) || []
  if (entryIds.length === 0) {
    return { matches: [] }
  }

  // bracket_matches에서 완료된 경기 조회
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
      completed_at,
      court_number,
      bracket_config:bracket_configs!bracket_matches_bracket_config_id_fkey(
        division:tournament_divisions(
          name,
          tournament:tournaments(id, title, location)
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
    .eq('status', 'COMPLETED')
    .order('completed_at', { ascending: false })

  if (matchError) {
    return { error: matchError.message }
  }

  // 플랫하게 가공 — Supabase nested join은 1:1이면 object, 1:N이면 array로 반환
  const matches = (bracketMatches || []).map(m => {
    const config = m.bracket_config as unknown as { division: { name: string; tournament: { id: string; title: string; location: string } } } | null
    const division = config?.division ?? null
    const tournament = division?.tournament ?? null

    const t1 = m.team1_entry as unknown as { id: string; player_name: string; partner_data: { name: string; club?: string } | null } | null
    const t2 = m.team2_entry as unknown as { id: string; player_name: string; partner_data: { name: string; club?: string } | null } | null

    return {
      id: m.id,
      phase: m.phase,
      roundNumber: m.round_number,
      matchNumber: m.match_number,
      team1Score: m.team1_score,
      team2Score: m.team2_score,
      winnerEntryId: m.winner_entry_id,
      completedAt: m.completed_at,
      courtNumber: m.court_number,
      tournamentId: tournament?.id || null,
      tournamentTitle: tournament?.title || '',
      tournamentLocation: tournament?.location || '',
      divisionName: division?.name || '',
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
    }
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

    // bracket_matches에서 승리 경기 수
    const winFilter = entryIds.map(id => `winner_entry_id.eq.${id}`).join(',')
    const { count: bracketWins } = await supabase
      .from('bracket_matches')
      .select('*', { count: 'exact', head: true })
      .or(winFilter)

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
