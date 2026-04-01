'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, ArrowLeft, Search, Trash2, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useNotifications } from '@/lib/realtime/useNotifications'
import { markAllAsRead, deleteAllNotifications } from '@/lib/notifications/actions'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import type { Notification } from '@/lib/notifications/types'

const PAGE_SIZE = 20

interface NotificationListProps {
  initialNotifications: Notification[]
  initialUnreadCount: number
}

export function NotificationList({
  initialNotifications,
  initialUnreadCount,
}: NotificationListProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)

  const { unreadCount, setUnreadCount, markOptimisticRead } = useNotifications({
    userId: user?.id,
    initialUnreadCount,
    enabled: !!user?.id,
  })

  // 개별 읽음 처리
  const handleRead = useCallback(
    (id: string) => {
      const target = notifications.find((n) => n.id === id)
      if (target && !target.is_read) markOptimisticRead(id)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      )
    },
    [notifications, markOptimisticRead]
  )

  // 개별 삭제
  const handleDelete = useCallback(
    (id: string) => {
      const target = notifications.find((n) => n.id === id)
      if (target && !target.is_read) setUnreadCount(Math.max(0, unreadCount - 1))
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    },
    [notifications, unreadCount, setUnreadCount]
  )

  // 전체 읽음 처리
  const handleMarkAllAsRead = async () => {
    setLoading(true)
    try {
      const result = await markAllAsRead()
      if (!result.error) {
        setNotifications((prev) =>
          prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
        )
        setUnreadCount(0)
      }
    } finally {
      setLoading(false)
    }
  }

  // 전체 삭제
  const handleDeleteAll = async () => {
    setLoading(true)
    try {
      const result = await deleteAllNotifications()
      if (!result.error) {
        setNotifications([])
        setUnreadCount(0)
        setPage(0)
      }
    } finally {
      setLoading(false)
      setConfirmDeleteAll(false)
    }
  }

  // 검색 필터링 (title + message 대상)
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return notifications
    return notifications.filter(
      (n) => n.title.toLowerCase().includes(q) || n.message.toLowerCase().includes(q)
    )
  }, [notifications, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  // 검색어 변경 시 page 리셋은 setSearch 핸들러에서 처리
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setPage(0)
  }

  return (
    <div className="min-h-screen bg-(--bg-primary)">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-(--bg-primary) border-b border-(--border-color)">
        <div className="max-w-content mx-auto px-6 py-3">
          {/* 1행: 뒤로가기 + 제목 + 액션 버튼 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="p-1 rounded-lg hover:bg-(--bg-card) transition-colors"
                aria-label="뒤로 가기"
              >
                <ArrowLeft className="w-5 h-5 text-(--text-secondary)" />
              </button>
              <h1 className="text-lg font-semibold text-(--text-primary)">
                알림
                {unreadCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-(--text-tertiary)">
                    {unreadCount}개 미읽음
                  </span>
                )}
              </h1>
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllAsRead}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                    text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors
                    disabled:opacity-50"
                >
                  <CheckCheck className="w-4 h-4" />
                  모두 읽음
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAll(true)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium
                    text-red-500 hover:bg-red-500/10 rounded-lg transition-colors
                    disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  전체 삭제
                </button>
              )}
            </div>
          </div>

          {/* 2행: 검색창 */}
          <div className="mt-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-(--text-tertiary)" />
            <input
              type="search"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="알림 검색..."
              className="w-full pl-9 pr-8 py-2 text-sm bg-(--bg-card) border border-(--border-color)
                rounded-lg placeholder:text-(--text-tertiary) text-(--text-primary)
                focus:outline-none focus:border-(--accent-color) transition-colors"
              aria-label="알림 검색"
            />
            {search && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-(--text-tertiary)
                  hover:text-(--text-primary) rounded"
                aria-label="검색어 지우기"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 알림 목록 */}
      <div className="max-w-content mx-auto px-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-(--text-tertiary)">
            <Bell className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">
              {search ? `'${search}'에 해당하는 알림이 없습니다` : '알림이 없습니다'}
            </p>
          </div>
        ) : (
          <>
            {/* 검색 결과 수 표시 */}
            {search && (
              <p className="py-2 text-xs text-(--text-tertiary)">
                {filtered.length}개 검색됨
              </p>
            )}

            <div className="divide-y divide-(--border-color)">
              {paginated.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={handleRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-6">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-2 rounded-lg hover:bg-(--bg-card) disabled:opacity-30
                    text-(--text-secondary) transition-colors"
                  aria-label="이전 페이지"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i).map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setPage(i)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      page === i
                        ? 'bg-(--accent-color) text-white'
                        : 'hover:bg-(--bg-card) text-(--text-secondary)'
                    }`}
                    aria-label={`${i + 1}페이지`}
                    aria-current={page === i ? 'page' : undefined}
                  >
                    {i + 1}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page === totalPages - 1}
                  className="p-2 rounded-lg hover:bg-(--bg-card) disabled:opacity-30
                    text-(--text-secondary) transition-colors"
                  aria-label="다음 페이지"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 전체 삭제 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
        onConfirm={handleDeleteAll}
        message="모든 알림을 삭제할까요? 이 작업은 되돌릴 수 없습니다."
        type="error"
        confirmText="전체 삭제"
        cancelText="취소"
      />
    </div>
  )
}
