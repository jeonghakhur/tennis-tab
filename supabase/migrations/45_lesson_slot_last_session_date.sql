-- Migration 45: lesson_slots에 last_session_date 추가 (패키지 범위 쿼리 최적화)
ALTER TABLE lesson_slots
  ADD COLUMN IF NOT EXISTS last_session_date DATE;

COMMENT ON COLUMN lesson_slots.last_session_date IS '마지막 세션 날짜 — 패키지 날짜 범위 쿼리용';

-- 기존 데이터 백필: sessions JSONB에서 마지막 날짜 추출
UPDATE lesson_slots
SET last_session_date = (
  SELECT MAX((s->>'slot_date')::date)
  FROM jsonb_array_elements(sessions) AS s
)
WHERE sessions IS NOT NULL AND jsonb_array_length(sessions) > 0;

-- sessions 없는 레거시 슬롯은 slot_date = last_session_date
UPDATE lesson_slots
SET last_session_date = slot_date::date
WHERE last_session_date IS NULL;
