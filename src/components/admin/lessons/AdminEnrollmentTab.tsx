'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CreditCard,
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Trash2,
  Check,
  CheckSquare,
} from 'lucide-react'
import {
  getAdminEnrollments,
  updateEnrollmentStatus,
  getCoachSessionsForMonth,
  getSessionAttendances,
  recordAttendance,
  createLessonPayment,
  getEnrollmentPayments,
  deleteLessonPayment,
} from '@/lib/lessons/actions'
import {
  getAdminRescheduleRequests,
  approveReschedule,
  rejectReschedule,
  type AdminRescheduleRequest,
} from '@/lib/lessons/reschedule'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import type {
  LessonProgram,
  LessonSession,
  LessonAttendance,
  LessonPayment,
  EnrollmentStatus,
  AttendanceLessonStatus,
  PaymentMethod,
} from '@/lib/lessons/types'
import { PAYMENT_METHOD_LABEL } from '@/lib/lessons/types'

// ── 타입 ─────────────────────────────────────────────────────────────────────

type CalendarSession = LessonSession & { program_title: string }
type EnrollmentWithUser = {
  id: string
  program_id: string
  user_id: string
  user_name: string
  user_email: string | null
  status: EnrollmentStatus
  enrolled_at: string
}

// ── 상태 config ───────────────────────────────────────────────────────────────

const ENROLLMENT_STATUS_CONFIG: Record<EnrollmentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:    { label: '대기',   variant: 'warning' },
  CONFIRMED:  { label: '확정',   variant: 'success' },
  WAITLISTED: { label: '대기자', variant: 'info' },
  CANCELLED:  { label: '취소',   variant: 'secondary' },
}

const ATTENDANCE_CONFIG: Record<AttendanceLessonStatus, { label: string; variant: BadgeVariant }> = {
  PRESENT: { label: '출석', variant: 'success' },
  ABSENT:  { label: '결석', variant: 'danger' },
  LATE:    { label: '지각', variant: 'warning' },
}

const RESCHEDULE_STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING:  { label: '검토중', variant: 'warning' },
  APPROVED: { label: '승인',   variant: 'success' },
  REJECTED: { label: '거절',   variant: 'secondary' },
}

// 세션 상태별 색상 (CSS 변수 기반)
const SESSION_COLOR: Record<string, { bg: string; text: string }> = {
  SCHEDULED: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  COMPLETED: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  CANCELLED: { bg: 'rgba(107,114,128,0.1)', text: '#9ca3af' },
}

// 프로그램 약칭: "김동하 코치 주중 1회 레슨" → "주1"
function shortTitle(title: string): string {
  const type = title.includes('주중') ? '주' : title.includes('주말') ? '말' : '기'
  const count = title.includes('1회') ? '1' : title.includes('2회') ? '2' : ''
  return type + count
}

const DAYS_KO = ['월', '화', '수', '목', '금', '토', '일']
const todayStr = new Date().toISOString().slice(0, 10)
const thisMonthStr = todayStr.slice(0, 7)
const EMPTY_PAYMENT = {
  amount: '',
  paid_at: todayStr,
  method: 'BANK_TRANSFER' as PaymentMethod,
  period: thisMonthStr,
  note: '',
}

type SubTab = 'calendar' | 'payments' | 'reschedule'
const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'calendar',   label: '달력',    icon: Calendar },
  { key: 'payments',   label: '결제',    icon: CreditCard },
  { key: 'reschedule', label: '일정변경', icon: CheckSquare },
]

