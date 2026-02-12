import { createAdminClient } from '@/lib/supabase/admin'

/** 채팅 로그 저장 (admin client로 RLS 우회) */
export async function saveChatLog(params: {
  userId?: string
  sessionId?: string
  message: string
  response: string
  intent: string
  entities: Record<string, unknown>
}): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('chat_logs').insert({
      user_id: params.userId ?? null,
      session_id: params.sessionId ?? null,
      message: params.message,
      response: params.response,
      intent: params.intent,
      entities: params.entities,
    })
  } catch {
    // 로그 저장 실패는 사용자 응답에 영향 없음 — 무시
  }
}
