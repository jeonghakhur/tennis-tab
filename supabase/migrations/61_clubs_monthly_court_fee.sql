-- =============================================================================
-- 클럽 월 코트비(임대료) 기준 금액
-- - 클럽별 고정 월 코트비를 재정 설정에서 직접 입력
-- - 클럽 납부 매트릭스 셀 입력 기본값 + "월 코트비" 컬럼 표시에 사용
-- - NULL = 미설정 (기존처럼 최근 납부 금액을 기본값으로 사용)
-- =============================================================================

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS monthly_court_fee INTEGER
  CHECK (monthly_court_fee IS NULL OR monthly_court_fee >= 0);

COMMENT ON COLUMN public.clubs.monthly_court_fee IS '월 코트비(임대료) 기준 금액(원). NULL = 미설정';