interface Props {
  programs: LessonProgram[]
  programsLoading: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminEnrollmentTab({ programs, programsLoading }: Props) {
  // 코치 그룹핑
  const coaches = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>()
    programs.forEach((p) => {
      if (p.coach_id && p.coach?.name && !map.has(p.coach_id)) {
        map.set(p.coach_id, { id: p.coach_id, name: p.coach.name })
      }
    })
    return Array.from(map.values())
  }, [programs])

  const [selectedCoachId, setSelectedCoachId] = useState('')
  const [subTab, setSubTab] = useState<SubTab>('calendar')

  // 달력
  const [currentYear, setCurrentYear]   = useState(() => new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1)
  const [calendarSessions, setCalendarSessions] = useState<CalendarSession[]>([])
  const [calendarLoading, setCalendarLoading]   = useState(false)
  const [selectedSession, setSelectedSession]   = useState<CalendarSession | null>(null)

  // 세션 상세 (수강생 + 출석)
  const [sessionEnrollments, setSessionEnrollments]     = useState<EnrollmentWithUser[]>([])
  const [sessionAttendances, setSessionAttendances]     = useState<LessonAttendance[]>([])
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false)
  const [statusTarget, setStatusTarget] = useState<{
    enrollment: EnrollmentWithUser
    next: EnrollmentStatus
  } | null>(null)

  // 결제
  const [paymentProgramId, setPaymentProgramId] = useState('')
  const [paymentEnrollId, setPaymentEnrollId]   = useState('')
  const [allEnrollments, setAllEnrollments]     = useState<EnrollmentWithUser[]>([])
  const [payments, setPayments]                 = useState<LessonPayment[]>([])
  const [paymentsLoading, setPaymentsLoading]   = useState(false)
  const [paymentFormOpen, setPaymentFormOpen]   = useState(false)
  const [paymentForm, setPaymentForm]           = useState(EMPTY_PAYMENT)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<LessonPayment | null>(null)
  const [paymentSubmitting, setPaymentSubmitting]     = useState(false)

  // 일정변경
  const [rescheduleRequests, setRescheduleRequests] = useState<AdminRescheduleRequest[]>([])
  const [rescheduleLoading, setRescheduleLoading]   = useState(false)
  const [rescheduleFilter, setRescheduleFilter]     = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [rescheduleActionTarget, setRescheduleActionTarget] = useState<{
    request: AdminRescheduleRequest
    action: 'approve' | 'reject'
  } | null>(null)

  // 공통
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const showToast = (msg: string) => setToast({ isOpen: true, message: msg, type: 'success' })
  const showError = (msg: string) => setAlert({ isOpen: true, message: msg, type: 'error' })

  // ── 코치 자동 선택 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (coaches.length > 0 && !selectedCoachId) setSelectedCoachId(coaches[0].id)
  }, [coaches])

  // ── 선택된 코치의 프로그램 IDs ───────────────────────────────────────────────
  const coachPrograms = useMemo(
    () => programs.filter((p) => p.coach_id === selectedCoachId),
    [programs, selectedCoachId],
  )
  const coachProgramIds = useMemo(() => coachPrograms.map((p) => p.id), [coachPrograms])

  // ── 달력 세션 로드 ──────────────────────────────────────────────────────────
  const loadCalendarSessions = useCallback(async () => {
    if (!coachProgramIds.length) return
    setCalendarLoading(true)
    const { data } = await getCoachSessionsForMonth(coachProgramIds, currentYear, currentMonth)
    setCalendarSessions(data)
    setCalendarLoading(false)
  }, [coachProgramIds, currentYear, currentMonth])

  useEffect(() => {
    if (selectedCoachId && subTab === 'calendar') {
      loadCalendarSessions()
      setSelectedSession(null)
    }
  }, [selectedCoachId, currentYear, currentMonth, subTab])

  // ── 세션 클릭 시 상세 로드 ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSession) {
      setSessionEnrollments([])
      setSessionAttendances([])
      return
    }
    setSessionDetailLoading(true)
    Promise.all([
      getAdminEnrollments(selectedSession.program_id),
      getSessionAttendances(selectedSession.id),
    ]).then(([enrollRes, attRes]) => {
      setSessionEnrollments(
        (enrollRes.data as unknown as EnrollmentWithUser[]).filter((e) => e.status !== 'CANCELLED'),
      )
      setSessionAttendances(attRes.data)
      setSessionDetailLoading(false)
    })
  }, [selectedSession])

  // ── 결제탭 프로그램 자동 선택 ───────────────────────────────────────────────
  useEffect(() => {
    if (subTab === 'payments' && coachPrograms.length > 0 && !paymentProgramId) {
      setPaymentProgramId(coachPrograms[0].id)
    }
  }, [subTab, selectedCoachId])

  useEffect(() => {
    if (!paymentProgramId) return
    getAdminEnrollments(paymentProgramId).then(({ data }) =>
      setAllEnrollments((data as unknown as EnrollmentWithUser[]).filter((e) => e.status !== 'CANCELLED')),
    )
  }, [paymentProgramId])

  useEffect(() => {
    if (!paymentEnrollId) { setPayments([]); return }
    setPaymentsLoading(true)
    getEnrollmentPayments(paymentEnrollId).then(({ data }) => {
      setPayments(data)
      setPaymentsLoading(false)
    })
  }, [paymentEnrollId])

  // ── 일정변경 로드 ───────────────────────────────────────────────────────────
  const loadReschedule = useCallback(async () => {
    setRescheduleLoading(true)
    const { data } = await getAdminRescheduleRequests()
    setRescheduleRequests(data)
    setRescheduleLoading(false)
  }, [])

  useEffect(() => {
    if (subTab === 'reschedule') loadReschedule()
  }, [subTab])

  // ── 달력 계산 ───────────────────────────────────────────────────────────────
  const calendarDays = useMemo(() => {
    const firstDow  = new Date(currentYear, currentMonth - 1, 1).getDay() // 0=Sun
    const lastDate  = new Date(currentYear, currentMonth, 0).getDate()
    const leading   = (firstDow + 6) % 7 // Mon-first
    return [
      ...Array<null>(leading).fill(null),
      ...Array.from({ length: lastDate }, (_, i) => {
        const d = i + 1
        return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      }),
    ]
  }, [currentYear, currentMonth])

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, CalendarSession[]>()
    calendarSessions.forEach((s) => {
      map.set(s.session_date, [...(map.get(s.session_date) ?? []), s])
    })
    return map
  }, [calendarSessions])

  // ── 월 이동 ─────────────────────────────────────────────────────────────────
  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentYear((y) => y - 1); setCurrentMonth(12) }
    else setCurrentMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentYear((y) => y + 1); setCurrentMonth(1) }
    else setCurrentMonth((m) => m + 1)
  }

  // ── 출석 기록 ───────────────────────────────────────────────────────────────
  const handleAttendance = async (enrollmentId: string, status: AttendanceLessonStatus) => {
    if (!selectedSession) return
    const result = await recordAttendance(selectedSession.id, enrollmentId, status)
    if (result.error) { showError(result.error); return }
    const { data } = await getSessionAttendances(selectedSession.id)
    setSessionAttendances(data)
  }

  // ── 수강 상태 변경 ──────────────────────────────────────────────────────────
  const handleStatusChange = async () => {
    if (!statusTarget) return
    const result = await updateEnrollmentStatus(statusTarget.enrollment.id, statusTarget.next)
    setStatusTarget(null)
    if (result.error) { showError(result.error); return }
    showToast('수강 상태가 변경되었습니다.')
    if (selectedSession) {
      const { data } = await getAdminEnrollments(selectedSession.program_id)
      setSessionEnrollments(
        (data as unknown as EnrollmentWithUser[]).filter((e) => e.status !== 'CANCELLED'),
      )
    }
  }

  // ── 결제 등록 ───────────────────────────────────────────────────────────────
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentEnrollId) return
    if (!paymentForm.amount || parseInt(paymentForm.amount) <= 0) {
      showError('금액을 올바르게 입력해주세요.'); return
    }
    setPaymentSubmitting(true)
    const result = await createLessonPayment(paymentEnrollId, {
      amount: parseInt(paymentForm.amount),
      paid_at: paymentForm.paid_at,
      method: paymentForm.method,
      period: paymentForm.period,
      note: paymentForm.note || undefined,
    })
    setPaymentSubmitting(false)
    if (result.error) { showError(result.error); return }
    showToast('결제 내역이 등록되었습니다.')
    setPaymentFormOpen(false)
    setPaymentForm(EMPTY_PAYMENT)
    getEnrollmentPayments(paymentEnrollId).then(({ data }) => setPayments(data))
  }

  // ── 결제 삭제 ───────────────────────────────────────────────────────────────
  const handleDeletePayment = async () => {
    if (!deletePaymentTarget) return
    const result = await deleteLessonPayment(deletePaymentTarget.id)
    setDeletePaymentTarget(null)
    if (result.error) { showError(result.error); return }
    showToast('결제 내역이 삭제되었습니다.')
    getEnrollmentPayments(paymentEnrollId).then(({ data }) => setPayments(data))
  }

  // ── 일정변경 처리 ───────────────────────────────────────────────────────────
  const handleRescheduleAction = async () => {
    if (!rescheduleActionTarget) return
    const { request, action } = rescheduleActionTarget
    const result = action === 'approve'
      ? await approveReschedule(request.id)
      : await rejectReschedule(request.id)
    setRescheduleActionTarget(null)
    if (result.error) { showError(result.error); return }
    showToast(action === 'approve' ? '일정 변경을 승인했습니다.' : '일정 변경을 거절했습니다.')
    loadReschedule()
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── 코치 탭 ───────────────────────────────────────────────────────── */}
      {programsLoading ? (
        <div className="flex gap-2 mb-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 w-28 rounded-lg animate-pulse"
              style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          ))}
        </div>
      ) : (
        <div className="flex gap-2 mb-4" role="tablist" aria-label="코치 선택">
          {coaches.map((coach) => {
            const isActive = selectedCoachId === coach.id
            return (
              <button
                key={coach.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  setSelectedCoachId(coach.id)
                  setSelectedSession(null)
                  setPaymentProgramId('')
                  setPaymentEnrollId('')
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{
                  backgroundColor: isActive ? 'var(--accent-color)' : 'var(--bg-card)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-color)'}`,
                }}
              >
                {coach.name}
              </button>
            )
          })}
        </div>
      )}

      {/* ── 서브탭 ──────────────────────────────────────────────────────────── */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-4"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
        role="tablist"
      >
        {SUB_TABS.map((t) => {
          const Icon = t.icon
          const isActive = subTab === t.key
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSubTab(t.key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent',
                color: isActive ? 'var(--accent-color)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── 달력 뷰 ─────────────────────────────────────────────────────────── */}
      {subTab === 'calendar' && (
        <div>
          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={prevMonth}
              aria-label="이전 달"
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {currentYear}년 {currentMonth}월
            </span>
            <button
              onClick={nextMonth}
              aria-label="다음 달"
              className="p-2 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_KO.map((d) => (
              <div
                key={d}
                className="text-center text-xs font-medium py-1"
                style={{ color: 'var(--text-muted)' }}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 달력 그리드 */}
          {calendarLoading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg animate-pulse"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((dateStr, idx) => {
                if (!dateStr) return <div key={`empty-${idx}`} className="h-16" />

                const daySessions = sessionsByDate.get(dateStr) ?? []
                const dayNum      = parseInt(dateStr.slice(-2))
                const isToday     = dateStr === todayStr
                const isSelected  = daySessions.some((s) => s.id === selectedSession?.id)

                return (
                  <div
                    key={dateStr}
                    className="min-h-16 rounded-lg p-1 flex flex-col"
                    style={{
                      backgroundColor: isSelected
                        ? 'color-mix(in srgb, var(--accent-color) 8%, var(--bg-card))'
                        : 'var(--bg-card)',
                      border: `1px solid ${isSelected ? 'var(--accent-color)' : 'var(--border-color)'}`,
                    }}
                  >
                    {/* 날짜 */}
                    <span
                      className="text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full mb-0.5 self-start"
                      style={{
                        backgroundColor: isToday ? 'var(--accent-color)' : 'transparent',
                        color: isToday ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {dayNum}
                    </span>

                    {/* 세션 칩 */}
                    <div className="flex flex-col gap-0.5">
                      {daySessions.map((s) => {
                        const col = SESSION_COLOR[s.status] ?? SESSION_COLOR.SCHEDULED
                        const isSessionSelected = selectedSession?.id === s.id
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSession(isSessionSelected ? null : s)}
                            aria-pressed={isSessionSelected}
                            className="w-full text-left text-xs rounded px-1 py-0.5 truncate leading-tight font-medium transition-colors"
                            style={{
                              backgroundColor: isSessionSelected ? 'var(--accent-color)' : col.bg,
                              color: isSessionSelected ? 'var(--bg-primary)' : col.text,
                            }}
                          >
                            {s.start_time.slice(0, 5)} {shortTitle(s.program_title)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* 범례 */}
          <div className="flex gap-4 mt-3 justify-center flex-wrap">
            {[
              { key: 'SCHEDULED', label: '예정' },
              { key: 'COMPLETED', label: '완료' },
              { key: 'CANCELLED', label: '취소' },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: SESSION_COLOR[key]?.text }}
                />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
              </div>
            ))}
          </div>

          {/* ── 세션 상세 패널 ─────────────────────────────────────────────── */}
          {selectedSession && (
            <div
              className="mt-4 rounded-xl p-4"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--accent-color)',
              }}
            >
              {/* 패널 헤더 */}
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {new Date(selectedSession.session_date + 'T00:00:00').toLocaleDateString('ko-KR', {
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                    &nbsp;
                    {selectedSession.start_time.slice(0, 5)}~{selectedSession.end_time.slice(0, 5)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {selectedSession.program_title}
                    </span>
                    <Badge
                      variant={
                        selectedSession.status === 'COMPLETED'
                          ? 'success'
                          : selectedSession.status === 'CANCELLED'
                          ? 'secondary'
                          : 'info'
                      }
                    >
                      {selectedSession.status === 'COMPLETED'
                        ? '완료'
                        : selectedSession.status === 'CANCELLED'
                        ? '취소'
                        : '예정'}
                    </Badge>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  aria-label="닫기"
                  className="p-1 rounded-md"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 수강생 + 출석 */}
              {sessionDetailLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  ))}
                </div>
              ) : sessionEnrollments.length === 0 ? (
                <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                  수강생이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {sessionEnrollments.map((enroll) => {
                    const att  = sessionAttendances.find((a) => a.enrollment_id === enroll.id)
                    const conf = ENROLLMENT_STATUS_CONFIG[enroll.status]

                    return (
                      <div
                        key={enroll.id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg gap-2"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        {/* 이름 + 상태 배지 */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {enroll.user_name}
                          </span>
                          <button
                            onClick={() => {
                              const transitions: EnrollmentStatus[] =
                                enroll.status === 'PENDING'
                                  ? ['CONFIRMED', 'WAITLISTED', 'CANCELLED']
                                  : enroll.status === 'CONFIRMED'
                                  ? ['PENDING', 'CANCELLED']
                                  : enroll.status === 'WAITLISTED'
                                  ? ['CONFIRMED', 'CANCELLED']
                                  : []
                              if (transitions.length > 0) {
                                // 다음 상태로 순환
                                const next = transitions[0]
                                setStatusTarget({ enrollment: enroll, next })
                              }
                            }}
                            aria-label={`${enroll.user_name} 상태: ${conf.label}`}
                            title="클릭하여 상태 변경"
                          >
                            <Badge variant={conf.variant}>{conf.label}</Badge>
                          </button>
                        </div>

                        {/* 출석 버튼 */}
                        <div
                          className="flex gap-1 shrink-0"
                          role="group"
                          aria-label={`${enroll.user_name} 출석 기록`}
                        >
                          {(['PRESENT', 'LATE', 'ABSENT'] as AttendanceLessonStatus[]).map((s) => {
                            const isActive = att?.status === s
                            return (
                              <button
                                key={s}
                                onClick={() => handleAttendance(enroll.id, s)}
                                className="text-xs px-2 py-1 rounded-md transition-all font-medium"
                                style={{
                                  backgroundColor: isActive ? 'var(--accent-color)' : 'var(--bg-card)',
                                  color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                  border: `1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-color)'}`,
                                }}
                              >
                                {ATTENDANCE_CONFIG[s].label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 결제 뷰 ─────────────────────────────────────────────────────────── */}
      {subTab === 'payments' && (
        <div>
          {/* 프로그램 선택 */}
          <div className="mb-3">
            <select
              value={paymentProgramId}
              onChange={(e) => { setPaymentProgramId(e.target.value); setPaymentEnrollId('') }}
              aria-label="프로그램 선택"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <option value="">프로그램 선택</option>
              {coachPrograms.map((p) => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          {/* 수강생 선택 */}
          {paymentProgramId && (
            <div className="mb-4">
              <select
                value={paymentEnrollId}
                onChange={(e) => setPaymentEnrollId(e.target.value)}
                aria-label="수강생 선택"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                <option value="">수강생 선택</option>
                {allEnrollments.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.user_name} ({ENROLLMENT_STATUS_CONFIG[e.status].label})
                  </option>
                ))}
              </select>
            </div>
          )}

          {paymentEnrollId && (
            <>
              <div className="flex justify-end mb-3">
                <button
                  onClick={() => setPaymentFormOpen(true)}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium"
                  style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
                >
                  <Plus className="w-4 h-4" /> 결제 등록
                </button>
              </div>

              {paymentsLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-14 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                  ))}
                </div>
              ) : payments.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                  결제 내역이 없습니다.
                </p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-4 py-3 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {p.amount.toLocaleString()}원
                          </span>
                          <Badge variant="info">{p.period}</Badge>
                          <Badge variant="secondary">{PAYMENT_METHOD_LABEL[p.method]}</Badge>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          입금일: {p.paid_at}{p.note && ` · ${p.note}`}
                        </p>
                      </div>
                      <button
                        onClick={() => setDeletePaymentTarget(p)}
                        className="p-1.5 rounded-md"
                        style={{
                          backgroundColor: 'var(--color-danger-subtle, #fee2e2)',
                          color: 'var(--color-danger)',
                        }}
                        aria-label="결제 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── 일정변경 뷰 ─────────────────────────────────────────────────────── */}
      {subTab === 'reschedule' && (
        <div>
          {/* 필터 */}
          <div className="flex gap-2 mb-4">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRescheduleFilter(f)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{
                  backgroundColor: rescheduleFilter === f ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                  color: rescheduleFilter === f ? 'var(--bg-primary)' : 'var(--text-secondary)',
                }}
              >
                {f === 'ALL' ? '전체' : RESCHEDULE_STATUS_CONFIG[f].label}
              </button>
            ))}
          </div>

          {rescheduleLoading ? (
            <div className="space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              ))}
            </div>
          ) : (() => {
            const filtered = rescheduleRequests.filter(
              (r) => rescheduleFilter === 'ALL' || r.status === rescheduleFilter,
            )
            return filtered.length === 0 ? (
              <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
                일정 변경 요청이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {filtered.map((r) => {
                  const conf = RESCHEDULE_STATUS_CONFIG[r.status]
                  return (
                    <div
                      key={r.id}
                      className="px-4 py-3 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {r.requester_name}
                            </span>
                            <Badge variant={conf.variant}>{conf.label}</Badge>
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {r.program_title}
                            </span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            기존: {r.original_date} {r.original_start_time.slice(0, 5)}~{r.original_end_time.slice(0, 5)}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--accent-color)' }}>
                            요청: {r.requested_date} {r.requested_start_time.slice(0, 5)}~{r.requested_end_time.slice(0, 5)}
                          </p>
                          {r.reason && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                              사유: {r.reason}
                            </p>
                          )}
                        </div>
                        {r.status === 'PENDING' && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => setRescheduleActionTarget({ request: r, action: 'approve' })}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
                              style={{
                                backgroundColor: 'var(--color-success-subtle, #d1fae5)',
                                color: 'var(--color-success)',
                              }}
                            >
                              <Check className="w-3 h-3" /> 승인
                            </button>
                            <button
                              onClick={() => setRescheduleActionTarget({ request: r, action: 'reject' })}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
                              style={{
                                backgroundColor: 'var(--color-danger-subtle, #fee2e2)',
                                color: 'var(--color-danger)',
                              }}
                            >
                              <X className="w-3 h-3" /> 거절
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* ── 결제 등록 모달 ──────────────────────────────────────────────────── */}
      <Modal isOpen={paymentFormOpen} onClose={() => setPaymentFormOpen(false)} title="결제 등록" size="md">
        <form onSubmit={handleAddPayment} noValidate>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <label htmlFor="pay-amount" className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}>
                  금액 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div className="relative">
                  <input
                    id="pay-amount"
                    type="number"
                    min={1}
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="100000"
                    className="w-full px-3 py-2 pr-8 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                  <span
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    원
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pay-period" className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-primary)' }}>
                    납부 월 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="pay-period"
                    type="month"
                    value={paymentForm.period}
                    onChange={(e) => setPaymentForm({ ...paymentForm, period: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>
                <div>
                  <label htmlFor="pay-date" className="block text-sm font-medium mb-1"
                    style={{ color: 'var(--text-primary)' }}>
                    입금일 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="pay-date"
                    type="date"
                    value={paymentForm.paid_at}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: 'var(--bg-input)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)',
                    }}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="pay-method" className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}>
                  결제 방법
                </label>
                <select
                  id="pay-method"
                  value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pay-note" className="block text-sm font-medium mb-1"
                  style={{ color: 'var(--text-primary)' }}>
                  메모
                </label>
                <input
                  id="pay-note"
                  type="text"
                  value={paymentForm.note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  placeholder="예: 3월 수강료"
                  maxLength={200}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={() => setPaymentFormOpen(false)}
              className="flex-1 px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              취소
            </button>
            <button type="submit" disabled={paymentSubmitting} className="flex-1 btn-primary">
              {paymentSubmitting ? '등록 중...' : '등록하기'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* ── 다이얼로그 ──────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleStatusChange}
        title="수강 상태 변경"
        message={
          statusTarget
            ? `"${statusTarget.enrollment.user_name}"의 수강 상태를 ${ENROLLMENT_STATUS_CONFIG[statusTarget.next].label}(으)로 변경하시겠습니까?`
            : ''
        }
        type="warning"
      />

      <ConfirmDialog
        isOpen={!!deletePaymentTarget}
        onClose={() => setDeletePaymentTarget(null)}
        onConfirm={handleDeletePayment}
        title="결제 내역 삭제"
        message={
          deletePaymentTarget
            ? `${deletePaymentTarget.period} ${deletePaymentTarget.amount.toLocaleString()}원 결제 내역을 삭제하시겠습니까?`
            : ''
        }
        type="error"
      />

      <ConfirmDialog
        isOpen={!!rescheduleActionTarget}
        onClose={() => setRescheduleActionTarget(null)}
        onConfirm={handleRescheduleAction}
        title={rescheduleActionTarget?.action === 'approve' ? '일정 변경 승인' : '일정 변경 거절'}
        message={
          rescheduleActionTarget
            ? rescheduleActionTarget.action === 'approve'
              ? `${rescheduleActionTarget.request.requester_name}의 일정 변경 요청을 승인하시겠습니까?\n승인 시 세션 일정이 실제로 변경됩니다.`
              : `${rescheduleActionTarget.request.requester_name}의 일정 변경 요청을 거절하시겠습니까?`
            : ''
        }
        type={rescheduleActionTarget?.action === 'approve' ? 'warning' : 'error'}
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
