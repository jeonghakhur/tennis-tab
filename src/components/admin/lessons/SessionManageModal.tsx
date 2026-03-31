'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/common/Modal'
import { Toast } from '@/components/common/AlertDialog'
import { updateSlotSessions, rescheduleSession } from '@/lib/lessons/slot-actions'
import type { UpdatedSlotMeta } from '@/lib/lessons/slot-actions'
import type { LessonBooking, SlotSession, SlotSessionStatus } from '@/lib/lessons/slot-types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const STATUS_CONFIG: Record<
  Exclude<SlotSessionStatus, undefined>,
  { label: string; color: string; bg: string }
> = {
  SCHEDULED:   { label: '예정',   color: 'var(--text-muted)',      bg: 'var(--bg-secondary)' },
  COMPLETED:   { label: '완료',   color: '#10b981',                bg: '#10b98120' },
  CANCELLED:   { label: '취소',   color: 'var(--color-danger)',     bg: '#ef444420' },
  RESCHEDULED: { label: '연기됨', color: 'var(--color-warning)',    bg: '#f59e0b20' },
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface Props {
  booking: LessonBooking | null
  onClose: () => void
  onSessionsUpdated: (slotId: string, meta: UpdatedSlotMeta) => void
}

interface RescheduleTarget {
  session: SlotSession
  /** 기존 세션 중 이미 사용된 날짜 목록 (충돌 방지) */
  usedDates: string[]
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}(${DAY_LABELS[d.getDay()]})`
}

function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function SessionManageModal({ booking, onClose, onSessionsUpdated }: Props) {
  const slot = booking?.slots?.[0] ?? null

  const [sessions, setSessions] = useState<SlotSession[]>([])
  const [rescheduleTarget, setRescheduleTarget] = useState<RescheduleTarget | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  useEffect(() => {
    if (slot?.sessions) setSessions([...slot.sessions])
    else setSessions([])
    setRescheduleTarget(null)
  }, [slot?.id])

  if (!booking || !slot) return null

  const completedCount = sessions.filter((s) => s.status === 'COMPLETED').length
  const totalActive    = sessions.filter((s) => s.status !== 'CANCELLED').length

  // ── 로컬 상태 변경 (진행/취소 → 저장 버튼으로 일괄 저장) ──────────────────

  const setStatus = (dateStr: string, next: SlotSessionStatus) => {
    setSessions((prev) =>
      prev.map((s) => s.slot_date === dateStr ? { ...s, status: next } : s),
    )
  }

  // ── 저장 ──────────────────────────────────────────────────────────────────

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

  // ── 연기 처리 (즉시 서버 저장) ────────────────────────────────────────────

  const handleReschedule = async (makeupDate: string, startTime: string, endTime: string, reason: string) => {
    if (!rescheduleTarget) return
    setSaving(true)
    const result = await rescheduleSession(
      slot.id,
      rescheduleTarget.session.slot_date,
      makeupDate,
      startTime || undefined,
      endTime || undefined,
      reason || undefined,
    )
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
              const conf = STATUS_CONFIG[status]
              const isPast = new Date(session.slot_date + 'T23:59:59') < new Date()

              return (
                <div
                  key={session.slot_date}
                  className="px-3 py-2 rounded-lg"
                  style={{ backgroundColor: conf.bg, border: `1px solid ${conf.color}30` }}
                >
                  {/* 1행: 날짜 + 시간 + 상태 */}
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium shrink-0"
                      style={{
                        color: conf.color,
                        textDecoration: status === 'CANCELLED' || status === 'RESCHEDULED' ? 'line-through' : 'none',
                      }}
                    >
                      {formatDate(session.slot_date)}
                    </span>
                    <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {session.start_time.slice(0, 5)}~{session.end_time.slice(0, 5)}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium shrink-0"
                      style={{ color: conf.color, backgroundColor: `${conf.color}20` }}
                    >
                      {conf.label}
                    </span>
                    {session.original_date && (
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        ← {formatDate(session.original_date)}
                      </span>
                    )}
                  </div>

                  {/* 2행: 액션 버튼 */}
                  <div className="flex items-center gap-1 mt-1.5">
                    {status === 'SCHEDULED' && (
                      <>
                        <ActionBtn
                          label="진행"
                          color="var(--color-success)"
                          onClick={() => setStatus(session.slot_date, 'COMPLETED')}
                        />
                        <ActionBtn
                          label="취소"
                          color="var(--color-danger)"
                          onClick={() => setStatus(session.slot_date, 'CANCELLED')}
                        />
                        {!isPast && (
                          <ActionBtn
                            label="연기"
                            color="var(--color-warning)"
                            onClick={() =>
                              setRescheduleTarget({
                                session,
                                usedDates: sessions.map((s) => s.slot_date),
                              })
                            }
                          />
                        )}
                      </>
                    )}
                    {status === 'COMPLETED' && (
                      <ActionBtn
                        label="예정으로"
                        color="var(--text-muted)"
                        onClick={() => setStatus(session.slot_date, 'SCHEDULED')}
                      />
                    )}
                    {status === 'CANCELLED' && (
                      <ActionBtn
                        label="원복"
                        color="var(--color-success)"
                        onClick={() => setStatus(session.slot_date, 'SCHEDULED')}
                      />
                    )}
                    {session.note && (
                      <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                        {session.note}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
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

      {/* 연기 모달 */}
      {rescheduleTarget && (
        <RescheduleModal
          target={rescheduleTarget}
          saving={saving}
          onClose={() => setRescheduleTarget(null)}
          onConfirm={handleReschedule}
        />
      )}


      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </>
  )
}

// ─── ActionBtn ────────────────────────────────────────────────────────────────

function ActionBtn({ label, color, onClick }: { label: string; color: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2.5 py-1 rounded text-xs font-medium"
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}
    >
      {label}
    </button>
  )
}

// ─── RescheduleModal ──────────────────────────────────────────────────────────

function RescheduleModal({
  target,
  saving,
  onClose,
  onConfirm,
}: {
  target: RescheduleTarget
  saving: boolean
  onClose: () => void
  onConfirm: (makeupDate: string, startTime: string, endTime: string, reason: string) => void
}) {
  const { session, usedDates } = target

  const minDate = (() => {
    const d = new Date(session.slot_date + 'T00:00:00')
    d.setDate(d.getDate() + 1)
    return toLocalDateStr(d)
  })()

  const [makeupDate, setMakeupDate] = useState(minDate)
  const [startTime, setStartTime] = useState(session.start_time.slice(0, 5))
  const [endTime, setEndTime] = useState(session.end_time.slice(0, 5))
  const [reason, setReason] = useState('')
  const [dateError, setDateError] = useState<string | null>(null)
  const [timeError, setTimeError] = useState<string | null>(null)

  const handleConfirm = () => {
    if (!makeupDate) { setDateError('보강 날짜를 선택해주세요.'); return }
    if (usedDates.includes(makeupDate)) { setDateError('해당 날짜에 이미 세션이 있습니다.'); return }
    if (startTime >= endTime) { setTimeError('종료 시간은 시작 시간 이후여야 합니다.'); return }
    onConfirm(makeupDate, startTime, endTime, reason.trim())
  }

  return (
    <Modal isOpen onClose={onClose} title="세션 연기" size="sm">
      <Modal.Body>
        <div className="space-y-4">
          {/* 연기 대상 */}
          <div className="px-3 py-2.5 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
            <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
              {formatDate(session.slot_date)}
            </span>
            {'  '}
            {session.start_time.slice(0, 5)}~{session.end_time.slice(0, 5)} 세션을 연기합니다.
          </div>

          {/* 보강 날짜 */}
          <div>
            <label htmlFor="makeup-date" className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-primary)' }}>
              보강 날짜 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <input
              id="makeup-date"
              type="date"
              value={makeupDate}
              min={minDate}
              onChange={(e) => { setMakeupDate(e.target.value); setDateError(null) }}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: `1px solid ${dateError ? 'var(--color-danger)' : 'var(--border-color)'}`,
              }}
            />
            {dateError && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{dateError}</p>
            )}
          </div>

          {/* 보강 시간 */}
          <div>
            <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
              보강 시간 <span style={{ color: 'var(--text-muted)' }}>(기본: 원래 시간)</span>
            </p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={startTime}
                onChange={(e) => { setStartTime(e.target.value); setTimeError(null) }}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: `1px solid ${timeError ? 'var(--color-danger)' : 'var(--border-color)'}`,
                }}
                aria-label="시작 시간"
              />
              <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>~</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => { setEndTime(e.target.value); setTimeError(null) }}
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: `1px solid ${timeError ? 'var(--color-danger)' : 'var(--border-color)'}`,
                }}
                aria-label="종료 시간"
              />
            </div>
            {timeError && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>{timeError}</p>
            )}
          </div>

          {/* 사유 */}
          <div>
            <label htmlFor="reschedule-reason" className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-primary)' }}>
              사유 <span style={{ color: 'var(--text-muted)' }}>(선택)</span>
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
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          취소
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving}
          className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: 'var(--color-warning, #f59e0b)' }}
        >
          {saving ? '처리 중…' : '연기 확인'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}
