'use client'

import Link from 'next/link'
import { Navigation } from '@/components/Navigation'
import { useAuth } from '@/components/AuthProvider'
import { MessageSquare, ClipboardList, LogIn } from 'lucide-react'

export default function SupportPage() {
  const { user, loading } = useAuth()

  return (
    <>
      <Navigation />
      <main
        className="min-h-screen pt-20"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* 헤더 */}
          <div className="mb-10 text-center">
            <h1
              className="text-3xl font-display mb-3"
              style={{ color: 'var(--text-primary)' }}
            >
              고객센터
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              무엇을 도와드릴까요?
            </p>
          </div>

          {/* 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* 1:1 문의하기 */}
            {user ? (
              <Link
                href="/support/inquiry"
                className="glass-card rounded-xl p-8 text-center hover:bg-(--bg-card-hover) transition-colors group"
              >
                <MessageSquare
                  className="w-10 h-10 mx-auto mb-4 group-hover:text-(--accent-color) transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                />
                <h2
                  className="font-display text-lg mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  1:1 문의하기
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  궁금한 점이 있으시면 문의해주세요.
                </p>
              </Link>
            ) : (
              <div className="glass-card rounded-xl p-8 text-center">
                <LogIn
                  className="w-10 h-10 mx-auto mb-4"
                  style={{ color: 'var(--text-muted)' }}
                />
                <h2
                  className="font-display text-lg mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  1:1 문의하기
                </h2>
                <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                  문의를 남기려면 로그인이 필요합니다.
                </p>
                <Link
                  href="/auth/login"
                  className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  로그인
                </Link>
              </div>
            )}

            {/* 내 문의 내역 */}
            {user ? (
              <Link
                href="/support/inquiry/history"
                className="glass-card rounded-xl p-8 text-center hover:bg-(--bg-card-hover) transition-colors group"
              >
                <ClipboardList
                  className="w-10 h-10 mx-auto mb-4 group-hover:text-(--accent-color) transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                />
                <h2
                  className="font-display text-lg mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  내 문의 내역
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  접수한 문의의 처리 현황을 확인하세요.
                </p>
              </Link>
            ) : (
              <div className="glass-card rounded-xl p-8 text-center opacity-60">
                <ClipboardList
                  className="w-10 h-10 mx-auto mb-4"
                  style={{ color: 'var(--text-muted)' }}
                />
                <h2
                  className="font-display text-lg mb-2"
                  style={{ color: 'var(--text-primary)' }}
                >
                  내 문의 내역
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {loading ? '로딩 중...' : '로그인 후 이용 가능합니다.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
