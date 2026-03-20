import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { FeedCard } from '@/components/community/FeedCard'
import type { Post } from '@/lib/community/types'

interface RecentPostsSectionProps {
  posts: Post[]
  isLoggedIn: boolean
}

export function RecentPostsSection({ posts, isLoggedIn }: RecentPostsSectionProps) {
  if (posts.length === 0) return null

  return (
    <section aria-label="최근 커뮤니티 소식">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5" style={{ color: 'var(--accent-color)' }} aria-hidden="true" />
          <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
            최근 커뮤니티 소식
          </h2>
        </div>
        <Link
          href="/community"
          className="text-xs transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-muted)' }}
        >
          전체 보기 →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
        {posts.map((post) => (
          <FeedCard key={post.id} post={post} isLoggedIn={isLoggedIn} />
        ))}
      </div>
    </section>
  )
}
