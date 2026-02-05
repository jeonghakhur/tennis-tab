'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { BracketStatus, MatchPhase, MatchStatus } from '@/lib/supabase/types'

// ============================================================================
// 타입 정의
// ============================================================================

export interface BracketConfig {
  id: string
  division_id: string
  has_preliminaries: boolean
  third_place_match: boolean
  bracket_size: number | null
  status: BracketStatus
}

export interface PreliminaryGroup {
  id: string
  bracket_config_id: string
  name: string
  display_order: number
  teams?: GroupTeam[]
}

export interface GroupTeam {
  id: string
  group_id: string
  entry_id: string
  seed_number: number | null
  final_rank: number | null
  wins: number
  losses: number
  points_for: number
  points_against: number
  entry?: {
    id: string
    player_name: string
    club_name: string | null
  }
}

export interface BracketMatch {
  id: string
  bracket_config_id: string
  phase: MatchPhase
  group_id: string | null
  bracket_position: number | null
  round_number: number | null
  match_number: number
  team1_entry_id: string | null
  team2_entry_id: string | null
  team1_score: number | null
  team2_score: number | null
  winner_entry_id: string | null
  next_match_id: string | null
  next_match_slot: number | null
  loser_next_match_id: string | null
  loser_next_match_slot: number | null
  status: MatchStatus
  scheduled_time: string | null
  completed_at: string | null
  notes: string | null
  team1?: {
    id: string
    player_name: string
    club_name: string | null
  }
  team2?: {
    id: string
    player_name: string
    club_name: string | null
  }
}

// ============================================================================
// 대진표 설정 관련
// ============================================================================

/**
 * 대진표 설정 조회 또는 생성
 */
export async function getOrCreateBracketConfig(divisionId: string) {
  const supabase = await createClient()

  // 기존 설정 확인
  const { data: existing } = await supabase
    .from('bracket_configs')
    .select('*')
    .eq('division_id', divisionId)
    .single()

  if (existing) {
    return { data: existing, error: null }
  }

  // 새로 생성
  const { data, error } = await supabase
    .from('bracket_configs')
    .insert({ division_id: divisionId })
    .select()
    .single()

  return { data, error }
}

/**
 * 대진표 설정 업데이트
 */
export async function updateBracketConfig(
  configId: string,
  updates: {
    has_preliminaries?: boolean
    third_place_match?: boolean
    bracket_size?: number | null
    status?: BracketStatus
  }
) {
  const supabaseAdmin = createAdminClient()

  const { data, error } = await supabaseAdmin
    .from('bracket_configs')
    .update(updates)
    .eq('id', configId)
    .select()
    .single()

  if (!error) {
    revalidatePath('/admin/tournaments')
  }

  return { data, error }
}

// ============================================================================
// 예선 조 편성 관련
// ============================================================================

/**
 * 조 이름 생성 (A, B, C, ..., Z, AA, AB, ...)
 */
function getGroupName(index: number): string {
  if (index < 26) {
    return String.fromCharCode(65 + index) // A-Z
  }
  const first = Math.floor(index / 26) - 1
  const second = index % 26
  return String.fromCharCode(65 + first) + String.fromCharCode(65 + second) // AA, AB, ...
}

/**
 * 자동 조 편성
 * - 승인된 팀들을 2~3팀씩 조로 나눔
 * - 2팀 조는 모두 본선 진출, 3팀 조는 상위 2팀 본선 진출
 */
