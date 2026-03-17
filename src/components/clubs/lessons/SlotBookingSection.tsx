'use client'

import { useState, useEffect, useMemo } from 'react'
import { Calendar, Clock, ChevronLeft, ChevronRight, User } from 'lucide-react'
import { getOpenSlotsByProgram, createBooking, getProgramFees } from '@/lib/lessons/slot-actions'
import { submitLessonInquiry } from '@/lib/lessons/actions'
import { Badge } from '@/components/common/Badge'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import { useAuth } from '@/components/AuthProvider'
import type { LessonSlot, LessonBookingType } from '@/lib/lessons/slot-types'
import { BOOKING_TYPE_LABEL, calculateBookingType, getFeeFieldByBookingType } from '@/lib/lessons/slot-types'

// ─── 상수 ────────────────────────────────────────────────────────────────────

const MAX_SLOTS = 2
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

// 슬롯 수 기반 요금 라벨 (주1회=월4회, 주2회=월8회)
const FEE_SESSION_LABEL: Record<string, string> = {
  WEEKDAY_1: '주 1회 (4회/월)',
  WEEKEND_1: '주 1회 (4회/월)',
  WEEKDAY_2: '주 2회 (8회/월)',
  WEEKEND_2: '주 2회 (8회/월)',
  MIXED_2:   '주 2회 (8회/월)',
}

interface SlotBookingSectionProps {
  programId: string
  coachId: string
  coachName: string
}

// ─── 메인 컴포넌트 ──────────────────────────────────────────────────────────

