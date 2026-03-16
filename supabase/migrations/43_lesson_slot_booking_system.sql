-- Migration 43: 레슨 슬롯 기반 예약 시스템
-- 기존 lesson_sessions/enrollments 방식에서 슬롯 기반 예약 방식으로 전환

-- ── 1. ENUM 타입 ────────────────────────────────────────────────────────────────

CREATE TYPE lesson_slot_status AS ENUM ('OPEN', 'BLOCKED', 'LOCKED', 'BOOKED', 'CANCELLED');
CREATE TYPE lesson_slot_day_type AS ENUM ('WEEKDAY', 'WEEKEND');
CREATE TYPE lesson_booking_status AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');
CREATE TYPE lesson_booking_type AS ENUM ('WEEKDAY_1', 'WEEKEND_1', 'WEEKDAY_2', 'WEEKEND_2', 'MIXED_2');

-- ── 2. lesson_slots 테이블 ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lesson_slots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id        UUID NOT NULL REFERENCES lesson_programs(id) ON DELETE CASCADE,
  coach_id          UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  slot_date         DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  day_type          lesson_slot_day_type NOT NULL,
  status            lesson_slot_status NOT NULL DEFAULT 'OPEN',
  locked_member_id  UUID REFERENCES club_members(id) ON DELETE SET NULL,  -- LOCKED 시 배정된 회원
  notes             TEXT,
  created_by        UUID NOT NULL REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_slot_time CHECK (end_time > start_time),
  CONSTRAINT chk_slot_duration CHECK (
    EXTRACT(EPOCH FROM (end_time - start_time)) / 60 = 30  -- 30분 단위
  )
);

-- ── 3. lesson_bookings 테이블 ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lesson_bookings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 회원 또는 비회원 중 하나
  member_id     UUID REFERENCES club_members(id) ON DELETE SET NULL,
  guest_name    TEXT,
  guest_phone   TEXT,
  is_guest      BOOLEAN NOT NULL DEFAULT false,

  -- 선택한 슬롯 (1~2개)
  slot_ids      UUID[] NOT NULL,
  slot_count    INTEGER NOT NULL CHECK (slot_count BETWEEN 1 AND 2),

  -- 예약 정보
  booking_type  lesson_booking_type NOT NULL,
  fee_amount    INTEGER CHECK (fee_amount >= 0),

  -- 상태
  status        lesson_booking_status NOT NULL DEFAULT 'PENDING',
  confirmed_at  TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  cancel_reason TEXT,
  admin_note    TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 회원이거나 비회원 정보가 있어야 함
  CONSTRAINT chk_booking_identity CHECK (
    (member_id IS NOT NULL AND is_guest = false)
    OR
    (is_guest = true AND guest_name IS NOT NULL AND guest_phone IS NOT NULL)
  )
);

-- ── 4. lesson_programs에 혼합 요금 컬럼 추가 ────────────────────────────────────

ALTER TABLE lesson_programs
  ADD COLUMN IF NOT EXISTS fee_mixed_2 INTEGER CHECK (fee_mixed_2 >= 0);  -- 주중+주말 혼합 2회 월 요금

-- ── 5. 인덱스 ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_lesson_slots_program_id ON lesson_slots(program_id);
CREATE INDEX IF NOT EXISTS idx_lesson_slots_coach_id ON lesson_slots(coach_id);
CREATE INDEX IF NOT EXISTS idx_lesson_slots_date ON lesson_slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_lesson_slots_status ON lesson_slots(status);
CREATE INDEX IF NOT EXISTS idx_lesson_bookings_member_id ON lesson_bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_lesson_bookings_status ON lesson_bookings(status);

-- ── 6. updated_at 자동 갱신 트리거 ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lesson_slots_updated_at
  BEFORE UPDATE ON lesson_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER lesson_bookings_updated_at
  BEFORE UPDATE ON lesson_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 7. RLS 정책 ─────────────────────────────────────────────────────────────────

ALTER TABLE lesson_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_bookings ENABLE ROW LEVEL SECURITY;

-- lesson_slots: OPEN 슬롯은 누구나 조회 가능 (비회원 포함)
CREATE POLICY "lesson_slots_public_read" ON lesson_slots
  FOR SELECT USING (status = 'OPEN');

-- lesson_slots: 로그인 회원은 자기 클럽 슬롯 전체 조회
CREATE POLICY "lesson_slots_member_read" ON lesson_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lesson_programs lp
      JOIN club_members cm ON cm.club_id = lp.club_id
      WHERE lp.id = lesson_slots.program_id
        AND cm.user_id = auth.uid()
    )
  );

-- lesson_slots: 어드민만 생성/수정/삭제
CREATE POLICY "lesson_slots_admin_write" ON lesson_slots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lesson_programs lp
      JOIN club_members cm ON cm.club_id = lp.club_id
      WHERE lp.id = lesson_slots.program_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'ADMIN'
    )
  );

-- lesson_bookings: 본인 예약만 조회
CREATE POLICY "lesson_bookings_member_read" ON lesson_bookings
  FOR SELECT USING (
    member_id IN (SELECT id FROM club_members WHERE user_id = auth.uid())
  );

-- lesson_bookings: 어드민은 전체 조회
CREATE POLICY "lesson_bookings_admin_read" ON lesson_bookings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_members cm
      WHERE cm.user_id = auth.uid() AND cm.role = 'ADMIN'
    )
  );

-- lesson_bookings: 누구나 신청 가능 (비회원 포함 — service role 사용)
CREATE POLICY "lesson_bookings_insert" ON lesson_bookings
  FOR INSERT WITH CHECK (true);
