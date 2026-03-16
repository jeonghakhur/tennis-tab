-- ============================================================================
-- 레슨 문의 테이블 + notification_type 추가
-- ============================================================================

-- ─── lesson_inquiries (비회원 문의) ─────────────────────────────────────────
CREATE TABLE lesson_inquiries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES lesson_programs(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  phone         TEXT NOT NULL CHECK (char_length(phone) BETWEEN 10 AND 20),
  message       TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_inquiries_program ON lesson_inquiries(program_id, is_read, created_at DESC);

ALTER TABLE lesson_inquiries ENABLE ROW LEVEL SECURITY;

-- 누구나 문의 등록 가능
CREATE POLICY "lesson_inquiries_insert" ON lesson_inquiries FOR INSERT WITH CHECK (true);

-- 관리자만 조회/수정
CREATE POLICY "lesson_inquiries_admin_select" ON lesson_inquiries FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);
CREATE POLICY "lesson_inquiries_admin_update" ON lesson_inquiries FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);

-- ─── notification_type에 LESSON_INQUIRY 추가 ─────────────────────────────────
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'LESSON_INQUIRY';
