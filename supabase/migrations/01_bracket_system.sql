-- =============================================================================
-- 대진표 시스템 스키마
-- 최대 128강까지 지원, 예선전(풀리그) + 본선(싱글 엘리미네이션)
-- =============================================================================

-- 트랜잭션 시작
BEGIN;

-- =============================================================================
-- 1. ENUM 타입 생성 (이미 존재하면 무시)
-- =============================================================================

-- 대진표 상태 enum
DO $$ BEGIN
  CREATE TYPE bracket_status AS ENUM ('DRAFT', 'PRELIMINARY', 'MAIN', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 경기 단계 enum
DO $$ BEGIN
  CREATE TYPE match_phase AS ENUM (
    'PRELIMINARY',
    'ROUND_128', 'ROUND_64', 'ROUND_32', 'ROUND_16',
    'QUARTER', 'SEMI', 'FINAL', 'THIRD_PLACE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 경기 상태 enum
DO $$ BEGIN
  CREATE TYPE match_status AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'BYE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 2. 테이블 생성
-- =============================================================================

-- 대진표 설정 테이블
CREATE TABLE IF NOT EXISTS bracket_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  division_id UUID NOT NULL REFERENCES tournament_divisions(id) ON DELETE CASCADE,
  has_preliminaries BOOLEAN DEFAULT false,
  third_place_match BOOLEAN DEFAULT false,
  bracket_size INTEGER, -- 4, 8, 16, 32, 64, 128
  status bracket_status DEFAULT 'DRAFT',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(division_id)
);

-- 예선 조 테이블
CREATE TABLE IF NOT EXISTS preliminary_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_config_id UUID NOT NULL REFERENCES bracket_configs(id) ON DELETE CASCADE,
  name VARCHAR(10) NOT NULL, -- 'A', 'B', 'C'...
  display_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 조별 팀 배정 테이블
CREATE TABLE IF NOT EXISTS group_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES preliminary_groups(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES tournament_entries(id) ON DELETE CASCADE,
  seed_number INTEGER, -- 조 내 시드
  final_rank INTEGER, -- 예선 결과 순위 (1, 2, 3...)
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  points_for INTEGER DEFAULT 0,
  points_against INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, entry_id)
);

