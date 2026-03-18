// 레슨 슬롯 기반 예약 시스템 타입 정의

// ─── ENUM 타입 ───────────────────────────────────────────────────────────────

export type LessonSlotStatus = 'OPEN' | 'BLOCKED' | 'LOCKED' | 'BOOKED' | 'CANCELLED'
export type LessonSlotDayType = 'WEEKDAY' | 'WEEKEND'
export type LessonBookingStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED'
export type LessonBookingType = 'WEEKDAY_1' | 'WEEKEND_1' | 'WEEKDAY_2' | 'WEEKEND_2' | 'MIXED_2'

// ─── 레슨 슬롯 ──────────────────────────────────────────────────────────────

/** 개별 세션 (sessions jsonb 배열의 각 원소) */
export interface SlotSession {
  slot_date: string   // 'YYYY-MM-DD'
  start_time: string  // 'HH:MM'
  end_time: string    // 'HH:MM'
}

export interface LessonSlot {
  id: string
  program_id: string | null
  coach_id: string
  slot_date: string        // 첫 번째 세션 날짜 'YYYY-MM-DD'
  start_time: string       // 첫 번째 세션 시작 시간 'HH:MM:SS'
  end_time: string         // 첫 번째 세션 종료 시간 'HH:MM:SS'
  day_type: LessonSlotDayType
  status: LessonSlotStatus
  locked_member_id: string | null
  notes: string | null
  // 패키지 정보 (migration 44에서 추가)
  frequency: number | null         // 주 N회 (1 or 2)
  duration_minutes: number | null  // 회당 레슨 시간 (20 or 30)
  total_sessions: number | null    // 전체 회차 수 (frequency × 4)
  sessions: SlotSession[] | null   // 전체 세션 일정
  last_session_date: string | null // 마지막 세션 날짜 (범위 쿼리용)
  fee_amount: number | null        // 슬롯 요금 (원). null이면 별도 협의
  created_by: string
  created_at: string
  updated_at: string
  // JOIN 결과
  locked_member?: { id: string; name: string } | null
  booking?: LessonBooking | null
}

/** 레슨 슬롯(패키지) 생성 입력 */
export interface CreateSlotInput {
  frequency: 1 | 2
  duration_minutes: 20 | 30
  total_sessions: number
  sessions: SlotSession[]   // 전체 세션 일정
  fee_amount: number | null  // 요금 (원). null이면 별도 협의
}

// ─── 레슨 예약 ──────────────────────────────────────────────────────────────

export interface LessonBooking {
  id: string
  member_id: string | null
  guest_name: string | null
  guest_phone: string | null
  is_guest: boolean
  slot_ids: string[]
  slot_count: number       // 1 or 2
  booking_type: LessonBookingType
  fee_amount: number | null
  status: LessonBookingStatus
  confirmed_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  admin_note: string | null
  created_at: string
  updated_at: string
  // JOIN 결과
  member?: { id: string; name: string } | null
  slots?: LessonSlot[]
  // 계산된 필드 (getSlotsByCoach에서 주입)
  sessionNumber?: number
}

export interface CreateBookingInput {
  slot_ids: string[]
  // 회원일 때
  member_id?: string
  // 비회원일 때
  guest_name?: string
  guest_phone?: string
  // 예약자 메모 (admin_note로 저장)
  note?: string
}

// ─── 상수 & 라벨 ────────────────────────────────────────────────────────────

export const SLOT_STATUS_LABEL: Record<LessonSlotStatus, string> = {
  OPEN: '빈 슬롯',
  BLOCKED: '비공개',
  LOCKED: '배정됨',
  BOOKED: '예약됨',
  CANCELLED: '취소됨',
}

export const BOOKING_STATUS_LABEL: Record<LessonBookingStatus, string> = {
  PENDING: '대기',
  CONFIRMED: '확정',
  CANCELLED: '취소',
}

