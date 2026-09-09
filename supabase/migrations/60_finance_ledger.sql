-- =============================================================================
-- 협회 재정 관리 (Finance Ledger)
-- - 통장(계정) / 수입·지출 분류 / 거래 원장 / 클럽 약칭 / 연간 예산
-- - 잔액은 저장하지 않고 항상 opening_balance + Σ수입 − Σ지출 로 계산
-- - 금액은 부호 없는 정수(원), 방향은 분류(kind)로 결정
-- =============================================================================

-- ---------- 통장(계정) ----------
CREATE TABLE public.finance_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL UNIQUE,
  account_type     TEXT NOT NULL CHECK (account_type IN ('CONSIGNMENT', 'ASSOCIATION', 'BOARD')),
  opening_balance  BIGINT NOT NULL DEFAULT 0,
  opening_date     DATE NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INT NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON TABLE public.finance_accounts IS '재정 통장(계정). 잔액은 저장하지 않음';
COMMENT ON COLUMN public.finance_accounts.opening_balance IS '기초잔액(원) — opening_date 시점';

-- ---------- 수입/지출 분류 ----------
CREATE TABLE public.finance_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID NOT NULL REFERENCES public.finance_accounts(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
  name        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (account_id, kind, name)
);

-- ---------- 거래 원장 ----------
CREATE TABLE public.finance_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id     UUID NOT NULL REFERENCES public.finance_accounts(id) ON DELETE RESTRICT,
  category_id    UUID NOT NULL REFERENCES public.finance_categories(id) ON DELETE RESTRICT,
  occurred_at    TIMESTAMPTZ NOT NULL,
  description    TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 100),
  amount         BIGINT NOT NULL CHECK (amount > 0),
  memo           TEXT CHECK (memo IS NULL OR char_length(memo) <= 200),
  club_id        UUID REFERENCES public.clubs(id) ON DELETE SET NULL,
  tournament_id  UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  source         TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'IMPORT', 'CLUB_FEE', 'TOSS')),
  import_key     TEXT UNIQUE,
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);
COMMENT ON COLUMN public.finance_transactions.amount IS '원 단위 양수. 수입/지출 방향은 category.kind';
COMMENT ON COLUMN public.finance_transactions.import_key IS '가져오기·자동생성 중복 방지 키 (예: club_fee:{club_id}:{year})';

CREATE INDEX idx_finance_tx_account_date ON public.finance_transactions (account_id, occurred_at);
CREATE INDEX idx_finance_tx_club         ON public.finance_transactions (club_id);
CREATE INDEX idx_finance_tx_category     ON public.finance_transactions (category_id);

-- ---------- 클럽 약칭 (엑셀 비고·적요 → clubs 매핑) ----------
CREATE TABLE public.finance_club_aliases (
  alias       TEXT PRIMARY KEY,
  club_id     UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- 연간 운영계획(예산) ----------
CREATE TABLE public.finance_budgets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year            SMALLINT NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  account_id      UUID NOT NULL REFERENCES public.finance_accounts(id) ON DELETE CASCADE,
  label           TEXT NOT NULL CHECK (char_length(label) BETWEEN 1 AND 50),
  kind            TEXT NOT NULL CHECK (kind IN ('INCOME', 'EXPENSE')),
  category_ids    UUID[] NOT NULL DEFAULT '{}',
  planned_amount  BIGINT NOT NULL CHECK (planned_amount >= 0),
  memo            TEXT CHECK (memo IS NULL OR char_length(memo) <= 200),
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, account_id, label)
);

-- ---------- 클럽 코트 시간대 그룹 (납부 매트릭스 그룹핑) ----------
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS court_slot TEXT;
COMMENT ON COLUMN public.clubs.court_slot IS '나들목 코트 배정 시간대 (조기/주중오전/주중오후/주중1회/주말1회/주말오전/주말오후 등)';

-- ---------- updated_at 트리거 ----------
CREATE TRIGGER update_finance_accounts_updated_at BEFORE UPDATE ON public.finance_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_finance_categories_updated_at BEFORE UPDATE ON public.finance_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_finance_transactions_updated_at BEFORE UPDATE ON public.finance_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_finance_budgets_updated_at BEFORE UPDATE ON public.finance_budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- RLS: 시스템 ADMIN 이상만 ----------
ALTER TABLE public.finance_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_club_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_budgets      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage finance_accounts" ON public.finance_accounts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')));
CREATE POLICY "Admins manage finance_categories" ON public.finance_categories FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')));
CREATE POLICY "Admins manage finance_transactions" ON public.finance_transactions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')));
CREATE POLICY "Admins manage finance_club_aliases" ON public.finance_club_aliases FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')));
CREATE POLICY "Admins manage finance_budgets" ON public.finance_budgets FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('ADMIN','SUPER_ADMIN')));

