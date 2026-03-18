'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { createLessonSlot, extendSlotWithWizard } from '@/lib/lessons/slot-actions'
import { Modal } from '@/components/common/Modal'
import SessionTimePicker from '@/components/clubs/sessions/SessionTimePicker'
import type { SlotSession } from '@/lib/lessons/slot-types'
import { LESSON_AVAILABLE_HOURS, isTimeInRange } from '@/lib/lessons/slot-types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
/** 달력 요일 헤더 — 월요일 시작 */
const WEEK_HEADER = ['월', '화', '수', '목', '금', '토', '일']
const LESSON_DURATIONS = [20, 30] as const
type LessonDuration = (typeof LESSON_DURATIONS)[number]

const WIZARD_STEP_LABELS = ['레슨 회수', '레슨 시간', '요일', '시작일', '시간', '요금'] as const
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

const WIZARD_STEP_TITLES: Record<WizardStep, string> = {
  1: '주당 레슨 회수를\n선택해주세요',
  2: '회당 레슨 시간을\n선택해주세요',
  3: '레슨 요일을\n선택해주세요',
  4: '레슨 시작일을\n선택해주세요',
  5: '레슨 시간을\n설정해주세요',
  6: '레슨 요금을\n입력해주세요',
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function toDateStr(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m + minutes
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function getCalendarDays(year: number, month: number): Array<{ date: Date; isCurrentMonth: boolean }> {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startDow = firstDay.getDay()
  const startOffset = startDow === 0 ? 6 : startDow - 1

  const days: Array<{ date: Date; isCurrentMonth: boolean }> = []

  for (let i = startOffset; i > 0; i--) {
    const d = new Date(firstDay)
    d.setDate(d.getDate() - i)
    days.push({ date: d, isCurrentMonth: false })
  }

  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), isCurrentMonth: true })
  }

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

/** 시작일부터 frequency × 4회 세션 생성 */
function generateSessionsFromFrequency(
  frequency: 1 | 2,
  schedules: Array<{ dow: number; time: string }>,
  duration: LessonDuration,
  startDate: string,
): SlotSession[] {
  const totalSessions = frequency * 4
  const sessions: SlotSession[] = []
  const current = new Date(startDate + 'T00:00:00')

  while (sessions.length < totalSessions) {
    const dow = current.getDay()
    const schedule = schedules.find((s) => s.dow === dow)
    if (schedule?.time) {
      const dateStr = toDateStr(current)
      const endTime = addMinutes(schedule.time, duration)
      if (isTimeInRange(dateStr, schedule.time, endTime)) {
        sessions.push({ slot_date: dateStr, start_time: schedule.time, end_time: endTime })
      }
    }
    current.setDate(current.getDate() + 1)
  }

  return sessions
}

