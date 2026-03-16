-- ============================================================================
-- 레슨 비회원 공개 접근 — 공개 SELECT RLS + 레슨 문의 테이블
-- ============================================================================

-- ─── 1. coaches: 비인증 사용자 SELECT 허용 ─────────────────────────────────
CREATE POLICY "coaches_public_select" ON coaches FOR SELECT USING (
  is_active = true
);

-- ─── 2. lesson_programs: 비인증 사용자 SELECT 허용 (DRAFT 제외) ─────────────
CREATE POLICY "lesson_programs_public_select" ON lesson_programs FOR SELECT USING (
  status != 'DRAFT'
);

-- ─── 3. lesson_sessions: 비인증 사용자 SELECT 허용 ─────────────────────────
CREATE POLICY "lesson_sessions_public_select" ON lesson_sessions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM lesson_programs lp
    WHERE lp.id = lesson_sessions.program_id AND lp.status != 'DRAFT'
  )
);

-- ─── 4. lesson_inquiries 테이블 (비회원 문의) ──────────────────────────────
CREATE TABLE lesson_inquiries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES lesson_programs(id) ON DELETE CASCADE,
  club_id       UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  phone         TEXT NOT NULL CHECK (char_length(phone) BETWEEN 10 AND 20),
  message       TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 1000),
  is_read       BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_inquiries_club ON lesson_inquiries(club_id, is_read, created_at DESC);
CREATE INDEX idx_lesson_inquiries_program ON lesson_inquiries(program_id);

ALTER TABLE lesson_inquiries ENABLE ROW LEVEL SECURITY;

-- INSERT는 누구나 가능 (비인증 포함)
CREATE POLICY "lesson_inquiries_insert" ON lesson_inquiries FOR INSERT WITH CHECK (true);

-- SELECT/UPDATE는 클럽 어드민만
CREATE POLICY "lesson_inquiries_admin_select" ON lesson_inquiries FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.club_id = lesson_inquiries.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('OWNER', 'ADMIN')
      AND cm.status = 'ACTIVE'
  )
);

CREATE POLICY "lesson_inquiries_admin_update" ON lesson_inquiries FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM club_members cm
    WHERE cm.club_id = lesson_inquiries.club_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('OWNER', 'ADMIN')
      AND cm.status = 'ACTIVE'
  )
);

-- ─── 5. notification_type에 LESSON_INQUIRY 추가 ───────────────────────────
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'LESSON_INQUIRY';
