-- ============================================================================
-- 테니스 레슨 시스템 (coaches, lesson_programs, lesson_sessions,
--   lesson_enrollments, lesson_attendances, lesson_reschedule_requests)
-- 코치/레슨은 클럽과 독립된 개인사업자 단위로 운영
-- ============================================================================

-- ENUM 타입
CREATE TYPE lesson_program_status   AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'CANCELLED');
CREATE TYPE lesson_session_status   AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE enrollment_status       AS ENUM ('PENDING', 'CONFIRMED', 'WAITLISTED', 'CANCELLED');
CREATE TYPE attendance_lesson_status AS ENUM ('PRESENT', 'ABSENT', 'LATE');
CREATE TYPE reschedule_requester    AS ENUM ('ADMIN', 'MEMBER');
CREATE TYPE reschedule_status       AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- ─── coaches ─────────────────────────────────────────────────────────────────
-- 코치는 클럽 소속이 아닌 독립 개인사업자
CREATE TABLE coaches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  bio                 TEXT,
  experience          TEXT,
  certifications      TEXT[] NOT NULL DEFAULT '{}',
  profile_image_url   TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  created_by          UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;

-- 공개 조회 (활성 코치만)
CREATE POLICY "coaches_public_select" ON coaches FOR SELECT USING (is_active = true);
-- 시스템 관리자만 등록/수정
CREATE POLICY "coaches_admin_insert" ON coaches FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);
CREATE POLICY "coaches_admin_update" ON coaches FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);

-- ─── lesson_programs ─────────────────────────────────────────────────────────
CREATE TABLE lesson_programs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id            UUID NOT NULL REFERENCES coaches(id),
  title               TEXT NOT NULL,
  description         TEXT,
  target_level        TEXT NOT NULL DEFAULT '전체',
  max_participants    INT NOT NULL DEFAULT 10,
  fee_description     TEXT CHECK (char_length(fee_description) <= 500),
  status              lesson_program_status NOT NULL DEFAULT 'DRAFT',
  created_by          UUID NOT NULL REFERENCES profiles(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_programs_coach_id ON lesson_programs(coach_id);
CREATE INDEX idx_lesson_programs_status ON lesson_programs(status);

ALTER TABLE lesson_programs ENABLE ROW LEVEL SECURITY;

-- DRAFT 제외 공개 조회
CREATE POLICY "lesson_programs_public_select" ON lesson_programs FOR SELECT USING (status != 'DRAFT');
-- 시스템 관리자만 CRUD
CREATE POLICY "lesson_programs_admin_insert" ON lesson_programs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);
CREATE POLICY "lesson_programs_admin_update" ON lesson_programs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);
CREATE POLICY "lesson_programs_admin_delete" ON lesson_programs FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);

-- ─── lesson_sessions ─────────────────────────────────────────────────────────
CREATE TABLE lesson_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES lesson_programs(id) ON DELETE CASCADE,
  session_date  DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  location      TEXT,
  status        lesson_session_status NOT NULL DEFAULT 'SCHEDULED',
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_lesson_time CHECK (end_time > start_time)
);

CREATE INDEX idx_lesson_sessions_program_id ON lesson_sessions(program_id);
CREATE INDEX idx_lesson_sessions_date ON lesson_sessions(session_date);

ALTER TABLE lesson_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_sessions_public_select" ON lesson_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM lesson_programs lp WHERE lp.id = lesson_sessions.program_id AND lp.status != 'DRAFT')
);
CREATE POLICY "lesson_sessions_admin_write" ON lesson_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);

-- ─── lesson_enrollments ──────────────────────────────────────────────────────
-- 클럽 회원이 아닌 서비스 가입 사용자(profiles)가 직접 신청
CREATE TABLE lesson_enrollments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id            UUID NOT NULL REFERENCES lesson_programs(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status                enrollment_status NOT NULL DEFAULT 'PENDING',
  monthly_session_count JSONB NOT NULL DEFAULT '{}',
  enrolled_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at          TIMESTAMPTZ,

  UNIQUE(program_id, user_id)
);

CREATE INDEX idx_lesson_enrollments_program_id ON lesson_enrollments(program_id);
CREATE INDEX idx_lesson_enrollments_user_id ON lesson_enrollments(user_id);

ALTER TABLE lesson_enrollments ENABLE ROW LEVEL SECURITY;

-- 본인 or 관리자
CREATE POLICY "enrollments_select" ON lesson_enrollments FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);
CREATE POLICY "enrollments_insert" ON lesson_enrollments FOR INSERT WITH CHECK (
  user_id = auth.uid()
);
CREATE POLICY "enrollments_update" ON lesson_enrollments FOR UPDATE USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);

-- ─── lesson_attendances ──────────────────────────────────────────────────────
CREATE TABLE lesson_attendances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  enrollment_id   UUID NOT NULL REFERENCES lesson_enrollments(id) ON DELETE CASCADE,
  status          attendance_lesson_status NOT NULL DEFAULT 'ABSENT',
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(session_id, enrollment_id)
);

CREATE INDEX idx_lesson_attendances_session_id ON lesson_attendances(session_id);

ALTER TABLE lesson_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attendances_select" ON lesson_attendances FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM lesson_enrollments le
    WHERE le.id = lesson_attendances.enrollment_id AND le.user_id = auth.uid()
  )
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);
CREATE POLICY "attendances_admin_write" ON lesson_attendances FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);

-- ─── lesson_reschedule_requests ──────────────────────────────────────────────
CREATE TABLE lesson_reschedule_requests (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  enrollment_id         UUID REFERENCES lesson_enrollments(id),
  requested_by          UUID NOT NULL REFERENCES profiles(id),
  requester_type        reschedule_requester NOT NULL,
  original_date         DATE NOT NULL,
  original_start_time   TIME NOT NULL,
  original_end_time     TIME NOT NULL,
  requested_date        DATE NOT NULL,
  requested_start_time  TIME NOT NULL,
  requested_end_time    TIME NOT NULL,
  reason                TEXT,
  status                reschedule_status NOT NULL DEFAULT 'PENDING',
  responded_by          UUID REFERENCES profiles(id),
  responded_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reschedule_session_id ON lesson_reschedule_requests(session_id);

ALTER TABLE lesson_reschedule_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reschedule_select" ON lesson_reschedule_requests FOR SELECT USING (
  requested_by = auth.uid()
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);
CREATE POLICY "reschedule_insert" ON lesson_reschedule_requests FOR INSERT WITH CHECK (
  requested_by = auth.uid()
);
CREATE POLICY "reschedule_update" ON lesson_reschedule_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('SUPER_ADMIN', 'ADMIN'))
);
