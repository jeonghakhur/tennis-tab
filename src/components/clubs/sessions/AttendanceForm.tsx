'use client'

import { useState, useCallback } from 'react'
import { AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { respondToSession, cancelAttendance } from '@/lib/clubs/session-actions'
import type { AttendanceStatus } from '@/lib/clubs/types'
import SessionTimePicker from './SessionTimePicker'

interface AttendanceFormProps {
  sessionId: string
  clubMemberId: string
  currentStatus?: AttendanceStatus
  currentFrom?: string | null
  currentUntil?: string | null
  currentNotes?: string | null
  sessionStartTime?: string  // 모임 시작 시간 (기본값)
  sessionEndTime?: string    // 모임 종료 시간 (기본값)
  isEditMode?: boolean
  onResponded: () => void
}

// Bootstrap outline-success / outline-warning / outline-secondary 패턴 → 프로젝트 CSS 변수 적용
const STATUS_OPTIONS: { value: AttendanceStatus; label: string; activeClass: string; inactiveClass: string }[] = [
  {
    value: 'ATTENDING',
    label: '참석',
    // solid success: 강조 배경 + 흰색 텍스트
    activeClass: 'bg-(--color-success-emphasis) border-(--color-success-emphasis) text-white font-semibold',
    inactiveClass: 'border-(--color-success-border) text-(--color-success) hover:border-(--color-success) hover:text-(--color-success-emphasis)',
  },
  {
    value: 'NOT_ATTENDING',
    label: '불참',
    // outline-secondary: bg subtle gray + secondary border
    activeClass: 'bg-(--bg-secondary) border-(--border-color) text-(--text-primary) font-semibold',
    inactiveClass: 'border-(--border-color) text-(--text-muted) hover:border-(--text-secondary) hover:text-(--text-secondary)',
  },
]

export default function AttendanceForm({
  sessionId,
  clubMemberId,
  currentStatus,
  currentFrom,
  currentUntil,
  currentNotes,
  sessionStartTime,
  sessionEndTime,
  isEditMode,
  onResponded,
}: AttendanceFormProps) {
  const [status, setStatus] = useState<AttendanceStatus>(currentStatus || 'UNDECIDED')
  const [availableFrom, setAvailableFrom] = useState(currentFrom?.slice(0,5) || sessionStartTime?.slice(0,5) || '')
  const [availableUntil, setAvailableUntil] = useState(currentUntil?.slice(0,5) || sessionEndTime?.slice(0,5) || '')
  const [notes, setNotes] = useState(currentNotes || '')
  const [saving, setSaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [confirmCancel, setConfirmCancel] = useState(false)

  const handleSubmit = useCallback(async () => {
    setSaving(true)
    const result = await respondToSession({
      session_id: sessionId,
      club_member_id: clubMemberId,
      status,
      available_from: availableFrom || undefined,
      available_until: availableUntil || undefined,
      notes: notes.trim() || undefined,
    })
    setSaving(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    onResponded()
  }, [sessionId, clubMemberId, status, availableFrom, availableUntil, notes, onResponded])

  const handleCancel = async () => {
    setCancelling(true)
    const result = await cancelAttendance(sessionId, clubMemberId)
    setCancelling(false)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    onResponded()
  }

  const inputClass =
    'w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none focus:border-(--accent-color)'

  return (
    <div className="glass-card rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-(--text-primary)">참석 응답</h3>

      {/* 3버튼 라디오 */}
      <div className="flex gap-2">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatus(opt.value)}
            className={`flex-1 px-3 py-2.5 rounded-lg border text-sm transition-all ${
              status === opt.value ? opt.activeClass : opt.inactiveClass
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 참석 시 시간 선택 */}
      {status === 'ATTENDING' && (
        <div>
          <label className="block text-sm text-(--text-muted) mb-1.5">참석 가능 시간</label>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <SessionTimePicker
                value={availableFrom}
                onChange={setAvailableFrom}
                placeholder="시작"
              />
            </div>
            <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>~</span>
            <div className="flex-1">
              <SessionTimePicker
                value={availableUntil}
                onChange={setAvailableUntil}
                placeholder="종료"
              />
            </div>
          </div>
        </div>
      )}

      {/* 메모 */}
      <div>
        <label htmlFor="att-notes" className="block text-sm text-(--text-secondary) mb-1">
          메모 (선택)
        </label>
        <input
          id="att-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
          placeholder="예: 늦을 수 있어요"
        />
      </div>

      {/* 제출 */}
      <div className="flex gap-2">
        {isEditMode && (
          <button
            type="button"
            onClick={() => setConfirmCancel(true)}
            disabled={cancelling || saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50"
            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
          >
            {cancelling ? '취소 중...' : '응답 삭제'}
          </button>
        )}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="flex-1 px-4 py-2 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold text-sm disabled:opacity-50"
        >
          {saving ? '저장 중...' : currentStatus ? '응답 수정' : '응답 제출'}
        </button>
      </div>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
      <ConfirmDialog
        isOpen={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => { setConfirmCancel(false); handleCancel() }}
        message="참석 응답을 삭제하시겠습니까?"
        type="warning"
      />
    </div>
  )
}
