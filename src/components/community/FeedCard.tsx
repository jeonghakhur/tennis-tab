'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Heart, MessageCircle, Eye } from 'lucide-react'
import { toggleLike } from '@/lib/community/actions'
import { KakaoShareButton } from '@/components/community/KakaoShareButton'
import type { Post, PostAttachment } from '@/lib/community/types'

// 본문에서 텍스트만 추출 (HTML 태그 제거)
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

// 본문 HTML에서 <img> src 추출
const IMG_SRC_REGEX = /<img[^>]+src="([^"]+)"[^>]*>/g
function extractContentImages(html: string): { url: string; name: string }[] {
  const results: { url: string; name: string }[] = []
  let match
  const regex = new RegExp(IMG_SRC_REGEX.source, 'g')
  while ((match = regex.exec(html)) !== null) {
    results.push({ url: match[1], name: '본문 이미지' })
  }
  return results
}

// 상대 시간 표시
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
  const d = new Date(dateStr); return `${d.getFullYear()}. ${d.getMonth()+1}. ${d.getDate()}.`
}

interface FeedCardProps {
  post: Post
  isLoggedIn: boolean
}

export function FeedCard({ post, isLoggedIn }: FeedCardProps) {
  const router = useRouter()
  const [liked, setLiked] = useState(post.is_liked ?? false)
  const [likeCount, setLikeCount] = useState(post.like_count)
  const [likeLoading, setLikeLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // 첨부 이미지 → content 인라인 이미지 순으로 합산
  const attachmentImages = (post.attachments ?? []).filter(
    (a: PostAttachment) => a.type === 'image'
  )
  const contentImages = attachmentImages.length > 0
    ? [] // 첨부 이미지가 있으면 중복 방지
    : extractContentImages(post.content)
  const images = attachmentImages.length > 0 ? attachmentImages : contentImages

  const plainText = stripHtml(post.content)
  // 4줄 이상인지 대략 판단 (한 줄 약 60자 기준)
  const isLongText = plainText.length > 240

  const handleLike = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoggedIn || likeLoading) return
    setLikeLoading(true)

    // 낙관적 업데이트
    const prevLiked = liked
    const prevCount = likeCount
    setLiked(!liked)
    setLikeCount(liked ? likeCount - 1 : likeCount + 1)

    const result = await toggleLike(post.id)
    if (result.error) {
      // 롤백
      setLiked(prevLiked)
      setLikeCount(prevCount)
    } else {
      setLiked(result.liked)
      setLikeCount(result.likeCount)
    }
    setLikeLoading(false)
  }, [isLoggedIn, likeLoading, liked, likeCount, post.id])


  const postUrl = `/community/${post.id}`

  return (
    <Link href={postUrl} className="block glass-card rounded-xl overflow-hidden hover:bg-(--bg-card-hover) transition-colors">
      <article>
      {/* 헤더: 아바타 + 이름 + 시간 + 카테고리 */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* 아바타 */}
        <div
          className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-sm font-bold"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--bg-primary)',
          }}
        >
          {post.author?.avatar_url ? (
            <Image
              src={post.author.avatar_url}
              alt=""
              width={36}
              height={36}
              className="rounded-full object-cover w-full h-full"
              unoptimized
            />
          ) : (
            (post.author?.name ?? '?')[0]
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="text-sm font-semibold truncate"
              style={{ color: 'var(--text-primary)' }}
            >
              {post.author?.name ?? '알 수 없음'}
            </span>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              <span suppressHydrationWarning>{formatRelativeTime(post.created_at)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 제목 + 본문 */}
      <div className="px-4 pb-3">
        <h3
          className="text-base font-semibold mb-1"
          style={{ color: 'var(--text-primary)' }}
        >
          {post.title}
        </h3>
        <div
          className={`text-sm leading-relaxed ${!expanded && isLongText ? 'line-clamp-4' : ''}`}
          style={{ color: 'var(--text-secondary)' }}
        >
          {plainText}
        </div>
        {isLongText && !expanded && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(true) }}
            className="text-sm font-medium mt-1"
            style={{ color: 'var(--text-muted)' }}
          >
            더보기
          </button>
        )}
      </div>

      {/* 이미지 (첫 번째만 표시, 클릭 시 상세 이동) */}
      {images.length > 0 && (
        <div className="relative w-full" style={{ aspectRatio: '4/3' }}>
          <Image
            src={images[0].url}
            alt={images[0].name || '첨부 이미지'}
            fill
            className="object-cover"
            unoptimized
          />
          {/* 이미지 개수 뱃지 (2개 이상) */}
          {images.length > 1 && (
            <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full">
              +{images.length - 1}
            </span>
          )}
        </div>
      )}

      {/* 액션바: 좋아요 + 댓글 + 조회수 */}
      <div
        className="flex items-center gap-5 px-4 py-3 border-t"
        style={{ borderColor: 'var(--border-color)' }}
      >
        {/* 좋아요 */}
        <button
          type="button"
          onClick={handleLike}
          disabled={!isLoggedIn || likeLoading}
          className="flex items-center gap-1.5 text-sm transition-colors disabled:opacity-50"
          style={{ color: liked ? '#ef4444' : 'var(--text-muted)' }}
          aria-label={liked ? '좋아요 취소' : '좋아요'}
          aria-pressed={liked}
        >
          <Heart
            className="w-5 h-5"
            fill={liked ? '#ef4444' : 'none'}
            strokeWidth={liked ? 0 : 1.5}
          />
          <span>{likeCount}</span>
        </button>

        {/* 댓글 — Link 대신 button 사용 (부모 Link 안에서 <a> 중첩 방지) */}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            router.push(`/community/${post.id}#comments`)
          }}
          className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)' }}
        >
          <MessageCircle className="w-5 h-5" />
          <span>{post.comment_count}</span>
        </button>

        {/* 공유 */}
        <KakaoShareButton
          title={post.title}
          content={post.content}
          imageUrl={images[0]?.url}
          postId={post.id}
          compact
        />

        {/* 조회수 */}
        <span
          className="flex items-center gap-1.5 text-sm ml-auto"
          style={{ color: 'var(--text-muted)' }}
        >
          <Eye className="w-4 h-4" />
          <span>{post.view_count}</span>
        </span>
      </div>

      </article>
    </Link>
  )
}
