'use client'

import { useState, useEffect } from 'react'
import { Check, X, Clock } from 'lucide-react'
import { getSessionAttendances, recordAttendance } from '@/lib/lessons/actions'
import { Toast } from '@/components/common/AlertDialog'
import type { LessonAttendance, AttendanceLessonStatus, LessonEnrollment } from '@/lib/lessons/types'

const STATUS_OPTIONS: { value: AttendanceLessonStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'PRESENT', label: '출석', icon: <Check className="w-3.5 h-3.5" />, color: 'var(--color-success)' },
  { value: 'LATE', label: '지각', icon: <Clock className="w-3.5 h-3.5" />, color: 'var(--color-warning)' },
  { value: 'ABSENT', label: '결석', icon: <X className="w-3.5 h-3.5" />, color: 'var(--color-danger)' },
]

interface AttendanceSheetProps {
  sessionId: string
  enrollments: LessonEnrollment[]
}

export function AttendanceSheet({ sessionId, enrollments }: AttendanceSheetProps) {
  const [attendances, setAttendances] = useState<LessonAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' }>({ isOpen: false, message: '', type: 'success' })

  useEffect(() => {
    loadAttendances()
  }, [sessionId])

  const loadAttendances = async () => {
    const { data } = await getSessionAttendances(sessionId)
    setAttendances(data)
    setLoading(false)
  }

  const getAttendanceStatus = (enrollmentId: string): AttendanceLessonStatus | null => {
    const record = attendances.find((a) => a.enrollment_id === enrollmentId)
    return record?.status || null
  }

  const handleRecord = async (enrollmentId: string, status: AttendanceLessonStatus) => {
    const result = await recordAttendance(sessionId, enrollmentId, status)
    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    // 로컬 업데이트
    setAttendances((prev) => {
      const existing = prev.find((a) => a.enrollment_id === enrollmentId)
      if (existing) {
        return prev.map((a) => a.enrollment_id === enrollmentId ? { ...a, status } : a)
      }
      return [...prev, {
        id: crypto.randomUUID(),
        session_id: sessionId,
        enrollment_id: enrollmentId,
        status,
        recorded_at: new Date().toISOString(),
      }]
    })
  }

  // CONFIRMED 수강생만 출석 대상
  const confirmedEnrollments = enrollments.filter((e) => e.status === 'CONFIRMED')

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        ))}
      </div>
    )
  }

  if (confirmedEnrollments.length === 0) {
    return (
      <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        확정된 수강생이 없습니다.
      </p>
    )
  }

  return (
    <div>
      <div className="space-y-2">
        {confirmedEnrollments.map((enrollment) => {
          const currentStatus = getAttendanceStatus(enrollment.id)
          const memberName = enrollment.member?.name || '알 수 없음'

          return (
            <div
              key={enrollment.id}
              className="flex items-center justify-between py-2.5 px-3 rounded-lg"
              style={{ backgroundColor: 'var(--bg-card-hover)' }}
            >
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {memberName}
              </span>
              <div className="flex gap-1" role="radiogroup" aria-label={`${memberName} 출석 체크`}>
                {STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleRecord(enrollment.id, opt.value)}
                    className="flex items-center gap-0.5 text-xs px-2 py-1 rounded-md transition-colors"
                    style={{
                      backgroundColor: currentStatus === opt.value ? opt.color : 'transparent',
                      color: currentStatus === opt.value ? 'white' : 'var(--text-muted)',
                      border: currentStatus === opt.value ? 'none' : '1px solid var(--border-color)',
                    }}
                    role="radio"
                    aria-checked={currentStatus === opt.value}
                    aria-label={opt.label}
                  >
                    {opt.icon}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </div>
  )
}
