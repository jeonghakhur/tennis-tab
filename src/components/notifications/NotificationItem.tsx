'use client'

import { useRouter } from 'next/navigation'
import {
  CheckCircle,
  XCircle,
  Trophy,
  LayoutGrid,
  Medal,
  Users,
  UserPlus,
  Mail,
  CreditCard,
  Send,
  Ban,
  DollarSign,
  UserCheck,
} from 'lucide-react'
import { NotificationType, type Notification } from '@/lib/notifications/types'
import { markAsRead } from '@/lib/notifications/actions'
import { formatRelativeTime } from './utils'

/** 알림 타입별 아이콘 + 색상 매핑 */
const NOTIFICATION_ICON_MAP: Record<
  NotificationType,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  [NotificationType.ENTRY_APPROVED]: { icon: CheckCircle, color: 'text-emerald-500' },
  [NotificationType.ENTRY_REJECTED]: { icon: XCircle, color: 'text-red-500' },
  [NotificationType.TOURNAMENT_STATUS_CHANGED]: { icon: Trophy, color: 'text-amber-500' },
  [NotificationType.BRACKET_GENERATED]: { icon: LayoutGrid, color: 'text-blue-500' },
  [NotificationType.MATCH_RESULT_UPDATED]: { icon: Medal, color: 'text-purple-500' },
  [NotificationType.CLUB_MEMBER_APPROVED]: { icon: UserCheck, color: 'text-emerald-500' },
  [NotificationType.CLUB_MEMBER_REJECTED]: { icon: XCircle, color: 'text-red-500' },
  [NotificationType.CLUB_INVITED]: { icon: UserPlus, color: 'text-blue-500' },
  [NotificationType.INQUIRY_REPLIED]: { icon: Mail, color: 'text-indigo-500' },
  [NotificationType.REFUND_COMPLETED]: { icon: DollarSign, color: 'text-emerald-500' },
  [NotificationType.ENTRY_SUBMITTED]: { icon: Send, color: 'text-blue-500' },
  [NotificationType.ENTRY_CANCELLED]: { icon: Ban, color: 'text-orange-500' },
  [NotificationType.PAYMENT_COMPLETED]: { icon: CreditCard, color: 'text-emerald-500' },
  [NotificationType.CLUB_JOIN_REQUESTED]: { icon: Users, color: 'text-amber-500' },
}

interface NotificationItemProps {
  notification: Notification
  onRead?: (id: string) => void
}

export function NotificationItem({ notification, onRead }: NotificationItemProps) {
  const router = useRouter()
  const { icon: Icon, color } = NOTIFICATION_ICON_MAP[notification.type] ?? {
    icon: CheckCircle,
    color: 'text-gray-500',
  }

  const handleClick = async () => {
    // 읽음 처리
    if (!notification.is_read) {
      await markAsRead(notification.id)
      onRead?.(notification.id)
    }

    // metadata.link가 있으면 해당 페이지로 이동
    const link = notification.metadata?.link as string | undefined
    if (link) {
      router.push(link)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`w-full text-left flex items-start gap-3 px-4 py-3 transition-colors
        ${notification.is_read
          ? 'bg-(--bg-primary)'
          : 'bg-(--bg-card)'
        }
        hover:bg-(--bg-secondary)
      `}
    >
      {/* 아이콘 */}
      <div className={`shrink-0 mt-0.5 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${notification.is_read ? 'text-(--text-secondary)' : 'text-(--text-primary) font-medium'}`}>
          {notification.title}
        </p>
        <p className="text-xs text-(--text-tertiary) mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-xs text-(--text-tertiary) mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>

      {/* 미읽음 표시 */}
      {!notification.is_read && (
        <div className="shrink-0 mt-2">
          <span className="block w-2 h-2 rounded-full bg-blue-500" aria-hidden="true" />
        </div>
      )}
    </button>
  )
}
