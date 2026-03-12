import Link from 'next/link'
import { MapPin, CalendarDays } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { ActiveTournament } from '@/lib/home/actions'

interface ActiveTournamentCardProps {
  tournament: ActiveTournament
}

function getDDayBadge(status: string, daysLeft: number): { label: string; variant: BadgeVariant } {
  if (status === 'IN_PROGRESS') return { label: '진행 중', variant: 'success' }
  if (daysLeft === 0) return { label: '오늘 마감', variant: 'danger' }
  if (daysLeft === 1) return { label: 'D-1', variant: 'danger' }
  if (daysLeft <= 3) return { label: `D-${daysLeft}`, variant: 'warning' }
  if (daysLeft <= 7) return { label: `D-${daysLeft}`, variant: 'info' }
  return { label: '모집 중', variant: 'secondary' }
}

function formatEntryEndDate(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()} 마감`
}

export function ActiveTournamentCard({ tournament }: ActiveTournamentCardProps) {
  const { label, variant } = getDDayBadge(tournament.status, tournament.daysLeft)
  const isInProgress = tournament.status === 'IN_PROGRESS'

  return (
    <li role="listitem">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        {/* 상태 배지 */}
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

        {/* 우측 액션 */}
        <div className="shrink-0 flex items-center gap-2">
          {/* 마감일 (모집 중인 경우) */}
          {!isInProgress && tournament.entry_end_date && (
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <CalendarDays className="w-3 h-3" aria-hidden="true" />
              {formatEntryEndDate(tournament.entry_end_date)}
            </span>
          )}

          {/* 버튼 */}
          {isInProgress && tournament.hasBracket ? (
            <Link
              href={`/tournaments/${tournament.id}/bracket`}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
            >
              대진표 보기
            </Link>
          ) : (
            <Link
              href={`/tournaments/${tournament.id}`}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
            >
              신청하기
            </Link>
          )}
        </div>
      </div>
    </li>
  )
}
