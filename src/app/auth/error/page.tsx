import Link from 'next/link'
import { Navigation } from '@/components/Navigation'

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string; error?: string }>
}) {
  const params = await searchParams
  const provider = params.provider || '알 수 없음'
  const errorMessage = params.error

  const providerNames: Record<string, string> = {
    naver: '네이버',
    kakao: '카카오',
  }

  return (
    <>
      <Navigation />
      <main
        className="min-h-screen flex items-center justify-center pt-20"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
      <div className="text-center px-6 max-w-md">
        <h1
          className="text-4xl font-display mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          로그인 오류
        </h1>
        <p className="text-lg mb-4" style={{ color: 'var(--text-muted)' }}>
          {providerNames[provider] || provider} 로그인 중 문제가 발생했습니다.
        </p>
        {errorMessage && (
          <p className="text-sm mb-8 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
            오류: {errorMessage}
          </p>
        )}
        <p className="text-sm mb-8" style={{ color: 'var(--text-muted)' }}>
          다시 시도하거나 다른 로그인 방법을 사용해주세요.
        </p>
        <Link
          href="/auth/login"
          className="inline-block px-8 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--bg-primary)',
          }}
        >
          다시 로그인하기
        </Link>
      </div>
      </main>
    </>
  )
}
