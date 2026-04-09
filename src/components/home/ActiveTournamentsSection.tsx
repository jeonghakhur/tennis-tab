import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { ActiveTournamentCard } from './ActiveTournamentCard'
import type { ActiveTournament } from '@/lib/home/actions'

interface ActiveTournamentsSectionProps {
  tournaments: ActiveTournament[]
}

export function ActiveTournamentsSection({ tournaments }: ActiveTournamentsSectionProps) {
  if (tournaments.length === 0) return null

  return (
    <section aria-label="대회 현황">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5" style={{ color: 'var(--accent-color)' }} aria-hidden="true" />
          <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            대회 현황
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

      <ul
        role="list"
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))' }}
      >
        {tournaments.map((t) => (
          <ActiveTournamentCard key={t.id} tournament={t} />
        ))}
      </ul>
    </section>
  )
}
