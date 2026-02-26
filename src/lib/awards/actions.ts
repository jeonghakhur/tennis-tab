'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/types'

type Award = Database['public']['Tables']['tournament_awards']['Row']

interface GetAwardsOptions {
  year?: number
  competition?: string
  rank?: string
  playerName?: string
  clubId?: string
  clubName?: string
  userId?: string
}

/** 입상 목록 조회 */
export async function getAwards(opts: GetAwardsOptions = {}): Promise<Award[]> {
  const supabase = await createClient()

  let query = supabase
    .from('tournament_awards')
    .select('*')
    .order('year', { ascending: false })
    .order('display_order', { ascending: true })

  if (opts.year) query = query.eq('year', opts.year)
  if (opts.competition) query = query.eq('competition', opts.competition)
  if (opts.rank) query = query.eq('award_rank', opts.rank)
  if (opts.playerName) query = query.contains('players', [opts.playerName])
  if (opts.clubId) query = query.eq('club_id', opts.clubId)
  if (opts.clubName) query = query.eq('club_name', opts.clubName)
  if (opts.userId) query = query.contains('player_user_ids', [opts.userId])

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data ?? []
}

/** 필터 옵션 조회 (연도 목록, 대회명 목록) */
export async function getAwardsFilterOptions(): Promise<{
  years: number[]
  competitions: string[]
}> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tournament_awards')
    .select('year, competition')
    .order('year', { ascending: false })

  if (error) throw new Error(error.message)

  const yearsSet = new Set<number>()
  // competitions: 처음 등장하는 순서 = 최근 연도순 (year DESC로 쿼리했으므로)
  const competitionsOrdered: string[] = []
  const competitionsSeen = new Set<string>()

  for (const row of data ?? []) {
    yearsSet.add(row.year)
    if (!competitionsSeen.has(row.competition)) {
      competitionsSeen.add(row.competition)
      competitionsOrdered.push(row.competition)
    }
  }

  return {
    years: Array.from(yearsSet),
    competitions: competitionsOrdered,
  }
}

/** 이름 매칭 입상 기록 조회 (프로필용: 이름 일치 + userId 클레임 포함) */
export async function getMyAwards(userId: string, userName: string): Promise<Award[]> {
  const supabase = await createClient()

  // userId로 클레임된 기록 + 이름 매칭 기록 병합
  const [claimedResult, nameResult] = await Promise.all([
    supabase
      .from('tournament_awards')
      .select('*')
      .contains('player_user_ids', [userId])
      .order('year', { ascending: false }),
    supabase
      .from('tournament_awards')
      .select('*')
      .contains('players', [userName])
      .order('year', { ascending: false }),
  ])

  const claimed = claimedResult.data ?? []
  const byName = nameResult.data ?? []

  // 중복 제거 (id 기준)
  const seen = new Set<string>()
  const merged: Award[] = []
  for (const a of [...claimed, ...byName]) {
    if (!seen.has(a.id)) {
      seen.add(a.id)
      merged.push(a)
    }
  }

  return merged.sort((a, b) => b.year - a.year)
}

/** 입상 기록 클레임 (내 기록으로 등록) */
export async function claimAward(
  awardId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // 현재 로그인 유저 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  // 현재 player_user_ids 조회
  const { data: award, error: fetchError } = await supabase
    .from('tournament_awards')
    .select('player_user_ids')
    .eq('id', awardId)
    .single()

  if (fetchError || !award) return { error: '기록을 찾을 수 없습니다.' }

  const current = award.player_user_ids ?? []
  if (current.includes(user.id)) return {} // 이미 클레임됨

  // admin client로 player_user_ids 업데이트 (RLS 우회 불필요하지만 일관성)
  const admin = createAdminClient()
  const { error } = await admin
    .from('tournament_awards')
    .update({ player_user_ids: [...current, user.id] })
    .eq('id', awardId)

  if (error) return { error: error.message }
  return {}
}

/** 클럽 입상 기록 조회 */
export async function getClubAwards(clubId: string, clubName?: string): Promise<Award[]> {
  const supabase = await createClient()

  const queries = [
    supabase
      .from('tournament_awards')
      .select('*')
      .eq('club_id', clubId)
      .order('year', { ascending: false }),
  ]

  if (clubName) {
    queries.push(
      supabase
        .from('tournament_awards')
        .select('*')
        .eq('club_name', clubName)
        .order('year', { ascending: false })
    )
  }

  const results = await Promise.all(queries)
  const seen = new Set<string>()
  const merged: Award[] = []
  for (const result of results) {
    for (const a of result.data ?? []) {
      if (!seen.has(a.id)) {
        seen.add(a.id)
        merged.push(a)
      }
    }
  }

  return merged.sort((a, b) => b.year - a.year)
}
