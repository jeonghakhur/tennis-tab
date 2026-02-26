import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { Database } from '@/lib/supabase/types'

type Award = Database['public']['Tables']['tournament_awards']['Row']

const RANK_BADGE: Record<string, BadgeVariant> = {
  '우승': 'warning',
  '준우승': 'secondary',
  '공동3위': 'info',
  '3위': 'info',
}

const RANK_ORDER: Record<string, number> = {
  '우승': 1,
  '준우승': 2,
  '공동3위': 3,
  '3위': 4,
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

  // 연도 → 대회명 2단계 그룹핑, 각 그룹 내 순위 정렬
  type CompGroup = { competition: string; items: Award[] }
  type YearGroup = { year: number; comps: CompGroup[] }

  const byYear = awards.reduce<Record<number, Record<string, Award[]>>>((acc, a) => {
    if (!acc[a.year]) acc[a.year] = {}
    if (!acc[a.year][a.competition]) acc[a.year][a.competition] = []
    acc[a.year][a.competition].push(a)
    return acc
  }, {})

  const yearGroups: YearGroup[] = Object.entries(byYear)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, comps]) => ({
      year: Number(year),
      comps: Object.entries(comps)
        .sort(([a], [b]) => a.localeCompare(b, 'ko'))
        .map(([competition, items]) => ({
          competition,
          items: [...items].sort(
            (a, b) => (RANK_ORDER[a.award_rank] ?? 9) - (RANK_ORDER[b.award_rank] ?? 9)
          ),
        })),
    }))

  return (
    <div className="space-y-12">
      {yearGroups.map(({ year, comps }) => (
        <section key={year}>
          <h2
            className="text-xl font-bold mb-6"
            style={{ color: 'var(--text-primary)' }}
          >
            {year}년
          </h2>
          <div className="space-y-6">
            {comps.map(({ competition, items }) => (
              <div key={competition}>
                {/* 대회명 소제목 */}
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
                  {items.map((award) => (
                    <div
                      key={award.id}
                      className="rounded-xl p-4 space-y-2"
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <Badge variant={RANK_BADGE[award.award_rank] ?? 'secondary'}>
                          {award.award_rank}
                        </Badge>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {award.game_type}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {award.division}
                      </p>
                      <div
                        className="pt-2 border-t"
                        style={{ borderColor: 'var(--border-color)' }}
                      >
                        <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {award.players.join(', ')}
                        </p>
                        {award.club_name && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {award.club_name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
