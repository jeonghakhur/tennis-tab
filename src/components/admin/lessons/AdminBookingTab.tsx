'use client'

import { useState, useEffect, useCallback } from 'react'
import { ClipboardList, Check, X, MessageSquare, User } from 'lucide-react'
import { getBookings, confirmBooking, cancelBooking, updateBookingNote } from '@/lib/lessons/slot-actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, ConfirmDialog } from '@/components/common/AlertDialog'
import type { LessonBooking, LessonBookingStatus } from '@/lib/lessons/slot-types'
import { BOOKING_STATUS_LABEL, BOOKING_TYPE_LABEL } from '@/lib/lessons/slot-types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LessonBookingStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '대기', variant: 'warning' },
  CONFIRMED: { label: '확정', variant: 'success' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

type StatusFilter = 'ALL' | LessonBookingStatus
type GuestFilter = 'ALL' | 'MEMBER' | 'GUEST'

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export function AdminBookingTab() {
  const [bookings, setBookings] = useState<LessonBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [guestFilter, setGuestFilter] = useState<GuestFilter>('ALL')

  // 모달
  const [cancelTarget, setCancelTarget] = useState<LessonBooking | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [noteTarget, setNoteTarget] = useState<LessonBooking | null>(null)
  const [noteText, setNoteText] = useState('')

  // 피드백
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const filters: { status?: LessonBookingStatus; isGuest?: boolean } = {}
    if (statusFilter !== 'ALL') filters.status = statusFilter
    if (guestFilter === 'GUEST') filters.isGuest = true
    if (guestFilter === 'MEMBER') filters.isGuest = false

    const { data } = await getBookings(filters)
    setBookings(data)
    setLoading(false)
  }, [statusFilter, guestFilter])

  useEffect(() => { loadBookings() }, [loadBookings])

  // 수락
  const handleConfirm = async (booking: LessonBooking) => {
    const result = await confirmBooking(booking.id)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      return
    }
    setToast({ isOpen: true, message: '예약이 확정되었습니다.', type: 'success' })
    loadBookings()
  }

  // 거절
  const handleCancel = async () => {
    if (!cancelTarget) return
    const result = await cancelBooking(cancelTarget.id, cancelReason)
    setCancelTarget(null)
    setCancelReason('')
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      return
    }
    setToast({ isOpen: true, message: '예약이 거절되었습니다. 슬롯이 복구되었습니다.', type: 'success' })
    loadBookings()
  }

  // 메모 저장
  const handleSaveNote = async () => {
    if (!noteTarget) return
    const result = await updateBookingNote(noteTarget.id, noteText)
    setNoteTarget(null)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      return
    }
    setToast({ isOpen: true, message: '메모가 저장되었습니다.', type: 'success' })
    loadBookings()
  }

  const pendingCount = bookings.filter((b) => b.status === 'PENDING').length

  return (
    <div>
      {/* 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        {/* 상태 필터 */}
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          {(['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED'] as StatusFilter[]).map((s) => {
            const label = s === 'ALL' ? '전체' : BOOKING_STATUS_LABEL[s]
            const isActive = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {label}
                {s === 'PENDING' && pendingCount > 0 && (
                  <span className="ml-1 px-1 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: 'var(--color-warning)', color: '#fff' }}>
                    {pendingCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* 회원/비회원 필터 */}
        <div className="flex gap-1 p-0.5 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          {(['ALL', 'MEMBER', 'GUEST'] as GuestFilter[]).map((g) => {
            const label = g === 'ALL' ? '전체' : g === 'MEMBER' ? '회원' : '비회원'
            const isActive = guestFilter === g
            return (
              <button
                key={g}
                onClick={() => setGuestFilter(g)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 예약 목록 */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          ))}
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>예약이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {bookings.map((booking) => (
            <BookingCard
              key={booking.id}
              booking={booking}
              onConfirm={() => handleConfirm(booking)}
              onCancel={() => { setCancelTarget(booking); setCancelReason('') }}
              onNote={() => { setNoteTarget(booking); setNoteText(booking.admin_note || '') }}
            />
          ))}
        </div>
      )}

      {/* 거절 사유 모달 */}
      <Modal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        title="예약 거절"
        size="sm"
      >
        <Modal.Body>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            예약을 거절하면 슬롯이 다시 공개됩니다.
          </p>
          <label htmlFor="cancel-reason" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            거절 사유 (선택)
          </label>
          <textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            rows={3}
            maxLength={200}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          />
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setCancelTarget(null)}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            취소
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--color-danger)' }}
          >
            거절
          </button>
        </Modal.Footer>
      </Modal>

      {/* 메모 모달 */}
      <Modal
        isOpen={!!noteTarget}
        onClose={() => setNoteTarget(null)}
        title="관리자 메모"
        size="sm"
      >
        <Modal.Body>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full px-3 py-2 rounded-lg text-sm resize-none"
            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            aria-label="관리자 메모"
          />
        </Modal.Body>
        <Modal.Footer>
          <button
            onClick={() => setNoteTarget(null)}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            취소
          </button>
          <button
            onClick={handleSaveNote}
            className="flex-1 btn-primary"
          >
            저장
          </button>
        </Modal.Footer>
      </Modal>

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
    </div>
  )
}

