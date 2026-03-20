-- lesson_slots에 연장 완료 시각 컬럼 추가
-- extended_at이 null이 아니면 해당 슬롯은 이미 연장 처리된 슬롯 → 연장 버튼 숨김
ALTER TABLE lesson_slots ADD COLUMN IF NOT EXISTS extended_at TIMESTAMPTZ;
