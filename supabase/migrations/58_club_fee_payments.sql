-- =============================================================================
-- 클럽 협회 연회비 납부 기록
-- - boolean + 연초 리셋 대신 (club_id, year) 단위로 납부 이력을 보관
-- - "올해 납부 여부" = 현재 연도(KST) 행 존재 여부 → 별도 리셋 잡 불필요, 이력 보존
-- =============================================================================

CREATE TABLE public.club_fee_payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id       UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  year          SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  memo          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (club_id, year)
);

COMMENT ON TABLE public.club_fee_payments IS '클럽 협회 연회비 납부 기록 — 연도별 1행, 행 존재 = 해당 연도 납부';
COMMENT ON COLUMN public.club_fee_payments.recorded_by IS '납부 처리한 관리자';

CREATE TRIGGER update_club_fee_payments_updated_at
  BEFORE UPDATE ON public.club_fee_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.club_fee_payments ENABLE ROW LEVEL SECURITY;

-- 조회: 로그인 사용자 (클럽 운영자가 자기 클럽 납부 상태 확인 가능)
CREATE POLICY "Authenticated can view club fee payments"
  ON public.club_fee_payments FOR SELECT TO authenticated USING (true);

-- 변경: 시스템 ADMIN 이상만 (클럽 운영자가 스스로 납부 처리하지 못하도록)
CREATE POLICY "Admins can manage club fee payments"
  ON public.club_fee_payments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE INDEX idx_club_fee_payments_year    ON public.club_fee_payments (year);
CREATE INDEX idx_club_fee_payments_club_id ON public.club_fee_payments (club_id);
