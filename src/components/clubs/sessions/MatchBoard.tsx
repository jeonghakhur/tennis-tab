'use client'

import { useState } from 'react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import MatchResultForm from './MatchResultForm'
import type { ClubMatchResult, MatchResultStatus, MatchType } from '@/lib/clubs/types'

const statusConfig: Record<MatchResultStatus, { label: string; variant: BadgeVariant }> = {
  SCHEDULED: { label: '예정', variant: 'secondary' },
  COMPLETED: { label: '완료', variant: 'success' },
  DISPUTED: { label: '분쟁', variant: 'danger' },
  CANCELLED: { label: '취소', variant: 'warning' },
}

const matchTypeBadge: Record<MatchType, string> = {
  singles: '🏃 단식',
  doubles_men: '🔵 남복',
  doubles_women: '🔴 여복',
  doubles_mixed: '🎾 혼복',
}

interface MatchBoardProps {
  matches: ClubMatchResult[]
  myMemberId?: string
  onRefresh: () => void
}

export default function MatchBoard({ matches, myMemberId, onRefresh }: MatchBoardProps) {
  const [selectedMatch, setSelectedMatch] = useState<ClubMatchResult | null>(null)

  if (matches.length === 0) {
    return (
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-(--text-primary) mb-2">대진표</h3>
        <p className="text-sm text-(--text-muted) py-4 text-center">아직 대진이 편성되지 않았습니다.</p>
      </div>
    )
  }

  return (
    <>
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-(--text-primary) mb-3">
          대진표 ({matches.length}경기)
        </h3>

        <div className="space-y-2">
          {matches.map((match) => {
            const type = match.match_type || 'singles'
            const isDoubles = type !== 'singles'
            const isMyMatch =
              myMemberId === match.player1_member_id ||
              myMemberId === match.player2_member_id ||
              myMemberId === match.player1b_member_id ||
              myMemberId === match.player2b_member_id
            const config = statusConfig[match.status]
            const canReport = isMyMatch && match.status === 'SCHEDULED'

            // 팀 표시
            const team1Name = isDoubles
              ? `${match.player1?.name || '?'} / ${match.player1b?.name || '?'}`
              : (match.player1?.name || '선수1')
            const team2Name = isDoubles
              ? `${match.player2?.name || '?'} / ${match.player2b?.name || '?'}`
              : (match.player2?.name || '선수2')

            // 팀1 승리 여부 (복식: winner_member_id가 팀1 멤버 중 하나인지)
            const team1Won = match.winner_member_id !== null && (
              match.winner_member_id === match.player1_member_id ||
              match.winner_member_id === match.player1b_member_id
            )
            const team2Won = match.winner_member_id !== null && (
              match.winner_member_id === match.player2_member_id ||
              match.winner_member_id === match.player2b_member_id
            )

            return (
              <div
                key={match.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isMyMatch
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'border-(--border-color)'
                }`}
              >
                {/* 매치 타입 배지 + 코트 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-(--text-muted) bg-(--bg-secondary) px-1.5 py-0.5 rounded">
                    {matchTypeBadge[type as MatchType]}
                  </span>
                  {match.court_number && (
                    <span className="text-xs text-(--text-muted)">{match.court_number}</span>
                  )}
                  {match.scheduled_time && (
                    <span className="text-xs text-(--text-muted)">{match.scheduled_time}</span>
                  )}
                </div>

                {/* 대진 표시 */}
                <div className="flex items-center gap-3">
                  <span className={`flex-1 text-sm text-right ${team1Won ? 'font-bold text-emerald-400' : 'text-(--text-primary)'}`}>
                    {team1Name}
                  </span>

                  <div className="w-16 text-center shrink-0">
                    {match.status === 'COMPLETED' ? (
                      <span className="text-sm font-mono font-semibold text-(--text-primary)">
                        {match.player1_score} : {match.player2_score}
                      </span>
                    ) : (
                      <span className="text-xs text-(--text-muted)">VS</span>
                    )}
                  </div>

                  <span className={`flex-1 text-sm ${team2Won ? 'font-bold text-emerald-400' : 'text-(--text-primary)'}`}>
                    {team2Name}
                  </span>

                  <div className="shrink-0">
                    {canReport ? (
                      <button
                        onClick={() => setSelectedMatch(match)}
                        className="px-2 py-1 text-xs rounded-md bg-(--accent-color) text-(--bg-primary) font-semibold"
                      >
                        결과 입력
                      </button>
                    ) : (
                      <Badge variant={config.variant}>{config.label}</Badge>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedMatch && myMemberId && (
        <MatchResultForm
          match={selectedMatch}
          myMemberId={myMemberId}
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          onReported={() => {
            setSelectedMatch(null)
            onRefresh()
          }}
        />
      )}
    </>
  )
}
