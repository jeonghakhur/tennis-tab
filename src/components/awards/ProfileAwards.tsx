'use client'

import { useState, useTransition } from 'react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { claimAward } from '@/lib/awards/actions'
import type { Database } from '@/lib/supabase/types'

type Award = Database['public']['Tables']['tournament_awards']['Row']

const RANK_BADGE: Record<string, BadgeVariant> = {
  '우승': 'warning',
  '준우승': 'secondary',
  '공동3위': 'info',
  '3위': 'info',
}

interface Props {
  awards: Award[]
  userId: string
}

export function ProfileAwards({ awards, userId }: Props) {
  const [claimedIds, setClaimedIds] = useState<Set<string>>(
    () => new Set(awards.filter((a) => a.player_user_ids?.includes(userId)).map((a) => a.id))
  )
  const [isPending, startTransition] = useTransition()
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const handleClaim = (awardId: string) => {
    setClaimingId(awardId)
    startTransition(async () => {
      const result = await claimAward(awardId)
      setClaimingId(null)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error })
      } else {
        setClaimedIds((prev) => new Set([...prev, awardId]))
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

  // 연도별 그룹핑
  const grouped = awards.reduce<Record<number, Award[]>>((acc, a) => {
    if (!acc[a.year]) acc[a.year] = []
    acc[a.year].push(a)
    return acc
  }, {})

  return (
    <>
      <div className="space-y-8">
        {Object.entries(grouped)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, items]) => (
            <section key={year}>
              <h3
                className="text-lg font-display mb-3"
                style={{ color: 'var(--text-primary)' }}
              >
                {year}년
              </h3>
              <div className="space-y-3">
                {items.map((award) => {
                  const isClaimed = claimedIds.has(award.id)
                  return (
                    <div
                      key={award.id}
                      className="glass-card p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge variant={RANK_BADGE[award.award_rank] ?? 'secondary'}>
                              {award.award_rank}
                            </Badge>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {award.game_type}
                            </span>
                          </div>
                          <p
                            className="text-sm font-medium"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {award.competition}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {award.division}
                          </p>
                          <p className="text-sm mt-2 font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {award.players.join(', ')}
                          </p>
                        </div>

                        {/* 클레임 버튼 — 아직 클레임 안 된 경우만 표시 */}
                        {!isClaimed && (
                          <button
                            onClick={() => handleClaim(award.id)}
                            disabled={isPending && claimingId === award.id}
                            className="shrink-0 text-xs px-3 py-1.5 rounded-lg border transition-colors"
                            style={{
                              borderColor: 'var(--accent-color)',
                              color: 'var(--accent-color)',
                            }}
                          >
                            {isPending && claimingId === award.id ? '등록 중...' : '내 기록 등록'}
                          </button>
                        )}
                        {isClaimed && (
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
          ))}
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
