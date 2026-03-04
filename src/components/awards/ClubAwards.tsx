import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { Database } from '@/lib/supabase/types'
import { groupAwardsForDisplay, RANK_ORDER } from './awardGrouping'

type Award = Database['public']['Tables']['tournament_awards']['Row']

const RANK_BADGE: Record<string, BadgeVariant> = {
  '우승': 'warning',
  '준우승': 'secondary',
  '공동3위': 'info',
  '3위': 'info',
}

interface Props {
  awards: Award[]
}

export function ClubAwards({ awards }: Props) {
  const wins = awards.filter((a) => a.award_rank === '우승').length

  if (awards.length === 0) {
    return (
      <div
        className="text-center py-16 rounded-2xl border border-dashed"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          아직 등록된 입상 기록이 없습니다
        </p>
      </div>
    )
  }

  // 연도별 그룹핑
  const byYear = awards.reduce<Record<number, Award[]>>((acc, a) => {
    if (!acc[a.year]) acc[a.year] = []
    acc[a.year].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        총 {awards.length}건 · 우승 {wins}회
      </p>
      {Object.entries(byYear)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([year, yearAwards]) => {
          const groups = groupAwardsForDisplay(yearAwards).sort((a, b) => {
            const compDiff = a.competition.localeCompare(b.competition, 'ko')
            if (compDiff !== 0) return compDiff
            return (RANK_ORDER[a.award_rank] ?? 9) - (RANK_ORDER[b.award_rank] ?? 9)
          })

          return (
            <section key={year}>
              <h3
                className="text-lg font-display mb-3"
                style={{ color: 'var(--text-primary)' }}
              >
                {year}년
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {groups.map((group) => (
                  <div
                    key={group.key}
                    className="rounded-xl p-4 space-y-2"
                    style={{
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <Badge variant={RANK_BADGE[group.award_rank] ?? 'secondary'}>
                        {group.award_rank}
                      </Badge>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {group.game_type}
                      </span>
                    </div>
                    <p
                      className="text-sm font-medium truncate"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {group.competition}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {group.division}
                    </p>
                    <div
                      className="pt-2 border-t"
                      style={{ borderColor: 'var(--border-color)' }}
                    >
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {group.players.join(', ')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )
        })}
    </div>
  )
}
