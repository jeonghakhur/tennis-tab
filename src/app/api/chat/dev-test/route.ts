import { NextRequest, NextResponse } from 'next/server'
import { classifyIntent, GeminiQuotaError } from '@/lib/chat/classify'
import { getHandler } from '@/lib/chat/handlers'
import { handleEntryFlow } from '@/lib/chat/entryFlow/handler'
import { getSession, deleteSession } from '@/lib/chat/entryFlow/sessionStore'
import { getCancelSession, handleCancelFlow, clearCancelSession } from '@/lib/chat/cancelFlow/handler'
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
        if (isNewQueryDuringFlow(message, entrySession.step)) {
          deleteSession(user_id)
        } else {
          const r = await handleEntryFlow(user_id, message)
          return NextResponse.json({ success: true, intent: 'APPLY_TOURNAMENT', message: r.message, links: r.links, flow_active: r.flowActive })
        }
      }
      const cancelSession = getCancelSession(user_id)
      if (cancelSession) {
        if (isNewQueryDuringFlow(message, cancelSession.step)) {
          clearCancelSession(user_id)
        } else {
          const r = await handleCancelFlow(user_id, message)
          return NextResponse.json({ success: true, intent: 'CANCEL_ENTRY', message: r.message, links: r.links, flow_active: r.flowActive })
        }
      }
    }

    const classification = await classifyIntent(message, history)
    const handler = getHandler(classification.intent)
    const handlerResult = await handler(classification.entities, user_id)
    return NextResponse.json({
      success: true,
      intent: classification.intent,
      message: handlerResult.message,
      links: handlerResult.links,
      ...(handlerResult.flow_active !== undefined && { flow_active: handlerResult.flow_active }),
    })
  } catch (err) {
    if (err instanceof GeminiQuotaError) {
      return NextResponse.json({ error: 'Gemini quota exceeded' }, { status: 429 })
    }
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

/** route.ts와 동일한 판별 로직 */
const FLOW_CANCEL_KEYWORDS = new Set(['취소', 'cancel', '그만', '중단'])

function isNewQueryDuringFlow(message: string, step: string): boolean {
  const m = message.trim().toLowerCase()
  if (FLOW_CANCEL_KEYWORDS.has(m)) return false
  // CONFIRM/CONFIRM_CANCEL: 인식 안 된 입력도 플로우에서 재요청 처리
  if (step === 'CONFIRM' || step === 'CONFIRM_CANCEL') return false
  if (step === 'SELECT_ENTRY') return !/^\d+$/.test(m)
  // SELECT_TOURNAMENT, SELECT_DIVISION: 번호·이름 모두 허용 → 플로우 핸들러에서 처리
  return false
}
