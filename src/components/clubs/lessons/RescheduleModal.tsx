'use client'

import { useState } from 'react'
import { Modal } from '@/components/common/Modal'
import { AlertDialog } from '@/components/common/AlertDialog'
import { requestReschedule } from '@/lib/lessons/reschedule'
import type { LessonSession, RescheduleRequestInput } from '@/lib/lessons/types'

interface RescheduleModalProps {
  isOpen: boolean
  onClose: () => void
  session: LessonSession
  enrollmentId?: string
  onSuccess: () => void
}

export function RescheduleModal({ isOpen, onClose, session, enrollmentId, onSuccess }: RescheduleModalProps) {
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!date || !startTime || !endTime) {
      setAlert({ isOpen: true, message: '날짜와 시간을 모두 입력해주세요.', type: 'error' })
      return
    }

    if (endTime <= startTime) {
      setAlert({ isOpen: true, message: '종료 시간은 시작 시간보다 뒤여야 합니다.', type: 'error' })
      return
    }

    setSubmitting(true)
    const input: RescheduleRequestInput = {
      enrollment_id: enrollmentId,
      requested_date: date,
      requested_start_time: startTime,
      requested_end_time: endTime,
      reason: reason.trim() || undefined,
    }

    const result = await requestReschedule(session.id, input)
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    onSuccess()
    resetForm()
    onClose()
  }

  const resetForm = () => {
    setDate('')
    setStartTime('')
    setEndTime('')
    setReason('')
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="일정 변경 요청"
        description={`${session.session_date} ${session.start_time.slice(0, 5)}~${session.end_time.slice(0, 5)}`}
        size="md"
      >
          <Modal.Body>
            <form id="reschedule-form" onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* 변경 희망 날짜 */}
              <div>
                <label
                  htmlFor="reschedule-date"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  변경 희망 날짜 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="reschedule-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>

              {/* 시간 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="reschedule-start"
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    시작 시간 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="reschedule-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="reschedule-end"
                    className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    종료 시간 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="reschedule-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>
              </div>

              {/* 사유 */}
              <div>
                <label
                  htmlFor="reschedule-reason"
                  className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}
                >
                  사유 <span className="font-normal text-xs" style={{ color: 'var(--text-muted)' }}>(선택)</span>
                </label>
                <textarea
                  id="reschedule-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  maxLength={300}
                  placeholder="변경 요청 사유를 입력해주세요."
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>
            </form>
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
              type="submit"
              form="reschedule-form"
              disabled={submitting}
              className="flex-1 btn-primary btn-sm"
            >
              {submitting ? '처리 중...' : '요청하기'}
            </button>
          </Modal.Footer>
      </Modal>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title="오류"
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}
