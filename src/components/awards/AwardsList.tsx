'use client'

import { useState } from 'react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import type { Database } from '@/lib/supabase/types'
import { groupAwardsForDisplay, RANK_ORDER, type AwardDisplayGroup } from './awardGrouping'
import { getAwardPlayersMembership } from '@/lib/awards/actions'

type Award = Database['public']['Tables']['tournament_awards']['Row']

const RANK_BADGE: Record<string, BadgeVariant> = {
  '우승': 'warning',
  '준우승': 'secondary',
  '공동3위': 'info',
  '3위': 'info',
}

interface Props {
  awards: Award[]
  isAdmin?: boolean
}

interface MembershipMap {
  [playerName: string]: boolean
}

export function AwardsList({ awards, isAdmin = false }: Props) {
  const [selectedGroup, setSelectedGroup] = useState<AwardDisplayGroup | null>(null)
  const [membership, setMembership] = useState<MembershipMap>({})
  const [loadingMembership, setLoadingMembership] = useState(false)

  const handleCardClick = async (group: AwardDisplayGroup) => {
    if (!isAdmin) return
    setSelectedGroup(group)
    setMembership({})
    setLoadingMembership(true)
    const result = await getAwardPlayersMembership(group.players, group.club_name)
    setMembership(result)
    setLoadingMembership(false)
  }

  if (awards.length === 0) {
    return (
      <div
        className="text-center py-20 rounded-2xl border border-dashed"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <p style={{ color: 'var(--text-muted)' }}>조건에 맞는 입상 기록이 없습니다.</p>
      </div>
    )
  }

  // 연도별 그룹핑
  const byYear = awards.reduce<Record<number, Award[]>>((acc, a) => {
    if (!acc[a.year]) acc[a.year] = []
    acc[a.year].push(a)
    return acc
  }, {})

  return (
    <>
      <div className="space-y-12">
        {Object.entries(byYear)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, yearAwards]) => {
            // 연도 내 대회별 그룹핑
            const byComp = yearAwards.reduce<Record<string, Award[]>>((acc, a) => {
              if (!acc[a.competition]) acc[a.competition] = []
              acc[a.competition].push(a)
              return acc
            }, {})

            return (
              <section key={year}>
                <h2
                  className="text-xl font-bold mb-6"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {year}년
                </h2>
                <div className="space-y-6">
                  {Object.entries(byComp)
                    .sort(([a], [b]) => a.localeCompare(b, 'ko'))
                    .map(([competition, compAwards]) => {
                      const groups = groupAwardsForDisplay(compAwards).sort(
                        (a, b) => (RANK_ORDER[a.award_rank] ?? 9) - (RANK_ORDER[b.award_rank] ?? 9)
                      )

                      return (
                        <div key={competition}>
                          <h3
                            className="text-sm font-semibold mb-3 pb-1.5 border-b"
                            style={{
                              color: 'var(--text-secondary)',
                              borderColor: 'var(--border-color)',
                            }}
                          >
                            {competition}
                          </h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {groups.map((group) => (
                              isAdmin ? (
                                <button
                                  key={group.key}
                                  type="button"
                                  onClick={() => handleCardClick(group)}
                                  className="rounded-xl p-4 space-y-2 text-left w-full transition-opacity hover:opacity-75"
                                  style={{
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <AwardCard group={group} />
                                </button>
                              ) : (
                                <div
                                  key={group.key}
                                  className="rounded-xl p-4 space-y-2"
                                  style={{
                                    backgroundColor: 'var(--bg-card)',
                                    border: '1px solid var(--border-color)',
                                  }}
                                >
                                  <AwardCard group={group} />
                                </div>
                              )
                            ))}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </section>
            )
          })}
      </div>

      {/* 어드민 전용: 수상 기록 상세 모달 */}
      <Modal
        isOpen={selectedGroup !== null}
        onClose={() => setSelectedGroup(null)}
        title={selectedGroup?.award_rank ?? ''}
        description={`${selectedGroup?.competition} · ${selectedGroup?.year}년`}
        size="md"
      >
        {selectedGroup && (
          <Modal.Body>
            <div className="space-y-4">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>부문</p>
                  <p style={{ color: 'var(--text-primary)' }}>{selectedGroup.division}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>종목</p>
                  <p style={{ color: 'var(--text-primary)' }}>{selectedGroup.game_type}</p>
                </div>
                {selectedGroup.club_name && (
                  <div className="col-span-2">
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>클럽</p>
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{selectedGroup.club_name}</p>
                  </div>
                )}
              </div>

              {/* 선수 목록 + 클럽 가입 여부 */}
              <div className="pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <p className="text-xs mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                  수상자 · 클럽 가입 여부
                  {!selectedGroup.club_name && (
                    <span className="ml-1">(클럽 정보 없음)</span>
                  )}
                </p>
                <div className="space-y-2">
                  {loadingMembership ? (
                    <div className="space-y-2">
                      {selectedGroup.players.map((_, i) => (
                        <div
                          key={i}
                          className="h-8 rounded-lg animate-pulse"
                          style={{ backgroundColor: 'var(--bg-card-hover)' }}
                        />
                      ))}
                    </div>
                  ) : (
                    selectedGroup.players.map((player) => {
                      const isMember = membership[player]
                      return (
                        <div
                          key={player}
                          className="flex items-center justify-between px-3 py-2 rounded-lg"
                          style={{ backgroundColor: 'var(--bg-card-hover)' }}
                        >
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {player}
                          </span>
                          {selectedGroup.club_name ? (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full font-medium"
                              style={
                                isMember
                                  ? { backgroundColor: 'var(--color-success-subtle)', color: 'var(--color-success)' }
                                  : { backgroundColor: 'var(--color-danger-subtle)', color: 'var(--color-danger)' }
                              }
                            >
                              {isMember ? '가입됨' : '미가입'}
                            </span>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>—</span>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          </Modal.Body>
        )}
      </Modal>
    </>
  )
}

/** 카드 내부 공통 렌더링 */
function AwardCard({ group }: { group: AwardDisplayGroup }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <Badge variant={RANK_BADGE[group.award_rank] ?? 'secondary'}>
          {group.award_rank}
        </Badge>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {group.game_type}
        </span>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {group.division}
      </p>
      <div
        className="pt-2 border-t"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {group.club_name && (
          <p
            className="text-sm font-semibold mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {group.club_name}
          </p>
        )}
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {group.players.join(', ')}
        </p>
      </div>
    </>
  )
}
