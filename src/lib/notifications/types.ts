/** 알림 타입 (15가지) */
export const NotificationType = {
  // 사용자 알림 (10)
  ENTRY_APPROVED: 'ENTRY_APPROVED',
  ENTRY_REJECTED: 'ENTRY_REJECTED',
  TOURNAMENT_STATUS_CHANGED: 'TOURNAMENT_STATUS_CHANGED',
  BRACKET_GENERATED: 'BRACKET_GENERATED',
  MATCH_RESULT_UPDATED: 'MATCH_RESULT_UPDATED',
  CLUB_MEMBER_APPROVED: 'CLUB_MEMBER_APPROVED',
  CLUB_MEMBER_REJECTED: 'CLUB_MEMBER_REJECTED',
  CLUB_INVITED: 'CLUB_INVITED',
  INQUIRY_REPLIED: 'INQUIRY_REPLIED',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
  // 관리자 알림 (5)
  ENTRY_SUBMITTED: 'ENTRY_SUBMITTED',
  ENTRY_CANCELLED: 'ENTRY_CANCELLED',
  PAYMENT_COMPLETED: 'PAYMENT_COMPLETED',
  CLUB_JOIN_REQUESTED: 'CLUB_JOIN_REQUESTED',
  LESSON_INQUIRY: 'LESSON_INQUIRY',
  // 레슨 알림 (6)
  LESSON_BOOKING_NEW: 'LESSON_BOOKING_NEW',
  LESSON_BOOKING_CONFIRMED: 'LESSON_BOOKING_CONFIRMED',
  LESSON_BOOKING_CANCELLED: 'LESSON_BOOKING_CANCELLED',
  LESSON_SLOT_LOCKED: 'LESSON_SLOT_LOCKED',
  LESSON_ENROLLED: 'LESSON_ENROLLED',
  LESSON_ENROLLMENT_CANCELLED: 'LESSON_ENROLLMENT_CANCELLED',
} as const

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType]

/** DB notifications 테이블 row */
export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  tournament_id: string | null
  entry_id: string | null
  match_id: string | null
  club_id: string | null
  metadata: Record<string, unknown>
  is_read: boolean
  read_at: string | null
  created_at: string
}

/** 단일 알림 생성 파라미터 */
export interface CreateNotificationParams {
  user_id: string
  type: NotificationType
  title: string
  message: string
  tournament_id?: string | null
  entry_id?: string | null
  match_id?: string | null
  club_id?: string | null
  metadata?: Record<string, unknown>
}

/** 다수 사용자 일괄 알림 생성 파라미터 */
export interface CreateBulkNotificationParams {
  user_ids: string[]
  type: NotificationType
  title: string
  message: string
  tournament_id?: string | null
  entry_id?: string | null
  match_id?: string | null
  club_id?: string | null
  metadata?: Record<string, unknown>
}
