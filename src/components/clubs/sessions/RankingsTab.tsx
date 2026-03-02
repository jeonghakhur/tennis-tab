'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { getClubRankingsByPeriod, type RankingPeriod } from '@/lib/clubs/session-actions'

const PERIOD_LABELS: Record<RankingPeriod, string> = {
  all: '전체',
  this_month: '이번 달',
  last_month: '저번 달',
  this_year: '올해',
  last_year: '작년',
}

interface RankingsTabProps {
  clubId: string
  myMemberId?: string
}

export default function RankingsTab({ clubId, myMemberId }: RankingsTabProps) {
  const [period, setPeriod] = useState<RankingPeriod>('all')
  const [rankings, setRankings] = useState<Awaited<ReturnType<typeof getClubRankingsByPeriod>>>([])
  const [loading, setLoading] = useState(true)

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    const data = await getClubRankingsByPeriod(clubId, period)
    setRankings(data)
    setLoading(false)
  }, [clubId, period])

  useEffect(() => {
    fetchRankings()
  }, [fetchRankings])

  return (
    <div className="space-y-4">
      {/* 기간 필터 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-(--text-primary)">클럽 순위</h3>
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(PERIOD_LABELS) as RankingPeriod[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                period === p
                  ? 'bg-(--accent-color) text-(--bg-primary)'
                  : 'bg-(--bg-secondary) text-(--text-muted) hover:text-(--text-primary)'
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-(--text-muted) text-sm">불러오는 중...</div>
      ) : rankings.length === 0 ? (
        <div className="text-center py-12 text-(--text-muted) text-sm">
          {PERIOD_LABELS[period]} 경기 기록이 없습니다.
        </div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="grid grid-cols-[40px_1fr_60px_60px_60px_70px] gap-1 px-4 py-2.5 text-xs font-semibold text-(--text-muted) border-b border-(--border-color)">
            <span className="text-center">#</span>
            <span>이름</span>
            <span className="text-center">경기</span>
            <span className="text-center">승</span>
            <span className="text-center">패</span>
            <span className="text-center">승률</span>
          </div>

          {rankings.map((stat, index) => {
            const isMe = stat.member.id === myMemberId
            const rank = index + 1

            return (
              <div
                key={stat.member.id}
                className={`grid grid-cols-[40px_1fr_60px_60px_60px_70px] gap-1 px-4 py-2.5 text-sm border-b border-(--border-color) last:border-0 ${
                  isMe ? 'bg-emerald-500/10' : ''
                }`}
              >
                <span className={`text-center font-bold ${rank <= 3 ? 'text-(--accent-color)' : 'text-(--text-muted)'}`}>
                  {rank}
                </span>

                <Link
                  href={`/clubs/${clubId}/members/${stat.member.id}`}
                  className="text-(--text-primary) truncate hover:text-(--accent-color) transition-colors"
                >
                  {stat.member.name}
                  {isMe && <span className="text-xs text-(--text-muted) ml-1">(나)</span>}
                  {stat.member.rating && (
                    <span className="text-xs text-(--text-muted) ml-1">{stat.member.rating}</span>
                  )}
                </Link>

                <span className="text-center text-(--text-secondary)">{stat.total}</span>
                <span className="text-center text-emerald-400">{stat.wins}</span>
                <span className="text-center text-rose-400">{stat.losses}</span>
                <span className="text-center font-semibold text-(--text-primary)">{stat.win_rate}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
