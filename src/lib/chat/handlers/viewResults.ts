import { createAdminClient } from '@/lib/supabase/admin'
import type { ChatEntities, HandlerResult } from '../types'

/** VIEW_RESULTS 핸들러 — 경기 결과 조회 (scope 분기) */
export async function handleViewResults(
  entities: ChatEntities,
  userId?: string,
): Promise<HandlerResult> {
  // scope: "my" → 내 경기 결과
  if (entities.scope === 'my') {
    return handleMyResults(userId)
  }

  return handleResultsAll(entities)
}

// ─── scope: "my" — 내 경기 결과 ─────────────────────

async function handleMyResults(userId?: string): Promise<HandlerResult> {
  if (!userId) {
    return {
      success: false,
      message: '내 경기 결과를 보려면 로그인이 필요합니다.',
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
    return { success: true, message: '참가한 대회가 없습니다.' }
  }

  const entryIds = entries.map((e) => e.id)

  // 2. 완료된 경기 조회
  const { data: matches } = await admin
    .from('bracket_matches')
    .select(`
      round_number, match_number, team1_score, team2_score,
      entry1:team1_entry_id(id, player_name),
      entry2:team2_entry_id(id, player_name),
      winner:winner_entry_id(id, player_name)
    `)
    .or(`team1_entry_id.in.(${entryIds.join(',')}),team2_entry_id.in.(${entryIds.join(',')})`)
    .eq('status', 'COMPLETED')
    .order('completed_at', { ascending: false })
    .limit(10)

  if (!matches || matches.length === 0) {
    return {
      success: true,
      message: '완료된 경기가 없습니다.',
      links: [{ label: '내 신청 확인', href: '/my/entries' }],
    }
  }

  // 대회 정보 맵
  const tournamentMap = new Map<string, string>()
  for (const e of entries) {
    const t = e.tournaments as unknown as { id: string; title: string }
    tournamentMap.set(e.id, t.title)
  }

  // 전적 집계
  let wins = 0
  let losses = 0

  const lines = matches.map((m) => {
    const e1 = m.entry1 as unknown as { id: string; player_name: string } | null
    const e2 = m.entry2 as unknown as { id: string; player_name: string } | null
    const w = m.winner as unknown as { id: string; player_name: string } | null
    const p1 = e1?.player_name ?? '선수1'
    const p2 = e2?.player_name ?? '선수2'
    const score = `${m.team1_score ?? 0}:${m.team2_score ?? 0}`

    // 승패 판정
    const isWinner = w && entryIds.includes(w.id)
    if (isWinner) wins++
    else losses++
    const resultMark = isWinner ? '🏆' : '❌'

    const myEntryId = e1 && entryIds.includes(e1.id) ? e1.id : e2?.id
    const tournamentTitle = myEntryId ? tournamentMap.get(myEntryId) ?? '' : ''

    return `${resultMark} ${tournamentTitle} R${m.round_number}: ${p1} vs ${p2} (${score})`
  })

  const record = `📊 전적: ${wins}승 ${losses}패`

  return {
    success: true,
    message: `내 경기 결과:\n\n${record}\n\n${lines.join('\n')}`,
    links: [{ label: '내 신청 확인', href: '/my/entries' }],
  }
}

// ─── scope: "all" — 전체 경기 결과 ──────────────────

async function handleResultsAll(entities: ChatEntities): Promise<HandlerResult> {
  if (!entities.tournament_name) {
    return {
      success: true,
      message: '어떤 대회의 경기 결과를 보고 싶으신가요? 대회명을 알려주세요.',
    }
  }

  const admin = createAdminClient()

  // 대회명으로 검색
  const { data: tournaments } = await admin
    .from('tournaments')
    .select('id, title')
    .ilike('title', `%${entities.tournament_name.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`)
    .neq('visibility', 'HIDDEN')
    .limit(1)

  if (!tournaments || tournaments.length === 0) {
    return {
      success: true,
      message: `"${entities.tournament_name}" 대회를 찾을 수 없습니다.`,
    }
  }

  const tournament = tournaments[0]

  // tournament → tournament_divisions → bracket_configs 경로로 조회
  const { data: divisions } = await admin
    .from('tournament_divisions')
    .select('id')
    .eq('tournament_id', tournament.id)

  if (!divisions || divisions.length === 0) {
    return {
      success: true,
      message: `"${tournament.title}" 대회의 경기 기록이 없습니다.`,
    }
  }

  const { data: configs } = await admin
    .from('bracket_configs')
    .select('id')
    .in('division_id', divisions.map((d) => d.id))

  if (!configs || configs.length === 0) {
    return {
      success: true,
      message: `"${tournament.title}" 대회의 경기 기록이 없습니다.`,
    }
  }

  const configIds = configs.map((c) => c.id)

  // 최근 완료 매치 5개 (승자 포함)
  const { data: matches } = await admin
    .from('bracket_matches')
    .select(`
      round_number, match_number, team1_score, team2_score,
      entry1:team1_entry_id(player_name),
      entry2:team2_entry_id(player_name),
      winner:winner_entry_id(player_name)
    `)
    .in('bracket_config_id', configIds)
    .eq('status', 'COMPLETED')
    .order('updated_at', { ascending: false })
    .limit(5)

  if (!matches || matches.length === 0) {
    return {
      success: true,
      message: `"${tournament.title}" 대회에 아직 완료된 경기가 없습니다.`,
      links: [{ label: `${tournament.title} 대진표 보기`, href: `/tournaments/${tournament.id}/bracket` }],
    }
  }

  // 결과 포매팅
  const lines = matches.map((m) => {
    const p1 = (m.entry1 as unknown as { player_name: string } | null)?.player_name ?? '선수1'
    const p2 = (m.entry2 as unknown as { player_name: string } | null)?.player_name ?? '선수2'
    const winnerName = (m.winner as unknown as { player_name: string } | null)?.player_name ?? '미정'
    const score = `${m.team1_score ?? 0}:${m.team2_score ?? 0}`
    return `- R${m.round_number} ${m.match_number}경기: ${p1} vs ${p2} → ${winnerName} 승 (${score})`
  })

  const message = `"${tournament.title}" 최근 경기 결과:\n\n${lines.join('\n')}`

  return {
    success: true,
    message,
    data: matches,
    links: [{ label: `${tournament.title} 전체 결과 보기`, href: `/tournaments/${tournament.id}/bracket` }],
  }
}
