'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, CreditCard, CheckSquare, Calendar, Plus, Trash2, Check, X } from 'lucide-react'
import {
  getAdminEnrollments,
  updateEnrollmentStatus,
  getLessonProgramDetail,
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
  LessonEnrollment,
  LessonSession,
  LessonAttendance,
  LessonPayment,
  EnrollmentStatus,
  AttendanceLessonStatus,
  PaymentMethod,
} from '@/lib/lessons/types'
import { PAYMENT_METHOD_LABEL } from '@/lib/lessons/types'

// ── 상태 config ──────────────────────────────────────────────────────────────

const ENROLLMENT_STATUS_CONFIG: Record<EnrollmentStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:    { label: '대기',    variant: 'warning' },
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

type SubTab = 'enrollments' | 'payments' | 'attendance' | 'reschedule'

const SUB_TABS: { key: SubTab; label: string; icon: React.ElementType }[] = [
  { key: 'enrollments', label: '수강생', icon: Users },
  { key: 'payments',    label: '결제',  icon: CreditCard },
  { key: 'attendance',  label: '출석',  icon: CheckSquare },
  { key: 'reschedule',  label: '일정변경', icon: Calendar },
]

interface Props {
  programs: LessonProgram[]
  programsLoading: boolean
}

type EnrollmentWithUser = LessonEnrollment & { user_name: string; user_email: string | null }

// ── 결제 폼 기본값 ────────────────────────────────────────────────────────────
const today = new Date().toISOString().substring(0, 10)
const thisMonth = today.substring(0, 7)
const EMPTY_PAYMENT = { amount: '', paid_at: today, method: 'BANK_TRANSFER' as PaymentMethod, period: thisMonth, note: '' }

