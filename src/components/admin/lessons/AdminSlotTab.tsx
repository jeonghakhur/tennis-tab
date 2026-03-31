'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Plus, ChevronLeft, ChevronRight, Lock, Unlock, X, Search, CalendarDays, List, User, Phone, CreditCard, Hash, Trash2 } from 'lucide-react'
import {
  updateSlotStatus,
  lockSlot,
  unlockSlot,
  deleteSlot,
  getSlotsByCoach,
  searchClubMembers,
  getBookingWithSessionInfo,
} from '@/lib/lessons/slot-actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { getCoaches } from '@/lib/coaches/actions'
import type { Coach } from '@/lib/lessons/types'
import type { LessonSlot, LessonSlotStatus, LessonBooking } from '@/lib/lessons/slot-types'
import { BOOKING_TYPE_LABEL, BOOKING_STATUS_LABEL } from '@/lib/lessons/slot-types'
import { CreateSlotModal } from './CreateSlotModal'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const SLOT_STATUS_DOT: Record<LessonSlotStatus, string> = {
  OPEN: 'var(--color-success)',
  BLOCKED: 'var(--color-secondary, #94a3b8)',
  LOCKED: 'var(--color-purple, #9333ea)',
  BOOKED: 'var(--color-info)',
  CANCELLED: 'var(--color-danger)',
}

const SLOT_STATUS_CONFIG: Record<LessonSlotStatus, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: '빈 슬롯', variant: 'danger' },
  BLOCKED: { label: '비공개', variant: 'secondary' },
  LOCKED: { label: '배정됨', variant: 'purple' },
  BOOKED: { label: '예약됨', variant: 'info' },
  CANCELLED: { label: '취소됨', variant: 'danger' },
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
/** 달력 요일 헤더 — 월요일 시작 */
const WEEK_HEADER = ['월', '화', '수', '목', '금', '토', '일']

// ─── 유틸 ────────────────────────────────────────────────────────────────────

/** YYYY-MM-DD 포맷 — 로컬 타임존 기준 (toISOString은 UTC 변환으로 날짜 밀림) */
function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 날짜 문자열을 M/D 형식으로 변환 */
function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** sessions에서 요일별 대표 시간 추출 (DOW 오름차순 정렬) */
function getPerDowTimes(sessions: Array<{ slot_date: string; start_time: string; end_time: string }>): Array<{ dow: number; start: string; end: string }> {
  const seen = new Map<number, { start: string; end: string }>()
  for (const s of sessions) {
    const dow = new Date(s.slot_date + 'T00:00:00').getDay()
    if (!seen.has(dow)) seen.set(dow, { start: s.start_time, end: s.end_time })
  }
  return [...seen.entries()].sort(([a], [b]) => a - b).map(([dow, t]) => ({ dow, ...t }))
}

/** sessions 배열에서 고유 요일 레이블 추출 (화·목 등) */
function getPackageDowLabel(sessions: Array<{ slot_date: string }>, fallbackDateStr?: string): string {
  const src = sessions.length > 0 ? sessions : fallbackDateStr ? [{ slot_date: fallbackDateStr }] : []
  const seen = new Set<number>()
  const dows: number[] = []
  for (const s of src) {
    const dow = new Date(s.slot_date + 'T00:00:00').getDay()
    if (!seen.has(dow)) { seen.add(dow); dows.push(dow) }
  }
  return dows.map((d) => DAY_LABELS[d]).join('·')
}

/** 주 시작일(월요일) 반환 */
function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const dow = d.getDay()
  d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1))
  return d
}

/** 월간 달력 날짜 배열 (월요일 시작, 7의 배수) */
function getCalendarDays(year: number, month: number): Array<{ date: Date; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // 월요일 기준 오프셋 (0=월, ..., 6=일)
  const startDow = firstDay.getDay() // 0=Sun
  const startOffset = startDow === 0 ? 6 : startDow - 1

  const days: Array<{ date: Date; isCurrentMonth: boolean }> = []

  // 이전 달 채우기
  for (let i = startOffset; i > 0; i--) {
    const d = new Date(firstDay)
    d.setDate(d.getDate() - i)
    days.push({ date: d, isCurrentMonth: false })
  }

  // 현재 달
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true })
  }

  // 다음 달 채우기 (7의 배수)
  const remaining = days.length % 7
  if (remaining !== 0) {
    for (let i = 1; i <= 7 - remaining; i++) {
      const d = new Date(lastDay)
      d.setDate(d.getDate() + i)
      days.push({ date: d, isCurrentMonth: false })
    }
  }

  return days
}

// ─── Props ───────────────────────────────────────────────────────────────────

// props 없음 — 코치 목록을 내부에서 직접 로드

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

interface AdminSlotTabProps {
  /** 코치 모드: 이 ID로 고정되어 코치 탭 셀렉터 숨김 */
  fixedCoachId?: string
}

