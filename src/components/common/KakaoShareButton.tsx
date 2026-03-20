'use client'

import { useCallback, useState } from 'react'
import { Share2 } from 'lucide-react'
import { shareKakao } from '@/lib/kakao/share'
import { Toast } from '@/components/common/AlertDialog'

interface KakaoShareButtonProps {
  title: string
  /** 이미 plain text로 준비된 설명 (HTML strip은 호출부 책임) */
  description: string
  /** 호출부에서 완성된 절대 URL 전달 */
  pageUrl: string
  imageUrl?: string
  /** 아이콘만 표시 (목록용) vs 아이콘+텍스트 (상세용) */
  compact?: boolean
  className?: string
}

export function KakaoShareButton({
  title,
  description,
  pageUrl,
  imageUrl,
  compact = false,
  className,
}: KakaoShareButtonProps) {
  const [toast, setToast] = useState({ isOpen: false, message: '' })

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const result = await shareKakao({ title, description, imageUrl, pageUrl })

    if (result.fallback) {
      setToast({ isOpen: true, message: '링크가 복사되었습니다.' })
    }
  }, [title, description, imageUrl, pageUrl])

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
