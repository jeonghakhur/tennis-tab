'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, User, Users, Award, BookOpen, DollarSign } from 'lucide-react'
import { getLessonProgramDetail } from '@/lib/lessons/actions'
import { AlertDialog } from '@/components/common/AlertDialog'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { LessonSessionList } from './LessonSessionList'
import { LessonInquiryForm } from './LessonInquiryForm'
import { SlotBookingSection } from './SlotBookingSection'
import type { LessonProgram, LessonSession, LessonProgramStatus } from '@/lib/lessons/types'

const STATUS_CONFIG: Record<LessonProgramStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: '준비 중', variant: 'secondary' },
  OPEN: { label: '모집 중', variant: 'success' },
  CLOSED: { label: '마감', variant: 'orange' },
  CANCELLED: { label: '취소', variant: 'danger' },
}

interface LessonProgramDetailProps {
  programId: string
}

export function LessonProgramDetail({ programId }: LessonProgramDetailProps) {
  const [program, setProgram] = useState<(LessonProgram & { sessions: LessonSession[] }) | null>(null)
  const [loading, setLoading] = useState(true)
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

  const enrollCount = program?._enrollment_count || 0

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
          href="/lessons"
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
          href="/lessons"
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
        {(program.fee_weekday_1 || program.fee_weekday_2 || program.fee_weekend_1 || program.fee_weekend_2 || program.fee_mixed_2) && (
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
              <span className="font-normal text-xs ml-1" style={{ color: 'var(--text-muted)' }}>
                (레슨 {program.session_duration_minutes}분 · 1:1)
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: 'fee_weekday_1', label: '주중 1회', value: program.fee_weekday_1 },
                { key: 'fee_weekday_2', label: '주중 2회', value: program.fee_weekday_2 },
                { key: 'fee_weekend_1', label: '주말 1회', value: program.fee_weekend_1 },
                { key: 'fee_weekend_2', label: '주말 2회', value: program.fee_weekend_2 },
                { key: 'fee_mixed_2', label: '혼합 2회', value: program.fee_mixed_2 },
              ] as const).filter((item) => item.value !== null).map(({ key, label, value }) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }}
                >
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {value!.toLocaleString()}원/월
                  </span>
                </div>
              ))}
            </div>
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

        {/* 슬롯 기반 레슨 신청 (비회원 포함) */}
        {program.coach && (
          <SlotBookingSection
            programId={programId}
            coachId={program.coach_id}
            coachName={program.coach.name}
          />
        )}

        {/* 레슨 문의하기 — 슬롯 선택 포함, 비회원도 가능 */}
        <LessonInquiryForm programId={programId} availableSessions={program.sessions} />

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
