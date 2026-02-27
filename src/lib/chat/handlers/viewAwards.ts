import type { ChatEntities, HandlerResult } from '../types'
import { getAwards } from '@/lib/awards/actions'
import type { Database } from '@/lib/supabase/types'

type Award = Database['public']['Tables']['tournament_awards']['Row']

/**
 * 대회 > 부서 > 등급 순으로 그루핑하여 메시지 생성
 * 예) 📌 제36회마포구협회장배
 *      • 퓨처스부 우승: 유기현, 안기원 (일레븐)
 */
function buildAwardsMessage(awards: Award[]): string {
  // year+competition 단위로 그루핑
  const byComp = new Map<string, Award[]>()
  for (const a of awards) {
    const key = `${a.year}||${a.competition}`
    if (!byComp.has(key)) byComp.set(key, [])
    byComp.get(key)!.push(a)
  }

  const sections: string[] = []
  for (const [key, items] of byComp) {
    const [yearStr, competition] = key.split('||')
    const header = `📌 ${yearStr}년 ${competition}`

    // division+rank 단위로 재그루핑
    const byDiv = new Map<string, Award[]>()
    for (const a of items) {
      const divKey = `${a.division}||${a.award_rank}`
      if (!byDiv.has(divKey)) byDiv.set(divKey, [])
      byDiv.get(divKey)!.push(a)
    }

    const divLines: string[] = []
    for (const [divKey, divItems] of byDiv) {
      const [division, awardRank] = divKey.split('||')
      const players = divItems.flatMap((a) => a.players as string[]).join(', ')
      const club = divItems[0].club_name ? ` (${divItems[0].club_name})` : ''
      divLines.push(`  • ${division} **${awardRank}**: ${players}${club}`)
    }

    sections.push(`${header}\n${divLines.join('\n')}`)
  }

  return sections.join('\n\n')
}

export async function handleViewAwards(
  entities: ChatEntities,
  userId?: string
): Promise<HandlerResult> {
  // scope "my" 인데 비로그인 → 로그인 안내
  if (entities.scope === 'my' && !userId) {
    return {
      success: false,
      message: '내 입상 기록을 보려면 로그인이 필요합니다.',
      links: [{ label: '로그인', href: '/auth/login' }],
    }
  }

  try {
    const playerName = entities.award_player_name ?? entities.player_name
    const year = entities.award_year
    const rank = entities.award_rank

    const awards = await getAwards({
      playerName,
      year,
      rank,
      userId: entities.scope === 'my' ? userId : undefined,
    })

    if (awards.length === 0) {
      const condition = playerName ? `${playerName} 선수의 ` : ''
      return {
        success: true,
        message: `${condition}입상 기록이 없습니다.`,
        links: [{ label: '명예의 전당 보기', href: '/awards' }],
      }
    }

    const headerName = playerName ? `${playerName} 선수의 ` : ''
    const message = `**${headerName}입상 기록** (${awards.length}건)\n\n` + buildAwardsMessage(awards)

    return {
      success: true,
      data: awards,
      message,
      links: [{ label: '전체 기록 보기', href: '/awards' }],
    }
  } catch {
    return {
      success: false,
      message: '입상 기록을 불러오는 중 오류가 발생했습니다.',
    }
  }
}
