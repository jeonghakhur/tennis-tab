'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import type { ChatResponse, ChatSuccessResponse, ChatMessage } from '@/lib/chat/types'

interface ChatInputProps {
  history: ChatMessage[]
  onResponse: (userMessage: string, response: ChatSuccessResponse) => void
  onError: (error: string) => void
  onLoadingChange: (loading: boolean) => void
  disabled?: boolean
}

export function ChatInput({ history, onResponse, onError, onLoadingChange, disabled }: ChatInputProps) {
  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 전송 완료 후 입력창에 포커스 복귀
  useEffect(() => {
    if (!disabled) inputRef.current?.focus()
  }, [disabled])

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
    if (!trimmed || disabled) return
    await sendMessage(trimmed)
  }

  return (
    <div className="shrink-0 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-3xl mx-auto px-4 py-3">
        <form onSubmit={handleSubmit} noValidate>
          <div
            className="relative rounded-2xl transition-all duration-200"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${isFocused ? 'var(--accent-color)' : 'var(--border-color)'}`,
              boxShadow: isFocused ? '0 0 20px var(--shadow-glow)' : 'none',
            }}
          >
            <div className="flex items-center px-4 py-3">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="메시지를 입력하세요..."
                aria-label="메시지 입력"
                disabled={disabled}
                className="flex-1 bg-transparent outline-none text-base"
                style={{ color: 'var(--text-primary)' }}
              />
              <button
                type="submit"
                aria-label="전송"
                disabled={!query.trim() || disabled}
                className="ml-3 p-2 rounded-xl transition-all duration-200 disabled:opacity-40"
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
      </div>
    </div>
  )
}

/** 예시 프롬프트 (빈 상태에서 표시) */
export const examplePrompts = [
  { text: '이번 주 서울 대회 뭐 있어?', icon: '🔍' },
  { text: '서울 오픈 대진표 보여줘', icon: '📊' },
  { text: '서울 오픈 결과 알려줘', icon: '🏆' },
  { text: '서울 오픈 참가 조건이 뭐야?', icon: '📋' },
]