export const BOOKING_TYPE_LABEL: Record<LessonBookingType, string> = {
  WEEKDAY_1: '주중 1회',
  WEEKEND_1: '주말 1회',
  WEEKDAY_2: '주중 2회',
  WEEKEND_2: '주말 2회',
  MIXED_2: '주중+주말 혼합 2회',
}

// ─── 레슨 가능 시간 ─────────────────────────────────────────────────────────

/** 요일별 레슨 가능 시간 (0=일, 1=월, ... 6=토) */
export const LESSON_AVAILABLE_HOURS: Record<number, { start: string; end: string }> = {
  0: { start: '06:30', end: '10:00' },  // 일
  1: { start: '06:30', end: '19:30' },  // 월
  2: { start: '06:30', end: '19:30' },  // 화
  3: { start: '06:30', end: '14:00' },  // 수
  4: { start: '06:30', end: '19:30' },  // 목
  5: { start: '06:30', end: '14:00' },  // 금
  6: { start: '06:30', end: '10:00' },  // 토
}

/** 날짜 문자열로 주중/주말 구분 */
export function getDayType(dateStr: string): LessonSlotDayType {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  return day === 0 || day === 6 ? 'WEEKEND' : 'WEEKDAY'
}

/** 슬롯 시간이 해당 요일 가능 시간 범위 내인지 검증 */
export function isTimeInRange(dateStr: string, startTime: string, endTime: string): boolean {
  const day = new Date(dateStr + 'T00:00:00').getDay()
  const range = LESSON_AVAILABLE_HOURS[day]
  if (!range) return false
  return startTime >= range.start && endTime <= range.end
}

/** 선택한 슬롯들로 booking_type 계산 */
export function calculateBookingType(slots: LessonSlot[]): LessonBookingType {
  if (slots.length === 1) {
    return slots[0].day_type === 'WEEKDAY' ? 'WEEKDAY_1' : 'WEEKEND_1'
  }
  // 2개
  const weekday = slots.filter((s) => s.day_type === 'WEEKDAY').length
  const weekend = slots.filter((s) => s.day_type === 'WEEKEND').length
  if (weekday === 2) return 'WEEKDAY_2'
  if (weekend === 2) return 'WEEKEND_2'
  return 'MIXED_2'
}

/** sessions 배열에서 unique 요일 추출 (0=일~6=토), 정렬 */
export function getSlotDays(sessions: SlotSession[]): number[] {
  const daySet = new Set<number>()
  for (const s of sessions) {
    const day = new Date(s.slot_date + 'T00:00:00').getDay()
    daySet.add(day)
  }
  return [...daySet].sort((a, b) => a - b)
}

/** 패키지 슬롯 단건으로 booking_type 결정 */
export function getBookingTypeForPackageSlot(slot: LessonSlot): LessonBookingType {
  if (slot.frequency === 1) {
    return slot.day_type === 'WEEKDAY' ? 'WEEKDAY_1' : 'WEEKEND_1'
  }
  // frequency === 2: sessions 기반 주중/주말 혼재 여부 판단
  if (slot.sessions && slot.sessions.length > 0) {
    const days = getSlotDays(slot.sessions)
    const hasWeekday = days.some((d) => d !== 0 && d !== 6)
    const hasWeekend = days.some((d) => d === 0 || d === 6)
    if (hasWeekday && hasWeekend) return 'MIXED_2'
    if (hasWeekend) return 'WEEKEND_2'
    return 'WEEKDAY_2'
  }
  // fallback: day_type 기반
  return slot.day_type === 'WEEKDAY' ? 'WEEKDAY_2' : 'WEEKEND_2'
}

/** booking_type에 맞는 프로그램 요금 필드 반환 */
export function getFeeFieldByBookingType(bookingType: LessonBookingType): string {
  const map: Record<LessonBookingType, string> = {
    WEEKDAY_1: 'fee_weekday_1',
    WEEKEND_1: 'fee_weekend_1',
    WEEKDAY_2: 'fee_weekday_2',
    WEEKEND_2: 'fee_weekend_2',
    MIXED_2: 'fee_mixed_2',
  }
  return map[bookingType]
}