export async function autoGenerateGroups(configId: string, divisionId: string) {
  const supabaseAdmin = createAdminClient()

  // 승인된 참가팀 조회 (CONFIRMED 상태만)
  const { data: entries, error: entriesError } = await supabaseAdmin
    .from('tournament_entries')
    .select('id, player_name, club_name')
    .eq('division_id', divisionId)
    .eq('status', 'CONFIRMED')
    .order('created_at', { ascending: true })

  if (entriesError || !entries) {
    return { error: '참가팀 조회에 실패했습니다.' }
  }

  if (entries.length < 2) {
    return { error: '최소 2팀 이상이 필요합니다.' }
  }

  // 기존 조 삭제
  await supabaseAdmin
    .from('preliminary_groups')
    .delete()
    .eq('bracket_config_id', configId)

  // 조 개수 계산 (2~3팀씩)
  const teamCount = entries.length
  let groupCount: number
  let teamsPerGroup: number[]

  if (teamCount <= 3) {
    // 3팀 이하: 1개 조
    groupCount = 1
    teamsPerGroup = [teamCount]
  } else {
    // 3팀 조를 최대한 만들고, 나머지는 2팀 조
    // 예: 10팀 = 3+3+2+2 = 4개 조
    // 예: 11팀 = 3+3+3+2 = 4개 조
    // 예: 12팀 = 3+3+3+3 = 4개 조
    const threeTeamGroups = Math.floor(teamCount / 3)
    const remainder = teamCount % 3

    if (remainder === 0) {
      groupCount = threeTeamGroups
      teamsPerGroup = Array(groupCount).fill(3)
    } else if (remainder === 1) {
      // 1명 남으면 3팀 조 2개를 2팀 조 2개로 변경
      groupCount = threeTeamGroups - 1 + 2
      teamsPerGroup = [...Array(threeTeamGroups - 1).fill(3), 2, 2]
    } else {
      // 2명 남으면 2팀 조 1개 추가
      groupCount = threeTeamGroups + 1
      teamsPerGroup = [...Array(threeTeamGroups).fill(3), 2]
    }
  }

  // 팀 섞기 (랜덤 배정)
  const shuffledEntries = [...entries].sort(() => Math.random() - 0.5)

  // 조 생성
  let entryIndex = 0
  const groups: { id: string; name: string; teams: typeof entries }[] = []

  for (let i = 0; i < groupCount; i++) {
    const { data: group, error: groupError } = await supabaseAdmin
      .from('preliminary_groups')
      .insert({
        bracket_config_id: configId,
        name: getGroupName(i),
        display_order: i + 1,
      })
      .select()
      .single()

    if (groupError || !group) {
      return { error: '조 생성에 실패했습니다.' }
    }

    // 팀 배정
    const groupTeams = shuffledEntries.slice(entryIndex, entryIndex + teamsPerGroup[i])
    entryIndex += teamsPerGroup[i]

    for (let j = 0; j < groupTeams.length; j++) {
      await supabaseAdmin.from('group_teams').insert({
        group_id: group.id,
        entry_id: groupTeams[j].id,
        seed_number: j + 1,
      })
    }

    groups.push({ id: group.id, name: group.name, teams: groupTeams })
  }

  // 대진표 상태 업데이트
  await supabaseAdmin
    .from('bracket_configs')
    .update({ status: 'PRELIMINARY' })
    .eq('id', configId)

  revalidatePath('/admin/tournaments')
  return { data: groups, error: null }
}

/**
 * 예선 조 목록 조회
 */
export async function getPreliminaryGroups(configId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('preliminary_groups')
    .select(`
      *,
      group_teams (
        *,
        entry:tournament_entries (id, player_name, club_name)
      )
    `)
    .eq('bracket_config_id', configId)
    .order('display_order', { ascending: true })

  return { data, error }
}

/**
 * 팀 조 이동
 */
export async function moveTeamToGroup(teamId: string, newGroupId: string) {
  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin
    .from('group_teams')
    .update({ group_id: newGroupId })
    .eq('id', teamId)

  if (!error) {
    revalidatePath('/admin/tournaments')
  }

  return { error }
}

// ============================================================================
// 예선 경기 관련
// ============================================================================

/**
 * 예선 경기 생성 (풀리그)
 * 3팀: A vs B, A vs C, B vs C (3경기)
 * 2팀: A vs B (1경기)
 */
