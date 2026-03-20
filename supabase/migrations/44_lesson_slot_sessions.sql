-- Migration 44: lesson_slots 패키지 구조로 개편
-- 1슬롯 = 전체 레슨 패키지 (N회 세션 jsonb로 저장)

-- 1. 기존 30분 고정 duration 제약 제거
ALTER TABLE lesson_slots DROP CONSTRAINT IF EXISTS chk_slot_duration;

-- 2. 새 컬럼 추가
ALTER TABLE lesson_slots
  ADD COLUMN IF NOT EXISTS frequency         INTEGER,              -- 주 N회 (1 or 2)
  ADD COLUMN IF NOT EXISTS duration_minutes  INTEGER,              -- 회당 레슨 시간 (20 or 30)
  ADD COLUMN IF NOT EXISTS total_sessions    INTEGER,              -- 전체 회차 수 (frequency * 4)
  ADD COLUMN IF NOT EXISTS sessions          JSONB;                -- 전체 세션 일정 배열

-- 3. 새 제약 추가 (20분 또는 30분)
ALTER TABLE lesson_slots
  ADD CONSTRAINT chk_slot_duration CHECK (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60 IN (20, 30)
  );

ALTER TABLE lesson_slots
  ADD CONSTRAINT chk_slot_duration_minutes CHECK (
    duration_minutes IS NULL OR duration_minutes IN (20, 30)
  );

ALTER TABLE lesson_slots
  ADD CONSTRAINT chk_slot_frequency CHECK (
    frequency IS NULL OR frequency IN (1, 2)
  );

-- 4. sessions 컬럼 인덱스 (JSONB 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_lesson_slots_sessions ON lesson_slots USING GIN (sessions);

COMMENT ON COLUMN lesson_slots.frequency IS '주당 레슨 횟수 (1회 or 2회)';
COMMENT ON COLUMN lesson_slots.duration_minutes IS '회당 레슨 시간 분 (20 or 30)';
COMMENT ON COLUMN lesson_slots.total_sessions IS '전체 레슨 회차 수 (frequency × 4)';
COMMENT ON COLUMN lesson_slots.sessions IS '전체 세션 일정: [{slot_date, start_time, end_time}]';
