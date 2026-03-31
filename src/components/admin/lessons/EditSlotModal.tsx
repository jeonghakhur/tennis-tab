'use client'

import { useState, useEffect } from 'react'
import { updateSlot } from '@/lib/lessons/slot-actions'
import { Modal } from '@/components/common/Modal'
import SessionTimePicker from '@/components/clubs/sessions/SessionTimePicker'
import { LESSON_AVAILABLE_HOURS } from '@/lib/lessons/slot-types'
import type { LessonSlot } from '@/lib/lessons/slot-types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const LESSON_DURATIONS = [20, 30] as const
type LessonDuration = (typeof LESSON_DURATIONS)[number]

const WIZARD_STEP_LABELS = ['레슨 회수', '레슨 시간', '요일', '시작일', '시간', '요금'] as const
type WizardStep = 1 | 2 | 3 | 4 | 5 | 6

const WIZARD_STEP_TITLES: Record<WizardStep, string> = {
  1: '주당 레슨 회수를\n선택해주세요',
  2: '회당 레슨 시간을\n선택해주세요',
  3: '레슨 요일을\n선택해주세요',
  4: '시작일을\n선택해주세요',
  5: '레슨 시간을\n설정해주세요',
  6: '레슨 요금을\n입력해주세요',
}

// ─── 타입 ────────────────────────────────────────────────────────────────────

interface EditSlotModalProps {
  isOpen: boolean
  onClose: () => void
  slot: LessonSlot
  onSuccess: () => void
  onError: (message: string) => void
}

// ─── 유틸: 슬롯에서 초기값 추출 ──────────────────────────────────────────────

function extractInitialValues(slot: LessonSlot) {
  const sessions = (slot.sessions ?? []) as Array<{ dow?: number; start_time?: string; slot_date?: string; end_time?: string }>

  // 날짜 미정 슬롯: sessions에 dow 필드가 있음
  const isUndated = !slot.slot_date
  let selectedDays: number[] = []
  let times: [string, string] = ['', '']

  if (isUndated) {
    // 날짜 미정: sessions = [{ dow, start_time }, ...]
    selectedDays = sessions.filter((s) => s.dow !== undefined).map((s) => s.dow!)
    times = [
      sessions[0]?.start_time?.slice(0, 5) ?? '',
      sessions[1]?.start_time?.slice(0, 5) ?? '',
    ]
  } else {
    // 날짜 확정: sessions = [{ slot_date, start_time, end_time }, ...]
    // 요일 추출 (고유값)
    const seen = new Map<number, string>()
    for (const s of sessions) {
      if (s.slot_date) {
        const dow = new Date(s.slot_date + 'T00:00:00').getDay()
        if (!seen.has(dow)) seen.set(dow, s.start_time?.slice(0, 5) ?? '')
      }
    }
    selectedDays = [...seen.keys()]
    times = [
      seen.values().next().value ?? '',
      [...seen.values()][1] ?? '',
    ]
  }

  return {
    frequency: (slot.frequency ?? 2) as 1 | 2,
    duration: (slot.duration_minutes ?? 20) as LessonDuration,
    selectedDays,
    times,
    feeInput: slot.fee_amount != null ? String(slot.fee_amount) : '',
    startDate: slot.slot_date ?? '',
    isUndated,
  }
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────────

export function EditSlotModal({
  isOpen,
  onClose,
  slot,
  onSuccess,
  onError,
}: EditSlotModalProps) {
  const [step, setStep] = useState<WizardStep>(1)
  const [frequency, setFrequency] = useState<1 | 2>(2)
  const [duration, setDuration] = useState<LessonDuration>(20)
  const [selectedDays, setSelectedDays] = useState<number[]>([])
  const [times, setTimes] = useState<[string, string]>(['', ''])
  const [feeInput, setFeeInput] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [keepUndated, setKeepUndated] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // 모달 열릴 때 슬롯 데이터로 초기화
  useEffect(() => {
    if (!isOpen) return
    const init = extractInitialValues(slot)
    setStep(1)
    setFrequency(init.frequency)
    setDuration(init.duration)
    setSelectedDays(init.selectedDays)
    setTimes(init.times)
    setFeeInput(init.feeInput)
    setStartDate(init.startDate)
    setKeepUndated(init.isUndated)
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => { onClose() }

  const canGoNext = (): boolean => {
    if (step === 3) return selectedDays.length === frequency
    if (step === 4) return keepUndated || !!startDate
    if (step === 5) return times.slice(0, frequency).every(Boolean)
    return true
  }

  const handleDayToggle = (dow: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dow)) return prev.filter((d) => d !== dow)
      if (prev.length >= frequency) return prev
      return [...prev, dow]
    })
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
    const parsedFee = feeInput.replace(/,/g, '').trim()
    const feeAmount = parsedFee === '' ? null : Number(parsedFee)
    if (parsedFee !== '' && isNaN(feeAmount!)) { onError('요금은 숫자로 입력해주세요.'); return }
    setSubmitting(true)

    const result = await updateSlot(slot.id, {
      frequency,
      duration_minutes: duration,
      selectedDays: selectedDays.slice(0, frequency),
      times: times.slice(0, frequency) as string[],
      fee_amount: feeAmount,
      start_date: keepUndated ? null : startDate || null,
    })

    setSubmitting(false)
    if (result.error) { onError(result.error); return }
    onSuccess()
    handleClose()
  }

  // 오늘 날짜 (달력 min용)
  const todayStr = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()

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
      case 4:
        return (
          <div className="space-y-4">
            {/* 날짜 미정 유지 체크박스 */}
            <label
              className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)' }}
            >
              <input
                type="checkbox"
                checked={keepUndated}
                onChange={(e) => {
                  setKeepUndated(e.target.checked)
                  if (e.target.checked) setStartDate('')
                }}
                className="w-5 h-5 rounded accent-[var(--accent-color)]"
              />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                날짜 미정으로 유지
              </span>
            </label>

            {/* 날짜 선택 */}
            {!keepUndated && (
              <div
                className="rounded-xl p-4 space-y-2"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)' }}
              >
                <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }} htmlFor="start-date-input">
                  레슨 시작일
                </label>
                <input
                  id="start-date-input"
                  type="date"
                  value={startDate}
                  min={todayStr}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-transparent text-lg font-bold outline-none"
                  style={{ color: 'var(--text-primary)', colorScheme: 'auto' }}
                />
                {startDate && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {new Date(startDate + 'T00:00:00').toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                    부터 시작
                  </p>
                )}
              </div>
            )}

            {keepUndated && (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                날짜가 정해지면 나중에 수정할 수 있습니다.
              </p>
            )}
          </div>
        )

      // ── Step 5: 시간 선택 ──────────────────────────────────────
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
              <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }} htmlFor="edit-fee-input">
                레슨 요금 (원)
              </label>
              <input
                id="edit-fee-input"
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
                <span style={{ color: 'var(--text-muted)' }}>총 {frequency * 4}회</span>
                {!keepUndated && startDate && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>·</span>
                    <span style={{ color: 'var(--text-muted)' }}>시작 {startDate}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      }
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="슬롯 수정" size="md">
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
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              backgroundColor: 'var(--accent-color)',
              color: '#fff',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {submitting ? '처리 중...' : '수정 완료'}
          </button>
        )}
      </Modal.Footer>
    </Modal>
  )
}
