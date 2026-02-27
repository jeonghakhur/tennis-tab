import type { ChatEntities, HandlerResult } from '../types'
import { getAwards } from '@/lib/awards/actions'

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

    const awards = await getAwards({
      playerName,
      year,
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

    // 최대 10건만 표시
    const displayed = awards.slice(0, 10)
    const lines = displayed.map((a) => {
      const playersStr = a.players.join(', ')
      const club = a.club_name ? ` (${a.club_name})` : ''
      return `• ${a.year}년 ${a.competition} ${a.division} **${a.award_rank}** — ${playersStr}${club}`
    })

    const headerName = playerName ? `${playerName} 선수의 ` : ''
    const message =
      `**${headerName}입상 기록** (${awards.length}건)\n\n` + lines.join('\n')

    return {
      success: true,
      data: displayed,
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
