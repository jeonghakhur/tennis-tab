import Link from 'next/link'
import type { PinnedNotice } from '@/lib/home/actions'

interface NoticeBannerProps {
  notices: PinnedNotice[]
}

function formatRelativeDate(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const days = Math.floor((now - date) / 86400000)
  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

export function NoticeBanner({ notices }: NoticeBannerProps) {
  if (notices.length === 0) return null

  return (
    <section aria-label="공지사항">
      <div className="space-y-2">
        {notices.map((notice) => (
          <Link
            key={notice.id}
            href={`/community/${notice.id}`}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:opacity-80"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
            }}
          >
            <span
              className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
            >
              공지
            </span>
            <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-primary)' }}>
              {notice.title}
            </span>
            <time
              className="shrink-0 text-xs"
              style={{ color: 'var(--text-muted)' }}
              dateTime={notice.created_at}
            >
              {formatRelativeDate(notice.created_at)}
            </time>
          </Link>
        ))}
      </div>
    </section>
  )
}
