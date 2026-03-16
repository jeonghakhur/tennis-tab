-- Migration 42: lesson_inquiries status, admin_note 컬럼 추가

CREATE TYPE lesson_inquiry_status AS ENUM ('PENDING', 'RESPONDED', 'CLOSED');

ALTER TABLE lesson_inquiries
  ADD COLUMN IF NOT EXISTS status lesson_inquiry_status NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- 기존 is_read=true 데이터는 RESPONDED 로 마이그레이션
UPDATE lesson_inquiries SET status = 'RESPONDED' WHERE is_read = true;
