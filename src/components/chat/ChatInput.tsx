'use client'

import { useState, FormEvent } from 'react'
import Link from 'next/link'
import type { ChatResponse, ChatSuccessResponse, ChatMessage } from '@/lib/chat/types'

const examplePrompts = [
  { text: '이번 주 서울 대회 뭐 있어?', icon: '🔍' },
  { text: '서울 오픈 대진표 보여줘', icon: '📊' },
  { text: '서울 오픈 결과 알려줘', icon: '🏆' },
  { text: '서울 오픈 참가 조건이 뭐야?', icon: '📋' },
]

interface ChatInputProps {
  history: ChatMessage[]
  onResponse: (userMessage: string, response: ChatSuccessResponse) => void
  onError: (error: string) => void
  onLoadingChange: (loading: boolean) => void
}

export function ChatInput({ history, onResponse, onError, onLoadingChange }: ChatInputProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  /** 메시지 전송 공통 로직 */
  const sendMessage = async (text: string) => {
    onLoadingChange(true)
    onError('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      })
      const data: ChatResponse = await res.json()

      if (data.success) {
        onResponse(text, data)
        setQuery('')
      } else {
        onError(data.error)
      }
    } catch {
      onError('네트워크 오류가 발생했습니다.')
    } finally {
      onLoadingChange(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    await sendMessage(trimmed)
  }

  /** 예시 프롬프트 클릭 → 즉시 전송 */
  const handleExampleClick = async (text: string) => {
    setQuery(text)
    await sendMessage(text)
  }

  return (
    <div className="w-full max-w-3xl mx-auto opacity-0 animate-slide-up animate-delay-300">
      <form onSubmit={handleSubmit} noValidate className="relative">
        <div
          className="relative rounded-2xl transition-all duration-300"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: `1px solid ${isFocused ? 'var(--accent-color)' : 'var(--border-color)'}`,
            boxShadow: isFocused ? '0 0 30px var(--shadow-glow)' : 'none',
          }}
        >
          <div className="flex items-center px-5 py-4">
            <svg
              className="w-6 h-6 mr-3 shrink-0"
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
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="무엇이든 물어보세요..."
              aria-label="메시지 입력"
              className="flex-1 bg-transparent outline-none text-lg"
              style={{ color: 'var(--text-primary)' }}
            />
            <button
              type="submit"
              aria-label="전송"
              className="ml-3 p-2.5 rounded-xl transition-all duration-300 hover:scale-105"
              style={{
                backgroundColor: query.trim() ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                color: query.trim() ? 'var(--bg-primary)' : 'var(--text-muted)',
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </form>

      {/* 예시 프롬프트 */}
      <div className="mt-5">
        <p className="text-sm mb-3 text-center" style={{ color: 'var(--text-muted)' }}>
          이런 것들을 물어볼 수 있어요
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {examplePrompts.map((prompt) => (
            <button
              key={prompt.text}
              onClick={() => handleExampleClick(prompt.text)}
              className="px-4 py-2 text-sm rounded-full transition-all duration-300 hover:scale-105"
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
              <span className="mr-2">{prompt.icon}</span>
              {prompt.text}
            </button>
          ))}
        </div>
      </div>

      {/* 로그인 안내 */}
      <p className="text-xs text-center mt-6" style={{ color: 'var(--text-muted)' }}>
        <Link href="/auth/login" className="underline hover:no-underline" style={{ color: 'var(--accent-color)' }}>
          로그인
        </Link>
        하면 대회 참가 신청, 경기 결과 등록 등 더 많은 기능을 사용할 수 있어요
      </p>
    </div>
  )
}
