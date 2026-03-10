'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sanitizeInput } from '@/lib/utils/validation'
import type {
  Notification,
  CreateNotificationParams,
  CreateBulkNotificationParams,
} from './types'

interface GetNotificationsOptions {
  limit?: number
  offset?: number
  unreadOnly?: boolean
}

/** 본인 알림 목록 조회 */
export async function getNotifications(
  options: GetNotificationsOptions = {}
): Promise<{ data: Notification[]; error?: string }> {
  const { limit = 20, offset = 0, unreadOnly = false } = options

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { data: [], error: '로그인이 필요합니다.' }

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq('is_read', false)
    }

    const { data, error } = await query

    if (error) return { data: [], error: error.message }
    return { data: (data ?? []) as Notification[] }
  } catch (err) {
    console.error('getNotifications error:', err)
    return { data: [], error: '알림 목록을 불러올 수 없습니다.' }
  }
}

/** 미읽음 수 조회 */
export async function getUnreadCount(): Promise<{ count: number; error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { count: 0, error: '로그인이 필요합니다.' }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) return { count: 0, error: error.message }
    return { count: count ?? 0 }
  } catch (err) {
    console.error('getUnreadCount error:', err)
    return { count: 0, error: '미읽음 수를 조회할 수 없습니다.' }
  }
}

/** 단일 알림 읽음 처리 */
export async function markAsRead(
  notificationId: string
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: '로그인이 필요합니다.' }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', user.id)

    if (error) return { error: error.message }
    return {}
  } catch (err) {
    console.error('markAsRead error:', err)
    return { error: '읽음 처리에 실패했습니다.' }
  }
}

/** 전체 읽음 처리 */
export async function markAllAsRead(): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: '로그인이 필요합니다.' }

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false)

    if (error) return { error: error.message }
    return {}
  } catch (err) {
    console.error('markAllAsRead error:', err)
    return { error: '전체 읽음 처리에 실패했습니다.' }
  }
}

/**
 * 알림 생성 (내부용 — admin client로 INSERT)
 * 메인 기능을 막지 않도록 호출부에서 try-catch로 감싸서 사용
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<{ error?: string }> {
  try {
    const admin = createAdminClient()

    const { error } = await admin.from('notifications').insert({
      user_id: params.user_id,
      type: params.type,
      title: sanitizeInput(params.title),
      message: sanitizeInput(params.message),
      tournament_id: params.tournament_id ?? null,
      entry_id: params.entry_id ?? null,
      match_id: params.match_id ?? null,
      club_id: params.club_id ?? null,
      metadata: params.metadata ?? {},
    })

    if (error) {
      console.error('createNotification error:', error)
      return { error: error.message }
    }
    return {}
  } catch (err) {
    console.error('createNotification error:', err)
    return { error: '알림 생성에 실패했습니다.' }
  }
}

/**
 * 다수 사용자 일괄 알림 생성 (내부용)
 * 대회 상태 변경 등 참가자 전원에게 알림 발송
 */
export async function createBulkNotifications(
  params: CreateBulkNotificationParams
): Promise<{ error?: string }> {
  try {
    if (params.user_ids.length === 0) return {}

    const admin = createAdminClient()
    const title = sanitizeInput(params.title)
    const message = sanitizeInput(params.message)

    const rows = params.user_ids.map((user_id) => ({
      user_id,
      type: params.type,
      title,
      message,
      tournament_id: params.tournament_id ?? null,
      entry_id: params.entry_id ?? null,
      match_id: params.match_id ?? null,
      club_id: params.club_id ?? null,
      metadata: params.metadata ?? {},
    }))

    const { error } = await admin.from('notifications').insert(rows)

    if (error) {
      console.error('createBulkNotifications error:', error)
      return { error: error.message }
    }
    return {}
  } catch (err) {
    console.error('createBulkNotifications error:', err)
    return { error: '일괄 알림 생성에 실패했습니다.' }
  }
}
