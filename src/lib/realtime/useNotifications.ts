'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Notification } from '@/lib/notifications/types'

interface UseNotificationsOptions {
  userId: string | undefined
  /** 초기 미읽음 수 (서버에서 조회한 값) */
  initialUnreadCount?: number
  enabled?: boolean
}

interface UseNotificationsReturn {
  unreadCount: number
  latestNotification: Notification | null
  /** 미읽음 수 직접 설정 (전체 읽음 처리 등) */
  setUnreadCount: (count: number) => void
  /**
   * 낙관적 읽음 처리: 즉시 unreadCount-- 하고 realtime UPDATE 중복 감소 방지
   * NotificationList에서 개별 알림 읽음 처리 시 사용
   */
  markOptimisticRead: (id: string) => void
}

/**
 * notifications 테이블 Realtime 구독
 * - INSERT → unreadCount++, latestNotification 업데이트
 * - UPDATE (is_read=true) → unreadCount--
 */
export function useNotifications({
  userId,
  initialUnreadCount = 0,
  enabled = true,
}: UseNotificationsOptions): UseNotificationsReturn {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount)
  const [latestNotification, setLatestNotification] = useState<Notification | null>(null)

  const channelRef = useRef<RealtimeChannel | null>(null)

  // ref로 최신 unreadCount 참조 (콜백 내 stale closure 방지)
  const unreadCountRef = useRef(unreadCount)
  unreadCountRef.current = unreadCount

  // 낙관적 읽음 처리 중인 알림 ID → realtime UPDATE 중복 감소 방지
  const optimisticReadIdsRef = useRef<Set<string>>(new Set())

  const handleSetUnreadCount = useCallback((count: number) => {
    setUnreadCount(count)
    // 다른 useNotifications 인스턴스(예: NotificationBell)에 알림
    window.dispatchEvent(
      new CustomEvent('notifications:unreadCount', { detail: count })
    )
  }, [])

  useEffect(() => {
    if (!enabled || !userId) return

    const supabase = createClient()

    // 이전 채널 정리
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotification = payload.new as Notification
          setLatestNotification(newNotification)
          setUnreadCount((prev) => prev + 1)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          const old = payload.old as Partial<Notification>
          // is_read가 false→true로 변경된 경우만 카운트 감소
          if (updated.is_read && !old.is_read) {
            // 이미 낙관적으로 처리된 ID는 skip (중복 감소 방지)
            if (optimisticReadIdsRef.current.has(updated.id)) {
              optimisticReadIdsRef.current.delete(updated.id)
            } else {
              setUnreadCount((prev) => Math.max(0, prev - 1))
            }
          }
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [userId, enabled])

  // initialUnreadCount 변경 시 동기화
  useEffect(() => {
    setUnreadCount(initialUnreadCount)
  }, [initialUnreadCount])

  // 다른 인스턴스에서 발행한 unreadCount 변경 이벤트 수신
  useEffect(() => {
    const handler = (e: Event) => {
      const count = (e as CustomEvent<number>).detail
      setUnreadCount(count)
    }
    window.addEventListener('notifications:unreadCount', handler)
    return () => window.removeEventListener('notifications:unreadCount', handler)
  }, [])

  const markOptimisticRead = useCallback((id: string) => {
    optimisticReadIdsRef.current.add(id)
    setUnreadCount((prev) => Math.max(0, prev - 1))
    // 다른 인스턴스(NotificationBell)에도 동기화
    window.dispatchEvent(
      new CustomEvent('notifications:unreadCount', {
        detail: Math.max(0, unreadCountRef.current - 1),
      })
    )
  }, [])

  return {
    unreadCount,
    latestNotification,
    setUnreadCount: handleSetUnreadCount,
    markOptimisticRead,
  }
}
