import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeInput } from '@/lib/utils/validation'
import { runAgent, GeminiQuotaError } from '@/lib/chat/agent'
import { saveChatLog } from '@/lib/chat/logs'
import { checkRateLimit } from '@/lib/chat/rateLimit'
import { getSession } from '@/lib/chat/entryFlow/sessionStore'
import { handleEntryFlow } from '@/lib/chat/entryFlow/handler'
import { getCancelSession, handleCancelFlow } from '@/lib/chat/cancelFlow/handler'
import type { ChatResponse, ChatMessage } from '@/lib/chat/types'

/** 메시지 길이 제한 */
const MAX_MESSAGE_LENGTH = 500

export async function POST(request: NextRequest): Promise<NextResponse<ChatResponse>> {
  try {
    // 1. 로그인 확인 (비인증 요청 차단)
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id
    const isAuthenticated = !!userId

    if (!isAuthenticated) {
      return NextResponse.json(
        { success: false, error: '로그인이 필요합니다.', code: 'AUTH_REQUIRED' } as ChatResponse,
        { status: 401 },
      )
    }

    // Rate Limit key: 인증 후 userId는 반드시 string
    const rateLimitKey = userId!

    // 2. Rate Limit 확인
    const rateResult = checkRateLimit(rateLimitKey, isAuthenticated)
    if (rateResult.limited) {
      return NextResponse.json(
        {
          success: false,
          error: `요청이 너무 많습니다. ${rateResult.retryAfter}초 후 다시 시도해주세요.`,
          code: 'RATE_LIMIT',
        } as ChatResponse,
        { status: 429 },
      )
    }

    // 3. Request body 파싱 + 검증
    let body: { message?: string; session_id?: string; history?: ChatMessage[] }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: '잘못된 요청 형식입니다.', code: 'INVALID_INPUT' } as ChatResponse,
        { status: 400 },
      )
    }

    const rawMessage = body.message
    if (!rawMessage || typeof rawMessage !== 'string') {
      return NextResponse.json(
        { success: false, error: '메시지를 입력해주세요.', code: 'INVALID_INPUT' } as ChatResponse,
        { status: 400 },
      )
    }

    if (rawMessage.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { success: false, error: `메시지는 ${MAX_MESSAGE_LENGTH}자 이내로 입력해주세요.`, code: 'INVALID_INPUT' } as ChatResponse,
        { status: 400 },
      )
    }

    // 4. XSS 방지
    const sanitizedMessage = sanitizeInput(rawMessage)
    if (!sanitizedMessage) {
      return NextResponse.json(
        { success: false, error: '메시지를 입력해주세요.', code: 'INVALID_INPUT' } as ChatResponse,
        { status: 400 },
      )
    }

    // 5. 참가 신청 플로우 세션 확인 (Gemini 바이패스)
    if (userId) {
      const entrySession = getSession(userId)
      if (entrySession) {
        const flowResult = await handleEntryFlow(userId, sanitizedMessage)

        // 채팅 로그 저장
        saveChatLog({
          userId,
          sessionId: body.session_id,
          message: sanitizedMessage,
          response: flowResult.message,
          intent: 'APPLY_TOURNAMENT',
          entities: {} as Record<string, unknown>,
        })

        return NextResponse.json({
          success: true,
          intent: 'APPLY_TOURNAMENT',
          message: flowResult.message,
          links: flowResult.links,
          flow_active: flowResult.flowActive,
        } as ChatResponse)
      }

      // 참가 취소 플로우 세션 확인 (Gemini 바이패스)
      const cancelSession = getCancelSession(userId)
      if (cancelSession) {
        const flowResult = await handleCancelFlow(userId, sanitizedMessage)

        saveChatLog({
          userId,
          sessionId: body.session_id,
          message: sanitizedMessage,
          response: flowResult.message,
          intent: 'CANCEL_ENTRY',
          entities: {} as Record<string, unknown>,
        })

        return NextResponse.json({
          success: true,
          intent: 'CANCEL_ENTRY',
          message: flowResult.message,
          links: flowResult.links,
          flow_active: flowResult.flowActive,
        } as ChatResponse)
      }
    }

    // 6. Agent 실행 (Gemini 2.0 Flash Function Calling)
    const history = Array.isArray(body.history) ? body.history : []
    const result = await runAgent(sanitizedMessage, history, userId)

    // 7. 채팅 로그 저장 (비동기, 실패 무시)
    saveChatLog({
      userId,
      sessionId: body.session_id,
      message: sanitizedMessage,
      response: result.message,
      intent: 'SEARCH_TOURNAMENT',
      entities: {},
    })

    // 8. 응답 반환
    return NextResponse.json({
      success: true,
      intent: 'SEARCH_TOURNAMENT',
      message: result.message,
      links: result.links,
      ...(result.flow_active !== undefined && { flow_active: result.flow_active }),
    } as ChatResponse)
  } catch (error) {
    // Gemini API 할당량 초과
    if (error instanceof GeminiQuotaError) {
      return NextResponse.json(
        {
          success: false,
          error: 'AI 서비스 일일 사용량이 초과되었습니다. 잠시 후 다시 시도해주세요.',
          code: 'RATE_LIMIT',
        } as ChatResponse,
        { status: 429 },
      )
    }

    // 기타 에러
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[POST /api/chat] 에러:', msg)
    return NextResponse.json(
      {
        success: false,
        error: '현재 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.',
        code: 'INTERNAL_ERROR',
      } as ChatResponse,
      { status: 500 },
    )
  }
}
