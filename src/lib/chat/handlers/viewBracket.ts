import { createAdminClient } from '@/lib/supabase/admin'
import type { ChatEntities, HandlerResult } from '../types'

/** ILIKE 쿼리용 와일드카드 이스케이프 */
function escapeLike(value: string): string {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** 상태 한글 → DB enum 매핑 */
const STATUS_MAP: Record<string, string> = {
  '모집중': 'OPEN',
  '진행중': 'IN_PROGRESS',
  '완료': 'COMPLETED',
}

/** VIEW_BRACKET 핸들러 — 대진표 조회 (scope 분기) */
export async function handleViewBracket(
  entities: ChatEntities,
  userId?: string,
): Promise<HandlerResult> {
  // scope: "my" → 내 경기 일정
  if (entities.scope === 'my') {
    return handleMySchedule(userId)
  }

  return handleBracketAll(entities)
}

// ─── scope: "my" — 내 경기 일정 ─────────────────────

async function handleMySchedule(userId?: string): Promise<HandlerResult> {
  if (!userId) {
    return {
      success: false,
      message: '내 경기 일정을 보려면 로그인이 필요합니다.',
      links: [{ label: '로그인', href: '/auth/login' }],
    }
  }

  const admin = createAdminClient()

  // 1. 내 엔트리 ID 조회
  const { data: entries } = await admin
    .from('tournament_entries')
    .select('id, tournaments(id, title)')
    .eq('user_id', userId)
    .neq('status', 'CANCELLED')

  if (!entries || entries.length === 0) {
    return { success: true, message: '참가 중인 대회가 없습니다.' }
  }

  const entryIds = entries.map((e) => e.id)

  // 2. 예정·진행 중 경기 조회
  const { data: matches } = await admin
    .from('bracket_matches')
    .select(`
      round_number, match_number, status, phase, scheduled_time, court_number,
      entry1:team1_entry_id(id, player_name, club_name),
      entry2:team2_entry_id(id, player_name, club_name)
    `)
    .or(`team1_entry_id.in.(${entryIds.join(',')}),team2_entry_id.in.(${entryIds.join(',')})`)
    .in('status', ['SCHEDULED', 'IN_PROGRESS'])
    .order('round_number')
    .limit(10)

  if (!matches || matches.length === 0) {
    return {
      success: true,
      message: '예정된 경기가 없습니다.\n\n아직 대진표가 생성되지 않았거나 모든 경기가 완료되었습니다.',
      links: [{ label: '내 신청 확인', href: '/my/entries' }],
    }
  }

  // 대회 정보 맵
  const tournamentMap = new Map<string, string>()
  for (const e of entries) {
    const t = e.tournaments as unknown as { id: string; title: string }
    tournamentMap.set(e.id, t.title)
  }

  const lines = matches.map((m) => {
    const e1 = m.entry1 as unknown as { id: string; player_name: string; club_name: string | null } | null
    const e2 = m.entry2 as unknown as { id: string; player_name: string; club_name: string | null } | null
    const p1 = e1?.player_name ?? 'TBD'
    const p2 = e2?.player_name ?? 'TBD'
    const statusStr = m.status === 'IN_PROGRESS' ? ' (진행중)' : ''
    const courtStr = m.court_number ? ` | ${m.court_number}코트` : ''

    // 어느 대회인지
    const myEntryId = e1 && entryIds.includes(e1.id) ? e1.id : e2?.id
    const tournamentTitle = myEntryId ? tournamentMap.get(myEntryId) ?? '' : ''

    return `- ${tournamentTitle} R${m.round_number} ${m.match_number}경기: ${p1} vs ${p2}${statusStr}${courtStr}`
  })

  const links = [...new Set(entries.map((e) => {
    const t = e.tournaments as unknown as { id: string; title: string }
    return JSON.stringify({ label: `${t.title} 대진표`, href: `/tournaments/${t.id}/bracket` })
  }))].map((s) => JSON.parse(s) as { label: string; href: string })

  return {
    success: true,
    message: `내 예정 경기:\n\n${lines.join('\n')}`,
    links,
  }
}

// ─── scope: "all" — 전체 대진표 ─────────────────────

async function handleBracketAll(entities: ChatEntities): Promise<HandlerResult> {
  const admin = createAdminClient()

  // 대회명으로 검색 또는 상태 기반 검색
  let tournamentsQuery = admin
    .from('tournaments')
    .select('id, title, status')
    .limit(5)

  if (entities.tournament_name) {
    tournamentsQuery = tournamentsQuery.ilike('title', `%${escapeLike(entities.tournament_name)}%`)
  }
  if (entities.status) {
    const mapped = STATUS_MAP[entities.status]
    if (mapped) tournamentsQuery = tournamentsQuery.eq('status', mapped)
  }

  // 대회명도 상태도 없으면 안내 반환
  if (!entities.tournament_name && !entities.status) {
    return {
      success: true,
      message: '어떤 대회의 대진표를 보고 싶으신가요? 대회명이나 상태(예: 완료된 대회)를 알려주세요.',
    }
  }

  tournamentsQuery = tournamentsQuery.order('start_date', { ascending: false })
  const { data: tournaments } = await tournamentsQuery

  if (!tournaments || tournaments.length === 0) {
    const keyword = entities.tournament_name
      ? `"${entities.tournament_name}"`
      : '조건에 맞는'
    return {
      success: true,
      message: `${keyword} 대회를 찾을 수 없습니다. 다른 조건으로 검색해보세요.`,
    }
  }

  // 복수 대회 검색 결과 (대회명 없이 상태로만 검색한 경우)
  if (!entities.tournament_name && tournaments.length > 1) {
    const lines = tournaments.map((t, i) => `${i + 1}. ${t.title}`)
    const links = tournaments.map((t) => ({
      label: `${t.title} 대진표`,
      href: `/tournaments/${t.id}/bracket`,
    }))
    return {
      success: true,
      message: `대진표를 볼 수 있는 대회 ${tournaments.length}개:\n\n${lines.join('\n')}`,
      data: tournaments,
      links,
    }
  }

  const tournament = tournaments[0]

  // tournament → tournament_divisions → bracket_configs 경로로 조회
  const { data: divisions } = await admin
    .from('tournament_divisions')
    .select('id, name')
    .eq('tournament_id', tournament.id)

  if (!divisions || divisions.length === 0) {
    return {
      success: true,
      message: `"${tournament.title}" 대회의 대진표가 아직 생성되지 않았습니다.`,
      links: [{ label: `${tournament.title} 상세`, href: `/tournaments/${tournament.id}` }],
    }
  }

  const divisionIds = divisions.map((d) => d.id)
  const { data: configs } = await admin
    .from('bracket_configs')
    .select('id, division_id')
    .in('division_id', divisionIds)

  if (!configs || configs.length === 0) {
    return {
      success: true,
      message: `"${tournament.title}" 대회의 대진표가 아직 생성되지 않았습니다.`,
      links: [{ label: `${tournament.title} 상세`, href: `/tournaments/${tournament.id}` }],
    }
  }

  // 디비전 ID → 이름 맵
  const divNameMap = new Map(divisions.map((d) => [d.id, d.name]))

  // 각 디비전별 라운드/매치 현황
  const summaries: string[] = []
  for (const config of configs) {
    const { data: matches } = await admin
      .from('bracket_matches')
      .select('round_number, status')
      .eq('bracket_config_id', config.id)
      .is('group_id', null)

    if (!matches || matches.length === 0) continue

    const totalMatches = matches.length
    const completedMatches = matches.filter((m) => m.status === 'COMPLETED').length
    const maxRound = Math.max(...matches.map((m) => m.round_number))

    // 라운드별 매치 수 요약
    const roundSummary = Array.from({ length: maxRound }, (_, i) => {
      const round = i + 1
      const count = matches.filter((m) => m.round_number === round).length
      return `R${round}(${count}경기)`
    }).join(' → ')

    const label = divNameMap.get(config.division_id) || '본선'
    summaries.push(`${label}: ${roundSummary}\n  진행: ${completedMatches}/${totalMatches} 완료`)
  }

  const message = summaries.length > 0
    ? `"${tournament.title}" 대진표 정보:\n\n${summaries.join('\n\n')}`
    : `"${tournament.title}" 대진표가 아직 준비 중입니다.`

  return {
    success: true,
    message,
    links: [{ label: `${tournament.title} 대진표 보기`, href: `/tournaments/${tournament.id}/bracket` }],
  }
}
