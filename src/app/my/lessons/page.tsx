'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar, Clock, ChevronLeft, User, CreditCard, RefreshCw,
  CheckCircle2, AlertCircle, Loader2, ChevronDown, ChevronUp, BookOpen
} from 'lucide-react'
import { useAuth } from '@/components/AuthProvider'
import { getMyLessonDetails, type MyLessonDetail } from '@/lib/lessons/actions'
import { getMyRescheduleRequests, requestReschedule } from '@/lib/lessons/reschedule'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { AlertDialog, Toast } from '@/components/common/AlertDialog'
import {
  PAYMENT_METHOD_LABEL,
  type LessonSession,
  type EnrollmentStatus,
} from '@/lib/lessons/types'
import type { RescheduleRequestWithSession } from '@/lib/lessons/reschedule'

// ── 상태 config ───────────────────────────────────────────────────────────────
const ENROLLMENT_STATUS_CONFIG: Record<EnrollmentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '대기', variant: 'warning' },
  CONFIRMED: { label: '확정', variant: 'success' },
  WAITLISTED: { label: '대기자', variant: 'info' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

const RESCHEDULE_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING:  { label: '검토 중', variant: 'warning' },
  APPROVED: { label: '수락됨', variant: 'success' },
  REJECTED: { label: '거절됨', variant: 'danger' },
}

// ── 일정 조정 모달 ─────────────────────────────────────────────────────────────
interface RescheduleModalProps {
  isOpen: boolean
  session: LessonSession | null
  enrollmentId: string
  onClose: () => void
  onSuccess: () => void
}

function RescheduleModal({ isOpen, session, enrollmentId, onClose, onSuccess }: RescheduleModalProps) {
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const dateRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setDate(''); setStartTime(''); setEndTime(''); setReason('')
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) {
      setAlert({ isOpen: true, message: '변경 날짜를 선택해주세요.', type: 'error' }); return
    }
    if (!startTime || !endTime) {
      setAlert({ isOpen: true, message: '변경 시간을 입력해주세요.', type: 'error' }); return
    }
    if (!session) return

    setSubmitting(true)
    const result = await requestReschedule(session.id, {
      enrollment_id: enrollmentId,
      requested_date: date,
      requested_start_time: startTime + ':00',
      requested_end_time: endTime + ':00',
      reason: reason.trim() || undefined,
    })
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' }); return
    }
    onSuccess()
    onClose()
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-input)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="일정 조정 요청" size="sm">
        <form onSubmit={handleSubmit} noValidate>
          <Modal.Body>
            {session && (
              <div className="mb-4 p-3 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-card-hover)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>원래 일정</p>
                <p style={{ color: 'var(--text-primary)' }}>
                  {session.session_date} · {session.start_time.slice(0, 5)} ~ {session.end_time.slice(0, 5)}
                </p>
                {session.location && (
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{session.location}</p>
                )}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label htmlFor="rs-date" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  변경 날짜 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  ref={dateRef}
                  id="rs-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inputStyle}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rs-start" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    시작 시간 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="rs-start"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label htmlFor="rs-end" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    종료 시간 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="rs-end"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="rs-reason" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  사유
                </label>
                <textarea
                  id="rs-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="우천, 개인 사정, 코치 요청 등 사유를 입력해주세요. (선택)"
                  rows={3}
                  maxLength={300}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={inputStyle}
                />
              </div>
            </div>
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
              disabled={submitting}
              className="flex-1 btn-primary btn-sm"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '요청하기'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => {
          setAlert({ ...alert, isOpen: false })
          dateRef.current?.focus()
        }}
        title="오류"
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}

