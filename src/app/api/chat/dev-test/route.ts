import { NextRequest, NextResponse } from 'next/server'
import { runAgent, GeminiQuotaError } from '@/lib/chat/agent'
import { handleEntryFlow } from '@/lib/chat/entryFlow/handler'
import { getSession, deleteSession } from '@/lib/chat/entryFlow/sessionStore'
import { getCancelSession, handleCancelFlow, clearCancelSession } from '@/lib/chat/cancelFlow/handler'
import type { ChatMessage } from '@/lib/chat/types'
import type { EntryFlowSession } from '@/lib/chat/entryFlow/types'

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
      const entrySession = await getSession(user_id)
      if (entrySession) {
        if (isNewQueryDuringFlow(message, entrySession.step) || isUnrelatedToStep(message, entrySession)) {
          await deleteSession(user_id)
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

    const agentResult = await runAgent(message, history, user_id)
    return NextResponse.json({
      success: true,
      message: agentResult.message,
      links: agentResult.links,
      ...(agentResult.flow_active !== undefined && { flow_active: agentResult.flow_active }),
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
  if (step === 'CONFIRM' || step === 'CONFIRM_CANCEL') return false
  if (step === 'SELECT_ENTRY') return !/^\d+$/.test(m)
  return false
}

function isUnrelatedToStep(message: string, session: EntryFlowSession): boolean {
  const m = message.trim().toLowerCase()
  if (/^\d+$/.test(m)) return false

  if (session.step === 'SELECT_DIVISION' && session.data.divisions?.length) {
    return !session.data.divisions.some((d) => {
      const lower = d.name.toLowerCase()
      return lower.includes(m) || m.includes(lower)
    })
  }

  if (session.step === 'SELECT_TOURNAMENT' && session.data.searchResults?.length) {
    return !session.data.searchResults.some((t) => {
      const lower = t.title.toLowerCase()
      return lower.includes(m) || m.includes(lower)
    })
  }

  return false
}
