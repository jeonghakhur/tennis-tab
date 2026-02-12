import { createAdminClient } from '@/lib/supabase/admin'
import type { ChatEntities, HandlerResult } from '../types'

/** VIEW_BRACKET 핸들러 — 대진표 조회 */
export async function handleViewBracket(
  entities: ChatEntities,
  _userId?: string,
): Promise<HandlerResult> {
  if (!entities.tournament_name) {
    return {
      success: true,
      message: '어떤 대회의 대진표를 보고 싶으신가요? 대회명을 알려주세요.',
    }
  }

  const admin = createAdminClient()

  // 대회명으로 검색
  const { data: tournaments } = await admin
    .from('tournaments')
    .select('id, title, status')
    .ilike('title', `%${entities.tournament_name.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`)
    .limit(3)

  if (!tournaments || tournaments.length === 0) {
    return {
      success: true,
      message: `"${entities.tournament_name}" 대회를 찾을 수 없습니다. 정확한 대회명으로 다시 검색해보세요.`,
    }
  }

  const tournament = tournaments[0]

  // 대진표 설정 + 매치 정보 조회
  const { data: configs } = await admin
    .from('bracket_configs')
    .select('id, division_name')
    .eq('tournament_id', tournament.id)

  if (!configs || configs.length === 0) {
    return {
      success: true,
      message: `"${tournament.title}" 대회의 대진표가 아직 생성되지 않았습니다.`,
      links: [{ label: `${tournament.title} 상세`, href: `/tournaments/${tournament.id}` }],
    }
  }

  // 각 디비전별 라운드/매치 현황
  const summaries: string[] = []
  for (const config of configs) {
    const { data: matches } = await admin
      .from('bracket_matches')
      .select('round, status')
      .eq('bracket_config_id', config.id)
      .eq('phase', 'MAIN')

    if (!matches || matches.length === 0) continue

    const totalMatches = matches.length
    const completedMatches = matches.filter((m) => m.status === 'COMPLETED').length
    const maxRound = Math.max(...matches.map((m) => m.round))

    // 라운드별 매치 수 요약
    const roundSummary = Array.from({ length: maxRound }, (_, i) => {
      const round = i + 1
      const count = matches.filter((m) => m.round === round).length
      return `R${round}(${count}경기)`
    }).join(' → ')

    const label = config.division_name || '본선'
    summaries.push(`${label}: ${roundSummary}\n  진행: ${completedMatches}/${totalMatches} 완료`)
  }

  const message = summaries.length > 0
    ? `"${tournament.title}" 대진표 정보:\n\n${summaries.join('\n\n')}`
    : `"${tournament.title}" 대진표가 아직 준비 중입니다.`

  return {
    success: true,
    message,
    links: [{ label: '대진표 보기', href: `/tournaments/${tournament.id}/bracket` }],
  }
}
