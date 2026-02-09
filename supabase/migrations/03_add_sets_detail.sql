-- bracket_matches에 세트별 상세 결과 저장 컬럼 추가
ALTER TABLE bracket_matches ADD COLUMN IF NOT EXISTS sets_detail JSONB DEFAULT NULL;
