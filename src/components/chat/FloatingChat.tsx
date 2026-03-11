'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ChatSection } from './ChatSection'

interface FloatingChatProps {
  isLoggedIn: boolean
}

export function FloatingChat({ isLoggedIn: initialLoggedIn }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(initialLoggedIn)

  // 클라이언트에서 실시간 세션 확인 (서버 SSR 불일치 보정)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setIsLoggedIn(!!data.session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  // body 스크롤 잠금 (오버레이 열릴 때)
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="AI 어시스턴트 열기"
        aria-expanded={isOpen}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-xl
                   flex items-center justify-center z-40
                   transition-all duration-200 hover:scale-110 active:scale-95
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        style={{
          backgroundColor: 'var(--accent-color)',
          color: 'var(--bg-primary)',
        }}
      >
        <MessageCircle className="w-6 h-6" aria-hidden="true" />
      </button>

      {/*
        오버레이: 항상 렌더링 (채팅 히스토리 보존)
        hidden 클래스로 가시성만 제어
      */}
      <div
        className={isOpen ? 'fixed inset-0 z-50 flex flex-col' : 'hidden'}
        role="dialog"
        aria-modal="true"
        aria-label="AI 어시스턴트"
      >
        {/* 오버레이 헤더 */}
        <div
          className="shrink-0 flex items-center justify-between px-4 h-14 border-b"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
          }}
        >
          <div className="flex items-center gap-2">
            <MessageCircle
              className="w-5 h-5"
              style={{ color: 'var(--accent-color)' }}
              aria-hidden="true"
            />
            <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
              AI 어시스턴트
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="닫기"
            className="p-2 rounded-lg transition-opacity hover:opacity-70
                       focus-visible:outline-none focus-visible:ring-2"
            style={{ color: 'var(--text-muted)' }}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* ChatSection */}
        <div className="flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <ChatSection isLoggedIn={isLoggedIn} />
        </div>
      </div>
    </>
  )
}