export function AdminSlotTab({ fixedCoachId }: AdminSlotTabProps = {}) {
  // 코치 목록 (fixedCoachId가 있으면 로드 불필요)
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [coachesLoading, setCoachesLoading] = useState(!fixedCoachId)

  useEffect(() => {
    if (fixedCoachId) return // 코치 모드: 목록 조회 생략
    getCoaches().then(({ data }) => {
      setCoaches(data)
      setCoachesLoading(false)
    })
  }, [fixedCoachId])

  // 선택된 코치 (fixedCoachId가 있으면 고정)
  const [selectedCoachId, setSelectedCoachId] = useState(fixedCoachId ?? '')
  const coachId = (fixedCoachId ?? selectedCoachId) || coaches[0]?.id || ''

  // 뷰 모드
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  // 목록 뷰 범위 (주간 기본)
  const [listRange, setListRange] = useState<'week' | 'month'>('week')

  // 현재 월 (1일로 고정) — 달력 뷰 및 월간 목록 뷰에 사용
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  // 주간 목록 뷰 시작일 (월요일)
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()))

  // 달력 뷰에서 선택된 날짜
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 슬롯 데이터
  const [slots, setSlots] = useState<LessonSlot[]>([])
  const [loading, setLoading] = useState(false)

  // 모달 상태
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [lockModalSlot, setLockModalSlot] = useState<LessonSlot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LessonSlot | null>(null)
  const [bookingModalSlot, setBookingModalSlot] = useState<LessonSlot | null>(null)

  // 피드백
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  // 코치 탭 자동 선택 (최초 로드)
  useEffect(() => {
    if (coaches.length > 0 && !selectedCoachId) {
      setSelectedCoachId(coaches[0].id)
    }
  }, [coaches.length])

  // 슬롯 조회 (뷰 모드에 따라 주간/월간)
  // silent=true이면 로딩 인디케이터 없이 백그라운드 갱신 (등록/수정 후 호출용)
  const loadSlots = useCallback(async (silent = false) => {
    if (!coachId) { setSlots([]); return }
    if (!silent) setLoading(true)
    let startDate: string
    let endDate: string
    if (viewMode === 'list' && listRange === 'week') {
      // 주간: weekStart(월) ~ weekStart+6(일)
      const we = new Date(weekStart)
      we.setDate(we.getDate() + 6)
      startDate = toDateStr(weekStart)
      endDate = toDateStr(we)
    } else {
      // 달력 뷰 or 월간 목록
      const yr = currentMonth.getFullYear()
      const mo = currentMonth.getMonth()
      startDate = toDateStr(new Date(yr, mo, 1))
      endDate = toDateStr(new Date(yr, mo + 1, 0))
    }
    const { data } = await getSlotsByCoach(coachId, startDate, endDate)
    setSlots(data)
    if (!silent) setLoading(false)
  }, [coachId, currentMonth, viewMode, listRange, weekStart])

  useEffect(() => { loadSlots() }, [loadSlots])

  // 월 이동
  const prevMonth = () => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    setSelectedDate(null)
  }
  const nextMonth = () => {
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    setSelectedDate(null)
  }
  const goToday = () => {
    const now = new Date()
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1))
    setSelectedDate(toDateStr(now))
  }

  // 주 이동
  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }
  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }
  const goThisWeek = () => setWeekStart(getWeekStart(new Date()))

  // 날짜 미정 슬롯 분리
  const undatedSlots = useMemo(() => slots.filter((s) => !s.slot_date), [slots])

  // 날짜별 슬롯 맵 — sessions JSONB 기반으로 확장 (패키지의 각 세션 날짜에 매핑)
  const slotsByDate = useMemo(() => {
    const map = new Map<string, LessonSlot[]>()
    for (const slot of slots) {
      if (!slot.slot_date) continue // 날짜 미정 슬롯은 별도 섹션에 표시
      // sessions 배열이 있으면 각 세션 날짜에 매핑, 없으면 slot_date에만 매핑
      const dates = slot.sessions?.length
        ? (slot.sessions as Array<{ slot_date?: string }>).filter((s) => s.slot_date).map((s) => s.slot_date!)
        : [slot.slot_date]
      for (const d of dates) {
        if (!map.has(d)) map.set(d, [])
        // 같은 슬롯이 중복 추가되지 않도록
        if (!map.get(d)!.find((s) => s.id === slot.id)) {
          map.get(d)!.push(slot)
        }
      }
    }
    return map
  }, [slots])

  // 슬롯 액션 핸들러
  const handleToggleStatus = async (slot: LessonSlot) => {
    const newStatus: LessonSlotStatus = slot.status === 'OPEN' ? 'BLOCKED' : 'OPEN'
    // 낙관적 로컬 업데이트
    setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, status: newStatus } : s))
    const result = await updateSlotStatus(slot.id, newStatus)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      loadSlots() // 에러 시에만 서버 재조회
      return
    }
    setToast({ isOpen: true, message: `슬롯이 ${newStatus === 'OPEN' ? '공개' : '비공개'}되었습니다.`, type: 'success' })
  }

  const handleUnlock = async (slot: LessonSlot) => {
    // 낙관적 로컬 업데이트
    setSlots((prev) => prev.map((s) => s.id === slot.id ? { ...s, status: 'OPEN' as const, enrollment_id: null } : s))
    const result = await unlockSlot(slot.id)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      loadSlots() // 에러 시에만 서버 재조회
      return
    }
    setToast({ isOpen: true, message: '배정이 해제되었습니다.', type: 'success' })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    setDeleteTarget(null)
    // 낙관적 로컬 제거
    setSlots((prev) => prev.filter((s) => s.id !== targetId))
    const result = await deleteSlot(targetId)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      loadSlots() // 에러 시에만 서버 재조회
      return
    }
    setToast({ isOpen: true, message: '슬롯이 삭제되었습니다.', type: 'success' })
  }

  const todayStr = toDateStr(new Date())
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const calendarDays = getCalendarDays(year, month)

  // 이번 달 날짜 배열 (월간 목록 뷰)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthDates = Array.from({ length: daysInMonth }, (_, i) =>
    toDateStr(new Date(year, month, i + 1))
  )

  // 주간 날짜 배열 (주간 목록 뷰, 월~일 7일)
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return toDateStr(d)
  })

  // 주간 목록 헤더 레이블
  const weekEnd = weekDates[6]
  const weekLabelStart = weekDates[0].slice(5).replace('-', '/')
  const weekLabelEnd = weekEnd.slice(5).replace('-', '/')
  const weekYearLabel = weekDates[0].slice(0, 4)

  // 목록 뷰에서 표시할 날짜
  const listDates = listRange === 'week' ? weekDates : monthDates

  return (
    <div>
      {/* 코치 탭 — fixedCoachId(코치 모드)면 숨김 */}
      {!fixedCoachId && coachesLoading ? (
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          ))}
        </div>
      ) : !fixedCoachId && coaches.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>등록된 코치가 없습니다.</p>
      ) : !fixedCoachId ? (
        <div
          className="flex gap-1 mb-4 border-b"
          style={{ borderColor: 'var(--border-color)' }}
          role="tablist"
          aria-label="코치 선택"
        >
          {coaches.map((coach) => {
            const isActive = coachId === coach.id
            return (
              <button
                key={coach.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCoachId(coach.id)}
                className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {coach.name}
              </button>
            )
          })}
        </div>
      ) : null}

      {coachId && (
        <>
          {/* 네비게이션 + 뷰 전환 + 슬롯 등록 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {/* 주간 목록 모드 */}
              {viewMode === 'list' && listRange === 'week' ? (
                <>
                  <button
                    onClick={prevWeek}
                    className="p-1.5 rounded-lg hover:opacity-80"
                    style={{ backgroundColor: 'var(--bg-card-hover)' }}
                    aria-label="이전 주"
                  >
                    <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button
                    onClick={goThisWeek}
                    className="text-sm px-2 py-1 rounded-lg font-medium whitespace-nowrap"
                    style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                  >
                    이번 주
                  </button>
                  <button
                    onClick={nextWeek}
                    className="p-1.5 rounded-lg hover:opacity-80"
                    style={{ backgroundColor: 'var(--bg-card-hover)' }}
                    aria-label="다음 주"
                  >
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-primary)' }}>
                    {weekYearLabel}년 {weekLabelStart} ~ {weekLabelEnd}
                  </span>
                </>
              ) : (
                /* 달력 뷰 or 월간 목록 모드 */
                <>
                  <button
                    onClick={prevMonth}
                    className="p-1.5 rounded-lg hover:opacity-80"
                    style={{ backgroundColor: 'var(--bg-card-hover)' }}
                    aria-label="이전 달"
                  >
                    <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <button
                    onClick={goToday}
                    className="text-sm px-2 py-1 rounded-lg font-medium whitespace-nowrap"
                    style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                  >
                    오늘
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 rounded-lg hover:opacity-80"
                    style={{ backgroundColor: 'var(--bg-card-hover)' }}
                    aria-label="다음 달"
                  >
                    <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
                  </button>
                  <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-primary)' }}>
                    {year}년 {month + 1}월
                  </span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* 뷰 전환 토글 */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  aria-label="달력 뷰"
                  aria-pressed={viewMode === 'calendar'}
                  className="p-2 transition-colors"
                  style={{
                    backgroundColor: viewMode === 'calendar' ? 'var(--accent-color)' : 'var(--bg-card)',
                    color: viewMode === 'calendar' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <CalendarDays className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="목록 뷰"
                  aria-pressed={viewMode === 'list'}
                  className="p-2 transition-colors"
                  style={{
                    backgroundColor: viewMode === 'list' ? 'var(--accent-color)' : 'var(--bg-card)',
                    color: viewMode === 'list' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  }}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium whitespace-nowrap"
                style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
              >
                <Plus className="w-4 h-4" />
                슬롯 등록
              </button>
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              ))}
            </div>
          ) : viewMode === 'calendar' ? (
            // ── 달력 뷰: 모바일 세로 / 데스크탑 가로 균등 분할 ──────────
            <div className="space-y-4">
            {/* 날짜 미정 슬롯 섹션 */}
            {undatedSlots.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="text-sm font-semibold px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--color-warning-subtle, rgba(245,158,11,0.12))', color: 'var(--color-warning)' }}
                  >
                    날짜 미정
                  </span>
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {undatedSlots.length}건
                  </span>
                </div>
                <div className="space-y-2">
                  {undatedSlots.map((slot) => {
                    const sessions = (slot.sessions ?? []) as Array<{ dow?: number; start_time?: string }>
                    const dowLabel = sessions
                      .filter((s) => s.dow !== undefined)
                      .map((s) => DAY_LABELS[s.dow!])
                      .join('·')
                    const timeLabel = sessions
                      .filter((s) => s.start_time)
                      .map((s) => s.start_time!.slice(0, 5))
                      .join(', ')
                    return (
                      <div
                        key={slot.id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant={SLOT_STATUS_CONFIG[slot.status].variant}>
                            {SLOT_STATUS_CONFIG[slot.status].label}
                          </Badge>
                          <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                            {dowLabel ? `${dowLabel}요일` : ''} {timeLabel && `${timeLabel}`}
                          </span>
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            주{slot.frequency}회 · {slot.duration_minutes}분 · 총{slot.total_sessions}회
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                            {slot.fee_amount != null ? `${slot.fee_amount.toLocaleString()}원` : '별도 협의'}
                          </span>
                          <button
                            onClick={() => setDeleteTarget(slot)}
                            className="p-1.5 rounded-lg transition-colors hover:opacity-80"
                            style={{ backgroundColor: 'var(--color-danger-subtle)', color: 'var(--color-danger)' }}
                            title="슬롯 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-col md:flex-row md:gap-6 md:items-start">
              {/* 월간 달력 */}
              <div className="md:flex-1 px-1 pb-2">
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 mb-1">
                  {WEEK_HEADER.map((d, i) => (
                    <div
                      key={d}
                      className="text-center text-sm py-2"
                      style={{
                        color: i === 0 ? 'var(--color-danger)' : i === 6 ? 'var(--color-info)' : 'var(--text-muted)',
                      }}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* 날짜 그리드 */}
                <div className="grid grid-cols-7">
                  {calendarDays.map(({ date, isCurrentMonth }) => {
                    const dateStr = toDateStr(date)
                    const daySlots = slotsByDate.get(dateStr) || []
                    const isSelected = selectedDate === dateStr
                    const isToday = dateStr === todayStr
                    const dow = date.getDay()
                    const bookedCount = daySlots.filter((s) => s.status === 'BOOKED').length
                    const openCount = daySlots.filter((s) => s.status === 'OPEN').length
                    const otherCount = daySlots.length - bookedCount - openCount

                    // 점 색상 우선순위: 예약(파랑) > 빈슬롯(초록) > 기타(회색)
                    const dotColors: string[] = []
                    if (bookedCount > 0) dotColors.push('var(--color-info)')
                    if (openCount > 0) dotColors.push('var(--color-danger)')
                    if (otherCount > 0 && dotColors.length < 2) dotColors.push('var(--text-muted)')

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDate(dateStr)}
                        className="flex flex-col items-center py-1 transition-colors"
                        style={{ opacity: isCurrentMonth ? 1 : 0.25 }}
                        aria-label={`${dateStr} ${daySlots.length}개 슬롯`}
                        aria-pressed={isSelected}
                      >
                        {/* 날짜 숫자 원 */}
                        <span
                          className="w-10 h-10 flex items-center justify-center rounded-full text-base font-medium leading-none transition-colors"
                          style={{
                            backgroundColor: isSelected
                              ? 'var(--accent-color)'
                              : isToday
                              ? 'var(--bg-secondary)'
                              : 'transparent',
                            color: isSelected
                              ? '#fff'
                              : dow === 0
                              ? 'var(--color-danger)'
                              : dow === 6
                              ? 'var(--color-info)'
                              : 'var(--text-primary)',
                            fontWeight: isToday ? 700 : undefined,
                          }}
                        >
                          {date.getDate()}
                        </span>

                        {/* 슬롯 이벤트 점 */}
                        <div className="flex items-center gap-0.5 mt-1 h-1.5">
                          {dotColors.map((color, i) => (
                            <span
                              key={i}
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: isSelected ? 'rgba(255,255,255,0.7)' : color }}
                            />
                          ))}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 모바일 구분선 + 드래그 핸들 */}
              <div
                className="flex flex-col items-center pt-1 pb-4 md:hidden"
                style={{ borderTop: '1px solid var(--border-color)' }}
              >
                <div className="w-10 h-1 rounded-full mt-2" style={{ backgroundColor: 'var(--border-color)' }} />
              </div>

              {/* 데스크탑 세로 구분선 */}
              <div className="hidden md:block w-px self-stretch" style={{ backgroundColor: 'var(--border-color)' }} />

              {/* 슬롯 패널 */}
              <div className="md:flex-1">
                {!selectedDate ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <CalendarDays className="w-10 h-10 mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>날짜를 선택하세요</p>
                  </div>
                ) : (
                  <DateSlotPanel
                    dateStr={selectedDate}
                    slots={slotsByDate.get(selectedDate) || []}
                    onToggle={handleToggleStatus}
                    onLock={(slot) => setLockModalSlot(slot)}
                    onUnlock={handleUnlock}
                    onDelete={(slot) => setDeleteTarget(slot)}
                    onViewBooking={(slot) => setBookingModalSlot(slot)}
                  />
                )}
              </div>
            </div>
            </div>
          ) : (
            // ── 목록 뷰: 주간 or 월간 ────────────────────────────────
            <div>
              {/* 주간/월간 토글 */}
              <div className="flex items-center gap-1 mb-4">
                <button
                  type="button"
                  onClick={() => setListRange('week')}
                  aria-pressed={listRange === 'week'}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: listRange === 'week' ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                    color: listRange === 'week' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  }}
                >
                  주간
                </button>
                <button
                  type="button"
                  onClick={() => setListRange('month')}
                  aria-pressed={listRange === 'month'}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor: listRange === 'month' ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                    color: listRange === 'month' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  }}
                >
                  월간
                </button>
              </div>

              {/* 날짜별 슬롯 목록 */}
              <div className="space-y-1.5">
                {listDates.map((dateStr) => {
                  const daySlots = slotsByDate.get(dateStr) || []
                  const date = new Date(dateStr + 'T00:00:00')
                  const dow = date.getDay()
                  const isToday = dateStr === todayStr
                  const hasSlots = daySlots.length > 0

                  // 날짜 색상
                  const dayColor = isToday
                    ? 'var(--bg-primary)'
                    : dow === 0
                    ? 'var(--color-danger)'
                    : dow === 6
                    ? 'var(--color-info)'
                    : 'var(--text-secondary)'

                  return (
                    <div
                      key={dateStr}
                      className="rounded-xl overflow-hidden"
                      style={{
                        border: hasSlots ? '1px solid var(--border-color)' : 'none',
                      }}
                    >
                      {/* 날짜 헤더 */}
                      <div
                        className="flex items-center gap-2.5 px-4 py-2.5"
                        style={{
                          backgroundColor: isToday
                            ? 'var(--accent-color)'
                            : hasSlots
                            ? 'var(--bg-secondary)'
                            : 'transparent',
                        }}
                      >
                        {/* 요일 뱃지 */}
                        <span
                          className="text-sm font-bold w-6 shrink-0 text-center"
                          style={{ color: dayColor }}
                        >
                          {DAY_LABELS[dow]}
                        </span>

                        {/* 날짜 */}
                        <span
                          className="text-sm font-semibold"
                          style={{ color: isToday ? 'var(--bg-primary)' : 'var(--text-primary)' }}
                        >
                          {date.getMonth() + 1}/{date.getDate()}
                        </span>

                        {/* 슬롯 수 or 없음 */}
                        {hasSlots ? (
                          <span
                            className="text-sm font-medium px-1.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: isToday ? 'rgba(255,255,255,0.2)' : 'var(--bg-card)',
                              color: isToday ? 'var(--bg-primary)' : 'var(--text-muted)',
                            }}
                          >
                            {daySlots.length}
                          </span>
                        ) : (
                          <span
                            className="text-sm"
                            style={{ color: isToday ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}
                          >
                            슬롯 없음
                          </span>
                        )}
                      </div>

                      {/* 슬롯 행 목록 */}
                      {hasSlots && daySlots.map((slot, idx) => (
                        <SlotRow
                          key={slot.id}
                          slot={slot}
                          dateStr={dateStr}
                          isFirst={idx === 0}
                          onToggle={() => handleToggleStatus(slot)}
                          onLock={() => setLockModalSlot(slot)}
                          onUnlock={() => handleUnlock(slot)}
                          onDelete={() => setDeleteTarget(slot)}
                          onViewBooking={() => setBookingModalSlot(slot)}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* 슬롯 등록 모달 */}
      {coachId && (
        <CreateSlotModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          coachId={coachId}
          onSuccess={(count) => {
            setToast({ isOpen: true, message: `${count}개 슬롯이 등록되었습니다.`, type: 'success' })
            setCreateModalOpen(false)
            loadSlots(true) // 화면 깜빡임 없이 백그라운드 갱신
          }}
          onError={(msg) => setAlert({ isOpen: true, message: msg, type: 'error' })}
        />
      )}

      {/* 예약자 상세 모달 */}
      {bookingModalSlot && (
        <BookedSlotDetailModal
          isOpen={!!bookingModalSlot}
          onClose={() => setBookingModalSlot(null)}
          slot={bookingModalSlot}
        />
      )}

      {/* 회원 배정 모달 */}
      {lockModalSlot && (
        <LockSlotModal
          isOpen={!!lockModalSlot}
          onClose={() => setLockModalSlot(null)}
          slot={lockModalSlot}
          onSuccess={() => {
            setToast({ isOpen: true, message: '회원이 배정되었습니다.', type: 'success' })
            setLockModalSlot(null)
            loadSlots()
          }}
          onError={(msg) => setAlert({ isOpen: true, message: msg, type: 'error' })}
        />
      )}

      {/* 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="슬롯 삭제"
        message={deleteTarget ? (deleteTarget.slot_date ? `${deleteTarget.slot_date} ${deleteTarget.start_time?.slice(0, 5) ?? ''}~${deleteTarget.end_time?.slice(0, 5) ?? ''} 슬롯을 삭제하시겠습니까?` : '날짜 미정 슬롯을 삭제하시겠습니까?') : ''}
        type="error"
      />

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type={alert.type} />
    </div>
  )
}

// ─── DateSlotPanel (달력 뷰 우측 패널) ─────────────────────────────────────

/** 예약자 표시 이름 헬퍼 */
function getBookingName(slot: LessonSlot): string | null {
  if (slot.status === 'BOOKED' && slot.booking) {
    return slot.booking.member?.name || slot.booking.guest_name || null
  }
  if (slot.status === 'LOCKED') {
    return slot.locked_member?.name || slot.notes || null
  }
  return null
}

// ─── DateSlotPanel (달력 뷰 우측 패널) ─────────────────────────────────────

interface DateSlotPanelProps {
  dateStr: string
  slots: LessonSlot[]
  onToggle: (slot: LessonSlot) => void
  onLock: (slot: LessonSlot) => void
  onUnlock: (slot: LessonSlot) => void
  onDelete: (slot: LessonSlot) => void
  onViewBooking: (slot: LessonSlot) => void
}

function DateSlotPanel({ dateStr, slots, onToggle, onLock, onUnlock, onDelete, onViewBooking }: DateSlotPanelProps) {
  const date = new Date(dateStr + 'T00:00:00')
  const dow = date.getDay()
  const bookedCount = slots.filter((s) => s.status === 'BOOKED').length
  const openCount = slots.filter((s) => s.status === 'OPEN').length

  return (
    <div>
      {/* 날짜 헤더 */}
      <div className="flex items-center gap-3 px-4 pb-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
            {date.getMonth() + 1}월 {date.getDate()}일
          </span>
          <span
            className="text-sm"
            style={{
              color: dow === 0 ? 'var(--color-danger)' : dow === 6 ? 'var(--color-info)' : 'var(--text-muted)',
            }}
          >
            {DAY_LABELS[dow]}요일
          </span>
        </div>

        {/* 슬롯 현황 요약 */}
        {slots.length > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            {bookedCount > 0 && (
              <span
                className="text-sm font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: 'var(--color-info)' }}
              >
                예약 {bookedCount}
              </span>
            )}
            {openCount > 0 && (
              <span
                className="text-sm font-medium px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'var(--color-danger-subtle)', color: 'var(--color-danger)' }}
              >
                빈 슬롯 {openCount}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 슬롯 목록 */}
      {slots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>등록된 슬롯이 없습니다. 슬롯을 등록해보세요.</p>
        </div>
      ) : (
        <div>
          {slots.map((slot) => (
            <PackageCard
              key={slot.id}
              slot={slot}
              dateStr={dateStr}
              onToggle={() => onToggle(slot)}
              onLock={() => onLock(slot)}
              onUnlock={() => onUnlock(slot)}
              onDelete={() => onDelete(slot)}
              onViewBooking={() => onViewBooking(slot)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SlotChip 컴포넌트 (목록 뷰용) ─────────────────────────────────────────

interface SlotChipProps {
  slot: LessonSlot
  onToggle: () => void
  onLock: () => void
  onUnlock: () => void
  onDelete: () => void
  onViewBooking: () => void
}

function SlotChip({ slot, onToggle, onLock, onUnlock, onDelete, onViewBooking }: SlotChipProps) {
  const conf = SLOT_STATUS_CONFIG[slot.status]
  const time = slot.start_time ? `${slot.start_time.slice(0, 5)}~${slot.end_time?.slice(0, 5) ?? ''}` : '시간 미정'
  const isActionable = slot.status === 'OPEN' || slot.status === 'BLOCKED'
  const bookedName = getBookingName(slot)

  // BOOKED 슬롯은 전체가 클릭 가능한 버튼
  if (slot.status === 'BOOKED') {
    return (
      <button
        type="button"
        onClick={onViewBooking}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm hover:opacity-80 transition-opacity"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        aria-label={`${time} 예약자 ${bookedName || ''} 상세 보기`}
      >
        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{time}</span>
        <Badge variant={conf.variant}>{conf.label}</Badge>
        {bookedName && (
          <span className="font-medium" style={{ color: 'var(--accent-color)' }}>{bookedName}</span>
        )}
        {slot.booking?.sessionNumber != null && (
          <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
            {slot.booking.sessionNumber}회차
          </span>
        )}
      </button>
    )
  }

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-sm"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{time}</span>
      <Badge variant={conf.variant}>{conf.label}</Badge>
      {bookedName && slot.status === 'LOCKED' && (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{bookedName}</span>
      )}

      {isActionable && (
        <>
          <button onClick={onToggle} className="p-0.5 rounded hover:opacity-70" aria-label={slot.status === 'OPEN' ? '비공개 처리' : '공개 처리'}>
            {slot.status === 'OPEN' ? (
              <Lock className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <Unlock className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
            )}
          </button>
          {slot.status === 'OPEN' && (
            <button onClick={onLock} className="p-0.5 rounded hover:opacity-70" aria-label="회원 배정">
              <Search className="w-3 h-3" style={{ color: 'var(--accent-color)' }} />
            </button>
          )}
          <button onClick={onDelete} className="p-0.5 rounded hover:opacity-70" aria-label="삭제">
            <X className="w-3 h-3" style={{ color: 'var(--color-danger)' }} />
          </button>
        </>
      )}

      {slot.status === 'LOCKED' && (
        <button onClick={onUnlock} className="p-0.5 rounded hover:opacity-70" aria-label="배정 해제">
          <Unlock className="w-3 h-3" style={{ color: 'var(--color-danger)' }} />
        </button>
      )}
    </div>
  )
}

// ─── PackageCard 컴포넌트 (달력 날짜 패널용) ─────────────────────────────────

interface PackageCardProps {
  slot: LessonSlot
  dateStr: string   // 현재 선택된 날짜 — 해당 날짜의 세션 회차 강조
  onToggle: () => void
  onLock: () => void
  onUnlock: () => void
  onDelete: () => void
  onViewBooking: () => void
}

function PackageCard({ slot, dateStr, onToggle, onLock, onUnlock, onDelete, onViewBooking }: PackageCardProps) {
  const conf = SLOT_STATUS_CONFIG[slot.status]
  const sessions = slot.sessions ?? []
  const isActionable = slot.status === 'OPEN' || slot.status === 'BLOCKED'
  const bookedName = getBookingName(slot)

  // 해당 날짜 세션 + 회차 번호
  const sessionIndex = sessions.findIndex((s) => s.slot_date === dateStr)
  const currentSession = sessionIndex >= 0 ? sessions[sessionIndex] : null
  const sessionNumber = sessionIndex + 1

  const time = currentSession
    ? `${currentSession.start_time.slice(0, 5)}~${currentSession.end_time.slice(0, 5)}`
    : slot.start_time ? `${slot.start_time.slice(0, 5)}~${slot.end_time?.slice(0, 5) ?? ''}` : '시간 미정'

  // 요일별 대표 시간 (화 11:30~11:50, 목 19:00~19:20)
  const dowTimes = getPerDowTimes(sessions)
  const todayDow = new Date(dateStr + 'T00:00:00').getDay()

  // 패키지 제목 (화·목 주2회 레슨 패키지)
  const dowLabel = getPackageDowLabel(sessions, slot.slot_date ?? undefined)
  const title = slot.frequency ? `${dowLabel} 주${slot.frequency}회 레슨 패키지` : `${dowLabel} 레슨 슬롯`

  return (
    <div
      className="rounded-xl p-4 mb-3"
      style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
    >
      {/* 헤더: 패키지 제목 + 상태 배지 + 액션 */}
      <div className="flex items-start gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>
            {title}
          </p>
          {bookedName && (slot.status === 'BOOKED' || slot.status === 'LOCKED') && (
            <p className="text-sm mt-0.5" style={{ color: 'var(--accent-color)' }}>{bookedName}</p>
          )}
        </div>

        <Badge variant={conf.variant}>{conf.label}</Badge>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-0.5 shrink-0">
          {isActionable && (
            <>
              <button
                onClick={onToggle}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
                aria-label={slot.status === 'OPEN' ? '비공개 처리' : '공개 처리'}
              >
                {slot.status === 'OPEN'
                  ? <Lock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  : <Unlock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                }
              </button>
              {slot.status === 'OPEN' && (
                <button onClick={onLock} className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors" aria-label="회원 배정">
                  <Search className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
                </button>
              )}
              <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors" aria-label="삭제">
                <X className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
              </button>
            </>
          )}
          {slot.status === 'LOCKED' && (
            <button onClick={onUnlock} className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors" aria-label="배정 해제">
              <Unlock className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
            </button>
          )}
          {slot.status === 'BOOKED' && (
            <button onClick={onViewBooking} className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors" aria-label="예약 상세">
              <User className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
            </button>
          )}
        </div>
      </div>

      {/* 요일별 시간 — 오늘 요일 accent 강조 */}
      <div className="flex flex-wrap gap-2 mb-3">
        {dowTimes.length > 0 ? dowTimes.map(({ dow, start, end }) => {
          const isToday = dow === todayDow
          return (
            <div
              key={dow}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
              style={{
                backgroundColor: isToday ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: isToday ? '#fff' : 'var(--text-secondary)',
              }}
            >
              <span className="text-sm font-semibold">{DAY_LABELS[dow]}</span>
              <span className="text-sm tabular-nums">{start.slice(0, 5)}~{end.slice(0, 5)}</span>
            </div>
          )
        }) : (
          // sessions 없는 레거시 슬롯 fallback
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SLOT_STATUS_DOT[slot.status] }} />
            <span className="font-medium tabular-nums" style={{ color: 'var(--text-primary)', fontSize: '15px' }}>{time}</span>
          </div>
        )}
        {/* 회차 */}
        {sessions.length > 0 && sessionNumber > 0 && slot.total_sessions && (
          <div className="flex items-center" style={{ color: 'var(--text-muted)' }}>
            <span className="text-sm tabular-nums">{sessionNumber}회차 / {slot.total_sessions}회</span>
          </div>
        )}
      </div>

      {/* 전체 세션 날짜 칩 */}
      {sessions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sessions.map((s) => (
            <span
              key={s.slot_date}
              className="text-sm px-2 py-0.5 rounded-full tabular-nums"
              style={{
                backgroundColor: s.slot_date === dateStr ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: s.slot_date === dateStr ? '#fff' : 'var(--text-muted)',
                fontWeight: s.slot_date === dateStr ? 600 : 400,
              }}
            >
              {formatDateShort(s.slot_date)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SlotRow 컴포넌트 (목록 뷰 행) ──────────────────────────────────────────

interface SlotRowProps {
  slot: LessonSlot
  dateStr: string   // 현재 표시 중인 날짜 — 해당 날짜의 세션 시간 조회용
  isFirst: boolean
  onToggle: () => void
  onLock: () => void
  onUnlock: () => void
  onDelete: () => void
  onViewBooking: () => void
}

function SlotRow({ slot, dateStr, isFirst, onToggle, onLock, onUnlock, onDelete, onViewBooking }: SlotRowProps) {
  const conf = SLOT_STATUS_CONFIG[slot.status]
  const isActionable = slot.status === 'OPEN' || slot.status === 'BLOCKED'
  // 요일별 시간 목록 (화 11:30, 목 19:00 형식으로 표시)
  const dowTimes = getPerDowTimes(slot.sessions ?? [])
  const todayDow = new Date(dateStr + 'T00:00:00').getDay()
  // dowTimes 없는 레거시 fallback
  const session = slot.sessions?.find((s) => s.slot_date === dateStr)
  const fallbackTime = `${(session?.start_time ?? slot.start_time ?? '').slice(0, 5)}~${(session?.end_time ?? slot.end_time ?? '').slice(0, 5)}`
  const bookedName = getBookingName(slot)
  // 회차 번호 (이 날짜가 전체 세션 중 몇 번째인지)
  const sessionIndex = slot.sessions?.findIndex((s) => s.slot_date === dateStr) ?? -1
  const sessionNumber = sessionIndex >= 0 ? sessionIndex + 1 : null
  // 기간 표시 (3/24~4/17)
  const dateRange = slot.slot_date && slot.last_session_date && slot.slot_date !== slot.last_session_date
    ? `${formatDateShort(slot.slot_date)}~${formatDateShort(slot.last_session_date)}`
    : null

  return (
    <div
      className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--bg-secondary)]"
      style={{ borderTop: isFirst ? '1px solid var(--border-color)' : '1px solid var(--border-color)' }}
    >
      {/* 상태 표시 점 */}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: SLOT_STATUS_DOT[slot.status] }}
      />

      {/* 요일별 시간 — 오늘 요일 굵게, 나머지 muted */}
      {dowTimes.length > 0 ? (
        <div className="flex items-center gap-2 shrink-0">
          {dowTimes.map(({ dow, start, end }) => {
            const isToday = dow === todayDow
            return (
              <span
                key={dow}
                className="text-sm tabular-nums"
                style={{ color: isToday ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isToday ? 600 : 400 }}
              >
                {DAY_LABELS[dow]} {start.slice(0, 5)}
              </span>
            )
          })}
        </div>
      ) : (
        <span className="text-sm font-medium shrink-0 tabular-nums" style={{ color: 'var(--text-primary)' }}>
          {fallbackTime}
        </span>
      )}

      {/* 상태 배지 */}
      <Badge variant={conf.variant}>{conf.label}</Badge>

      {/* 회차 / 기간 */}
      {sessionNumber && slot.total_sessions && (
        <span className="text-sm shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {sessionNumber}회차/{slot.total_sessions}회
        </span>
      )}
      {dateRange && (
        <span className="text-sm shrink-0 tabular-nums" style={{ color: 'var(--text-muted)' }}>
          {dateRange}
        </span>
      )}

      {/* 예약자 이름 + 회차 */}
      {slot.status === 'BOOKED' && bookedName ? (
        <button
          type="button"
          onClick={onViewBooking}
          className="text-sm font-medium hover:underline"
          style={{ color: 'var(--accent-color)' }}
        >
          {bookedName}
          {slot.booking?.sessionNumber != null && (
            <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>
              {slot.booking.sessionNumber}회차
            </span>
          )}
        </button>
      ) : slot.status === 'LOCKED' && bookedName ? (
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{bookedName}</span>
      ) : null}

      {/* 스페이서 */}
      <div className="flex-1" />

      {/* 액션 버튼 — hover 시 노출 */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {isActionable && (
          <>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
              aria-label={slot.status === 'OPEN' ? '비공개 처리' : '공개 처리'}
            >
              {slot.status === 'OPEN' ? (
                <Lock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              ) : (
                <Unlock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
              )}
            </button>
            {slot.status === 'OPEN' && (
              <button
                onClick={onLock}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
                aria-label="회원 배정"
              >
                <Search className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
              </button>
            )}
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
              aria-label="삭제"
            >
              <X className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
            </button>
          </>
        )}
        {slot.status === 'LOCKED' && (
          <button
            onClick={onUnlock}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
            aria-label="배정 해제"
          >
            <Unlock className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
          </button>
        )}
        {slot.status === 'BOOKED' && (
          <button
            onClick={onViewBooking}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-card-hover)] transition-colors"
            aria-label="예약 상세"
          >
            <User className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── 예약자 상세 모달 ────────────────────────────────────────────────────────

interface BookedSlotDetailModalProps {
  isOpen: boolean
  onClose: () => void
  slot: LessonSlot
}

function BookedSlotDetailModal({ isOpen, onClose, slot }: BookedSlotDetailModalProps) {
  const [detail, setDetail] = useState<(LessonBooking & { sessionNumber: number; memberPhone: string | null; slotDates: string[] }) | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    const bookingId = slot.booking?.id
    if (!bookingId) { setLoading(false); return }
    setLoading(true)
    getBookingWithSessionInfo(bookingId).then(({ data }) => {
      setDetail(data)
      setLoading(false)
    })
  }, [isOpen, slot.booking?.id])

  const name = detail?.member?.name || detail?.guest_name || '미확인'
  const phone = detail?.memberPhone || detail?.guest_phone || '-'
  const bookingTypeLabel = detail ? BOOKING_TYPE_LABEL[detail.booking_type] : '-'
  const statusLabel = detail ? BOOKING_STATUS_LABEL[detail.status] : '-'
  const feeAmount = detail?.fee_amount != null ? `${detail.fee_amount.toLocaleString()}원` : '-'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="예약자 정보" size="sm">
      <Modal.Body>
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            ))}
          </div>
        ) : !detail ? (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>예약 정보를 찾을 수 없습니다.</p>
        ) : (
          <div>
            {/* ── 헤더: 이름(좌) / 회차 숫자(우) 비대칭 구도 ── */}
            <div
              className="flex items-start justify-between pb-4 mb-4"
              style={{ borderBottom: '1px solid var(--border-color)' }}
            >
              <div>
                <p className="text-xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {name}
                </p>
              </div>
              {/* 회차 — 한 줄 */}
              <div className="shrink-0 ml-4">
                <p
                  className="text-2xl font-bold tabular-nums leading-none"
                  style={{ color: 'var(--accent-color)' }}
                >
                  {detail.sessionNumber}<span className="text-base font-medium ml-0.5" style={{ color: 'var(--text-muted)' }}>회차</span>
                </p>
              </div>
            </div>

            {/* ── 레슨 일시 ── */}
            <div
              className="pb-4 mb-4"
              style={{ borderBottom: '1px solid var(--border-color)' }}
            >
              {/* 시작일 ~ 마감일 (슬롯이 2개인 경우 범위 표시) */}
              {detail.slotDates.length > 0 && (
                <div className="mb-2">
                  <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>
                    {detail.slotDates.length === 1 ? '레슨 일자' : '레슨 기간'}
                  </p>
                  <p className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {detail.slotDates[0]}
                    {detail.slotDates.length > 1 && (
                      <span> ~ {detail.slotDates[detail.slotDates.length - 1]}</span>
                    )}
                  </p>
                </div>
              )}
              <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>시간</p>
              <p className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {slot.start_time ? `${slot.start_time.slice(0, 5)} ~ ${slot.end_time?.slice(0, 5) ?? ''}` : '날짜 미정'}
              </p>
            </div>

            {/* ── 메타 정보 2열 그리드 ── */}
            <div
              className="grid grid-cols-2 gap-y-3 pb-4"
              style={{ borderBottom: detail.admin_note ? '1px solid var(--border-color)' : 'none' }}
            >
              <div>
                <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>연락처</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{phone}</p>
              </div>
              <div>
                <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>결제 금액</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{feeAmount}</p>
              </div>
              <div className="col-span-2">
                <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>예약 유형</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{bookingTypeLabel}</p>
              </div>
            </div>

            {/* ── 관리자 메모 — accent 왼쪽 보더 ── */}
            {detail.admin_note && (
              <div
                className="mt-4 pl-3"
                style={{ borderLeft: '2px solid var(--accent-color)' }}
              >
                <p className="text-sm mb-0.5" style={{ color: 'var(--text-muted)' }}>관리자 메모</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{detail.admin_note}</p>
              </div>
            )}
          </div>
        )}
      </Modal.Body>
    </Modal>
  )
}

// ─── 회원 배정 모달 ─────────────────────────────────────────────────────────

interface LockSlotModalProps {
  isOpen: boolean
  onClose: () => void
  slot: LessonSlot
  onSuccess: () => void
  onError: (message: string) => void
}

function LockSlotModal({ isOpen, onClose, slot, onSuccess, onError }: LockSlotModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Array<{ id: string; name: string }>>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    const { data } = await searchClubMembers(query)
    setResults(data)
    setSearching(false)
  }

  const handleAssign = async (member: { id: string; name: string }) => {
    setSubmitting(true)
    const result = await lockSlot(slot.id, member.id, member.name)
    setSubmitting(false)
    if (result.error) { onError(result.error); return }
    onSuccess()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="회원 배정" size="sm">
      <Modal.Body>
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>
          {slot.slot_date ? `${slot.slot_date} ${slot.start_time?.slice(0, 5) ?? ''}~${slot.end_time?.slice(0, 5) ?? ''}` : '날짜 미정'} 슬롯에 회원을 배정합니다.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
            placeholder="회원 이름 검색"
            aria-label="회원 이름 검색"
            className="flex-1 px-3 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="px-3 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
          >
            {searching ? '...' : '검색'}
          </button>
        </div>
        {results.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {results.map((m) => (
              <button
                key={m.id}
                onClick={() => handleAssign(m)}
                disabled={submitting}
                className="w-full text-left px-3 py-2 rounded-lg text-sm hover:opacity-80 transition-colors"
                style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-primary)' }}
              >
                {m.name}
              </button>
            ))}
          </div>
        )}
        {results.length === 0 && query.length > 0 && !searching && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>검색 결과가 없습니다.</p>
        )}
      </Modal.Body>
    </Modal>
  )
}
