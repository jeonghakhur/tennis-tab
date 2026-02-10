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
 * 사용자의 경기 결과 조회
 */
export async function getMyMatches() {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 본인이 참가한 경기 (player1 또는 player2)
  const { data: matches, error } = await supabase
    .from('matches')
    .select(`
      *,
      tournament:tournaments(title, location),
      player1:profiles!matches_player1_id_fkey(id, name, avatar_url),
      player2:profiles!matches_player2_id_fkey(id, name, avatar_url),
      winner:profiles!matches_winner_id_fkey(id, name)
    `)
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

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
