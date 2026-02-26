import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { Database } from '@/lib/supabase/types'

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
  const grouped = awards.reduce<Record<number, Award[]>>((acc, a) => {
    if (!acc[a.year]) acc[a.year] = []
    acc[a.year].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-8">
      {Object.entries(grouped)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([year, items]) => (
          <section key={year}>
            <h3
              className="text-lg font-display mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              {year}년
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {award.competition}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {award.division}
                  </p>
                  <div
                    className="pt-2 border-t"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                      {award.players.join(', ')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
    </div>
  )
}
