'use client'

import { useState, useEffect, useCallback } from 'react'
import { getClubRankings } from '@/lib/clubs/session-actions'
import type { ClubMemberStatWithMember } from '@/lib/clubs/types'

interface RankingsTabProps {
  clubId: string
  myMemberId?: string
}

export default function RankingsTab({ clubId, myMemberId }: RankingsTabProps) {
  const [season, setSeason] = useState(() => String(new Date().getFullYear()))
  const [rankings, setRankings] = useState<ClubMemberStatWithMember[]>([])
  const [loading, setLoading] = useState(true)
  const currentYear = parseInt(season)

  // 시즌 옵션 (현재 연도 ~ 2년 전)
  const seasonOptions = Array.from({ length: 3 }, (_, i) => String(currentYear - i))

  const fetchRankings = useCallback(async () => {
    setLoading(true)
    const data = await getClubRankings(clubId, season)
    setRankings(data)
    setLoading(false)
  }, [clubId, season])

  useEffect(() => {
    fetchRankings()
  }, [fetchRankings])

  return (
    <div className="space-y-4">
      {/* 시즌 선택 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-(--text-primary)">클럽 순위</h3>
        <select
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none"
          aria-label="시즌 선택"
        >
          {seasonOptions.map((y) => (
            <option key={y} value={y}>{y}년</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-(--text-muted) text-sm">
          불러오는 중...
        </div>
      ) : rankings.length === 0 ? (
        <div className="text-center py-12 text-(--text-muted) text-sm">
          {season}년 경기 기록이 없습니다.
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

          {/* 테이블 바디 */}
          {rankings.map((stat, index) => {
            const isMe = stat.club_member_id === myMemberId
            const rank = index + 1

            return (
              <div
                key={stat.id}
                className={`grid grid-cols-[40px_1fr_60px_60px_60px_70px] gap-1 px-4 py-2.5 text-sm border-b border-(--border-color) last:border-0 ${
                  isMe ? 'bg-emerald-500/10' : ''
                }`}
              >
                {/* 순위 */}
                <span className={`text-center font-bold ${
                  rank <= 3 ? 'text-(--accent-color)' : 'text-(--text-muted)'
                }`}>
                  {rank}
                </span>

                {/* 이름 + 레이팅 */}
                <span className="text-(--text-primary) truncate">
                  {stat.member.name}
                  {isMe && <span className="text-xs text-(--text-muted) ml-1">(나)</span>}
                  {stat.member.rating && (
                    <span className="text-xs text-(--text-muted) ml-1">{stat.member.rating}</span>
                  )}
                </span>

                {/* 경기수 */}
                <span className="text-center text-(--text-secondary)">{stat.total_games}</span>

                {/* 승 */}
                <span className="text-center text-emerald-400">{stat.wins}</span>

                {/* 패 */}
                <span className="text-center text-rose-400">{stat.losses}</span>

                {/* 승률 */}
                <span className="text-center font-semibold text-(--text-primary)">
                  {stat.win_rate}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
