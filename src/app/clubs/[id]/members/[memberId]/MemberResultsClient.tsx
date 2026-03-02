'use client'

import { useState, useCallback } from 'react'
import { getMemberGameResults, type RankingPeriod, type MemberGameResult } from '@/lib/clubs/session-actions'

const PERIOD_LABELS: Record<RankingPeriod, string> = {
  all: '전체',
  this_month: '이번 달',
  last_month: '저번 달',
  this_year: '올해',
  last_year: '작년',
}

const MATCH_TYPE_LABELS = {
  singles: '🏃 단식',
  doubles_men: '🔵 남복',
  doubles_women: '🔴 여복',
  doubles_mixed: '🎾 혼복',
}

interface Props {
  clubId: string
  memberId: string
  initialResults: MemberGameResult[]
  initialStats: { total: number; wins: number; losses: number; win_rate: number }
}

// 세션별 그룹핑
function groupBySession(results: MemberGameResult[]) {
  const map = new Map<string, { session_id: string; session_title: string; session_date: string; matches: MemberGameResult[] }>()
  for (const r of results) {
    if (!map.has(r.session_id)) {
      map.set(r.session_id, { session_id: r.session_id, session_title: r.session_title, session_date: r.session_date, matches: [] })
    }
    map.get(r.session_id)!.matches.push(r)
  }
  return Array.from(map.values())
}

export default function MemberResultsClient({ clubId, memberId, initialResults, initialStats }: Props) {
  const [period, setPeriod] = useState<RankingPeriod>('all')
  const [results, setResults] = useState<MemberGameResult[]>(initialResults)
  const [stats, setStats] = useState(initialStats)
  const [loading, setLoading] = useState(false)

  const handlePeriodChange = useCallback(async (p: RankingPeriod) => {
    setPeriod(p)
    setLoading(true)
    const data = await getMemberGameResults(clubId, memberId, p)
    setResults(data.results)
    setStats(data.stats)
    setLoading(false)
  }, [clubId, memberId])

  const grouped = groupBySession(results)

  // 상대 전적 계산
  const opponentMap = new Map<string, { name: string; wins: number; losses: number }>()
  for (const r of results) {
    const opps = [r.opponent1, r.opponent2].filter(Boolean) as { id: string; name: string }[]
    for (const opp of opps) {
      if (!opponentMap.has(opp.id)) {
        opponentMap.set(opp.id, { name: opp.name, wins: 0, losses: 0 })
      }
      const s = opponentMap.get(opp.id)!
      if (r.is_win) s.wins++
      else if (r.is_win === false) s.losses++
    }
  }
  const opponents = Array.from(opponentMap.entries())
    .map(([id, s]) => ({ id, ...s, total: s.wins + s.losses }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  return (
    <div className="space-y-4">
      {/* 기간 필터 */}
      <div className="flex gap-1 flex-wrap">
        {(Object.keys(PERIOD_LABELS) as RankingPeriod[]).map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition-colors ${
              period === p
                ? 'bg-(--accent-color) text-(--bg-primary)'
                : 'bg-(--bg-secondary) text-(--text-muted) hover:text-(--text-primary)'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '총 경기', value: stats.total, color: 'text-(--text-primary)' },
          { label: '승', value: stats.wins, color: 'text-emerald-400' },
          { label: '패', value: stats.losses, color: 'text-rose-400' },
          { label: '승률', value: `${stats.win_rate}%`, color: 'text-(--accent-color)' },
        ].map((s) => (
          <div key={s.label} className="glass-card rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-(--text-muted) mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 상대 전적 */}
      {opponents.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-(--text-primary) mb-3">상대 전적 (상위 5명)</h3>
          <div className="space-y-2">
            {opponents.map((o) => (
              <div key={o.id} className="flex items-center justify-between">
                <span className="text-sm text-(--text-primary)">{o.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-400 font-semibold">{o.wins}승</span>
                  <span className="text-(--text-muted)">/</span>
                  <span className="text-rose-400 font-semibold">{o.losses}패</span>
                  <span className="text-(--text-muted)">({o.total}전)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 세션별 경기 목록 */}
      {loading ? (
        <div className="text-center py-12 text-(--text-muted) text-sm">불러오는 중...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-12 text-(--text-muted) text-sm glass-card rounded-xl">
          {PERIOD_LABELS[period]} 기록이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((session) => (
            <div key={session.session_id} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold text-(--text-primary)">{session.session_title}</div>
                  <div className="text-xs text-(--text-muted)">{session.session_date}</div>
                </div>
                <div className="text-xs text-(--text-muted)">
                  {session.matches.filter((m) => m.is_win).length}승 {session.matches.filter((m) => m.is_win === false).length}패
                </div>
              </div>
              <div className="space-y-2">
                {session.matches.map((match) => {
                  const isDoubles = match.match_type !== 'singles'
                  const oppName = isDoubles
                    ? `${match.opponent1?.name || '?'} / ${match.opponent2?.name || '?'}`
                    : (match.opponent1?.name || '?')
                  const partnerName = isDoubles && match.partner ? ` (파트너: ${match.partner.name})` : ''

                  return (
                    <div
                      key={match.id}
                      className={`flex items-center justify-between p-2 rounded-lg ${
                        match.is_win ? 'bg-emerald-500/10' : match.is_win === false ? 'bg-rose-500/10' : 'bg-(--bg-secondary)'
                      }`}
                    >
                      <div>
                        <span className="text-xs text-(--text-muted) mr-1">
                          {MATCH_TYPE_LABELS[match.match_type] || '🏃'}
                        </span>
                        <span className="text-sm text-(--text-primary)">vs {oppName}</span>
                        {partnerName && <span className="text-xs text-(--text-muted) ml-1">{partnerName}</span>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-mono font-semibold text-(--text-primary)">
                          {match.my_score} : {match.opponent_score}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          match.is_win
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : match.is_win === false
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-(--bg-secondary) text-(--text-muted)'
                        }`}>
                          {match.is_win ? '승' : match.is_win === false ? '패' : '-'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
