'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { canManageTournaments } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import type { BracketStatus, MatchPhase, MatchStatus, MatchType, SetDetail } from '@/lib/supabase/types'

// ============================================================================
// 타입 정의
// ============================================================================

export interface BracketConfig {
  id: string
  division_id: string
  has_preliminaries: boolean
  third_place_match: boolean
  group_size: number
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
// 보안: 권한 검증 헬퍼
// ============================================================================

/**
 * 대진표 관리 권한 검증 (MANAGER 이상)
 * 모든 mutation 함수 시작부에서 호출
 */
async function checkBracketManagementAuth(): Promise<{ error: string | null }> {
  const user = await getCurrentUser()
  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }
  if (!canManageTournaments(user.role)) {
    return { error: '대회 관리 권한이 없습니다.' }
  }
  return { error: null }
}

// ============================================================================
// 입력값 검증 헬퍼
// ============================================================================

/** UUID 형식 검증 */
function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

/** 음이 아닌 정수 검증 */
function validateNonNegativeInteger(value: number, fieldName: string): string | null {
  if (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)) {
    return `${fieldName}은(는) 0 이상의 정수여야 합니다.`
  }
  return null
}

// ============================================================================
// Fisher-Yates 셔플 (균등 분포 보장)
// ============================================================================

/** 랜덤 점수 생성 (승자가 항상 높은 점수) */
function generateRandomScores(): [number, number] {
  const winnerScore = Math.floor(Math.random() * 5) + 2 // 2~6
  const loserScore = Math.floor(Math.random() * winnerScore) // 0 ~ (winnerScore-1)
  return Math.random() > 0.5
    ? [winnerScore, loserScore]
    : [loserScore, winnerScore]
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ============================================================================
// 단체전 자동 결과 생성 헬퍼
// ============================================================================

/** 단체전 정보 (configId → tournament의 match_type, team_match_count) */
interface TeamMatchInfo {
  isTeamMatch: boolean
  matchType: MatchType | null
  teamMatchCount: number
  divisionId: string | null
}

/** configId로부터 단체전 여부와 세부 정보 조회 */
async function getTeamMatchInfo(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  configId: string,
): Promise<TeamMatchInfo> {
  const defaultResult: TeamMatchInfo = {
    isTeamMatch: false,
    matchType: null,
    teamMatchCount: 0,
    divisionId: null,
  }

  const { data: config } = await supabaseAdmin
    .from('bracket_configs')
    .select('division_id')
    .eq('id', configId)
    .single()
  if (!config) return defaultResult

  const { data: division } = await supabaseAdmin
    .from('tournament_divisions')
    .select('tournament_id')
    .eq('id', config.division_id)
    .single()
  if (!division) return defaultResult

  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('match_type, team_match_count')
    .eq('id', division.tournament_id)
    .single()
  if (!tournament) return defaultResult

  const isTeamMatch =
    tournament.match_type === 'TEAM_SINGLES' ||
    tournament.match_type === 'TEAM_DOUBLES'

  return {
    isTeamMatch,
    matchType: tournament.match_type as MatchType | null,
    teamMatchCount: tournament.team_match_count || 0,
    divisionId: config.division_id,
  }
}

/** 엔트리에서 선수 이름 목록 추출 (대표 선수 + 팀원) */
function getPlayerNames(entry: {
  player_name: string
  team_members: { name: string; rating: number }[] | null
}): string[] {
  const players = [entry.player_name]
  if (entry.team_members) {
    players.push(...entry.team_members.map((m) => m.name))
  }
  return players
}

/** 엔트리 ID → 선수 목록 맵 구축 */
async function buildEntriesMap(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  divisionId: string,
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>()

  const { data: entries } = await supabaseAdmin
    .from('tournament_entries')
    .select('id, player_name, team_members')
    .eq('division_id', divisionId)
    .in('status', ['CONFIRMED', 'APPROVED'])

  if (entries) {
    for (const entry of entries) {
      map.set(entry.id, getPlayerNames(entry))
    }
  }
  return map
}

/** 단체전 자동 결과 생성 (Best-of-N, 세트별 선수 배정 + 점수) */
function generateTeamMatchAutoResult(
  team1Players: string[],
  team2Players: string[],
  matchType: MatchType,
  teamMatchCount: number,
): { team1Score: number; team2Score: number; setsDetail: SetDetail[] } {
  const playersPerTeam = matchType === 'TEAM_DOUBLES' ? 2 : 1
  const winsNeeded = Math.ceil(teamMatchCount / 2)

  const sets: SetDetail[] = []
  let team1Wins = 0
  let team2Wins = 0

  // 선수 풀을 셔플해서 순서대로 순환 배정
  const shuffled1 = shuffleArray(team1Players)
  const shuffled2 = shuffleArray(team2Players)

  for (let i = 0; i < teamMatchCount; i++) {
    // 승부 결정 시 중단
    if (team1Wins >= winsNeeded || team2Wins >= winsNeeded) break

    // 선수 배정 (순환)
    const t1Players: string[] = []
    const t2Players: string[] = []
    for (let p = 0; p < playersPerTeam; p++) {
      t1Players.push(shuffled1[(i * playersPerTeam + p) % shuffled1.length])
      t2Players.push(shuffled2[(i * playersPerTeam + p) % shuffled2.length])
    }

    // 세트 점수 생성 (승자가 항상 높은 점수)
    const [s1, s2] = generateRandomScores()

    sets.push({
      set_number: i + 1,
      team1_players: t1Players,
      team2_players: t2Players,
      team1_score: s1,
      team2_score: s2,
    })

    if (s1 > s2) team1Wins++
    else team2Wins++
  }

  return { team1Score: team1Wins, team2Score: team2Wins, setsDetail: sets }
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
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { data: null, error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { data: null, error: idError }

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
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(configId, '설정 ID') || validateId(divisionId, '부서 ID')
  if (idError) return { error: idError }

  const supabaseAdmin = createAdminClient()

  // 설정에서 group_size 조회
  const { data: bracketConfig } = await supabaseAdmin
    .from('bracket_configs')
    .select('group_size')
    .eq('id', configId)
    .single()

  const groupSize = bracketConfig?.group_size ?? 3

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

  // 조 개수 계산 (group_size 기반)
  const teamCount = entries.length
  let groupCount: number
  let teamsPerGroup: number[]

  if (groupSize === 2) {
    // 2팀 조: 홀수면 마지막 조는 1팀 (부전승)
    groupCount = Math.ceil(teamCount / 2)
    teamsPerGroup = Array(groupCount).fill(2)
    if (teamCount % 2 === 1) {
      teamsPerGroup[groupCount - 1] = 1
    }
  } else if (teamCount <= 3) {
    // 3팀 이하: 1개 조
    groupCount = 1
    teamsPerGroup = [teamCount]
  } else {
    // 3팀 조를 최대한 만들고, 나머지는 2팀 조
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

  // Fisher-Yates 셔플로 균등 분포 보장
  const shuffledEntries = shuffleArray(entries)

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

    // 팀 배정 — 배치 삽입
    const groupTeams = shuffledEntries.slice(entryIndex, entryIndex + teamsPerGroup[i])
    entryIndex += teamsPerGroup[i]

    const teamInserts = groupTeams.map((team, j) => ({
      group_id: group.id,
      entry_id: team.id,
      seed_number: j + 1,
    }))

    const { error: teamInsertError } = await supabaseAdmin
      .from('group_teams')
      .insert(teamInserts)

    if (teamInsertError) {
      return { error: '팀 배정에 실패했습니다.' }
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
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(teamId, '팀 ID') || validateId(newGroupId, '조 ID')
  if (idError) return { error: idError }

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
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { error: idError }

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

  // 배치 삽입용 배열 구성
  let matchNumber = 1
  const matchInserts: {
    bracket_config_id: string
    phase: string
    group_id: string
    match_number: number
    team1_entry_id: string
    team2_entry_id: string
    status: string
  }[] = []

  for (const group of groups) {
    const teams = group.group_teams?.map((t: { entry_id: string }) => t.entry_id) || []

    // 풀리그 경기 생성
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        matchInserts.push({
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

  // 배치 삽입
  if (matchInserts.length > 0) {
    const { error: insertError } = await supabaseAdmin
      .from('bracket_matches')
      .insert(matchInserts)

    if (insertError) {
      return { error: '예선 경기 생성에 실패했습니다.' }
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
      team1:tournament_entries!bracket_matches_team1_entry_id_fkey (id, player_name, club_name, team_members),
      team2:tournament_entries!bracket_matches_team2_entry_id_fkey (id, player_name, club_name, team_members)
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
  team2Score: number,
  setsDetail?: SetDetail[]
) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(matchId, '경기 ID')
  if (idError) return { error: idError }

  const score1Error = validateNonNegativeInteger(team1Score, '팀1 점수')
  if (score1Error) return { error: score1Error }

  const score2Error = validateNonNegativeInteger(team2Score, '팀2 점수')
  if (score2Error) return { error: score2Error }

  // 동점 거부 (서버 사이드 검증)
  if (team1Score === team2Score) {
    return { error: '동점은 허용되지 않습니다. 승패가 결정되어야 합니다.' }
  }

  const supabaseAdmin = createAdminClient()

  // 경기 정보 조회
  const { data: match, error: matchError } = await supabaseAdmin
    .from('bracket_matches')
    .select('*, bracket_config_id, phase, group_id, team1_entry_id, team2_entry_id, winner_entry_id, next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { error: '경기 정보 조회에 실패했습니다.' }
  }

  const winnerId = team1Score > team2Score ? match.team1_entry_id : match.team2_entry_id
  const loserId = team1Score > team2Score ? match.team2_entry_id : match.team1_entry_id
  const previousWinnerId = match.winner_entry_id

  // 이미 완료된 경기의 승자가 변경되는 경우, 하위 경기 무효화
  if (match.status === 'COMPLETED' && previousWinnerId && previousWinnerId !== winnerId) {
    await invalidateDownstreamMatches(supabaseAdmin, match, previousWinnerId)
  }

  // 경기 결과 업데이트
  const updatePayload: Record<string, unknown> = {
    team1_score: team1Score,
    team2_score: team2Score,
    winner_entry_id: winnerId,
    status: 'COMPLETED',
    completed_at: new Date().toISOString(),
  }
  // 단체전 세트 상세 결과 (있으면 함께 저장)
  if (setsDetail) {
    updatePayload.sets_detail = setsDetail
  }

  const { error: updateError } = await supabaseAdmin
    .from('bracket_matches')
    .update(updatePayload)
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
 * 경기 결과 수정 시 하위 경기 무효화
 * 이전 승자를 다음 경기에서 제거하고 점수/승자/상태 초기화
 */
async function invalidateDownstreamMatches(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  match: { next_match_id: string | null; next_match_slot: number | null; loser_next_match_id: string | null; loser_next_match_slot: number | null },
  previousWinnerId: string
) {
  // 승자가 진출한 다음 경기 초기화
  if (match.next_match_id && match.next_match_slot) {
    await resetDownstreamMatch(supabaseAdmin, match.next_match_id, match.next_match_slot, previousWinnerId)
  }

  // 패자가 진출한 경기(3/4위전 등) 초기화
  if (match.loser_next_match_id && match.loser_next_match_slot) {
    // 이전 패자 = 이전 승자가 아닌 쪽이었는데, 승자가 변경되므로 이전 패자도 변경됨
    // 현재 loser_next_match에 배정된 팀을 제거
    const slotField = match.loser_next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
    await supabaseAdmin
      .from('bracket_matches')
      .update({
        [slotField]: null,
        team1_score: null,
        team2_score: null,
        winner_entry_id: null,
        status: 'SCHEDULED',
        completed_at: null,
      })
      .eq('id', match.loser_next_match_id)
  }
}

/**
 * 하위 경기 재귀적 초기화
 */
async function resetDownstreamMatch(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  matchId: string,
  slot: number,
  previousEntryId: string
) {
  // 해당 경기 조회
  const { data: nextMatch } = await supabaseAdmin
    .from('bracket_matches')
    .select('*, next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot, winner_entry_id')
    .eq('id', matchId)
    .single()

  if (!nextMatch) return

  // 해당 슬롯에서 이전 승자 제거
  const slotField = slot === 1 ? 'team1_entry_id' : 'team2_entry_id'

  // 이 경기도 이미 완료되었고, 이전 승자가 또 다음 경기로 진출했다면 재귀적으로 무효화
  if (nextMatch.status === 'COMPLETED' && nextMatch.winner_entry_id) {
    if (nextMatch.next_match_id && nextMatch.next_match_slot) {
      await resetDownstreamMatch(supabaseAdmin, nextMatch.next_match_id, nextMatch.next_match_slot, nextMatch.winner_entry_id)
    }
    if (nextMatch.loser_next_match_id && nextMatch.loser_next_match_slot) {
      const loserSlotField = nextMatch.loser_next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
      await supabaseAdmin
        .from('bracket_matches')
        .update({
          [loserSlotField]: null,
          team1_score: null,
          team2_score: null,
          winner_entry_id: null,
          status: 'SCHEDULED',
          completed_at: null,
        })
        .eq('id', nextMatch.loser_next_match_id)
    }
  }

  // 이 경기 자체를 초기화
  await supabaseAdmin
    .from('bracket_matches')
    .update({
      [slotField]: null,
      team1_score: null,
      team2_score: null,
      winner_entry_id: null,
      status: 'SCHEDULED',
      completed_at: null,
    })
    .eq('id', matchId)
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

  // DB 업데이트 (update는 개별로 — 각 팀마다 다른 값이므로 배치 불가)
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
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(configId, '설정 ID') || validateId(divisionId, '부서 ID')
  if (idError) return { error: idError }

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
    for (const entryId of firstPlaceTeams) {
      advancingTeams.push({ entryId, seed: seedNumber++ })
    }
    for (const entryId of secondPlaceTeams) {
      advancingTeams.push({ entryId, seed: seedNumber++ })
    }
  } else {
    // 예선 없이 조편성 기반 본선 (조 내 팀 순서가 시드)
    const { data: groups } = await supabaseAdmin
      .from('preliminary_groups')
      .select(`
        *,
        group_teams (entry_id, seed_number)
      `)
      .eq('bracket_config_id', configId)
      .order('display_order', { ascending: true })

    if (groups && groups.length > 0) {
      // 조편성이 있으면 조 순서대로 시드 배정
      // 각 조의 팀들이 순서대로 advancingTeams에 추가됨
      // → Group A [T1,T2], Group B [T3,T4] → [T1,T2,T3,T4]
      let seedNumber = 1
      for (const group of groups) {
        const teams = (group.group_teams || [])
          .sort((a: { seed_number: number | null }, b: { seed_number: number | null }) =>
            (a.seed_number ?? 0) - (b.seed_number ?? 0))
        for (const team of teams) {
          advancingTeams.push({ entryId: team.entry_id, seed: seedNumber++ })
        }
      }
    } else {
      // 조편성도 없으면 참가팀 순서대로 (fallback)
      const { data: entries } = await supabaseAdmin
        .from('tournament_entries')
        .select('id')
        .eq('division_id', divisionId)
        .eq('status', 'CONFIRMED')
        .order('created_at', { ascending: true })

      if (!entries || entries.length < 2) {
        return { error: '최소 2팀 이상이 필요합니다. 조 편성을 먼저 진행해주세요.' }
      }

      advancingTeams = entries.map((e, i) => ({ entryId: e.id, seed: i + 1 }))
    }
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

  // 경기 생성 (역순으로 - 결승부터, 라운드 간 ID 의존성 때문에 순차)
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
      const isSemifinal = round === totalRounds - 1
      const loserNextMatchId = isSemifinal && thirdPlaceMatchId ? thirdPlaceMatchId : null
      const loserNextMatchSlot = isSemifinal && thirdPlaceMatchId ? (pos % 2) + 1 : null

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
      const { data: matchData } = await supabaseAdmin
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
      if (matchData?.next_match_id && matchData?.next_match_slot) {
        const field = matchData.next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
        await supabaseAdmin
          .from('bracket_matches')
          .update({ [field]: team1.entryId })
          .eq('id', matchData.next_match_id)
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
      team1:tournament_entries!bracket_matches_team1_entry_id_fkey (id, player_name, club_name, team_members),
      team2:tournament_entries!bracket_matches_team2_entry_id_fkey (id, player_name, club_name, team_members)
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
      team1:tournament_entries!bracket_matches_team1_entry_id_fkey (id, player_name, club_name, team_members),
      team2:tournament_entries!bracket_matches_team2_entry_id_fkey (id, player_name, club_name, team_members)
    `)
    .eq('bracket_config_id', config.id)
    .order('phase', { ascending: true })
    .order('match_number', { ascending: true })

  return { config, groups, matches }
}

/**
 * 예선 조 편성 삭제 (조 배정 및 예선 경기도 함께 삭제됨)
 */
export async function deletePreliminaryGroups(configId: string) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { success: false, error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { success: false, error: idError }

  const supabaseAdmin = createAdminClient()

  try {
    // CASCADE로 group_teams와 예선 bracket_matches도 삭제됨
    const { error } = await supabaseAdmin
      .from('preliminary_groups')
      .delete()
      .eq('bracket_config_id', configId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/tournaments')
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    return { success: false, error: message }
  }
}

/**
 * 예선 경기만 삭제 (조 편성은 유지)
 */
export async function deletePreliminaryMatches(configId: string) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { success: false, error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { success: false, error: idError }

  const supabaseAdmin = createAdminClient()

  try {
    const { error } = await supabaseAdmin
      .from('bracket_matches')
      .delete()
      .eq('bracket_config_id', configId)
      .eq('phase', 'PRELIMINARY')

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/tournaments')
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    return { success: false, error: message }
  }
}

/**
 * 본선 대진표 삭제 (본선 경기만 삭제, 예선은 유지)
 */
export async function deleteMainBracket(configId: string) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { success: false, error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { success: false, error: idError }

  const supabaseAdmin = createAdminClient()

  try {
    const { error } = await supabaseAdmin
      .from('bracket_matches')
      .delete()
      .eq('bracket_config_id', configId)
      .neq('phase', 'PRELIMINARY')

    if (error) {
      return { success: false, error: error.message }
    }

    const { error: updateError } = await supabaseAdmin
      .from('bracket_configs')
      .update({
        bracket_size: null,
        status: 'PRELIMINARY',
      })
      .eq('id', configId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    revalidatePath('/admin/tournaments')
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    return { success: false, error: message }
  }
}

/**
 * 전체 대진표 설정 삭제 (모든 조편성, 경기 데이터 삭제)
 */
export async function deleteBracketConfig(configId: string) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { success: false, error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { success: false, error: idError }

  const supabaseAdmin = createAdminClient()

  try {
    // CASCADE로 관련 데이터 자동 삭제됨
    const { error } = await supabaseAdmin
      .from('bracket_configs')
      .delete()
      .eq('id', configId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/admin/tournaments')
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    return { success: false, error: message }
  }
}

// ============================================================================
// 테스트용: 자동 결과 입력
// ============================================================================

/**
 * 예선 경기 자동 결과 입력 (개발 테스트용)
 * SCHEDULED 상태의 모든 예선 경기에 랜덤 결과 입력
 * 단체전일 경우 세트별 상세 결과(sets_detail)도 함께 생성
 */
export async function autoFillPreliminaryResults(configId: string) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { error: idError }

  const supabaseAdmin = createAdminClient()

  // 단체전 여부 확인
  const teamInfo = await getTeamMatchInfo(supabaseAdmin, configId)

  // SCHEDULED 상태이며 양 팀이 배정된 예선 경기 조회
  const { data: matches } = await supabaseAdmin
    .from('bracket_matches')
    .select('*')
    .eq('bracket_config_id', configId)
    .eq('phase', 'PRELIMINARY')
    .eq('status', 'SCHEDULED')
    .not('team1_entry_id', 'is', null)
    .not('team2_entry_id', 'is', null)
    .order('match_number')

  if (!matches || matches.length === 0) {
    return { data: { filledCount: 0 }, error: null }
  }

  // 단체전이면 엔트리 선수 목록 미리 조회
  let entriesMap = new Map<string, string[]>()
  if (teamInfo.isTeamMatch && teamInfo.divisionId) {
    entriesMap = await buildEntriesMap(supabaseAdmin, teamInfo.divisionId)
  }

  const groupIds = new Set<string>()
  let filledCount = 0

  for (const match of matches) {
    let team1Score: number
    let team2Score: number
    let setsDetail: SetDetail[] | undefined

    if (teamInfo.isTeamMatch && teamInfo.matchType && teamInfo.teamMatchCount > 0) {
      // 단체전: Best-of-N 세트별 결과 생성
      const t1Players = entriesMap.get(match.team1_entry_id!) || ['선수1']
      const t2Players = entriesMap.get(match.team2_entry_id!) || ['선수1']
      const result = generateTeamMatchAutoResult(
        t1Players,
        t2Players,
        teamInfo.matchType,
        teamInfo.teamMatchCount,
      )
      team1Score = result.team1Score
      team2Score = result.team2Score
      setsDetail = result.setsDetail
    } else {
      // 개인전: 단순 랜덤 점수
      ;[team1Score, team2Score] = generateRandomScores()
    }

    const winnerId = team1Score > team2Score ? match.team1_entry_id : match.team2_entry_id

    const updatePayload: Record<string, unknown> = {
      team1_score: team1Score,
      team2_score: team2Score,
      winner_entry_id: winnerId,
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
    }
    if (setsDetail) {
      updatePayload.sets_detail = setsDetail
    }

    await supabaseAdmin
      .from('bracket_matches')
      .update(updatePayload)
      .eq('id', match.id)

    if (match.group_id) groupIds.add(match.group_id)
    filledCount++
  }

  // 조별 순위 업데이트
  for (const groupId of groupIds) {
    await updateGroupStandings(groupId)
  }

  revalidatePath('/admin/tournaments')
  return { data: { filledCount }, error: null }
}

/**
 * 본선 경기 자동 결과 입력 (개발 테스트용)
 * 라운드 순서대로 SCHEDULED 경기에 랜덤 결과 입력 + 승자/패자 전파
 * 단체전일 경우 세트별 상세 결과(sets_detail)도 함께 생성
 */
export async function autoFillMainBracketResults(configId: string) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { error: idError }

  const supabaseAdmin = createAdminClient()

  // 단체전 여부 확인 + 엔트리 선수 목록 미리 조회
  const teamInfo = await getTeamMatchInfo(supabaseAdmin, configId)
  let entriesMap = new Map<string, string[]>()
  if (teamInfo.isTeamMatch && teamInfo.divisionId) {
    entriesMap = await buildEntriesMap(supabaseAdmin, teamInfo.divisionId)
  }

  let filledCount = 0
  const MAX_ITERATIONS = 10 // 안전장치 (128강 = 7라운드)

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // 양 팀이 배정된 SCHEDULED 본선 경기 조회 (라운드 순)
    const { data: matches } = await supabaseAdmin
      .from('bracket_matches')
      .select('*')
      .eq('bracket_config_id', configId)
      .neq('phase', 'PRELIMINARY')
      .eq('status', 'SCHEDULED')
      .not('team1_entry_id', 'is', null)
      .not('team2_entry_id', 'is', null)
      .order('round_number')
      .order('bracket_position')

    if (!matches || matches.length === 0) break

    for (const match of matches) {
      let team1Score: number
      let team2Score: number
      let setsDetail: SetDetail[] | undefined

      if (teamInfo.isTeamMatch && teamInfo.matchType && teamInfo.teamMatchCount > 0) {
        // 단체전: Best-of-N 세트별 결과 생성
        const t1Players = entriesMap.get(match.team1_entry_id!) || ['선수1']
        const t2Players = entriesMap.get(match.team2_entry_id!) || ['선수1']
        const result = generateTeamMatchAutoResult(
          t1Players,
          t2Players,
          teamInfo.matchType,
          teamInfo.teamMatchCount,
        )
        team1Score = result.team1Score
        team2Score = result.team2Score
        setsDetail = result.setsDetail
      } else {
        // 개인전: 단순 랜덤 점수
        ;[team1Score, team2Score] = generateRandomScores()
      }

      const winnerId = team1Score > team2Score ? match.team1_entry_id : match.team2_entry_id
      const loserId = team1Score > team2Score ? match.team2_entry_id : match.team1_entry_id

      const updatePayload: Record<string, unknown> = {
        team1_score: team1Score,
        team2_score: team2Score,
        winner_entry_id: winnerId,
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      }
      if (setsDetail) {
        updatePayload.sets_detail = setsDetail
      }

      await supabaseAdmin
        .from('bracket_matches')
        .update(updatePayload)
        .eq('id', match.id)

      // 승자를 다음 경기에 배정
      if (match.next_match_id && match.next_match_slot) {
        const field = match.next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
        await supabaseAdmin
          .from('bracket_matches')
          .update({ [field]: winnerId })
          .eq('id', match.next_match_id)
      }

      // 패자를 3/4위전에 배정
      if (match.loser_next_match_id && match.loser_next_match_slot) {
        const field = match.loser_next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
        await supabaseAdmin
          .from('bracket_matches')
          .update({ [field]: loserId })
          .eq('id', match.loser_next_match_id)
      }

      filledCount++
    }
  }

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return { data: { filledCount }, error: null }
}
