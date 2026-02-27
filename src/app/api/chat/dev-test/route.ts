import { NextRequest, NextResponse } from 'next/server'
import { runAgent, GeminiQuotaError } from '@/lib/chat/agent'
import { handleEntryFlow } from '@/lib/chat/entryFlow/handler'
import { getSession } from '@/lib/chat/entryFlow/sessionStore'
import { getCancelSession, handleCancelFlow } from '@/lib/chat/cancelFlow/handler'
import type { ChatMessage } from '@/lib/chat/types'

/** DEV 전용 — 인증 없이 agent + flow 세션 테스트. 프로덕션에서는 404 반환 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { message, user_id, history = [] } = await request.json() as {
    message: string
    user_id?: string
    history?: ChatMessage[]
  }

  if (!message) {
    return NextResponse.json({ error: 'message required' }, { status: 400 })
  }

  try {
    // 활성 플로우 세션 체크 (실제 route.ts와 동일한 흐름)
    if (user_id) {
      const entrySession = getSession(user_id)
      if (entrySession) {
        const r = await handleEntryFlow(user_id, message)
        return NextResponse.json({ success: true, intent: 'APPLY_TOURNAMENT', message: r.message, links: r.links, flow_active: r.flowActive })
      }
      const cancelSession = getCancelSession(user_id)
      if (cancelSession) {
        const r = await handleCancelFlow(user_id, message)
        return NextResponse.json({ success: true, intent: 'CANCEL_ENTRY', message: r.message, links: r.links, flow_active: r.flowActive })
      }
    }

    const result = await runAgent(message, history, user_id)
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    if (err instanceof GeminiQuotaError) {
      return NextResponse.json({ error: 'Gemini quota exceeded' }, { status: 429 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
