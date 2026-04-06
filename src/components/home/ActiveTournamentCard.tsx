import Link from 'next/link'
import { MapPin, Trophy } from 'lucide-react'
import type { ActiveTournament } from '@/lib/home/actions'

interface ActiveTournamentCardProps {
  tournament: ActiveTournament
}

type StatusBadgeInfo = {
  label: string
  dot: string
  bg: string
  text: string
}

function getStatusBadge(status: string, daysLeft: number): StatusBadgeInfo {
  if (status === 'IN_PROGRESS') {
    return {
      label: '진행중',
      dot: '#f97316',
      bg: 'rgba(249,115,22,0.12)',
      text: '#f97316',
    }
  }
  if (daysLeft <= 0) {
    return {
      label: '마감',
      dot: '#71717a',
      bg: 'rgba(113,113,122,0.12)',
      text: '#71717a',
    }
  }
  return {
    label: '모집중',
    dot: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    text: '#22c55e',
  }
}

function getDDayLabel(status: string, daysLeft: number): string | null {
  if (status === 'IN_PROGRESS') return null
  if (daysLeft <= 0) return null
  if (daysLeft === 1) return 'D-1'
  return `D-${daysLeft}`
}

export function ActiveTournamentCard({ tournament }: ActiveTournamentCardProps) {
  const badge = getStatusBadge(tournament.status, tournament.daysLeft)
  const ddayLabel = getDDayLabel(tournament.status, tournament.daysLeft)
  const isInProgress = tournament.status === 'IN_PROGRESS'

  // 진행률 계산 (0~100)
  const progressPct =
    tournament.max_participants > 0
      ? Math.min(100, Math.round((tournament.entry_count / tournament.max_participants) * 100))
      : 0

  return (
    <li role="listitem">
      <div
        className="p-4 rounded-2xl flex flex-col gap-3"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* 1행: 제목 */}
        <div className="flex items-start gap-2">
          <Trophy
            className="w-4 h-4 shrink-0 mt-0.5"
            style={{ color: 'var(--accent-color)' }}
            aria-hidden="true"
          />
          <p
            className="text-base font-bold leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            {tournament.title}
          </p>
        </div>

        {/* 2행: 상태 배지 + D-day */}
        <div className="flex items-center gap-2">
          {/* 상태 배지 */}
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: badge.bg, color: badge.text }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: badge.dot }}
              aria-hidden="true"
            />
            {badge.label}
          </span>

          {/* D-day */}
          {ddayLabel && (
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {ddayLabel}
            </span>
          )}
        </div>

        {/* 3행: 진행률 바 */}
        {tournament.max_participants > 0 && (
          <div
            className="w-full rounded-full overflow-hidden"
            style={{ height: '6px', backgroundColor: 'var(--border-color)' }}
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="신청률"
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progressPct}%`,
                backgroundColor: progressPct >= 90 ? '#f97316' : 'var(--accent-color)',
              }}
            />
          </div>
        )}

        {/* 4행: 부서별 신청 현황 */}
        {tournament.divisions && tournament.divisions.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {tournament.divisions.map((div) => (
              <div
                key={div.name}
                className="flex items-center justify-between text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>{div.name}</span>
                <span>
                  {div.max_teams != null
                    ? `${div.entry_count} / ${div.max_teams}팀`
                    : `${div.entry_count}팀 신청`}
                </span>
              </div>
            ))}
          </div>
        ) : tournament.division_count > 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {tournament.division_count}개 부서 · {tournament.entry_count}팀 신청
          </p>
        ) : null}

        {/* 4행: 장소 */}
        {tournament.location && (
          <div
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{tournament.location}</span>
          </div>
        )}

        {/* 5행: 버튼 */}
        <div>
          {isInProgress && tournament.hasBracket ? (
            <Link
              href={`/tournaments/${tournament.id}/bracket`}
              className="block text-center text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
            >
              대진표 보기
            </Link>
          ) : isInProgress ? (
            <Link
              href={`/tournaments/${tournament.id}`}
              className="block text-center text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:opacity-90"
              style={{
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}
            >
              대회 보기
            </Link>
          ) : (
            <Link
              href={`/tournaments/${tournament.id}`}
              className="block text-center text-sm font-semibold px-4 py-2 rounded-xl transition-all hover:opacity-90"
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