export function SlotBookingSection({ programId, coachId, coachName }: SlotBookingSectionProps) {
  const { profile } = useAuth()

  // 슬롯 데이터
  const [slots, setSlots] = useState<LessonSlot[]>([])
  const [loading, setLoading] = useState(true)

  // 달력 상태
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() }
  })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // 슬롯 선택
  const [selectedSlots, setSelectedSlots] = useState<LessonSlot[]>([])

  // 요금 정보
  const [fees, setFees] = useState<Record<string, number | null>>({})

  // 신청자 정보 (로그인 시 자동 입력)
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [message, setMessage] = useState('')

  // 상태
  const [submitting, setSubmitting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  // 로그인 사용자 정보 자동 입력
  useEffect(() => {
    if (profile) {
      setGuestName(profile.name || '')
      setGuestPhone(profile.phone || '')
    }
  }, [profile])

  // 슬롯 + 요금 로드
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [slotsRes, feesRes] = await Promise.all([
        getOpenSlotsByProgram(programId, coachId),
        getProgramFees(programId),
      ])
      setSlots(slotsRes.data)
      if (feesRes.data) {
        const feeObj: Record<string, number | null> = {}
        for (const [key, val] of Object.entries(feesRes.data)) {
          if (key.startsWith('fee_')) feeObj[key] = val as number | null
        }
        setFees(feeObj)
      }
      setLoading(false)
    }
    load()
  }, [programId, coachId])

  // 날짜별 슬롯 그룹핑
  const slotsByDate = useMemo(() => {
    const map = new Map<string, LessonSlot[]>()
    for (const slot of slots) {
      if (!map.has(slot.slot_date)) map.set(slot.slot_date, [])
      map.get(slot.slot_date)!.push(slot)
    }
    return map
  }, [slots])

  // 선택된 날짜의 슬롯
  const dateSlotsForView = selectedDate ? (slotsByDate.get(selectedDate) || []) : []

  // 요금 계산
  const bookingType: LessonBookingType | null = selectedSlots.length > 0 ? calculateBookingType(selectedSlots) : null
  const feeField = bookingType ? getFeeFieldByBookingType(bookingType) : null
  const feeAmount = feeField ? fees[feeField] ?? null : null

  // 달력 데이터
  const calendarDays = useMemo(() => {
    const { year, month } = currentMonth
    const firstDay = new Date(year, month, 1).getDay()
    const lastDate = new Date(year, month + 1, 0).getDate()
    const days: Array<{ date: number; dateStr: string; hasSlots: boolean } | null> = []

    for (let i = 0; i < firstDay; i++) days.push(null)
    for (let d = 1; d <= lastDate; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({ date: d, dateStr, hasSlots: slotsByDate.has(dateStr) })
    }
    return days
  }, [currentMonth, slotsByDate])

  const prevMonth = () => {
    setCurrentMonth((prev) => {
      const m = prev.month - 1
      return m < 0 ? { year: prev.year - 1, month: 11 } : { year: prev.year, month: m }
    })
    setSelectedDate(null)
  }

  const nextMonth = () => {
    setCurrentMonth((prev) => {
      const m = prev.month + 1
      return m > 11 ? { year: prev.year + 1, month: 0 } : { year: prev.year, month: m }
    })
    setSelectedDate(null)
  }

  // 날짜 토글 (재클릭 시 해제)
  const toggleDate = (dateStr: string, hasSlots: boolean, isPast: boolean) => {
    if (!hasSlots || isPast) return
    setSelectedDate((prev) => prev === dateStr ? null : dateStr)
  }

  // 슬롯 선택/해제
  const toggleSlot = (slot: LessonSlot) => {
    setSelectedSlots((prev) => {
      const exists = prev.find((s) => s.id === slot.id)
      if (exists) return prev.filter((s) => s.id !== slot.id)
      if (prev.length >= MAX_SLOTS) {
        setAlert({ isOpen: true, message: `최대 ${MAX_SLOTS}개까지 선택할 수 있습니다.`, type: 'warning' as 'error' })
        return prev
      }
      return [...prev, slot]
    })
  }

  // 신청
  const handleSubmit = async () => {
    if (selectedSlots.length === 0) return

    if (!guestName.trim()) {
      setAlert({ isOpen: true, message: '이름을 입력해주세요.', type: 'error' })
      return
    }
    if (!guestPhone.trim()) {
      setAlert({ isOpen: true, message: '연락처를 입력해주세요.', type: 'error' })
      return
    }

    setConfirmOpen(true)
  }

  const handleConfirmSubmit = async () => {
    setConfirmOpen(false)
    setSubmitting(true)

    const result = await createBooking(programId, {
      slot_ids: selectedSlots.map((s) => s.id),
      guest_name: guestName.trim(),
      guest_phone: guestPhone.trim(),
    })

    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    // 문의 내용이 있으면 inquiry도 함께 등록
    if (message.trim()) {
      await submitLessonInquiry(programId, {
        name: guestName.trim(),
        phone: guestPhone.trim(),
        message: message.trim(),
      })
    }

    setToast({ isOpen: true, message: '레슨 신청이 완료되었습니다! 코치 수락 후 확정됩니다.', type: 'success' })
    setSelectedSlots([])
    setMessage('')
    if (!profile) {
      setGuestName('')
      setGuestPhone('')
    }
    const { data } = await getOpenSlotsByProgram(programId, coachId)
    setSlots(data)
  }

  const today = new Date().toISOString().substring(0, 10)

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        <div className="h-64 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
      </div>
    )
  }

  return (
    <section className="mb-4" aria-labelledby="slot-booking-title">
      <h2
        id="slot-booking-title"
        className="text-base font-semibold mb-3 flex items-center gap-1.5"
        style={{ color: 'var(--text-primary)' }}
      >
        레슨 신청
        {coachName && (
          <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
            · {coachName} 코치
          </span>
        )}
      </h2>

      {slots.length === 0 ? (
        <div className="text-center py-8">
          <Calendar className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            현재 예약 가능한 슬롯이 없습니다.
          </p>
        </div>
      ) : (
        <div className="md:grid md:grid-cols-2 md:gap-4 md:items-start">
          {/* 왼쪽: 달력 카드 */}
          <div
            className="rounded-xl p-3 mb-4 md:mb-0"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-sm font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
              <Calendar className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
              날짜 선택
            </p>

            {/* 달력 헤더 */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:opacity-80" style={{ backgroundColor: 'var(--bg-card-hover)' }} aria-label="이전 달">
                <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {currentMonth.year}년 {currentMonth.month + 1}월
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:opacity-80" style={{ backgroundColor: 'var(--bg-card-hover)' }} aria-label="다음 달">
                <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
              </button>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DAY_LABELS.map((d, i) => (
                <div
                  key={d}
                  className="text-center text-sm font-medium py-1"
                  style={{ color: i === 0 ? 'var(--color-danger)' : i === 6 ? 'var(--color-info)' : 'var(--text-muted)' }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />

                const isSelected = selectedDate === day.dateStr
                const isPast = day.dateStr < today
                const dayOfWeek = new Date(day.dateStr + 'T00:00:00').getDay()

                return (
                  <button
                    key={day.dateStr}
                    onClick={() => toggleDate(day.dateStr, day.hasSlots, isPast)}
                    disabled={!day.hasSlots || isPast}
                    className="relative aspect-square flex items-center justify-center rounded-lg text-sm transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent-color)' : 'transparent',
                      color: isSelected
                        ? 'var(--bg-primary)'
                        : isPast
                          ? 'var(--text-muted)'
                          : dayOfWeek === 0
                            ? 'var(--color-danger)'
                            : dayOfWeek === 6
                              ? 'var(--color-info)'
                              : 'var(--text-primary)',
                      opacity: isPast ? 0.4 : 1,
                      fontWeight: day.hasSlots ? 600 : 400,
                    }}
                    aria-label={`${day.dateStr}${day.hasSlots ? ' 슬롯 있음' : ''}`}
                    aria-pressed={isSelected}
                  >
                    {day.date}
                    {day.hasSlots && !isPast && (
                      <span
                        className="absolute bottom-1 left-2 right-2 h-0.5 rounded-full"
                        style={{ backgroundColor: isSelected ? 'var(--bg-primary)' : 'var(--accent-color)' }}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 오른쪽: 슬롯 선택 + 신청 정보 카드 */}
          <div
            className="rounded-xl p-3 space-y-4"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            {/* 슬롯 목록 */}
            <div>
              <p className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Clock className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
                시간 선택
              </p>
              {selectedDate ? (
                dateSlotsForView.length === 0 ? (
                  <p className="text-sm py-3 text-center" style={{ color: 'var(--text-muted)' }}>해당 날짜에 빈 슬롯이 없습니다.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {dateSlotsForView.map((slot) => {
                      const isSlotSelected = selectedSlots.some((s) => s.id === slot.id)
                      return (
                        <button
                          key={slot.id}
                          onClick={() => toggleSlot(slot)}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                          style={{
                            backgroundColor: isSlotSelected ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                            color: isSlotSelected ? 'var(--bg-primary)' : 'var(--text-primary)',
                            border: isSlotSelected ? '2px solid var(--accent-color)' : '1px solid var(--border-color)',
                          }}
                          aria-pressed={isSlotSelected}
                        >
                          {slot.start_time.slice(0, 5)}~{slot.end_time.slice(0, 5)}
                          {isSlotSelected && ' ✓'}
                        </button>
                      )
                    })}
                  </div>
                )
              ) : (
                <p className="text-sm py-3 text-center" style={{ color: 'var(--text-muted)' }}>
                  날짜를 먼저 선택해주세요.
                </p>
              )}
            </div>

            {/* 선택 요약 + 요금 */}
            {selectedSlots.length > 0 && (
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
              >
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  선택한 슬롯: {selectedSlots.length}개
                </p>
                {selectedSlots.map((slot) => {
                  const d = new Date(slot.slot_date + 'T00:00:00')
                  return (
                    <div key={slot.id} className="flex items-center justify-between text-sm mb-1">
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {slot.slot_date} ({DAY_LABELS[d.getDay()]}) {slot.start_time.slice(0, 5)}~{slot.end_time.slice(0, 5)}
                      </span>
                      <button
                        onClick={() => toggleSlot(slot)}
                        className="text-sm px-1.5 py-0.5 rounded hover:opacity-70"
                        style={{ color: 'var(--color-danger)' }}
                        aria-label="슬롯 선택 해제"
                      >
                        삭제
                      </button>
                    </div>
                  )
                })}

                {/* 요금 — 주1회(4회)/주2회(8회) 표기 */}
                {bookingType && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <Badge variant="info">{FEE_SESSION_LABEL[bookingType]}</Badge>
                    {feeAmount !== null ? (
                      <span className="text-sm font-bold" style={{ color: 'var(--accent-color)' }}>
                        {feeAmount.toLocaleString()}원/월
                      </span>
                    ) : (
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>요금 문의</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 신청자 정보 — 항상 표시 */}
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                <User className="w-3.5 h-3.5 inline mr-1" />
                신청자 정보
              </p>
              <div>
                <label htmlFor="guest-name" className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  이름 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="guest-name"
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="홍길동"
                  maxLength={20}
                  readOnly={!!profile}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: profile ? 'var(--bg-card-hover)' : 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>
              <div>
                <label htmlFor="guest-phone" className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  연락처 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="guest-phone"
                  type="tel"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="010-1234-5678"
                  maxLength={20}
                  readOnly={!!profile}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{
                    backgroundColor: profile ? 'var(--bg-card-hover)' : 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
              </div>
              <div>
                <label htmlFor="booking-message" className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>
                  문의 내용 <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(선택)</span>
                </label>
                <textarea
                  id="booking-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="궁금한 점이나 전달할 내용을 입력해주세요"
                  maxLength={1000}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                  }}
                />
                <p className="text-right text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {message.length}/1000
                </p>
              </div>
            </div>

            {/* 신청 버튼 — 슬롯 미선택 시 비활성화 */}
            <button
              onClick={handleSubmit}
              disabled={selectedSlots.length === 0 || submitting}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all"
              style={{
                backgroundColor: selectedSlots.length === 0 ? 'var(--bg-card-hover)' : 'var(--accent-color)',
                color: selectedSlots.length === 0 ? 'var(--text-muted)' : 'var(--bg-primary)',
                cursor: selectedSlots.length === 0 ? 'not-allowed' : 'pointer',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? '신청 중...' : selectedSlots.length === 0 ? '시간을 선택해주세요' : '레슨 신청하기'}
            </button>
          </div>
        </div>
      )}

      {/* 확인 다이얼로그 */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmSubmit}
        title="레슨 신청"
        message={`${selectedSlots.length}개 슬롯으로 레슨을 신청하시겠습니까?\n\n신청 후 코치가 수락하면 레슨이 확정됩니다.${feeAmount ? `\n\n예상 요금: ${feeAmount.toLocaleString()}원/월` : ''}`}
        type="info"
      />

      {submitting && <LoadingOverlay message="레슨 신청 중..." />}
      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="알림" message={alert.message} type={alert.type} />
    </section>
  )
}
