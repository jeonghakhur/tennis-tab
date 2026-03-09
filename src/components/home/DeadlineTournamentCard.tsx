import Link from 'next/link'
import { MapPin, CalendarDays } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { DeadlineTournament } from '@/lib/home/actions'

interface DeadlineTournamentCardProps {
  tournament: DeadlineTournament
}

function getDDayBadge(daysLeft: number): { label: string; variant: BadgeVariant } {
  if (daysLeft === 0) return { label: '오늘 마감', variant: 'danger' }
  if (daysLeft === 1) return { label: 'D-1', variant: 'danger' }
  if (daysLeft <= 3) return { label: `D-${daysLeft}`, variant: 'warning' }
  if (daysLeft <= 7) return { label: `D-${daysLeft}`, variant: 'info' }
  return { label: '모집 중', variant: 'success' }
}

function formatEntryEndDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} 마감`
}

export function DeadlineTournamentCard({ tournament }: DeadlineTournamentCardProps) {
  const { label, variant } = getDDayBadge(tournament.daysLeft)

  return (
    <li role="listitem">
      <Link
        href={`/tournaments/${tournament.id}`}
        className="flex items-center gap-4 px-4 py-3 rounded-xl transition-all hover:opacity-80"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        {/* D-day 배지 */}
        <div className="shrink-0 w-16 text-center">
          <Badge variant={variant}>{label}</Badge>
        </div>

        {/* 대회 정보 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {tournament.title}
          </p>
          <div className="flex items-center gap-3 mt-0.5" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1 text-xs">
              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
              {tournament.location}
            </span>
            {tournament.division_count > 0 && (
              <span className="text-xs">{tournament.division_count}개 부서</span>
            )}
          </div>
        </div>

        {/* 마감일 */}
        {tournament.entry_end_date && (
          <div className="shrink-0 flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <CalendarDays className="w-3 h-3" aria-hidden="true" />
            {formatEntryEndDate(tournament.entry_end_date)}
          </div>
        )}
      </Link>
    </li>
  )
}
