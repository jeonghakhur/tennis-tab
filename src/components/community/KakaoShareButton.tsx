'use client'

import { useCallback, useState } from 'react'
import { Share2 } from 'lucide-react'
import { shareKakao } from '@/lib/kakao/share'
import { Toast } from '@/components/common/AlertDialog'

/** HTML 태그 제거 */
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

interface KakaoShareButtonProps {
  title: string
  content: string
  imageUrl?: string
  postId: string
  /** 아이콘만 표시 (목록용) vs 텍스트 포함 (상세용) */
  compact?: boolean
  className?: string
}

export function KakaoShareButton({
  title,
  content,
  imageUrl,
  postId,
  compact = false,
  className,
}: KakaoShareButtonProps) {
  const [toast, setToast] = useState({ isOpen: false, message: '' })

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
    const pageUrl = `${siteUrl}/community/${postId}`
    const description = stripHtml(content).slice(0, 100)

    const result = await shareKakao({
      title,
      description,
      imageUrl,
      pageUrl,
    })

    if (result.fallback) {
      setToast({ isOpen: true, message: '링크가 복사되었습니다.' })
    }
  }, [title, content, imageUrl, postId])

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        className={`flex items-center gap-1.5 text-sm transition-colors hover:opacity-80 ${className ?? ''}`}
        style={{ color: 'var(--text-muted)' }}
        aria-label="카카오톡 공유"
      >
        <Share2 className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
        {!compact && <span>공유</span>}
      </button>
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type="success"
        duration={2000}
      />
    </>
  )
}