-- =============================================================================
-- 시드: 2026년 결산서 기준 계정·분류·클럽 약칭
-- =============================================================================
INSERT INTO public.finance_accounts (name, account_type, opening_balance, opening_date, sort_order) VALUES
  ('위탁통장', 'CONSIGNMENT', 7091243,  '2026-01-01', 1),
  ('협회통장', 'ASSOCIATION', 13505114, '2026-01-01', 2),
  ('이사회비', 'BOARD',       1586393,  '2026-01-01', 3);

-- 위탁통장 분류
INSERT INTO public.finance_categories (account_id, kind, name, sort_order)
SELECT a.id, v.kind, v.name, v.ord
FROM public.finance_accounts a,
     (VALUES
       ('INCOME',  '동호회코트비', 1), ('INCOME', '개인 코트비', 2), ('INCOME', '이자', 3),
       ('EXPENSE', '인건비', 1), ('EXPENSE', '시설운영비', 2), ('EXPENSE', '수도광열비', 3),
       ('EXPENSE', '물품구입비', 4), ('EXPENSE', '기타운영비', 5), ('EXPENSE', '위탁료', 6)
     ) AS v(kind, name, ord)
WHERE a.account_type = 'CONSIGNMENT';

-- 협회통장 분류
INSERT INTO public.finance_categories (account_id, kind, name, sort_order)
SELECT a.id, v.kind, v.name, v.ord
FROM public.finance_accounts a,
     (VALUES
       ('INCOME',  '발전기금', 1), ('INCOME', '레슨코트비', 2), ('INCOME', '협회비', 3), ('INCOME', '찬조', 4),
       ('INCOME',  '참가비', 5), ('INCOME', '이자', 6), ('INCOME', '대회수입', 7),
       ('EXPENSE', '식비', 1), ('EXPENSE', '기타', 2), ('EXPENSE', '체육회비', 3),
       ('EXPENSE', '협회장기대회', 4), ('EXPENSE', '구청장기대회', 5), ('EXPENSE', '서울시장기대회', 6),
       ('EXPENSE', '체육회장배대회', 7), ('EXPENSE', '시니어대회', 8), ('EXPENSE', '서울협회장배대회', 9)
     ) AS v(kind, name, ord)
WHERE a.account_type = 'ASSOCIATION';

-- 이사회비 분류
INSERT INTO public.finance_categories (account_id, kind, name, sort_order)
SELECT a.id, v.kind, v.name, v.ord
FROM public.finance_accounts a,
     (VALUES ('INCOME', '이사회비', 1), ('EXPENSE', '회식', 1), ('EXPENSE', '기타', 2)) AS v(kind, name, ord)
WHERE a.account_type = 'BOARD';

-- 클럽 약칭 (DB 클럽명과 다른 것만; 동일명은 이름으로 직접 매칭)
INSERT INTO public.finance_club_aliases (alias, club_id)
SELECT v.alias, c.id
FROM (VALUES ('테마인', '테니스마인드'), ('에이클', 'A클래스'), ('마포구청', '마테동'), ('에이클래스', 'A클래스')) AS v(alias, club_name)
JOIN public.clubs c ON c.name = v.club_name
ON CONFLICT (alias) DO NOTHING;

-- 클럽 코트 시간대 (나들목 클럽 납부내역 시트 기준)
UPDATE public.clubs SET court_slot = v.slot
FROM (VALUES
  ('한우리','조기'), ('건우회','조기'), ('한사랑','조기'), ('한빛회','조기'),
  ('목우회','주중오전'), ('상록회','주중오전'),
  ('오성회','주중오후'), ('일레븐','주중오후'), ('어울림','주중오후'),
  ('아르미','주중1회'), ('수요회','주중1회'),
  ('마테동','주말1회'), ('정우회','주말1회'), ('홍우회','주말1회'), ('서교회','주말1회'),
  ('테니스마인드','주말오전'), ('A클래스','주말오전'),
  ('두레회','주말오후'), ('청우회','주말오후'),
  ('건승회','주말오전,오후')
) AS v(name, slot)
WHERE public.clubs.name = v.name;
