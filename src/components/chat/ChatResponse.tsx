'use client'

import Link from 'next/link'
import type { ChatSuccessResponse } from '@/lib/chat/types'

interface ChatResponseProps {
  response: ChatSuccessResponse | null
  loading: boolean
  error: string | null
}

export function ChatResponse({ response, loading, error }: ChatResponseProps) {
  // 아무것도 표시할 게 없으면 숨김
  if (!response && !loading && !error) return null

  return (
    <div
      role="log"
      aria-live="polite"
      aria-label="AI 응답"
      aria-busy={loading}
      className="w-full max-w-3xl mx-auto mt-6 animate-fade-in"
    >
      {/* 로딩 */}
      {loading && (
        <div
          className="glass-card p-6 flex items-center gap-3"
        >
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--accent-color)', animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--accent-color)', animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--accent-color)', animationDelay: '300ms' }} />
          </div>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            답변을 생성하고 있어요...
          </span>
        </div>
      )}

      {/* 에러 */}
      {!loading && error && (
        <div className="glass-card p-6">
          <p className="text-red-500 text-sm">{error}</p>
        </div>
      )}

      {/* 응답 */}
      {!loading && !error && response && (
        <div className="glass-card p-6 space-y-4">
          {/* 메시지 본문 */}
          <p
            className="text-sm leading-relaxed whitespace-pre-line"
            style={{ color: 'var(--text-primary)' }}
          >
            {response.message}
          </p>

          {/* 링크 카드 */}
          {response.links && response.links.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {response.links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg transition-all duration-200 hover:scale-105"
                  style={{
                    backgroundColor: 'var(--bg-card-hover)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--accent-color)',
                  }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
