import Link from 'next/link'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { ClubSessionWithClub } from '@/lib/home/actions'
import type { AttendanceStatus } from '@/lib/clubs/types'

interface ClubSessionCardProps {
  session: ClubSessionWithClub
}

/** session_date + start_time → "내일 (목) 10:00" 형식 */
function formatSessionDateTime(date: string, startTime: string): string {
  const sessionDate = new Date(`${date}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.round((sessionDate.getTime() - today.getTime()) / 86400000)

  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const dayName = dayNames[sessionDate.getDay()]
  const time = startTime.slice(0, 5) // "HH:MM"

  if (diffDays === 0) return `오늘 (${dayName}) ${time}`
  if (diffDays === 1) return `내일 (${dayName}) ${time}`
  if (diffDays < 7) return `${diffDays}일 후 (${dayName}) ${time}`

  const month = sessionDate.getMonth() + 1
  const day = sessionDate.getDate()
  return `${month}/${day} (${dayName}) ${time}`
}

const ATTENDANCE_CONFIG: Record<AttendanceStatus, { label: string; variant: BadgeVariant }> = {
  ATTENDING: { label: '참석', variant: 'success' },
  NOT_ATTENDING: { label: '미참석', variant: 'danger' },
  UNDECIDED: { label: '미정', variant: 'secondary' },
}

export function ClubSessionCard({ session }: ClubSessionCardProps) {
  const attendanceInfo = session.myAttendance
    ? ATTENDANCE_CONFIG[session.myAttendance]
    : null

  return (
    <li role="listitem">
      <Link
        href={`/clubs/${session.club_id}/sessions/${session.id}`}
        className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:opacity-80"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
        }}
      >
        {/* 테니스 공 아이콘 */}
        <div
          className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-base"
          style={{ backgroundColor: 'var(--bg-card-hover)' }}
          aria-hidden="true"
        >
          🎾
        </div>

        {/* 세션 정보 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {session.club_name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {formatSessionDateTime(session.session_date, session.start_time)} · {session.venue_name}
          </p>
        </div>

        {/* 출석 상태 배지 */}
        {attendanceInfo ? (
          <Badge variant={attendanceInfo.variant}>{attendanceInfo.label}</Badge>
        ) : (
          <Badge variant="secondary">미응답</Badge>
        )}
      </Link>
    </li>
  )
}
