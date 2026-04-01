import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getNotifications, getUnreadCount } from '@/lib/notifications/actions'
import { NotificationList } from './NotificationList'

export const metadata = {
  title: '알림 | 마포구테니스협회',
  description: '알림 목록을 확인합니다.',
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const [{ data: notifications }, { count: unreadCount }] = await Promise.all([
    getNotifications({ limit: 100 }),
    getUnreadCount(),
  ])

  return <NotificationList initialNotifications={notifications} initialUnreadCount={unreadCount} />
}
