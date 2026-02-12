'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ChatInput, examplePrompts } from './ChatInput'
import { ChatMessageList, type DisplayMessage } from './ChatMessageList'
import type { ChatSuccessResponse, ChatMessage, ChatResponse } from '@/lib/chat/types'

/** 전체 화면 채팅 UI */
export function ChatSection() {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [history, setHistory] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResponse = useCallback((userMessage: string, res: ChatSuccessResponse) => {
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: res.message, links: res.links },
    ])
    setHistory((prev) => [
      ...prev,
      { role: 'user', content: userMessage },
      { role: 'assistant', content: res.message },
    ])
    setError(null)
  }, [])

  const handleError = useCallback((err: string) => {
    setError(err || null)
  }, [])

  /** 예시 프롬프트 클릭 → 즉시 전송 */
  const handleExampleClick = useCallback(async (text: string) => {
    // 유저 메시지 즉시 표시
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data: ChatResponse = await res.json()

      if (data.success) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.message, links: data.links },
        ])
        setHistory((prev) => [
          ...prev,
          { role: 'user', content: text },
          { role: 'assistant', content: data.message },
        ])
      } else {
        setError(data.error)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }, [history])

  const isEmpty = messages.length === 0 && !loading

  return (
    <div className="flex flex-col flex-1 min-h-0 pb-20">
      {isEmpty ? (
        /* 빈 상태: 웰컴 + 예시 프롬프트 */
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-6 max-w-2xl">
            {/* 로고 / 타이틀 */}
            <div className="mb-8">
              <div
                className="w-16 h-16 mx-auto mb-5 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                <svg
                  className="w-8 h-8"
                  style={{ color: 'var(--accent-color)' }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h1
                className="font-display text-3xl md:text-4xl tracking-tight mb-3"
                style={{ color: 'var(--text-primary)' }}
              >
                무엇이든 물어보세요
              </h1>
              <p className="text-base" style={{ color: 'var(--text-muted)' }}>
                대회 검색, 대진표 조회, 경기 결과까지 대화로 해결하세요
              </p>
            </div>

            {/* 예시 프롬프트 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              {examplePrompts.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => handleExampleClick(prompt.text)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all duration-200 hover:scale-[1.02]"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-accent)'
                    e.currentTarget.style.backgroundColor = 'var(--bg-card-hover)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-color)'
                    e.currentTarget.style.backgroundColor = 'var(--bg-card)'
                  }}
                >
                  <span className="text-lg shrink-0">{prompt.icon}</span>
                  <span>{prompt.text}</span>
                </button>
              ))}
            </div>

            {/* 로그인 안내 */}
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <Link href="/auth/login" className="underline hover:no-underline" style={{ color: 'var(--accent-color)' }}>
                로그인
              </Link>
              하면 대회 참가 신청, 경기 결과 등록 등 더 많은 기능을 사용할 수 있어요
            </p>
          </div>
        </div>
      ) : (
        /* 대화 중: 메시지 목록 */
        <ChatMessageList messages={messages} loading={loading} error={error} />
      )}

      {/* 하단 고정 입력창 */}
      <ChatInput
        history={history}
        onResponse={handleResponse}
        onError={handleError}
        onLoadingChange={setLoading}
        disabled={loading}
      />
    </div>
  )
}
