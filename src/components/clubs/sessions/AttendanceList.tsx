'use client'

import { Badge } from '@/components/common/Badge'
import type { SessionAttendanceDetail, AttendanceStatus } from '@/lib/clubs/types'

const statusLabel: Record<AttendanceStatus, { text: string; variant: 'success' | 'secondary' | 'warning' }> = {
  ATTENDING: { text: '참석', variant: 'success' },
  NOT_ATTENDING: { text: '불참', variant: 'secondary' },
  UNDECIDED: { text: '미정', variant: 'warning' },
}

interface AttendanceListProps {
  attendances: SessionAttendanceDetail[]
  myMemberId?: string
  canRespond?: boolean
  onEdit?: () => void
}

export default function AttendanceList({ attendances, myMemberId, canRespond, onEdit }: AttendanceListProps) {
  const attending = attendances.filter((a) => a.status === 'ATTENDING')
  const notAttending = attendances.filter((a) => a.status === 'NOT_ATTENDING')
  const undecided = attendances.filter((a) => a.status === 'UNDECIDED')

  const renderRow = (a: SessionAttendanceDetail) => {
    const config = statusLabel[a.status]
    const isMe = a.club_member_id === myMemberId

    return (
      <div
        key={a.id}
        className={`flex items-center justify-between py-2 px-3 rounded-lg ${
          isMe ? 'bg-emerald-500/10' : ''
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-(--text-primary) truncate">
            {a.member.name}
            {isMe && <span className="text-xs text-(--text-muted) ml-1">(나)</span>}
          </span>
          {a.member.rating && (
            <span className="text-xs text-(--text-muted)">{a.member.rating}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* 참석 가능 시간 */}
          {a.status === 'ATTENDING' && (a.available_from || a.available_until) && (
            <span className="text-xs text-(--text-muted)">
              {a.available_from?.slice(0, 5) || '?'} ~ {a.available_until?.slice(0, 5) || '?'}
            </span>
          )}
          <Badge variant={config.variant}>{config.text}</Badge>
          {isMe && canRespond && onEdit && (
            <button
              onClick={onEdit}
              className="text-xs px-2 py-1 rounded border font-medium"
              style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
            >
              수정
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-3 mb-3">
        <h3 className="text-sm font-semibold text-(--text-primary)">참석 현황</h3>
        <div className="flex gap-2 text-xs">
          <span className="text-emerald-400">참석 {attending.length}</span>
          <span className="text-gray-400">불참 {notAttending.length}</span>
          {undecided.length > 0 && <span className="text-amber-400">미정 {undecided.length}</span>}
        </div>
      </div>

      {attendances.length === 0 ? (
        <p className="text-sm text-(--text-muted) py-4 text-center">
          아직 응답이 없습니다.
        </p>
      ) : (
        <div className="space-y-1">
          {/* 참석 → 미정 → 불참 순 */}
          {attending.map(renderRow)}
          {undecided.map(renderRow)}
          {notAttending.map(renderRow)}
        </div>
      )}
    </div>
  )
}
