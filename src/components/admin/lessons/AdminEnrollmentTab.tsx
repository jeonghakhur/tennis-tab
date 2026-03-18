'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Trash2,
  Check,
  CheckSquare,
  ChevronDown,
  Users,
} from 'lucide-react'
import {
  getAdminAllEnrollments,
  getAdminEnrollments,
  updateEnrollmentStatus,
  getCoachSessionsForMonth,
  getSessionAttendances,
  recordAttendance,
  createLessonPayment,
  getEnrollmentPayments,
  deleteLessonPayment,
  type AdminEnrollmentRow,
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

// ── 타입 ──────────────────────────────────────────────────────────────────────

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

// ── 상수 ──────────────────────────────────────────────────────────────────────

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

const SESSION_COLOR: Record<string, { bg: string; text: string }> = {
  SCHEDULED: { bg: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
  COMPLETED: { bg: 'rgba(16,185,129,0.15)', text: '#10b981' },
  CANCELLED: { bg: 'rgba(107,114,128,0.1)', text: '#9ca3af' },
}

function shortTitle(title: string): string {
  const type  = title.includes('주중') ? '주' : title.includes('주말') ? '말' : '기'
  const count = title.includes('1회') ? '1' : title.includes('2회') ? '2' : ''
  return type + count
}

const DAYS_KO    = ['월', '화', '수', '목', '금', '토', '일']
const todayStr   = new Date().toISOString().slice(0, 10)
const thisMonthStr = todayStr.slice(0, 7)

const EMPTY_PAYMENT = {
  amount:  '',
  paid_at: todayStr,
  method:  'BANK_TRANSFER' as PaymentMethod,
  period:  thisMonthStr,
  note:    '',
}

type SubTab = 'list' | 'calendar' | 'reschedule'

const SUB_TABS: { key: SubTab; label: string; Icon: React.ElementType }[] = [
  { key: 'list',       label: '수강생 목록', Icon: Users },
  { key: 'calendar',   label: '달력',        Icon: Calendar },
  { key: 'reschedule', label: '일정변경',    Icon: CheckSquare },
]

// ── 상태 전이 ─────────────────────────────────────────────────────────────────

const STATUS_TRANSITIONS: Record<EnrollmentStatus, EnrollmentStatus[]> = {
  PENDING:    ['CONFIRMED', 'WAITLISTED', 'CANCELLED'],
  CONFIRMED:  ['CANCELLED'],
  WAITLISTED: ['CONFIRMED', 'CANCELLED'],
  CANCELLED:  [],
}

interface Props {
  programs: LessonProgram[]
  programsLoading: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AdminEnrollmentTab({ programs, programsLoading }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('list')

  // ── 공통 ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const showToast = (msg: string) => setToast({ isOpen: true, message: msg, type: 'success' })
  const showError = (msg: string) => setAlert({ isOpen: true, message: msg, type: 'error' })

  // ── 수강생 목록 상태 ───────────────────────────────────────────────────────
  const [allEnrollments, setAllEnrollments] = useState<AdminEnrollmentRow[]>([])
  const [listLoading, setListLoading]       = useState(false)

  // 필터
  const [filterCoachId,   setFilterCoachId]   = useState('')
  const [filterProgramId, setFilterProgramId] = useState('')
  const [filterStatus,    setFilterStatus]    = useState<EnrollmentStatus | ''>('')
  const [filterPayment,   setFilterPayment]   = useState<'paid' | 'unpaid' | ''>('')

  // 행 펼침 / 결제 내역
  const [expandedId,       setExpandedId]       = useState<string | null>(null)
  const [expandedPayments, setExpandedPayments] = useState<LessonPayment[]>([])
  const [expandedLoading,  setExpandedLoading]  = useState(false)

  // 결제 등록 모달
  const [paymentModalEnroll, setPaymentModalEnroll] = useState<AdminEnrollmentRow | null>(null)
  const [paymentForm,        setPaymentForm]         = useState(EMPTY_PAYMENT)
  const [paymentSubmitting,  setPaymentSubmitting]   = useState(false)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<LessonPayment | null>(null)

  // 상태 변경 확인
  const [statusTarget, setStatusTarget] = useState<{
    enrollment: AdminEnrollmentRow
    next: EnrollmentStatus
  } | null>(null)

  // ── 달력 상태 ──────────────────────────────────────────────────────────────
  const [calendarCoachId,   setCalendarCoachId]   = useState('')
  const [currentYear,       setCurrentYear]        = useState(() => new Date().getFullYear())
  const [currentMonth,      setCurrentMonth]       = useState(() => new Date().getMonth() + 1)
  const [calendarSessions,  setCalendarSessions]   = useState<CalendarSession[]>([])
  const [calendarLoading,   setCalendarLoading]    = useState(false)
  const [selectedSession,   setSelectedSession]    = useState<CalendarSession | null>(null)
  const [sessionEnrollments, setSessionEnrollments] = useState<EnrollmentWithUser[]>([])
  const [sessionAttendances, setSessionAttendances] = useState<LessonAttendance[]>([])
  const [sessionDetailLoading, setSessionDetailLoading] = useState(false)

  // ── 일정변경 상태 ──────────────────────────────────────────────────────────
  const [rescheduleRequests,     setRescheduleRequests]     = useState<AdminRescheduleRequest[]>([])
  const [rescheduleLoading,      setRescheduleLoading]      = useState(false)
  const [rescheduleFilter,       setRescheduleFilter]       = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [rescheduleActionTarget, setRescheduleActionTarget] = useState<{
    request: AdminRescheduleRequest
    action: 'approve' | 'reject'
  } | null>(null)

  // ── 코치 목록 (programs prop에서 추출) ────────────────────────────────────
  const coaches = useMemo(() => {
    const map = new Map<string, string>()
    programs.forEach((p) => {
      if (p.coach_id && p.coach?.name) map.set(p.coach_id, p.coach.name)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [programs])

  // ── 달력용 코치 자동 선택 ─────────────────────────────────────────────────
  useEffect(() => {
    if (coaches.length > 0 && !calendarCoachId) setCalendarCoachId(coaches[0].id)
  }, [coaches, calendarCoachId])

  // ── 수강생 목록 로드 ──────────────────────────────────────────────────────
  const loadAllEnrollments = useCallback(async () => {
    setListLoading(true)
    const { data } = await getAdminAllEnrollments()
    setAllEnrollments(data)
    setListLoading(false)
  }, [])

  useEffect(() => {
    loadAllEnrollments()
  }, [loadAllEnrollments])

  // ── 필터링된 목록 ─────────────────────────────────────────────────────────
  const filteredEnrollments = useMemo(() => {
    return allEnrollments.filter((e) => {
      if (filterCoachId   && e.coach_id !== filterCoachId) return false
      if (filterProgramId && e.program_id !== filterProgramId) return false
      if (filterStatus    && e.status !== filterStatus) return false
      if (filterPayment === 'paid'   && !e.paid_periods.includes(thisMonthStr)) return false
      if (filterPayment === 'unpaid' &&  e.paid_periods.includes(thisMonthStr)) return false
      return true
    })
  }, [allEnrollments, filterCoachId, filterProgramId, filterStatus, filterPayment])

  // ── 요약 카드 ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => ({
    total:     allEnrollments.length,
    pending:   allEnrollments.filter((e) => e.status === 'PENDING').length,
    unpaid:    allEnrollments.filter((e) => !e.paid_periods.includes(thisMonthStr)).length,
    confirmed: allEnrollments.filter((e) => e.status === 'CONFIRMED').length,
  }), [allEnrollments])

  // ── 코치별 프로그램 필터 옵션 ─────────────────────────────────────────────
  const filteredPrograms = useMemo(
    () => filterCoachId ? programs.filter((p) => p.coach_id === filterCoachId) : programs,
    [programs, filterCoachId],
  )

  // ── 행 펼침 ───────────────────────────────────────────────────────────────
  const handleExpandRow = useCallback(async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedPayments([])
      return
    }
    setExpandedId(id)
    setExpandedLoading(true)
    const { data } = await getEnrollmentPayments(id)
    setExpandedPayments(data)
    setExpandedLoading(false)
  }, [expandedId])

  // ── 상태 변경 ─────────────────────────────────────────────────────────────
  const handleStatusChange = async () => {
    if (!statusTarget) return
    const { enrollment, next } = statusTarget
    setStatusTarget(null)
    // 낙관적 로컬 업데이트
    setAllEnrollments((prev) =>
      prev.map((e) => e.id === enrollment.id ? { ...e, status: next } : e)
    )
    const result = await updateEnrollmentStatus(enrollment.id, next)
    if (result.error) {
      showError(result.error)
      await loadAllEnrollments() // 에러 시에만 서버 재조회
      return
    }
    showToast('수강 상태가 변경되었습니다.')
  }

  // ── 결제 등록 ─────────────────────────────────────────────────────────────
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentModalEnroll) return
    if (!paymentForm.amount || parseInt(paymentForm.amount) <= 0) {
      showError('금액을 올바르게 입력해주세요.'); return
    }
    setPaymentSubmitting(true)
    const enrollId = paymentModalEnroll.id
    const period   = paymentForm.period
    const result = await createLessonPayment(enrollId, {
      amount:  parseInt(paymentForm.amount),
      paid_at: paymentForm.paid_at,
      method:  paymentForm.method,
      period,
      note:    paymentForm.note || undefined,
    })
    setPaymentSubmitting(false)
    if (result.error) { showError(result.error); return }
    showToast('결제 내역이 등록되었습니다.')
    setPaymentModalEnroll(null)
    setPaymentForm(EMPTY_PAYMENT)
    // 납부 월 낙관적 업데이트 (paid_periods에 추가)
    setAllEnrollments((prev) =>
      prev.map((e) => e.id === enrollId ? { ...e, paid_periods: [...e.paid_periods, period] } : e)
    )
    // 펼쳐진 행 결제 목록은 서버에서 재조회 (서버 생성 ID/timestamp 필요)
    if (expandedId === enrollId) {
      const { data } = await getEnrollmentPayments(enrollId)
      setExpandedPayments(data)
    }
  }

  // ── 결제 삭제 ─────────────────────────────────────────────────────────────
  const handleDeletePayment = async () => {
    if (!deletePaymentTarget) return
    const target = deletePaymentTarget
    setDeletePaymentTarget(null)
    // 낙관적 로컬 제거
    setExpandedPayments((prev) => prev.filter((p) => p.id !== target.id))
    // paid_periods에서 해당 기간 한 건 제거
    if (expandedId) {
      setAllEnrollments((prev) =>
        prev.map((e) => {
          if (e.id !== expandedId) return e
          const idx = e.paid_periods.indexOf(target.period)
          if (idx === -1) return e
          return { ...e, paid_periods: [...e.paid_periods.slice(0, idx), ...e.paid_periods.slice(idx + 1)] }
        })
      )
    }
    // 같은 기간에 남은 결제가 없을 때만 paid_periods에서 제거
    const remainingPayments = expandedPayments.filter((p) => p.id !== target.id)
    const periodStillExists = remainingPayments.some((p) => p.period === target.period)
    if (!periodStillExists && expandedId) {
      setAllEnrollments((prev) =>
        prev.map((e) => {
          if (e.id !== expandedId) return e
          const idx = e.paid_periods.indexOf(target.period)
          if (idx === -1) return e
          return { ...e, paid_periods: [...e.paid_periods.slice(0, idx), ...e.paid_periods.slice(idx + 1)] }
        })
      )
    }
    const result = await deleteLessonPayment(target.id)
    if (result.error) {
      showError(result.error)
      await loadAllEnrollments() // 에러 시에만 서버 재조회
      if (expandedId) {
        const { data } = await getEnrollmentPayments(expandedId)
        setExpandedPayments(data)
      }
    } else {
      showToast('결제 내역이 삭제되었습니다.')
    }
  }

  // ── 달력 ──────────────────────────────────────────────────────────────────
  const calendarProgramIds = useMemo(
    () => programs.filter((p) => p.coach_id === calendarCoachId).map((p) => p.id),
    [programs, calendarCoachId],
  )

  const loadCalendarSessions = useCallback(async () => {
    if (!calendarProgramIds.length) return
    setCalendarLoading(true)
    const { data } = await getCoachSessionsForMonth(calendarProgramIds, currentYear, currentMonth)
    setCalendarSessions(data)
    setCalendarLoading(false)
  }, [calendarProgramIds, currentYear, currentMonth])

  useEffect(() => {
    if (subTab === 'calendar') {
      loadCalendarSessions()
      setSelectedSession(null)
    }
  }, [subTab, calendarCoachId, currentYear, currentMonth, loadCalendarSessions])

  useEffect(() => {
    if (!selectedSession) { setSessionEnrollments([]); setSessionAttendances([]); return }
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

  const calendarDays = useMemo(() => {
    const firstDow = new Date(currentYear, currentMonth - 1, 1).getDay()
    const lastDate = new Date(currentYear, currentMonth, 0).getDate()
    const leading  = (firstDow + 6) % 7
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
    calendarSessions.forEach((s) => map.set(s.session_date, [...(map.get(s.session_date) ?? []), s]))
    return map
  }, [calendarSessions])

  const prevMonth = () => {
    if (currentMonth === 1) { setCurrentYear((y) => y - 1); setCurrentMonth(12) }
    else setCurrentMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (currentMonth === 12) { setCurrentYear((y) => y + 1); setCurrentMonth(1) }
    else setCurrentMonth((m) => m + 1)
  }

  const handleAttendance = async (enrollmentId: string, status: AttendanceLessonStatus) => {
    if (!selectedSession) return
    const result = await recordAttendance(selectedSession.id, enrollmentId, status)
    if (result.error) { showError(result.error); return }
    const { data } = await getSessionAttendances(selectedSession.id)
    setSessionAttendances(data)
  }

  // ── 일정변경 ──────────────────────────────────────────────────────────────
  const loadReschedule = useCallback(async () => {
    setRescheduleLoading(true)
    const { data } = await getAdminRescheduleRequests()
    setRescheduleRequests(data)
    setRescheduleLoading(false)
  }, [])

  useEffect(() => {
    if (subTab === 'reschedule') loadReschedule()
  }, [subTab, loadReschedule])

  const handleRescheduleAction = async () => {
    if (!rescheduleActionTarget) return
    const { request, action } = rescheduleActionTarget
    const result = action === 'approve' ? await approveReschedule(request.id) : await rejectReschedule(request.id)
    setRescheduleActionTarget(null)
    if (result.error) { showError(result.error); return }
    showToast(action === 'approve' ? '일정 변경을 승인했습니다.' : '일정 변경을 거절했습니다.')
    loadReschedule()
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* ── 서브탭 ── */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-4"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
        role="tablist"
        aria-label="수강생 탭"
      >
        {SUB_TABS.map(({ key, label, Icon }) => {
          const isActive = subTab === key
          return (
            <button
              key={key}
              role="tab"
              aria-selected={isActive}
              onClick={() => setSubTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--bg-primary)' : 'transparent',
                color: isActive ? 'var(--accent-color)' : 'var(--text-muted)',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 수강생 목록 탭                                                     */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'list' && (
        <div>
          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: '전체',   value: summary.total,     color: 'var(--accent-color)' },
              { label: '대기',   value: summary.pending,   color: '#d97706' },
              { label: '미납',   value: summary.unpaid,    color: 'var(--color-danger)' },
              { label: '확정',   value: summary.confirmed, color: 'var(--text-primary)' },
            ].map(({ label, value, color }) => (
              <div
                key={label}
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                <div className="text-lg font-bold" style={{ color }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* 필터 */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
            {/* 코치 필터 */}
            <select
              value={filterCoachId}
              onChange={(e) => { setFilterCoachId(e.target.value); setFilterProgramId('') }}
              aria-label="코치 필터"
              className="px-3 py-1.5 rounded-lg text-sm shrink-0"
              style={{
                backgroundColor: filterCoachId ? 'color-mix(in srgb, var(--accent-color) 12%, var(--bg-card))' : 'var(--bg-card)',
                color:           filterCoachId ? 'var(--accent-color)' : 'var(--text-secondary)',
                border: `1px solid ${filterCoachId ? 'var(--accent-color)' : 'var(--border-color)'}`,
              }}
            >
              <option value="">전체 코치</option>
              {coaches.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* 프로그램 필터 */}
            <select
              value={filterProgramId}
              onChange={(e) => setFilterProgramId(e.target.value)}
              aria-label="프로그램 필터"
              className="px-3 py-1.5 rounded-lg text-sm shrink-0"
              style={{
                backgroundColor: filterProgramId ? 'color-mix(in srgb, var(--accent-color) 12%, var(--bg-card))' : 'var(--bg-card)',
                color:           filterProgramId ? 'var(--accent-color)' : 'var(--text-secondary)',
                border: `1px solid ${filterProgramId ? 'var(--accent-color)' : 'var(--border-color)'}`,
              }}
            >
              <option value="">전체 프로그램</option>
              {filteredPrograms.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>

            {/* 상태 필터 */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as EnrollmentStatus | '')}
              aria-label="수강 상태 필터"
              className="px-3 py-1.5 rounded-lg text-sm shrink-0"
              style={{
                backgroundColor: filterStatus ? 'color-mix(in srgb, var(--accent-color) 12%, var(--bg-card))' : 'var(--bg-card)',
                color:           filterStatus ? 'var(--accent-color)' : 'var(--text-secondary)',
                border: `1px solid ${filterStatus ? 'var(--accent-color)' : 'var(--border-color)'}`,
              }}
            >
              <option value="">전체 상태</option>
              {(Object.entries(ENROLLMENT_STATUS_CONFIG) as [EnrollmentStatus, { label: string }][]).map(
                ([key, { label }]) => <option key={key} value={key}>{label}</option>,
              )}
            </select>

            {/* 납부 필터 */}
            <select
              value={filterPayment}
              onChange={(e) => setFilterPayment(e.target.value as 'paid' | 'unpaid' | '')}
              aria-label="납부 상태 필터"
              className="px-3 py-1.5 rounded-lg text-sm shrink-0"
              style={{
                backgroundColor: filterPayment ? 'color-mix(in srgb, var(--accent-color) 12%, var(--bg-card))' : 'var(--bg-card)',
                color:           filterPayment ? 'var(--accent-color)' : 'var(--text-secondary)',
                border: `1px solid ${filterPayment ? 'var(--accent-color)' : 'var(--border-color)'}`,
              }}
            >
              <option value="">납부 전체</option>
              <option value="paid">납부</option>
              <option value="unpaid">미납</option>
            </select>
          </div>

          {/* 테이블 */}
          {listLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 rounded-lg animate-pulse"
                  style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              ))}
            </div>
          ) : filteredEnrollments.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
              {allEnrollments.length === 0 ? '수강생이 없습니다.' : '필터 조건에 맞는 수강생이 없습니다.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid var(--border-color)' }}>
              <table className="w-full min-w-[520px]" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    {['이름', '코치 / 프로그램', '상태', '납부', '신청일'].map((col, i) => (
                      <th
                        key={col}
                        className="px-3 py-2.5 text-left text-sm font-semibold"
                        style={{
                          color: 'var(--text-muted)',
                          borderBottom: '1px solid var(--border-color)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEnrollments.map((enroll) => {
                    const isPaid      = enroll.paid_periods.includes(thisMonthStr)
                    const isExpanded  = expandedId === enroll.id
                    const statusConf  = ENROLLMENT_STATUS_CONFIG[enroll.status]
                    const transitions = STATUS_TRANSITIONS[enroll.status]

                    return (
                      <>
                        {/* 본 행 */}
                        <tr
                          key={enroll.id}
                          onClick={() => handleExpandRow(enroll.id)}
                          className="cursor-pointer transition-colors"
                          aria-expanded={isExpanded}
                          style={{
                            backgroundColor: isExpanded
                              ? 'color-mix(in srgb, var(--accent-color) 5%, var(--bg-primary))'
                              : 'var(--bg-primary)',
                          }}
                          onMouseEnter={(e) => {
                            if (!isExpanded) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--bg-card)'
                          }}
                          onMouseLeave={(e) => {
                            (e.currentTarget as HTMLElement).style.backgroundColor = isExpanded
                              ? 'color-mix(in srgb, var(--accent-color) 5%, var(--bg-primary))'
                              : 'var(--bg-primary)'
                          }}
                        >
                          {/* 이름 */}
                          <td className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {enroll.user_name}
                              </span>
                              <ChevronDown
                                className="w-3.5 h-3.5 transition-transform shrink-0"
                                style={{
                                  color: 'var(--text-muted)',
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                }}
                              />
                            </div>
                          </td>

                          {/* 코치 / 프로그램 */}
                          <td className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-color)' }}>
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{enroll.coach_name}</div>
                            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{enroll.program_title}</div>
                          </td>

                          {/* 상태 */}
                          <td className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                            <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                          </td>

                          {/* 납부 */}
                          <td className="px-3 py-3" style={{ borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' }}>
                            <Badge variant={isPaid ? 'success' : 'danger'}>
                              {isPaid ? '납부' : '미납'}
                            </Badge>
                          </td>

                          {/* 신청일 */}
                          <td className="px-3 py-3 text-sm" style={{
                            borderBottom: '1px solid var(--border-color)',
                            color: 'var(--text-muted)',
                            whiteSpace: 'nowrap',
                          }}>
                            {enroll.enrolled_at.slice(0, 10).replace(/-/g, '.')}
                          </td>
                        </tr>

                        {/* 펼침 행 */}
                        {isExpanded && (
                          <tr key={`${enroll.id}-detail`}>
                            <td
                              colSpan={5}
                              style={{
                                backgroundColor: 'color-mix(in srgb, var(--accent-color) 4%, var(--bg-secondary))',
                                borderBottom: '1px solid var(--border-color)',
                                padding: '12px 14px',
                              }}
                            >
                              {expandedLoading ? (
                                <div className="h-10 animate-pulse rounded-lg"
                                  style={{ backgroundColor: 'var(--bg-card-hover)' }} />
                              ) : (
                                <div className="grid grid-cols-2 gap-4">
                                  {/* 상태 변경 */}
                                  {transitions.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
                                        상태 변경
                                      </p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {transitions.map((next) => {
                                          const conf = ENROLLMENT_STATUS_CONFIG[next]
                                          const isCancel = next === 'CANCELLED'
                                          return (
                                            <button
                                              key={next}
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                setStatusTarget({ enrollment: enroll, next })
                                              }}
                                              className="px-3 py-1 rounded-lg text-sm font-semibold"
                                              style={{
                                                backgroundColor: isCancel
                                                  ? 'var(--color-danger-subtle, #fee2e2)'
                                                  : 'var(--color-success-subtle, #d1fae5)',
                                                color: isCancel
                                                  ? 'var(--color-danger)'
                                                  : 'var(--color-success)',
                                              }}
                                            >
                                              {conf.label}으로 변경
                                            </button>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {/* 결제 내역 */}
                                  <div className={transitions.length === 0 ? 'col-span-2' : ''}>
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
                                        결제 내역
                                      </p>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setPaymentModalEnroll(enroll)
                                          setPaymentForm(EMPTY_PAYMENT)
                                        }}
                                        className="flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium"
                                        style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
                                      >
                                        <Plus className="w-3 h-3" /> 등록
                                      </button>
                                    </div>

                                    {expandedPayments.length === 0 ? (
                                      <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>
                                        결제 내역이 없습니다.
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                        {expandedPayments.map((p) => (
                                          <div
                                            key={p.id}
                                            className="flex items-center justify-between px-3 py-2 rounded-lg"
                                            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div>
                                              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                {p.amount.toLocaleString()}원
                                              </span>
                                              <span className="text-xs ml-2" style={{ color: 'var(--text-muted)' }}>
                                                {p.period} · {PAYMENT_METHOD_LABEL[p.method]}
                                              </span>
                                            </div>
                                            <button
                                              onClick={() => setDeletePaymentTarget(p)}
                                              aria-label="결제 삭제"
                                              className="p-1 rounded"
                                              style={{ color: 'var(--color-danger)' }}
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 달력 탭                                                             */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'calendar' && (
        <div>
          {/* 코치 선택 드롭다운 */}
          {programsLoading ? (
            <div className="h-9 w-36 rounded-lg animate-pulse mb-3"
              style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          ) : (
            <div className="mb-3">
              <label htmlFor="calendar-coach-select" className="sr-only">코치 선택</label>
              <select
                id="calendar-coach-select"
                value={calendarCoachId}
                onChange={(e) => { setCalendarCoachId(e.target.value); setSelectedSession(null) }}
                className="px-3 py-2 rounded-lg text-sm font-semibold"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {coaches.map((c) => <option key={c.id} value={c.id}>{c.name} 코치</option>)}
              </select>
            </div>
          )}

          {/* 월 네비게이션 */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={prevMonth} aria-label="이전 달"
              className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {currentYear}년 {currentMonth}월
            </span>
            <button onClick={nextMonth} aria-label="다음 달"
              className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_KO.map((d) => (
              <div key={d} className="text-center text-sm font-medium py-1" style={{ color: 'var(--text-muted)' }}>
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
                    <span
                      className="text-sm font-medium w-5 h-5 flex items-center justify-center rounded-full mb-0.5 self-start"
                      style={{
                        backgroundColor: isToday ? 'var(--accent-color)' : 'transparent',
                        color: isToday ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {dayNum}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      {daySessions.map((s) => {
                        const col = SESSION_COLOR[s.status] ?? SESSION_COLOR.SCHEDULED
                        const isSessionSelected = selectedSession?.id === s.id
                        return (
                          <button
                            key={s.id}
                            onClick={() => setSelectedSession(isSessionSelected ? null : s)}
                            aria-pressed={isSessionSelected}
                            className="w-full text-left text-sm rounded px-1 py-0.5 truncate leading-tight font-medium"
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
            {[{ key: 'SCHEDULED', label: '예정' }, { key: 'COMPLETED', label: '완료' }, { key: 'CANCELLED', label: '취소' }].map(
              ({ key, label }) => (
                <div key={key} className="flex items-center gap-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SESSION_COLOR[key]?.text }} />
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
                </div>
              ),
            )}
          </div>

          {/* 세션 상세 패널 */}
          {selectedSession && (
            <div className="mt-4 rounded-xl p-4"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--accent-color)' }}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {new Date(selectedSession.session_date + 'T00:00:00').toLocaleDateString('ko-KR', {
                      month: 'long', day: 'numeric', weekday: 'short',
                    })}&nbsp;
                    {selectedSession.start_time.slice(0, 5)}~{selectedSession.end_time.slice(0, 5)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {selectedSession.program_title}
                    </span>
                    <Badge variant={selectedSession.status === 'COMPLETED' ? 'success' : selectedSession.status === 'CANCELLED' ? 'secondary' : 'info'}>
                      {selectedSession.status === 'COMPLETED' ? '완료' : selectedSession.status === 'CANCELLED' ? '취소' : '예정'}
                    </Badge>
                  </div>
                </div>
                <button onClick={() => setSelectedSession(null)} aria-label="닫기"
                  className="p-1 rounded-md" style={{ color: 'var(--text-muted)' }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {sessionDetailLoading ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2].map((i) => <div key={i} className="h-12 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />)}
                </div>
              ) : sessionEnrollments.length === 0 ? (
                <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>수강생이 없습니다.</p>
              ) : (
                <div className="space-y-2">
                  {sessionEnrollments.map((enroll) => {
                    const att  = sessionAttendances.find((a) => a.enrollment_id === enroll.id)
                    const conf = ENROLLMENT_STATUS_CONFIG[enroll.status]
                    return (
                      <div key={enroll.id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg gap-2"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {enroll.user_name}
                          </span>
                          <Badge variant={conf.variant}>{conf.label}</Badge>
                        </div>
                        <div className="flex gap-1 shrink-0" role="group" aria-label={`${enroll.user_name} 출석 기록`}>
                          {(['PRESENT', 'LATE', 'ABSENT'] as AttendanceLessonStatus[]).map((s) => {
                            const isActive = att?.status === s
                            return (
                              <button
                                key={s}
                                onClick={() => handleAttendance(enroll.id, s)}
                                className="text-sm px-2 py-1 rounded-md font-medium"
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

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* 일정변경 탭                                                         */}
      {/* ═══════════════════════════════════════════════════════════════════ */}
      {subTab === 'reschedule' && (
        <div>
          <div className="flex gap-2 mb-4">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRescheduleFilter(f)}
                className="px-3 py-1.5 rounded-lg text-sm font-medium"
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
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />)}
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
                    <div key={r.id} className="px-4 py-3 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{r.requester_name}</span>
                            <Badge variant={conf.variant}>{conf.label}</Badge>
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{r.program_title}</span>
                          </div>
                          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            기존: {r.original_date} {r.original_start_time.slice(0, 5)}~{r.original_end_time.slice(0, 5)}
                          </p>
                          <p className="text-sm" style={{ color: 'var(--accent-color)' }}>
                            요청: {r.requested_date} {r.requested_start_time.slice(0, 5)}~{r.requested_end_time.slice(0, 5)}
                          </p>
                          {r.reason && (
                            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>사유: {r.reason}</p>
                          )}
                        </div>
                        {r.status === 'PENDING' && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => setRescheduleActionTarget({ request: r, action: 'approve' })}
                              className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md"
                              style={{ backgroundColor: 'var(--color-success-subtle, #d1fae5)', color: 'var(--color-success)' }}
                            >
                              <Check className="w-3 h-3" /> 승인
                            </button>
                            <button
                              onClick={() => setRescheduleActionTarget({ request: r, action: 'reject' })}
                              className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md"
                              style={{ backgroundColor: 'var(--color-danger-subtle, #fee2e2)', color: 'var(--color-danger)' }}
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

      {/* ── 결제 등록 모달 ── */}
      <Modal isOpen={!!paymentModalEnroll} onClose={() => setPaymentModalEnroll(null)} title="결제 등록" size="md">
        <Modal.Body>
          <form id="enrollment-payment-form" onSubmit={handleAddPayment} noValidate className="space-y-4">
            <div>
              <label htmlFor="pay-amount" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                금액 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <div className="relative">
                <input
                  id="pay-amount" type="number" min={1}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  placeholder="100000"
                  className="w-full px-3 py-2 pr-8 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none"
                  style={{ color: 'var(--text-muted)' }}>원</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pay-period" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  납부 월 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input id="pay-period" type="month" value={paymentForm.period}
                  onChange={(e) => setPaymentForm({ ...paymentForm, period: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div>
                <label htmlFor="pay-date" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  입금일 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input id="pay-date" type="date" value={paymentForm.paid_at}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>
            <div>
              <label htmlFor="pay-method" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                결제 방법
              </label>
              <select id="pay-method" value={paymentForm.method}
                onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              >
                {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                  <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pay-note" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                메모
              </label>
              <input id="pay-note" type="text" value={paymentForm.note} maxLength={200}
                onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                placeholder="예: 3월 수강료"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
              />
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button type="button" onClick={() => setPaymentModalEnroll(null)}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>
            취소
          </button>
          <button type="submit" form="enrollment-payment-form" disabled={paymentSubmitting} className="flex-1 btn-primary">
            {paymentSubmitting ? '등록 중...' : '등록하기'}
          </button>
        </Modal.Footer>
      </Modal>

      {/* ── 다이얼로그 ── */}
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

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type={alert.type} />
    </div>
  )
}
