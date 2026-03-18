'use client'

import { useState, useEffect } from 'react'
import { Check, RotateCcw, Plus, ChevronRight } from 'lucide-react'
import { Modal } from '@/components/common/Modal'
import { Toast } from '@/components/common/AlertDialog'
import { updateSlotSessions, rescheduleSession, extendSlot } from '@/lib/lessons/slot-actions'
import type { UpdatedSlotMeta } from '@/lib/lessons/slot-actions'
import type { LessonBooking, SlotSession, SlotSessionStatus } from '@/lib/lessons/slot-types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const SESSION_STATUS_CONFIG: Record<
  Exclude<SlotSessionStatus, undefined>,
  { label: string; color: string; bg: string }
> = {
  SCHEDULED:   { label: '예정',   color: 'var(--text-muted)',       bg: 'var(--bg-secondary)' },
  COMPLETED:   { label: '완료',   color: '#10b981',                 bg: '#10b98120' },
  CANCELLED:   { label: '취소',   color: 'var(--color-danger)',      bg: '#ef444420' },
  RESCHEDULED: { label: '연기됨', color: 'var(--color-warning)',     bg: '#f59e0b20' },
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface Props {
  booking: LessonBooking | null
  onClose: () => void
  onSessionsUpdated: (slotId: string, meta: UpdatedSlotMeta) => void
  onExtended: () => void  // 신규 슬롯+예약 생성됨 → 목록 재조회
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[d.getDay()]})`
}

/** Date를 로컬 타임존 기준 YYYY-MM-DD 문자열로 변환 (toISOString은 UTC 변환으로 날짜가 밀릴 수 있음) */
function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + weeks * 7)
  return toLocalDateStr(d)
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function SessionManageModal({ booking, onClose, onSessionsUpdated, onExtended }: Props) {
  const slot = booking?.slots?.[0] ?? null

  // 로컬 세션 상태 (편집 중)
  const [sessions, setSessions] = useState<SlotSession[]>([])
  // 연기 모달 대상
  const [rescheduleTarget, setRescheduleTarget] = useState<SlotSession | null>(null)
  // 연장 주수 (0 = 연장 패널 닫힘)
  const [extendWeeks, setExtendWeeks] = useState(0)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  // 모달 열릴 때 세션 초기화
  useEffect(() => {
    if (slot?.sessions) {
      setSessions([...slot.sessions])
    } else {
      setSessions([])
    }
    setExtendWeeks(0)
    setRescheduleTarget(null)
  }, [slot?.id])

  if (!booking || !slot) return null

  // ── 집계 ─────────────────────────────────────────────────────────────────

  const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length
  const totalActive    = sessions.filter((s) => s.status !== 'CANCELLED').length

  // ── 세션 토글 (SCHEDULED ↔ COMPLETED) ────────────────────────────────────

  const toggleComplete = (dateStr: string) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.slot_date !== dateStr) return s
        const next: SlotSessionStatus =
          s.status === 'COMPLETED' ? 'SCHEDULED' : 'COMPLETED'
        return { ...s, status: next }
      }),
    )
  }

  // ── 저장 (sessions 전체 업데이트) ─────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true)
    const result = await updateSlotSessions(slot.id, sessions)
    setSaving(false)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      return
    }
    onSessionsUpdated(slot.id, {
      sessions: result.sessions!,
      totalSessions: result.totalSessions!,
      lastSessionDate: result.lastSessionDate!,
    })
    onClose()
  }

  // ── 연기 처리 ─────────────────────────────────────────────────────────────

  const handleReschedule = async (reason: string) => {
    if (!rescheduleTarget) return
    setSaving(true)
    const result = await rescheduleSession(slot.id, rescheduleTarget.slot_date, reason || undefined)
    setSaving(false)
    setRescheduleTarget(null)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      return
    }
    onSessionsUpdated(slot.id, {
      sessions: result.sessions!,
      totalSessions: result.totalSessions!,
      lastSessionDate: result.lastSessionDate!,
    })
    onClose()
  }

  // ── 연장 처리 ─────────────────────────────────────────────────────────────

  const handleExtend = async () => {
    if (extendWeeks < 1) return
    setSaving(true)
    const result = await extendSlot(slot.id, extendWeeks)
    setSaving(false)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
      return
    }
    // 신규 슬롯+예약이 생성됐으므로 목록 전체 재조회
    onExtended()
    onClose()
  }

  // ── 요일/시간 요약 ────────────────────────────────────────────────────────

  const dowMap = new Map<number, { start: string; end: string }>()
  for (const s of sessions) {
    const dow = new Date(s.slot_date + 'T00:00:00').getDay()
    if (!dowMap.has(dow)) {
      dowMap.set(dow, { start: s.start_time.slice(0, 5), end: s.end_time.slice(0, 5) })
    }
  }
  const scheduleLabel = [...dowMap.entries()]
    .sort((a, b) => (a[0] === 0 ? 7 : a[0]) - (b[0] === 0 ? 7 : b[0]))
    .map(([dow, t]) => `${DAY_LABELS[dow]} ${t.start}~${t.end}`)
    .join('  ')

  const applicantName = booking.is_guest ? booking.guest_name : booking.member?.name

  return (
    <>
      <Modal
        isOpen={!!booking}
        onClose={onClose}
        title="세션 관리"
        description={`${applicantName ?? '—'}  ·  ${scheduleLabel}`}
        size="lg"
        closeOnOverlayClick={false}
      >
        <Modal.Body>
          {/* 진행 현황 요약 */}
          <div
            className="flex items-center justify-between mb-4 px-3 py-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
              진행 현황
            </span>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {completedCount} / {totalActive}회 완료
            </span>
          </div>

          {/* 세션 목록 */}
          <div className="space-y-1.5">
            {sessions.map((session) => {
              const status = session.status ?? 'SCHEDULED'
              const conf = SESSION_STATUS_CONFIG[status]
              const isPast = new Date(session.slot_date + 'T23:59:59') < new Date()
              const canToggle = status === 'SCHEDULED' || status === 'COMPLETED'
              const canReschedule = status === 'SCHEDULED' && !isPast

              return (
                <div
                  key={session.slot_date}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ backgroundColor: conf.bg, border: `1px solid ${conf.color}30` }}
                >
                  {/* 완료 체크박스 */}
                  <button
                    onClick={() => canToggle && toggleComplete(session.slot_date)}
                    disabled={!canToggle}
                    className="w-6 h-6 rounded flex items-center justify-center shrink-0 transition-colors"
                    style={
                      status === 'COMPLETED'
                        ? { backgroundColor: '#10b981', cursor: 'pointer' }
                        : canToggle
                          ? { border: '2px solid var(--border-color)', cursor: 'pointer', backgroundColor: 'transparent' }
                          : { border: '2px solid var(--border-color)', cursor: 'default', opacity: 0.4, backgroundColor: 'transparent' }
                    }
                    aria-label={status === 'COMPLETED' ? '완료 취소' : '완료 표시'}
                  >
                    {status === 'COMPLETED' && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>

                  {/* 날짜 */}
                  <span
                    className="text-sm font-medium w-24 shrink-0"
                    style={{
                      color: conf.color,
                      textDecoration: status === 'CANCELLED' ? 'line-through' : 'none',
                    }}
                  >
                    {formatDate(session.slot_date)}
                  </span>

                  {/* 시간 */}
                  <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {session.start_time.slice(0, 5)}~{session.end_time.slice(0, 5)}
                  </span>

                  {/* 상태 뱃지 */}
                  <span
                    className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                    style={{ color: conf.color, backgroundColor: `${conf.color}20` }}
                  >
                    {conf.label}
                  </span>

                  {/* 사유 메모 */}
                  {session.note && (
                    <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
                      {session.note}
                    </span>
                  )}
                  {session.original_date && (
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                      (원래 {formatDate(session.original_date)})
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    {/* 연기 버튼 */}
                    {canReschedule && (
                      <button
                        onClick={() => setRescheduleTarget(session)}
                        className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-xs font-medium"
                        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                      >
                        <RotateCcw className="w-3 h-3" />
                        1주 연기
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* 연장 패널 */}
          <div className="mt-4 pt-4" style={{ borderTop: '1px dashed var(--border-color)' }}>
            {extendWeeks === 0 ? (
              <button
                onClick={() => setExtendWeeks(4)}
                className="inline-flex items-center gap-1.5 text-sm"
                style={{ color: 'var(--accent-color)' }}
              >
                <Plus className="w-4 h-4" />
                패키지 연장
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  연장 주수
                </span>
                {[1, 2, 4, 8].map((w) => (
                  <button
                    key={w}
                    onClick={() => setExtendWeeks(w)}
                    className="w-9 h-9 rounded-lg text-sm font-medium"
                    style={
                      extendWeeks === w
                        ? { backgroundColor: 'var(--accent-color)', color: '#fff' }
                        : { backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }
                    }
                  >
                    {w}주
                  </button>
                ))}
                <button
                  onClick={handleExtend}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-white"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  <ChevronRight className="w-4 h-4" />
                  연장 적용
                </button>
                <button
                  onClick={() => setExtendWeeks(0)}
                  className="text-sm"
                  style={{ color: 'var(--text-muted)' }}
                >
                  취소
                </button>
              </div>
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            닫기
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--accent-color)' }}
          >
            {saving ? '저장 중…' : '진행 현황 저장'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* 연기 사유 모달 */}
      <RescheduleModal
        session={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
        onConfirm={handleReschedule}
      />

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </>
  )
}

// ─── RescheduleModal ──────────────────────────────────────────────────────────

function RescheduleModal({
  session,
  onClose,
  onConfirm,
}: {
  session: SlotSession | null
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (session) setReason('')
  }, [session])

  if (!session) return null

  const newDate = addWeeks(session.slot_date, 1)

  return (
    <Modal isOpen={!!session} onClose={onClose} title="1주 연기" size="sm">
      <Modal.Body>
        <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
          <strong>{formatDate(session.slot_date)}</strong> 세션을{' '}
          <strong>{formatDate(newDate)}</strong>으로 연기합니다.
        </p>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          원래 세션은 &apos;연기됨&apos;으로 표시되고, 새 세션이 추가됩니다.
        </p>
        <label htmlFor="reschedule-reason" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          사유 (선택)
        </label>
        <textarea
          id="reschedule-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={100}
          placeholder="우천, 개인 사정 등"
          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
          style={{
            backgroundColor: 'var(--bg-input)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          }}
        />
      </Modal.Body>
      <Modal.Footer>
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          취소
        </button>
        <button
          onClick={() => onConfirm(reason.trim())}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--color-warning, #f59e0b)' }}
        >
          연기 확인
        </button>
      </Modal.Footer>
    </Modal>
  )
}
