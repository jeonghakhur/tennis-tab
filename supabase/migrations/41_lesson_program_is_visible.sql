-- Migration 41: lesson_programs is_visible 컬럼 추가

ALTER TABLE lesson_programs
  ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;
