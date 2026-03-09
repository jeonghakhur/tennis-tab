import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { DeadlineTournamentCard } from './DeadlineTournamentCard'
import type { DeadlineTournament } from '@/lib/home/actions'

interface UpcomingDeadlinesSectionProps {
  tournaments: DeadlineTournament[]
}

export function UpcomingDeadlinesSection({ tournaments }: UpcomingDeadlinesSectionProps) {
  if (tournaments.length === 0) return null

  return (
    <section aria-label="마감 임박 대회">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5" style={{ color: 'var(--accent-color)' }} aria-hidden="true" />
          <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            모집 중 대회
          </h2>
        </div>
        <Link
          href="/tournaments"
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          전체 보기 →
        </Link>
      </div>

      <ul role="list" className="space-y-2">
        {tournaments.map((t) => (
          <DeadlineTournamentCard key={t.id} tournament={t} />
        ))}
      </ul>
    </section>
  )
}
