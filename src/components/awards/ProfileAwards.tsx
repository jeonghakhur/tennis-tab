'use client'

import { useState, useTransition } from 'react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { claimAward } from '@/lib/awards/actions'
import type { Database } from '@/lib/supabase/types'
import { groupAwardsForDisplay, RANK_ORDER } from './awardGrouping'

type Award = Database['public']['Tables']['tournament_awards']['Row']

const RANK_BADGE: Record<string, BadgeVariant> = {
  '우승': 'warning',
  '준우승': 'secondary',
  '공동3위': 'info',
  '3위': 'info',
}

interface Props {
  awards: Award[]
  myAwardIds: string[]
  userId: string
}

export function ProfileAwards({ awards, myAwardIds: initialMyAwardIds, userId }: Props) {
  // 클레임 완료된 레코드 ID 추적 (낙관적 업데이트)
  const [claimedIds, setClaimedIds] = useState<Set<string>>(
    () => new Set(
      awards
        .filter((a) => initialMyAwardIds.includes(a.id) && a.player_user_ids?.includes(userId))
        .map((a) => a.id)
    )
  )
  const [isPending, startTransition] = useTransition()
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const myAwardIdSet = new Set(initialMyAwardIds)

  const handleClaim = (recordId: string) => {
    setClaimingId(recordId)
    startTransition(async () => {
      const result = await claimAward(recordId)
      setClaimingId(null)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error })
      } else {
        setClaimedIds((prev) => new Set([...prev, recordId]))
        setToast({ isOpen: true, message: '내 기록으로 등록했습니다.' })
      }
    })
  }

  if (awards.length === 0) {
    return (
      <div
        className="text-center py-16 rounded-2xl border border-dashed"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <p className="text-lg mb-2" style={{ color: 'var(--text-muted)' }}>
          입상 기록이 없습니다
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          대회 입상 후 이름이 일치하면 자동으로 표시됩니다
        </p>
      </div>
    )
  }

  // 통계
  const wins = awards.filter((a) => a.award_rank === '우승').length
  const runnerUps = awards.filter((a) => a.award_rank === '준우승').length
  const thirds = awards.filter((a) => a.award_rank === '공동3위' || a.award_rank === '3위').length

  // 연도별 그룹핑
  const byYear = awards.reduce<Record<number, Award[]>>((acc, a) => {
    if (!acc[a.year]) acc[a.year] = []
    acc[a.year].push(a)
    return acc
  }, {})

  return (
    <>
      {/* 통계 카드 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '우승', value: wins, variant: 'warning' as const },
          { label: '준우승', value: runnerUps, variant: 'secondary' as const },
          { label: '3위', value: thirds, variant: 'info' as const },
        ].map(({ label, value, variant }) => (
          <div
            key={label}
            className="rounded-xl p-3 text-center"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              {value}
            </p>
            <Badge variant={variant}>{label}</Badge>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        {Object.entries(byYear)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, yearAwards]) => {
            // 유저 레코드가 속한 그룹만 표시
            const groups = groupAwardsForDisplay(yearAwards, myAwardIdSet, userId)
              .filter((g) => g.myRecordId !== undefined)
              .sort((a, b) => {
                const compDiff = a.competition.localeCompare(b.competition, 'ko')
                if (compDiff !== 0) return compDiff
                return (RANK_ORDER[a.award_rank] ?? 9) - (RANK_ORDER[b.award_rank] ?? 9)
              })

            if (groups.length === 0) return null

            return (
              <section key={year}>
                <h3
                  className="text-lg font-display mb-3"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {year}년
                </h3>
                <div className="space-y-3">
                  {groups.map((group) => {
                    const isClaimed = group.myRecordId
                      ? claimedIds.has(group.myRecordId)
                      : true

                    return (
                      <div key={group.key} className="glass-card p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge variant={RANK_BADGE[group.award_rank] ?? 'secondary'}>
                                {group.award_rank}
                              </Badge>
                              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {group.game_type}
                              </span>
                            </div>
                            <p
                              className="text-sm font-medium"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {group.competition}
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {group.division}
                            </p>
                            <div className="mt-2">
                              {group.club_name && (
                                <p
                                  className="text-sm font-semibold"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  {group.club_name}
                                </p>
                              )}
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                {group.players.join(', ')}
                              </p>
                            </div>
                          </div>

                          {/* 클레임 버튼 */}
                          {!isClaimed && group.myRecordId ? (
                            <button
                              onClick={() => handleClaim(group.myRecordId!)}
                              disabled={isPending && claimingId === group.myRecordId}
                              className="shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                              style={{
                                borderColor: 'var(--accent-color)',
                                color: 'var(--accent-color)',
                              }}
                            >
                              {isPending && claimingId === group.myRecordId
                                ? '등록 중...'
                                : '내 기록 등록'}
                            </button>
                          ) : (
                            <span
                              className="shrink-0 text-xs px-3 py-1.5 rounded-lg"
                              style={{
                                backgroundColor: 'var(--bg-card-hover)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              확인됨
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )
          })}
      </div>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type="success"
      />
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title="오류"
        message={alert.message}
        type="error"
      />
    </>
  )
}
