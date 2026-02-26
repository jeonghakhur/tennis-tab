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

interface Props { awards: Award[] }

export function AwardsList({ awards }: Props) {
  if (awards.length === 0) {
    return (
      <div
        className="text-center py-20 rounded-2xl border border-dashed"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <p style={{ color: 'var(--text-muted)' }}>조건에 맞는 입상 기록이 없습니다.</p>
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
    <div className="space-y-12">
      {Object.entries(byYear)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([year, yearAwards]) => {
          // 연도 내 대회별 그룹핑
          const byComp = yearAwards.reduce<Record<string, Award[]>>((acc, a) => {
            if (!acc[a.competition]) acc[a.competition] = []
            acc[a.competition].push(a)
            return acc
          }, {})

          return (
            <section key={year}>
              <h2
                className="text-xl font-bold mb-6"
                style={{ color: 'var(--text-primary)' }}
              >
                {year}년
              </h2>
              <div className="space-y-6">
                {Object.entries(byComp)
                  .sort(([a], [b]) => a.localeCompare(b, 'ko'))
                  .map(([competition, compAwards]) => {
                    // 대회 내 (division+rank+club) 그룹핑
                    const groups = groupAwardsForDisplay(compAwards).sort(
                      (a, b) => (RANK_ORDER[a.award_rank] ?? 9) - (RANK_ORDER[b.award_rank] ?? 9)
                    )

                    return (
                      <div key={competition}>
                        <h3
                          className="text-sm font-semibold mb-3 pb-1.5 border-b"
                          style={{
                            color: 'var(--text-secondary)',
                            borderColor: 'var(--border-color)',
                          }}
                        >
                          {competition}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
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
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {group.division}
                              </p>
                              <div
                                className="pt-2 border-t"
                                style={{ borderColor: 'var(--border-color)' }}
                              >
                                {group.club_name && (
                                  <p
                                    className="text-sm font-semibold mb-1"
                                    style={{ color: 'var(--text-primary)' }}
                                  >
                                    {group.club_name}
                                  </p>
                                )}
                                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {group.players.join(', ')}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </section>
          )
        })}
    </div>
  )
}
