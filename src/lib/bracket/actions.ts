'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { canManageTournaments } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import type { BracketStatus, MatchPhase, MatchStatus, MatchType, PartnerData, SetDetail, TeamMember, TournamentStatus } from '@/lib/supabase/types'
import { createNotification, createBulkNotifications } from '@/lib/notifications/actions'
import { NotificationType } from '@/lib/notifications/types'

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
  /** 현재 점수 입력 가능한 페이즈 (NULL = 비활성) */
  active_phase: string | null
  /** 현재 점수 입력 가능한 라운드 (NULL = 해당 페이즈 전체) */
  active_round: number | null
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
    partner_data: { name: string; rating: number; club: string | null } | null
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
    partner_data: { name: string; rating: number; club: string | null } | null
  }
  team2?: {
    id: string
    player_name: string
    club_name: string | null
    partner_data: { name: string; rating: number; club: string | null } | null
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
// 대회 상태 검증 헬퍼
// ============================================================================

/** 대회가 마감(COMPLETED/CANCELLED)되었는지 확인 — 마감 시 수정 불가 */
const CLOSED_TOURNAMENT_STATUSES: TournamentStatus[] = ['COMPLETED', 'CANCELLED']

/** configId로 대회 상태를 조회하여 마감 여부 검증 (1 JOIN 쿼리) */
async function checkTournamentNotClosed(configId: string): Promise<{ error: string | null }> {
  const supabaseAdmin = createAdminClient()

  // bracket_configs → tournament_divisions → tournaments 를 단일 JOIN으로 조회
  const { data } = await supabaseAdmin
    .from('bracket_configs')
    .select('tournament_divisions!inner(tournaments!inner(status))')
    .eq('id', configId)
    .single()

  if (!data) return { error: '대진표 설정을 찾을 수 없습니다.' }

  const division = data.tournament_divisions as unknown as { tournaments: { status: string } }
  const status = division?.tournaments?.status
  if (!status) return { error: '대회 정보를 찾을 수 없습니다.' }

  if (CLOSED_TOURNAMENT_STATUSES.includes(status as TournamentStatus)) {
    return { error: '마감된 대회의 대진표는 수정할 수 없습니다.' }
  }
  return { error: null }
}

/** matchId로 대회 상태를 조회하여 마감 여부 검증 */
async function checkTournamentNotClosedByMatchId(matchId: string): Promise<{ error: string | null }> {
  const supabaseAdmin = createAdminClient()

  const { data: match } = await supabaseAdmin
    .from('bracket_matches')
    .select('bracket_config_id')
    .eq('id', matchId)
    .single()
  if (!match) return { error: '경기 정보를 찾을 수 없습니다.' }

  return checkTournamentNotClosed(match.bracket_config_id)
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

/** 엔트리에서 선수 이름 목록 추출 (대표 선수 + 팀원) — 신청자 미참가 시 대표선수 제외 */
function getPlayerNames(entry: {
  player_name: string
  team_members: { name: string; rating: number }[] | null
  applicant_participates?: boolean | null
}): string[] {
  const players = entry.applicant_participates === false ? [] : [entry.player_name]
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
    .select('id, player_name, team_members, applicant_participates')
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

  // 새로 생성 — 기본값: 예선전 ON, 3/4위전 ON, 조당 3팀
  const { data, error } = await supabase
    .from('bracket_configs')
    .insert({
      division_id: divisionId,
      has_preliminaries: true,
      third_place_match: true,
      group_size: 3,
    })
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

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { data: null, error: closedCheck.error }

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
 * 조 이름 생성 (1, 2, 3, ...)
 */
function getGroupName(index: number): string {
  return String(index + 1)
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

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { error: closedCheck.error }

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
        entry:tournament_entries (id, player_name, club_name, team_order, partner_data, team_members, applicant_participates)
      )
    `)
    .eq('bracket_config_id', configId)
    .order('display_order', { ascending: true })
    .order('seed_number', { ascending: true, referencedTable: 'group_teams' })

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

  // 조 → bracket_config_id 조회하여 마감 대회 체크
  const { data: group } = await supabaseAdmin
    .from('preliminary_groups')
    .select('bracket_config_id')
    .eq('id', newGroupId)
    .single()

  if (group?.bracket_config_id) {
    const closedCheck = await checkTournamentNotClosed(group.bracket_config_id)
    if (closedCheck.error) return { error: closedCheck.error }
  }

  const { error } = await supabaseAdmin
    .from('group_teams')
    .update({ group_id: newGroupId })
    .eq('id', teamId)

  if (!error) {
    revalidatePath('/admin/tournaments')
  }

  return { error }
}

/**
 * 조편성 일괄 저장 — 조 이동 + 순서(seed_number) 변경을 한 번에 처리
 * 인증/검증 1회 + batch UPDATE
 */
export async function batchSaveGroupTeams(
  updates: Array<{ teamId: string; groupId: string; seedNumber: number }>
): Promise<{ error: string | null }> {
  if (updates.length === 0) return { error: null }

  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  // 입력 검증
  for (const u of updates) {
    const idError = validateId(u.teamId, '팀 ID') || validateId(u.groupId, '조 ID')
    if (idError) return { error: idError }
  }

  const supabaseAdmin = createAdminClient()

  // 첫 번째 그룹으로 마감 체크 (같은 config 내 이동이므로 1회만)
  const { data: group } = await supabaseAdmin
    .from('preliminary_groups')
    .select('bracket_config_id')
    .eq('id', updates[0].groupId)
    .single()

  if (group?.bracket_config_id) {
    const closedCheck = await checkTournamentNotClosed(group.bracket_config_id)
    if (closedCheck.error) return { error: closedCheck.error }
  }

  // 병렬 UPDATE — group_id + seed_number 모두 갱신
  const results = await Promise.all(
    updates.map((u) =>
      supabaseAdmin
        .from('group_teams')
        .update({ group_id: u.groupId, seed_number: u.seedNumber })
        .eq('id', u.teamId)
    )
  )

  const errors = results.filter((r) => r.error)
  if (errors.length > 0) {
    return { error: `${errors.length}건 저장 실패` }
  }

  revalidatePath('/admin/tournaments')
  return { error: null }
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

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { error: closedCheck.error }

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
      team1:tournament_entries!bracket_matches_team1_entry_id_fkey (id, player_name, club_name, team_order, partner_data, team_members, applicant_participates),
      team2:tournament_entries!bracket_matches_team2_entry_id_fkey (id, player_name, club_name, team_order, partner_data, team_members, applicant_participates)
    `)
    .eq('bracket_config_id', configId)
    .eq('phase', 'PRELIMINARY')
    .order('match_number', { ascending: true })

  return { data, error }
}

/**
 * 경기 결과 입력
 */
/**
 * 결승/3·4위전 완료 시 대회 자동 완료 처리
 * 1. 해당 bracket_config의 모든 본선 매치가 완료(COMPLETED/BYE)인지 확인
 * 2. 완료 시 bracket_config.status → 'COMPLETED'
 * 3. 같은 tournament의 모든 bracket_config가 COMPLETED인지 확인
 * 4. 전부 완료 시 tournaments.status → 'COMPLETED'
 */

/**
 * configId에 해당하는 division의 어워드 전체 삭제
 * deleteLatestRound / deleteMainBracket 시 stale 어워드 정리용
 */
async function deleteAwardsForConfig(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  configId: string
): Promise<void> {
  const { data: config } = await supabaseAdmin
    .from('bracket_configs')
    .select('division_id')
    .eq('id', configId)
    .single()
  if (!config) return

  const { data: division } = await supabaseAdmin
    .from('tournament_divisions')
    .select('tournament_id')
    .eq('id', config.division_id)
    .single()
  if (!division) return

  await supabaseAdmin
    .from('tournament_awards')
    .delete()
    .eq('tournament_id', division.tournament_id)
    .eq('division_id', config.division_id)
    .in('award_rank', ['우승', '준우승', '공동3위', '3위'])
}

/**
 * FINAL/THIRD_PLACE 완료 시 tournament_awards 자동 생성
 * - FINAL: 우승/준우승 INSERT, 3위전 없으면 SEMI 패자 2명 공동3위 INSERT
 * - THIRD_PLACE: 3위 INSERT
 * - 결과 수정 시: 해당 순위 레코드 DELETE 후 재생성
 */
async function createAwardRecords(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  params: {
    phase: MatchPhase
    bracketConfigId: string
    winnerId: string | null
    loserId: string | null
  }
): Promise<void> {
  if (!params.winnerId) return

  // bracket_config → division → tournament 역추적
  const { data: config } = await supabaseAdmin
    .from('bracket_configs')
    .select('division_id')
    .eq('id', params.bracketConfigId)
    .single()
  if (!config) return

  const { data: division } = await supabaseAdmin
    .from('tournament_divisions')
    .select('tournament_id, name')
    .eq('id', config.division_id)
    .single()
  if (!division) return

  const { data: tournament } = await supabaseAdmin
    .from('tournaments')
    .select('title, start_date, match_type')
    .eq('id', division.tournament_id)
    .single()
  if (!tournament?.start_date) return

  const year = new Date(tournament.start_date).getFullYear()
  const matchType = tournament.match_type as MatchType
  const isTeam = matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES'
  const isDoubles = matchType === 'INDIVIDUAL_DOUBLES'

  // entry_id → players 배열 + 클럽명 조회
  const fetchPlayers = async (entryId: string) => {
    const { data } = await supabaseAdmin
      .from('tournament_entries')
      .select('player_name, club_name, partner_data, team_members, applicant_participates')
      .eq('id', entryId)
      .single()
    if (!data) return null
    let players: string[]
    if (isTeam && data.team_members?.length) {
      const members = (data.team_members as TeamMember[]).map((m) => m.name)
      // 신청자 참가 시 player_name도 포함 (기존 버그 수정: 신청자가 awards에서 누락되던 문제)
      players = data.applicant_participates !== false
        ? [data.player_name, ...members]
        : members
    } else if (isDoubles && data.partner_data) {
      players = [data.player_name, (data.partner_data as PartnerData).name]
    } else {
      players = [data.player_name]
    }
    return { players, clubName: data.club_name }
  }

  const baseRow = {
    competition: tournament.title,
    year,
    division: division.name,
    game_type: isTeam ? '단체전' : '개인전',
    tournament_id: division.tournament_id,
    division_id: config.division_id,
  }

  if (params.phase === 'FINAL') {
    // 결과 수정 대응: 기존 FINAL 관련 순위 삭제 후 재생성
    await supabaseAdmin
      .from('tournament_awards')
      .delete()
      .eq('tournament_id', division.tournament_id)
      .eq('division_id', config.division_id)
      .in('award_rank', ['우승', '준우승', '공동3위'])

    const rows: Record<string, unknown>[] = []

    // 우승
    const winner = await fetchPlayers(params.winnerId)
    if (winner) {
      rows.push({ ...baseRow, award_rank: '우승', players: winner.players, club_name: winner.clubName, entry_id: params.winnerId })
    }

    // 준우승
    if (params.loserId) {
      const loser = await fetchPlayers(params.loserId)
      if (loser) {
        rows.push({ ...baseRow, award_rank: '준우승', players: loser.players, club_name: loser.clubName, entry_id: params.loserId })
      }
    }

    // 3위전 없는 경우: SEMI 패자 2명 → 공동3위
    const { count: thirdPlaceCount } = await supabaseAdmin
      .from('bracket_matches')
      .select('id', { count: 'exact', head: true })
      .eq('bracket_config_id', params.bracketConfigId)
      .eq('phase', 'THIRD_PLACE')

    if (!thirdPlaceCount) {
      const { data: semiMatches } = await supabaseAdmin
        .from('bracket_matches')
        .select('team1_entry_id, team2_entry_id, winner_entry_id')
        .eq('bracket_config_id', params.bracketConfigId)
        .eq('phase', 'SEMI')
        .eq('status', 'COMPLETED')

      for (const semi of semiMatches ?? []) {
        const semiLoserId = semi.winner_entry_id === semi.team1_entry_id
          ? semi.team2_entry_id
          : semi.team1_entry_id
        if (!semiLoserId) continue
        const semiLoser = await fetchPlayers(semiLoserId)
        if (semiLoser) {
          rows.push({ ...baseRow, award_rank: '공동3위', players: semiLoser.players, club_name: semiLoser.clubName, entry_id: semiLoserId })
        }
      }
    }

    if (rows.length > 0) {
      await supabaseAdmin.from('tournament_awards').insert(rows)
    }
  } else if (params.phase === 'THIRD_PLACE') {
    // 결과 수정 대응: 기존 3위 삭제 후 재생성
    await supabaseAdmin
      .from('tournament_awards')
      .delete()
      .eq('tournament_id', division.tournament_id)
      .eq('division_id', config.division_id)
      .eq('award_rank', '3위')

    const winner = await fetchPlayers(params.winnerId)
    if (winner) {
      await supabaseAdmin.from('tournament_awards').insert([{
        ...baseRow,
        award_rank: '3위',
        players: winner.players,
        club_name: winner.clubName,
        entry_id: params.winnerId,
      }])
    }
  }
}

async function checkAndCompleteTournament(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  bracketConfigId: string,
) {
  // 해당 config의 본선 매치 중 미완료 건이 있는지 확인
  const { data: pendingMatches } = await supabaseAdmin
    .from('bracket_matches')
    .select('id')
    .eq('bracket_config_id', bracketConfigId)
    .neq('phase', 'PRELIMINARY')
    .not('status', 'in', '("COMPLETED","BYE")')
    .limit(1)

  // 미완료 매치가 있으면 아직 완료 아님
  if (pendingMatches && pendingMatches.length > 0) return

  // bracket_config → COMPLETED
  await supabaseAdmin
    .from('bracket_configs')
    .update({ status: 'COMPLETED' })
    .eq('id', bracketConfigId)

  // 대회 상태는 관리자가 직접 변경 — 자동 완료 처리 없음
}

/**
 * 경기 결과 저장 핵심 로직 (관리자/선수 공용)
 * 점수 저장, 승자 전파, 예선 순위 업데이트 포함
 */
async function updateMatchResultCore(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  matchId: string,
  team1Score: number,
  team2Score: number,
  setsDetail?: SetDetail[],
  winnerOverride?: string,
): Promise<{ winnerId?: string | null; error?: string }> {
  // 경기 정보 조회
  const { data: match, error: matchError } = await supabaseAdmin
    .from('bracket_matches')
    .select('*, bracket_config_id, phase, group_id, team1_entry_id, team2_entry_id, winner_entry_id, next_match_id, next_match_slot, loser_next_match_id, loser_next_match_slot')
    .eq('id', matchId)
    .single()

  if (matchError || !match) {
    return { error: '경기 정보 조회에 실패했습니다.' }
  }

  // 모드 분기:
  // - isManualWinner: 점수 없이 관리자가 승자 직접 지정 (score null, status COMPLETED)
  // - isPartial: 동점(0-0 포함) — 매치 미결, sets_detail(선수 정보)만 저장
  // - 정상: 점수 비교로 winner 결정 (한 게임만 진행해도 1-0이면 COMPLETED)
  const isManualWinner = !!winnerOverride
  const isPartial = !isManualWinner && team1Score === team2Score

  let winnerId: string | null = null
  let loserId: string | null = null
  if (isManualWinner) {
    winnerId = winnerOverride!
    loserId = winnerOverride === match.team1_entry_id ? match.team2_entry_id : match.team1_entry_id
  } else if (team1Score > team2Score) {
    winnerId = match.team1_entry_id
    loserId = match.team2_entry_id
  } else if (team2Score > team1Score) {
    winnerId = match.team2_entry_id
    loserId = match.team1_entry_id
  }
  const previousWinnerId = match.winner_entry_id

  // 이미 완료된 경기의 승자가 변경되는 경우(partial 되돌림 포함), 하위 경기 무효화
  if (match.status === 'COMPLETED' && previousWinnerId && previousWinnerId !== winnerId) {
    await invalidateDownstreamMatches(supabaseAdmin, match, previousWinnerId)
  }

  // 경기 결과 업데이트
  const useScore = !isManualWinner && !isPartial
  const updatePayload: Record<string, unknown> = {
    team1_score: useScore ? team1Score : null,
    team2_score: useScore ? team2Score : null,
    winner_entry_id: winnerId,
    status: isPartial ? 'SCHEDULED' : 'COMPLETED',
    completed_at: isPartial ? null : new Date().toISOString(),
  }
  // 단체전 세트 상세 결과 (있으면 함께 저장 — partial일 때도 선수 정보 보존)
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

  // post-UPDATE 작업은 서로 독립적이므로 병렬 실행
  const postUpdateTasks: Promise<unknown>[] = []

  // 예선 경기: 조별 순위 업데이트
  if (match.phase === 'PRELIMINARY' && match.group_id) {
    postUpdateTasks.push(updateGroupStandings(match.group_id))
  }

  // 본선 경기: 다음 경기에 승자 배정 → BYE 전파 (순서 의존: next 배정 후 propagate)
  if (match.next_match_id && match.next_match_slot && winnerId) {
    const nextMatchId = match.next_match_id
    const updateField = match.next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
    postUpdateTasks.push(
      (async () => {
        await supabaseAdmin
          .from('bracket_matches')
          .update({ [updateField]: winnerId })
          .eq('id', nextMatchId)
        await propagateByeIfNeeded(supabaseAdmin, nextMatchId)
      })()
    )
  }

  // 3/4위전에 패자 배정 (승자 배정과 독립적)
  if (match.loser_next_match_id && match.loser_next_match_slot && loserId) {
    const updateField = match.loser_next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
    postUpdateTasks.push(
      (async () => {
        await supabaseAdmin
          .from('bracket_matches')
          .update({ [updateField]: loserId })
          .eq('id', match.loser_next_match_id!)
      })()
    )
  }

  await Promise.all(postUpdateTasks)

  // 결승/3·4위전 결과 입력 시 대회 자동 완료 체크 + 입상 기록 자동 생성
  // partial 저장(winnerId null)일 때는 우승 처리 보류
  if (!isPartial && (match.phase === 'FINAL' || match.phase === 'THIRD_PLACE')) {
    await checkAndCompleteTournament(supabaseAdmin, match.bracket_config_id)
    await createAwardRecords(supabaseAdmin, {
      phase: match.phase,
      bracketConfigId: match.bracket_config_id,
      winnerId,
      loserId,
    })
  }

  return { winnerId }
}

/**
 * 관리자 경기 결과 입력 (기존 — MANAGER 이상 권한 필요)
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

  // 마감된 대회 검증
  const closedCheck = await checkTournamentNotClosedByMatchId(matchId)
  if (closedCheck.error) return { error: closedCheck.error }

  const score1Error = validateNonNegativeInteger(team1Score, '팀1 점수')
  if (score1Error) return { error: score1Error }

  const score2Error = validateNonNegativeInteger(team2Score, '팀2 점수')
  if (score2Error) return { error: score2Error }

  // 동점/0-0은 partial 저장으로 처리 (선수만 등록 등) — 거부하지 않음

  const supabaseAdmin = createAdminClient()
  const result = await updateMatchResultCore(supabaseAdmin, matchId, team1Score, team2Score, setsDetail)
  if (result.error) return { error: result.error }

  // 알림: winner가 결정된 경우에만 양측 참가자에게 결과 알림 (partial은 알림 생략)
  if (!result.winnerId) {
    revalidatePath('/admin/tournaments')
    revalidatePath('/tournaments')
    return { data: { winnerId: null }, error: null }
  }
  try {
    const { data: matchData } = await supabaseAdmin
      .from('bracket_matches')
      .select('team1_entry_id, team2_entry_id, bracket_config_id')
      .eq('id', matchId)
      .single()
    if (matchData) {
      const entryIds = [matchData.team1_entry_id, matchData.team2_entry_id].filter(Boolean) as string[]
      if (entryIds.length > 0) {
        const { data: entries } = await supabaseAdmin
          .from('tournament_entries')
          .select('user_id, tournament_id')
          .in('id', entryIds)
        const userIds = [...new Set((entries ?? []).map(e => e.user_id).filter(Boolean))] as string[]
        const tournamentId = entries?.[0]?.tournament_id
        if (userIds.length > 0) {
          await createBulkNotifications({
            user_ids: userIds,
            type: NotificationType.MATCH_RESULT_UPDATED,
            title: '경기 결과 확정',
            message: `경기 결과: ${team1Score} - ${team2Score}`,
            tournament_id: tournamentId ?? null,
            match_id: matchId,
            metadata: { link: tournamentId ? `/tournaments/${tournamentId}` : undefined },
          })
        }
      }
    }
  } catch { /* 알림 실패가 메인 기능을 막지 않음 */ }

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return { data: { winnerId: result.winnerId }, error: null }
}

