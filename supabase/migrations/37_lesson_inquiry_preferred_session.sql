-- lesson_inquiries에 희망 세션 슬롯 컬럼 추가
ALTER TABLE lesson_inquiries
  ADD COLUMN IF NOT EXISTS preferred_session_id UUID REFERENCES lesson_sessions(id) ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_lesson_inquiries_preferred_session
  ON lesson_inquiries(preferred_session_id)
  WHERE preferred_session_id IS NOT NULL;