// ── 결제 현황 섹션 ─────────────────────────────────────────────────────────────
function PaymentSection({ detail }: { detail: MyLessonDetail }) {
  const [expanded, setExpanded] = useState(false)
  const { payments } = detail

  if (payments.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>결제 기록이 없습니다.</p>
    )
  }

  const shown = expanded ? payments : payments.slice(0, 3)

  return (
    <div>
      <div className="space-y-2">
        {shown.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between text-sm px-3 py-2.5 rounded-lg"
            style={{ backgroundColor: 'var(--bg-card-hover)' }}
          >
            <div>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{p.period}</span>
              <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                {PAYMENT_METHOD_LABEL[p.method]} · {p.paid_at}
              </span>
              {p.note && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.note}</p>
              )}
            </div>
            <span className="font-semibold shrink-0 ml-2" style={{ color: 'var(--accent-color)' }}>
              {p.amount.toLocaleString()}원
            </span>
          </div>
        ))}
      </div>
      {payments.length > 3 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs"
          style={{ color: 'var(--text-muted)' }}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? '접기' : `${payments.length - 3}개 더 보기`}
        </button>
      )}
    </div>
  )
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────────
export default function MyLessonsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [details, setDetails] = useState<MyLessonDetail[]>([])
  const [rescheduleRequests, setRescheduleRequests] = useState<RescheduleRequestWithSession[]>([])
  const [loading, setLoading] = useState(true)

  const [rescheduleModal, setRescheduleModal] = useState<{
    isOpen: boolean
    session: LessonSession | null
    enrollmentId: string
  }>({ isOpen: false, session: null, enrollmentId: '' })

  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/auth/login'); return }
    loadData()
  }, [authLoading, user])

  const loadData = async () => {
    setLoading(true)
    const [detailsResult, requestsResult] = await Promise.all([
      getMyLessonDetails(),
      getMyRescheduleRequests(),
    ])
    if (detailsResult.error) {
      setAlert({ isOpen: true, message: detailsResult.error, type: 'error' })
    } else {
      setDetails(detailsResult.data)
    }
    setRescheduleRequests(requestsResult.data)
    setLoading(false)
  }

  const openReschedule = (session: LessonSession, enrollmentId: string) => {
    setRescheduleModal({ isOpen: true, session, enrollmentId })
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-color)' }} />
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--bg-card-hover)' }}
            aria-label="뒤로 가기"
          >
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-primary)' }} />
          </button>
          <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <BookOpen className="w-5 h-5" style={{ color: 'var(--accent-color)' }} />
            나의 레슨
          </h1>
        </div>

        {/* 수강 없음 */}
        {details.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>진행 중인 레슨이 없습니다.</p>
            <button
              type="button"
              onClick={() => router.push('/lessons')}
              className="mt-4 btn-primary btn-sm"
            >
              레슨 신청하기
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {details.map((detail) => {
              const { enrollment } = detail
              const program = enrollment.program
              const coach = program?.coach

              return (
                <div
                  key={enrollment.id}
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid var(--border-color)' }}
                >
                  {/* 프로그램 헤더 */}
                  <div className="px-4 py-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        {coach?.profile_image_url ? (
                          <img
                            src={coach.profile_image_url}
                            alt={coach.name}
                            className="w-10 h-10 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'var(--bg-card-hover)' }}
                          >
                            <User className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                            {program?.title || '레슨 프로그램'}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            코치 {coach?.name || '-'}
                          </p>
                        </div>
                      </div>
                      <Badge variant={ENROLLMENT_STATUS_CONFIG[enrollment.status].variant}>
                        {ENROLLMENT_STATUS_CONFIG[enrollment.status].label}
                      </Badge>
                    </div>
                  </div>

                  {/* 통계 바 */}
                  <div
                    className="grid grid-cols-3"
                    style={{
                      borderTop: '1px solid var(--border-color)',
                      borderBottom: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                    }}
                  >
                    <div className="px-3 py-3 text-center" style={{ borderRight: '1px solid var(--border-color)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>총 레슨</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        {detail.totalAttendances}<span className="text-xs font-normal ml-0.5">회</span>
                      </p>
                    </div>
                    <div className="px-3 py-3 text-center" style={{ borderRight: '1px solid var(--border-color)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>이번 달</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--accent-color)' }}>
                        {detail.thisMonthAttendances}<span className="text-xs font-normal ml-0.5">회</span>
                      </p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>결제</p>
                      <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                        {detail.payments.length}<span className="text-xs font-normal ml-0.5">건</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-4 space-y-5" style={{ backgroundColor: 'var(--bg-card)' }}>

                    {/* 다가오는 레슨 */}
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"
                        style={{ color: 'var(--text-muted)' }}>
                        <Calendar className="w-3.5 h-3.5" />
                        다가오는 레슨
                      </h3>
                      {detail.upcomingSessions.length === 0 ? (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>예정된 레슨이 없습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          {detail.upcomingSessions.map((session) => (
                            <div
                              key={session.id}
                              className="flex items-center justify-between px-3 py-2.5 rounded-lg"
                              style={{ backgroundColor: 'var(--bg-card-hover)' }}
                            >
                              <div>
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {session.session_date}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                  <Clock className="w-3 h-3 inline-block mr-0.5 -mt-0.5" />
                                  {session.start_time.slice(0, 5)} ~ {session.end_time.slice(0, 5)}
                                  {session.location && ` · ${session.location}`}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => openReschedule(session, enrollment.id)}
                                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg shrink-0"
                                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                              >
                                <RefreshCw className="w-3 h-3" />
                                일정 조정
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {/* 레슨비 입금 현황 */}
                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5"
                        style={{ color: 'var(--text-muted)' }}>
                        <CreditCard className="w-3.5 h-3.5" />
                        레슨비 입금 현황
                      </h3>
                      <PaymentSection detail={detail} />
                    </section>

                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 일정 조정 요청 내역 */}
        {rescheduleRequests.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <RefreshCw className="w-4 h-4" />
              일정 조정 요청 내역
            </h2>
            <div className="space-y-2">
              {rescheduleRequests.map((req) => {
                const statusConf = RESCHEDULE_STATUS_CONFIG[req.status]
                return (
                  <div
                    key={req.id}
                    className="px-4 py-3 rounded-xl"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          원래: {req.original_date} {req.original_start_time.slice(0, 5)}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          변경 요청: {req.requested_date} {req.requested_start_time.slice(0, 5)}
                        </p>
                        {req.reason && (
                          <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                            사유: {req.reason}
                          </p>
                        )}
                      </div>
                      {statusConf && (
                        <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                      )}
                    </div>
                    {req.status === 'APPROVED' && (
                      <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--color-success)' }}>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        일정이 변경되었습니다.
                      </div>
                    )}
                    {req.status === 'REJECTED' && (
                      <div className="mt-2 flex items-center gap-1 text-xs" style={{ color: 'var(--color-danger)' }}>
                        <AlertCircle className="w-3.5 h-3.5" />
                        거절되었습니다. 원래 일정으로 진행됩니다.
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </div>

      {/* 일정 조정 모달 */}
      <RescheduleModal
        isOpen={rescheduleModal.isOpen}
        session={rescheduleModal.session}
        enrollmentId={rescheduleModal.enrollmentId}
        onClose={() => setRescheduleModal({ isOpen: false, session: null, enrollmentId: '' })}
        onSuccess={() => {
          setToast({ isOpen: true, message: '일정 조정 요청이 접수되었습니다.', type: 'success' })
          loadData()
        }}
      />

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
    </div>
  )
}
