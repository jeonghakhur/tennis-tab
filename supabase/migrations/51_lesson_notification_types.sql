-- 51. 레슨 알림 타입 6종 추가
-- 슬롯 기반 예약 + 수강 시스템 알림 지원

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'LESSON_BOOKING_NEW';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'LESSON_BOOKING_CONFIRMED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'LESSON_BOOKING_CANCELLED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'LESSON_SLOT_LOCKED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'LESSON_ENROLLED';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'LESSON_ENROLLMENT_CANCELLED';

-- notifications에 DELETE 정책 추가 (기존 29_notifications_system.sql에서 누락)
CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);
