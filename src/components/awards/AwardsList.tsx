'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import type { Database } from '@/lib/supabase/types'
import { groupAwardsForDisplay, RANK_ORDER, type AwardDisplayGroup } from './awardGrouping'
import {
  getAwardPlayersMembership,
  updateAwardPlayerRating,
  deleteAwards,
  type AwardPlayerInfo,
} from '@/lib/awards/actions'

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

interface PlayerRow {
  name: string
  userId: string | null
  info: AwardPlayerInfo
  ratingInput: string  // 편집 중인 값
  saving: boolean
}

export function AwardsList({ awards, isAdmin = false }: Props) {
  const router = useRouter()
  const [selectedGroup, setSelectedGroup] = useState<AwardDisplayGroup | null>(null)
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([])
  const [playerRows, setPlayerRows] = useState<PlayerRow[]>([])
  const [loadingMembership, setLoadingMembership] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '' })
  const [alert, setAlert] = useState({ isOpen: false, message: '' })

  const handleDeleteConfirm = async () => {
    setDeleting(true)
    const result = await deleteAwards(selectedGroupIds)
    setDeleting(false)
    setDeleteConfirmOpen(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error })
      return
    }

    setSelectedGroup(null)
    setToast({ isOpen: true, message: '수상자 기록이 삭제되었습니다.' })
    router.refresh()
  }

  const handleCardClick = useCallback(async (group: AwardDisplayGroup) => {
    if (!isAdmin) return
    setSelectedGroup(group)
    setPlayerRows([])
    setLoadingMembership(true)

    // 그룹에 속한 개별 레코드에서 player → userId 매핑 추출
    const groupRecords = awards.filter(
      (a) =>
        a.year === group.year &&
        a.competition === group.competition &&
        a.division === group.division &&
        a.award_rank === group.award_rank &&
        (a.club_name ?? '') === (group.club_name ?? '')
    )
    // 그룹에 속한 레코드 ID 저장 (삭제용)
    setSelectedGroupIds(groupRecords.map((r) => r.id))

    const playerUserMap = new Map<string, string | null>()
    for (const rec of groupRecords) {
      const name = rec.players[0]
      const userId = rec.player_user_ids?.[0] ?? null
      if (name) playerUserMap.set(name, userId)
    }

    const playersWithId = group.players.map((name) => ({
      name,
      userId: playerUserMap.get(name) ?? null,
    }))

    const membershipResult = await getAwardPlayersMembership(playersWithId, group.club_name)

    setPlayerRows(
      playersWithId.map(({ name, userId }) => {
        const info = membershipResult[name] ?? { isMember: false, memberId: null, rating: null, profileRating: null }
        return {
          name,
          userId,
          info,
          ratingInput: info.rating != null ? String(info.rating) : '',
          saving: false,
        }
      })
    )
    setLoadingMembership(false)
  }, [isAdmin, awards])

  const handleRatingChange = (playerName: string, value: string) => {
    setPlayerRows((prev) =>
      prev.map((row) => (row.name === playerName ? { ...row, ratingInput: value } : row))
    )
  }

  const handleSaveRating = async (playerName: string) => {
    const row = playerRows.find((r) => r.name === playerName)
    if (!row) return

    const newRating = row.ratingInput.trim() ? Number(row.ratingInput.trim()) : null
    if (row.ratingInput.trim() && isNaN(newRating!)) {
      setAlert({ isOpen: true, message: '점수는 숫자로 입력해주세요.' })
      return
    }

    setPlayerRows((prev) =>
      prev.map((r) => (r.name === playerName ? { ...r, saving: true } : r))
    )

    const result = await updateAwardPlayerRating(row.info.memberId, row.userId, newRating)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error })
      setPlayerRows((prev) =>
        prev.map((r) => (r.name === playerName ? { ...r, saving: false } : r))
      )
      return
    }

    // 낙관적 업데이트: 저장된 rating 반영
    setPlayerRows((prev) =>
      prev.map((r) =>
        r.name === playerName
          ? {
              ...r,
              saving: false,
              info: { ...r.info, rating: newRating, profileRating: r.userId ? newRating : r.info.profileRating },
              ratingInput: newRating != null ? String(newRating) : '',
            }
          : r
      )
    )

    const syncMsg = row.userId ? ' (프로필 점수도 동기화됨)' : ''
    setToast({ isOpen: true, message: `${playerName}의 점수가 업데이트되었습니다.${syncMsg}` })
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
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                            {groups.map((group) =>
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

      {/* 어드민 전용: 수상자 상세 + 점수 수정 모달 */}
      <Modal
        isOpen={selectedGroup !== null}
        onClose={() => setSelectedGroup(null)}
        title={selectedGroup?.award_rank ?? ''}
        description={`${selectedGroup?.competition} · ${selectedGroup?.year}년`}
        size="md"
      >
        {selectedGroup && (
          <>
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
                    <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {selectedGroup.club_name}
                    </p>
                  </div>
                )}
              </div>

              {/* 수상자 목록 */}
              <div className="pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <p className="text-xs mb-3 font-medium" style={{ color: 'var(--text-muted)' }}>
                  수상자 점수 관리
                  {!selectedGroup.club_name && (
                    <span className="ml-1 font-normal">(클럽 정보 없음 — 점수 조회 불가)</span>
                  )}
                </p>

                {loadingMembership ? (
                  <div className="space-y-3">
                    {selectedGroup.players.map((_, i) => (
                      <div
                        key={i}
                        className="h-14 rounded-lg animate-pulse"
                        style={{ backgroundColor: 'var(--bg-card-hover)' }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {playerRows.map((row) => (
                      <div
                        key={row.name}
                        className="rounded-lg p-3"
                        style={{ backgroundColor: 'var(--bg-card-hover)' }}
                      >
                        {/* 이름 + 가입 배지 */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {row.name}
                          </span>
                          <div className="flex items-center gap-2">
                            {row.userId && (
                              <span
                                className="text-xs px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}
                              >
                                프로필 연동
                              </span>
                            )}
                            {selectedGroup.club_name && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={
                                  row.info.isMember
                                    ? { backgroundColor: 'var(--color-success-subtle)', color: 'var(--color-success)' }
                                    : { backgroundColor: 'var(--color-danger-subtle)', color: 'var(--color-danger)' }
                                }
                              >
                                {row.info.isMember ? '가입됨' : '미가입'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* 점수 입력 (클럽 회원인 경우만) */}
                        {row.info.isMember ? (
                          <div className="flex items-center gap-2">
                            <label
                              htmlFor={`rating-${row.name}`}
                              className="text-xs shrink-0"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              점수
                            </label>
                            <input
                              id={`rating-${row.name}`}
                              type="number"
                              value={row.ratingInput}
                              onChange={(e) => handleRatingChange(row.name, e.target.value)}
                              placeholder="미등록"
                              min={0}
                              className="flex-1 px-2 py-1 rounded text-sm text-right"
                              style={{
                                backgroundColor: 'var(--bg-input)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)',
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRating(row.name)}
                              disabled={row.saving}
                              className="shrink-0 text-xs px-3 py-1.5 rounded-lg transition-colors"
                              style={{
                                backgroundColor: 'var(--accent-color)',
                                color: 'var(--bg-primary)',
                                opacity: row.saving ? 0.6 : 1,
                              }}
                            >
                              {row.saving ? '저장 중' : '저장'}
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {selectedGroup.club_name ? '클럽 미가입 — 점수 수정 불가' : '클럽 정보 없음'}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(true)}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
              style={{ color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
              aria-label="수상자 삭제"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
            <button
              type="button"
              onClick={() => setSelectedGroup(null)}
              className="flex-1 px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              닫기
            </button>
          </Modal.Footer>
          </>
        )}
      </Modal>

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
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirm}
        title="수상자 삭제"
        message={`${selectedGroup?.award_rank} — ${selectedGroup?.players.join(', ')}의 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        type="error"
        confirmText="삭제"
        isLoading={deleting}
      />
    </>
  )
}

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
