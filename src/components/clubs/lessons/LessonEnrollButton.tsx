'use client'

import { useState } from 'react'
import { enrollLesson, cancelEnrollment } from '@/lib/lessons/actions'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import type { EnrollmentStatus } from '@/lib/lessons/types'

interface LessonEnrollButtonProps {
  programId: string
  programStatus: string
  enrollmentId?: string
  enrollmentStatus?: EnrollmentStatus
  isFull: boolean
  onResult: (result: { error: string | null; message?: string }) => void
}

export function LessonEnrollButton({
  programId,
  programStatus,
  enrollmentId,
  enrollmentStatus,
  isFull,
  onResult,
}: LessonEnrollButtonProps) {
  const [loading, setLoading] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  // 모집 중이 아니면 비활성화
  if (programStatus !== 'OPEN') {
    return (
      <button
        disabled
        className="w-full py-3 rounded-xl text-sm font-medium opacity-50 cursor-not-allowed"
        style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-muted)' }}
      >
        {programStatus === 'CLOSED' ? '모집 마감' : '신청 불가'}
      </button>
    )
  }

  // 이미 수강 중 → 취소 버튼
  if (enrollmentId && enrollmentStatus && enrollmentStatus !== 'CANCELLED') {
    const statusLabel = enrollmentStatus === 'CONFIRMED' ? '수강 확정'
      : enrollmentStatus === 'WAITLISTED' ? '대기 중'
      : '신청 대기'

    return (
      <>
        <div className="space-y-2">
          <div
            className="w-full py-3 rounded-xl text-sm font-medium text-center"
            style={{
              backgroundColor: enrollmentStatus === 'CONFIRMED'
                ? 'var(--color-success-subtle)'
                : 'var(--color-warning-subtle)',
              color: enrollmentStatus === 'CONFIRMED'
                ? 'var(--color-success)'
                : 'var(--color-warning)',
            }}
          >
            {statusLabel}
          </div>
          <button
            onClick={() => setConfirmCancel(true)}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-sm font-medium"
            style={{
              backgroundColor: 'var(--bg-card-hover)',
              color: 'var(--color-danger)',
            }}
          >
            수강 취소
          </button>
        </div>

        <ConfirmDialog
          isOpen={confirmCancel}
          onClose={() => setConfirmCancel(false)}
          onConfirm={async () => {
            setConfirmCancel(false)
            setLoading(true)
            const result = await cancelEnrollment(enrollmentId)
            setLoading(false)
            onResult({
              error: result.error,
              message: result.error ? undefined : '수강이 취소되었습니다.',
            })
          }}
          title="수강 취소"
          message="수강을 취소하시겠습니까?"
          type="warning"
          isLoading={loading}
        />
      </>
    )
  }

  // 신청 버튼
  const handleEnroll = async () => {
    setLoading(true)
    const result = await enrollLesson(programId)
    setLoading(false)

    if (result.error) {
      onResult({ error: result.error })
      return
    }

    const message = result.data?.status === 'WAITLISTED'
      ? '대기자로 등록되었습니다.'
      : '수강 신청이 확정되었습니다.'
    onResult({ error: null, message })
  }

  return (
    <button
      onClick={handleEnroll}
      disabled={loading}
      className="w-full btn-primary py-3 rounded-xl text-sm font-medium"
    >
      {loading ? '처리 중...' : isFull ? '대기 신청하기' : '수강 신청하기'}
    </button>
  )
}
