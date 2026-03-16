-- Migration 38: 코치 자격증 첨부파일 + 레슨 결제 기록 테이블
-- Applied: 2026-03-16

-- ── 1. coaches 테이블에 certification_files 컬럼 추가 ──────────────────────
ALTER TABLE coaches
  ADD COLUMN IF NOT EXISTS certification_files TEXT[] NOT NULL DEFAULT '{}';

-- ── 2. lesson_payments 테이블 생성 ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lesson_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES lesson_enrollments(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  paid_at       DATE NOT NULL,
  method        TEXT NOT NULL CHECK (method IN ('BANK_TRANSFER', 'CASH', 'OTHER')),
  period        TEXT NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),  -- YYYY-MM
  note          TEXT,
  recorded_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lesson_payments_enrollment_id
  ON lesson_payments(enrollment_id);

CREATE INDEX IF NOT EXISTS idx_lesson_payments_period
  ON lesson_payments(period);

-- ── 3. RLS 정책 ─────────────────────────────────────────────────────────────
ALTER TABLE lesson_payments ENABLE ROW LEVEL SECURITY;

-- 수강생: 본인 수강 결제 기록 조회
CREATE POLICY "lesson_payments_select_own"
  ON lesson_payments FOR SELECT
  USING (
    enrollment_id IN (
      SELECT id FROM lesson_enrollments WHERE user_id = auth.uid()
    )
  );

-- 관리자: 전체 조회/수정/삭제
CREATE POLICY "lesson_payments_admin_all"
  ON lesson_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('SUPER_ADMIN', 'ADMIN')
    )
  );
