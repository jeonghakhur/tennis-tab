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
  Trash2,
  MessageSquare,
} from 'lucide-react'
import { NotificationType, type Notification } from '@/lib/notifications/types'
import { markAsRead, deleteNotification } from '@/lib/notifications/actions'
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
  [NotificationType.LESSON_INQUIRY]: { icon: MessageSquare, color: 'text-teal-500' },
}

interface NotificationItemProps {
  notification: Notification
  onRead?: (id: string) => void
  onDelete?: (id: string) => void
}

export function NotificationItem({ notification, onRead, onDelete }: NotificationItemProps) {
  const router = useRouter()
  const { icon: Icon, color } = NOTIFICATION_ICON_MAP[notification.type] ?? {
    icon: CheckCircle,
    color: 'text-gray-500',
  }

  const handleClick = async () => {
    if (!notification.is_read) {
      await markAsRead(notification.id)
      onRead?.(notification.id)
    }

    const link = notification.metadata?.link as string | undefined
    if (link) {
      router.push(link)
    }
  }

  const handleDelete = async (e: React.MouseEvent) => {
    // 버블링 차단 (부모 클릭 핸들러 실행 방지)
    e.stopPropagation()
    await deleteNotification(notification.id)
    onDelete?.(notification.id)
  }

  return (
    <div
      className={`group relative flex items-start gap-3 px-4 py-3 transition-colors
        ${notification.is_read ? 'bg-(--bg-primary)' : 'bg-(--bg-card)'}
        hover:bg-(--bg-secondary)
      `}
    >
      {/* 클릭 영역 (아이콘 + 내용) */}
      <button
        type="button"
        onClick={handleClick}
        className="flex flex-1 items-start gap-3 min-w-0 text-left"
        aria-label={`알림: ${notification.title}`}
      >
        {/* 아이콘 */}
        <div className={`shrink-0 mt-0.5 ${color}`}>
          <Icon className="w-5 h-5" />
        </div>

        {/* 내용 — 모바일: 세로, 데스크탑: 가로 한 줄 */}
        <div className="flex-1 min-w-0 md:flex md:items-center md:gap-4">
          {/* 제목 + 모바일 시간 */}
          <div className="shrink-0 md:w-44 lg:w-56">
            <p className={`text-sm truncate ${notification.is_read ? 'text-(--text-secondary)' : 'text-(--text-primary) font-medium'}`}>
              {notification.title}
            </p>
            {/* 시간: 모바일에서만 제목 아래에 표시 */}
            <p className="text-xs text-(--text-tertiary) mt-0.5 md:hidden">
              {formatRelativeTime(notification.created_at)}
            </p>
          </div>

          {/* 메시지 */}
          <p className="flex-1 text-xs text-(--text-tertiary) mt-0.5 md:mt-0 line-clamp-2 md:line-clamp-1 min-w-0">
            {notification.message}
          </p>

          {/* 시간: 데스크탑에서만 오른쪽에 표시 */}
          <p className="hidden md:block shrink-0 text-xs text-(--text-tertiary) whitespace-nowrap">
            {formatRelativeTime(notification.created_at)}
          </p>
        </div>
      </button>

      {/* 우측: 미읽음 표시 + 삭제 버튼 */}
      <div className="shrink-0 flex items-center gap-2 self-center">
        {/* 삭제 버튼 — 항상 표시 (모바일), 호버 시 표시 (데스크탑) */}
        <button
          type="button"
          onClick={handleDelete}
          className="p-1 rounded-md text-(--text-tertiary)
            hover:text-red-500 hover:bg-red-500/10
            transition-colors
            opacity-100 md:opacity-0 md:group-hover:opacity-100"
          aria-label="알림 삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {/* 미읽음 표시 */}
        {!notification.is_read && (
          <span
            className="block w-2 h-2 rounded-full bg-blue-500 shrink-0"
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  )
}
