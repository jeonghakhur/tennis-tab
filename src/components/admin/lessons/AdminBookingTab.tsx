'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ClipboardList, Check, X, MessageSquare, Search, User, Calendar } from 'lucide-react'
import { getBookings, confirmBooking, cancelBooking, updateBookingNote } from '@/lib/lessons/slot-actions'
import type { UpdatedSlotMeta } from '@/lib/lessons/slot-actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast } from '@/components/common/AlertDialog'
import { SessionManageModal } from './SessionManageModal'
import { getCoaches } from '@/lib/coaches/actions'
import type { Coach } from '@/lib/lessons/types'
import type { LessonBooking, LessonBookingStatus } from '@/lib/lessons/slot-types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LessonBookingStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:   { label: '대기', variant: 'warning' },
  CONFIRMED: { label: '확정', variant: 'success' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

type StatusFilter = 'ALL' | LessonBookingStatus

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export function AdminBookingTab() {
  const [coaches, setCoaches] = useState<Coach[]>([])

  useEffect(() => {
    getCoaches().then(({ data }) => setCoaches(data))
  }, [])
  const [bookings, setBookings]             = useState<LessonBooking[]>([])
  const [loading, setLoading]               = useState(true)
  const [selectedCoachId, setSelectedCoachId] = useState<string>('ALL')
  const [statusFilter, setStatusFilter]     = useState<StatusFilter>('ALL')
  const [searchQuery, setSearchQuery]       = useState('')

  // 모달 (reason/noteText는 각 모달 컴포넌트 로컬 state로 관리 — 부모 리렌더 방지)
  const [cancelTarget, setCancelTarget]       = useState<LessonBooking | null>(null)
  const [noteTarget, setNoteTarget]           = useState<LessonBooking | null>(null)
  const [sessionTarget, setSessionTarget]     = useState<LessonBooking | null>(null)

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  // coaches → coachId:name 맵
  const coachMap = useMemo(() => {
    const map = new Map<string, string>()
    coaches.forEach((c) => map.set(c.id, c.name))
    return map
  }, [coaches])

  const loadBookings = useCallback(async () => {
    setLoading(true)
    const { data } = await getBookings()
    setBookings(data)
    setLoading(false)
  }, [])

  useEffect(() => { loadBookings() }, [loadBookings])

  // 예약에 등장하는 코치 탭 목록
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

  // 클라이언트 사이드 필터링 (코치 탭 + 상태 드롭다운 + 이름 검색)
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return bookings.filter((b) => {
      if (selectedCoachId !== 'ALL' && b.slots?.[0]?.coach_id !== selectedCoachId) return false
      if (statusFilter !== 'ALL' && b.status !== statusFilter) return false
      if (q) {
        const name = (b.is_guest ? b.guest_name : b.member?.name) ?? ''
        if (!name.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [bookings, selectedCoachId, statusFilter, searchQuery])

  // 탭별 대기 건수
  const allPendingCount = bookings.filter((b) => b.status === 'PENDING').length
  const coachPendingCount = (coachId: string) =>
    bookings.filter((b) => b.status === 'PENDING' && b.slots?.[0]?.coach_id === coachId).length

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

  const handleCancel = async (reason: string) => {
    if (!cancelTarget) return
    const targetId = cancelTarget.id
    const isPending = cancelTarget.status === 'PENDING'
    setCancelTarget(null)
    setBookings((prev) =>
      prev.map((b) =>
        b.id === targetId
          ? { ...b, status: 'CANCELLED' as const, cancel_reason: reason, admin_note: reason || b.admin_note }
          : b
      )
    )
    const result = await cancelBooking(targetId, reason)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      await loadBookings()
      return
    }
    if (reason) await updateBookingNote(targetId, reason)
    setToast({
      isOpen: true,
      message: isPending ? '예약이 거절되었습니다. 슬롯이 복구되었습니다.' : '예약이 취소되었습니다. 슬롯이 복구되었습니다.',
      type: 'success',
    })
  }

  const handleSessionsUpdated = useCallback((slotId: string, meta: UpdatedSlotMeta) => {
    setBookings((prev) =>
      prev.map((b) => {
        if (!b.slots?.[0] || b.slots[0].id !== slotId) return b
        const updatedSlot = {
          ...b.slots[0],
          sessions: meta.sessions,
          total_sessions: meta.totalSessions,
          last_session_date: meta.lastSessionDate,
        }
        return { ...b, slots: [updatedSlot] }
      })
    )
  }, [])

  const handleSaveNote = async (note: string) => {
    if (!noteTarget) return
    const targetId = noteTarget.id
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

      {/* 필터 바: 상태 드롭다운 + 이름 검색 */}
      <div className="flex items-center gap-3 mb-4">
        {/* 상태 드롭다운 */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-9 pl-3 pr-8 rounded-lg text-sm appearance-none cursor-pointer"
          style={{
            backgroundColor: 'var(--bg-card)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
          }}
          aria-label="예약 상태 필터"
        >
          <option value="ALL">전체 상태</option>
          <option value="PENDING">대기</option>
          <option value="CONFIRMED">확정</option>
          <option value="CANCELLED">취소</option>
        </select>

        {/* 이름 검색 */}
        <div className="relative flex-1 max-w-xs">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="신청자명 검색"
            className="w-full h-9 pl-9 pr-3 rounded-lg text-sm"
            style={{
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
            }}
            aria-label="신청자명 검색"
          />
        </div>

        {/* 결과 건수 */}
        {!loading && (
          <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>
            {filtered.length}건
          </span>
        )}
      </div>

      {/* 테이블 */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>예약이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-color)' }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>신청자</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>상태</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>스케줄</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>요금</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>신청일</th>
                <th className="px-4 py-3 text-right font-medium whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((booking, idx) => (
                <BookingRow
                  key={booking.id}
                  booking={booking}
                  isLast={idx === filtered.length - 1}
                  onConfirm={() => handleConfirm(booking)}
                  onCancel={() => setCancelTarget(booking)}
                  onNote={() => setNoteTarget(booking)}
                  onSession={() => setSessionTarget(booking)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 취소/거절 사유 모달 */}
      <CancelModal
        target={cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
      />

      {/* 메모 모달 */}
      <NoteModal
        target={noteTarget}
        onClose={() => setNoteTarget(null)}
        onSave={handleSaveNote}
      />

      {/* 세션 관리 모달 */}
      <SessionManageModal
        booking={sessionTarget}
        onClose={() => setSessionTarget(null)}
        onSessionsUpdated={handleSessionsUpdated}
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

// ─── 요일 레이블 ──────────────────────────────────────────────────────────────

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

/** sessions 배열에서 요일별 시간 그룹 추출 (DOW → start/end) */
function getSlotSchedule(sessions: { slot_date: string; start_time: string; end_time: string }[]) {
  const map = new Map<number, { start: string; end: string }>()
  for (const s of sessions) {
    const dow = new Date(s.slot_date + 'T00:00:00').getDay()
    if (!map.has(dow)) {
      map.set(dow, { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) })
    }
  }
  return [...map.entries()].sort((a, b) => {
    // 월~금 → 토 → 일 순 (1~5, 6, 0)
    const order = (d: number) => (d === 0 ? 7 : d)
    return order(a[0]) - order(b[0])
  })
}

// ─── BookingRow ───────────────────────────────────────────────────────────────

function BookingRow({
  booking, isLast, onConfirm, onCancel, onNote, onSession,
}: {
  booking: LessonBooking
  isLast: boolean
  onConfirm: () => void
  onCancel: () => void
  onNote: () => void
  onSession: () => void
}) {
  const conf    = STATUS_CONFIG[booking.status]
  const name    = booking.is_guest ? booking.guest_name : booking.member?.name
  const slot    = booking.slots?.[0]
  const sessions = slot?.sessions ?? []
  const totalSessions = slot?.total_sessions ?? sessions.length

  // 요일별 시간 (예: 월 07:00~07:20, 화 07:00~07:20)
  const schedule = getSlotSchedule(sessions)

  // 날짜 목록 (M/D 형식, 정렬)
  const sortedDates = sessions
    .map((s) => s.slot_date)
    .sort()

  const formatShortDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  const createdAt = new Date(booking.created_at).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric',
  })

  return (
    <tr
      style={{
        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-card)',
      }}
    >
      {/* 신청자 */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: 'var(--bg-card-hover)' }}
          >
            <User className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                {name || '이름 없음'}
              </span>
              {booking.is_guest && <Badge variant="orange">비회원</Badge>}
            </div>
            {booking.is_guest && booking.guest_phone && (
              <p className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                {booking.guest_phone}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* 상태 */}
      <td className="px-4 py-3 whitespace-nowrap align-top pt-4">
        <Badge variant={conf.variant}>{conf.label}</Badge>
      </td>

      {/* 스케줄 — 요일/시간 + 날짜 목록 */}
      <td className="px-4 py-3 min-w-[260px]">
        {sessions.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        ) : (
          <div className="space-y-1.5">
            {/* 요일별 시간 + 총 회차 */}
            <div className="flex items-center gap-3 flex-wrap">
              {schedule.map(([dow, time]) => (
                <span key={dow} className="text-sm font-medium whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                  {DAY_LABELS[dow]} {time.start}~{time.end}
                </span>
              ))}
              {totalSessions > 0 && (
                <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {totalSessions}회
                </span>
              )}
            </div>
            {/* 날짜 목록 칩 */}
            <div className="flex flex-wrap gap-1">
              {sortedDates.map((dateStr) => {
                const isPast = new Date(dateStr + 'T23:59:59') < new Date()
                return (
                  <span
                    key={dateStr}
                    className="inline-block px-1.5 py-0.5 rounded text-xs font-medium"
                    style={
                      isPast
                        ? { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }
                        : { backgroundColor: 'var(--accent-color)', color: '#fff', opacity: 0.9 }
                    }
                  >
                    {formatShortDate(dateStr)}
                  </span>
                )
              })}
            </div>
          </div>
        )}
      </td>

      {/* 요금 */}
      <td className="px-4 py-3 whitespace-nowrap align-top pt-4">
        {booking.fee_amount !== null ? (
          <span className="text-sm font-medium" style={{ color: 'var(--accent-color)' }}>
            {booking.fee_amount.toLocaleString()}원/월
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>—</span>
        )}
      </td>

      {/* 신청일 */}
      <td className="px-4 py-3 whitespace-nowrap align-top pt-4">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{createdAt}</span>
      </td>

      {/* 액션 */}
      <td className="px-4 py-3 align-top pt-3">
        <div className="flex items-center justify-end gap-1.5">
          {booking.status === 'PENDING' && (
            <button
              onClick={onConfirm}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--color-success)' }}
            >
              <Check className="w-3 h-3" />
              수락
            </button>
          )}
          {(booking.status === 'PENDING' || booking.status === 'CONFIRMED') && (
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: 'var(--color-danger)' }}
            >
              <X className="w-3 h-3" />
              {booking.status === 'PENDING' ? '거절' : '취소'}
            </button>
          )}
          {/* 세션 관리 버튼 */}
          {booking.slots?.[0]?.sessions && booking.slots[0].sessions.length > 0 && (
            <button
              onClick={onSession}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
            >
              <Calendar className="w-3 h-3" />
              세션
            </button>
          )}
          {/* 메모 버튼 */}
          <button
            onClick={onNote}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
            style={
              booking.admin_note
                ? { backgroundColor: 'var(--color-info, #3b82f6)', color: '#fff' }
                : { backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }
            }
          >
            <MessageSquare className="w-3 h-3" />
            메모
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── CancelModal ─────────────────────────────────────────────────────────────

function CancelModal({
  target, onClose, onConfirm,
}: {
  target: LessonBooking | null
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (target) setReason('')
  }, [target])

  const isPending = target?.status === 'PENDING'

  return (
    <Modal isOpen={!!target} onClose={onClose} title={isPending ? '예약 거절' : '예약 취소'} size="sm">
      <Modal.Body>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          {isPending ? '예약을 거절하면 슬롯이 다시 공개됩니다.' : '예약을 취소하면 슬롯이 다시 공개됩니다.'}
        </p>
        <label htmlFor="cancel-reason" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          {isPending ? '거절 사유 (선택)' : '취소 사유 (선택)'}
        </label>
        <textarea
          id="cancel-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={200}
          placeholder="사유를 입력하면 메모에 저장됩니다."
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
        />
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          닫기
        </button>
        <button
          onClick={() => onConfirm(reason.trim())}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-danger)' }}
        >
          {isPending ? '거절' : '취소 확인'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

// ─── NoteModal ───────────────────────────────────────────────────────────────

function NoteModal({
  target, onClose, onSave,
}: {
  target: LessonBooking | null
  onClose: () => void
  onSave: (note: string) => void
}) {
  const [note, setNote] = useState('')

  useEffect(() => {
    if (target) setNote(target.admin_note ?? '')
  }, [target])

  return (
    <Modal isOpen={!!target} onClose={onClose} title="관리자 메모" size="sm">
      <Modal.Body>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder="메모를 입력하세요."
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          aria-label="관리자 메모"
        />
      </Modal.Body>
      <Modal.Footer>
        <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
          취소
        </button>
        <button onClick={() => onSave(note)} className="flex-1 btn-primary">저장</button>
      </Modal.Footer>
    </Modal>
  )
}
