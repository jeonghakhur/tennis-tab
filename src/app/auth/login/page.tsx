'use client'

import { signInWithOAuth } from '@/lib/auth/actions'
import { useState } from 'react'
import Link from 'next/link'

export default function LoginPage() {
  const [loading, setLoading] = useState<'google' | 'kakao' | 'naver' | null>(null)

  // 구글 로그인 (Supabase OAuth)
  const handleGoogleLogin = async () => {
    setLoading('google')
    try {
      await signInWithOAuth('google')
    } catch (error) {
      console.error('구글 로그인 에러:', error)
      setLoading(null)
    }
  }

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
          {/* 구글 로그인 (Supabase OAuth) */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed border"
            style={{
              backgroundColor: '#FFFFFF',
              color: '#000000',
              borderColor: 'var(--border-color)',
            }}
          >
            {loading === 'google' ? (
              <span>로그인 중...</span>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>구글 로그인</span>
              </>
            )}
          </button>

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
