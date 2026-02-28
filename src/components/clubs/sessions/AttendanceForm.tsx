'use client'

import { useState, useCallback } from 'react'
import { AlertDialog } from '@/components/common/AlertDialog'
import { respondToSession } from '@/lib/clubs/session-actions'
import type { AttendanceStatus } from '@/lib/clubs/types'

interface AttendanceFormProps {
  sessionId: string
  clubMemberId: string
  currentStatus?: AttendanceStatus
  currentFrom?: string | null
  currentUntil?: string | null
  currentNotes?: string | null
  onResponded: () => void
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string; emoji: string; activeClass: string }[] = [
  { value: 'ATTENDING', label: '참석', emoji: '⭕', activeClass: 'bg-emerald-500/20 border-emerald-500 text-emerald-400' },
  { value: 'NOT_ATTENDING', label: '불참', emoji: '❌', activeClass: 'bg-gray-500/20 border-gray-500 text-gray-400' },
  { value: 'UNDECIDED', label: '미정', emoji: '❓', activeClass: 'bg-amber-500/20 border-amber-500 text-amber-400' },
]

export default function AttendanceForm({
  sessionId,
  clubMemberId,
  currentStatus,
  currentFrom,
  currentUntil,
  currentNotes,
  onResponded,
}: AttendanceFormProps) {
  const [status, setStatus] = useState<AttendanceStatus>(currentStatus || 'UNDECIDED')
  const [availableFrom, setAvailableFrom] = useState(currentFrom || '')
  const [availableUntil, setAvailableUntil] = useState(currentUntil || '')
  const [notes, setNotes] = useState(currentNotes || '')
  const [saving, setSaving] = useState(false)
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
            <span className="mr-1">{opt.emoji}</span>
            {opt.label}
          </button>
        ))}
      </div>

      {/* 참석 시 시간 선택 */}
      {status === 'ATTENDING' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="att-from" className="block text-xs text-(--text-muted) mb-1">
              참석 가능 시작
            </label>
            <input
              id="att-from"
              type="time"
              value={availableFrom}
              onChange={(e) => setAvailableFrom(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="att-until" className="block text-xs text-(--text-muted) mb-1">
              참석 가능 종료
            </label>
            <input
              id="att-until"
              type="time"
              value={availableUntil}
              onChange={(e) => setAvailableUntil(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      )}

      {/* 메모 */}
      <div>
        <label htmlFor="att-notes" className="block text-xs text-(--text-muted) mb-1">
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
      <button
        type="button"
        onClick={handleSubmit}
        disabled={saving}
        className="w-full px-4 py-2 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold text-sm disabled:opacity-50"
      >
        {saving ? '저장 중...' : currentStatus ? '응답 수정' : '응답 제출'}
      </button>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        message={alert.message}
        type={alert.type}
      />
    </div>
  )
}