export async function generatePreliminaryMatches(configId: string) {
  const supabaseAdmin = createAdminClient()

  // 조 목록 조회
  const { data: groups, error: groupsError } = await supabaseAdmin
    .from('preliminary_groups')
    .select(`
      *,
      group_teams (entry_id)
    `)
    .eq('bracket_config_id', configId)
    .order('display_order', { ascending: true })

  if (groupsError || !groups) {
    return { error: '조 목록 조회에 실패했습니다.' }
  }

  // 기존 예선 경기 삭제
  await supabaseAdmin
    .from('bracket_matches')
    .delete()
    .eq('bracket_config_id', configId)
    .eq('phase', 'PRELIMINARY')

  let matchNumber = 1

  for (const group of groups) {
    const teams = group.group_teams?.map((t: { entry_id: string }) => t.entry_id) || []

    // 풀리그 경기 생성
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        await supabaseAdmin.from('bracket_matches').insert({
          bracket_config_id: configId,
          phase: 'PRELIMINARY',
          group_id: group.id,
          match_number: matchNumber++,
          team1_entry_id: teams[i],
          team2_entry_id: teams[j],
          status: 'SCHEDULED',
        })
      }
    }
  }

  revalidatePath('/admin/tournaments')
  return { data: { matchCount: matchNumber - 1 }, error: null }
}

/**
 * 예선 경기 목록 조회
 */
export async function getPreliminaryMatches(configId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bracket_matches')
    .select(`
      *,
      team1:tournament_entries!bracket_matches_team1_entry_id_fkey (id, player_name, club_name),
      team2:tournament_entries!bracket_matches_team2_entry_id_fkey (id, player_name, club_name)
    `)
    .eq('bracket_config_id', configId)
    .eq('phase', 'PRELIMINARY')
    .order('match_number', { ascending: true })

  return { data, error }
}

/**
 * 경기 결과 입력
 */
export async function updateMatchResult(
  matchId: string,
  team1Score: number,
  team2Score: number
) {
  const supabaseAdmin = createAdminClient()

  // 경기 정보 조회
  const { data: match, error: matchError } = await supabaseAdmin
    .from('bracket_matches')
    .select('*, bracket_config_id, phase, group_id, team1_entry_id, team2_entry_id, next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { error: '경기 정보 조회에 실패했습니다.' }
  }

  const winnerId = team1Score > team2Score ? match.team1_entry_id : match.team2_entry_id
  const loserId = team1Score > team2Score ? match.team2_entry_id : match.team1_entry_id

  // 경기 결과 업데이트
  const { error: updateError } = await supabaseAdmin
    .from('bracket_matches')
    .update({
      team1_score: team1Score,
      team2_score: team2Score,
      winner_entry_id: winnerId,
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    })
    .eq('id', matchId)

  if (updateError) {
    return { error: '경기 결과 업데이트에 실패했습니다.' }
  }

  // 예선 경기인 경우 조별 순위 업데이트
  if (match.phase === 'PRELIMINARY' && match.group_id) {
    await updateGroupStandings(match.group_id)
  }

  // 본선 경기인 경우 다음 경기에 승자 배정
  if (match.next_match_id && match.next_match_slot && winnerId) {
    const updateField = match.next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
    await supabaseAdmin
      .from('bracket_matches')
      .update({ [updateField]: winnerId })
      .eq('id', match.next_match_id)
  }

  // 3/4위전에 패자 배정
  if (match.loser_next_match_id && match.loser_next_match_slot && loserId) {
    const updateField = match.loser_next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
    await supabaseAdmin
      .from('bracket_matches')
      .update({ [updateField]: loserId })
      .eq('id', match.loser_next_match_id)
  }

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return { data: { winnerId }, error: null }
}

/**
 * 조별 순위 업데이트
 */