/**
 * 관리자 — 점수 없이 승자 직접 지정
 * 기권/노쇼 등 점수 없이 결과만 확정해야 할 때 사용
 */
export async function setMatchWinner(matchId: string, winnerEntryId: string) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(matchId, '경기 ID') || validateId(winnerEntryId, '승자 entry ID')
  if (idError) return { error: idError }

  const closedCheck = await checkTournamentNotClosedByMatchId(matchId)
  if (closedCheck.error) return { error: closedCheck.error }

  const supabaseAdmin = createAdminClient()

  // winner가 이 경기 참가팀 중 하나인지 검증
  const { data: match } = await supabaseAdmin
    .from('bracket_matches')
    .select('team1_entry_id, team2_entry_id')
    .eq('id', matchId)
    .single()
  if (!match) return { error: '경기를 찾을 수 없습니다.' }
  if (winnerEntryId !== match.team1_entry_id && winnerEntryId !== match.team2_entry_id) {
    return { error: '승자는 이 경기에 참가한 팀 중 하나여야 합니다.' }
  }

  // 점수 없이 winner 지정 — score 인자(0,0)는 무시되고 winnerOverride로 대체
  const result = await updateMatchResultCore(supabaseAdmin, matchId, 0, 0, undefined, winnerEntryId)
  if (result.error) return { error: result.error }

  // 알림: 양 팀에 결과 지정 안내
  try {
    const entryIds = [match.team1_entry_id, match.team2_entry_id].filter(Boolean) as string[]
    if (entryIds.length > 0) {
      const { data: entries } = await supabaseAdmin
        .from('tournament_entries')
        .select('user_id, tournament_id')
        .in('id', entryIds)
      const userIds = [...new Set((entries ?? []).map(e => e.user_id).filter(Boolean))] as string[]
      const tournamentId = entries?.[0]?.tournament_id
      if (userIds.length > 0) {
        await createBulkNotifications({
          user_ids: userIds,
          type: NotificationType.MATCH_RESULT_UPDATED,
          title: '경기 결과 확정',
          message: '관리자가 경기 결과를 지정했습니다.',
          tournament_id: tournamentId ?? null,
          match_id: matchId,
          metadata: { link: tournamentId ? `/tournaments/${tournamentId}` : undefined },
        })
      }
    }
  } catch { /* 알림 실패가 메인 기능을 막지 않음 */ }

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return { data: { winnerId: result.winnerId }, error: null }
}