export function AdminEnrollmentTab({ programs, programsLoading }: Props) {
  const [subTab, setSubTab] = useState<SubTab>('enrollments')
  const [selectedProgramId, setSelectedProgramId] = useState('')

  // 수강생
  const [enrollments, setEnrollments] = useState<EnrollmentWithUser[]>([])
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [statusTarget, setStatusTarget] = useState<{ enrollment: EnrollmentWithUser; next: EnrollmentStatus } | null>(null)

  // 결제
  const [paymentEnrollId, setPaymentEnrollId] = useState('')
  const [payments, setPayments] = useState<LessonPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [paymentFormOpen, setPaymentFormOpen] = useState(false)
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT)
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<LessonPayment | null>(null)
  const [paymentSubmitting, setPaymentSubmitting] = useState(false)

  // 출석
  const [sessions, setSessions] = useState<LessonSession[]>([])
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [attendances, setAttendances] = useState<LessonAttendance[]>([])
  const [attendLoading, setAttendLoading] = useState(false)

  // 일정 변경
  const [rescheduleRequests, setRescheduleRequests] = useState<AdminRescheduleRequest[]>([])
  const [rescheduleLoading, setRescheduleLoading] = useState(false)
  const [rescheduleFilter, setRescheduleFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL')
  const [rescheduleActionTarget, setRescheduleActionTarget] = useState<{ request: AdminRescheduleRequest; action: 'approve' | 'reject' } | null>(null)

  // 공통
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const showToast = (message: string) => setToast({ isOpen: true, message, type: 'success' })
  const showError = (message: string) => setAlert({ isOpen: true, message, type: 'error' })

  // ── 수강생 로드 ──────────────────────────────────────────────────────────────
  const loadEnrollments = useCallback(async (programId: string) => {
    setEnrollLoading(true)
    const { data } = await getAdminEnrollments(programId || undefined)
    setEnrollments(data)
    setEnrollLoading(false)
  }, [])

  // ── 세션 로드 (출석용) ────────────────────────────────────────────────────────
  const loadSessions = useCallback(async (programId: string) => {
    if (!programId) return
    const { data } = await getLessonProgramDetail(programId)
    setSessions(data?.sessions || [])
  }, [])

  // ── 일정변경 요청 로드 ────────────────────────────────────────────────────────
  const loadReschedule = useCallback(async () => {
    setRescheduleLoading(true)
    const { data } = await getAdminRescheduleRequests()
    setRescheduleRequests(data)
    setRescheduleLoading(false)
  }, [])

  // 프로그램 변경 시 수강생/세션 리로드
  useEffect(() => {
    if (!selectedProgramId) return
    if (subTab === 'enrollments' || subTab === 'payments') loadEnrollments(selectedProgramId)
    if (subTab === 'attendance') loadSessions(selectedProgramId)
  }, [selectedProgramId, subTab])

  // 탭 변경 시
  useEffect(() => {
    if (subTab === 'reschedule') loadReschedule()
    if ((subTab === 'enrollments' || subTab === 'payments') && selectedProgramId) loadEnrollments(selectedProgramId)
    if (subTab === 'attendance' && selectedProgramId) loadSessions(selectedProgramId)
  }, [subTab])

  // 세션 선택 시 출석 로드
  useEffect(() => {
    if (!selectedSessionId) { setAttendances([]); return }
    setAttendLoading(true)
    getSessionAttendances(selectedSessionId).then(({ data }) => {
      setAttendances(data)
      setAttendLoading(false)
    })
  }, [selectedSessionId])

  // 결제 선택 수강생 변경 시
  useEffect(() => {
    if (!paymentEnrollId) { setPayments([]); return }
    setPaymentsLoading(true)
    getEnrollmentPayments(paymentEnrollId).then(({ data }) => {
      setPayments(data)
      setPaymentsLoading(false)
    })
  }, [paymentEnrollId])

  // 초기 프로그램 자동 선택
  useEffect(() => {
    if (programs.length > 0 && !selectedProgramId) setSelectedProgramId(programs[0].id)
  }, [programs])

  // ── 수강 상태 변경 ────────────────────────────────────────────────────────────
  const handleStatusChange = async () => {
    if (!statusTarget) return
    const result = await updateEnrollmentStatus(statusTarget.enrollment.id, statusTarget.next)
    setStatusTarget(null)
    if (result.error) { showError(result.error); return }
    showToast('수강 상태가 변경되었습니다.')
    loadEnrollments(selectedProgramId)
  }

  // ── 결제 등록 ─────────────────────────────────────────────────────────────────
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paymentEnrollId) return
    if (!paymentForm.amount || parseInt(paymentForm.amount) <= 0) {
      showError('금액을 올바르게 입력해주세요.')
      return
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

  // ── 결제 삭제 ─────────────────────────────────────────────────────────────────
  const handleDeletePayment = async () => {
    if (!deletePaymentTarget) return
    const result = await deleteLessonPayment(deletePaymentTarget.id)
    setDeletePaymentTarget(null)
    if (result.error) { showError(result.error); return }
    showToast('결제 내역이 삭제되었습니다.')
    getEnrollmentPayments(paymentEnrollId).then(({ data }) => setPayments(data))
  }

  // ── 출석 기록 ─────────────────────────────────────────────────────────────────
  const handleAttendance = async (enrollmentId: string, status: AttendanceLessonStatus) => {
    const result = await recordAttendance(selectedSessionId, enrollmentId, status)
    if (result.error) { showError(result.error); return }
    getSessionAttendances(selectedSessionId).then(({ data }) => setAttendances(data))
  }

  // ── 일정변경 승인/거절 ─────────────────────────────────────────────────────────
  const handleRescheduleAction = async () => {
    if (!rescheduleActionTarget) return
    const { request, action } = rescheduleActionTarget
    const result = action === 'approve' ? await approveReschedule(request.id) : await rejectReschedule(request.id)
    setRescheduleActionTarget(null)
    if (result.error) { showError(result.error); return }
    showToast(action === 'approve' ? '일정 변경을 승인했습니다.' : '일정 변경을 거절했습니다.')
    loadReschedule()
  }

  const formatDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  const formatDateTime = (d: string) => new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  const confirmedEnrollments = enrollments.filter((e) => e.status !== 'CANCELLED')

  // ── 렌더 ─────────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* 서브탭 */}
      <div className="flex gap-1 p-1 rounded-xl mb-4" style={{ backgroundColor: 'var(--bg-secondary)' }} role="tablist">
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

      {/* 프로그램 선택 (일정변경 탭 제외) */}
      {subTab !== 'reschedule' && (
        <div className="mb-4">
          {programsLoading ? (
            <div className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          ) : (
            <select
              value={selectedProgramId}
              onChange={(e) => setSelectedProgramId(e.target.value)}
              aria-label="프로그램 선택"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
            >
              <option value="">프로그램을 선택하세요</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>{p.title} ({p.coach?.name || '코치 미배정'})</option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* ── 수강생 탭 ──────────────────────────────────────────────────────────── */}
      {subTab === 'enrollments' && (
        <div>
          {!selectedProgramId ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>프로그램을 선택해주세요.</p>
          ) : enrollLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />)}
            </div>
          ) : enrollments.length === 0 ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>수강 신청 내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {enrollments.map((e) => {
                const conf = ENROLLMENT_STATUS_CONFIG[e.status]
                const transitions: EnrollmentStatus[] = e.status === 'PENDING'
                  ? ['CONFIRMED', 'WAITLISTED', 'CANCELLED']
                  : e.status === 'CONFIRMED'
                  ? ['PENDING', 'CANCELLED']
                  : e.status === 'WAITLISTED'
                  ? ['CONFIRMED', 'CANCELLED']
                  : []
                return (
                  <div key={e.id} className="flex items-center justify-between px-4 py-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{e.user_name}</span>
                        <Badge variant={conf.variant}>{conf.label}</Badge>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {e.user_email || '이메일 없음'} · 신청 {formatDateTime(e.enrolled_at)}
                      </p>
                    </div>
                    {transitions.length > 0 && (
                      <div className="flex gap-1">
                        <select
                          value={e.status}
                          onChange={(ev) => setStatusTarget({ enrollment: e, next: ev.target.value as EnrollmentStatus })}
                          className="text-xs px-2 py-1 rounded-md"
                          style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
                          aria-label="수강 상태 변경"
                        >
                          <option value="PENDING">대기</option>
                          <option value="CONFIRMED">확정</option>
                          <option value="WAITLISTED">대기자</option>
                          <option value="CANCELLED">취소</option>
                        </select>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 결제 탭 ────────────────────────────────────────────────────────────── */}
      {subTab === 'payments' && (
        <div>
          {!selectedProgramId ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>프로그램을 선택해주세요.</p>
          ) : (
            <>
              {/* 수강생 선택 */}
              <div className="mb-4">
                <select
                  value={paymentEnrollId}
                  onChange={(e) => setPaymentEnrollId(e.target.value)}
                  aria-label="수강생 선택"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                >
                  <option value="">수강생 선택</option>
                  {confirmedEnrollments.map((e) => (
                    <option key={e.id} value={e.id}>{e.user_name} ({ENROLLMENT_STATUS_CONFIG[e.status].label})</option>
                  ))}
                </select>
              </div>

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
                      {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />)}
                    </div>
                  ) : payments.length === 0 ? (
                    <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>결제 내역이 없습니다.</p>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((p) => (
                        <div key={p.id} className="flex items-center justify-between px-4 py-3 rounded-lg"
                          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{p.amount.toLocaleString()}원</span>
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
                            style={{ backgroundColor: 'var(--color-danger-subtle, #fee2e2)', color: 'var(--color-danger)' }}
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
            </>
          )}
        </div>
      )}

      {/* ── 출석 탭 ────────────────────────────────────────────────────────────── */}
      {subTab === 'attendance' && (
        <div>
          {!selectedProgramId ? (
            <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>프로그램을 선택해주세요.</p>
          ) : (
            <>
              <div className="mb-4">
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  aria-label="세션 선택"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                >
                  <option value="">세션 선택</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatDate(s.session_date)} {s.start_time.slice(0, 5)}~{s.end_time.slice(0, 5)} ({s.status === 'COMPLETED' ? '완료' : s.status === 'CANCELLED' ? '취소' : '예정'})
                    </option>
                  ))}
                </select>
              </div>

              {selectedSessionId && (
                attendLoading ? (
                  <div className="space-y-2 animate-pulse">
                    {Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-14 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />)}
                  </div>
                ) : confirmedEnrollments.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>수강생이 없습니다.</p>
                ) : (
                  <div className="space-y-2">
                    {confirmedEnrollments.map((enroll) => {
                      const att = attendances.find((a) => a.enrollment_id === enroll.id)
                      return (
                        <div key={enroll.id} className="flex items-center justify-between px-4 py-3 rounded-lg"
                          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{enroll.user_name}</span>
                            {att ? (
                              <Badge variant={ATTENDANCE_CONFIG[att.status].variant}>{ATTENDANCE_CONFIG[att.status].label}</Badge>
                            ) : (
                              <Badge variant="secondary">미기록</Badge>
                            )}
                          </div>
                          <div className="flex gap-1" role="group" aria-label={`${enroll.user_name} 출석 기록`}>
                            {(['PRESENT', 'LATE', 'ABSENT'] as AttendanceLessonStatus[]).map((s) => (
                              <button
                                key={s}
                                onClick={() => handleAttendance(enroll.id, s)}
                                className="text-xs px-2 py-1 rounded-md transition-colors"
                                style={{
                                  backgroundColor: att?.status === s ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                                  color: att?.status === s ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                }}
                              >
                                {ATTENDANCE_CONFIG[s].label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              )}
            </>
          )}
        </div>
      )}

      {/* ── 일정 변경 탭 ──────────────────────────────────────────────────────── */}
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
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />)}
            </div>
          ) : (() => {
            const filtered = rescheduleRequests.filter((r) => rescheduleFilter === 'ALL' || r.status === rescheduleFilter)
            return filtered.length === 0 ? (
              <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>일정 변경 요청이 없습니다.</p>
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
                            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{r.program_title}</span>
                          </div>
                          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                            기존: {r.original_date} {r.original_start_time.slice(0, 5)}~{r.original_end_time.slice(0, 5)}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--accent-color)' }}>
                            요청: {r.requested_date} {r.requested_start_time.slice(0, 5)}~{r.requested_end_time.slice(0, 5)}
                          </p>
                          {r.reason && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>사유: {r.reason}</p>
                          )}
                        </div>
                        {r.status === 'PENDING' && (
                          <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => setRescheduleActionTarget({ request: r, action: 'approve' })}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
                              style={{ backgroundColor: 'var(--color-success-subtle, #d1fae5)', color: 'var(--color-success)' }}
                            >
                              <Check className="w-3 h-3" /> 승인
                            </button>
                            <button
                              onClick={() => setRescheduleActionTarget({ request: r, action: 'reject' })}
                              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
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

      {/* ── 결제 등록 모달 ────────────────────────────────────────────────────── */}
      <Modal isOpen={paymentFormOpen} onClose={() => setPaymentFormOpen(false)} title="결제 등록" size="md">
        <form onSubmit={handleAddPayment} noValidate>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <label htmlFor="pay-amount" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>금액 <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                <div className="relative">
                  <input id="pay-amount" type="number" min={1} value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    placeholder="100000" className="w-full px-3 py-2 pr-8 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs pointer-events-none" style={{ color: 'var(--text-muted)' }}>원</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="pay-period" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>납부 월 <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input id="pay-period" type="month" value={paymentForm.period}
                    onChange={(e) => setPaymentForm({ ...paymentForm, period: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
                </div>
                <div>
                  <label htmlFor="pay-date" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>입금일 <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input id="pay-date" type="date" value={paymentForm.paid_at}
                    onChange={(e) => setPaymentForm({ ...paymentForm, paid_at: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
                </div>
              </div>
              <div>
                <label htmlFor="pay-method" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>결제 방법</label>
                <select id="pay-method" value={paymentForm.method}
                  onChange={(e) => setPaymentForm({ ...paymentForm, method: e.target.value as PaymentMethod })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}>
                  {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m}>{PAYMENT_METHOD_LABEL[m]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="pay-note" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>메모</label>
                <input id="pay-note" type="text" value={paymentForm.note}
                  onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
                  placeholder="예: 3월 수강료" maxLength={200}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }} />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" onClick={() => setPaymentFormOpen(false)}
              className="flex-1 px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}>취소</button>
            <button type="submit" disabled={paymentSubmitting} className="flex-1 btn-primary">
              {paymentSubmitting ? '등록 중...' : '등록하기'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      {/* ── 다이얼로그 ────────────────────────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleStatusChange}
        title="수강 상태 변경"
        message={statusTarget
          ? `"${statusTarget.enrollment.user_name}"의 수강 상태를 ${ENROLLMENT_STATUS_CONFIG[statusTarget.next].label}(으)로 변경하시겠습니까?`
          : ''}
        type="warning"
      />

      <ConfirmDialog
        isOpen={!!deletePaymentTarget}
        onClose={() => setDeletePaymentTarget(null)}
        onConfirm={handleDeletePayment}
        title="결제 내역 삭제"
        message={deletePaymentTarget
          ? `${deletePaymentTarget.period} ${deletePaymentTarget.amount.toLocaleString()}원 결제 내역을 삭제하시겠습니까?`
          : ''}
        type="error"
      />

      <ConfirmDialog
        isOpen={!!rescheduleActionTarget}
        onClose={() => setRescheduleActionTarget(null)}
        onConfirm={handleRescheduleAction}
        title={rescheduleActionTarget?.action === 'approve' ? '일정 변경 승인' : '일정 변경 거절'}
        message={rescheduleActionTarget
          ? rescheduleActionTarget.action === 'approve'
            ? `${rescheduleActionTarget.request.requester_name}의 일정 변경 요청을 승인하시겠습니까?\n승인 시 세션 일정이 실제로 변경됩니다.`
            : `${rescheduleActionTarget.request.requester_name}의 일정 변경 요청을 거절하시겠습니까?`
          : ''}
        type={rescheduleActionTarget?.action === 'approve' ? 'warning' : 'error'}
      />

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type={alert.type} />
    </div>
  )
}
