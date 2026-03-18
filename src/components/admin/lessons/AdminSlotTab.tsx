'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronLeft, ChevronRight, Lock, Unlock, X, Search, CalendarDays, List, User, Phone, CreditCard, Hash } from 'lucide-react'
import {
  createRepeatingSlots,
  updateSlotStatus,
  lockSlot,
  unlockSlot,
  deleteSlot,
  getSlotsByCoach,
  searchClubMembers,
  getBookingWithSessionInfo,
} from '@/lib/lessons/slot-actions'
import SessionDatePicker from '@/components/clubs/sessions/SessionDatePicker'
import SessionTimePicker from '@/components/clubs/sessions/SessionTimePicker'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import type { LessonProgram } from '@/lib/lessons/types'
import type { LessonSlot, LessonSlotStatus, LessonBooking, CreateSlotInput } from '@/lib/lessons/slot-types'
import { LESSON_AVAILABLE_HOURS, BOOKING_TYPE_LABEL, BOOKING_STATUS_LABEL, isTimeInRange } from '@/lib/lessons/slot-types'

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

const LESSON_DURATIONS = [20, 30] as const
type LessonDuration = (typeof LESSON_DURATIONS)[number]

// ─── 유틸 ────────────────────────────────────────────────────────────────────

/** YYYY-MM-DD 포맷 — 로컬 타임존 기준 (toISOString은 UTC 변환으로 날짜 밀림) */
function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** HH:MM 문자열에 분 더하기 */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
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

