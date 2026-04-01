-- 회원 탈퇴 시 레슨 관련 FK 위반 방지
-- coaches, lesson_programs, lesson_sessions, lesson_slots: created_by NOT NULL → nullable + ON DELETE SET NULL
-- lesson_reschedule_requests: requested_by NOT NULL → nullable + ON DELETE SET NULL
--                             responded_by nullable → ON DELETE SET NULL

-- coaches.created_by
ALTER TABLE coaches ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE coaches
  DROP CONSTRAINT IF EXISTS coaches_created_by_fkey;
ALTER TABLE coaches
  ADD CONSTRAINT coaches_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- lesson_programs.created_by
ALTER TABLE lesson_programs ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE lesson_programs
  DROP CONSTRAINT IF EXISTS lesson_programs_created_by_fkey;
ALTER TABLE lesson_programs
  ADD CONSTRAINT lesson_programs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- lesson_slots.created_by
ALTER TABLE lesson_slots ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE lesson_slots
  DROP CONSTRAINT IF EXISTS lesson_slots_created_by_fkey;
ALTER TABLE lesson_slots
  ADD CONSTRAINT lesson_slots_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- lesson_reschedule_requests.requested_by
ALTER TABLE lesson_reschedule_requests ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE lesson_reschedule_requests
  DROP CONSTRAINT IF EXISTS lesson_reschedule_requests_requested_by_fkey;
ALTER TABLE lesson_reschedule_requests
  ADD CONSTRAINT lesson_reschedule_requests_requested_by_fkey
  FOREIGN KEY (requested_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- lesson_reschedule_requests.responded_by (이미 nullable)
ALTER TABLE lesson_reschedule_requests
  DROP CONSTRAINT IF EXISTS lesson_reschedule_requests_responded_by_fkey;
ALTER TABLE lesson_reschedule_requests
  ADD CONSTRAINT lesson_reschedule_requests_responded_by_fkey
  FOREIGN KEY (responded_by) REFERENCES profiles(id) ON DELETE SET NULL;
