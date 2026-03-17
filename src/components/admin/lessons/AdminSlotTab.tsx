'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ChevronLeft, ChevronRight, Lock, Unlock, X, Search, CalendarX } from 'lucide-react'
import {
  createRepeatingSlots,
  updateSlotStatus,
  lockSlot,
  unlockSlot,
  deleteSlot,
  getSlotsByCoach,
  searchClubMembers,
} from '@/lib/lessons/slot-actions'
import SessionDatePicker from '@/components/clubs/sessions/SessionDatePicker'
import SessionTimePicker from '@/components/clubs/sessions/SessionTimePicker'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import type { LessonProgram } from '@/lib/lessons/types'
import type { LessonSlot, LessonSlotStatus, CreateSlotInput } from '@/lib/lessons/slot-types'
import { SLOT_STATUS_LABEL, LESSON_AVAILABLE_HOURS, isTimeInRange } from '@/lib/lessons/slot-types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const SLOT_STATUS_CONFIG: Record<LessonSlotStatus, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: '빈 슬롯', variant: 'success' },
  BLOCKED: { label: '비공개', variant: 'secondary' },
  LOCKED: { label: '배정됨', variant: 'purple' },
  BOOKED: { label: '예약됨', variant: 'info' },
  CANCELLED: { label: '취소됨', variant: 'danger' },
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const SLOT_DURATION = 30 // 30분 단위

// ─── 유틸 ────────────────────────────────────────────────────────────────────

/** 주의 시작일(월요일) 계산 */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // 월요일 기준
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

/** YYYY-MM-DD 포맷 */
function toDateStr(date: Date): string {
  return date.toISOString().substring(0, 10)
}

