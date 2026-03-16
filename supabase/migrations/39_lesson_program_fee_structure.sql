-- Migration 39: 레슨 프로그램 수강료 구조화 + 레슨 시간 설정
-- fee_description(자유 텍스트) → 4개 구조화 요금 컬럼 + session_duration_minutes

-- ── 1. 수강료 구조화 컬럼 추가 ────────────────────────────────────────────────
ALTER TABLE lesson_programs
  ADD COLUMN IF NOT EXISTS fee_weekday_1 INTEGER CHECK (fee_weekday_1 >= 0),   -- 주중 1회 월 요금
  ADD COLUMN IF NOT EXISTS fee_weekday_2 INTEGER CHECK (fee_weekday_2 >= 0),   -- 주중 2회 월 요금
  ADD COLUMN IF NOT EXISTS fee_weekend_1 INTEGER CHECK (fee_weekend_1 >= 0),   -- 주말 1회 월 요금
  ADD COLUMN IF NOT EXISTS fee_weekend_2 INTEGER CHECK (fee_weekend_2 >= 0);   -- 주말 2회 월 요금

-- ── 2. 레슨 시간(분) 컬럼 추가 ─────────────────────────────────────────────────
ALTER TABLE lesson_programs
  ADD COLUMN IF NOT EXISTS session_duration_minutes INTEGER NOT NULL DEFAULT 20
    CHECK (session_duration_minutes > 0);

-- ── 3. fee_description 컬럼 제거 ────────────────────────────────────────────────
ALTER TABLE lesson_programs
  DROP COLUMN IF EXISTS fee_description;
