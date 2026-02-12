'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import type { ChatMessage, ChatSuccessResponse } from '@/lib/chat/types'

/** 대화 메시지 + 응답 데이터를 함께 저장하는 타입 */
export interface DisplayMessage {
  role: 'user' | 'assistant'
  content: string
  /** assistant 메시지에만 존재 */
  links?: ChatSuccessResponse['links']
}

interface ChatMessageListProps {
  messages: DisplayMessage[]
  loading: boolean
  error: string | null
}

/** 채팅 메시지 목록 (스크롤 영역) */
export function ChatMessageList({ messages, loading, error }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // 새 메시지 추가 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, loading])

  return (
    <div
      className="flex-1 overflow-y-auto"
      role="log"
      aria-live="polite"
      aria-label="대화 내용"
    >
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'user' ? (
              <UserBubble content={msg.content} />
            ) : (
              <AssistantBubble content={msg.content} links={msg.links} />
            )}
          </div>
        ))}

        {/* 로딩 인디케이터 */}
        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--accent-color)', animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--accent-color)', animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--accent-color)', animationDelay: '300ms' }} />
              </div>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>생각하는 중...</span>
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]"
              style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}
            >
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  )
}

/** 유저 메시지 말풍선 */
function UserBubble({ content }: { content: string }) {
  return (
    <div
      className="rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%]"
      style={{
        backgroundColor: 'var(--accent-color)',
        color: 'var(--bg-primary)',
      }}
    >
      <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  )
}

/** AI 응답 말풍선 */
function AssistantBubble({ content, links }: { content: string; links?: ChatSuccessResponse['links'] }) {
  return (
    <div
      className="rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] space-y-3"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
      }}
    >
      <p
        className="text-sm leading-relaxed whitespace-pre-line"
        style={{ color: 'var(--text-primary)' }}
      >
        {content}
      </p>

      {links && links.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all duration-200 hover:scale-105"
              style={{
                backgroundColor: 'var(--bg-card-hover)',
                border: '1px solid var(--border-color)',
                color: 'var(--accent-color)',
              }}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