/**
 * 선수 본인 경기 점수 입력
 * 관리자 권한 불필요 — 본인 경기만 입력 가능
 */
export async function submitPlayerScore(
  matchId: string,
  team1Score: number,
  team2Score: number,
  setsDetail?: SetDetail[]
) {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const idError = validateId(matchId, '경기 ID')
  if (idError) return { error: idError }

  // 마감된 대회 검증
  const closedCheck = await checkTournamentNotClosedByMatchId(matchId)
  if (closedCheck.error) return { error: closedCheck.error }

  const score1Error = validateNonNegativeInteger(team1Score, '팀1 점수')
  if (score1Error) return { error: score1Error }

  const score2Error = validateNonNegativeInteger(team2Score, '팀2 점수')
  if (score2Error) return { error: score2Error }

  // 동점/0-0은 partial 저장으로 처리 (한 게임만 진행 / 선수만 등록 등)

  const supabaseAdmin = createAdminClient()

  // match + config + tournament 상태/조직자 를 1 JOIN 쿼리로 조회
  // entries (본인 경기 검증), profile (관리자 검증) 병렬 실행
  const [matchResult, entriesResult, profileResult] = await Promise.all([
    supabaseAdmin
      .from('bracket_matches')
      .select(`
        id, status, phase, round_number, team1_entry_id, team2_entry_id, bracket_config_id,
        bracket_configs!inner(
          active_phase,
          active_round,
          tournament_divisions!inner(tournaments!inner(status, organizer_id))
        )
      `)
      .eq('id', matchId)
      .single(),
    supabaseAdmin
      .from('tournament_entries')
      .select('id')
      .eq('user_id', user.id),
    supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ])

  if (matchResult.error || !matchResult.data) {
    return { error: '경기 정보를 찾을 수 없습니다.' }
  }
  const match = matchResult.data

  // JOIN으로 가져온 bracket_config + tournament 정보
  type BracketConfigJoin = {
    active_phase: string | null
    active_round: number | null
    tournament_divisions: { tournaments: { status: string; organizer_id: string | null } }
  }
  const cfg = match.bracket_configs as unknown as BracketConfigJoin
  const tournamentStatus = cfg?.tournament_divisions?.tournaments?.status
  const organizerId = cfg?.tournament_divisions?.tournaments?.organizer_id

  // 마감 대회 검증
  if (tournamentStatus && CLOSED_TOURNAMENT_STATUSES.includes(tournamentStatus as TournamentStatus)) {
    return { error: '마감된 대회의 대진표는 수정할 수 없습니다.' }
  }

  // 본인 경기 확인 (참가자 권한 분기용)
  const myEntryIds = (entriesResult.data || []).map(e => e.id)
  const isMyMatch = myEntryIds.includes(match.team1_entry_id ?? '') || myEntryIds.includes(match.team2_entry_id ?? '')

  // 대회 관리 권한 확인:
  // - SUPER_ADMIN/ADMIN: 모든 대회
  // - MANAGER: 본인이 만든 대회만
  // 관리자는 active_phase 검증과 본인 경기 검증을 모두 우회 (admin 페이지와 동일 권한)
  const role = profileResult.data?.role
  const isAdminLevel = role === 'ADMIN' || role === 'SUPER_ADMIN'
  const isOrganizerManager = role === 'MANAGER' && organizerId === user.id
  const canManageThisTournament = isAdminLevel || isOrganizerManager

  if (!canManageThisTournament) {
    // 일반 사용자: active_phase 검증
    const { active_phase, active_round } = cfg ?? {}
    if (!active_phase) {
      return { error: '현재 점수 입력이 활성화된 라운드가 없습니다.' }
    }
    if (active_phase !== match.phase) {
      return { error: '현재 활성화된 페이즈의 경기가 아닙니다.' }
    }
    if (active_phase === 'MAIN' && active_round !== null && match.round_number !== active_round) {
      return { error: '현재 활성화된 라운드의 경기가 아닙니다.' }
    }
  }

  // SCHEDULED 또는 COMPLETED 상태에서만 입력/수정 가능
  if (match.status !== 'SCHEDULED' && match.status !== 'COMPLETED') {
    return { error: '점수를 입력할 수 없는 경기 상태입니다.' }
  }

  if (!canManageThisTournament && !isMyMatch) {
    return { error: '본인이 참가한 경기만 점수를 입력할 수 있습니다.' }
  }

  // 점수 저장 + 승자 전파 (공유 로직)
  const result = await updateMatchResultCore(supabaseAdmin, matchId, team1Score, team2Score, setsDetail)
  if (result.error) return { error: result.error }

  // partial 저장이면 알림 생략 (winner 결정될 때만 결과 알림)
  if (!result.winnerId) {
    revalidatePath('/tournaments')
    return { data: { winnerId: null }, error: null }
  }

  // 알림: 본인 입력 시 상대방, 관리자 입력 시 양 팀 모두에게 알림
  try {
    const notifyEntryIds = canManageThisTournament
      ? [match.team1_entry_id, match.team2_entry_id].filter((id): id is string => !!id)
      : (() => {
          const opponentId = myEntryIds.includes(match.team1_entry_id ?? '')
            ? match.team2_entry_id
            : match.team1_entry_id
          return opponentId ? [opponentId] : []
        })()

    if (notifyEntryIds.length > 0) {
      const { data: notifyEntries } = await supabaseAdmin
        .from('tournament_entries')
        .select('user_id, tournament_id')
        .in('id', notifyEntryIds)
      for (const entry of notifyEntries ?? []) {
        if (!entry.user_id) continue
        await createNotification({
          user_id: entry.user_id,
          type: NotificationType.MATCH_RESULT_UPDATED,
          title: '경기 결과 입력',
          message: `경기 결과: ${team1Score} - ${team2Score}`,
          tournament_id: entry.tournament_id,
          match_id: matchId,
          metadata: { link: entry.tournament_id ? `/tournaments/${entry.tournament_id}` : undefined },
        })
      }
    }
  } catch { /* 알림 실패가 메인 기능을 막지 않음 */ }

  revalidatePath('/tournaments')
  return { data: { winnerId: result.winnerId }, error: null }
}

