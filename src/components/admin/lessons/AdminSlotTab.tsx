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

const SLOT_STATUS_CONFIG: Record<LessonSlotStatus, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: '빈 슬롯', variant: 'success' },
  BLOCKED: { label: '비공개', variant: 'secondary' },
  LOCKED: { label: '배정됨', variant: 'purple' },
  BOOKED: { label: '예약됨', variant: 'info' },
  CANCELLED: { label: '취소됨', variant: 'danger' },
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
/** 달력 요일 헤더 — 월요일 시작 */
const WEEK_HEADER = ['월', '화', '수', '목', '금', '토', '일']

const SLOT_DURATION = 30 // 30분 단위

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

  // 현재 월 (1일로 고정)
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

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

  // 슬롯 조회 (월 단위)
  const loadSlots = useCallback(async () => {
    if (!coachId) { setSlots([]); return }
    setLoading(true)
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = toDateStr(new Date(year, month, 1))
    const lastDay = toDateStr(new Date(year, month + 1, 0))
    const { data } = await getSlotsByCoach(coachId, firstDay, lastDay)
    setSlots(data)
    setLoading(false)
  }, [coachId, currentMonth])

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

  // 이번 달 날짜 배열 (목록 뷰)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthDates = Array.from({ length: daysInMonth }, (_, i) =>
    toDateStr(new Date(year, month, i + 1))
  )

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
          {/* 월 네비게이션 + 뷰 전환 + 슬롯 등록 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
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
            // ── 달력 뷰: 좌(월간 달력) + 우(선택 날짜 슬롯) ───────────
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              {/* 좌: 월간 달력 */}
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                {/* 요일 헤더 */}
                <div className="grid grid-cols-7 mb-1">
                  {WEEK_HEADER.map((d, i) => (
                    <div
                      key={d}
                      className="text-center text-sm font-medium py-1"
                      style={{
                        color: i === 5 ? 'var(--color-info)' : i === 6 ? 'var(--color-danger)' : 'var(--text-muted)',
                      }}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* 날짜 그리드 */}
                <div className="grid grid-cols-7 gap-y-0.5">
                  {calendarDays.map(({ date, isCurrentMonth }) => {
                    const dateStr = toDateStr(date)
                    const daySlots = slotsByDate.get(dateStr) || []
                    const isSelected = selectedDate === dateStr
                    const isToday = dateStr === todayStr
                    const dow = date.getDay()

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDate(dateStr)}
                        className="flex flex-col items-center py-1 rounded-lg transition-colors"
                        style={{
                          backgroundColor: isSelected
                            ? 'var(--accent-color)'
                            : isToday
                            ? 'var(--color-success-subtle)'
                            : 'transparent',
                          opacity: isCurrentMonth ? 1 : 0.3,
                        }}
                        aria-label={`${dateStr} ${daySlots.length}개 슬롯`}
                        aria-pressed={isSelected}
                      >
                        <span
                          className="text-sm font-medium leading-snug"
                          style={{
                            color: isSelected
                              ? 'var(--bg-primary)'
                              : dow === 0
                              ? 'var(--color-danger)'
                              : dow === 6
                              ? 'var(--color-info)'
                              : 'var(--text-primary)',
                          }}
                        >
                          {date.getDate()}
                        </span>
                        {/* 슬롯 있는 날 점 */}
                        <span
                          className="w-1 h-1 rounded-full mt-0.5"
                          style={{
                            backgroundColor: daySlots.length > 0
                              ? isSelected ? 'rgba(255,255,255,0.8)' : 'var(--accent-color)'
                              : 'transparent',
                          }}
                        />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* 우: 선택 날짜 슬롯 패널 */}
              <div
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', minHeight: '200px' }}
              >
                {!selectedDate ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <CalendarDays className="w-8 h-8 mb-2" style={{ color: 'var(--text-muted)' }} />
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
            // ── 목록 뷰: 이번 달 전체 날짜 ───────────────────────────
            <div className="space-y-1">
              {monthDates.map((dateStr) => {
                const daySlots = slotsByDate.get(dateStr) || []
                const date = new Date(dateStr + 'T00:00:00')
                const dow = date.getDay()
                const isToday = dateStr === todayStr

                return (
                  <div
                    key={dateStr}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: isToday ? 'var(--bg-card)' : 'var(--bg-secondary)',
                      border: isToday ? '1px solid var(--accent-color)' : '1px solid transparent',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-sm font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: isToday ? 'var(--accent-color)' : 'transparent',
                          color: isToday
                            ? 'var(--bg-primary)'
                            : dow === 0
                            ? 'var(--color-danger)'
                            : dow === 6
                            ? 'var(--color-info)'
                            : 'var(--text-secondary)',
                        }}
                      >
                        {DAY_LABELS[dow]}
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {date.getMonth() + 1}/{date.getDate()}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        ({daySlots.length}개)
                      </span>
                    </div>

                    {daySlots.length === 0 ? (
                      <p className="text-sm pl-8" style={{ color: 'var(--text-muted)' }}>슬롯 없음</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 pl-8">
                        {daySlots.map((slot) => (
                          <SlotChip
                            key={slot.id}
                            slot={slot}
                            onToggle={() => handleToggleStatus(slot)}
                            onLock={() => setLockModalSlot(slot)}
                            onUnlock={() => handleUnlock(slot)}
                            onDelete={() => setDeleteTarget(slot)}
                            onViewBooking={() => setBookingModalSlot(slot)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
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

  return (
    <div>
      <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        {date.getMonth() + 1}월 {date.getDate()}일 ({DAY_LABELS[dow]})
        <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
          {slots.length}개 슬롯
        </span>
      </h3>

      {slots.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>
          이 날짜에 슬롯이 없습니다
        </p>
      ) : (
        <div className="space-y-1.5">
          {slots.map((slot) => {
            const conf = SLOT_STATUS_CONFIG[slot.status]
            const isActionable = slot.status === 'OPEN' || slot.status === 'BLOCKED'
            const bookedName = getBookingName(slot)

            return (
              <div
                key={slot.id}
                className="flex items-center justify-between px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium shrink-0" style={{ color: 'var(--text-primary)' }}>
                    {slot.start_time.slice(0, 5)}~{slot.end_time.slice(0, 5)}
                  </span>
                  <Badge variant={conf.variant}>{conf.label}</Badge>
                  {/* BOOKED: 예약자 이름 + 회차 — 클릭 시 상세 모달 */}
                  {slot.status === 'BOOKED' && bookedName && (
                    <button
                      type="button"
                      onClick={() => onViewBooking(slot)}
                      className="text-sm font-medium hover:underline truncate"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      {bookedName}
                      {slot.booking?.sessionNumber != null && (
                        <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>
                          {slot.booking.sessionNumber}회차
                        </span>
                      )}
                    </button>
                  )}
                  {/* LOCKED: 배정된 회원 이름 */}
                  {slot.status === 'LOCKED' && bookedName && (
                    <span className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                      {bookedName}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {isActionable && (
                    <>
                      <button onClick={() => onToggle(slot)} className="p-1 rounded hover:opacity-70" aria-label={slot.status === 'OPEN' ? '비공개 처리' : '공개 처리'}>
                        {slot.status === 'OPEN' ? (
                          <Lock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                        )}
                      </button>
                      {slot.status === 'OPEN' && (
                        <button onClick={() => onLock(slot)} className="p-1 rounded hover:opacity-70" aria-label="회원 배정">
                          <Search className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
                        </button>
                      )}
                      <button onClick={() => onDelete(slot)} className="p-1 rounded hover:opacity-70" aria-label="삭제">
                        <X className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                      </button>
                    </>
                  )}
                  {slot.status === 'LOCKED' && (
                    <button onClick={() => onUnlock(slot)} className="p-1 rounded hover:opacity-70" aria-label="배정 해제">
                      <Unlock className="w-3.5 h-3.5" style={{ color: 'var(--color-danger)' }} />
                    </button>
                  )}
                  {/* BOOKED: 상세 보기 버튼 */}
                  {slot.status === 'BOOKED' && (
                    <button onClick={() => onViewBooking(slot)} className="p-1 rounded hover:opacity-70" aria-label="예약 상세">
                      <User className="w-3.5 h-3.5" style={{ color: 'var(--accent-color)' }} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
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

// ─── 예약자 상세 모달 ────────────────────────────────────────────────────────

interface BookedSlotDetailModalProps {
  isOpen: boolean
  onClose: () => void
  slot: LessonSlot
}

function BookedSlotDetailModal({ isOpen, onClose, slot }: BookedSlotDetailModalProps) {
  const [detail, setDetail] = useState<(LessonBooking & { sessionNumber: number; memberPhone: string | null }) | null>(null)
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
          <div className="space-y-3">
            {/* 슬롯 정보 */}
            <div className="rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>레슨 일시</p>
              <p className="text-sm font-medium mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {slot.slot_date} {slot.start_time.slice(0, 5)}~{slot.end_time.slice(0, 5)}
              </p>
            </div>

            {/* 회차 */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <Hash className="w-4 h-4 shrink-0" style={{ color: 'var(--accent-color)' }} />
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>회차</p>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {detail.sessionNumber}번째 레슨
                </p>
              </div>
            </div>

            {/* 이름 */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <User className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{detail.is_guest ? '비회원' : '회원'}</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</p>
              </div>
            </div>

            {/* 연락처 */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <Phone className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>연락처</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{phone}</p>
              </div>
            </div>

            {/* 예약 유형 + 결제 */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <CreditCard className="w-4 h-4 shrink-0" style={{ color: 'var(--text-muted)' }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>예약 유형 / 결제</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{bookingTypeLabel}</p>
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{feeAmount}</span>
                  <Badge variant={detail.status === 'CONFIRMED' ? 'success' : detail.status === 'CANCELLED' ? 'danger' : 'warning'}>
                    {statusLabel}
                  </Badge>
                </div>
              </div>
            </div>

            {/* 관리자 메모 */}
            {detail.admin_note && (
              <div className="px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
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
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [startTime, setStartTime] = useState('10:00')
  const [endTime, setEndTime] = useState('12:00')
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)

  const previewSlots = generateSlotPreview(startDate, endDate, startTime, endTime, selectedDays)

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (previewSlots.length === 0) { onError('생성할 슬롯이 없습니다.'); return }

    setSubmitting(true)
    const result = await createRepeatingSlots(programId, coachId, previewSlots)
    setSubmitting(false)

    if (result.error) { onError(result.error); return }
    onSuccess(result.count)
    setStartDate('')
    setEndDate('')
    setSelectedDays([])
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="슬롯 일괄 등록" size="lg">
      <Modal.Body>
        <form id="create-slot-form" onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* 기간 */}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              기간 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>시작일</label>
                <SessionDatePicker value={startDate} onChange={setStartDate} placeholder="시작일 선택" />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>종료일</label>
                <SessionDatePicker value={endDate} onChange={setEndDate} placeholder="종료일 선택" />
              </div>
            </div>
          </div>

          {/* 시간 범위 */}
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              시간 범위 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </p>
            <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>30분 단위로 자동 분할됩니다.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>시작</label>
                <SessionTimePicker value={startTime} onChange={setStartTime} />
              </div>
              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>종료</label>
                <SessionTimePicker value={endTime} onChange={setEndTime} />
              </div>
            </div>
          </div>

          {/* 요일 선택 */}
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              요일 <span style={{ color: 'var(--color-danger)' }}>*</span>
            </p>
            <div className="flex gap-1.5" role="group" aria-label="요일 선택">
              {DAY_LABELS.map((label, idx) => {
                const range = LESSON_AVAILABLE_HOURS[idx]
                return (
                  <button
                    key={idx}
                    type="button"
                    aria-pressed={selectedDays.includes(idx)}
                    onClick={() => toggleDay(idx)}
                    className="w-10 h-10 rounded-full text-sm font-medium transition-colors"
                    title={range ? `${range.start}~${range.end}` : ''}
                    style={{
                      backgroundColor: selectedDays.includes(idx) ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                      color: selectedDays.includes(idx) ? 'var(--bg-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 미리보기 */}
          {previewSlots.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                생성 예정 ({previewSlots.length}개)
              </p>
              <div
                className="rounded-lg p-3 text-sm space-y-1 max-h-40 overflow-y-auto"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                {previewSlots.slice(0, 30).map((s, i) => {
                  const d = new Date(s.slot_date + 'T00:00:00')
                  const dayLabel = DAY_LABELS[d.getDay()]
                  const valid = isTimeInRange(s.slot_date, s.start_time, s.end_time)
                  return (
                    <div key={i} style={{ color: valid ? 'var(--text-secondary)' : 'var(--color-danger)' }}>
                      {s.slot_date} ({dayLabel}) {s.start_time}~{s.end_time}
                      {!valid && ' ⚠ 가능 시간 초과'}
                    </div>
                  )
                })}
                {previewSlots.length > 30 && (
                  <p style={{ color: 'var(--text-muted)' }}>... 외 {previewSlots.length - 30}개</p>
                )}
              </div>
            </div>
          )}
        </form>
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
          form="create-slot-form"
          disabled={submitting || previewSlots.length === 0}
          className="flex-1 btn-primary"
          style={{ opacity: previewSlots.length === 0 ? 0.5 : 1 }}
        >
          {submitting ? '등록 중...' : `${previewSlots.length}개 등록`}
        </button>
      </Modal.Footer>
    </Modal>
  )
}

/** 날짜 범위 + 시간 범위 + 요일로 30분 슬롯 목록 생성 */
function generateSlotPreview(
  startDate: string,
  endDate: string,
  startTime: string,
  endTime: string,
  days: number[]
): CreateSlotInput[] {
  if (!startDate || !endDate || !startTime || !endTime || days.length === 0) return []

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (start > end) return []

  const daySet = new Set(days)
  const results: CreateSlotInput[] = []
  const cur = new Date(start)

  while (cur <= end) {
    if (daySet.has(cur.getDay())) {
      const dateStr = toDateStr(cur)
      let time = startTime
      while (time < endTime) {
        const next = addMinutes(time, SLOT_DURATION)
        if (next <= endTime) {
          results.push({ slot_date: dateStr, start_time: time, end_time: next })
        }
        time = next
      }
    }
    cur.setDate(cur.getDate() + 1)
  }

  return results
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
