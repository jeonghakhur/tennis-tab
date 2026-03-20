-- Migration 46: lesson_slots에 fee_amount 추가, program_id nullable, RLS 재정의
ALTER TABLE lesson_slots ADD COLUMN IF NOT EXISTS fee_amount INTEGER;

COMMENT ON COLUMN lesson_slots.fee_amount IS '슬롯 요금 (원). NULL이면 별도 협의';

-- program_id nullable (프로그램 없이도 슬롯 등록 가능)
ALTER TABLE lesson_slots ALTER COLUMN program_id DROP NOT NULL;

-- RLS 정책 재정의 (lesson_programs 참조 제거)
DROP POLICY IF EXISTS "lesson_slots_member_read" ON lesson_slots;
DROP POLICY IF EXISTS "lesson_slots_admin_write" ON lesson_slots;

-- 인증된 사용자 또는 OPEN 슬롯은 누구나 읽기 가능
CREATE POLICY "lesson_slots_auth_read" ON lesson_slots
  FOR SELECT USING (auth.role() = 'authenticated' OR status = 'OPEN');