/**
 * 선수의 대회 참가 entry ID 목록 조회
 * 대진표 페이지에서 본인 경기 하이라이트용
 */
export async function getPlayerEntryIds(tournamentId: string) {
  const user = await getCurrentUser()
  if (!user) return { entryIds: [] }

  const idError = validateId(tournamentId, '대회 ID')
  if (idError) return { entryIds: [] }

  const supabase = await createClient()
  const { data: entries } = await supabase
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', user.id)
    .eq('status', 'CONFIRMED')

  return { entryIds: entries?.map(e => e.id) || [] }
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

  // 각 팀마다 다른 값이므로 배치 upsert 불가 — 그러나 순서 의존성 없으므로 병렬 실행
  await Promise.all(
    ranked.map((team, i) =>
      supabaseAdmin
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
    )
  )
}

// ============================================================================
// 자동 BYE 전파
// ============================================================================

/**
 * 한 팀만 배정되고 상대 피더가 빈 슬롯(양 팀 없음)이면 자동 부전승 처리
 * 재귀적으로 다음 라운드까지 전파
 */
async function propagateByeIfNeeded(
  supabaseAdmin: ReturnType<typeof createAdminClient>,
  matchId: string
): Promise<void> {
  const { data: match } = await supabaseAdmin
    .from('bracket_matches')
    .select('id, team1_entry_id, team2_entry_id, next_match_id, next_match_slot, status')
    .eq('id', matchId)
    .single()

  if (!match || match.status !== 'SCHEDULED') return

  const hasTeam1 = !!match.team1_entry_id
  const hasTeam2 = !!match.team2_entry_id

  // 양 팀 모두 있거나 모두 없으면 BYE 아님
  if (hasTeam1 === hasTeam2) return

  // 비어있는 슬롯의 피더 매치 확인
  const emptySlot = hasTeam1 ? 2 : 1
  const { data: feeder } = await supabaseAdmin
    .from('bracket_matches')
    .select('id, team1_entry_id, team2_entry_id')
    .eq('next_match_id', matchId)
    .eq('next_match_slot', emptySlot)
    .single()

  // 피더가 없거나 빈 슬롯(양 팀 없음)이면 → 상대가 올 수 없으므로 BYE
  const feederIsEmpty = !feeder || (!feeder.team1_entry_id && !feeder.team2_entry_id)
  if (!feederIsEmpty) return

  const soloTeamId = hasTeam1 ? match.team1_entry_id : match.team2_entry_id

  // BYE 처리
  await supabaseAdmin
    .from('bracket_matches')
    .update({
      winner_entry_id: soloTeamId,
      status: 'BYE',
    })
    .eq('id', matchId)

  // 다음 경기에 승자 배정 + 재귀 전파
  if (match.next_match_id && match.next_match_slot) {
    const field = match.next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
    await supabaseAdmin
      .from('bracket_matches')
      .update({ [field]: soloTeamId })
      .eq('id', match.next_match_id)

    await propagateByeIfNeeded(supabaseAdmin, match.next_match_id)
  }
}

// ============================================================================
// 예선 진출팀 조회 (본선 시드 배치 미리보기용)
// ============================================================================

/** 진출팀 정보 */
export interface AdvancingTeam {
  entryId: string
  seed: number
  groupName: string
  groupRank: number
  entry?: {
    id: string
    player_name: string
    club_name: string | null
    team_order: string | null
    partner_data: { name: string; rating: number; club: string | null } | null
    team_members: { name: string; rating: number }[] | null
    applicant_participates: boolean
  }
}

/**
 * 예선 결과에서 본선 진출팀 추출 (읽기 전용 — auth 불필요)
 * 1위 → 2위 순 크로스 시드 배치
 * allPrelimsDone: 모든 예선 경기가 COMPLETED/BYE인지
 */
