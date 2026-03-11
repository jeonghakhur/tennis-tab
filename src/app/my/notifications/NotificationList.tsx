'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useNotifications } from '@/lib/realtime/useNotifications'
import { markAllAsRead } from '@/lib/notifications/actions'
import { NotificationItem } from '@/components/notifications/NotificationItem'
import type { Notification } from '@/lib/notifications/types'

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

  const { unreadCount, setUnreadCount, markOptimisticRead } = useNotifications({
    userId: user?.id,
    initialUnreadCount,
    enabled: !!user?.id,
  })

  // 개별 읽음 처리 — 즉시 낙관적 카운트 감소 + 로컬 state 업데이트
  const handleRead = useCallback(
    (id: string) => {
      const target = notifications.find((n) => n.id === id)
      // 아직 미읽음인 경우에만 카운트 감소 (중복 방지)
      if (target && !target.is_read) {
        markOptimisticRead(id)
      }
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      )
    },
    [notifications, markOptimisticRead]
  )

  // 알림 삭제 — 로컬 state에서 제거 + 삭제된 알림이 미읽음이면 카운트 감소
  const handleDelete = useCallback(
    (id: string) => {
      const target = notifications.find((n) => n.id === id)
      if (target && !target.is_read) {
        // 미읽음 알림 삭제 시 카운트 감소 (realtime DELETE 이벤트는 구독 안 하므로 직접 처리)
        setUnreadCount(Math.max(0, unreadCount - 1))
      }
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

  return (
    <div className="min-h-screen bg-(--bg-primary)">
      {/* 헤더: full-width sticky + 내부 콘텐츠만 max-w 제한 */}
      <div className="sticky top-0 z-10 bg-(--bg-primary) border-b border-(--border-color)">
        <div className="max-w-content mx-auto flex items-center justify-between px-6 py-3">
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
        </div>
      </div>

      {/* 알림 목록: 클럽 페이지와 동일한 컨테이너 */}
      <div className="max-w-content mx-auto px-6">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-(--text-tertiary)">
            <Bell className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">알림이 없습니다</p>
          </div>
        ) : (
          <div className="divide-y divide-(--border-color)">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={handleRead}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
