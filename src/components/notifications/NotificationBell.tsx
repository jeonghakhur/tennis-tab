'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { useNotifications } from '@/lib/realtime/useNotifications'
import { getUnreadCount } from '@/lib/notifications/actions'

/** 네비게이션 바에 표시되는 알림 벨 아이콘 + 미읽음 배지 */
export function NotificationBell() {
  const { user } = useAuth()
  const router = useRouter()
  const [initialCount, setInitialCount] = useState(0)

  // 서버에서 초기 미읽음 수 조회
  useEffect(() => {
    if (!user?.id) return
    getUnreadCount().then(({ count }) => setInitialCount(count))
  }, [user?.id])

  const { unreadCount } = useNotifications({
    userId: user?.id,
    initialUnreadCount: initialCount,
    enabled: !!user?.id,
  })

  if (!user) return null

  const displayCount = unreadCount > 9 ? '9+' : unreadCount

  return (
    <button
      type="button"
      onClick={() => router.push('/my/notifications')}
      className="relative p-2 rounded-lg hover:bg-(--bg-card) transition-colors"
      aria-label={`알림${unreadCount > 0 ? ` ${unreadCount}개 미읽음` : ''}`}
    >
      <Bell className="w-5 h-5 text-(--text-secondary)" />
      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1
            flex items-center justify-center
            bg-red-500 text-white text-[10px] font-bold
            rounded-full leading-none"
          aria-hidden="true"
        >
          {displayCount}
        </span>
      )}
    </button>
  )
}
