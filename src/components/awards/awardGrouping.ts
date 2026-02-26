import type { Database } from '@/lib/supabase/types'

type Award = Database['public']['Tables']['tournament_awards']['Row']

export interface AwardDisplayGroup {
  key: string
  year: number
  competition: string
  division: string
  award_rank: string
  game_type: string
  club_name: string | null
  players: string[]
  /** ProfileAwards 전용: 유저 본인 레코드 ID */
  myRecordId?: string
  /** ProfileAwards 전용: 이미 클레임됨 여부 */
  isClaimed?: boolean
}

export const RANK_ORDER: Record<string, number> = {
  '우승': 1,
  '준우승': 2,
  '공동3위': 3,
  '3위': 4,
}

/**
 * Award[] → 같은 (year+competition+division+award_rank+club_name) 묶음으로 그룹핑
 * myAwardIds, userId는 ProfileAwards 전용 (클레임 상태 표시용)
 */
export function groupAwardsForDisplay(
  awards: Award[],
  myAwardIds?: Set<string>,
  userId?: string
): AwardDisplayGroup[] {
  const map = new Map<string, AwardDisplayGroup>()

  for (const a of awards) {
    const key = `${a.year}||${a.competition}||${a.division}||${a.award_rank}||${a.club_name ?? ''}`
    if (!map.has(key)) {
      map.set(key, {
        key,
        year: a.year,
        competition: a.competition,
        division: a.division,
        award_rank: a.award_rank,
        game_type: a.game_type,
        club_name: a.club_name,
        players: [],
      })
    }
    const group = map.get(key)!
    group.players.push(...a.players)

    // 유저 본인 레코드면 클레임 상태 기록
    if (myAwardIds?.has(a.id)) {
      group.myRecordId = a.id
      group.isClaimed = a.player_user_ids?.includes(userId ?? '') ?? false
    }
  }

  return Array.from(map.values())
}
