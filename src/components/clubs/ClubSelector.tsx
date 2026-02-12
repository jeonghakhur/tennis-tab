'use client'

import { useState, useEffect, useRef } from 'react'
import {
  searchClubsForJoin,
  joinClubAsRegistered,
  leaveClub,
  getMyClubMemberships,
  setPrimaryClub,
} from '@/lib/clubs/actions'
import type { Club, ClubMember, ClubJoinType } from '@/lib/clubs/types'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { Search, X, Star } from 'lucide-react'

const JOIN_TYPE_LABEL: Record<ClubJoinType, string> = {
  OPEN: '자유 가입',
  APPROVAL: '승인제',
  INVITE_ONLY: '초대 전용',
}

interface ClubSelectorProps {
  /** 프로필 새로고침 콜백 */
  onClubChange?: () => void
}

interface SearchResult {
  id: string
  name: string
  city: string | null
  district: string | null
  join_type: ClubJoinType
  association_name: string | null
}

interface ClubEntry {
  club: Club
  membership: ClubMember
}

export function ClubSelector({ onClubChange }: ClubSelectorProps) {
  const [clubs, setClubs] = useState<ClubEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // 검색 관련
  const [searchInput, setSearchInput] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // UI 상태
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [leaveTarget, setLeaveTarget] = useState<ClubEntry | null>(null)

  // 클럽 멤버십 로드
  useEffect(() => {
    loadMemberships()
  }, [])

  const loadMemberships = async () => {
    setLoading(true)
    const result = await getMyClubMemberships()
    setClubs(result.data || [])
    setLoading(false)
  }

  // 검색 디바운스
  useEffect(() => {
    if (!searchInput.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    const timer = setTimeout(async () => {
      setSearching(true)
      const result = await searchClubsForJoin(searchInput)
      if (!result.error) {
        // 이미 가입된 클럽은 검색 결과에서 제외
        const joinedIds = new Set(clubs.map((c) => c.club.id))
        setSearchResults(result.data.filter((c) => !joinedIds.has(c.id)))
        setShowDropdown(true)
      }
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, clubs])

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleJoin = async (clubId: string) => {
    setActionLoading(true)
    setShowDropdown(false)
    setSearchInput('')

    const result = await joinClubAsRegistered(clubId)
    setActionLoading(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    await loadMemberships()
    onClubChange?.()

    const joinedClub = searchResults.find((c) => c.id === clubId)
    const message = joinedClub?.join_type === 'OPEN'
      ? '클럽에 가입되었습니다!'
      : '가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.'
    setToast({ isOpen: true, message, type: 'success' })
  }

  const handleLeave = async () => {
    if (!leaveTarget) return
    const clubName = leaveTarget.club.name
    const clubId = leaveTarget.club.id
    setLeaveTarget(null)
    setActionLoading(true)

    const result = await leaveClub(clubId)
    setActionLoading(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    await loadMemberships()
    onClubChange?.()
    setToast({ isOpen: true, message: `${clubName}에서 탈퇴했습니다.`, type: 'success' })
  }

  const handleSetPrimary = async (clubId: string) => {
    setActionLoading(true)
    const result = await setPrimaryClub(clubId)
    setActionLoading(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    await loadMemberships()
    onClubChange?.()
    setToast({ isOpen: true, message: '대표 클럽이 변경되었습니다.', type: 'success' })
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-4 w-20 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        <div className="h-12 w-full rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
      </div>
    )
  }

  return (
    <>
      {actionLoading && <LoadingOverlay message="처리 중..." />}

      <div>
        <label
          className="block text-sm font-medium mb-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          소속 클럽
        </label>

        {/* 가입된 클럽 목록 */}
        {clubs.length > 0 && (
          <div className="space-y-2 mb-3">
            {clubs.map((entry) => (
              <div
                key={entry.membership.id}
                className="px-4 py-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: entry.membership.is_primary
                    ? '1px solid var(--accent-color)'
                    : '1px solid var(--border-color)',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span
                      className="font-medium text-sm truncate"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {entry.club.name}
                    </span>
                    {entry.club.associations?.name && (
                      <span
                        className="text-xs shrink-0"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        ({entry.club.associations.name})
                      </span>
                    )}
                    {entry.club.city && (
                      <span
                        className="text-xs shrink-0 hidden sm:inline"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        · {[entry.club.city, entry.club.district].filter(Boolean).join(' ')}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {entry.membership.is_primary ? (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
                        style={{
                          backgroundColor: 'rgba(234,179,8,0.15)',
                          color: '#eab308',
                        }}
                      >
                        <Star className="w-3 h-3 fill-current" />
                        대표
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSetPrimary(entry.club.id)}
                        className="text-xs px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        대표 지정
                      </button>
                    )}
                    {entry.membership.role !== 'OWNER' && (
                      <button
                        type="button"
                        onClick={() => setLeaveTarget(entry)}
                        className="text-xs px-2 py-1 rounded hover:opacity-80"
                        style={{ color: '#ef4444' }}
                      >
                        탈퇴
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 클럽 검색 UI — 항상 표시 */}
        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true)
              }}
              placeholder="클럽 이름으로 검색..."
              aria-label="클럽 검색"
              className="w-full pl-10 pr-8 py-3 rounded-lg outline-none"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('')
                  setSearchResults([])
                  setShowDropdown(false)
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              </button>
            )}
          </div>

          {/* 검색 결과 드롭다운 */}
          {showDropdown && (
            <div
              className="absolute z-20 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
              }}
            >
              {searching ? (
                <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  검색 중...
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-3 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  검색 결과가 없습니다
                </div>
              ) : (
                searchResults.map((club) => (
                  <button
                    key={club.id}
                    type="button"
                    onClick={() => handleJoin(club.id)}
                    className="w-full text-left px-4 py-3 hover:bg-(--bg-card-hover) transition-colors border-b last:border-b-0"
                    style={{ borderColor: 'var(--border-color)' }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className="text-sm font-medium"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {club.name}
                        </span>
                        <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {[club.city, club.district].filter(Boolean).join(' ')}
                        </span>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: club.join_type === 'OPEN' ? 'rgba(34,197,94,0.1)' : 'rgba(234,179,8,0.1)',
                          color: club.join_type === 'OPEN' ? '#22c55e' : '#eab308',
                        }}
                      >
                        {JOIN_TYPE_LABEL[club.join_type]}
                      </span>
                    </div>
                    {club.association_name && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {club.association_name}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          대표 클럽이 대회 참가 시 소속으로 표시됩니다.
        </p>
      </div>

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
      <ConfirmDialog
        isOpen={!!leaveTarget}
        onClose={() => setLeaveTarget(null)}
        onConfirm={handleLeave}
        title="클럽 탈퇴"
        message={`${leaveTarget?.club.name}에서 탈퇴하시겠습니까?`}
        type="warning"
      />
    </>
  )
}
