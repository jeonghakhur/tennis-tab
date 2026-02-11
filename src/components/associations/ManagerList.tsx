'use client'

import { useState, useCallback } from 'react'
import { assignManager, removeManager, searchUsersForManager } from '@/lib/associations/actions'
import type { AssociationManager } from '@/lib/associations/types'
import { Toast } from '@/components/common/Toast'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import { AlertDialog } from '@/components/common/AlertDialog'
import { Search, UserPlus, X } from 'lucide-react'

interface ManagerListProps {
  associationId: string
  initialManagers: AssociationManager[]
}

export function ManagerList({ associationId, initialManagers }: ManagerListProps) {
  const [managers, setManagers] = useState(initialManagers)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; email: string; role: string | null }>>([])
  const [searching, setSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirm, setConfirm] = useState({ isOpen: false, message: '', onConfirm: () => {} })

  // 사용자 검색 (디바운스)
  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query)
    if (query.trim().length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setSearching(true)
    try {
      const { data, error } = await searchUsersForManager(query)
      if (error) {
        setAlert({ isOpen: true, message: error, type: 'error' })
        return
      }
      // 이미 매니저인 사용자 제외
      const managerUserIds = new Set(managers.map((m) => m.user_id))
      setSearchResults(data.filter((u) => !managerUserIds.has(u.id)))
      setShowResults(true)
    } finally {
      setSearching(false)
    }
  }, [managers])

  // 매니저 지정
  const handleAssign = async (userId: string, userName: string) => {
    const result = await assignManager(associationId, userId)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: `${userName}님을 매니저로 지정했습니다.`, type: 'success' })
    setSearchQuery('')
    setSearchResults([])
    setShowResults(false)

    // 목록 새로고침 (간단히 window.location.reload 대신 라우터 갱신)
    window.location.reload()
  }

  // 매니저 해제
  const handleRemove = (userId: string, userName: string) => {
    setConfirm({
      isOpen: true,
      message: `${userName}님을 매니저에서 해제하시겠습니까?\n해당 사용자의 역할이 일반 사용자로 변경됩니다.`,
      onConfirm: async () => {
        const result = await removeManager(associationId, userId)
        if (result.error) {
          setAlert({ isOpen: true, message: result.error, type: 'error' })
          return
        }
        setManagers((prev) => prev.filter((m) => m.user_id !== userId))
        setToast({ isOpen: true, message: `${userName}님이 매니저에서 해제되었습니다.`, type: 'success' })
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* 검색 인풋 */}
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-(--bg-input) border border-(--border-color) focus-within:border-(--accent-color)">
          <Search className="w-4 h-4 text-(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="사용자 이름 또는 이메일로 검색..."
            className="flex-1 bg-transparent text-(--text-primary) outline-none placeholder:text-(--text-muted)"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setShowResults(false) }}
              className="text-(--text-muted) hover:text-(--text-primary)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 검색 결과 드롭다운 */}
        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg bg-(--bg-card) border border-(--border-color) shadow-lg max-h-60 overflow-y-auto">
            {searching ? (
              <div className="p-3 text-center text-(--text-muted) text-sm">검색 중...</div>
            ) : searchResults.length === 0 ? (
              <div className="p-3 text-center text-(--text-muted) text-sm">검색 결과가 없습니다.</div>
            ) : (
              searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between px-3 py-2 hover:bg-(--bg-primary) transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-(--text-primary)">{user.name}</p>
                    <p className="text-xs text-(--text-muted)">{user.email}</p>
                  </div>
                  <button
                    onClick={() => handleAssign(user.id, user.name)}
                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-(--accent-color) text-(--bg-primary) hover:opacity-80"
                  >
                    <UserPlus className="w-3 h-3" />
                    지정
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* 매니저 목록 */}
      <div>
        <h3 className="text-sm font-medium text-(--text-muted) mb-2">
          매니저 목록 ({managers.length}명)
        </h3>
        {managers.length === 0 ? (
          <div className="glass-card rounded-lg p-6 text-center">
            <p className="text-(--text-muted) text-sm">등록된 매니저가 없습니다.</p>
          </div>
        ) : (
          <div className="glass-card rounded-lg divide-y divide-(--border-color)">
            {managers.map((manager) => (
              <div key={manager.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="font-medium text-(--text-primary)">
                    {manager.profiles?.name || '알 수 없음'}
                  </p>
                  <p className="text-sm text-(--text-muted)">
                    {manager.profiles?.email}
                    {manager.profiles?.phone && ` · ${manager.profiles.phone}`}
                  </p>
                  <p className="text-xs text-(--text-muted) mt-0.5">
                    {new Date(manager.assigned_at).toLocaleDateString('ko-KR')} 지정
                  </p>
                </div>
                <button
                  onClick={() => handleRemove(manager.user_id, manager.profiles?.name || '')}
                  className="px-3 py-1 rounded text-sm font-medium text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  해제
                </button>
              </div>
            ))}
          </div>
        )}
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
        title={alert.type === "error" ? "오류" : "알림"}
        message={alert.message}
        type={alert.type}
      />
      <ConfirmDialog
        isOpen={confirm.isOpen}
        onClose={() => setConfirm({ ...confirm, isOpen: false })}
        onConfirm={confirm.onConfirm}
        title="확인"
        message={confirm.message}
        type="warning"
      />
    </div>
  )
}
