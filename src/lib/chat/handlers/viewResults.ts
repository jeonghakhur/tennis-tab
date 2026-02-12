import { createAdminClient } from '@/lib/supabase/admin'
import type { ChatEntities, HandlerResult } from '../types'

/** VIEW_RESULTS 핸들러 — 경기 결과 조회 */
export async function handleViewResults(
  entities: ChatEntities,
  _userId?: string,
): Promise<HandlerResult> {
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
    .limit(1)

  if (!tournaments || tournaments.length === 0) {
    return {
      success: true,
      message: `"${entities.tournament_name}" 대회를 찾을 수 없습니다.`,
    }
  }

  const tournament = tournaments[0]

  // 대진표 설정 조회
  const { data: configs } = await admin
    .from('bracket_configs')
    .select('id')
    .eq('tournament_id', tournament.id)

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
      round, match_order, score_1, score_2,
      entry1:entry1_id(player_name),
      entry2:entry2_id(player_name),
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
      links: [{ label: '대진표 보기', href: `/tournaments/${tournament.id}/bracket` }],
    }
  }

  // 결과 포매팅
  const lines = matches.map((m) => {
    const p1 = (m.entry1 as unknown as { player_name: string } | null)?.player_name ?? '선수1'
    const p2 = (m.entry2 as unknown as { player_name: string } | null)?.player_name ?? '선수2'
    const winnerName = (m.winner as unknown as { player_name: string } | null)?.player_name ?? '미정'
    const score = `${m.score_1 ?? 0}:${m.score_2 ?? 0}`
    return `- R${m.round} ${m.match_order}경기: ${p1} vs ${p2} → ${winnerName} 승 (${score})`
  })

  const message = `"${tournament.title}" 최근 경기 결과:\n\n${lines.join('\n')}`

  return {
    success: true,
    message,
    data: matches,
    links: [{ label: '전체 결과 보기', href: `/tournaments/${tournament.id}/bracket` }],
  }
}
