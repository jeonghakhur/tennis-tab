'use client'

import { useState, useCallback, type ReactNode } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { AlertDialog } from '@/components/common/AlertDialog'
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

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; icon: ReactNode; activeClass: string }[] = [
  { value: 'ATTENDING', label: '참석', icon: <CheckCircle className="w-4 h-4" aria-hidden="true" />, activeClass: 'bg-emerald-500/20 border-emerald-500 text-emerald-400' },
  { value: 'NOT_ATTENDING', label: '불참', icon: <XCircle className="w-4 h-4" aria-hidden="true" />, activeClass: 'bg-gray-500/20 border-gray-500 text-gray-400' },
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
    if (!window.confirm('참석 응답을 취소하시겠습니까?')) return
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
            className={`flex-1 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              status === opt.value
                ? opt.activeClass
                : 'border-(--border-color) text-(--text-muted) hover:border-(--text-muted)'
            }`}
          >
            <span className="mr-1.5">{opt.icon}</span>
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
        <label htmlFor="att-notes" className="block text-sm text-(--text-muted) mb-1">
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
            onClick={handleCancel}
            disabled={cancelling || saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-semibold border disabled:opacity-50"
            style={{ borderColor: 'var(--border-danger, #ef4444)', color: 'var(--color-danger, #ef4444)' }}
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
    </div>
  )
}
