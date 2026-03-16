'use client'

import Link from 'next/link'
import { User, Users, ChevronRight } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { LessonProgram, LessonProgramStatus } from '@/lib/lessons/types'

const STATUS_CONFIG: Record<LessonProgramStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: '준비 중', variant: 'secondary' },
  OPEN: { label: '모집 중', variant: 'success' },
  CLOSED: { label: '마감', variant: 'orange' },
  CANCELLED: { label: '취소', variant: 'danger' },
}

interface LessonProgramCardProps {
  program: LessonProgram
  clubId: string
}

export function LessonProgramCard({ program, clubId }: LessonProgramCardProps) {
  const enrollCount = program._enrollment_count || 0
  const ratio = Math.min(enrollCount / program.max_participants, 1)
  const statusConf = STATUS_CONFIG[program.status]

  return (
    <Link
      href={`/clubs/${clubId}/lessons/${program.id}`}
      className="block rounded-xl p-4 transition-colors hover:opacity-90"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div className="flex items-start gap-3">
        {/* 코치 아바타 */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--bg-card-hover)' }}
        >
          {program.coach?.profile_image_url ? (
            <img
              src={program.coach.profile_image_url}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <User className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* 제목 + 상태 */}
          <div className="flex items-center gap-2 mb-1">
            <h3
              className="font-medium text-sm truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {program.title}
            </h3>
            <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
          </div>

          {/* 레벨 + 코치명 */}
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            레벨: {program.target_level} · 코치: {program.coach?.name || '미정'}
          </p>

          {/* 정원 바 */}
          <div className="flex items-center gap-2 mt-2">
            <Users className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${ratio * 100}%`,
                  backgroundColor: ratio >= 1 ? 'var(--color-danger)' : 'var(--accent-color)',
                }}
              />
            </div>
            <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>
              {enrollCount}/{program.max_participants}명
            </span>
          </div>

          {/* 수강료 요약 */}
          {(program.fee_weekday_1 || program.fee_weekend_1) && (
            <p className="text-xs mt-1.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
              {[
                program.fee_weekday_1 ? `주중 ${program.fee_weekday_1.toLocaleString()}원` : null,
                program.fee_weekend_1 ? `주말 ${program.fee_weekend_1.toLocaleString()}원` : null,
              ].filter(Boolean).join(' / ')}
              {' '}· {program.session_duration_minutes}분
            </p>
          )}
        </div>

        <ChevronRight className="w-4 h-4 shrink-0 mt-1" style={{ color: 'var(--text-muted)' }} />
      </div>
    </Link>
  )
}
