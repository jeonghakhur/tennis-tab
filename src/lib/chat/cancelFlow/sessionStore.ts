import { createAdminClient } from '@/lib/supabase/admin'
import type { CancelFlowSession } from './types'

/** 세션 TTL: 10분 */
const SESSION_TTL_MINUTES = 10

/** 세션 조회 (만료 시 null 반환) */
export async function getCancelSession(userId: string): Promise<CancelFlowSession | null> {
  const admin = createAdminClient()
  const expiredAt = new Date(Date.now() - SESSION_TTL_MINUTES * 60 * 1000).toISOString()

  const { data } = await admin
    .from('cancel_flow_sessions')
    .select('session_data')
    .eq('user_id', userId)
    .gt('updated_at', expiredAt)
    .single()

  if (!data) return null
  return data.session_data as unknown as CancelFlowSession
}

/** 세션 저장/업데이트 (UPSERT) */
export async function setCancelSession(userId: string, session: CancelFlowSession): Promise<void> {
  session.updatedAt = Date.now()
  const admin = createAdminClient()

  await admin
    .from('cancel_flow_sessions')
    .upsert({
      user_id: userId,
      session_data: session as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
}

/** 세션 삭제 */
export async function deleteCancelSession(userId: string): Promise<void> {
  const admin = createAdminClient()

  await admin
    .from('cancel_flow_sessions')
    .delete()
    .eq('user_id', userId)
}
