'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getMyClubMemberships,
  setPrimaryClub,
  leaveClub,
  joinClubAsRegistered,
  searchClubsForJoin,
} from '@/lib/clubs/actions'
import type { Club, ClubMember, ClubJoinType } from '@/lib/clubs/types'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { Badge } from '@/components/common/Badge'
import { Search, Star, X } from 'lucide-react'

interface ClubSelectorProps {
  onClubChange?: () => void
}

interface ClubEntry {
  club: Club
  membership: ClubMember
}

interface ClubSearchResult {
  id: string
  name: string
  city: string | null
  district: string | null
  join_type: ClubJoinType
  association_name: string | null
}

const JOIN_TYPE_LABEL: Record<string, { label: string; variant: 'success' | 'warning' | 'secondary' }> = {
  OPEN:        { label: '자유가입',  variant: 'success' },
  APPROVAL:    { label: '승인필요',  variant: 'warning' },
  INVITE_ONLY: { label: '초대전용',  variant: 'secondary' },
}

export function ClubSelector({ onClubChange }: ClubSelectorProps) {
  const [myClubs, setMyClubs] = useState<ClubEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // 검색
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ClubSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 탈퇴 확인 다이얼로그
  const [leaveTarget, setLeaveTarget] = useState<ClubEntry | null>(null)

  // 가입 상태 피드백 (clubId → 결과 메시지)
  const [joinFeedback, setJoinFeedback] = useState<Record<string, string>>({})

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const myClubIds = new Set(myClubs.map(e => e.club.id))

  const loadMemberships = useCallback(async () => {
    const result = await getMyClubMemberships()
    setMyClubs(result.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadMemberships() }, [loadMemberships])

  // 확인 버튼 클릭 시 검색 재실행 방지 플래그
  const skipSearchRef = useRef(false)

  // 검색어 변경 시 디바운스 300ms
  useEffect(() => {
    if (skipSearchRef.current) { skipSearchRef.current = false; return }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setSearchResults([]); return }
    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      const { data: results } = await searchClubsForJoin(query)
      setSearchResults(results)
      setIsSearching(false)
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const handleSetPrimary = async (clubId: string) => {
    setActionLoading(true)
    const result = await setPrimaryClub(clubId)
    setActionLoading(false)
    if (result.error) { setAlert({ isOpen: true, message: result.error, type: 'error' }); return }
    setMyClubs(prev => prev.map(e => ({
      ...e,
      membership: { ...e.membership, is_primary: e.club.id === clubId },
    })))
    onClubChange?.()
    setToast({ isOpen: true, message: '대표 클럽이 변경되었습니다.', type: 'success' })
  }

  const handleLeaveConfirm = async () => {
    if (!leaveTarget) return
    setActionLoading(true)
    const result = await leaveClub(leaveTarget.club.id)
    setActionLoading(false)
    setLeaveTarget(null)
    if (result.error) { setAlert({ isOpen: true, message: result.error, type: 'error' }); return }
    setMyClubs(prev => prev.filter(e => e.club.id !== leaveTarget.club.id))
    onClubChange?.()
    setToast({ isOpen: true, message: `${leaveTarget.club.name}에서 탈퇴했습니다.`, type: 'success' })
  }

  const handleJoin = async (clubId: string, clubName: string) => {
    setActionLoading(true)
    const result = await joinClubAsRegistered(clubId)
    setActionLoading(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    const feedbackMsg = result.result === 'linked'
      ? `${clubName} — 기존 회원으로 연동됐습니다 ✓`
      : result.result === 'pending'
      ? `${clubName} — 가입 신청 완료 (승인 대기 중)`
      : `${clubName} — 가입 완료 ✓`

    setJoinFeedback(prev => ({ ...prev, [clubId]: feedbackMsg }))
    setToast({ isOpen: true, message: feedbackMsg, type: 'success' })
    await loadMemberships()
    onClubChange?.()
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-4 w-20 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        <div className="h-10 w-full rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        <div className="h-12 w-full rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
      </div>
    )
  }

  return (
    <>
      {actionLoading && <LoadingOverlay message="처리 중..." />}

      <div className="space-y-4">
        <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          소속 클럽
        </label>

        {/* 내 클럽 목록 */}
        {myClubs.length > 0 && (
          <div className="space-y-2">
            {myClubs.map((entry) => (
              <div
                key={entry.membership.id}
                className="px-4 py-3 rounded-lg flex items-center justify-between gap-2"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: entry.membership.is_primary
                    ? '1px solid var(--accent-color)'
                    : '1px solid var(--border-color)',
                }}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                      {entry.club.name}
                    </span>
                    {entry.membership.is_primary && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{ backgroundColor: 'rgba(234,179,8,0.15)', color: '#eab308' }}>
                        <Star className="w-3 h-3 fill-current" />대표
                      </span>
                    )}
                    {entry.membership.status === 'PENDING' && (
                      <Badge variant="warning">승인 대기</Badge>
                    )}
                  </div>
                  {entry.club.city && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {[entry.club.city, entry.club.district].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {!entry.membership.is_primary && entry.membership.status === 'ACTIVE' && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(entry.club.id)}
                      className="text-xs px-2 py-1 rounded hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-muted)' }}
                    >
                      대표 지정
                    </button>
                  )}
                  {entry.membership.role !== 'OWNER' && (
                    <button
                      type="button"
                      onClick={() => setLeaveTarget(entry)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-400 hover:text-red-500 transition-colors"
                      aria-label={`${entry.club.name} 탈퇴`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 클럽 검색 */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="클럽 검색 후 가입"
              className="w-full pl-9 pr-4 py-2.5 rounded-lg outline-none text-sm"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              aria-label="클럽 검색"
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--text-muted)' }}>
                검색 중...
              </span>
            )}
          </div>

          {/* 검색 결과 */}
          {searchResults.length > 0 && (
            <div className="rounded-lg overflow-hidden divide-y divide-(--border-color)" style={{ border: '1px solid var(--border-color)' }}>
              {searchResults.map(club => {
                const isMember = myClubIds.has(club.id)
                const feedback = joinFeedback[club.id]
                return (
                  <div key={club.id} className="px-4 py-3 flex items-center justify-between gap-3"
                    style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {club.name}
                        </span>
                        <Badge variant={JOIN_TYPE_LABEL[club.join_type].variant}>
                          {JOIN_TYPE_LABEL[club.join_type].label}
                        </Badge>
                      </div>
                      {(club.city || club.district) && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {[club.city, club.district].filter(Boolean).join(' ')}
                        </span>
                      )}
                      {feedback && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--accent-color)' }}>{feedback}</p>
                      )}
                    </div>
                    {isMember ? (
                      <button
                        type="button"
                        onClick={() => {
                          skipSearchRef.current = true
                          setQuery(club.name)
                          setSearchResults([])
                        }}
                        className="text-xs px-3 py-1.5 rounded font-medium shrink-0 hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                      >
                        확인
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleJoin(club.id, club.name)}
                        className="text-xs px-3 py-1.5 rounded font-medium shrink-0 hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
                      >
                        가입
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {query.trim() && !isSearching && searchResults.length === 0 && (
            <p className="text-sm text-center py-3" style={{ color: 'var(--text-muted)' }}>
              검색 결과가 없습니다.
            </p>
          )}
        </div>

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          대표 클럽이 대회 참가 시 소속으로 표시됩니다. 승인 필요 클럽은 관리자 승인 후 가입됩니다.
        </p>
      </div>

      {/* 탈퇴 확인 */}
      <ConfirmDialog
        isOpen={!!leaveTarget}
        onClose={() => setLeaveTarget(null)}
        onConfirm={handleLeaveConfirm}
        title="클럽 탈퇴"
        message={`${leaveTarget?.club.name}에서 탈퇴하시겠습니까?`}
        type="warning"
        confirmText="탈퇴"
        cancelText="취소"
      />

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title="오류"
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}
