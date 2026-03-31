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
  const month = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", month: "numeric" })
  const day = d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul", day: "numeric" })
  return `${month}/${day} 마감`
}

export function ActiveTournamentCard({ tournament }: ActiveTournamentCardProps) {
  const { label, variant } = getDDayBadge(tournament.status, tournament.daysLeft)
  const isInProgress = tournament.status === 'IN_PROGRESS'

  return (
    <li role="listitem">
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 rounded-xl"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        {/* 상태 배지 */}
        <div className="shrink-0">
          <Badge variant={variant}>{label}</Badge>
        </div>

        {/* 대회 정보 — 남은 공간 차지, 최소 너비 확보 */}
        <div className="flex-1 min-w-0" style={{ flexBasis: '120px' }}>
          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {tournament.title}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1 text-xs whitespace-nowrap">
              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-[10rem]">{tournament.location}</span>
            </span>
            {tournament.division_count > 0 && (
              <span className="text-xs whitespace-nowrap">{tournament.division_count}개 부서</span>
            )}
          </div>
        </div>

        {/* 우측 액션 */}
        <div className="shrink-0 flex items-center gap-2 ml-auto">
          {/* 마감일 (모집 중인 경우) */}
          {!isInProgress && tournament.entry_end_date && (
            <span className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
              <CalendarDays className="w-3 h-3 shrink-0" aria-hidden="true" />
              {formatEntryEndDate(tournament.entry_end_date)}
            </span>
          )}

          {/* 버튼 */}
          {isInProgress && tournament.hasBracket ? (
            <Link
              href={`/tournaments/${tournament.id}/bracket`}
              className="text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
            >
              대진표 보기
            </Link>
          ) : isInProgress ? (
            <Link
              href={`/tournaments/${tournament.id}`}
              className="text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-all hover:opacity-90"
              style={{ border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
            >
              대회 보기
            </Link>
          ) : (
            <Link
              href={`/tournaments/${tournament.id}`}
              className="text-xs font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition-all hover:opacity-90"
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
