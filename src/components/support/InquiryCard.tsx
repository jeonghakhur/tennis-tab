import Link from 'next/link'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  type Inquiry,
  type InquiryStatus,
} from '@/lib/support/types'

const STATUS_VARIANT: Record<InquiryStatus, BadgeVariant> = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
}

interface InquiryCardProps {
  inquiry: Inquiry
  /** 상세 페이지 링크 경로 prefix (기본: /support/inquiry) */
  linkPrefix?: string
  /** 작성자 정보 표시 여부 (관리자용) */
  showAuthor?: boolean
}

export function InquiryCard({
  inquiry,
  linkPrefix = '/support/inquiry',
  showAuthor = false,
}: InquiryCardProps) {
  const formattedDate = new Date(inquiry.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <Link
      href={`${linkPrefix}/${inquiry.id}`}
      className="glass-card rounded-xl p-5 block hover:bg-(--bg-card-hover) transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3
            className="font-medium truncate mb-1"
            style={{ color: 'var(--text-primary)' }}
          >
            {inquiry.title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary">
              {INQUIRY_CATEGORY_LABELS[inquiry.category]}
            </Badge>
            <Badge variant={STATUS_VARIANT[inquiry.status]}>
              {INQUIRY_STATUS_LABELS[inquiry.status]}
            </Badge>
            {showAuthor && inquiry.author && (
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {inquiry.author.name} ({inquiry.author.email})
              </span>
            )}
          </div>
        </div>
        <span
          className="text-xs whitespace-nowrap"
          style={{ color: 'var(--text-muted)' }}
        >
          {formattedDate}
        </span>
      </div>
    </Link>
  )
}