async function updateGroupStandings(groupId: string) {
  const supabaseAdmin = createAdminClient()

  // 조 내 모든 경기 조회
  const { data: matches } = await supabaseAdmin
    .from('bracket_matches')
    .select('*')
    .eq('group_id', groupId)
    .eq('status', 'COMPLETED')

  // 조 내 팀 조회
  const { data: teams } = await supabaseAdmin
    .from('group_teams')
    .select('entry_id')
    .eq('group_id', groupId)

  if (!teams || !matches) return

  // 팀별 성적 계산
  const standings: Record<string, { wins: number; losses: number; pf: number; pa: number }> = {}

  for (const team of teams) {
    standings[team.entry_id] = { wins: 0, losses: 0, pf: 0, pa: 0 }
  }

  for (const match of matches) {
    if (match.team1_entry_id && match.team2_entry_id && match.team1_score !== null && match.team2_score !== null) {
      standings[match.team1_entry_id].pf += match.team1_score
      standings[match.team1_entry_id].pa += match.team2_score
      standings[match.team2_entry_id].pf += match.team2_score
      standings[match.team2_entry_id].pa += match.team1_score

      if (match.winner_entry_id === match.team1_entry_id) {
        standings[match.team1_entry_id].wins++
        standings[match.team2_entry_id].losses++
      } else {
        standings[match.team2_entry_id].wins++
        standings[match.team1_entry_id].losses++
      }
    }
  }

  // 순위 계산 (승수 > 득실차 > 다득점)
  const ranked = Object.entries(standings)
    .map(([entryId, stats]) => ({ entryId, ...stats, diff: stats.pf - stats.pa }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins
      if (b.diff !== a.diff) return b.diff - a.diff
      return b.pf - a.pf
    })

  // DB 업데이트
  for (let i = 0; i < ranked.length; i++) {
    const team = ranked[i]
    await supabaseAdmin
      .from('group_teams')
      .update({
        wins: team.wins,
        losses: team.losses,
        points_for: team.pf,
        points_against: team.pa,
        final_rank: i + 1,
      })
      .eq('group_id', groupId)
      .eq('entry_id', team.entryId)
  }
}

// ============================================================================
// 본선 대진표 관련
// ============================================================================

/**
 * 본선 대진표 크기 계산
 */
function calculateBracketSize(teamCount: number): number {
  if (teamCount <= 4) return 4
  if (teamCount <= 8) return 8
  if (teamCount <= 16) return 16
  if (teamCount <= 32) return 32
  if (teamCount <= 64) return 64
  return 128
}

/**
 * 라운드 이름 매핑
 */
function getPhaseForRound(bracketSize: number, roundNumber: number): MatchPhase {
  const totalRounds = Math.log2(bracketSize)
  const roundsFromFinal = totalRounds - roundNumber + 1

  switch (roundsFromFinal) {
    case 1: return 'FINAL'
    case 2: return 'SEMI'
    case 3: return 'QUARTER'
    case 4: return 'ROUND_16'
    case 5: return 'ROUND_32'
    case 6: return 'ROUND_64'
    case 7: return 'ROUND_128'
    default: return 'ROUND_128'
  }
}

/**
 * 본선 대진표 생성
 */
