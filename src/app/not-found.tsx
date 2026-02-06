import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="text-center space-y-6">
        <div className="space-y-2">
          <h1 className="font-display text-8xl font-bold text-(--accent-color)">
            404
          </h1>
          <h2 className="font-display text-2xl font-semibold text-(--text-primary)">
            페이지를 찾을 수 없습니다
          </h2>
        </div>
        <p className="text-(--text-secondary) max-w-md mx-auto">
          요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.
        </p>
        <Link
          href="/"
          className="btn-primary inline-block relative z-10"
        >
          <span className="relative z-10">홈으로 돌아가기</span>
        </Link>
      </div>
    </div>
  )
}
