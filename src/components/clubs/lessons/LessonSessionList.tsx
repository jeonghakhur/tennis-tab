'use client'

import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Calendar, Clock, MapPin } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { LessonSession, LessonSessionStatus } from '@/lib/lessons/types'

const SESSION_STATUS_CONFIG: Record<LessonSessionStatus, { label: string; variant: BadgeVariant }> = {
  SCHEDULED: { label: '예정', variant: 'info' },
  COMPLETED: { label: '완료', variant: 'secondary' },
  CANCELLED: { label: '취소', variant: 'danger' },
}

interface LessonSessionListProps {
  sessions: LessonSession[]
  onSessionClick?: (session: LessonSession) => void
}

/** 시간 포맷: "09:00:00" → "09:00" */
function formatTime(time: string) {
  return time.slice(0, 5)
}

export function LessonSessionList({ sessions, onSessionClick }: LessonSessionListProps) {
  if (sessions.length === 0) {
    return (
      <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        등록된 레슨 일정이 없습니다.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {sessions.map((session) => {
        const statusConf = SESSION_STATUS_CONFIG[session.status]
        const sessionDate = parseISO(session.session_date)

        return (
          <button
            key={session.id}
            type="button"
            onClick={() => onSessionClick?.(session)}
            disabled={!onSessionClick}
            className="w-full text-left flex items-center gap-3 py-2.5 px-3 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--bg-card-hover)',
              cursor: onSessionClick ? 'pointer' : 'default',
            }}
          >
            {/* 날짜 */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {format(sessionDate, 'M/d (EEE)', { locale: ko })}
              </span>
            </div>

            {/* 시간 */}
            <div className="flex items-center gap-1 shrink-0">
              <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {formatTime(session.start_time)}~{formatTime(session.end_time)}
              </span>
            </div>

            {/* 장소 */}
            {session.location && (
              <div className="flex items-center gap-1 min-w-0">
                <MapPin className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                  {session.location}
                </span>
              </div>
            )}

            {/* 상태 뱃지 */}
            <div className="ml-auto shrink-0">
              <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
            </div>
          </button>
        )
      })}
    </div>
  )
}
