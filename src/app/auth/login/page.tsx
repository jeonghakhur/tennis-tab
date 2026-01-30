'use client'

import { signInWithOAuth } from '@/lib/auth/actions'
import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [loading, setLoading] = useState<'kakao' | 'naver' | null>(null)

  // 카카오 로그인 (Supabase OAuth)
  const handleKakaoLogin = async () => {
    setLoading('kakao')
    try {
      await signInWithOAuth('kakao')
    } catch (error) {
      console.error('카카오 로그인 에러:', error)
      setLoading(null)
    }
  }

  // 네이버 로그인 (직접 구현)
  const handleNaverLogin = () => {
    setLoading('naver')
    // 네이버 API 라우트로 리다이렉트
    window.location.href = '/api/auth/naver/login'
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-12">
          <Link href="/" className="inline-block mb-8">
            <span
              className="font-display text-3xl tracking-wider"
              style={{ color: 'var(--text-primary)' }}
            >
              TENNIS TAB
            </span>
          </Link>
          <h1
            className="text-2xl font-display mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            로그인
          </h1>
          <p style={{ color: 'var(--text-muted)' }}>
            소셜 계정으로 간편하게 로그인하세요
          </p>
        </div>

        <div className="space-y-4">
          {/* 카카오 로그인 (Supabase OAuth) */}
          <button
            onClick={handleKakaoLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#FEE500',
              color: '#000000',
            }}
          >
            {loading === 'kakao' ? (
              <span>로그인 중...</span>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.78 1.784 5.22 4.465 6.606-.184.675-.625 2.37-.719 2.75-.107.438.159.432.335.314.14-.093 2.22-1.516 3.098-2.116.576.079 1.168.126 1.771.126 5.523 0 10-3.477 10-7.8S17.523 3 12 3z" />
                </svg>
                <span>카카오 로그인</span>
              </>
            )}
          </button>

          {/* 네이버 로그인 (직접 구현) */}
          <button
            onClick={handleNaverLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#03C75A',
              color: '#FFFFFF',
            }}
          >
            {loading === 'naver' ? (
              <span>로그인 중...</span>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
                </svg>
                <span>네이버 로그인</span>
              </>
            )}
          </button>
        </div>

        <p
          className="text-center text-sm mt-8"
          style={{ color: 'var(--text-muted)' }}
        >
          로그인하면{' '}
          <Link href="/terms" className="underline hover:no-underline">
            이용약관
          </Link>
          과{' '}
          <Link href="/privacy" className="underline hover:no-underline">
            개인정보처리방침
          </Link>
          에 동의하는 것으로 간주됩니다.
        </p>
      </div>
    </main>
  )
}
