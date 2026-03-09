import Link from 'next/link'
import { Calendar } from 'lucide-react'
import { ClubSessionCard } from './ClubSessionCard'
import type { ClubSessionWithClub } from '@/lib/home/actions'

interface ClubScheduleSectionProps {
  sessions: ClubSessionWithClub[]
}

export function ClubScheduleSection({ sessions }: ClubScheduleSectionProps) {
  if (sessions.length === 0) return null

  return (
    <section aria-label="내 클럽 모임 일정">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5" style={{ color: 'var(--accent-color)' }} aria-hidden="true" />
          <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            내 클럽 모임 일정
          </h2>
        </div>
        <Link
          href="/my/clubs"
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          내 클럽 보기 →
        </Link>
      </div>

      <ul role="list" className="space-y-2">
        {sessions.map((s) => (
          <ClubSessionCard key={s.id} session={s} />
        ))}
      </ul>
    </section>
  )
}
