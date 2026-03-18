'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, User, Loader2, BookOpen, Calendar, X, RotateCcw,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getMyBookings, cancelMyBooking, type MyBookingDetail } from '@/lib/lessons/slot-actions'
import { requestLessonExtension } from '@/lib/lessons/extension-actions'
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
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  bookingId: string
  slotId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [weeks, setWeeks] = useState(4)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    const result = await requestLessonExtension({ bookingId, slotId, requestedWeeks: weeks, message })
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onSuccess()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="레슨 연장 신청" size="md">
      <Modal.Body>
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            연장 신청 시 코치에게 카카오 알림톡이 발송됩니다.
          </p>

          {/* 연장 주수 */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              연장 희망 기간
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[2, 4, 6, 8].map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeeks(w)}
                  className="py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: weeks === w ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: weeks === w ? '#fff' : 'var(--text-secondary)',
                    border: weeks === w ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  {w}주
                </button>
              ))}
            </div>
          </div>

          {/* 메시지 */}
          <div>
            <label htmlFor="ext-message" className="block text-sm font-medium mb-2"
              style={{ color: 'var(--text-primary)' }}>
              코치에게 전할 메시지 <span style={{ color: 'var(--text-muted)' }}>(선택)</span>
            </label>
            <textarea
              id="ext-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="연장 이유나 요청사항을 자유롭게 입력해주세요."
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
            />
            <p className="text-right text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {message.length}/200
            </p>
          </div>

          {error && (
            <p className="text-sm" style={{ color: 'var(--color-danger)' }}>{error}</p>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
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
          {submitting ? '신청 중...' : `${weeks}주 연장 신청`}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

// ── 예약 카드 ────────────────────────────────────────────────────────────────

function BookingCard({
  detail,
  onCancel,
  onExtensionRequest,
}: {
  detail: MyBookingDetail
  onCancel: (bookingId: string) => void
  onExtensionRequest: (bookingId: string, slotId: string) => void
}) {
  const { booking, slots } = detail
  const slot = slots[0]

  const coach = slot?.coach || slot?.program?.coach || null
  const programTitle = slot?.program?.title || '레슨 프로그램'

  // CONFIRMED만 취소 불가 — PENDING만 가능
  const canCancel = booking.status === 'PENDING'
  // 연장 신청: CONFIRMED + 패키지 슬롯
  const canExtend = booking.status === 'CONFIRMED' && !!slot?.sessions?.length

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
              onClick={() => onExtensionRequest(booking.id, slot!.id)}
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
  const [loading, setLoading] = useState(true)

  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; bookingId: string }>({
    isOpen: false, bookingId: '',
  })
  const [cancelling, setCancelling] = useState(false)

  const [extensionModal, setExtensionModal] = useState<{
    isOpen: boolean; bookingId: string; slotId: string
  }>({ isOpen: false, bookingId: '', slotId: '' })

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/auth/login'); return }
    loadData()
  }, [authLoading, user])

  const loadData = async () => {
    setLoading(true)
    const result = await getMyBookings()
    if (!result.error) setDetails(result.data)
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

        {details.length === 0 ? (
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
                onCancel={(id) => setConfirmDialog({ isOpen: true, bookingId: id })}
                onExtensionRequest={(bookingId, slotId) =>
                  setExtensionModal({ isOpen: true, bookingId, slotId })
                }
              />
            ))}

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
                      onCancel={(id) => setConfirmDialog({ isOpen: true, bookingId: id })}
                      onExtensionRequest={(bookingId, slotId) =>
                        setExtensionModal({ isOpen: true, bookingId, slotId })
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
        onClose={() => setExtensionModal({ isOpen: false, bookingId: '', slotId: '' })}
        onSuccess={() => setToast({ isOpen: true, message: '연장 신청이 완료되었습니다. 코치에게 알림톡이 발송되었습니다.', type: 'success' })}
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
