'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar, Clock, ChevronLeft, User, Loader2, BookOpen, X,
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getMyBookings, cancelMyBooking, type MyBookingDetail } from '@/lib/lessons/slot-actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { ConfirmDialog, Toast } from '@/components/common/AlertDialog'
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  type LessonBookingStatus,
} from '@/lib/lessons/slot-types'

// ── 상태 config ───────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<LessonBookingStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '대기중', variant: 'warning' },
  CONFIRMED: { label: '확정', variant: 'success' },
  CANCELLED: { label: '취소', variant: 'danger' },
}

/** 날짜 포맷: 2026-03-17 → 3/17(화) */
function formatSlotDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()]
  return `${d.getMonth() + 1}/${d.getDate()}(${weekday})`
}

/** 시간 포맷: HH:MM:SS → HH:MM */
function formatTime(time: string): string {
  return time.slice(0, 5)
}

// ── 예약 카드 ────────────────────────────────────────────────────────────────
function BookingCard({
  detail,
  onCancel,
}: {
  detail: MyBookingDetail
  onCancel: (bookingId: string) => void
}) {
  const { booking, slots } = detail

  // 코치 정보: 첫 슬롯의 프로그램에서 가져옴
  const program = slots[0]?.program
  const coach = program?.coach
  const canCancel = booking.status === 'PENDING' || booking.status === 'CONFIRMED'

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: '1px solid var(--border-color)' }}
    >
      {/* 헤더: 코치 + 상태 */}
      <div className="px-4 py-4" style={{ backgroundColor: 'var(--bg-card)' }}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            {coach?.profile_image_url ? (
              <img
                src={coach.profile_image_url}
                alt={coach.name}
                className="w-10 h-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--bg-card-hover)' }}
              >
                <User className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
              </div>
            )}
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                {program?.title || '레슨 프로그램'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
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
      <div
        className="px-4 py-3 space-y-3"
        style={{ borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
      >
        {/* 예약 유형 + 요금 */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            {BOOKING_TYPE_LABEL[booking.booking_type]}
          </span>
          {booking.fee_amount != null && (
            <span className="text-sm font-semibold" style={{ color: 'var(--accent-color)' }}>
              {booking.fee_amount.toLocaleString()}원
            </span>
          )}
        </div>

        {/* 슬롯 목록 */}
        <div className="space-y-2">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
              style={{ backgroundColor: 'var(--bg-card-hover)' }}
            >
              <Calendar className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-color)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {formatSlotDate(slot.slot_date)}
              </span>
              <Clock className="w-3.5 h-3.5 shrink-0 ml-1" style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {formatTime(slot.start_time)} ~ {formatTime(slot.end_time)}
              </span>
            </div>
          ))}
        </div>

        {/* 취소 버튼 */}
        {canCancel && (
          <button
            type="button"
            onClick={() => onCancel(booking.id)}
            className="w-full flex items-center justify-center gap-1.5 text-sm py-2.5 rounded-lg transition-colors"
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
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function MyLessonsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [details, setDetails] = useState<MyBookingDetail[]>([])
  const [loading, setLoading] = useState(true)

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    bookingId: string
  }>({ isOpen: false, bookingId: '' })
  const [cancelling, setCancelling] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/auth/login'); return }
    loadData()
  }, [authLoading, user])

  const loadData = async () => {
    setLoading(true)
    const result = await getMyBookings()
    if (!result.error) {
      setDetails(result.data)
    }
    setLoading(false)
  }

  const handleCancelRequest = (bookingId: string) => {
    setConfirmDialog({ isOpen: true, bookingId })
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

  // 활성 예약(PENDING/CONFIRMED)과 취소 예약 분리
  const activeBookings = details.filter((d) => d.booking.status !== 'CANCELLED')
  const cancelledBookings = details.filter((d) => d.booking.status === 'CANCELLED')

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-card-hover)' }}
            aria-label="뒤로 가기"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
            나의 레슨
          </h1>
        </div>

        {/* 예약 없음 */}
        {details.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>신청한 레슨이 없어요.</p>
            <button
              type="button"
              onClick={() => router.push('/lessons')}
              className="mt-4 btn-primary btn-sm"
            >
              레슨 문의하기
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 활성 예약 */}
            {activeBookings.map((detail) => (
              <BookingCard
                key={detail.booking.id}
                detail={detail}
                onCancel={handleCancelRequest}
              />
            ))}

            {/* 취소된 예약 */}
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
                      onCancel={handleCancelRequest}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

      </div>

      {/* 취소 확인 다이얼로그 */}
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

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </div>
  )
}
