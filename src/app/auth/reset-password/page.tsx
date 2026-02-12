'use client'

import { resetPassword, updatePassword } from '@/lib/auth/actions'
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect, useRef, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { AlertDialog } from '@/components/common/AlertDialog'

const PASSWORD_MIN_LENGTH = 6

function ResetPasswordContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = searchParams.get('code')

  // code가 있으면 새 비밀번호 입력 모드, 없으면 이메일 입력 모드
  const [mode, setMode] = useState<'email' | 'password'>(code ? 'password' : 'email')
  const [sessionReady, setSessionReady] = useState(!code) // code 없으면 바로 ready
  const [loading, setLoading] = useState(false)

  // 이메일 입력 모드
  const [email, setEmail] = useState('')

  // 새 비밀번호 입력 모드
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

  const [alert, setAlert] = useState({
    isOpen: false,
    message: '',
    type: 'error' as 'error' | 'success' | 'info',
  })
  const [actionDone, setActionDone] = useState(false) // 성공 후 이동 플래그

  const emailRef = useRef<HTMLInputElement>(null)
  const newPasswordRef = useRef<HTMLInputElement>(null)
  const errorFieldRef = useRef<string | null>(null)

  // code가 있으면 세션 교환
  useEffect(() => {
    if (!code) return

    const exchangeCode = async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        setAlert({
          isOpen: true,
          message: '재설정 링크가 만료되었거나 유효하지 않습니다. 다시 시도해주세요.',
          type: 'error',
        })
        setMode('email')
        setSessionReady(true)
      } else {
        setMode('password')
        setSessionReady(true)
      }
    }

    exchangeCode()
  }, [code])

  const handleAlertClose = () => {
    setAlert((prev) => ({ ...prev, isOpen: false }))
    if (actionDone) {
      router.push('/auth/login')
      return
    }
    const key = errorFieldRef.current
    if (key === 'email') emailRef.current?.focus()
    if (key === 'newPassword') newPasswordRef.current?.focus()
    errorFieldRef.current = null
  }

  // 이메일 발송
  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      errorFieldRef.current = 'email'
      setAlert({ isOpen: true, message: '이메일을 입력해주세요.', type: 'error' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errorFieldRef.current = 'email'
      setAlert({ isOpen: true, message: '올바른 이메일 형식이 아닙니다.', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const result = await resetPassword(email.trim())
      if (result?.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
      } else {
        setActionDone(true)
        setAlert({
          isOpen: true,
          message: result?.message || '비밀번호 재설정 이메일을 발송했습니다.',
          type: 'success',
        })
      }
    } catch {
      setAlert({ isOpen: true, message: '이메일 발송 중 오류가 발생했습니다.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // 새 비밀번호 설정
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      errorFieldRef.current = 'newPassword'
      setAlert({ isOpen: true, message: `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`, type: 'error' })
      return
    }
    if (newPassword !== newPasswordConfirm) {
      errorFieldRef.current = 'newPassword'
      setAlert({ isOpen: true, message: '비밀번호가 일치하지 않습니다.', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const result = await updatePassword(newPassword)
      if (result?.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
      } else {
        setActionDone(true)
        setAlert({
          isOpen: true,
          message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.',
          type: 'success',
        })
      }
    } catch {
      setAlert({ isOpen: true, message: '비밀번호 변경 중 오류가 발생했습니다.', type: 'error' })
    } finally {
      setLoading(false)
    }
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
              {mode === 'email' ? '비밀번호 찾기' : '새 비밀번호 설정'}
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              {mode === 'email'
                ? '가입한 이메일을 입력하면 재설정 링크를 보내드립니다'
                : '새로운 비밀번호를 입력해주세요'}
            </p>
          </div>

          {!sessionReady ? (
            // code 교환 중 로딩
            <div className="text-center py-8">
              <div
                className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                style={{ borderColor: 'var(--border-color)', borderTopColor: 'transparent' }}
              />
              <p style={{ color: 'var(--text-muted)' }}>인증 확인 중...</p>
            </div>
          ) : mode === 'email' ? (
            // 이메일 입력 모드
            <form onSubmit={handleSendEmail} noValidate className="space-y-3 mb-6">
              <div>
                <label htmlFor="reset-email" className="sr-only">이메일</label>
                <input
                  ref={emailRef}
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="가입한 이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
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
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '발송 중...' : '재설정 이메일 발송'}
              </button>
            </form>
          ) : (
            // 새 비밀번호 입력 모드
            <form onSubmit={handleUpdatePassword} noValidate className="space-y-3 mb-6">
              <div>
                <label htmlFor="new-password" className="sr-only">새 비밀번호</label>
                <input
                  ref={newPasswordRef}
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="새 비밀번호 (6자 이상)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  className="w-full px-4 py-3.5 rounded-xl border outline-none transition-colors focus:ring-2 focus:ring-emerald-500/50"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                />
              </div>
              <div>
                <label htmlFor="new-password-confirm" className="sr-only">새 비밀번호 확인</label>
                <input
                  id="new-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="새 비밀번호 확인"
                  value={newPasswordConfirm}
                  onChange={(e) => setNewPasswordConfirm(e.target.value)}
                  disabled={loading}
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
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-medium text-white bg-emerald-600 hover:bg-emerald-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '변경 중...' : '비밀번호 변경'}
              </button>
            </form>
          )}

          <p
            className="text-center text-sm mb-8"
            style={{ color: 'var(--text-muted)' }}
          >
            <Link
              href="/auth/login"
              className="font-medium hover:underline"
              style={{ color: 'var(--text-primary)' }}
            >
              로그인으로 돌아가기
            </Link>
          </p>
        </div>
      </main>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={handleAlertClose}
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}

function ResetPasswordLoading() {
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
            <div className="h-6 bg-(--bg-card) rounded w-40 mx-auto mb-3" />
            <div className="h-4 bg-(--bg-card) rounded w-64 mx-auto mb-12" />
            <div className="h-12 bg-(--bg-card) rounded-xl mb-3" />
            <div className="h-12 bg-(--bg-card) rounded-xl" />
          </div>
        </div>
      </main>
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordLoading />}>
      <ResetPasswordContent />
    </Suspense>
  )
}
