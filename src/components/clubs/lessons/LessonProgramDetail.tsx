'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ChevronLeft, Users } from 'lucide-react'
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
        {program.status === 'OPEN' && program.coach ? (
          <SlotBookingSection
            programId={programId}
            coachId={program.coach_id}
            coachName={program.coach.name}
          />
        ) : program.status !== 'OPEN' && (
          <div
            className="rounded-xl p-6 mb-4 text-center"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              지금 신청 가능한 레슨은 없습니다.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              현재 프로그램 상태: <span style={{ color: 'var(--text-secondary)' }}>{statusConf.label}</span>
            </p>
          </div>
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
