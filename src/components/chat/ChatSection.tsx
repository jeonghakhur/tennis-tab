'use client'

import { useState, useCallback } from 'react'
import { ChatInput } from './ChatInput'
import { ChatResponse } from './ChatResponse'
import type { ChatSuccessResponse, ChatMessage } from '@/lib/chat/types'

/** 홈 페이지용 채팅 섹션 (ChatInput + ChatResponse 래퍼, 대화 히스토리 관리) */
export function ChatSection() {
  const [chatResponse, setChatResponse] = useState<ChatSuccessResponse | null>(null)
  const [chatLoading, setChatLoading] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [history, setHistory] = useState<ChatMessage[]>([])

  /** 응답 성공 시 히스토리에 user + assistant 메시지 추가 */
  const handleResponse = useCallback((userMessage: string, res: ChatSuccessResponse) => {
    setChatResponse(res)
    setChatError(null)
    setHistory((prev) => [
      ...prev,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: res.message },
    ])
  }, [])

  const handleError = useCallback((err: string) => {
    setChatError(err || null)
    setChatResponse(null)
  }, [])

  return (
    <>
      <ChatInput
        history={history}
        onResponse={handleResponse}
        onError={handleError}
        onLoadingChange={setChatLoading}
      />
      <ChatResponse
        response={chatResponse}
        loading={chatLoading}
        error={chatError}
      />
    </>
  )
}
