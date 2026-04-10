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

      {/*
        auto-fit: 빈 그리드 슬롯을 축소해 카드가 사용 가능한 폭을 채운다.
        - 카드 1개 → 섹션 전체 폭 점유 (데스크탑 빈공간 문제 해결)
        - 카드 다수 → minmax(280, 1fr)로 자연 흐름
        카드 내부 레이아웃은 @container + @xl:로 카드 폭 기반 반응형 처리.
      */}
      <ul
        role="list"
        className="grid gap-3"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
      >
        {tournaments.map((t) => (
          <ActiveTournamentCard key={t.id} tournament={t} />
        ))}
      </ul>
    </section>
  )
}
