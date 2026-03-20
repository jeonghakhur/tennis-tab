'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, User, Loader2, BookOpen, Calendar, X, RotateCcw, MessageSquare, Clock,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getMyBookings, cancelMyBooking, getMyInquiries, type MyBookingDetail } from '@/lib/lessons/slot-actions'
import type { LessonInquiry, LessonInquiryStatus } from '@/lib/lessons/types'
import { requestLessonExtension, getMyPendingExtensionBookingIds } from '@/lib/lessons/extension-actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { ConfirmDialog, Toast } from '@/components/common/AlertDialog'
import { Modal } from '@/components/common/Modal'
import {
  BOOKING_TYPE_LABEL,
  type LessonBookingStatus,
  type SlotSession,
} from '@/lib/lessons/slot-types'

// ── 상태 config ───────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<LessonBookingStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:   { label: '대기중', variant: 'warning' },
  CONFIRMED: { label: '확정',   variant: 'success' },
  CANCELLED: { label: '취소',   variant: 'danger'  },
}

const WEEKDAY_LABEL = ['일', '월', '화', '수', '목', '금', '토']

function fmt(time: string): string { return time.slice(0, 5) }

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function fmtDateWithDay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_LABEL[d.getDay()]})`
}

/** 요일별 시간 요약: "월 07:00~07:20 · 화 07:00~07:20" */
function buildScheduleSummary(sessions: SlotSession[]): string {
  const active = sessions.filter((s) => s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED')
  const dayMap = new Map<number, string>()
  for (const s of active) {
    const dow = new Date(s.slot_date + 'T00:00:00').getDay()
    if (!dayMap.has(dow)) {
      dayMap.set(dow, `${fmt(s.start_time)}~${fmt(s.end_time)}`)
    }
  }
  return [...dayMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dow, time]) => `${WEEKDAY_LABEL[dow]} ${time}`)
    .join(' · ')
}

/** 세션 통계 계산 */
function calcSessionStats(sessions: SlotSession[]) {
  const today = new Date().toISOString().substring(0, 10)
  let completed = 0
  let rescheduled = 0
  let remaining = 0

  for (const s of sessions) {
    if (s.status === 'CANCELLED') continue
    if (s.status === 'RESCHEDULED') { rescheduled++; continue }
    if (s.status === 'COMPLETED' || ((!s.status || s.status === 'SCHEDULED') && s.slot_date < today)) {
      completed++
    } else {
      remaining++
    }
  }
  return { completed, rescheduled, remaining, total: completed + rescheduled + remaining }
}

/** 진행 현황 텍스트 생성 */
function buildProgressText(sessions: SlotSession[]): string {
  const { total, completed, rescheduled, remaining } = calcSessionStats(sessions)
  const parts: string[] = []

  parts.push(`${total}회 패키지`)
  if (completed > 0)    parts.push(`${completed}회 완료`)
  if (remaining > 0)    parts.push(`${remaining}회 예정`)
  if (rescheduled > 0)  parts.push(`${rescheduled}회 일정변경`)

  return parts.join(' · ')
}

// ── 세션 칩 ───────────────────────────────────────────────────────────────────

function SessionChip({ date, status }: { date: string; status: string }) {
  const today = new Date().toISOString().substring(0, 10)
  const isPastScheduled = (!status || status === 'SCHEDULED') && date < today

  if (status === 'CANCELLED') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium line-through"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
        {fmtDate(date)}
      </span>
    )
  }
  if (status === 'RESCHEDULED') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium line-through"
        style={{ backgroundColor: 'var(--color-warning-subtle)', color: 'var(--color-warning)' }}>
        {fmtDate(date)}
      </span>
    )
  }
  if (status === 'COMPLETED' || isPastScheduled) {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium"
        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
        {fmtDate(date)}
      </span>
    )
  }
  // 미래 SCHEDULED → 초록
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-sm font-medium"
      style={{ backgroundColor: 'var(--color-success-subtle)', color: 'var(--color-success)' }}>
      {fmtDate(date)}
    </span>
  )
}

// ── 연장 신청 모달 ────────────────────────────────────────────────────────────

function ExtensionRequestModal({
  isOpen,
  bookingId,
  slotId,
  scheduleSummary,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  bookingId: string
  slotId: string
  scheduleSummary: string
  onClose: () => void
  onSuccess: (isInquiry: boolean) => void
}) {
  const [wantsChange, setWantsChange] = useState(false)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 모달 닫힐 때 상태 초기화
  const handleClose = () => {
    setWantsChange(false)
    setMessage('')
    setError(null)
    onClose()
  }

  const handleSubmit = async () => {
    if (wantsChange && !message.trim()) {
      setError('코치에게 전할 내용을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    // 일정 변경 문의든 단순 연장이든 동일한 extension request로 처리
    // 코치가 message 확인 후 조율
    const result = await requestLessonExtension({
      bookingId,
      slotId,
      message: message.trim(),
    })
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onSuccess(wantsChange)
    handleClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="레슨 연장" size="md">
      <Modal.Body>
        <div className="space-y-4">
          {/* 현재 일정 */}
          <div className="rounded-lg px-4 py-3 space-y-1"
            style={{ backgroundColor: 'var(--color-success-subtle)', border: '1px solid var(--color-success)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-success)' }}>
              현재 레슨 일정으로 그대로 연장됩니다
            </p>
            {scheduleSummary && (
              <p className="text-sm" style={{ color: 'var(--color-success)' }}>{scheduleSummary}</p>
            )}
          </div>

          {/* 일정 변경 스위치 */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              일정 변경이 필요해요
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={wantsChange}
              onClick={() => { setWantsChange((v) => !v); setError(null) }}
              className="relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus-visible:outline-none"
              style={{ backgroundColor: wantsChange ? 'var(--accent-color)' : 'var(--border-color)' }}
            >
              <span
                className="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 mt-0.5"
                style={{ transform: wantsChange ? 'translateX(22px)' : 'translateX(2px)' }}
              />
            </button>
          </div>

          {/* 메시지 (스위치 ON 시만 표시) */}
          {wantsChange && (
            <div>
              <label htmlFor="ext-message" className="block text-sm font-medium mb-2"
                style={{ color: 'var(--text-primary)' }}>
                코치에게 전할 내용 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <textarea
                id="ext-message"
                value={message}
                onChange={(e) => { setMessage(e.target.value); setError(null) }}
                rows={3}
                maxLength={200}
                placeholder="희망 요일, 시간 등 변경 내용을 입력해주세요."
                className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: `1px solid ${error ? 'var(--color-danger)' : 'var(--border-color)'}`,
                }}
              />
              <p className="text-right text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {message.length}/200
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
        >
          {submitting ? '처리 중...' : wantsChange ? '연장 문의' : '연장 신청'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

// ── 문의 상태 config ──────────────────────────────────────────────────────────

const INQUIRY_STATUS_CONFIG: Record<LessonInquiryStatus, { label: string; variant: BadgeVariant; desc: string }> = {
  PENDING:   { label: '접수 완료', variant: 'warning', desc: '코치가 확인 후 연락드립니다.' },
  RESPONDED: { label: '응대 완료', variant: 'success', desc: '코치가 연락했습니다. 일정을 조율해보세요.' },
  CLOSED:    { label: '종료',    variant: 'secondary', desc: '문의가 종료되었습니다.' },
}

// ── 문의 카드 ────────────────────────────────────────────────────────────────

function InquiryCard({ inquiry }: { inquiry: LessonInquiry }) {
  const conf = INQUIRY_STATUS_CONFIG[inquiry.status]
  const coachName = inquiry.coach?.name || null

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
      {/* 헤더 */}
      <div className="px-4 py-4" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'var(--bg-card-hover)' }}>
              <MessageSquare className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                레슨 신청 문의
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {coachName ? `코치 ${coachName}` : '코치 미정'}
              </p>
            </div>
          </div>
          <Badge variant={conf.variant}>{conf.label}</Badge>
        </div>
      </div>

      {/* 문의 내용 */}
      <div className="px-4 py-3 space-y-2"
        style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
        {/* 상태 안내 */}
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{conf.desc}</p>

        {/* 희망 일정 */}
        {inquiry.preferred_days && inquiry.preferred_days.length > 0 && (
          <div className="flex flex-wrap gap-3 text-sm px-3 py-2.5 rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Calendar className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              {inquiry.preferred_days.join('·')}요일
            </span>
            {inquiry.preferred_time && (
              <span className="flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Clock className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
                {inquiry.preferred_time}
              </span>
            )}
          </div>
        )}

        {/* 접수일 */}
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          접수일 {new Date(inquiry.created_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })}
        </p>
      </div>
    </div>
  )
}

// ── 예약 카드 ────────────────────────────────────────────────────────────────

function BookingCard({
  detail,
  extensionPending,
  onCancel,
  onExtensionRequest,
}: {
  detail: MyBookingDetail
  extensionPending: boolean
  onCancel: (bookingId: string) => void
  onExtensionRequest: (bookingId: string, slotId: string, scheduleSummary: string) => void
}) {
  const { booking, slots } = detail
  const slot = slots[0]

  const coach = slot?.coach || slot?.program?.coach || null
  const programTitle = slot?.program?.title || '레슨 프로그램'

  // CONFIRMED만 취소 불가 — PENDING만 가능
  const canCancel = booking.status === 'PENDING'
  // 연장 신청: CONFIRMED + 패키지 슬롯 + 처리 중인 신청 없음 + 미연장
  const canExtend = booking.status === 'CONFIRMED' && !!slot?.sessions?.length && !extensionPending && !slot.extended_at

  const sessions = slot?.sessions ?? null

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
      {/* 헤더 */}
      <div className="px-4 py-4" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {coach?.profile_image_url ? (
              <img src={coach.profile_image_url} alt={coach.name}
                className="w-10 h-10 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                <User className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {programTitle}
              </p>
              <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                코치 {coach?.name || '-'}
              </p>
            </div>
          </div>
          <Badge variant={STATUS_CONFIG[booking.status].variant}>
            {STATUS_CONFIG[booking.status].label}
          </Badge>
        </div>
      </div>

      {/* 예약 정보 */}
      <div className="px-4 py-3 space-y-3"
        style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
        {/* 예약 유형 + 요금 */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium px-2 py-1 rounded"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            {BOOKING_TYPE_LABEL[booking.booking_type]}
          </span>
          {booking.fee_amount != null && (
            <span className="text-sm font-semibold" style={{ color: 'var(--accent-color)' }}>
              {booking.fee_amount.toLocaleString()}원
            </span>
          )}
        </div>

        {/* 패키지 세션 일정 */}
        {sessions && sessions.length > 0 ? (
          <div className="space-y-2">
            {/* 요일 시간 요약 */}
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {buildScheduleSummary(sessions)}
            </p>

            {/* 진행 현황 */}
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              {buildProgressText(sessions)}
            </p>

            {/* 날짜 칩 */}
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {sessions.map((s) => (
                <SessionChip key={s.slot_date} date={s.slot_date} status={s.status ?? 'SCHEDULED'} />
              ))}
            </div>
          </div>
        ) : (
          /* 레거시 단일 슬롯 */
          <div className="space-y-2">
            {slots.map((s) => (
              <div key={s.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                <Calendar className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-color)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {fmtDateWithDay(s.slot_date)}
                </span>
                <span className="text-sm ml-1" style={{ color: 'var(--text-secondary)' }}>
                  {fmt(s.start_time)} ~ {fmt(s.end_time)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 버튼 영역 */}
        <div className="flex gap-2 pt-1">
          {/* 연장 신청 버튼 */}
          {canExtend && (
            <button
              type="button"
              onClick={() => onExtensionRequest(booking.id, slot!.id, sessions ? buildScheduleSummary(sessions) : '')}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2.5 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--color-success-subtle)',
                color: 'var(--color-success)',
                border: '1px solid var(--color-success)',
              }}
            >
              <RotateCcw className="w-4 h-4" />
              연장 신청
            </button>
          )}

          {/* 취소 버튼: PENDING만 */}
          {canCancel && (
            <button
              type="button"
              onClick={() => onCancel(booking.id)}
              className="flex-1 flex items-center justify-center gap-1.5 text-sm py-2.5 rounded-lg transition-colors"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--color-danger)',
                border: '1px solid var(--border-color)',
              }}
            >
              <X className="w-4 h-4" />
              예약 취소
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────

export default function MyLessonsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [details, setDetails] = useState<MyBookingDetail[]>([])
  const [inquiries, setInquiries] = useState<LessonInquiry[]>([])
  const [pendingExtBookingIds, setPendingExtBookingIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; bookingId: string }>({
    isOpen: false, bookingId: '',
  })
  const [cancelling, setCancelling] = useState(false)

  const [extensionModal, setExtensionModal] = useState<{
    isOpen: boolean; bookingId: string; slotId: string; scheduleSummary: string
  }>({ isOpen: false, bookingId: '', slotId: '', scheduleSummary: '' })

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/auth/login'); return }
    loadData()
  }, [authLoading, user])

  // 탭 복귀 시 연장 신청 상태 조용히 갱신 (관리자 거절 후 버튼 자동 복원)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) {
        getMyPendingExtensionBookingIds().then((ids) =>
          setPendingExtBookingIds(new Set(ids))
        )
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [user])

  const loadData = async () => {
    setLoading(true)
    const [bookingResult, inquiryResult, pendingIds] = await Promise.all([
      getMyBookings(),
      getMyInquiries(),
      getMyPendingExtensionBookingIds(),
    ])
    if (!bookingResult.error) setDetails(bookingResult.data)
    if (!inquiryResult.error) setInquiries(inquiryResult.data)
    setPendingExtBookingIds(new Set(pendingIds))
    setLoading(false)
  }

  const handleCancelConfirm = async () => {
    setCancelling(true)
    const result = await cancelMyBooking(confirmDialog.bookingId)
    setCancelling(false)
    setConfirmDialog({ isOpen: false, bookingId: '' })
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
    } else {
      setToast({ isOpen: true, message: '예약이 취소되었습니다.', type: 'success' })
      loadData()
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-color)' }} />
      </div>
    )
  }

  const activeBookings   = details.filter((d) => d.booking.status !== 'CANCELLED')
  const cancelledBookings = details.filter((d) => d.booking.status === 'CANCELLED')

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button type="button" onClick={() => router.back()}
            className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }}
            aria-label="뒤로 가기">
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
            나의 레슨
          </h1>
        </div>

        {details.length === 0 && inquiries.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>신청한 레슨이 없어요.</p>
            <button type="button" onClick={() => router.push('/lessons')} className="mt-4 btn-primary btn-sm">
              레슨 문의하기
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {activeBookings.map((detail) => (
              <BookingCard
                key={detail.booking.id}
                detail={detail}
                extensionPending={pendingExtBookingIds.has(detail.booking.id)}
                onCancel={(id) => setConfirmDialog({ isOpen: true, bookingId: id })}
                onExtensionRequest={(bookingId, slotId, scheduleSummary) =>
                  setExtensionModal({ isOpen: true, bookingId, slotId, scheduleSummary })
                }
              />
            ))}

            {/* 레슨 신청 문의 */}
            {inquiries.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wide mb-3"
                  style={{ color: 'var(--text-muted)' }}>
                  레슨 신청 현황
                </h2>
                <div className="space-y-4">
                  {inquiries.map((inquiry) => (
                    <InquiryCard key={inquiry.id} inquiry={inquiry} />
                  ))}
                </div>
              </section>
            )}

            {cancelledBookings.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wide mb-3 mt-8"
                  style={{ color: 'var(--text-muted)' }}>
                  취소된 예약
                </h2>
                <div className="space-y-4 opacity-60">
                  {cancelledBookings.map((detail) => (
                    <BookingCard
                      key={detail.booking.id}
                      detail={detail}
                      extensionPending={false}
                      onCancel={(id) => setConfirmDialog({ isOpen: true, bookingId: id })}
                      onExtensionRequest={(bookingId, slotId, scheduleSummary) =>
                        setExtensionModal({ isOpen: true, bookingId, slotId, scheduleSummary })
                      }
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* 예약 취소 확인 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, bookingId: '' })}
        onConfirm={handleCancelConfirm}
        title="예약 취소"
        message="예약을 취소하시겠습니까? 취소 후 슬롯이 다시 열립니다."
        type="warning"
        confirmText={cancelling ? '처리 중...' : '취소하기'}
        cancelText="돌아가기"
      />

      {/* 연장 신청 모달 */}
      <ExtensionRequestModal
        isOpen={extensionModal.isOpen}
        bookingId={extensionModal.bookingId}
        slotId={extensionModal.slotId}
        scheduleSummary={extensionModal.scheduleSummary}
        onClose={() => setExtensionModal({ isOpen: false, bookingId: '', slotId: '', scheduleSummary: '' })}
        onSuccess={(isInquiry) => {
          setToast({
            isOpen: true,
            message: isInquiry
              ? '연장 문의가 접수되었습니다. 코치가 확인 후 연락드립니다.'
              : '연장 신청이 완료되었습니다. 코치에게 알림톡이 발송되었습니다.',
            type: 'success',
          })
          // 연장 신청 후 버튼만 조용히 갱신 (전체 로딩 스피너 없이)
          getMyPendingExtensionBookingIds().then((ids) =>
            setPendingExtBookingIds(new Set(ids))
          )
        }}
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
