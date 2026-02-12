'use client'

import { useState, useEffect } from 'react'
import {
  getMyClubMemberships,
  setPrimaryClub,
} from '@/lib/clubs/actions'
import type { Club, ClubMember } from '@/lib/clubs/types'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { Star } from 'lucide-react'

interface ClubSelectorProps {
  /** 대표 클럽 변경 시 프로필 새로고침 콜백 */
  onClubChange?: () => void
}

interface ClubEntry {
  club: Club
  membership: ClubMember
}

export function ClubSelector({ onClubChange }: ClubSelectorProps) {
  const [clubs, setClubs] = useState<ClubEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // UI 상태
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  useEffect(() => {
    loadMemberships()
  }, [])

  const loadMemberships = async () => {
    setLoading(true)
    const result = await getMyClubMemberships()
    setClubs(result.data || [])
    setLoading(false)
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

        {clubs.length > 0 ? (
          <div className="space-y-2">
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm py-3" style={{ color: 'var(--text-muted)' }}>
            가입된 클럽이 없습니다. 클럽 목록에서 가입해주세요.
          </p>
        )}

        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
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
    </>
  )
}