interface AdminSlotTabProps {
  programs: LessonProgram[]
  programsLoading: boolean
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export function AdminSlotTab({ programs, programsLoading }: AdminSlotTabProps) {
  // 코치별 그룹핑 (탭 구성)
  const coachGroups = programs.reduce<Array<{ coachId: string; coachName: string; programs: LessonProgram[] }>>(
    (acc, p) => {
      const existing = acc.find((g) => g.coachId === p.coach_id)
      if (existing) {
        existing.programs.push(p)
      } else {
        acc.push({ coachId: p.coach_id, coachName: p.coach?.name || '미지정', programs: [p] })
      }
      return acc
    },
    []
  )

  // 선택된 코치 탭 (기본: 첫 번째)
  const [selectedCoachId, setSelectedCoachId] = useState('')
  const selectedGroup = coachGroups.find((g) => g.coachId === selectedCoachId) ?? coachGroups[0] ?? null
  // 선택된 코치의 프로그램 중 OPEN 우선
  const selectedProgram = selectedGroup
    ? (selectedGroup.programs.find((p) => p.status === 'OPEN') ?? selectedGroup.programs[0] ?? null)
    : null
  const selectedProgramId = selectedProgram?.id ?? ''
  const coachId = selectedGroup?.coachId ?? ''

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
    if (coachGroups.length > 0 && !selectedCoachId) {
      setSelectedCoachId(coachGroups[0].coachId)
    }
  }, [coachGroups.length])

  // 슬롯 조회 (뷰 모드에 따라 주간/월간)
  const loadSlots = useCallback(async () => {
    if (!coachId) { setSlots([]); return }
    setLoading(true)
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
    setLoading(false)
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

  // 날짜별 슬롯 맵
  const slotsByDate = new Map<string, LessonSlot[]>()
  for (const slot of slots) {
    const key = slot.slot_date
    if (!slotsByDate.has(key)) slotsByDate.set(key, [])
    slotsByDate.get(key)!.push(slot)
  }

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
      {/* 코치 탭 */}
      {programsLoading ? (
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          ))}
        </div>
      ) : coachGroups.length === 0 ? (
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>등록된 프로그램이 없습니다.</p>
      ) : (
        <div
          className="flex gap-1 mb-4 border-b"
          style={{ borderColor: 'var(--border-color)' }}
          role="tablist"
          aria-label="코치 선택"
        >
          {coachGroups.map((group) => {
            const isActive = (selectedCoachId || coachGroups[0]?.coachId) === group.coachId
            return (
              <button
                key={group.coachId}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCoachId(group.coachId)}
                className="px-4 py-2 text-sm font-medium rounded-t-lg transition-colors"
                style={{
                  backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                  color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                  borderBottom: isActive ? '2px solid var(--accent-color)' : '2px solid transparent',
                  marginBottom: '-1px',
                }}
              >
                {group.coachName}
              </button>
            )
          })}
        </div>
      )}

      {selectedProgramId && coachId && (
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
                    className="text-sm px-2 py-1 rounded-lg font-medium"
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
                    className="text-sm px-2 py-1 rounded-lg font-medium"
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
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium"
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
      {selectedProgram && coachId && (
        <CreateSlotModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          programId={selectedProgramId}
          coachId={coachId}
          onSuccess={(count) => {
            setToast({ isOpen: true, message: `${count}개 슬롯이 등록되었습니다.`, type: 'success' })
            setCreateModalOpen(false)
            loadSlots()
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
        message={deleteTarget ? `${deleteTarget.slot_date} ${deleteTarget.start_time.slice(0, 5)}~${deleteTarget.end_time.slice(0, 5)} 슬롯을 삭제하시겠습니까?` : ''}
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
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>이 날짜에 슬롯이 없습니다</p>
        </div>
      ) : (
        <div>
          {slots.map((slot, idx) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              isFirst={idx === 0}
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
  const time = `${slot.start_time.slice(0, 5)}~${slot.end_time.slice(0, 5)}`
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

// ─── SlotRow 컴포넌트 (목록 뷰 행) ──────────────────────────────────────────

interface SlotRowProps {
  slot: LessonSlot
  isFirst: boolean
  onToggle: () => void
  onLock: () => void
  onUnlock: () => void
  onDelete: () => void
  onViewBooking: () => void
}

function SlotRow({ slot, isFirst, onToggle, onLock, onUnlock, onDelete, onViewBooking }: SlotRowProps) {
  const conf = SLOT_STATUS_CONFIG[slot.status]
  const time = `${slot.start_time.slice(0, 5)}~${slot.end_time.slice(0, 5)}`
  const isActionable = slot.status === 'OPEN' || slot.status === 'BLOCKED'
  const bookedName = getBookingName(slot)

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

      {/* 시간 — tabular-nums로 정렬 고정 */}
      <span
        className="text-sm font-medium shrink-0 tabular-nums"
        style={{ color: 'var(--text-primary)', minWidth: '7.5rem' }}
      >
        {time}
      </span>

      {/* 상태 배지 */}
      <Badge variant={conf.variant}>{conf.label}</Badge>

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
                {slot.start_time.slice(0, 5)} ~ {slot.end_time.slice(0, 5)}
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

// ─── 슬롯 등록 모달 ─────────────────────────────────────────────────────────

interface CreateSlotModalProps {
  isOpen: boolean
  onClose: () => void
  programId: string
  coachId: string
  onSuccess: (count: number) => void
  onError: (message: string) => void
}

function CreateSlotModal({ isOpen, onClose, programId, coachId, onSuccess, onError }: CreateSlotModalProps) {
  const now = new Date()
  const [frequency, setFrequency] = useState<1 | 2>(1)
  const [targetYear, setTargetYear] = useState(now.getFullYear())
  const [targetMonth, setTargetMonth] = useState(now.getMonth())
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [startTimes, setStartTimes] = useState<Record<number, string>>({})
  const [duration, setDuration] = useState<LessonDuration>(30)
  const [submitting, setSubmitting] = useState(false)

  const previewSlots = generateMonthlySlots(targetYear, targetMonth, selectedDays, startTimes, duration)

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day)
      if (prev.length >= frequency) {
        // 최대 초과 시 가장 먼저 선택한 것 교체
        const next = [...prev.slice(1), day]
        return next
      }
      return [...prev, day]
    })
  }

  const prevMonth = () => {
    if (targetMonth === 0) { setTargetYear((y) => y - 1); setTargetMonth(11) }
    else setTargetMonth((m) => m - 1)
  }
  const nextMonth = () => {
    if (targetMonth === 11) { setTargetYear((y) => y + 1); setTargetMonth(0) }
    else setTargetMonth((m) => m + 1)
  }

  const handleFrequencyChange = (freq: 1 | 2) => {
    setFrequency(freq)
    // 주1회로 변경 시 2개 이상 선택된 요일 정리
    if (freq === 1 && selectedDays.length > 1) {
      setSelectedDays(selectedDays.slice(0, 1))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (previewSlots.length === 0) { onError('생성할 슬롯이 없습니다.'); return }

    setSubmitting(true)
    const result = await createRepeatingSlots(programId, coachId, previewSlots)
    setSubmitting(false)

    if (result.error) { onError(result.error); return }
    onSuccess(result.count)
    setSelectedDays([])
    setStartTimes({})
  }

  const isReady = selectedDays.length === frequency && selectedDays.every((d) => startTimes[d])

  // 섹션 레이블 헬퍼
  const SectionLabel = ({ step, children }: { step: number; children: React.ReactNode }) => (
    <div className="flex items-center gap-2 mb-3">
      <span
        className="w-5 h-5 flex items-center justify-center rounded-full text-sm font-bold shrink-0"
        style={{ backgroundColor: 'var(--accent-color)', color: '#fff', fontSize: '11px' }}
      >
        {step}
      </span>
      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{children}</span>
    </div>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="월간 레슨 슬롯 등록" size="md">
      <Modal.Body>
        <form id="create-slot-form" onSubmit={handleSubmit} noValidate className="space-y-6">

          {/* ① 레슨 빈도 */}
          <div>
            <SectionLabel step={1}>레슨 빈도</SectionLabel>
            <div className="grid grid-cols-2 gap-3" role="group" aria-label="레슨 빈도 선택">
              {([
                { f: 1, sub: '매주 1일 · 월 4회' },
                { f: 2, sub: '매주 2일 · 월 8회' },
              ] as const).map(({ f, sub }) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={frequency === f}
                  onClick={() => handleFrequencyChange(f)}
                  className="flex flex-col items-center justify-center gap-1 py-4 rounded-2xl transition-all"
                  style={{
                    backgroundColor: frequency === f ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: frequency === f ? '#fff' : 'var(--text-secondary)',
                    boxShadow: frequency === f ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                  }}
                >
                  <span className="text-xl font-bold">주 {f}회</span>
                  <span className="text-sm" style={{ opacity: 0.75 }}>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ② 대상 월 */}
          <div>
            <SectionLabel step={2}>대상 월</SectionLabel>
            <div
              className="flex items-center justify-between px-2 py-2 rounded-xl"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
              <button type="button" onClick={prevMonth}
                className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--bg-card)' }}
                aria-label="이전 달"
              >
                <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <span className="text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                {targetYear}년 {targetMonth + 1}월
              </span>
              <button type="button" onClick={nextMonth}
                className="w-9 h-9 flex items-center justify-center rounded-lg transition-colors"
                style={{ backgroundColor: 'var(--bg-card)' }}
                aria-label="다음 달"
              >
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>
          </div>

          {/* ③ 요일 선택 */}
          <div>
            <SectionLabel step={3}>
              요일 선택
              <span className="ml-1.5 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                {selectedDays.length}/{frequency}
              </span>
            </SectionLabel>
            <div className="grid grid-cols-7 gap-1.5" role="group" aria-label="요일 선택">
              {DAY_LABELS.map((label, idx) => {
                const selected = selectedDays.includes(idx)
                const isWeekend = idx === 0 || idx === 6
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleDay(idx)}
                    className="flex flex-col items-center justify-center gap-0.5 py-3 rounded-xl transition-all"
                    style={{
                      backgroundColor: selected ? 'var(--accent-color)' : 'var(--bg-secondary)',
                      color: selected ? '#fff' : isWeekend ? 'var(--color-danger)' : 'var(--text-secondary)',
                      boxShadow: selected ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    <span className="text-sm font-semibold">{label}</span>
                    {selected && (
                      <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.7)' }} />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ④ 레슨 시간 */}
          <div>
            <SectionLabel step={4}>레슨 시간</SectionLabel>
            <div className="grid grid-cols-2 gap-3" role="group" aria-label="레슨 시간 선택">
              {LESSON_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={duration === d}
                  onClick={() => setDuration(d)}
                  className="flex flex-col items-center justify-center gap-0.5 py-4 rounded-2xl transition-all"
                  style={{
                    backgroundColor: duration === d ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: duration === d ? '#fff' : 'var(--text-secondary)',
                    boxShadow: duration === d ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
                  }}
                >
                  <span className="text-2xl font-bold tabular-nums">{d}</span>
                  <span className="text-sm" style={{ opacity: 0.75 }}>분</span>
                </button>
              ))}
            </div>
          </div>

          {/* ⑤ 요일별 시작 시간 */}
          {selectedDays.length > 0 && (
            <div>
              <SectionLabel step={5}>시작 시간</SectionLabel>
              <div className="space-y-2">
                {selectedDays.map((day) => {
                  const range = LESSON_AVAILABLE_HOURS[day]
                  const isWeekend = day === 0 || day === 6
                  return (
                    <div
                      key={day}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <span
                        className="w-9 h-9 flex items-center justify-center rounded-xl text-sm font-bold shrink-0"
                        style={{
                          backgroundColor: 'var(--accent-color)',
                          color: '#fff',
                        }}
                      >
                        {DAY_LABELS[day]}
                      </span>
                      <div className="flex-1">
                        <SessionTimePicker
                          value={startTimes[day] || ''}
                          onChange={(val) => setStartTimes((prev) => ({ ...prev, [day]: val }))}
                        />
                      </div>
                      {range && (
                        <span className="text-sm shrink-0" style={{ color: isWeekend ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                          ~{range.end}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ⑥ 슬롯 미리보기 */}
          {isReady && previewSlots.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="w-5 h-5 flex items-center justify-center rounded-full text-sm font-bold shrink-0"
                  style={{ backgroundColor: 'var(--color-success)', color: '#fff', fontSize: '11px' }}
                >
                  ✓
                </span>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  생성 예정
                </span>
                <span
                  className="ml-auto text-sm font-semibold px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-success-subtle)', color: 'var(--color-success)' }}
                >
                  {previewSlots.length}개 슬롯
                </span>
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                {previewSlots.map((s, i) => {
                  const date = new Date(s.slot_date + 'T00:00:00')
                  const dow = date.getDay()
                  const isWeekend = dow === 0 || dow === 6
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 px-4 py-3"
                      style={{
                        borderTop: i > 0 ? '1px solid var(--border-color)' : 'none',
                        backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                      }}
                    >
                      <span
                        className="text-sm font-bold w-6 text-center shrink-0"
                        style={{ color: isWeekend ? 'var(--color-danger)' : 'var(--accent-color)' }}
                      >
                        {DAY_LABELS[dow]}
                      </span>
                      <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {date.getMonth() + 1}월 {date.getDate()}일
                      </span>
                      <span
                        className="ml-auto text-sm font-semibold tabular-nums"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {s.start_time} ~ {s.end_time}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 시간 미설정 안내 */}
          {!isReady && selectedDays.length > 0 && selectedDays.some((d) => !startTimes[d]) && (
            <p className="text-sm text-center py-1" style={{ color: 'var(--text-muted)' }}>
              시작 시간을 설정하면 미리보기가 표시됩니다
            </p>
          )}

        </form>
      </Modal.Body>
      <Modal.Footer>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
        >
          취소
        </button>
        <button
          type="submit"
          form="create-slot-form"
          disabled={submitting || !isReady || previewSlots.length === 0}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            backgroundColor: isReady && previewSlots.length > 0 ? 'var(--accent-color)' : 'var(--bg-secondary)',
            color: isReady && previewSlots.length > 0 ? '#fff' : 'var(--text-muted)',
            boxShadow: isReady && previewSlots.length > 0 ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
          }}
        >
          {submitting ? '등록 중...' : isReady && previewSlots.length > 0 ? `${previewSlots.length}개 슬롯 등록` : '등록'}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

/** 날짜 범위 + 시간 범위 + 요일로 30분 슬롯 목록 생성 */
/** 해당 월에서 특정 요일의 모든 날짜 반환 */
function getDaysOfWeekInMonth(year: number, month: number, dayOfWeek: number): string[] {
  const dates: string[] = []
  const cur = new Date(year, month, 1)
  while (cur.getMonth() === month) {
    if (cur.getDay() === dayOfWeek) dates.push(toDateStr(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

/** 월별 슬롯 미리보기 생성 — 요일별 시작시간 + 레슨 시간(분) */
function generateMonthlySlots(
  year: number,
  month: number,
  days: number[],
  startTimes: Record<number, string>,
  duration: LessonDuration
): CreateSlotInput[] {
  if (days.length === 0) return []

  const slots: CreateSlotInput[] = []
  for (const day of days) {
    const startTime = startTimes[day]
    if (!startTime) continue
    const endTime = addMinutes(startTime, duration)

    for (const date of getDaysOfWeekInMonth(year, month, day)) {
      if (isTimeInRange(date, startTime, endTime)) {
        slots.push({ slot_date: date, start_time: startTime, end_time: endTime })
      }
    }
  }

  return slots.sort((a, b) => a.slot_date.localeCompare(b.slot_date) || a.start_time.localeCompare(b.start_time))
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
          {slot.slot_date} {slot.start_time.slice(0, 5)}~{slot.end_time.slice(0, 5)} 슬롯에 회원을 배정합니다.
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
