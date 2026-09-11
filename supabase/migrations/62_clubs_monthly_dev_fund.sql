-- =============================================================================
-- 클럽 월 발전기금 기준 금액
-- - 61_clubs_monthly_court_fee.sql 과 동일 구조 (재정 설정에서 입력, 셀 입력 기본값)
-- - NULL = 미설정 (최근 납부 금액을 기본값으로 사용)
-- =============================================================================

ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS monthly_dev_fund INTEGER
  CHECK (monthly_dev_fund IS NULL OR monthly_dev_fund >= 0);

COMMENT ON COLUMN public.clubs.monthly_dev_fund IS '월 발전기금 기준 금액(원). NULL = 미설정';