// ─── BookingCard 컴포넌트 ───────────────────────────────────────────────────

interface BookingCardProps {
  booking: LessonBooking
  onConfirm: () => void
  onCancel: () => void
  onNote: () => void
}

function BookingCard({ booking, onConfirm, onCancel, onNote }: BookingCardProps) {
  const conf = STATUS_CONFIG[booking.status]
  const name = booking.is_guest ? booking.guest_name : booking.member?.name
  const typeLabel = BOOKING_TYPE_LABEL[booking.booking_type]

  const formatSlotTime = (slot: { slot_date: string; start_time: string; end_time: string }) => {
    const d = new Date(slot.slot_date + 'T00:00:00')
    const dayLabel = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
    return `${slot.slot_date} (${dayLabel}) ${slot.start_time.slice(0, 5)}~${slot.end_time.slice(0, 5)}`
  }

  const createdAt = new Date(booking.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      className="rounded-lg p-4"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-card-hover)' }}
          >
            <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name || '이름 없음'}</span>
              {booking.is_guest && <Badge variant="orange">비회원</Badge>}
              <Badge variant={conf.variant}>{conf.label}</Badge>
            </div>
            {booking.is_guest && booking.guest_phone && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{booking.guest_phone}</p>
            )}
          </div>
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{createdAt}</span>
      </div>

      {/* 슬롯 정보 */}
      <div className="mb-2 pl-10">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="info">{typeLabel}</Badge>
          {booking.fee_amount !== null && (
            <span className="text-xs font-medium" style={{ color: 'var(--accent-color)' }}>
              {booking.fee_amount.toLocaleString()}원/월
            </span>
          )}
        </div>
        {booking.slots?.map((slot) => (
          <p key={slot.id} className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {formatSlotTime(slot)}
          </p>
        ))}
      </div>

      {/* 메모 */}
      {booking.admin_note && (
        <div className="mb-2 pl-10">
          <p className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
            메모: {booking.admin_note}
          </p>
        </div>
      )}

      {/* 거절 사유 */}
      {booking.cancel_reason && (
        <div className="mb-2 pl-10">
          <p className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--color-danger-subtle, #fee2e2)', color: 'var(--color-danger)' }}>
            거절 사유: {booking.cancel_reason}
          </p>
        </div>
      )}

      {/* 액션 */}
      <div className="flex gap-2 pl-10">
        {booking.status === 'PENDING' && (
          <>
            <button
              onClick={onConfirm}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--color-success)' }}
            >
              <Check className="w-3 h-3" />
              수락
            </button>
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--color-danger)' }}
            >
              <X className="w-3 h-3" />
              거절
            </button>
          </>
        )}
        <button
          onClick={onNote}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
        >
          <MessageSquare className="w-3 h-3" />
          메모
        </button>
      </div>
    </div>
  )
}
