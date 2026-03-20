import { getCoaches } from '@/lib/coaches/actions'
import { LessonsPageClient } from './_components/LessonsPageClient'

export const metadata = {
  title: '레슨 안내 | 마포구테니스협회',
  description: '전문 코치와 함께하는 테니스 레슨. 주1회·주2회 패키지 레슨을 신청해보세요.',
}

export default async function LessonsPage() {
  const { data: coaches } = await getCoaches()

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          레슨 안내
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          전문 코치와 함께하는 체계적인 테니스 레슨
        </p>
      </div>

      <LessonsPageClient coaches={coaches} />
    </div>
  )
}
