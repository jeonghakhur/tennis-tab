'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { searchClubsForJoin, joinClubAsRegistered, leaveClub, getMyClubMembership } from '@/lib/clubs/actions'
import type { Club, ClubMember, ClubJoinType } from '@/lib/clubs/types'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { Search, X } from 'lucide-react'

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

export function ClubSelector({ onClubChange }: ClubSelectorProps) {
  const [currentClub, setCurrentClub] = useState<{ club: Club; membership: ClubMember } | null>(null)
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
  const [confirmLeave, setConfirmLeave] = useState(false)

  // 현재 클럽 멤버십 로드
  useEffect(() => {
    loadMembership()
  }, [])

  const loadMembership = async () => {
    setLoading(true)
    const result = await getMyClubMembership()
    if (result.data) {
      setCurrentClub(result.data)
    } else {
      setCurrentClub(null)
    }
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
        setSearchResults(result.data)
        setShowDropdown(true)
      }
      setSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput])

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

    // 가입 후 멤버십 새로고침
    await loadMembership()
    onClubChange?.()

    // 가입 방식에 따른 메시지
    const joinedClub = searchResults.find((c) => c.id === clubId)
    const message = joinedClub?.join_type === 'OPEN'
      ? '클럽에 가입되었습니다!'
      : '가입 신청이 완료되었습니다. 관리자 승인을 기다려주세요.'
    setToast({ isOpen: true, message, type: 'success' })
  }

  const handleLeave = async () => {
    if (!currentClub) return
    setConfirmLeave(false)
    setActionLoading(true)

    const result = await leaveClub(currentClub.club.id)
    setActionLoading(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setCurrentClub(null)
    onClubChange?.()
    setToast({ isOpen: true, message: '클럽에서 탈퇴했습니다.', type: 'success' })
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

        {currentClub ? (
          // 현재 소속 클럽 표시
          <div
            className="px-4 py-3 rounded-lg"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <span
                  className="font-medium text-sm"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {currentClub.club.name}
                </span>
                {currentClub.club.associations?.name && (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    ({currentClub.club.associations.name})
                  </span>
                )}
                {currentClub.club.city && (
                  <span
                    className="ml-2 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    · {[currentClub.club.city, currentClub.club.district].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
              {currentClub.membership.role !== 'OWNER' && (
                <button
                  type="button"
                  onClick={() => setConfirmLeave(true)}
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ color: '#ef4444' }}
                >
                  탈퇴
                </button>
              )}
            </div>
          </div>
        ) : (
          // 클럽 검색 UI
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
        )}

        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {currentClub
            ? '클럽을 변경하려면 먼저 현재 클럽에서 탈퇴해주세요.'
            : '가입 방식에 따라 즉시 가입되거나 관리자 승인 후 가입됩니다.'}
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
        isOpen={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={handleLeave}
        title="클럽 탈퇴"
        message={`${currentClub?.club.name}에서 탈퇴하시겠습니까?`}
        type="warning"
      />
    </>
  )
}