export async function generateMainBracket(configId: string, divisionId: string) {
  const supabaseAdmin = createAdminClient()

  // 대진표 설정 조회
  const { data: config } = await supabaseAdmin
    .from('bracket_configs')
    .select('*')
    .eq('id', configId)
    .single()

  if (!config) {
    return { error: '대진표 설정을 찾을 수 없습니다.' }
  }

  let advancingTeams: { entryId: string; seed: number }[] = []

  if (config.has_preliminaries) {
    // 예선 결과에서 진출팀 추출
    const { data: groups } = await supabaseAdmin
      .from('preliminary_groups')
      .select(`
        *,
        group_teams (entry_id, final_rank)
      `)
      .eq('bracket_config_id', configId)
      .order('display_order', { ascending: true })

    if (!groups) {
      return { error: '예선 조 정보를 찾을 수 없습니다.' }
    }

    // 각 조에서 상위 2팀 (또는 2팀 조는 전원) 추출
    let seedNumber = 1
    const firstPlaceTeams: string[] = []
    const secondPlaceTeams: string[] = []

    for (const group of groups) {
      const teams = (group.group_teams || [])
        .filter((t: { final_rank: number | null }) => t.final_rank)
        .sort((a: { final_rank: number }, b: { final_rank: number }) => a.final_rank - b.final_rank)

      if (teams[0]) firstPlaceTeams.push(teams[0].entry_id)
      if (teams[1]) secondPlaceTeams.push(teams[1].entry_id)
    }

    // 1위끼리 안 붙게 크로스 시드 배정
    // 1위팀들을 상위 시드에, 2위팀들을 하위 시드에 배정
    for (const entryId of firstPlaceTeams) {
      advancingTeams.push({ entryId, seed: seedNumber++ })
    }
    for (const entryId of secondPlaceTeams) {
      advancingTeams.push({ entryId, seed: seedNumber++ })
    }
  } else {
    // 예선 없이 직접 본선 (승인된 팀 순서대로)
    const { data: entries } = await supabaseAdmin
      .from('tournament_entries')
      .select('id')
      .eq('division_id', divisionId)
      .in('status', ['APPROVED', 'CONFIRMED'])
      .order('created_at', { ascending: true })

    if (!entries || entries.length < 2) {
      return { error: '최소 2팀 이상이 필요합니다.' }
    }

    advancingTeams = entries.map((e, i) => ({ entryId: e.id, seed: i + 1 }))
  }

  const teamCount = advancingTeams.length
  const bracketSize = calculateBracketSize(teamCount)
  const totalRounds = Math.log2(bracketSize)

  // 기존 본선 경기 삭제
  await supabaseAdmin
    .from('bracket_matches')
    .delete()
    .eq('bracket_config_id', configId)
    .neq('phase', 'PRELIMINARY')

  // 경기 생성 (역순으로 - 결승부터)
  const matchesByRound: Map<number, string[]> = new Map()
  let matchNumber = 1

  // 결승전 생성
  const { data: finalMatch } = await supabaseAdmin
    .from('bracket_matches')
    .insert({
      bracket_config_id: configId,
      phase: 'FINAL',
      round_number: totalRounds,
      bracket_position: 1,
      match_number: matchNumber++,
      status: 'SCHEDULED',
    })
    .select()
    .single()

  if (!finalMatch) {
    return { error: '결승전 생성에 실패했습니다.' }
  }

  matchesByRound.set(totalRounds, [finalMatch.id])

  // 3/4위전 (선택)
  let thirdPlaceMatchId: string | null = null
  if (config.third_place_match) {
    const { data: thirdPlace } = await supabaseAdmin
      .from('bracket_matches')
      .insert({
        bracket_config_id: configId,
        phase: 'THIRD_PLACE',
        round_number: totalRounds,
        bracket_position: 0,
        match_number: matchNumber++,
        status: 'SCHEDULED',
      })
      .select()
      .single()

    thirdPlaceMatchId = thirdPlace?.id || null
  }

  // 준결승부터 1라운드까지 역순으로 생성
  for (let round = totalRounds - 1; round >= 1; round--) {
    const matchesInRound = Math.pow(2, totalRounds - round)
    const roundMatches: string[] = []
    const phase = getPhaseForRound(bracketSize, round)
    const nextRoundMatches = matchesByRound.get(round + 1) || []

    for (let pos = 0; pos < matchesInRound; pos++) {
      const nextMatchIndex = Math.floor(pos / 2)
      const nextMatchId = nextRoundMatches[nextMatchIndex]
      const nextMatchSlot = (pos % 2) + 1

      // 준결승 패자는 3/4위전으로
      const isSeimfinal = round === totalRounds - 1
      const loserNextMatchId = isSeimfinal && thirdPlaceMatchId ? thirdPlaceMatchId : null
      const loserNextMatchSlot = isSeimfinal && thirdPlaceMatchId ? (pos % 2) + 1 : null

      const { data: match } = await supabaseAdmin
        .from('bracket_matches')
        .insert({
          bracket_config_id: configId,
          phase,
          round_number: round,
          bracket_position: pos + 1,
          match_number: matchNumber++,
          next_match_id: nextMatchId,
          next_match_slot: nextMatchSlot,
          loser_next_match_id: loserNextMatchId,
          loser_next_match_slot: loserNextMatchSlot,
          status: 'SCHEDULED',
        })
        .select()
        .single()

      if (match) {
        roundMatches.push(match.id)
      }
    }

    matchesByRound.set(round, roundMatches)
  }

  // 1라운드에 팀 배정 (시드 배치)
  const firstRoundMatches = matchesByRound.get(1) || []
  const byeCount = bracketSize - teamCount

  // 시드 배치 로직 (상위 시드에게 부전승 우선 배정)
  for (let i = 0; i < firstRoundMatches.length; i++) {
    const matchId = firstRoundMatches[i]
    const team1Index = i * 2
    const team2Index = i * 2 + 1

    const team1 = advancingTeams[team1Index]
    const team2 = advancingTeams[team2Index]

    if (team1 && team2) {
      // 둘 다 있으면 경기 진행
      await supabaseAdmin
        .from('bracket_matches')
        .update({
          team1_entry_id: team1.entryId,
          team2_entry_id: team2.entryId,
        })
        .eq('id', matchId)
    } else if (team1) {
      // team2가 없으면 부전승
      const { data: match } = await supabaseAdmin
        .from('bracket_matches')
        .select('next_match_id, next_match_slot')
        .eq('id', matchId)
        .single()

      await supabaseAdmin
        .from('bracket_matches')
        .update({
          team1_entry_id: team1.entryId,
          winner_entry_id: team1.entryId,
          status: 'BYE',
        })
        .eq('id', matchId)

      // 다음 경기에 바로 배정
      if (match?.next_match_id && match?.next_match_slot) {
        const field = match.next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
        await supabaseAdmin
          .from('bracket_matches')
          .update({ [field]: team1.entryId })
          .eq('id', match.next_match_id)
      }
    }
  }

  // 대진표 설정 업데이트
  await supabaseAdmin
    .from('bracket_configs')
    .update({ bracket_size: bracketSize, status: 'MAIN' })
    .eq('id', configId)

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return { data: { bracketSize, teamCount, matchCount: matchNumber - 1 }, error: null }
}

