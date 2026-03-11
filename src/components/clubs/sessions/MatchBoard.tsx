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

const matchTypeBadge: Record<string, string> = {
  singles: '단식',
  doubles: '복식',
  doubles_men: '남복',
  doubles_women: '여복',
  doubles_mixed: '혼복',
}

interface MatchBoardProps {
  matches: ClubMatchResult[]
  myMemberId?: string
  /** 점수 입력 가능 여부 (마감 + 시작시간 도달 + 미완료) */
  canInputScore?: boolean
  /** 임원 여부 — true면 모든 경기 점수 입력 가능 */
  isOfficer?: boolean
  onRefresh: () => void
}

export default function MatchBoard({ matches, myMemberId, canInputScore = false, isOfficer = false, onRefresh }: MatchBoardProps) {
  const [selectedMatch, setSelectedMatch] = useState<ClubMatchResult | null>(null)
  const [officerOverride, setOfficerOverride] = useState(false)

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

            // 팀 표시 (member 우선, 없으면 guest 폴백)
            const p1Name = match.player1?.name ?? match.player1_guest?.name ?? '?'
            const p2Name = match.player2?.name ?? match.player2_guest?.name ?? '?'
            const p1bName = match.player1b?.name ?? match.player1b_guest?.name
            const p2bName = match.player2b?.name ?? match.player2b_guest?.name
            const team1Name = isDoubles
              ? `${p1Name} / ${p1bName ?? '?'}`
              : p1Name
            const team2Name = isDoubles
              ? `${p2Name} / ${p2bName ?? '?'}`
              : p2Name

            // 게스트 포함 여부 (배지 표시용)
            const hasGuest =
              !!match.player1_guest_id || !!match.player2_guest_id ||
              !!match.player1b_guest_id || !!match.player2b_guest_id

            // 게스트 포함 경기는 임원만 점수 입력 가능
            // 임원: 취소 제외 모든 경기, 상태·시간 무관
            // 일반: 마감+시작 후 내 경기(SCHEDULED)만
            const canReport = match.status !== 'CANCELLED' && (
              isOfficer
                ? true
                : !hasGuest && canInputScore && isMyMatch && match.status === 'SCHEDULED'
            )

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
                    ? 'bg-(--color-success-subtle) border-(--color-success-border)'
                    : 'border-(--border-color)'
                }`}
              >
                {/* 매치 타입 배지 + 코트 */}
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-sm font-semibold text-(--text-secondary) bg-(--bg-secondary) px-2 py-0.5 rounded">
                    {matchTypeBadge[type] ?? '경기'}
                  </span>
                  {hasGuest && (
                    <span className="text-sm px-2 py-0.5 rounded font-semibold" style={{ backgroundColor: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}>
                      게스트
                    </span>
                  )}
                  {match.court_number && (
                    <span className="text-sm text-(--text-secondary)">{match.court_number}</span>
                  )}
                  {match.scheduled_time && (
                    <span className="text-sm font-medium text-(--text-secondary)">{match.scheduled_time}</span>
                  )}
                </div>

                {/* 대진 표시 */}
                <div className="flex items-center gap-3">
                  <span className={`flex-1 text-base text-right font-medium ${team1Won ? 'font-bold text-(--color-success)' : 'text-(--text-primary)'}`}>
                    {team1Name}
                  </span>

                  <div className="w-16 text-center shrink-0">
                    {match.status === 'COMPLETED' ? (
                      <span className="text-base font-mono font-bold text-(--text-primary)">
                        {match.player1_score} : {match.player2_score}
                      </span>
                    ) : (
                      <span className="text-sm font-semibold text-(--text-secondary)">VS</span>
                    )}
                  </div>

                  <span className={`flex-1 text-base font-medium ${team2Won ? 'font-bold text-(--color-success)' : 'text-(--text-primary)'}`}>
                    {team2Name}
                  </span>

                  <div className="shrink-0">
                    {canReport ? (
                      <button
                        onClick={() => {
                          setSelectedMatch(match)
                          // 게스트 포함 경기는 항상 임원 모드로 열림
                          setOfficerOverride(isOfficer || hasGuest)
                        }}
                        className="px-3 py-1.5 text-sm rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold"
                      >
                        {isOfficer && match.status === 'COMPLETED' ? '점수 수정' : '결과 입력'}
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

      {selectedMatch && (officerOverride || myMemberId) && (
        <MatchResultForm
          match={selectedMatch}
          myMemberId={myMemberId || ''}
          isOfficerOverride={officerOverride}
          isOpen={!!selectedMatch}
          onClose={() => { setSelectedMatch(null); setOfficerOverride(false) }}
          onReported={() => {
            setSelectedMatch(null)
            setOfficerOverride(false)
            onRefresh()
          }}
        />
      )}
    </>
  )
}