-- 대진표 경기 테이블
CREATE TABLE IF NOT EXISTS bracket_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bracket_config_id UUID NOT NULL REFERENCES bracket_configs(id) ON DELETE CASCADE,
  phase match_phase NOT NULL,
  group_id UUID REFERENCES preliminary_groups(id) ON DELETE CASCADE,
  bracket_position INTEGER,
  round_number INTEGER,
  match_number INTEGER NOT NULL,
  team1_entry_id UUID REFERENCES tournament_entries(id) ON DELETE SET NULL,
  team2_entry_id UUID REFERENCES tournament_entries(id) ON DELETE SET NULL,
  team1_score INTEGER,
  team2_score INTEGER,
  winner_entry_id UUID REFERENCES tournament_entries(id) ON DELETE SET NULL,
  next_match_id UUID REFERENCES bracket_matches(id) ON DELETE SET NULL,
  next_match_slot INTEGER CHECK (next_match_slot IN (1, 2)),
  loser_next_match_id UUID REFERENCES bracket_matches(id) ON DELETE SET NULL,
  loser_next_match_slot INTEGER CHECK (loser_next_match_slot IN (1, 2)),
  status match_status DEFAULT 'SCHEDULED',
  scheduled_time TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. 인덱스 생성 (이미 존재하면 무시)
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_bracket_configs_division ON bracket_configs(division_id);
CREATE INDEX IF NOT EXISTS idx_preliminary_groups_bracket ON preliminary_groups(bracket_config_id);
CREATE INDEX IF NOT EXISTS idx_group_teams_group ON group_teams(group_id);
CREATE INDEX IF NOT EXISTS idx_group_teams_entry ON group_teams(entry_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_bracket ON bracket_matches(bracket_config_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_phase ON bracket_matches(phase);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_group ON bracket_matches(group_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_teams ON bracket_matches(team1_entry_id, team2_entry_id);

-- =============================================================================
-- 4. 트리거 생성 (이미 존재하면 삭제 후 재생성)
-- =============================================================================

DROP TRIGGER IF EXISTS update_bracket_configs_updated_at ON bracket_configs;
CREATE TRIGGER update_bracket_configs_updated_at
  BEFORE UPDATE ON bracket_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_group_teams_updated_at ON group_teams;
CREATE TRIGGER update_group_teams_updated_at
  BEFORE UPDATE ON group_teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bracket_matches_updated_at ON bracket_matches;
CREATE TRIGGER update_bracket_matches_updated_at
  BEFORE UPDATE ON bracket_matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- 5. RLS 활성화
-- =============================================================================

ALTER TABLE bracket_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE preliminary_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE bracket_matches ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- 6. RLS 정책 생성 (이미 존재하면 삭제 후 재생성)
-- =============================================================================

-- bracket_configs 정책
DROP POLICY IF EXISTS "Anyone can view bracket configs" ON bracket_configs;
CREATE POLICY "Anyone can view bracket configs" ON bracket_configs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can create bracket configs" ON bracket_configs;
CREATE POLICY "Authenticated users can create bracket configs" ON bracket_configs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can update bracket configs" ON bracket_configs;
CREATE POLICY "Authenticated users can update bracket configs" ON bracket_configs
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can delete bracket configs" ON bracket_configs;
CREATE POLICY "Authenticated users can delete bracket configs" ON bracket_configs
  FOR DELETE TO authenticated USING (true);

-- preliminary_groups 정책
DROP POLICY IF EXISTS "Anyone can view preliminary groups" ON preliminary_groups;
CREATE POLICY "Anyone can view preliminary groups" ON preliminary_groups
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage preliminary groups" ON preliminary_groups;
CREATE POLICY "Authenticated users can manage preliminary groups" ON preliminary_groups
  FOR ALL TO authenticated USING (true);

-- group_teams 정책
DROP POLICY IF EXISTS "Anyone can view group teams" ON group_teams;
CREATE POLICY "Anyone can view group teams" ON group_teams
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage group teams" ON group_teams;
CREATE POLICY "Authenticated users can manage group teams" ON group_teams
  FOR ALL TO authenticated USING (true);

-- bracket_matches 정책
DROP POLICY IF EXISTS "Anyone can view bracket matches" ON bracket_matches;
CREATE POLICY "Anyone can view bracket matches" ON bracket_matches
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can manage bracket matches" ON bracket_matches;
CREATE POLICY "Authenticated users can manage bracket matches" ON bracket_matches
  FOR ALL TO authenticated USING (true);

-- =============================================================================
-- 7. 코멘트
-- =============================================================================

COMMENT ON TABLE bracket_configs IS '대진표 설정';
COMMENT ON TABLE preliminary_groups IS '예선 조';
COMMENT ON TABLE group_teams IS '조별 팀 배정';
COMMENT ON TABLE bracket_matches IS '대진표 경기 정보';
COMMENT ON COLUMN bracket_configs.bracket_size IS '본선 대진표 크기 (4, 8, 16, 32, 64, 128)';
COMMENT ON COLUMN bracket_matches.bracket_position IS '본선 대진표 내 위치 번호';
COMMENT ON COLUMN bracket_matches.next_match_id IS '승자가 진출할 다음 경기';
COMMENT ON COLUMN bracket_matches.loser_next_match_id IS '패자가 진출할 경기 (3/4위전용)';

-- 트랜잭션 커밋
COMMIT;

-- =============================================================================
-- 검증 쿼리 (실행 후 결과 확인용)
-- =============================================================================
-- 아래 쿼리로 테이블이 정상 생성되었는지 확인할 수 있습니다:
--
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('bracket_configs', 'preliminary_groups', 'group_teams', 'bracket_matches');
--
-- 예상 결과: 4개 행 (bracket_configs, preliminary_groups, group_teams, bracket_matches)