export async function getAdvancingTeams(configId: string): Promise<{
  data: { teams: AdvancingTeam[]; allPrelimsDone: boolean } | null
  error: string | null
}> {
  const idError = validateId(configId, '설정 ID')
  if (idError) return { data: null, error: idError }

  const supabase = await createClient()

  // 예선 경기 완료 여부 확인
  const { data: prelimMatches } = await supabase
    .from('bracket_matches')
    .select('id, status')
    .eq('bracket_config_id', configId)
    .eq('phase', 'PRELIMINARY')

  const allPrelimsDone = !!prelimMatches && prelimMatches.length > 0 &&
    prelimMatches.every(m => m.status === 'COMPLETED' || m.status === 'BYE')

  // 조별 진출팀 추출
  const { data: groups } = await supabase
    .from('preliminary_groups')
    .select(`
      *,
      group_teams (
        *,
        entry:tournament_entries (id, player_name, club_name, team_order, partner_data, team_members, applicant_participates)
      )
    `)
    .eq('bracket_config_id', configId)
    .order('display_order', { ascending: true })
    .order('seed_number', { ascending: true, referencedTable: 'group_teams' })

  if (!groups || groups.length === 0) {
    return { data: { teams: [], allPrelimsDone }, error: null }
  }

  let seedNumber = 1
  const firstPlaceTeams: AdvancingTeam[] = []
  const secondPlaceTeams: AdvancingTeam[] = []

  for (const group of groups) {
    const teams = (group.group_teams || [])
      .filter((t: { final_rank: number | null }) => t.final_rank)
      .sort((a: { final_rank: number }, b: { final_rank: number }) => a.final_rank - b.final_rank)

    if (teams[0]) {
      firstPlaceTeams.push({
        entryId: teams[0].entry_id,
        seed: 0, // 나중에 재배정
        groupName: group.name,
        groupRank: 1,
        entry: teams[0].entry,
      })
    }
    if (teams[1]) {
      secondPlaceTeams.push({
        entryId: teams[1].entry_id,
        seed: 0,
        groupName: group.name,
        groupRank: 2,
        entry: teams[1].entry,
      })
    }
  }

  // 1위 → 2위 크로스 시드
  const allTeams: AdvancingTeam[] = []
  for (const team of firstPlaceTeams) {
    allTeams.push({ ...team, seed: seedNumber++ })
  }
  for (const team of secondPlaceTeams) {
    allTeams.push({ ...team, seed: seedNumber++ })
  }

  return { data: { teams: allTeams, allPrelimsDone }, error: null }
}

// ============================================================================
// 다음 라운드 팀 조회 (라운드별 순차 생성용)
// ============================================================================

/**
 * 다음 라운드에 배정할 팀 목록 조회 (범용)
 * - 본선 매치 없음 → 예선 진출팀 (1R용)
 * - 결승 존재 → isComplete=true
 * - 최신 라운드 미완료 → allDone=false
 * - 최신 라운드 완료 → 승자 목록 반환
 */
