-- coaches 테이블에 계좌 정보 컬럼 추가
-- 레슨 확정 알림톡 #{계좌정보} 변수에 사용

ALTER TABLE coaches
  ADD COLUMN IF NOT EXISTS bank_account TEXT DEFAULT NULL;

COMMENT ON COLUMN coaches.bank_account IS '레슨비 입금 계좌 (예: 국민은행 123-456-789 홍길동)';
