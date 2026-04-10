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
  // 분모는 부서별 max_teams 합산(팀 단위). tournaments.max_participants는
  // 대회 전체 인원 필드라 entry_count(팀 수)와 단위가 달라 사용하지 않음.
  const totalMaxTeams = tournament.divisions.reduce(
    (sum, d) => sum + (d.max_teams ?? 0),
    0
  )
  const hasProgress = totalMaxTeams > 0
  const progressPct = hasProgress
    ? Math.min(100, Math.round((tournament.entry_count / totalMaxTeams) * 100))
    : 0

  // CTA 버튼 (모바일 세로/데스크탑 가로 레이아웃에서 공통 사용)
  const ctaButton = (() => {
    const baseClass =
      'block text-center text-sm font-semibold px-4 py-2.5 rounded-xl transition-all hover:opacity-90 @xl:py-3'
    if (isInProgress && tournament.hasBracket) {
      return (
        <Link
          href={`/tournaments/${tournament.id}/bracket`}
          className={baseClass}
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
        >
          대진표 보기
        </Link>
      )
    }
    if (isInProgress) {
      return (
        <Link
          href={`/tournaments/${tournament.id}`}
          className={baseClass}
          style={{
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
          }}
        >
          대회 보기
        </Link>
      )
    }
    return (
      <Link
        href={`/tournaments/${tournament.id}`}
        className={baseClass}
        style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
      >
        신청하기
      </Link>
    )
  })()

  return (
    <li role="listitem" className="@container">
      {/*
        레이아웃 전략:
        - 기본(모바일/좁은 카드): 1열 그리드로 세로 스택 (기존 모바일 순서 보존)
        - @xl (카드 폭 ≥576px): 3열 그리드
          col 1: 제목/배지/장소 (info)
          col 2: 진행바/부서 목록 (stats)
          col 3: CTA 버튼 (모든 행 span)
        각 요소를 @xl:col-start/@xl:row-start로 명시 배치해 모바일 DOM 순서와
        데스크탑 시각 순서를 독립적으로 관리.
      */}
      <div
        className="p-4 rounded-2xl grid grid-cols-1 gap-3 @xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_auto] @xl:gap-x-6 @xl:gap-y-2 @xl:p-5 @xl:items-start"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* 제목 — col1 row1 */}
        <div className="flex items-start gap-2 @xl:col-start-1 @xl:row-start-1">
          <Trophy
            className="w-4 h-4 shrink-0 mt-0.5 @xl:w-5 @xl:h-5"
            style={{ color: 'var(--accent-color)' }}
            aria-hidden="true"
          />
          <p
            className="text-base font-bold leading-snug @xl:text-lg"
            style={{ color: 'var(--text-primary)' }}
          >
            {tournament.title}
          </p>
        </div>

        {/* 상태 배지 + D-day — col1 row2 */}
        <div className="flex items-center gap-2 @xl:col-start-1 @xl:row-start-2">
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
          {ddayLabel && (
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--text-muted)' }}
            >
              {ddayLabel}
            </span>
          )}
        </div>

        {/* 진행률 바 — col2 row1 */}
        {hasProgress && (
          <div
            className="w-full rounded-full overflow-hidden @xl:col-start-2 @xl:row-start-1 @xl:self-center"
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

        {/* 부서별 신청 현황 — col2 row2~3 span */}
        {tournament.divisions && tournament.divisions.length > 0 ? (
          <div className="flex flex-col gap-0.5 @xl:col-start-2 @xl:row-start-2 @xl:row-end-4 @xl:gap-1">
            {tournament.divisions.map((div) => (
              <div
                key={div.name}
                className="flex items-center justify-between text-xs @xl:text-sm"
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
          <p
            className="text-xs @xl:col-start-2 @xl:row-start-2 @xl:row-end-4"
            style={{ color: 'var(--text-muted)' }}
          >
            {tournament.division_count}개 부서 · {tournament.entry_count}팀 신청
          </p>
        ) : null}

        {/* 장소 — col1 row3 */}
        {tournament.location && (
          <div
            className="flex items-center gap-1 text-xs min-w-0 @xl:col-start-1 @xl:row-start-3"
            style={{ color: 'var(--text-muted)' }}
          >
            <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{tournament.location}</span>
          </div>
        )}

        {/* CTA — col3 row1~3 span, 버튼은 수직 중앙 */}
        <div className="@xl:col-start-3 @xl:row-start-1 @xl:row-end-4 @xl:self-center @xl:w-44">
          {ctaButton}
        </div>
      </div>
    </li>
  )
}
