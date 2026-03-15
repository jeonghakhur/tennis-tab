'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, User, Users, Award, BookOpen, DollarSign } from 'lucide-react'
import { getLessonProgramDetail } from '@/lib/lessons/actions'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { LessonEnrollButton } from './LessonEnrollButton'
import { LessonSessionList } from './LessonSessionList'
import type { LessonProgram, LessonSession, LessonEnrollment, LessonProgramStatus } from '@/lib/lessons/types'

const STATUS_CONFIG: Record<LessonProgramStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: '준비 중', variant: 'secondary' },
  OPEN: { label: '모집 중', variant: 'success' },
  CLOSED: { label: '마감', variant: 'orange' },
  CANCELLED: { label: '취소', variant: 'danger' },
}

interface LessonProgramDetailProps {
  programId: string
  clubId: string
  /** 현재 사용자의 club_member ID (없으면 비회원) */
  myMemberId?: string
}

export function LessonProgramDetail({ programId, clubId, myMemberId }: LessonProgramDetailProps) {
  const [program, setProgram] = useState<(LessonProgram & { sessions: LessonSession[]; enrollments: LessonEnrollment[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  useEffect(() => {
    loadDetail()
  }, [programId])

  const loadDetail = async () => {
    setLoading(true)
    const { data, error } = await getLessonProgramDetail(programId)
    if (error || !data) {
      setAlert({ isOpen: true, message: error || '프로그램을 찾을 수 없습니다.', type: 'error' })
      setLoading(false)
      return
    }
    setProgram(data)
    setLoading(false)
  }

  // 내 수강 신청 정보
  const myEnrollment = program?.enrollments.find((e) => e.member_id === myMemberId)
  const enrollCount = program?._enrollment_count || 0
  const isFull = enrollCount >= (program?.max_participants || 0)

  if (loading) {
    return (
      <div className="max-w-content mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-8 w-64 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          <div className="h-48 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        </div>
      </div>
    )
  }

  if (!program) {
    return (
      <div className="max-w-content mx-auto px-6 py-12 text-center">
        <p style={{ color: 'var(--text-muted)' }}>프로그램을 찾을 수 없습니다.</p>
        <Link
          href={`/clubs/${clubId}?tab=lessons`}
          className="text-sm mt-4 inline-block hover:underline"
          style={{ color: 'var(--accent-color)' }}
        >
          레슨 목록으로 돌아가기
        </Link>
      </div>
    )
  }

  const statusConf = STATUS_CONFIG[program.status]

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-content mx-auto px-6 py-12">
        {/* 뒤로가기 */}
        <Link
          href={`/clubs/${clubId}?tab=lessons`}
          className="inline-flex items-center gap-1.5 text-sm mb-6 hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          <ChevronLeft className="w-4 h-4" />
          레슨 목록
        </Link>

        {/* 제목 + 상태 */}
        <div className="flex items-center gap-3 mb-6">
          <h1 className="text-xl font-display" style={{ color: 'var(--text-primary)' }}>
            {program.title}
          </h1>
          <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
        </div>

        {/* 코치 정보 */}
        {program.coach && (
          <section
            className="glass-card rounded-xl p-4 mb-4"
            aria-labelledby="coach-section-title"
          >
            <h2
              id="coach-section-title"
              className="text-sm font-medium mb-3 flex items-center gap-1.5"
              style={{ color: 'var(--text-primary)' }}
            >
              <User className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
              코치 정보
            </h2>
            <div className="flex items-start gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'var(--bg-card-hover)' }}
              >
                {program.coach.profile_image_url ? (
                  <img
                    src={program.coach.profile_image_url}
                    alt={`${program.coach.name} 코치 프로필`}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6" style={{ color: 'var(--text-muted)' }} />
                )}
              </div>
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                  {program.coach.name} 코치
                </p>
                {program.coach.experience && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    경력: {program.coach.experience}
                  </p>
                )}
                {program.coach.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {program.coach.certifications.map((cert) => (
                      <span
                        key={cert}
                        className="text-xs px-1.5 py-0.5 rounded flex items-center gap-0.5"
                        style={{
                          backgroundColor: 'var(--bg-card-hover)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <Award className="w-3 h-3" />
                        {cert}
                      </span>
                    ))}
                  </div>
                )}
                {program.coach.bio && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                    {program.coach.bio}
                  </p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 프로그램 정보 */}
        <section
          className="glass-card rounded-xl p-4 mb-4"
          aria-labelledby="program-info-title"
        >
          <h2
            id="program-info-title"
            className="text-sm font-medium mb-3 flex items-center gap-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            <BookOpen className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
            프로그램 정보
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-4 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>대상</span>
              <span style={{ color: 'var(--text-primary)' }}>{program.target_level}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>정원</span>
              <span style={{ color: 'var(--text-primary)' }}>
                {enrollCount}/{program.max_participants}명
              </span>
            </div>
            {program.description && (
              <p className="text-sm whitespace-pre-wrap pt-2 border-t" style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-color)',
              }}>
                {program.description}
              </p>
            )}
          </div>
        </section>

        {/* 수강료 */}
        {program.fee_description && (
          <section
            className="glass-card rounded-xl p-4 mb-4"
            aria-labelledby="fee-section-title"
          >
            <h2
              id="fee-section-title"
              className="text-sm font-medium mb-3 flex items-center gap-1.5"
              style={{ color: 'var(--text-primary)' }}
            >
              <DollarSign className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
              수강료 안내
            </h2>
            <p
              className="text-sm whitespace-pre-wrap"
              style={{ color: 'var(--text-secondary)' }}
            >
              {program.fee_description}
            </p>
          </section>
        )}

        {/* 레슨 일정 */}
        <section
          className="glass-card rounded-xl p-4 mb-6"
          aria-labelledby="schedule-section-title"
        >
          <h2
            id="schedule-section-title"
            className="text-sm font-medium mb-3 flex items-center gap-1.5"
            style={{ color: 'var(--text-primary)' }}
          >
            <Users className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
            레슨 일정
          </h2>
          <LessonSessionList sessions={program.sessions} />
        </section>

        {/* 수강 신청 버튼 */}
        {myMemberId && (
          <LessonEnrollButton
            programId={programId}
            programStatus={program.status}
            enrollmentId={myEnrollment?.id}
            enrollmentStatus={myEnrollment?.status}
            isFull={isFull}
            onResult={({ error, message }) => {
              if (error) {
                setAlert({ isOpen: true, message: error, type: 'error' })
              } else if (message) {
                setToast({ isOpen: true, message, type: 'success' })
                loadDetail()
              }
            }}
          />
        )}

        <Toast
          isOpen={toast.isOpen}
          onClose={() => setToast({ ...toast, isOpen: false })}
          message={toast.message}
          type={toast.type}
        />
        <AlertDialog
          isOpen={alert.isOpen}
          onClose={() => setAlert({ ...alert, isOpen: false })}
          title="알림"
          message={alert.message}
          type={alert.type}
        />
      </div>
    </div>
  )
}
