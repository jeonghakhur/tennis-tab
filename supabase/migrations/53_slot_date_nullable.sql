-- lesson_slots.slot_date, start_time, end_time, day_type를 nullable로 변경
-- 날짜 미정 슬롯 지원: 코치가 날짜 없이 슬롯 등록 → 회원 신청 후 날짜 협의
ALTER TABLE lesson_slots ALTER COLUMN slot_date DROP NOT NULL;
ALTER TABLE lesson_slots ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE lesson_slots ALTER COLUMN end_time DROP NOT NULL;
ALTER TABLE lesson_slots ALTER COLUMN day_type DROP NOT NULL;
