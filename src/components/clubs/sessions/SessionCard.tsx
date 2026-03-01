'use client'

import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { ClubSession, ClubSessionStatus, AttendanceStatus } from '@/lib/clubs/types'

// 세션 상태별 뱃지 설정
const statusConfig: Record<ClubSessionStatus, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: '모집중', variant: 'success' },
  CLOSED: { label: '마감', variant: 'secondary' },
  CANCELLED: { label: '취소', variant: 'danger' },
  COMPLETED: { label: '완료', variant: 'info' },
}

// 내 응답 상태별 색상
const myAttendanceColor: Record<AttendanceStatus, string> = {
  ATTENDING: 'border-l-emerald-500',
  NOT_ATTENDING: 'border-l-gray-400',
  UNDECIDED: 'border-l-amber-500',
}

interface SessionCardProps {
  session: ClubSession
  onClick: () => void
  onEdit?: () => void
  isOfficer?: boolean
}

export default function SessionCard({ session, onClick, onEdit, isOfficer }: SessionCardProps) {
  const config = statusConfig[session.status]
  const borderClass = session._my_attendance
    ? myAttendanceColor[session._my_attendance]
    : 'border-l-transparent'

  // 날짜 포맷 (03/15 토)
  const dateObj = new Date(session.session_date + 'T00:00:00')
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const formatted = `${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')} ${dayNames[dateObj.getDay()]}`

  // 시간 포맷
  const timeRange = `${session.start_time.slice(0, 5)} ~ ${session.end_time.slice(0, 5)}`

  return (
    <button
      onClick={onClick}
      className={`glass-card rounded-xl p-4 w-full text-left transition-all border-l-4 ${borderClass}`}
    >
      {/* 제목 + 상태 뱃지 + 수정 */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-(--text-primary) truncate pr-2">
          {session.title}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={config.variant}>{config.label}</Badge>
          {isOfficer && session.status === 'OPEN' && onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="text-xs px-2 py-0.5 rounded border border-(--border-color) text-(--text-muted) hover:text-(--text-primary) hover:border-(--accent-color) transition-colors"
            >
              수정
            </button>
          )}
        </div>
      </div>

      {/* 날짜, 시간, 장소 */}
      <div className="space-y-1 text-sm text-(--text-secondary)">
        <div className="flex items-center gap-2">
          <span>📅</span>
          <span>{formatted}</span>
          <span className="text-(--text-muted)">|</span>
          <span>{timeRange}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>📍</span>
          <span className="truncate">{session.venue_name}</span>
          {session.court_numbers.length > 0 && (
            <span className="text-(--text-muted)">
              ({session.court_numbers.join(', ')})
            </span>
          )}
        </div>
      </div>

      {/* 참석 현황 */}
      <div className="flex items-center gap-3 mt-3 text-xs">
        <span className="text-emerald-400">
          참석 {session._attending_count ?? 0}
        </span>
        <span className="text-gray-400">
          불참 {session._not_attending_count ?? 0}
        </span>
        <span className="text-amber-400">
          미정 {session._undecided_count ?? 0}
        </span>
        {session.max_attendees && (
          <span className="text-(--text-muted) ml-auto">
            정원 {session.max_attendees}명
          </span>
        )}
      </div>
    </button>
  )
}
