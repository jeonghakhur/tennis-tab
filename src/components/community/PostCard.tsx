'use client'

import Link from 'next/link'
import { Eye, MessageCircle, Pin } from 'lucide-react'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { Post, PostCategory } from '@/lib/community/types'
import { POST_CATEGORY_LABELS } from '@/lib/community/types'

const CATEGORY_VARIANT: Record<PostCategory, BadgeVariant> = {
  NOTICE: 'info',
  FREE: 'secondary',
  INFO: 'purple',
  REVIEW: 'orange',
}

/** 상대 시간 표시 (예: "3시간 전", "2일 전") */
function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '방금 전'
  if (minutes < 60) return `${minutes}분 전`
  if (hours < 24) return `${hours}시간 전`
  if (days < 30) return `${days}일 전`
  // 30일 이상이면 날짜 표시
  return new Date(dateStr).toLocaleDateString('ko-KR')
}

interface PostCardProps {
  post: Post
}

export function PostCard({ post }: PostCardProps) {
  return (
    <Link
      href={`/community/${post.id}`}
      className="glass-card rounded-xl p-5 hover:bg-(--bg-card-hover) transition-colors block group"
    >
      <div className="flex items-start gap-3">
        {/* 핀 아이콘 */}
        {post.is_pinned && (
          <Pin
            className="w-4 h-4 mt-0.5 shrink-0"
            style={{ color: 'var(--accent-color)' }}
            aria-label="고정된 글"
          />
        )}

        <div className="flex-1 min-w-0">
          {/* 카테고리 + 제목 */}
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={CATEGORY_VARIANT[post.category]}>
              {POST_CATEGORY_LABELS[post.category]}
            </Badge>
            <h3
              className="text-sm font-medium truncate group-hover:text-(--accent-color) transition-colors"
              style={{ color: 'var(--text-primary)' }}
            >
              {post.title}
            </h3>
          </div>

          {/* 메타 정보: 작성자 + 작성일 + 조회수 + 댓글 수 */}
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{post.author?.name ?? '알 수 없음'}</span>
            <span>{formatRelativeTime(post.created_at)}</span>
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {post.view_count}
            </span>
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" />
              {post.comment_count}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
