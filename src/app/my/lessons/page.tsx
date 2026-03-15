'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, BookOpen } from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getMyEnrollments, cancelEnrollment } from '@/lib/lessons/actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { ConfirmDialog } from '@/components/common/AlertDialog'
import type { LessonEnrollment, EnrollmentStatus } from '@/lib/lessons/types'

const ENROLLMENT_STATUS_CONFIG: Record<EnrollmentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '대기', variant: 'warning' },
  CONFIRMED: { label: '확정', variant: 'success' },
  WAITLISTED: { label: '대기자', variant: 'info' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

export default function MyLessonsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [enrollments, setEnrollments] = useState<LessonEnrollment[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [cancelTarget, setCancelTarget] = useState<LessonEnrollment | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/auth/login')
      return
    }
    loadEnrollments()
  }, [authLoading, user])

  const loadEnrollments = async () => {
    const { data, error } = await getMyEnrollments()
    if (error) {
      setAlert({ isOpen: true, message: error, type: 'error' })
    }
    setEnrollments(data)
    setLoading(false)
  }

  const handleCancel = async () => {
    if (!cancelTarget) return
    const result = await cancelEnrollment(cancelTarget.id)
    setCancelTarget(null)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '수강이 취소되었습니다.', type: 'success' })
    loadEnrollments()
  }

  if (authLoading || loading) {
    return (
      <div style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="max-w-content mx-auto px-6 py-12">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-content mx-auto px-6 py-12">
        <Link
          href="/my/profile"
          className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          마이페이지
        </Link>

        <h1 className="text-xl font-display mb-6 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
          내 레슨
        </h1>

        {enrollments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              수강 신청한 레슨이 없습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {enrollments.map((enrollment) => {
              const programData = enrollment.program as unknown as {
                id: string
                title: string
                club_id: string
                coach?: { name: string } | null
              } | null
              const statusConf = ENROLLMENT_STATUS_CONFIG[enrollment.status]

              return (
                <div
                  key={enrollment.id}
                  className="rounded-xl p-4"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {programData ? (
                        <Link
                          href={`/clubs/${programData.club_id}/lessons/${programData.id}`}
                          className="font-medium text-sm hover:underline"
                          style={{ color: 'var(--text-primary)' }}
                        >
                          {programData.title}
                        </Link>
                      ) : (
                        <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          알 수 없는 프로그램
                        </span>
                      )}
                      {programData?.coach && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          코치: {programData.coach.name}
                        </p>
                      )}
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        신청일: {new Date(enrollment.enrolled_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                      {enrollment.status !== 'CANCELLED' && (
                        <button
                          onClick={() => setCancelTarget(enrollment)}
                          className="text-xs hover:underline"
                          style={{ color: 'var(--color-danger)' }}
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title="오류"
        message={alert.message}
        type={alert.type}
      />
      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        title="수강 취소"
        message="수강을 취소하시겠습니까?"
        type="warning"
      />
    </div>
  )
}