/** 마지막 세션 이후 다음 주에서 첫 번째 해당 요일 날짜 계산 */
function calcNextStartDate(lastSessionDate: string, selectedDays: number[]): string {
  if (!lastSessionDate || selectedDays.length === 0) return ''
  const lastDt = new Date(lastSessionDate + 'T00:00:00')
  const dow = lastDt.getDay()
  // 마지막 세션 날짜의 다음 주 월요일
  const daysToNextMonday = dow === 0 ? 1 : 8 - dow
  const nextMonday = new Date(lastDt)
  nextMonday.setDate(lastDt.getDate() + daysToNextMonday)
  // 선택된 요일 중 가장 이른 요일
  const sortedDays = [...selectedDays].sort((a, b) => a - b)
  const firstDow = sortedDays[0]
  // 월요일(1) 기준으로 오프셋 계산
  const daysToFirstDow = (firstDow - 1 + 7) % 7
  nextMonday.setDate(nextMonday.getDate() + daysToFirstDow)
  return toDateStr(nextMonday)
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

export interface SlotPrefill {
  frequency: 1 | 2
  duration: LessonDuration
  selectedDays: number[]
  times: [string, string]
  /** 마지막 세션 날짜 (YYYY-MM-DD) — 시작일 자동 계산에 사용 */
  lastSessionDate: string
  feeInput: string
}

interface CreateSlotModalProps {
  isOpen: boolean
  onClose: () => void
  coachId: string
  onSuccess: (count: number) => void
  onError: (message: string) => void
  /** 제공 시 prefill 데이터로 초기화 (연장 모드) */
  prefill?: SlotPrefill
  /** 제공 시 extendSlotWithWizard 호출 (연장 모드) */
  extendSlotId?: string
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function CreateSlotModal({
  isOpen,
  onClose,
  coachId,
  onSuccess,
  onError,
  prefill,
  extendSlotId,
}: CreateSlotModalProps) {
  const isExtendMode = !!extendSlotId

  const [step, setStep] = useState<WizardStep>(1)
  const [frequency, setFrequency] = useState<1 | 2>(2)
  const [duration, setDuration] = useState<LessonDuration>(20)
  const [calendarMonth, setCalendarMonth] = useState<string>(() => {
    const n = new Date()
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [startDate, setStartDate] = useState<string>('')
  const [times, setTimes] = useState<[string, string]>(['', ''])
  const [feeInput, setFeeInput] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)

  // 모달이 열릴 때 prefill 적용 또는 초기화
  useEffect(() => {
    if (!isOpen) return
    if (prefill) {
      const startDateFromPrefill = calcNextStartDate(prefill.lastSessionDate, prefill.selectedDays)
      setStep(1)
      setFrequency(prefill.frequency)
      setDuration(prefill.duration)
      setSelectedDays(prefill.selectedDays)
      setStartDate(startDateFromPrefill)
      setTimes(prefill.times)
      setFeeInput(prefill.feeInput)
      if (startDateFromPrefill) {
        const [y, m] = startDateFromPrefill.split('-')
        setCalendarMonth(`${y}-${m}`)
      }
    } else {
      const n = new Date()
      setStep(1)
      setFrequency(2)
      setDuration(20)
      setCalendarMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`)
      setSelectedDays([])
      setStartDate('')
      setTimes(['', ''])
      setFeeInput('')
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => {
    onClose()
  }

  const canGoNext = (): boolean => {
    if (step === 3) return selectedDays.length === frequency
    if (step === 4) return !!startDate
    if (step === 5) return times.slice(0, frequency).every(Boolean)
    return true
  }

  const previewSessions = useMemo((): SlotSession[] => {
    if (step < 5 || selectedDays.length < frequency || !startDate) return []
    if (!times.slice(0, frequency).every(Boolean)) return []
    const schedules = selectedDays.slice(0, frequency).map((dow, i) => ({
      dow,
      time: times[i as 0 | 1] ?? '',
    }))
    return generateSessionsFromFrequency(frequency, schedules, duration, startDate)
  }, [step, frequency, duration, selectedDays, startDate, times])

  const handleDayToggle = (dow: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dow)) return prev.filter((d) => d !== dow)
      if (prev.length >= frequency) return prev
      return [...prev, dow]
    })
    setStartDate('')
  }

  const getDefaultFee = (): string => {
    const isWeekend = selectedDays.some((d) => d === 0 || d === 6)
    if (isWeekend) return frequency === 1 ? '150000' : '300000'
    return frequency === 1 ? '100000' : '200000'
  }

  const handleNext = () => {
    if (!canGoNext() || step >= 6) return
    const nextStep = (step + 1) as WizardStep
    if (nextStep === 6 && feeInput === '') setFeeInput(getDefaultFee())
    setStep(nextStep)
  }

  const handlePrev = () => { if (step > 1) setStep((s) => (s - 1) as WizardStep) }

  const handleSubmit = async () => {
    if (previewSessions.length === 0) { onError('생성할 슬롯이 없습니다.'); return }
    const parsedFee = feeInput.replace(/,/g, '').trim()
    const feeAmount = parsedFee === '' ? null : Number(parsedFee)
    if (parsedFee !== '' && isNaN(feeAmount!)) { onError('요금은 숫자로 입력해주세요.'); return }
    setSubmitting(true)

    const slotInput = {
      frequency,
      duration_minutes: duration,
      total_sessions: previewSessions.length,
      sessions: previewSessions,
      fee_amount: feeAmount,
    }

    const result = isExtendMode
      ? await extendSlotWithWizard(extendSlotId!, coachId, slotInput)
      : await createLessonSlot(coachId, slotInput)

    setSubmitting(false)
    if (result.error) { onError(result.error); return }
    onSuccess(previewSessions.length)
    handleClose()
  }

  const changeCalendarMonth = (delta: number) => {
    const [y, m] = calendarMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setCalendarMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
    setStartDate('')
  }

  const renderStepContent = () => {
    switch (step) {
      // ── Step 1: 레슨 회수 ────────────────────────────────────────
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {([1, 2] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={frequency === f}
                  onClick={() => { setFrequency(f); setSelectedDays([]) }}
                  className="flex flex-col items-center justify-center gap-1 py-6 rounded-2xl transition-all"
                  style={{
                    backgroundColor: frequency === f ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: frequency === f ? '#fff' : 'var(--text-secondary)',
                    boxShadow: frequency === f ? '0 4px 14px rgba(0,0,0,0.18)' : 'none',
                    border: frequency === f ? 'none' : '1.5px solid var(--border-color)',
                  }}
                >
                  <span className="text-2xl font-bold tabular-nums">주 {f}회</span>
                </button>
              ))}
            </div>
          </div>
        )

      // ── Step 2: 레슨 시간 ────────────────────────────────────────
      case 2:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {LESSON_DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-pressed={duration === d}
                  onClick={() => setDuration(d)}
                  className="flex flex-col items-center justify-center gap-1 py-6 rounded-2xl transition-all"
                  style={{
                    backgroundColor: duration === d ? 'var(--accent-color)' : 'var(--bg-secondary)',
                    color: duration === d ? '#fff' : 'var(--text-secondary)',
                    boxShadow: duration === d ? '0 4px 14px rgba(0,0,0,0.18)' : 'none',
                    border: duration === d ? 'none' : '1.5px solid var(--border-color)',
                  }}
                >
                  <span className="text-2xl font-bold tabular-nums">{d}분</span>
                  <span className="text-sm font-medium" style={{ opacity: 0.75 }}>레슨 시간</span>
                </button>
              ))}
            </div>
          </div>
        )

      // ── Step 3: 요일 선택 ────────────────────────────────────────
      case 3: {
        const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]
        return (
          <div className="space-y-4">
            {frequency === 2 && selectedDays.length < 2 && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                요일을 2개 선택하세요 ({selectedDays.length}/2)
              </p>
            )}
            <div className="grid grid-cols-7 gap-1.5">
              {DOW_ORDER.map((dow) => {
                const isSelected = selectedDays.includes(dow)
                const isWeekend = dow === 0 || dow === 6
                return (
                  <button
                    key={dow}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleDayToggle(dow)}
                    className="flex items-center justify-center py-4 rounded-xl transition-all text-base font-bold"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent-color)' : 'var(--bg-secondary)',
                      color: isSelected ? '#fff' : isWeekend ? 'var(--color-danger)' : 'var(--text-primary)',
                      border: isSelected ? 'none' : '1.5px solid var(--border-color)',
                      boxShadow: isSelected ? '0 3px 10px rgba(0,0,0,0.15)' : 'none',
                    }}
                  >
                    {DAY_LABELS[dow]}
                  </button>
                )
              })}
            </div>
            {selectedDays.length > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                <span>선택:</span>
                {selectedDays.map((dow) => (
                  <span
                    key={dow}
                    className="px-2 py-0.5 rounded-full font-semibold text-sm"
                    style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
                  >
                    {DAY_LABELS[dow]}요일
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      }

      // ── Step 4: 시작일 선택 ──────────────────────────────────────
      case 4: {
        const [calYear, calMonthNum] = calendarMonth.split('-').map(Number)
        const calDays = getCalendarDays(calYear, calMonthNum - 1)
        const todayStr = toDateStr(new Date())
        return (
          <div className="space-y-4">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
            >
              <span>레슨 요일:</span>
              {selectedDays.map((dow) => (
                <span
                  key={dow}
                  className="px-2 py-0.5 rounded-full font-semibold text-sm"
                  style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
                >
                  {DAY_LABELS[dow]}요일
                </span>
              ))}
            </div>
            <div className="rounded-2xl overflow-hidden" style={{ border: '1.5px solid var(--border-color)' }}>
              <div
                className="flex items-center justify-between px-4 py-3"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <button
                  type="button"
                  onClick={() => changeCalendarMonth(-1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                  aria-label="이전 달"
                >
                  <ChevronLeft size={16} />
                </button>
                <p className="text-base font-bold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                  {calYear}년 {calMonthNum}월
                </p>
                <button
                  type="button"
                  onClick={() => changeCalendarMonth(1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}
                  aria-label="다음 달"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <div
                className="grid grid-cols-7 text-center text-sm font-medium py-2 px-2"
                style={{ backgroundColor: 'var(--bg-card)', borderTop: '1px solid var(--border-color)' }}
              >
                {WEEK_HEADER.map((d) => (
                  <span
                    key={d}
                    className="py-1"
                    style={{ color: d === '토' || d === '일' ? 'var(--color-danger)' : 'var(--text-muted)' }}
                  >
                    {d}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 p-2" style={{ backgroundColor: 'var(--bg-card)' }}>
                {calDays.map(({ date, isCurrentMonth }, idx) => {
                  const dateStr = toDateStr(date)
                  const dow = date.getDay()
                  const isValidDay = isCurrentMonth && selectedDays.includes(dow)
                  const isPast = dateStr < todayStr
                  const isSelected = startDate === dateStr
                  const isClickable = isValidDay && !isPast
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!isClickable}
                      onClick={() => setStartDate(dateStr)}
                      className="aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all"
                      style={{
                        backgroundColor: isSelected
                          ? 'var(--accent-color)'
                          : isClickable
                          ? 'var(--bg-secondary)'
                          : 'transparent',
                        color: isSelected
                          ? '#fff'
                          : !isCurrentMonth || isPast
                          ? 'var(--text-muted)'
                          : isValidDay
                          ? 'var(--text-primary)'
                          : 'var(--text-muted)',
                        border: isSelected ? 'none' : isClickable ? '1.5px solid var(--border-color)' : 'none',
                        opacity: !isCurrentMonth || isPast ? 0.25 : 1,
                        cursor: isClickable ? 'pointer' : 'default',
                        boxShadow: isSelected ? '0 3px 10px rgba(0,0,0,0.15)' : 'none',
                      }}
                    >
                      {date.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>
            {startDate && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                <span>시작일:</span>
                <span className="font-semibold" style={{ color: 'var(--accent-color)' }}>
                  {new Date(startDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
              </div>
            )}
          </div>
        )
      }

      // ── Step 5: 시간 선택 + 미리보기 ────────────────────────────
      case 5:
        return (
          <div className="space-y-4">
            <div className="space-y-3">
              {selectedDays.slice(0, frequency).map((dow, idx) => {
                const isWeekend = dow === 0 || dow === 6
                const range = LESSON_AVAILABLE_HOURS[dow]
                return (
                  <div
                    key={dow}
                    className="rounded-xl overflow-hidden"
                    style={{ border: '1.5px solid var(--border-color)' }}
                  >
                    <div
                      className="flex items-center gap-2 px-3 py-2"
                      style={{ backgroundColor: 'var(--bg-secondary)' }}
                    >
                      <span
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold"
                        style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}
                      >
                        {DAY_LABELS[dow]}
                      </span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {DAY_LABELS[dow]}요일
                      </span>
                      {range && (
                        <span className="ml-auto text-sm" style={{ color: isWeekend ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                          가능 {range.start}~{range.end}
                        </span>
                      )}
                    </div>
                    <div className="px-3 py-2.5">
                      <SessionTimePicker
                        value={times[idx as 0 | 1] ?? ''}
                        onChange={(val) => setTimes((prev) => {
                          const next: [string, string] = [...prev] as [string, string]
                          next[idx as 0 | 1] = val
                          return next
                        })}
                      />
                    </div>
                  </div>
                )
              })}
            </div>

            {previewSessions.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-5 h-5 flex items-center justify-center rounded-full text-sm font-bold shrink-0"
                    style={{ backgroundColor: 'var(--color-success)', color: '#fff' }}
                  >✓</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    레슨 일정 미리보기
                  </span>
                  <span
                    className="ml-auto text-sm font-semibold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: 'var(--color-success-subtle, rgba(34,197,94,0.12))', color: 'var(--color-success)' }}
                  >
                    총 {previewSessions.length}회
                  </span>
                </div>
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                  {previewSessions.map((s, i) => {
                    const date = new Date(s.slot_date + 'T00:00:00')
                    const dow = date.getDay()
                    const isWeekend = dow === 0 || dow === 6
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-4 py-2.5"
                        style={{
                          borderTop: i > 0 ? '1px solid var(--border-color)' : 'none',
                          backgroundColor: i % 2 === 0 ? 'var(--bg-card)' : 'var(--bg-secondary)',
                        }}
                      >
                        <span className="text-sm font-medium tabular-nums shrink-0" style={{ color: 'var(--text-muted)', minWidth: '2rem' }}>
                          {i + 1}회
                        </span>
                        <span
                          className="w-5 text-sm font-bold text-center shrink-0"
                          style={{ color: isWeekend ? 'var(--color-danger)' : 'var(--accent-color)' }}
                        >
                          {DAY_LABELS[dow]}
                        </span>
                        <span className="text-sm tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                          {date.getMonth() + 1}월 {date.getDate()}일
                        </span>
                        <span className="ml-auto text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {s.start_time} ~ {s.end_time}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )

      // ── Step 6: 요금 입력 ─────────────────────────────────────
      case 6: {
        const displayFee = feeInput
          ? Number(feeInput.replace(/,/g, '')).toLocaleString()
          : ''
        return (
          <div className="space-y-4">
            <div
              className="rounded-xl p-4 space-y-1"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)' }}
            >
              <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }} htmlFor="fee-input">
                레슨 요금 (원)
              </label>
              <input
                id="fee-input"
                type="text"
                inputMode="numeric"
                value={feeInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '')
                  setFeeInput(raw)
                }}
                placeholder="별도 협의 (빈 칸)"
                className="w-full bg-transparent text-2xl font-bold tabular-nums outline-none"
                style={{ color: 'var(--text-primary)' }}
              />
              {feeInput && (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  {displayFee}원
                </p>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              비워두면 &apos;별도 협의&apos;로 처리됩니다.
            </p>
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <p className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>패키지 요약</p>
              <div className="flex gap-3 flex-wrap text-sm">
                <span style={{ color: 'var(--text-muted)' }}>주 {frequency}회</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-muted)' }}>{duration}분</span>
                <span style={{ color: 'var(--text-muted)' }}>·</span>
                <span style={{ color: 'var(--text-muted)' }}>총 {previewSessions.length}회</span>
              </div>
            </div>
          </div>
        )
      }
    }
  }

  const modalTitle = isExtendMode ? '레슨 연장 등록' : '레슨 슬롯 등록'

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={modalTitle} size="md">
      <Modal.Body>
        <div className="mb-6">
          <p
            className="text-sm font-semibold tabular-nums"
            style={{ color: 'var(--text-muted)' }}
          >
            {String(step).padStart(2, '0')} / {String(WIZARD_STEP_LABELS.length).padStart(2, '0')}
          </p>
          <h2
            className="text-2xl font-bold mt-2 whitespace-pre-line leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            {WIZARD_STEP_TITLES[step]}
          </h2>
        </div>

        <div className="min-h-[200px]">
          {renderStepContent()}
        </div>
      </Modal.Body>

      <Modal.Footer>
        {step > 1 ? (
          <button
            type="button"
            onClick={handlePrev}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            이전
          </button>
        ) : (
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
          >
            취소
          </button>
        )}
        {step < 6 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext()}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              backgroundColor: canGoNext() ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: canGoNext() ? '#fff' : 'var(--text-muted)',
              boxShadow: canGoNext() ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            다음
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || previewSessions.length === 0}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              backgroundColor: previewSessions.length > 0 ? 'var(--accent-color)' : 'var(--bg-secondary)',
              color: previewSessions.length > 0 ? '#fff' : 'var(--text-muted)',
              boxShadow: previewSessions.length > 0 ? '0 4px 12px rgba(0,0,0,0.15)' : 'none',
            }}
          >
            {submitting ? '처리 중...' : isExtendMode ? '연장 등록' : '등록'}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
