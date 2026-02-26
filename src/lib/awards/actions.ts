'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
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

/** 이름 매칭 입상 기록 조회 — 내 레코드 ID + 팀원 포함 전체 레코드 반환 */
export async function getMyAwards(
  userId: string,
  userName: string
): Promise<{ myAwardIds: string[]; awards: Award[] }> {
  const supabase = await createClient()

  // 내 개인 레코드: userId 클레임 + 이름 매칭
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

  const seen = new Set<string>()
  const myAwards: Award[] = []
  for (const a of [...(claimedResult.data ?? []), ...(nameResult.data ?? [])]) {
    if (!seen.has(a.id)) {
      seen.add(a.id)
      myAwards.push(a)
    }
  }

  if (myAwards.length === 0) return { myAwardIds: [], awards: [] }

  // 내 레코드가 속한 (year, competition) 쌍의 전체 팀원 레코드 가져오기
  const pairs = [...new Set(myAwards.map((a) => `${a.year}||${a.competition}`))]
  const allAwards: Award[] = [...myAwards]

  for (const pair of pairs) {
    const [yearStr, ...compParts] = pair.split('||')
    const competition = compParts.join('||')
    const { data } = await supabase
      .from('tournament_awards')
      .select('*')
      .eq('year', Number(yearStr))
      .eq('competition', competition)

    for (const a of data ?? []) {
      if (!seen.has(a.id)) {
        seen.add(a.id)
        allAwards.push(a)
      }
    }
  }

  return {
    myAwardIds: myAwards.map((a) => a.id),
    awards: allAwards.sort((a, b) => b.year - a.year),
  }
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

export interface AwardPlayerInfo {
  isMember: boolean
  memberId: string | null   // club_members.id
  rating: number | null     // club_members.rating (클럽 회원 점수)
  profileRating: number | null // profiles.rating (프로필 점수)
}

/** 선수-클럽 가입 여부 + 점수 조회 (어드민 전용) */
export async function getAwardPlayersMembership(
  players: Array<{ name: string; userId: string | null }>,
  clubName: string | null
): Promise<Record<string, AwardPlayerInfo>> {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) {
    return {}
  }

  const admin = createAdminClient()
  const playerNames = players.map((p) => p.name)
  const defaultResult = (): AwardPlayerInfo => ({ isMember: false, memberId: null, rating: null, profileRating: null })

  // userId 있는 선수의 프로필 점수 조회
  const userIdMap = new Map<string, string>() // name → userId
  for (const p of players) {
    if (p.userId) userIdMap.set(p.name, p.userId)
  }
  const userIds = [...userIdMap.values()]
  const profileRatingMap = new Map<string, number | null>() // userId → rating
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, rating')
      .in('id', userIds)
    for (const prof of profiles ?? []) {
      profileRatingMap.set(prof.id, prof.rating)
    }
  }

  const buildResult = (entries: Map<string, { memberId: string | null; rating: number | null }>): Record<string, AwardPlayerInfo> => {
    return Object.fromEntries(
      players.map((p) => {
        const clubInfo = entries.get(p.name)
        const userId = userIdMap.get(p.name) ?? null
        return [p.name, {
          isMember: !!clubInfo?.memberId,
          memberId: clubInfo?.memberId ?? null,
          rating: clubInfo?.rating ?? null,
          profileRating: userId ? (profileRatingMap.get(userId) ?? null) : null,
        }]
      })
    )
  }

  if (!clubName || playerNames.length === 0) {
    const emptyMap = new Map(playerNames.map((n) => [n, { memberId: null, rating: null }]))
    return buildResult(emptyMap)
  }

  // 클럽명으로 클럽 ID 조회
  const { data: club } = await admin
    .from('clubs')
    .select('id')
    .eq('name', clubName)
    .single()

  if (!club) {
    const emptyMap = new Map(playerNames.map((n) => [n, { memberId: null, rating: null }]))
    return buildResult(emptyMap)
  }

  // 해당 클럽의 ACTIVE 회원 중 이름 매칭 + rating 포함
  const { data: members } = await admin
    .from('club_members')
    .select('id, name, rating')
    .eq('club_id', club.id)
    .eq('status', 'ACTIVE')
    .in('name', playerNames)

  const memberMap = new Map((members ?? []).map((m) => [m.name, { memberId: m.id, rating: m.rating }]))
  return buildResult(memberMap)
}

