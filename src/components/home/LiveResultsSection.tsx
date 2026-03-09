import Link from 'next/link'
import { Activity } from 'lucide-react'
import type { LiveTournament } from '@/lib/home/actions'

interface LiveResultsSectionProps {
  tournaments: LiveTournament[]
}

export function LiveResultsSection({ tournaments }: LiveResultsSectionProps) {
  if (tournaments.length === 0) return null

  return (
    <section aria-label="진행 중인 대회 결과">
      {/* 섹션 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5" style={{ color: 'var(--accent-color)' }} aria-hidden="true" />
        <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
          진행 중인 대회
        </h2>
      </div>

      <div className="space-y-3">
        {tournaments.map((t) => (
          <div
            key={t.id}
            className="rounded-xl px-4 py-3"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            {/* 대회명 + 대진표 링크 */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {t.title}
              </h3>
              <Link
                href={`/tournaments/${t.id}/bracket`}
                className="shrink-0 text-xs ml-3 transition-opacity hover:opacity-70"
                style={{ color: 'var(--accent-color)' }}
              >
                대진표 →
              </Link>
            </div>

            {t.recentMatches.length > 0 ? (
              /* 최근 경기 결과 */
              <ul role="list" className="space-y-1.5">
                {t.recentMatches.map((m) => {
                  const team1Won = m.winnerEntryId === m.team1EntryId
                  const team2Won = m.winnerEntryId === m.team2EntryId

                  return (
                    <li
                      key={m.id}
                      role="listitem"
                      className="flex items-center gap-2 text-sm"
                    >
                      <span
                        className={`flex-1 truncate text-right ${team1Won ? 'font-semibold' : ''}`}
                        style={{ color: team1Won ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        {m.team1}
                      </span>
                      <span
                        className="shrink-0 tabular-nums font-mono text-xs px-2 py-0.5 rounded"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {m.score1 ?? '-'} : {m.score2 ?? '-'}
                      </span>
                      <span
                        className={`flex-1 truncate ${team2Won ? 'font-semibold' : ''}`}
                        style={{ color: team2Won ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                      >
                        {m.team2}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              /* 경기 결과 없음 — 대진표 바로 가기 */
              <Link
                href={`/tournaments/${t.id}/bracket`}
                className="flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-80"
                style={{
                  backgroundColor: 'var(--bg-card-hover)',
                  color: 'var(--text-secondary)',
                }}
              >
                대진표 바로 보기 →
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
