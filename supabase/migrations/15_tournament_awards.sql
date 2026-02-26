-- =============================================================================
-- 대회 입상자 이력 테이블
-- 레거시 Sanity 데이터 + 미래 서비스 대회 결과 양용
-- =============================================================================

CREATE TABLE public.tournament_awards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 대회 정보 (레거시: 텍스트, 미래: FK 연결 가능)
  competition     TEXT NOT NULL,   -- "제37회 마포구청장기"
  year            SMALLINT NOT NULL,
  division        TEXT NOT NULL,   -- "챌린저부"
  game_type       TEXT NOT NULL CHECK (game_type IN ('단체전', '개인전')),
  award_rank      TEXT NOT NULL CHECK (award_rank IN ('우승', '준우승', '공동3위', '3위')),
  players         TEXT[] NOT NULL, -- 선수 이름 배열
  club_name       TEXT,

  -- 미래 대회 연결 (레거시는 NULL)
  tournament_id   UUID REFERENCES public.tournaments(id) ON DELETE SET NULL,
  division_id     UUID REFERENCES public.tournament_divisions(id) ON DELETE SET NULL,
  entry_id        UUID REFERENCES public.tournament_entries(id) ON DELETE SET NULL,

  -- 유저 클레임 (이름 확인 후 연동)
  player_user_ids UUID[],
  club_id         UUID REFERENCES public.clubs(id) ON DELETE SET NULL,

  -- 레거시 중복 방지
  legacy_id       TEXT UNIQUE,

  display_order   INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER update_tournament_awards_updated_at
  BEFORE UPDATE ON public.tournament_awards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.tournament_awards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament awards"
  ON public.tournament_awards FOR SELECT USING (true);

CREATE POLICY "Managers can manage tournament awards"
  ON public.tournament_awards FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

CREATE INDEX idx_awards_year        ON public.tournament_awards (year DESC);
CREATE INDEX idx_awards_competition ON public.tournament_awards (competition);
CREATE INDEX idx_awards_players     ON public.tournament_awards USING GIN (players);
CREATE INDEX idx_awards_user_ids    ON public.tournament_awards USING GIN (player_user_ids);
CREATE INDEX idx_awards_club_id     ON public.tournament_awards (club_id);
CREATE INDEX idx_awards_tournament  ON public.tournament_awards (tournament_id);