/** HH:MM 문자열에 분 더하기 */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** 주간 날짜 배열 (월~일) */
function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  })
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface AdminSlotTabProps {
  programs: LessonProgram[]
  programsLoading: boolean
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export function AdminSlotTab({ programs, programsLoading }: AdminSlotTabProps) {
  // 프로그램/코치 선택
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const selectedProgram = programs.find((p) => p.id === selectedProgramId) ?? null
  const coachId = selectedProgram?.coach_id ?? ''

  // 주간 뷰 상태
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const weekDates = getWeekDates(weekStart)

  // 슬롯 데이터
  const [slots, setSlots] = useState<LessonSlot[]>([])
  const [loading, setLoading] = useState(false)

  // 모달 상태
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [lockModalSlot, setLockModalSlot] = useState<LessonSlot | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LessonSlot | null>(null)

  // 피드백
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  // 프로그램 자동 선택
  useEffect(() => {
    if (programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(programs[0].id)
    }
  }, [programs, selectedProgramId])

  // 슬롯 조회
  const loadSlots = useCallback(async () => {
    if (!coachId) { setSlots([]); return }
    setLoading(true)
    const startDate = toDateStr(weekDates[0])
    const endDate = toDateStr(weekDates[6])
    const { data } = await getSlotsByCoach(coachId, startDate, endDate)
    setSlots(data)
    setLoading(false)
  }, [coachId, weekStart])

  useEffect(() => { loadSlots() }, [loadSlots])

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
  const goToday = () => setWeekStart(getWeekStart(new Date()))

  // 날짜별 슬롯 그룹핑
  const slotsByDate = new Map<string, LessonSlot[]>()
  for (const slot of slots) {
    const key = slot.slot_date
    if (!slotsByDate.has(key)) slotsByDate.set(key, [])
    slotsByDate.get(key)!.push(slot)
  }

  // 슬롯 상태 토글
  const handleToggleStatus = async (slot: LessonSlot) => {
    const newStatus: LessonSlotStatus = slot.status === 'OPEN' ? 'BLOCKED' : 'OPEN'
    const result = await updateSlotStatus(slot.id, newStatus)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setToast({ isOpen: true, message: `슬롯이 ${newStatus === 'OPEN' ? '공개' : '비공개'}되었습니다.`, type: 'success' })
    loadSlots()
  }

  // LOCKED 해제
  const handleUnlock = async (slot: LessonSlot) => {
    const result = await unlockSlot(slot.id)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setToast({ isOpen: true, message: '배정이 해제되었습니다.', type: 'success' })
    loadSlots()
  }

  // 삭제
  const handleDelete = async () => {
    if (!deleteTarget) return
    const result = await deleteSlot(deleteTarget.id)
    setDeleteTarget(null)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setToast({ isOpen: true, message: '슬롯이 삭제되었습니다.', type: 'success' })
    loadSlots()
  }

  const formatDateShort = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  const isToday = (d: Date) => toDateStr(d) === toDateStr(new Date())

  return (
    <div>
      {/* 프로그램 선택 */}
      <div className="mb-4">
        <label htmlFor="slot-program-select" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
          프로그램 선택
        </label>
        {programsLoading ? (
          <div className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        ) : (
          <select
            id="slot-program-select"
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            <option value="">프로그램을 선택하세요</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.coach?.name || '코치 미배정'})
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedProgramId && coachId && (
        <>
          {/* 주간 헤더 + 액션 */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={prevWeek} className="p-1.5 rounded-lg hover:opacity-80" style={{ backgroundColor: 'var(--bg-card-hover)' }} aria-label="이전 주">
                <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <button onClick={goToday} className="text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}>
                오늘
              </button>
              <button onClick={nextWeek} className="p-1.5 rounded-lg hover:opacity-80" style={{ backgroundColor: 'var(--bg-card-hover)' }} aria-label="다음 주">
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <span className="text-sm font-medium ml-1" style={{ color: 'var(--text-primary)' }}>
                {weekDates[0].getFullYear()}년 {weekDates[0].getMonth() + 1}월
              </span>
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

          {/* 주간 달력 그리드 */}
          {loading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-20 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {weekDates.map((date) => {
                const dateStr = toDateStr(date)
                const daySlots = slotsByDate.get(dateStr) || []
                const dayNum = date.getDay()
                const range = LESSON_AVAILABLE_HOURS[dayNum]
                const today = isToday(date)

                return (
                  <div
                    key={dateStr}
                    className="rounded-lg p-3"
                    style={{
                      backgroundColor: today ? 'var(--bg-card)' : 'var(--bg-secondary)',
                      border: today ? '1px solid var(--accent-color)' : '1px solid transparent',
                    }}
                  >
                    {/* 날짜 헤더 */}
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          dayNum === 0 ? 'text-red-500' : dayNum === 6 ? 'text-blue-500' : ''
                        }`}
                        style={{
                          backgroundColor: today ? 'var(--accent-color)' : 'transparent',
                          color: today ? 'var(--bg-primary)' : undefined,
                        }}
                      >
                        {DAY_LABELS[dayNum]}
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatDateShort(date)}
                      </span>
                      {range && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {range.start}~{range.end}
                        </span>
                      )}
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        ({daySlots.length}개)
                      </span>
                    </div>

                    {/* 슬롯 목록 */}
                    {daySlots.length === 0 ? (
                      <p className="text-xs pl-8" style={{ color: 'var(--text-muted)' }}>슬롯 없음</p>
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

// ─── SlotChip 컴포넌트 ──────────────────────────────────────────────────────

interface SlotChipProps {
  slot: LessonSlot
  onToggle: () => void
  onLock: () => void
  onUnlock: () => void
  onDelete: () => void
}

function SlotChip({ slot, onToggle, onLock, onUnlock, onDelete }: SlotChipProps) {
  const conf = SLOT_STATUS_CONFIG[slot.status]
  const time = `${slot.start_time.slice(0, 5)}~${slot.end_time.slice(0, 5)}`
  const isActionable = slot.status === 'OPEN' || slot.status === 'BLOCKED'

  return (
    <div
      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{time}</span>
      <Badge variant={conf.variant}>{conf.label}</Badge>

      {/* LOCKED일 때 회원 이름 표시 */}
      {slot.status === 'LOCKED' && slot.locked_member && (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {slot.locked_member.name}
        </span>
      )}
      {slot.status === 'LOCKED' && slot.notes && !slot.locked_member && (
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {slot.notes}
        </span>
      )}

      {/* 액션 버튼 */}
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

  // 생성할 슬롯 미리보기
  const previewSlots = generateSlotPreview(startDate, endDate, startTime, endTime, selectedDays)

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (previewSlots.length === 0) {
      onError('생성할 슬롯이 없습니다.')
      return
    }

    setSubmitting(true)
    const result = await createRepeatingSlots(programId, coachId, previewSlots)
    setSubmitting(false)

    if (result.error) {
      onError(result.error)
      return
    }
    onSuccess(result.count)
    // 폼 리셋
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
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>시작일</label>
                  <SessionDatePicker value={startDate} onChange={setStartDate} placeholder="시작일 선택" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>종료일</label>
                  <SessionDatePicker value={endDate} onChange={setEndDate} placeholder="종료일 선택" />
                </div>
              </div>
            </div>

            {/* 시간 범위 (30분 단위 자동 분할) */}
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                시간 범위 <span style={{ color: 'var(--color-danger)' }}>*</span>
              </p>
              <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                30분 단위로 자동 분할됩니다.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>시작</label>
                  <SessionTimePicker value={startTime} onChange={setStartTime} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>종료</label>
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
                  className="rounded-lg p-3 text-xs space-y-1 max-h-40 overflow-y-auto"
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
      // 30분 단위로 분할
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
    if (result.error) {
      onError(result.error)
      return
    }
    onSuccess()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="회원 배정" size="sm">
      <Modal.Body>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
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
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>검색 결과가 없습니다.</p>
        )}
      </Modal.Body>
    </Modal>
  )
}
