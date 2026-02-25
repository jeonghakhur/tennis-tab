-- 토스 페이먼츠 결제 컬럼 추가
ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS payment_key TEXT,
  ADD COLUMN IF NOT EXISTS toss_order_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMPTZ;

-- paymentKey 조회 인덱스 (결제 취소 시 사용)
CREATE INDEX IF NOT EXISTS idx_tournament_entries_payment_key
  ON tournament_entries(payment_key)
  WHERE payment_key IS NOT NULL;

COMMENT ON COLUMN tournament_entries.payment_key IS '토스 페이먼츠 paymentKey';
COMMENT ON COLUMN tournament_entries.toss_order_id IS '토스 페이먼츠 orderId (toss-{entryId} 형식)';
COMMENT ON COLUMN tournament_entries.payment_confirmed_at IS '결제 승인 완료 시각';
