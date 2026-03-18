'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ClipboardList, Check, X, MessageSquare, User } from 'lucide-react'
import { getBookings, confirmBooking, cancelBooking, updateBookingNote } from '@/lib/lessons/slot-actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast } from '@/components/common/AlertDialog'
import type { LessonBooking, LessonBookingStatus, LessonSlot } from '@/lib/lessons/slot-types'
import { BOOKING_STATUS_LABEL, BOOKING_TYPE_LABEL } from '@/lib/lessons/slot-types'
import type { LessonProgram } from '@/lib/lessons/types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LessonBookingStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:   { label: '대기', variant: 'warning' },
  CONFIRMED: { label: '확정', variant: 'success' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

type StatusFilter = 'ALL' | LessonBookingStatus

// ─── Props ───────────────────────────────────────────────────────────────────

interface AdminBookingTabProps {
  programs: LessonProgram[]
  programsLoading: boolean
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export function AdminBookingTab({ programs }: AdminBookingTabProps) {
  const [bookings, setBookings]           = useState<LessonBooking[]>([])
  const [loading, setLoading]             = useState(true)
  const [selectedCoachId, setSelectedCoachId] = useState<string>('ALL')
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('ALL')

  // 모달
  const [cancelTarget, setCancelTarget]   = useState<LessonBooking | null>(null)
  const [cancelReason, setCancelReason]   = useState('')
  const [noteTarget, setNoteTarget]       = useState<LessonBooking | null>(null)
  const [noteText, setNoteText]           = useState('')

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  // programs prop → coachId:name 맵
  const coachMap = useMemo(() => {
    const map = new Map<string, string>()
    programs.forEach((p) => {
      if (p.coach_id && p.coach?.name) map.set(p.coach_id, p.coach.name)
    })
    return map
  }, [programs])

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const { data } = await getBookings()
    setBookings(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadBookings() }, [loadBookings])

  // 예약에 등장하는 코치 탭 목록 (예약 데이터 기반으로 동적 생성)
  const coachTabs = useMemo(() => {
    const seen = new Map<string, string>()
    bookings.forEach((b) => {
      const coachId = b.slots?.[0]?.coach_id
      if (coachId && !seen.has(coachId)) {
        seen.set(coachId, coachMap.get(coachId) ?? '알 수 없음')
      }
    })
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }))
  }, [bookings, coachMap])

  // 클라이언트 사이드 필터링
  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (selectedCoachId !== 'ALL' && b.slots?.[0]?.coach_id !== selectedCoachId) return false
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false
      return true
    })
  }, [bookings, selectedCoachId, statusFilter])

  // 탭별 대기 건수
  const allPendingCount = bookings.filter((b) => b.status === 'PENDING').length
  const coachPendingCount = (coachId: string) =>
    bookings.filter((b) => b.status === 'PENDING' && b.slots?.[0]?.coach_id === coachId).length
  const filteredPendingCount = filtered.filter((b) => b.status === 'PENDING').length

  // ── 액션 핸들러 ────────────────────────────────────────────────────────────

  const handleConfirm = async (booking: LessonBooking) => {
    setBookings((prev) => prev.map((b) => b.id === booking.id ? { ...b, status: 'CONFIRMED' as const } : b))
    const result = await confirmBooking(booking.id)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      await loadBookings()
      return
    }
    setToast({ isOpen: true, message: '예약이 확정되었습니다.', type: 'success' })
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    const targetId = cancelTarget.id
    const reason   = cancelReason
    setCancelTarget(null)
    setCancelReason('')
    setBookings((prev) =>
      prev.map((b) => b.id === targetId ? { ...b, status: 'CANCELLED' as const, cancel_reason: reason } : b)
    )
    const result = await cancelBooking(targetId, reason)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      await loadBookings()
      return
    }
    setToast({ isOpen: true, message: '예약이 거절되었습니다. 슬롯이 복구되었습니다.', type: 'success' })
  }

  const handleSaveNote = async () => {
    if (!noteTarget) return
    const targetId = noteTarget.id
    const note     = noteText
    setNoteTarget(null)
    setBookings((prev) => prev.map((b) => b.id === targetId ? { ...b, admin_note: note } : b))
    const result = await updateBookingNote(targetId, note)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      await loadBookings()
      return
    }
    setToast({ isOpen: true, message: '메모가 저장되었습니다.', type: 'success' })
  }

  // ── 렌더 ───────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* 코치 탭 */}
      {coachTabs.length > 0 && (
        <div
          className="flex gap-1 mb-4 border-b"
          style={{ borderColor: 'var(--border-color)' }}
          role="tablist"
          aria-label="코치별 예약"
        >
          <TabButton
            label="전체"
            isActive={selectedCoachId === 'ALL'}
            badgeCount={allPendingCount}
            onClick={() => setSelectedCoachId('ALL')}
          />
          {coachTabs.map(({ id, name }) => (
            <TabButton
              key={id}
              label={name}
              isActive={selectedCoachId === id}
              badgeCount={coachPendingCount(id)}
              onClick={() => setSelectedCoachId(id)}
            />
          ))}
        </div>
      )}

      {/* 상태 필터 */}
      <div
        className="flex gap-1 mb-4 p-0.5 rounded-lg w-fit"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {(['ALL', 'PENDING', 'CONFIRMED', 'CANCELLED'] as StatusFilter[]).map((s) => {
          const isActive = statusFilter === s
          const label = s === 'ALL' ? '전체' : BOOKING_STATUS_LABEL[s]
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              }}
            >
              {label}
              {s === 'PENDING' && filteredPendingCount > 0 && (
                <span
                  className="ml-1 px-1 py-0.5 rounded text-xs font-bold text-white"
                  style={{ backgroundColor: 'var(--color-warning)' }}
                >
                  {filteredPendingCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* 예약 목록 */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardList className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>예약이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((booking) => (
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
      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title="예약 거절" size="sm">
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
          <button onClick={() => setCancelTarget(null)} className="flex-1 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            취소
          </button>
          <button onClick={handleCancel} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--color-danger)' }}>
            거절
          </button>
        </Modal.Footer>
      </Modal>

      {/* 메모 모달 */}
      <Modal isOpen={!!noteTarget} onClose={() => setNoteTarget(null)} title="관리자 메모" size="sm">
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
          <button onClick={() => setNoteTarget(null)} className="flex-1 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            취소
          </button>
          <button onClick={handleSaveNote} className="flex-1 btn-primary">저장</button>
        </Modal.Footer>
      </Modal>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </div>
  )
}

// ─── 탭 버튼 ─────────────────────────────────────────────────────────────────

function TabButton({
  label, isActive, badgeCount, onClick,
}: {
  label: string
  isActive: boolean
  badgeCount: number
  onClick: () => void
}) {
  return (
    <button
      role="tab"
      aria-selected={isActive}
      onClick={onClick}
      className="px-4 py-2 text-sm transition-colors whitespace-nowrap"
      style={{
        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
        fontWeight: isActive ? 700 : 400,
        borderBottom: isActive ? '2px solid var(--text-primary)' : '2px solid transparent',
        marginBottom: '-1px',
      }}
    >
      {label}
      {badgeCount > 0 && (
        <span
          className="ml-1 px-1 py-0.5 rounded text-xs font-bold text-white"
          style={{ backgroundColor: 'var(--color-warning)' }}
        >
          {badgeCount}
        </span>
      )}
    </button>
  )
}

// ─── BookingCard ─────────────────────────────────────────────────────────────

interface BookingCardProps {
  booking: LessonBooking
  onConfirm: () => void
  onCancel: () => void
  onNote: () => void
}

function BookingCard({ booking, onConfirm, onCancel, onNote }: BookingCardProps) {
  const conf      = STATUS_CONFIG[booking.status]
  const name      = booking.is_guest ? booking.guest_name : booking.member?.name
  const typeLabel = BOOKING_TYPE_LABEL[booking.booking_type]

  const formatSlotTime = (slot: LessonSlot) => {
    const d = new Date(slot.slot_date + 'T00:00:00')
    const day = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
    return `${slot.slot_date} (${day}) ${slot.start_time.slice(0, 5)}~${slot.end_time.slice(0, 5)}`
  }

  const createdAt = new Date(booking.created_at).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })

  return (
    <div
      className="rounded-lg px-4 py-3"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      {/* 모바일: 수직 스택 / 데스크탑(md+): 수평 배치 */}
      <div className="flex flex-col md:flex-row md:items-center md:gap-4">

        {/* 신청자 정보 */}
        <div className="flex items-center gap-2 md:w-48 md:shrink-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--bg-card-hover)' }}
          >
            <User className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {name || '이름 없음'}
              </span>
              {booking.is_guest && <Badge variant="orange">비회원</Badge>}
              <Badge variant={conf.variant}>{conf.label}</Badge>
            </div>
            {booking.is_guest && booking.guest_phone && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{booking.guest_phone}</p>
            )}
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{createdAt}</p>
          </div>
        </div>

        {/* 슬롯 / 요금 */}
        <div className="mt-2 md:mt-0 md:flex-1">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
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

        {/* 관리자 메모 / 거절 사유 */}
        {(booking.admin_note || booking.cancel_reason) && (
          <div className="mt-2 md:mt-0 md:w-36 md:shrink-0 space-y-0.5">
            {booking.admin_note && (
              <p
                className="text-xs px-2 py-1 rounded line-clamp-2"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                title={booking.admin_note}
              >
                📝 {booking.admin_note}
              </p>
            )}
            {booking.cancel_reason && (
              <p
                className="text-xs px-2 py-1 rounded line-clamp-2"
                style={{ backgroundColor: 'var(--color-danger-subtle, #fee2e2)', color: 'var(--color-danger)' }}
                title={booking.cancel_reason}
              >
                ✕ {booking.cancel_reason}
              </p>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="mt-2 md:mt-0 flex gap-1.5 md:shrink-0">
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
    </div>
  )
}