export async function getNextRoundTeams(configId: string): Promise<{
  data?: {
    teams: AdvancingTeam[]
    allDone: boolean
    nextRound: number
    nextPhase: MatchPhase
    isComplete: boolean
  }
  error?: string
}> {
  const idError = validateId(configId, '설정 ID')
  if (idError) return { error: idError }

  const supabase = await createClient()

  // 본선 매치 조회 (PRELIMINARY 제외)
  const { data: allNonPrelimMatches } = await supabase
    .from('bracket_matches')
    .select('id, phase, round_number, bracket_position, status, winner_entry_id, team1_entry_id, team2_entry_id')
    .eq('bracket_config_id', configId)
    .neq('phase', 'PRELIMINARY')
    .order('round_number', { ascending: true })
    .order('bracket_position', { ascending: true })

  // THIRD_PLACE 제외한 본선 매치
  const mainMatches = (allNonPrelimMatches || []).filter(m => m.phase !== 'THIRD_PLACE')

  // 매치 없음 → 1R (기존 getAdvancingTeams 로직 위임)
  if (mainMatches.length === 0) {
    const { data: advData, error: advError } = await getAdvancingTeams(configId)
    if (advError) return { error: advError }

    if (!advData || advData.teams.length === 0) {
      return {
        data: {
          teams: advData?.teams || [],
          allDone: advData?.allPrelimsDone ?? false,
          nextRound: 1,
          nextPhase: 'ROUND_128', // 팀이 없으면 의미 없음
          isComplete: false,
        },
      }
    }

    const bracketSize = calculateBracketSize(advData.teams.length)
    const nextPhase = getPhaseForRound(bracketSize, 1)
    return {
      data: {
        teams: advData.teams,
        allDone: advData.allPrelimsDone,
        nextRound: 1,
        nextPhase,
        isComplete: false,
      },
    }
  }

  // config 조회 (bracket_size 필요)
  const { data: config } = await supabase
    .from('bracket_configs')
    .select('bracket_size')
    .eq('id', configId)
    .single()

  if (!config?.bracket_size) {
    return { error: '대진표 크기 정보를 찾을 수 없습니다.' }
  }

  const bracketSize = config.bracket_size
  const totalRounds = Math.log2(bracketSize)

  // 결승 존재 → 모든 라운드 생성 완료
  const hasFinal = mainMatches.some(m => m.phase === 'FINAL')
  if (hasFinal) {
    return {
      data: {
        teams: [],
        allDone: true,
        nextRound: totalRounds,
        nextPhase: 'FINAL',
        isComplete: true,
      },
    }
  }

  // 최신 라운드 확인
  const maxRound = Math.max(...mainMatches.map(m => m.round_number ?? 0))
  const latestRoundMatches = mainMatches.filter(m => m.round_number === maxRound)
  // 빈 매치(양팀 미배정)도 "완료"로 간주 — 대진할 팀이 없으면 진행 불필요
  const allDone = latestRoundMatches.every(
    m => m.status === 'COMPLETED' || m.status === 'BYE' ||
      (!m.team1_entry_id && !m.team2_entry_id),
  )

  const nextRound = maxRound + 1
  const nextPhase = nextRound <= totalRounds
    ? getPhaseForRound(bracketSize, nextRound)
    : 'FINAL'

  if (!allDone) {
    return {
      data: { teams: [], allDone: false, nextRound, nextPhase, isComplete: false },
    }
  }

  // 승자 목록 추출 (bracket_position 순)
  const winnerIds = latestRoundMatches
    .sort((a, b) => (a.bracket_position ?? 0) - (b.bracket_position ?? 0))
    .map(m => m.winner_entry_id)
    .filter((id): id is string => id !== null)

  // 승자 엔트리 정보 JOIN
  const { data: entries } = await supabase
    .from('tournament_entries')
    .select('id, player_name, club_name, team_order, partner_data, team_members, applicant_participates')
    .in('id', winnerIds)

  const entryMap = new Map(entries?.map(e => [e.id, e]) || [])

  const teams: AdvancingTeam[] = winnerIds.map((entryId, i) => ({
    entryId,
    seed: i + 1,
    groupName: '',
    groupRank: 0,
    entry: entryMap.get(entryId) || undefined,
  }))

  return {
    data: { teams, allDone: true, nextRound, nextPhase, isComplete: false },
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
export async function generateMainBracket(configId: string, divisionId: string, seedOrder?: (string | null)[]) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(configId, '설정 ID') || validateId(divisionId, '부서 ID')
  if (idError) return { error: idError }

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { error: closedCheck.error }

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

  if (seedOrder && seedOrder.length > 0) {
    // 관리자가 지정한 시드 순서 (그룹별 2팀씩, null=BYE 슬롯)
    // bracketSize 계산용으로 실제 팀만 추출
    const validEntries = seedOrder.filter((id): id is string => id !== null)
    advancingTeams = validEntries.map((entryId, i) => ({ entryId, seed: i + 1 }))
  } else if (config.has_preliminaries) {
    // 예선 결과에서 진출팀 추출 (기존 자동 로직)
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

  // seedOrder가 있으면 그룹 구조(2팀씩 페어링)를 직접 사용
  // seedOrder가 없으면 advancingTeams 순서대로 매칭
  for (let i = 0; i < firstRoundMatches.length; i++) {
    const matchId = firstRoundMatches[i]

    let team1EntryId: string | null
    let team2EntryId: string | null

    if (seedOrder && seedOrder.length > 0) {
      // seedOrder: 그룹별 [team1, team2] 순서 → 인덱스 i*2, i*2+1이 한 매치
      team1EntryId = seedOrder[i * 2] ?? null
      team2EntryId = seedOrder[i * 2 + 1] ?? null
    } else {
      team1EntryId = advancingTeams[i * 2]?.entryId ?? null
      team2EntryId = advancingTeams[i * 2 + 1]?.entryId ?? null
    }

    if (team1EntryId && team2EntryId) {
      // 둘 다 있으면 경기 진행
      await supabaseAdmin
        .from('bracket_matches')
        .update({
          team1_entry_id: team1EntryId,
          team2_entry_id: team2EntryId,
        })
        .eq('id', matchId)
    } else if (team1EntryId || team2EntryId) {
      // 한 쪽만 있으면 부전승
      const presentEntryId = team1EntryId || team2EntryId

      const { data: matchData } = await supabaseAdmin
        .from('bracket_matches')
        .select('next_match_id, next_match_slot')
        .eq('id', matchId)
        .single()

      await supabaseAdmin
        .from('bracket_matches')
        .update({
          team1_entry_id: presentEntryId,
          winner_entry_id: presentEntryId,
          status: 'BYE',
        })
        .eq('id', matchId)

      // 다음 경기에 바로 배정
      if (matchData?.next_match_id && matchData?.next_match_slot) {
        const field = matchData.next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
        await supabaseAdmin
          .from('bracket_matches')
          .update({ [field]: presentEntryId })
          .eq('id', matchData.next_match_id)
      }
    }
    // 둘 다 null이면 빈 매치 — 배정 없이 건너뜀
  }

  // 2라운드부터 자동 BYE 전파 (빈 슬롯으로 인한 부전승 처리)
  for (let round = 2; round <= totalRounds; round++) {
    const roundMatchIds = matchesByRound.get(round) || []
    for (const mId of roundMatchIds) {
      await propagateByeIfNeeded(supabaseAdmin, mId)
    }
  }

  // 대진표 설정 업데이트
  await supabaseAdmin
    .from('bracket_configs')
    .update({ bracket_size: bracketSize, status: 'MAIN' })
    .eq('id', configId)

  // 알림: 해당 부서 참가자 전원에게 대진표 생성 알림
  try {
    const { data: division } = await supabaseAdmin
      .from('tournament_divisions')
      .select('tournament_id')
      .eq('id', divisionId)
      .single()
    if (division) {
      const { data: entries } = await supabaseAdmin
        .from('tournament_entries')
        .select('user_id')
        .eq('division_id', divisionId)
        .neq('status', 'CANCELLED')
      const userIds = [...new Set((entries ?? []).map(e => e.user_id).filter(Boolean))] as string[]
      if (userIds.length > 0) {
        await createBulkNotifications({
          user_ids: userIds,
          type: NotificationType.BRACKET_GENERATED,
          title: '대진표 생성',
          message: '본선 대진표가 생성되었습니다.',
          tournament_id: division.tournament_id,
          metadata: { link: `/tournaments/${division.tournament_id}` },
        })
      }
    }
  } catch { /* 알림 실패가 메인 기능을 막지 않음 */ }

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return { data: { bracketSize, teamCount, matchCount: matchNumber - 1 }, error: null }
}

/**
 * 본선 대진표 라운드별 순차 생성
 * 1R: bracketSize 계산 + 매치 생성 + 팀 배정
 * 2R+: 이전 라운드 승자로 매치 생성 + next_match_id 역방향 링크
 */
export async function generateNextRound(
  configId: string,
  divisionId: string,
  seedOrder: (string | null)[],
) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(configId, '설정 ID') || validateId(divisionId, '부서 ID')
  if (idError) return { error: idError }

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { error: closedCheck.error }

  const supabaseAdmin = createAdminClient()

  // 대진표 설정 조회
  const { data: config } = await supabaseAdmin
    .from('bracket_configs')
    .select('*')
    .eq('id', configId)
    .single()

  if (!config) return { error: '대진표 설정을 찾을 수 없습니다.' }

  // 기존 본선 매치 조회 (PRELIMINARY, THIRD_PLACE 제외)
  const { data: allNonPrelimMatches } = await supabaseAdmin
    .from('bracket_matches')
    .select('*')
    .eq('bracket_config_id', configId)
    .neq('phase', 'PRELIMINARY')
    .order('round_number', { ascending: true })
    .order('bracket_position', { ascending: true })

  const existingMainMatches = (allNonPrelimMatches || []).filter(
    m => m.phase !== 'THIRD_PLACE',
  )

  let targetRound: number
  let bracketSize: number
  let totalRounds: number

  if (existingMainMatches.length === 0) {
    // 1R 생성
    const validEntries = seedOrder.filter((id): id is string => id !== null)
    if (validEntries.length < 2) return { error: '최소 2팀 이상이 필요합니다.' }

    bracketSize = calculateBracketSize(validEntries.length)
    totalRounds = Math.log2(bracketSize)
    targetRound = 1
  } else {
    // N+1R 생성
    if (!config.bracket_size) return { error: '대진표 크기 정보를 찾을 수 없습니다.' }
    bracketSize = config.bracket_size
    totalRounds = Math.log2(bracketSize)

    const maxRound = Math.max(...existingMainMatches.map(m => m.round_number ?? 0))

    // 현재 라운드 미완료 체크 (빈 매치는 완료로 간주)
    const latestMatches = existingMainMatches.filter(m => m.round_number === maxRound)
    const allDone = latestMatches.every(
      m => m.status === 'COMPLETED' || m.status === 'BYE' ||
        (!m.team1_entry_id && !m.team2_entry_id),
    )
    if (!allDone) return { error: '현재 라운드의 모든 경기가 완료되어야 합니다.' }

    targetRound = maxRound + 1
    if (targetRound > totalRounds) return { error: '모든 라운드가 이미 생성되었습니다.' }
  }

  const phase = getPhaseForRound(bracketSize, targetRound)
  const matchesInRound = Math.pow(2, totalRounds - targetRound)
  const isFinalRound = targetRound === totalRounds

  // match_number 이어가기
  let matchNumber: number
  if (allNonPrelimMatches && allNonPrelimMatches.length > 0) {
    const maxMatchNum = Math.max(...allNonPrelimMatches.map(m => m.match_number ?? 0))
    matchNumber = maxMatchNum + 1
  } else {
    matchNumber = 1
  }

  // 해당 라운드 매치 생성
  const newMatchIds: string[] = []
  for (let pos = 0; pos < matchesInRound; pos++) {
    const { data: match } = await supabaseAdmin
      .from('bracket_matches')
      .insert({
        bracket_config_id: configId,
        phase: isFinalRound ? 'FINAL' : phase,
        round_number: targetRound,
        bracket_position: pos + 1,
        match_number: matchNumber++,
        status: 'SCHEDULED',
      })
      .select()
      .single()

    if (match) newMatchIds.push(match.id)
  }

  // 3/4위전 (결승 라운드 + config.third_place_match)
  let thirdPlaceMatchId: string | null = null
  if (isFinalRound && config.third_place_match) {
    const { data: thirdPlace } = await supabaseAdmin
      .from('bracket_matches')
      .insert({
        bracket_config_id: configId,
        phase: 'THIRD_PLACE',
        round_number: targetRound,
        bracket_position: 0,
        match_number: matchNumber++,
        status: 'SCHEDULED',
      })
      .select()
      .single()

    thirdPlaceMatchId = thirdPlace?.id ?? null
  }

  // 팀 배정 (seedOrder 기반)
  for (let i = 0; i < newMatchIds.length; i++) {
    const matchId = newMatchIds[i]
    const team1EntryId = seedOrder[i * 2] ?? null
    const team2EntryId = seedOrder[i * 2 + 1] ?? null

    if (team1EntryId && team2EntryId) {
      await supabaseAdmin
        .from('bracket_matches')
        .update({
          team1_entry_id: team1EntryId,
          team2_entry_id: team2EntryId,
        })
        .eq('id', matchId)
    } else if (team1EntryId || team2EntryId) {
      // BYE 처리
      const presentEntryId = team1EntryId || team2EntryId
      await supabaseAdmin
        .from('bracket_matches')
        .update({
          team1_entry_id: presentEntryId,
          winner_entry_id: presentEntryId,
          status: 'BYE',
        })
        .eq('id', matchId)
    }
    // 양쪽 null이면 빈 매치 — 건너뜀
  }

  // 이전 라운드 매치에 next_match_id 역방향 링크 설정 (2R+)
  if (targetRound > 1) {
    const prevRoundMatches = existingMainMatches.filter(
      m => m.round_number === targetRound - 1,
    )

    for (let i = 0; i < newMatchIds.length; i++) {
      const currentMatchId = newMatchIds[i]
      const team1EntryId = seedOrder[i * 2] ?? null
      const team2EntryId = seedOrder[i * 2 + 1] ?? null

      // team1의 출처 매치 찾아서 next_match_id 설정
      if (team1EntryId) {
        const sourceMatch = prevRoundMatches.find(m => m.winner_entry_id === team1EntryId)
        if (sourceMatch) {
          await supabaseAdmin
            .from('bracket_matches')
            .update({ next_match_id: currentMatchId, next_match_slot: 1 })
            .eq('id', sourceMatch.id)
        }
      }

      // team2의 출처 매치
      if (team2EntryId) {
        const sourceMatch = prevRoundMatches.find(m => m.winner_entry_id === team2EntryId)
        if (sourceMatch) {
          await supabaseAdmin
            .from('bracket_matches')
            .update({ next_match_id: currentMatchId, next_match_slot: 2 })
            .eq('id', sourceMatch.id)
        }
      }
    }

    // 결승 라운드: 준결승 패자 → 3/4위전 링크
    if (isFinalRound && thirdPlaceMatchId) {
      const semiMatches = prevRoundMatches
        .sort((a, b) => (a.bracket_position ?? 0) - (b.bracket_position ?? 0))

      for (let i = 0; i < semiMatches.length; i++) {
        const semi = semiMatches[i]
        await supabaseAdmin
          .from('bracket_matches')
          .update({
            loser_next_match_id: thirdPlaceMatchId,
            loser_next_match_slot: i + 1,
          })
          .eq('id', semi.id)

        // 준결승이 이미 완료된 경우 패자를 3/4위전에 즉시 배정
        if (semi.winner_entry_id) {
          const loserId =
            semi.winner_entry_id === semi.team1_entry_id
              ? semi.team2_entry_id
              : semi.team1_entry_id
          if (loserId) {
            const slot = i + 1
            const updateField = slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
            await supabaseAdmin
              .from('bracket_matches')
              .update({ [updateField]: loserId })
              .eq('id', thirdPlaceMatchId)
          }
        }
      }
    }
  }

  // config 업데이트 (1R만: bracket_size, status)
  if (targetRound === 1) {
    await supabaseAdmin
      .from('bracket_configs')
      .update({ bracket_size: bracketSize, status: 'MAIN' })
      .eq('id', configId)

  }

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return {
    data: { bracketSize, targetRound, matchCount: newMatchIds.length },
    error: null,
  }
}

/**
 * 최신 라운드 삭제 (이전 라운드의 next_match_id 초기화)
 */
export async function deleteLatestRound(configId: string) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { success: false, error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { success: false, error: idError }

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { success: false, error: closedCheck.error }

  const supabaseAdmin = createAdminClient()

  // 본선 매치 전체 조회 (PRELIMINARY 제외)
  const { data: allMainMatches } = await supabaseAdmin
    .from('bracket_matches')
    .select('*')
    .eq('bracket_config_id', configId)
    .neq('phase', 'PRELIMINARY')
    .order('round_number', { ascending: true })
    .order('bracket_position', { ascending: true })

  if (!allMainMatches || allMainMatches.length === 0) {
    return { success: false, error: '삭제할 라운드가 없습니다.' }
  }

  // 최신 라운드 찾기 (THIRD_PLACE 제외하고 maxRound 계산)
  const nonThirdPlace = allMainMatches.filter(m => m.phase !== 'THIRD_PLACE')
  const maxRound = Math.max(...nonThirdPlace.map(m => m.round_number ?? 0))

  // 삭제 대상: 최신 라운드 매치 + 같은 라운드의 THIRD_PLACE
  const toDelete = allMainMatches.filter(
    m => m.round_number === maxRound,
  )
  const deleteIds = toDelete.map(m => m.id)

  // 이전 라운드 매치의 next_match_id, loser_next_match_id 초기화
  const prevRoundMatches = allMainMatches.filter(
    m => m.round_number === maxRound - 1 && m.phase !== 'THIRD_PLACE',
  )

  for (const match of prevRoundMatches) {
    const updates: Record<string, unknown> = {}

    if (match.next_match_id && deleteIds.includes(match.next_match_id)) {
      updates.next_match_id = null
      updates.next_match_slot = null
    }
    if (match.loser_next_match_id && deleteIds.includes(match.loser_next_match_id)) {
      updates.loser_next_match_id = null
      updates.loser_next_match_slot = null
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from('bracket_matches')
        .update(updates)
        .eq('id', match.id)
    }
  }

  // 매치 삭제
  const { error: deleteError } = await supabaseAdmin
    .from('bracket_matches')
    .delete()
    .in('id', deleteIds)

  if (deleteError) return { success: false, error: deleteError.message }

  // 결승 라운드가 포함된 경우 어워드 정리 (stale 레코드 방지)
  const hasFinalsDeleted = toDelete.some(m => m.phase === 'FINAL' || m.phase === 'THIRD_PLACE')
  if (hasFinalsDeleted) {
    await deleteAwardsForConfig(supabaseAdmin, configId)
  }

  // 모든 본선 매치가 삭제되면 config 초기화
  const remainingCount = allMainMatches.length - deleteIds.length
  if (remainingCount === 0) {
    await supabaseAdmin
      .from('bracket_configs')
      .update({ bracket_size: null, status: 'PRELIMINARY' })
      .eq('id', configId)
  }

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return { success: true }
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
      team1:tournament_entries!bracket_matches_team1_entry_id_fkey (id, player_name, club_name, team_order, partner_data, team_members, applicant_participates),
      team2:tournament_entries!bracket_matches_team2_entry_id_fkey (id, player_name, club_name, team_order, partner_data, team_members, applicant_participates)
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

  // 조편성 + 경기를 병렬 조회 (직렬 → 병렬로 RTT 절약)
  const [groupsResult, matchesResult] = await Promise.all([
    // 조편성 — 예선 여부와 무관하게 항상 로드 (조편성 공개 탭용)
    supabase
      .from('preliminary_groups')
      .select(`
        *,
        group_teams (
          *,
          entry:tournament_entries (id, player_name, club_name, team_order, partner_data, team_members, applicant_participates)
        )
      `)
      .eq('bracket_config_id', config.id)
      .order('display_order', { ascending: true })
      .order('seed_number', { ascending: true, referencedTable: 'group_teams' }),
    // 모든 경기
    supabase
      .from('bracket_matches')
      .select(`
        *,
        team1:tournament_entries!bracket_matches_team1_entry_id_fkey (id, player_name, club_name, team_order, partner_data, team_members, applicant_participates),
        team2:tournament_entries!bracket_matches_team2_entry_id_fkey (id, player_name, club_name, team_order, partner_data, team_members, applicant_participates)
      `)
      .eq('bracket_config_id', config.id)
      .order('phase', { ascending: true })
      .order('match_number', { ascending: true }),
  ])

  return {
    config,
    groups: groupsResult.data ?? null,
    matches: matchesResult.data ?? null,
  }
}

/**
 * 예선 조 편성 삭제 (조 배정 및 예선 경기도 함께 삭제됨)
 */
export async function deletePreliminaryGroups(configId: string) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { success: false, error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { success: false, error: idError }

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { success: false, error: closedCheck.error }

  const supabaseAdmin = createAdminClient()

  try {
    // 예선 경기 먼저 삭제 (bracket_matches는 bracket_configs 참조이므로 CASCADE 없음)
    await supabaseAdmin
      .from('bracket_matches')
      .delete()
      .eq('bracket_config_id', configId)
      .eq('phase', 'PRELIMINARY')

    // 조편성 삭제 (group_teams는 FK CASCADE로 자동 삭제)
    const { error } = await supabaseAdmin
      .from('preliminary_groups')
      .delete()
      .eq('bracket_config_id', configId)

    if (error) {
      return { success: false, error: error.message }
    }

    // 조편성 전체 삭제 → 처음 상태로 복원
    await supabaseAdmin
      .from('bracket_configs')
      .update({ status: 'DRAFT' })
      .eq('id', configId)

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

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { success: false, error: closedCheck.error }

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

    // 예선 경기 삭제 → 조편성 단계로 복원
    await supabaseAdmin
      .from('bracket_configs')
      .update({ status: 'DRAFT' })
      .eq('id', configId)

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

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { success: false, error: closedCheck.error }

  const supabaseAdmin = createAdminClient()

  try {
    // has_preliminaries 조회 (복원 상태 결정용)
    const { data: configData } = await supabaseAdmin
      .from('bracket_configs')
      .select('has_preliminaries')
      .eq('id', configId)
      .single()

    const { error } = await supabaseAdmin
      .from('bracket_matches')
      .delete()
      .eq('bracket_config_id', configId)
      .neq('phase', 'PRELIMINARY')

    if (error) {
      return { success: false, error: error.message }
    }

    // 본선 전체 삭제 시 어워드도 정리
    await deleteAwardsForConfig(supabaseAdmin, configId)

    // 예선 있음 → PRELIMINARY(조편성·예선 유지), 예선 없음 → DRAFT
    const restoredStatus = configData?.has_preliminaries ? 'PRELIMINARY' : 'DRAFT'

    const { error: updateError } = await supabaseAdmin
      .from('bracket_configs')
      .update({
        bracket_size: null,
        status: restoredStatus,
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

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { success: false, error: closedCheck.error }

  const supabaseAdmin = createAdminClient()

  try {
    // 대진표 삭제 전 tournament_id 조회 (status 복원용)
    const { data: configRow } = await supabaseAdmin
      .from('bracket_configs')
      .select('division_id')
      .eq('id', configId)
      .single()

    // 해당 division의 tournament_awards 먼저 삭제
    if (configRow?.division_id) {
      const { data: divData } = await supabaseAdmin
        .from('tournament_divisions')
        .select('tournament_id')
        .eq('id', configRow.division_id)
        .single()

      if (divData?.tournament_id) {
        await supabaseAdmin
          .from('tournament_awards')
          .delete()
          .eq('tournament_id', divData.tournament_id)
          .eq('division_id', configRow.division_id)
      }
    }

    // CASCADE로 관련 데이터 자동 삭제됨
    const { error } = await supabaseAdmin
      .from('bracket_configs')
      .delete()
      .eq('id', configId)

    if (error) {
      return { success: false, error: error.message }
    }

    // 대회 상태는 크론(auto_transition_tournament_status)이 날짜 기반으로 관리
    // 대진표 삭제가 대회 상태를 변경하지 않음

    revalidatePath('/admin/tournaments')
    return { success: true }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '알 수 없는 오류'
    return { success: false, error: message }
  }
}

// ============================================================================
// 코트 정보 업데이트
// ============================================================================

export interface CourtInfoUpdate {
  matchId: string
  courtLocation: string | null
  courtNumber: string | null
}

/**
 * 경기 코트 정보 일괄 업데이트
 */
export async function batchUpdateMatchCourtInfo(updates: CourtInfoUpdate[]) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  if (updates.length === 0) return { error: null }

  for (const u of updates) {
    const idError = validateId(u.matchId, '경기 ID')
    if (idError) return { error: idError }
  }

  // 첫 번째 경기의 대회 상태로 마감 여부 확인
  const closedCheck = await checkTournamentNotClosedByMatchId(updates[0].matchId)
  if (closedCheck.error) return { error: closedCheck.error }

  const supabaseAdmin = createAdminClient()

  // 병렬 업데이트
  const results = await Promise.all(
    updates.map((u) =>
      supabaseAdmin
        .from('bracket_matches')
        .update({
          court_location: u.courtLocation?.trim() || null,
          court_number: u.courtNumber?.trim() || null,
        })
        .eq('id', u.matchId)
    )
  )

  const failed = results.find((r) => r.error)
  if (failed?.error) {
    return { error: '코트 정보 업데이트에 실패했습니다.' }
  }

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return { error: null }
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

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { error: closedCheck.error }

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
export async function autoFillMainBracketResults(configId: string, phase?: MatchPhase) {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { error: idError }

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { error: closedCheck.error }

  const supabaseAdmin = createAdminClient()

  // 단체전 여부 확인 + 엔트리 선수 목록 미리 조회
  const teamInfo = await getTeamMatchInfo(supabaseAdmin, configId)
  let entriesMap = new Map<string, string[]>()
  if (teamInfo.isTeamMatch && teamInfo.divisionId) {
    entriesMap = await buildEntriesMap(supabaseAdmin, teamInfo.divisionId)
  }

  let filledCount = 0

  // 특정 강(phase) 지정 시 해당 경기만, 미지정 시 전체 라운드 순차 처리
  const MAX_ITERATIONS = phase ? 1 : 10

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    // 양 팀이 배정된 SCHEDULED 본선 경기 조회 (라운드 순)
    let query = supabaseAdmin
      .from('bracket_matches')
      .select('*')
      .eq('bracket_config_id', configId)
      .neq('phase', 'PRELIMINARY')
      .eq('status', 'SCHEDULED')
      .not('team1_entry_id', 'is', null)
      .not('team2_entry_id', 'is', null)
      .order('round_number')
      .order('bracket_position')

    if (phase) {
      query = query.eq('phase', phase)
    }

    const { data: matches } = await query

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

        // 상대 피더가 빈 슬롯이면 자동 BYE 전파
        await propagateByeIfNeeded(supabaseAdmin, match.next_match_id)
      }

      // 패자를 3/4위전에 배정
      if (match.loser_next_match_id && match.loser_next_match_slot) {
        const field = match.loser_next_match_slot === 1 ? 'team1_entry_id' : 'team2_entry_id'
        await supabaseAdmin
          .from('bracket_matches')
          .update({ [field]: loserId })
          .eq('id', match.loser_next_match_id)
      }

      // FINAL/THIRD_PLACE 결과 시 입상 기록 자동 생성
      if (match.phase === 'FINAL' || match.phase === 'THIRD_PLACE') {
        await checkAndCompleteTournament(supabaseAdmin, match.bracket_config_id)
        await createAwardRecords(supabaseAdmin, {
          phase: match.phase as MatchPhase,
          bracketConfigId: match.bracket_config_id,
          winnerId: winnerId ?? null,
          loserId: loserId ?? null,
        })
      }

      filledCount++
    }
  }

  revalidatePath('/admin/tournaments')
  revalidatePath('/tournaments')
  return { data: { filledCount }, error: null }
}

// ============================================================================
// 경기 진행 라운드 관리
// ============================================================================

/**
 * 부서별 활성 라운드 설정/해제
 * - phase + round를 지정하면 해당 라운드 경기만 점수 입력 활성화
 * - phase=null이면 전체 비활성화 (토글 off)
 * - PRELIMINARY: active_round는 항상 null (예선 전체)
 * - MAIN: active_round로 특정 라운드 지정
 */
export async function setActiveRound(
  configId: string,
  phase: 'PRELIMINARY' | 'MAIN' | null,
  round: number | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { success: false, error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { success: false, error: idError }

  const closedCheck = await checkTournamentNotClosed(configId)
  if (closedCheck.error) return { success: false, error: closedCheck.error }

  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin
    .from('bracket_configs')
    .update({ active_phase: phase, active_round: round })
    .eq('id', configId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/tournaments')
  return { success: true }
}

/**
 * 대진표 단계별 공개/비공개 토글
 * @param field 공개 대상: 'publish_groups' | 'publish_preliminary' | 'publish_main'
 */
export async function toggleBracketPublish(
  configId: string,
  field: 'publish_groups' | 'publish_preliminary' | 'publish_main',
  publish: boolean,
): Promise<{ success: true } | { success: false; error: string }> {
  const authResult = await checkBracketManagementAuth()
  if (authResult.error) return { success: false, error: authResult.error }

  const idError = validateId(configId, '설정 ID')
  if (idError) return { success: false, error: idError }

  const supabaseAdmin = createAdminClient()

  const { error } = await supabaseAdmin
    .from('bracket_configs')
    .update({ [field]: publish, updated_at: new Date().toISOString() })
    .eq('id', configId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/admin/tournaments')
  return { success: true }
}
