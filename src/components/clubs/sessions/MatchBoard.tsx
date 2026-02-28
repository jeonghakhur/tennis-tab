'use client'

import { useState } from 'react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import MatchResultForm from './MatchResultForm'
import type { ClubMatchResult, MatchResultStatus } from '@/lib/clubs/types'

const statusConfig: Record<MatchResultStatus, { label: string; variant: BadgeVariant }> = {
  SCHEDULED: { label: '예정', variant: 'secondary' },
  COMPLETED: { label: '완료', variant: 'success' },
  DISPUTED: { label: '분쟁', variant: 'danger' },
  CANCELLED: { label: '취소', variant: 'warning' },
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
        <p className="text-sm text-(--text-muted) py-4 text-center">
          아직 대진이 편성되지 않았습니다.
        </p>
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
            const isMyMatch =
              myMemberId === match.player1_member_id ||
              myMemberId === match.player2_member_id
            const config = statusConfig[match.status]

            // 내 경기면서 SCHEDULED → 결과 입력 가능
            const canReport = isMyMatch && match.status === 'SCHEDULED'

            return (
              <div
                key={match.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isMyMatch
                    ? 'bg-emerald-500/10 border-emerald-500/30'
                    : 'border-(--border-color)'
                }`}
              >
                {/* 코트 번호 */}
                {match.court_number && (
                  <span className="text-xs text-(--text-muted) w-8 shrink-0">
                    {match.court_number}
                  </span>
                )}

                {/* 선수 1 */}
                <span
                  className={`flex-1 text-sm text-right truncate ${
                    match.winner_member_id === match.player1_member_id
                      ? 'font-bold text-emerald-400'
                      : 'text-(--text-primary)'
                  }`}
                >
                  {match.player1?.name || '선수1'}
                </span>

                {/* 스코어 or VS */}
                <div className="w-16 text-center shrink-0">
                  {match.status === 'COMPLETED' ? (
                    <span className="text-sm font-mono font-semibold text-(--text-primary)">
                      {match.player1_score} : {match.player2_score}
                    </span>
                  ) : (
                    <span className="text-xs text-(--text-muted)">VS</span>
                  )}
                </div>

                {/* 선수 2 */}
                <span
                  className={`flex-1 text-sm truncate ${
                    match.winner_member_id === match.player2_member_id
                      ? 'font-bold text-emerald-400'
                      : 'text-(--text-primary)'
                  }`}
                >
                  {match.player2?.name || '선수2'}
                </span>

                {/* 상태 뱃지 or 결과 입력 버튼 */}
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
            )
          })}
        </div>
      </div>

      {/* 결과 입력 모달 */}
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
