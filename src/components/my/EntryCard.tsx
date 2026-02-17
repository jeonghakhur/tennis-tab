'use client'

import Link from 'next/link'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { MyEntry } from '@/lib/data/user'
import type { EntryStatus, PaymentStatus } from '@/lib/supabase/types'

interface EntryCardProps {
  entry: MyEntry
  onCancel: (entryId: string, tournamentTitle: string) => void
}

// 신청 상태 배지 설정
const ENTRY_STATUS_CONFIG: Record<EntryStatus, { label: string; variant: BadgeVariant; lineThrough?: boolean }> = {
  PENDING: { label: '대기', variant: 'secondary' },
  APPROVED: { label: '승인', variant: 'info' },
  CONFIRMED: { label: '확정', variant: 'success' },
  WAITLISTED: { label: '대기자', variant: 'warning' },
  REJECTED: { label: '거절', variant: 'danger' },
  CANCELLED: { label: '취소', variant: 'secondary', lineThrough: true },
}

// 결제 상태 배지 설정
const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '미납', variant: 'warning' },
  COMPLETED: { label: '완납', variant: 'success' },
  FAILED: { label: '실패', variant: 'danger' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

// 취소 버튼 숨김 상태
const HIDE_CANCEL_STATUSES: EntryStatus[] = ['CANCELLED', 'REJECTED']

/** 날짜 포맷: YYYY.MM.DD */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
}

export function EntryCard({ entry, onCancel }: EntryCardProps) {
  const entryStatus = ENTRY_STATUS_CONFIG[entry.status]
  const paymentStatus = PAYMENT_STATUS_CONFIG[entry.paymentStatus]
  const showCancel = !HIDE_CANCEL_STATUSES.includes(entry.status)

  return (
    <article
      className="rounded-xl p-5"
      style={{
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
      }}
    >
      {/* 헤더: 대회명 + 상태 배지 */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tournaments/${entry.tournamentId}`}
            className="text-base font-semibold hover:underline block truncate"
            style={{ color: 'var(--text-primary)' }}
          >
            {entry.tournamentTitle}
          </Link>
          <p
            className="text-sm mt-0.5"
            style={{ color: 'var(--text-muted)' }}
          >
            {entry.divisionName}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge
            variant={entryStatus.variant}
            className={entryStatus.lineThrough ? 'line-through' : ''}
          >
            {entryStatus.label}
          </Badge>
          <Badge variant={paymentStatus.variant}>
            {paymentStatus.label}
          </Badge>
        </div>
      </div>

      {/* 대회 정보 */}
      <dl className="space-y-1.5 text-sm mb-3">
        <div className="flex items-center gap-2">
          <dt className="sr-only">대회 일시</dt>
          <dd style={{ color: 'var(--text-muted)' }}>
            {formatDate(entry.tournamentStartDate)}
            {entry.tournamentEndDate !== entry.tournamentStartDate &&
              ` ~ ${formatDate(entry.tournamentEndDate)}`}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">장소</dt>
          <dd style={{ color: 'var(--text-muted)' }}>
            {entry.tournamentLocation}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <dt className="sr-only">신청일</dt>
          <dd style={{ color: 'var(--text-muted)' }}>
            신청일: {formatDate(entry.createdAt)}
          </dd>
        </div>
      </dl>

      {/* 복식 파트너 정보 */}
      {entry.partnerData && (
        <div
          className="rounded-lg px-3 py-2 text-sm mb-3"
          style={{ backgroundColor: 'var(--bg-card-hover)' }}
        >
          <span style={{ color: 'var(--text-muted)' }}>파트너: </span>
          <span style={{ color: 'var(--text-primary)' }}>
            {entry.partnerData.name}
            {entry.partnerData.club && ` (${entry.partnerData.club})`}
          </span>
        </div>
      )}

      {/* 단체전 팀 정보 */}
      {entry.teamMembers && entry.teamMembers.length > 0 && (
        <div
          className="rounded-lg px-3 py-2 text-sm mb-3"
          style={{ backgroundColor: 'var(--bg-card-hover)' }}
        >
          {entry.clubName && (
            <p style={{ color: 'var(--text-primary)' }} className="font-medium mb-1">
              {entry.clubName}
              {entry.teamOrder && (
                <span style={{ color: 'var(--text-muted)' }}> ({entry.teamOrder})</span>
              )}
            </p>
          )}
          <p style={{ color: 'var(--text-muted)' }}>
            팀원: {entry.teamMembers.map(m => m.name).join(', ')}
          </p>
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center justify-end gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
        <Link
          href={`/tournaments/${entry.tournamentId}`}
          className="text-sm px-3 py-1.5 rounded-lg hover:opacity-80"
          style={{ color: 'var(--accent-color)' }}
        >
          상세 보기
        </Link>
        {showCancel && (
          <button
            type="button"
            onClick={() => onCancel(entry.id, entry.tournamentTitle)}
            className="text-sm px-3 py-1.5 rounded-lg hover:opacity-80"
            style={{
              backgroundColor: 'var(--bg-card-hover)',
              color: 'var(--text-muted)',
            }}
          >
            취소
          </button>
        )}
      </div>
    </article>
  )
}
