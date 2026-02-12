'use client'

import { signUpWithEmail } from '@/lib/auth/actions'
import { useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Navigation } from '@/components/Navigation'
import { AlertDialog } from '@/components/common/AlertDialog'

const PASSWORD_MIN_LENGTH = 6
const NAME_MIN_LENGTH = 2

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState({
    isOpen: false,
    message: '',
    type: 'error' as 'error' | 'success',
  })
  // 가입 성공 시 로그인 페이지로 이동 플래그
  const [signupSuccess, setSignupSuccess] = useState(false)
  const router = useRouter()

  const nameRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const passwordConfirmRef = useRef<HTMLInputElement>(null)

  // AlertDialog 닫힐 때 에러 필드 포커스 복귀 or 성공 시 로그인으로 이동
  const errorFieldRef = useRef<string | null>(null)
  const fieldRefs: Record<string, React.RefObject<HTMLInputElement | null>> = {
    name: nameRef,
    email: emailRef,
    password: passwordRef,
    passwordConfirm: passwordConfirmRef,
  }

  const handleAlertClose = () => {
    setAlert((prev) => ({ ...prev, isOpen: false }))
    if (signupSuccess) {
      router.push('/auth/login')
      return
    }
    const key = errorFieldRef.current
    if (key && fieldRefs[key]) {
      fieldRefs[key].current?.focus()
      errorFieldRef.current = null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 순차 검증
    if (name.trim().length < NAME_MIN_LENGTH) {
      errorFieldRef.current = 'name'
      setAlert({ isOpen: true, message: `이름은 최소 ${NAME_MIN_LENGTH}자 이상이어야 합니다.`, type: 'error' })
      return
    }
    if (!email.trim()) {
      errorFieldRef.current = 'email'
      setAlert({ isOpen: true, message: '이메일을 입력해주세요.', type: 'error' })
      return
    }
    // 간단한 이메일 형식 검사
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errorFieldRef.current = 'email'
      setAlert({ isOpen: true, message: '올바른 이메일 형식이 아닙니다.', type: 'error' })
      return
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      errorFieldRef.current = 'password'
      setAlert({ isOpen: true, message: `비밀번호는 최소 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`, type: 'error' })
      return
    }
    if (password !== passwordConfirm) {
      errorFieldRef.current = 'passwordConfirm'
      setAlert({ isOpen: true, message: '비밀번호가 일치하지 않습니다.', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const result = await signUpWithEmail(email.trim(), password, name.trim())
      if (result?.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
      } else {
        setSignupSuccess(true)
        setAlert({
          isOpen: true,
          message: result?.message || '인증 이메일을 발송했습니다. 이메일을 확인해주세요.',
          type: 'success',
        })
      }
    } catch {
      setAlert({ isOpen: true, message: '회원가입 중 오류가 발생했습니다.', type: 'error' })
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
              회원가입
            </h1>
            <p style={{ color: 'var(--text-muted)' }}>
              이메일로 간편하게 가입하세요
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-3 mb-6">
            <div>
              <label htmlFor="signup-name" className="sr-only">이름</label>
              <input
                ref={nameRef}
                id="signup-name"
                type="text"
                autoComplete="name"
                placeholder="이름 (2자 이상)"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              <label htmlFor="signup-email" className="sr-only">이메일</label>
              <input
                ref={emailRef}
                id="signup-email"
                type="email"
                autoComplete="email"
                placeholder="이메일"
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
            <div>
              <label htmlFor="signup-password" className="sr-only">비밀번호</label>
              <input
                ref={passwordRef}
                id="signup-password"
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호 (6자 이상)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              <label htmlFor="signup-password-confirm" className="sr-only">비밀번호 확인</label>
              <input
                ref={passwordConfirmRef}
                id="signup-password-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="비밀번호 확인"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
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
              {loading ? '가입 중...' : '회원가입'}
            </button>
          </form>

          <p
            className="text-center text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            이미 계정이 있으신가요?{' '}
            <Link
              href="/auth/login"
              className="font-medium hover:underline"
              style={{ color: 'var(--text-primary)' }}
            >
              로그인
            </Link>
          </p>

          <p
            className="text-center text-sm mt-4 mb-8"
            style={{ color: 'var(--text-muted)' }}
          >
            가입하면{' '}
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
        onClose={handleAlertClose}
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}
