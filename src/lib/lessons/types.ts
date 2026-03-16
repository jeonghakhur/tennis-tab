// 레슨 시스템 타입 정의
// 코치/레슨은 클럽과 독립 운영

// ─── ENUM 타입 ───────────────────────────────────────────────────────────────

export type LessonProgramStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED'
export type LessonSessionStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'
export type EnrollmentStatus = 'PENDING' | 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED'
export type AttendanceLessonStatus = 'PRESENT' | 'ABSENT' | 'LATE'
export type RescheduleRequesterType = 'ADMIN' | 'MEMBER'
export type RescheduleStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

// ─── 코치 ────────────────────────────────────────────────────────────────────

export interface Coach {
  id: string
  name: string
  bio: string | null
  experience: string | null
  certifications: string[]
  certification_files: string[]  // 자격증 첨부 파일 URL 목록
  profile_image_url: string | null
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface CreateCoachInput {
  name: string
  bio?: string
  experience?: string
  certifications?: string[]
  certification_files?: string[]
  profile_image_url?: string
}

export interface UpdateCoachInput {
  name?: string
  bio?: string
  experience?: string
  certifications?: string[]
  certification_files?: string[]
  profile_image_url?: string
}

// ─── 레슨 프로그램 ───────────────────────────────────────────────────────────

export interface LessonProgram {
  id: string
  coach_id: string
  title: string
  description: string | null
  target_level: string
  max_participants: number
  fee_description: string | null
  status: LessonProgramStatus
  created_by: string
  created_at: string
  updated_at: string
  // JOIN 결과
  coach?: Coach | null
  _enrollment_count?: number
}

export interface CreateProgramInput {
  coach_id: string
  title: string
  description?: string
  target_level: string
  max_participants: number
  fee_description?: string
}

export interface UpdateProgramInput {
  coach_id?: string
  title?: string
  description?: string
  target_level?: string
  max_participants?: number
  fee_description?: string
}

// ─── 레슨 세션 ───────────────────────────────────────────────────────────────

export interface LessonSession {
  id: string
  program_id: string
  session_date: string
  start_time: string
  end_time: string
  location: string | null
  status: LessonSessionStatus
  notes: string | null
  created_at: string
}

export interface CreateSessionInput {
  session_date: string
  start_time: string
  end_time: string
  location?: string
  notes?: string
}

// ─── 수강 신청 ───────────────────────────────────────────────────────────────

export interface LessonEnrollment {
  id: string
  program_id: string
  user_id: string
  status: EnrollmentStatus
  monthly_session_count: Record<string, number>
  enrolled_at: string
  cancelled_at: string | null
  // JOIN 결과
  user?: { id: string; name: string } | null
  program?: { id: string; title: string; coach: { name: string } | null } | null
}

// ─── 출석 ────────────────────────────────────────────────────────────────────

export interface LessonAttendance {
  id: string
  session_id: string
  enrollment_id: string
  status: AttendanceLessonStatus
  recorded_at: string
  // JOIN 결과
  enrollment?: {
    id: string
    user?: { id: string; name: string } | null
  } | null
}

// ─── 일정 변경 요청 ─────────────────────────────────────────────────────────

export interface RescheduleRequest {
  id: string
  session_id: string
  enrollment_id: string | null
  requested_by: string
  requester_type: RescheduleRequesterType
  original_date: string
  original_start_time: string
  original_end_time: string
  requested_date: string
  requested_start_time: string
  requested_end_time: string
  reason: string | null
  status: RescheduleStatus
  responded_by: string | null
  responded_at: string | null
  created_at: string
  // JOIN 결과
  requester?: { name: string } | null
}

export interface RescheduleRequestInput {
  enrollment_id?: string
  requested_date: string
  requested_start_time: string
  requested_end_time: string
  reason?: string
}

// ─── 상수 ────────────────────────────────────────────────────────────────────

export const TARGET_LEVELS = ['입문', '초급', '중급', '고급', '전체'] as const

export const PROGRAM_STATUS_LABEL: Record<LessonProgramStatus, string> = {
  DRAFT: '준비 중',
  OPEN: '모집 중',
  CLOSED: '마감',
  CANCELLED: '취소',
}

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  PENDING: '대기',
  CONFIRMED: '확정',
  WAITLISTED: '대기자',
  CANCELLED: '취소',
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceLessonStatus, string> = {
  PRESENT: '출석',
  ABSENT: '결석',
  LATE: '지각',
}

// ─── 레슨 결제 ───────────────────────────────────────────────────────────────

export type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'OTHER'

export interface LessonPayment {
  id: string
  enrollment_id: string
  amount: number
  paid_at: string        // 'YYYY-MM-DD'
  method: PaymentMethod
  period: string         // 'YYYY-MM'
  note: string | null
  recorded_by: string
  created_at: string
}

export interface CreatePaymentInput {
  amount: number
  paid_at: string
  method: PaymentMethod
  period: string
  note?: string
}

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  BANK_TRANSFER: '계좌이체',
  CASH: '현금',
  OTHER: '기타',
}

// ─── 레슨 문의 ───────────────────────────────────────────────────────────────

export type LessonInquiryStatus = 'PENDING' | 'RESPONDED' | 'CLOSED'

export interface LessonInquiry {
  id: string
  program_id: string
  name: string
  phone: string
  message: string
  preferred_session_id: string | null
  status: LessonInquiryStatus
  admin_note: string | null
  created_at: string
  // JOIN 결과
  program?: { id: string; title: string; coach?: { name: string } | null } | null
  preferred_session?: {
    id: string
    session_date: string
    start_time: string
    end_time: string
  } | null
}
