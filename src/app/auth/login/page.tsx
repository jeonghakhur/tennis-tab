'use client'

import { signInWithOAuth, signInWithEmail } from '@/lib/auth/actions'
import { useState, Suspense, useRef } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { AlertDialog } from '@/components/common/AlertDialog'

function LoginContent() {
  const [loading, setLoading] = useState<'google' | 'kakao' | 'naver' | 'email' | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const searchParams = useSearchParams()
  const router = useRouter()
  const redirectTo = searchParams.get('redirect') || '/'
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // 이메일 로그인
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setAlert({ isOpen: true, message: '이메일을 입력해주세요.', type: 'error' })
      return
    }
    if (!password) {
      setAlert({ isOpen: true, message: '비밀번호를 입력해주세요.', type: 'error' })
      return
    }

    setLoading('email')
    try {
      const result = await signInWithEmail(email, password)
      if (result?.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        setLoading(null)
      } else {
        router.push(redirectTo)
      }
    } catch {
      setAlert({ isOpen: true, message: '로그인 중 오류가 발생했습니다.', type: 'error' })
      setLoading(null)
    }
  }

  // 구글 로그인
  const handleGoogleLogin = async () => {
    setLoading('google')
    try {
      await signInWithOAuth('google', redirectTo)
    } catch {
      setLoading(null)
    }
  }

  // 카카오 로그인
  const handleKakaoLogin = async () => {
    setLoading('kakao')
    try {
      await signInWithOAuth('kakao', redirectTo)
    } catch {
      setLoading(null)
    }
  }

  // 네이버 로그인
  const handleNaverLogin = () => {
    setLoading('naver')
    window.location.href = `/api/auth/naver/login?redirect=${encodeURIComponent(redirectTo)}`
  }

  return (
    <>
      <Navigation />
      <main
        className="min-h-screen flex items-center justify-center pt-20"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-10">
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
            계정으로 로그인하세요
          </p>
        </div>

        {/* 이메일 로그인 폼 */}
        <form onSubmit={handleEmailLogin} noValidate className="space-y-3 mb-6">
          <div>
            <label htmlFor="login-email" className="sr-only">이메일</label>
            <input
              ref={emailRef}
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading !== null}
              className="w-full px-4 py-3.5 rounded-xl border outline-none transition-colors focus:ring-2 focus:ring-emerald-500/50"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <div>
            <label htmlFor="login-password" className="sr-only">비밀번호</label>
            <input
              ref={passwordRef}
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading !== null}
              className="w-full px-4 py-3.5 rounded-xl border outline-none transition-colors focus:ring-2 focus:ring-emerald-500/50"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading !== null}
            className="w-full py-3.5 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading === 'email' ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <div className="text-center mb-6">
          <Link
            href="/auth/reset-password"
            className="text-sm hover:underline"
            style={{ color: 'var(--text-muted)' }}
          >
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        {/* 구분선 */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>또는</span>
          <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border-color)' }} />
        </div>

        {/* 소셜 로그인 */}
        <div className="space-y-3">
          {/* 구글 로그인 */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed border"
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
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>구글 로그인</span>
              </>
            )}
          </button>

          {/* 카카오 로그인 */}
          <button
            onClick={handleKakaoLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#FEE500',
              color: '#000000',
            }}
          >
            {loading === 'kakao' ? (
              <span>로그인 중...</span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 3C6.477 3 2 6.477 2 10.8c0 2.78 1.784 5.22 4.465 6.606-.184.675-.625 2.37-.719 2.75-.107.438.159.432.335.314.14-.093 2.22-1.516 3.098-2.116.576.079 1.168.126 1.771.126 5.523 0 10-3.477 10-7.8S17.523 3 12 3z" />
                </svg>
                <span>카카오 로그인</span>
              </>
            )}
          </button>

          {/* 네이버 로그인 */}
          <button
            onClick={handleNaverLogin}
            disabled={loading !== null}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl font-medium transition-all duration-300 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#03C75A',
              color: '#FFFFFF',
            }}
          >
            {loading === 'naver' ? (
              <span>로그인 중...</span>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.273 12.845L7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z" />
                </svg>
                <span>네이버 로그인</span>
              </>
            )}
          </button>
        </div>

        {/* 회원가입 링크 */}
        <p
          className="text-center text-sm mt-8"
          style={{ color: 'var(--text-muted)' }}
        >
          계정이 없으신가요?{' '}
          <Link
            href="/auth/signup"
            className="font-medium hover:underline"
            style={{ color: 'var(--text-primary)' }}
          >
            회원가입
          </Link>
        </p>

        <p
          className="text-center text-sm mt-4 mb-8"
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

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}

function LoginLoading() {
  return (
    <>
      <Navigation />
      <main
        className="min-h-screen flex items-center justify-center pt-20"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        <div className="w-full max-w-md px-6 text-center">
          <div className="animate-pulse">
            <div className="h-8 bg-(--bg-card) rounded w-48 mx-auto mb-8" />
            <div className="h-6 bg-(--bg-card) rounded w-32 mx-auto mb-3" />
            <div className="h-4 bg-(--bg-card) rounded w-48 mx-auto mb-12" />
            <div className="space-y-3">
              <div className="h-12 bg-(--bg-card) rounded-xl" />
              <div className="h-12 bg-(--bg-card) rounded-xl" />
              <div className="h-12 bg-(--bg-card) rounded-xl" />
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoading />}>
      <LoginContent />
    </Suspense>
  )
}
