'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { AlertDialog } from '@/components/common/AlertDialog'
import { Toast } from '@/components/common/Toast'
import {
  getInquiryForAdmin,
  replyInquiry,
  updateInquiryStatus,
} from '@/lib/support/actions'
import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
  type Inquiry,
  type InquiryStatus,
} from '@/lib/support/types'
import { hasMinimumRole } from '@/lib/auth/roles'
import type { UserRole } from '@/lib/supabase/types'
import { ChevronLeft, MessageCircle } from 'lucide-react'

const STATUS_VARIANT: Record<InquiryStatus, BadgeVariant> = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
}

export default function AdminInquiryDetailPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()

  const [inquiry, setInquiry] = useState<Inquiry | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyContent, setReplyContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  // 권한 체크
  useEffect(() => {
    if (authLoading) return
    if (!profile || !hasMinimumRole(profile.role as UserRole, 'ADMIN')) {
      router.replace('/admin')
    }
  }, [profile, authLoading, router])

  // 데이터 로드
  useEffect(() => {
    if (authLoading || !profile) return

    async function load() {
      const result = await getInquiryForAdmin(id)
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
      } else if (result.data) {
        setInquiry(result.data)
        // 기존 답변이 있으면 수정 모드로 세팅
        if (result.data.reply_content) {
          setReplyContent(result.data.reply_content)
        }
      }
      setLoading(false)
    }
    load()
  }, [id, authLoading, profile])

  // 답변 등록/수정
  const handleReply = async () => {
    if (!replyContent.trim()) {
      setAlert({ isOpen: true, message: '답변 내용을 입력해주세요.', type: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const result = await replyInquiry({
        inquiry_id: id,
        reply_content: replyContent,
      })
      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        return
      }
      setToast({ isOpen: true, message: '답변이 등록되었습니다.', type: 'success' })
      // 다시 로드
      const updated = await getInquiryForAdmin(id)
      if (updated.data) setInquiry(updated.data)
    } finally {
      setSubmitting(false)
    }
  }

  // 상태 변경
  const handleStatusChange = async (newStatus: InquiryStatus) => {
    const result = await updateInquiryStatus(id, newStatus)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setToast({ isOpen: true, message: '상태가 변경되었습니다.', type: 'success' })
    // 다시 로드
    const updated = await getInquiryForAdmin(id)
    if (updated.data) setInquiry(updated.data)
  }

  return (
    <div className="space-y-6">
      {/* 뒤로가기 + 헤더 */}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/inquiries"
          className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">
            문의 상세
          </h1>
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-xl p-6 animate-pulse space-y-4">
          <div className="h-6 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-24 w-full rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        </div>
      ) : inquiry ? (
        <>
          {/* 문의 내용 */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">
                  {INQUIRY_CATEGORY_LABELS[inquiry.category]}
                </Badge>
                <Badge variant={STATUS_VARIANT[inquiry.status]}>
                  {INQUIRY_STATUS_LABELS[inquiry.status]}
                </Badge>
              </div>

              {/* 상태 변경 select */}
              <div className="flex items-center gap-2">
                <label htmlFor="status-select" className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  상태:
                </label>
                <select
                  id="status-select"
                  value={inquiry.status}
                  onChange={(e) => handleStatusChange(e.target.value as InquiryStatus)}
                  className="px-3 py-1.5 rounded-lg text-sm bg-(--bg-input) border border-(--border-color) outline-none"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {(Object.entries(INQUIRY_STATUS_LABELS) as [InquiryStatus, string][]).map(
                    ([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>

            <h2
              className="text-xl font-display mb-2"
              style={{ color: 'var(--text-primary)' }}
            >
              {inquiry.title}
            </h2>

            {/* 작성자 정보 */}
            <div className="flex items-center gap-3 mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
              {inquiry.author && (
                <span>{inquiry.author.name} ({inquiry.author.email})</span>
              )}
              <span>
                {new Date(inquiry.created_at).toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            <div
              className="whitespace-pre-wrap text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              {inquiry.content}
            </div>
          </div>

          {/* 답변 영역 */}
          <div className="glass-card rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle
                className="w-5 h-5"
                style={{ color: 'var(--accent-color)' }}
              />
              <h2
                className="font-display text-lg"
                style={{ color: 'var(--text-primary)' }}
              >
                {inquiry.reply_content ? '답변 수정' : '답변 작성'}
              </h2>
            </div>

            {/* 기존 답변 정보 */}
            {inquiry.reply_content && inquiry.replier && (
              <div
                className="text-xs mb-3 flex items-center gap-2"
                style={{ color: 'var(--text-muted)' }}
              >
                <span>답변자: {inquiry.replier.name}</span>
                {inquiry.replied_at && (
                  <span>
                    {new Date(inquiry.replied_at).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </span>
                )}
              </div>
            )}

            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              rows={6}
              placeholder="답변 내용을 입력하세요..."
              aria-label="답변 내용"
              className="w-full px-3 py-2.5 rounded-lg bg-(--bg-input) border border-(--border-color) focus:border-(--accent-color) outline-none resize-none mb-4"
              style={{ color: 'var(--text-primary)' }}
            />

            <button
              onClick={handleReply}
              disabled={submitting || !replyContent.trim()}
              className="px-6 py-2.5 rounded-lg font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--accent-color)' }}
            >
              {submitting
                ? '등록 중...'
                : inquiry.reply_content
                  ? '답변 수정'
                  : '답변 등록'
              }
            </button>
          </div>
        </>
      ) : null}

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </div>
  )
}
