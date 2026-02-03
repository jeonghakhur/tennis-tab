-- 대회 테이블 확장 및 참가부서 테이블 추가
-- 경기 방식 ENUM 변경 (새 타입 생성)
CREATE TYPE match_type AS ENUM (
  'INDIVIDUAL_SINGLES',   -- 개인전 단식
  'INDIVIDUAL_DOUBLES',   -- 개인전 복식
  'TEAM_SINGLES',         -- 단체전 단식
  'TEAM_DOUBLES'          -- 단체전 복식
);

-- tournaments 테이블에 새 컬럼 추가
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS host TEXT,                          -- 주최
  ADD COLUMN IF NOT EXISTS organizer_name TEXT,                -- 주관
  ADD COLUMN IF NOT EXISTS ball_type TEXT,                     -- 대회 사용구
  ADD COLUMN IF NOT EXISTS entry_start_date TIMESTAMPTZ,       -- 참가 신청일
  ADD COLUMN IF NOT EXISTS entry_end_date TIMESTAMPTZ,         -- 참가 마감일
  ADD COLUMN IF NOT EXISTS opening_ceremony TIMESTAMPTZ,       -- 개회식
  ADD COLUMN IF NOT EXISTS match_type match_type,              -- 경기 방식 (새 타입)
  ADD COLUMN IF NOT EXISTS bank_account TEXT,                  -- 입금 계좌
  ADD COLUMN IF NOT EXISTS eligibility TEXT;                   -- 참가 자격

-- 참가부서 테이블 생성
CREATE TABLE IF NOT EXISTS tournament_divisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                                          -- 참가부서 이름
  max_teams INTEGER,                                           -- 참가팀수
  team_member_limit INTEGER,                                   -- 팀 참가 선수 제한 (단체전)
  match_date TIMESTAMPTZ,                                      -- 시합 일시
  match_location TEXT,                                         -- 시합 장소
  prize_winner TEXT,                                           -- 우승 시상
  prize_runner_up TEXT,                                        -- 준우승 시상
  prize_third TEXT,                                            -- 3위 시상
  notes TEXT,                                                  -- 기타 사항 (HTML)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index 생성
CREATE INDEX IF NOT EXISTS idx_tournament_divisions_tournament ON tournament_divisions(tournament_id);

-- Updated_at 트리거 설정
CREATE TRIGGER update_tournament_divisions_updated_at BEFORE UPDATE ON tournament_divisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 활성화
ALTER TABLE tournament_divisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view tournament divisions" ON tournament_divisions
  FOR SELECT USING (true);

CREATE POLICY "Admins can create tournament divisions" ON tournament_divisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Admins can update tournament divisions" ON tournament_divisions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Admins can delete tournament divisions" ON tournament_divisions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN')
    )
  );

-- Comment 추가
COMMENT ON TABLE tournament_divisions IS '대회 참가부서 정보';
COMMENT ON COLUMN tournament_divisions.name IS '참가부서 이름 (예: 남자 A조, 여자 B조)';
COMMENT ON COLUMN tournament_divisions.max_teams IS '해당 부서 최대 참가팀 수';
COMMENT ON COLUMN tournament_divisions.team_member_limit IS '단체전 시 팀당 최대 선수 수';
COMMENT ON COLUMN tournament_divisions.notes IS '기타 사항 (HTML 형식 지원)';