/**
 * 본선 경기 목록 조회
 */
export async function getMainBracketMatches(configId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bracket_matches')
    .select(`
      *,
      team1:tournament_entries!bracket_matches_team1_entry_id_fkey (id, player_name, club_name),
      team2:tournament_entries!bracket_matches_team2_entry_id_fkey (id, player_name, club_name)
    `)
    .eq('bracket_config_id', configId)
    .neq('phase', 'PRELIMINARY')
    .order('round_number', { ascending: true })
    .order('bracket_position', { ascending: true })

  return { data, error }
}

/**
 * 전체 대진표 데이터 조회 (프론트엔드용)
 */
export async function getBracketData(divisionId: string) {
  const supabase = await createClient()

  // 대진표 설정
  const { data: config } = await supabase
    .from('bracket_configs')
    .select('*')
    .eq('division_id', divisionId)
    .single()

  if (!config) {
    return { config: null, groups: null, matches: null }
  }

  // 예선 조 (예선이 있는 경우)
  let groups = null
  if (config.has_preliminaries) {
    const { data } = await supabase
      .from('preliminary_groups')
      .select(`
        *,
        group_teams (
          *,
          entry:tournament_entries (id, player_name, club_name)
        )
      `)
      .eq('bracket_config_id', config.id)
      .order('display_order', { ascending: true })
    groups = data
  }

  // 모든 경기
  const { data: matches } = await supabase
    .from('bracket_matches')
    .select(`
      *,
      team1:tournament_entries!bracket_matches_team1_entry_id_fkey (id, player_name, club_name),
      team2:tournament_entries!bracket_matches_team2_entry_id_fkey (id, player_name, club_name)
    `)
    .eq('bracket_config_id', config.id)
    .order('phase', { ascending: true })
    .order('match_number', { ascending: true })

  return { config, groups, matches }
}
