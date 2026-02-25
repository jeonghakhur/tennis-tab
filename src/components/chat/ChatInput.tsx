'use client'

import { useState, useRef, useEffect, useImperativeHandle, forwardRef, FormEvent } from 'react'
import Link from 'next/link'
import type { ChatResponse, ChatSuccessResponse, ChatMessage } from '@/lib/chat/types'

interface ChatInputProps {
  history: ChatMessage[]
  onResponse: (userMessage: string, response: ChatSuccessResponse) => void
  onError: (error: string) => void
  onLoadingChange: (loading: boolean) => void
  disabled?: boolean
  placeholder?: string
  isLoggedIn?: boolean
}

/** 외부에서 호출 가능한 메서드 */
export interface ChatInputHandle {
  send: (text: string) => Promise<void>
}

export const ChatInput = forwardRef<ChatInputHandle, ChatInputProps>(
  function ChatInput({ history, onResponse, onError, onLoadingChange, disabled, placeholder, isLoggedIn = true }, ref) {
    const [query, setQuery] = useState('')
    const [isFocused, setIsFocused] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)

    // 전송 완료 후 입력창에 포커스 복귀
    useEffect(() => {
      if (!disabled && isLoggedIn) inputRef.current?.focus()
    }, [disabled, isLoggedIn])

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

    // 외부에서 sendMessage 호출 가능하도록 ref 노출
    useImperativeHandle(ref, () => ({
      send: sendMessage,
    }))

    const handleSubmit = async (e: FormEvent) => {
      e.preventDefault()
      const trimmed = query.trim()
      if (!trimmed || disabled) return
      await sendMessage(trimmed)
    }

    // 비로그인: 로그인 유도 배너
    if (!isLoggedIn) {
      return (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
          <div className="max-w-[1920px] mx-auto px-4 py-3">
            <div
              className="flex items-center justify-between gap-4 rounded-2xl px-5 py-3"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                채팅 기능을 이용하려면 로그인이 필요합니다.
              </p>
              <Link
                href="/auth/login"
                className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
              >
                로그인하기
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-[1920px] mx-auto px-4 py-3">
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
                  placeholder={placeholder ?? '메시지를 입력하세요...'}
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
  },
)

/** 예시 프롬프트 (빈 상태에서 표시) */
export const examplePrompts = [
  { text: '이번 주 서울 대회 뭐 있어?', icon: '🔍' },
  { text: '대회 참가 신청하고 싶어', icon: '✍️' },
  { text: '서울 오픈 대진표 보여줘', icon: '📊' },
  { text: '서울 오픈 참가 조건이 뭐야?', icon: '📋' },
]