/** 선수 점수 업데이트 — club_members + profiles 동시 반영 (어드민 전용) */
export async function updateAwardPlayerRating(
  memberId: string | null,
  userId: string | null,
  rating: number | null
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) {
    return { error: '관리자 권한이 필요합니다.' }
  }

  const admin = createAdminClient()
  const updatedAt = new Date().toISOString()

  if (!memberId && !userId) return { error: '업데이트할 대상이 없습니다.' }

  // 클럽 회원 점수 업데이트
  if (memberId) {
    const { error } = await admin
      .from('club_members')
      .update({ rating, updated_at: updatedAt })
      .eq('id', memberId)
    if (error) return { error: '점수 업데이트에 실패했습니다.' }
  }

  // 프로필 점수 동시 업데이트
  if (userId) {
    const { error } = await admin
      .from('profiles')
      .update({ rating, updated_at: updatedAt })
      .eq('id', userId)
    if (error) return { error: '프로필 점수 업데이트에 실패했습니다.' }
  }

  return {}
}

export interface TournamentOption {
  id: string
  title: string
  year: number          // start_date에서 추출
  match_type: string | null
  divisions: Array<{ id: string; name: string }>
}

/** 수상자 등록용 대회 목록 조회 (COMPLETED/IN_PROGRESS, 최근순) */
export async function getTournamentsForAwards(): Promise<TournamentOption[]> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('tournaments')
    .select('id, title, start_date, match_type, status, tournament_divisions(id, name)')
    .in('status', ['COMPLETED', 'IN_PROGRESS', 'CLOSED'])
    .order('start_date', { ascending: false })

  if (error || !data) return []

  return data.map((t) => ({
    id: t.id,
    title: t.title,
    year: new Date(t.start_date).getFullYear(),
    match_type: t.match_type,
    divisions: (t.tournament_divisions ?? []) as Array<{ id: string; name: string }>,
  }))
}

/** 수상자 등록 (어드민 전용) — 선수 1명당 레코드 1개 생성 */
export async function createAwards(input: {
  year: number
  competition: string
  division: string
  game_type: '단체전' | '개인전'
  award_rank: '우승' | '준우승' | '공동3위' | '3위'
  club_name: string | null
  players: string[]
  tournament_id?: string | null
  division_id?: string | null
}): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) {
    return { error: '관리자 권한이 필요합니다.' }
  }

  if (!input.players.length) return { error: '선수를 1명 이상 입력해주세요.' }
  if (!input.competition.trim()) return { error: '대회명을 입력해주세요.' }
  if (!input.division.trim()) return { error: '부문을 입력해주세요.' }

  const admin = createAdminClient()

  const records = input.players.map((name) => ({
    year: input.year,
    competition: input.competition.trim(),
    division: input.division.trim(),
    game_type: input.game_type,
    award_rank: input.award_rank,
    club_name: input.club_name?.trim() || null,
    players: [name.trim()],
    tournament_id: input.tournament_id ?? null,
    division_id: input.division_id ?? null,
  }))

  const { error } = await admin.from('tournament_awards').insert(records)
  if (error) return { error: '등록에 실패했습니다.' }
  return {}
}

/** 입상 기록 수정 (어드민 전용) */
export async function updateAward(
  awardId: string,
  data: {
    competition?: string
    division?: string
    award_rank?: string
    game_type?: string
    club_name?: string | null
    players?: string[]
  }
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role ?? '')) {
    return { error: '관리자 권한이 필요합니다.' }
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('tournament_awards')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', awardId)

  if (error) return { error: '수정에 실패했습니다.' }
  return {}
}
