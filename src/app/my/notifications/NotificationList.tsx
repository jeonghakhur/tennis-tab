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

  const { unreadCount, setUnreadCount } = useNotifications({
    userId: user?.id,
    initialUnreadCount,
    enabled: !!user?.id,
  })

  // 개별 읽음 처리 시 로컬 상태 업데이트
  const handleRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
      )
    )
  }, [])

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
      <div className="max-w-2xl mx-auto">
        {/* 헤더 */}
        <div className="sticky top-0 z-10 bg-(--bg-primary) border-b border-(--border-color)">
          <div className="flex items-center justify-between px-4 py-3">
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

        {/* 알림 목록 */}
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
