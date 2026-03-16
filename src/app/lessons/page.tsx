'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { User, Users, ChevronRight, BookOpen } from 'lucide-react'
import { getAllOpenLessonPrograms } from '@/lib/lessons/actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { LessonProgram } from '@/lib/lessons/types'

const LEVEL_VARIANTS: Record<string, BadgeVariant> = {
  입문: 'info',
  초급: 'success',
  중급: 'warning',
  고급: 'orange',
  전체: 'secondary',
}

export default function LessonsPage() {
  const [programs, setPrograms] = useState<LessonProgram[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAllOpenLessonPrograms().then(({ data }) => {
      setPrograms(data)
      setLoading(false)
    })
  }, [])

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)', minHeight: '100vh' }}>
      <div className="max-w-content mx-auto px-6 py-12">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
            <h1 className="text-2xl font-display" style={{ color: 'var(--text-primary)' }}>
              레슨 문의
            </h1>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            현재 모집 중인 레슨 프로그램을 확인하고 문의하세요.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            ))}
          </div>
        ) : programs.length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              현재 모집 중인 레슨 프로그램이 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map((program) => (
              <ProgramCard key={program.id} program={program} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ProgramCard({ program }: { program: LessonProgram }) {
  const enrollCount = program._enrollment_count || 0
  const ratio = Math.min(enrollCount / program.max_participants, 1)
  const levelVariant = LEVEL_VARIANTS[program.target_level] ?? 'secondary'

  return (
    <Link
      href={`/lessons/${program.id}`}
      className="block rounded-xl p-4 transition-colors hover:opacity-90"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--bg-card-hover)' }}
        >
          {program.coach?.profile_image_url ? (
            <img src={program.coach.profile_image_url} alt="" className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <User className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {program.title}
            </h3>
            <Badge variant={levelVariant}>{program.target_level}</Badge>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            코치: {program.coach?.name || '미정'}
          </p>

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
