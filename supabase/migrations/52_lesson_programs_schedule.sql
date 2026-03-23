-- lesson_programs에 스케줄 관련 컬럼 추가
-- 알림톡에서 레슨 시작일, 요일 등을 표시하기 위해 필요

ALTER TABLE lesson_programs
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS days_of_week TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS start_time TIME;

COMMENT ON COLUMN lesson_programs.start_date IS '레슨 시작일';
COMMENT ON COLUMN lesson_programs.end_date IS '레슨 종료일';
COMMENT ON COLUMN lesson_programs.days_of_week IS '레슨 요일 배열 (예: {"월","수"})';
COMMENT ON COLUMN lesson_programs.start_time IS '레슨 시작 시간';
