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
 * 사용자 통계 조회
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
    .eq('status', 'APPROVED')

  // 총 경기 수
  const { count: totalMatches } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
    .not('completed_at', 'is', null)

  // 승리 경기 수
  const { count: wins } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('winner_id', user.id)

  return {
    stats: {
      tournaments: tournamentCount || 0,
      totalMatches: totalMatches || 0,
      wins: wins || 0,
      losses: (totalMatches || 0) - (wins || 0),
      winRate: totalMatches ? Math.round(((wins || 0) / totalMatches) * 100) : 0,
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

  // 해당 사용자의 통계
  const { count: tournamentCount } = await supabase
    .from('tournament_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'APPROVED')

  const { count: totalMatches } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .not('completed_at', 'is', null)

  const { count: wins } = await supabase
    .from('matches')
    .select('*', { count: 'exact', head: true })
    .eq('winner_id', userId)

  return {
    profile,
    stats: {
      tournaments: tournamentCount || 0,
      totalMatches: totalMatches || 0,
      wins: wins || 0,
      losses: (totalMatches || 0) - (wins || 0),
      winRate: totalMatches ? Math.round(((wins || 0) / totalMatches) * 100) : 0,
    },
  }
}
