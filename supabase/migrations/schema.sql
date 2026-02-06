-- Tennis Tab 데이터베이스 스키마 (00_initial_schema.sql과 동일)
-- 원격 DB 덤프 시 scripts/dump-schema.sh 실행 시 이 파일이 덮어씌워짐.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- Enums
-- =============================================================================
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER');
CREATE TYPE tournament_status AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE tournament_format AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'LEAGUE', 'MIXED');
CREATE TYPE match_type AS ENUM (
  'INDIVIDUAL_SINGLES',
  'INDIVIDUAL_DOUBLES',
  'TEAM_SINGLES',
  'TEAM_DOUBLES'
);
CREATE TYPE entry_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED', 'WAITLISTED', 'CANCELLED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- =============================================================================
-- Tables
-- =============================================================================

-- Profiles (auth.users 확장, dominant_hand/skill_level 없음)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  start_year TEXT,
  rating INTEGER CHECK (rating IS NULL OR (rating >= 1 AND rating <= 9999)),
  gender TEXT CHECK (gender IS NULL OR gender IN ('M', 'F')),
  club TEXT,
  club_city TEXT,
  club_district TEXT,
  role user_role DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tournaments (대회 확장 필드 포함)
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  max_participants INTEGER NOT NULL,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  status tournament_status NOT NULL DEFAULT 'DRAFT',
  format tournament_format NOT NULL,
  match_type match_type,
  host TEXT,
  organizer_name TEXT,
  ball_type TEXT,
  entry_start_date TIMESTAMPTZ,
  entry_end_date TIMESTAMPTZ,
  opening_ceremony TIMESTAMPTZ,
  bank_account TEXT,
  eligibility TEXT,
  requirements JSONB,
  poster_url TEXT,
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Tournament Divisions (참가부서)
CREATE TABLE tournament_divisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  max_teams INTEGER,
  team_member_limit INTEGER,
  match_date TIMESTAMPTZ,
  match_location TEXT,
  prize_winner TEXT,
  prize_runner_up TEXT,
  prize_third TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tournament Entries (참가 신청, 확장 필드 포함)
CREATE TABLE tournament_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES tournament_divisions(id) ON DELETE CASCADE,
  status entry_status NOT NULL DEFAULT 'PENDING',
  phone TEXT NOT NULL DEFAULT '',
  player_name TEXT NOT NULL DEFAULT '',
  player_rating INTEGER,
  club_name TEXT,
  team_order TEXT,
  partner_data JSONB,
  team_members JSONB,
  payment_status payment_status DEFAULT 'PENDING',
  payment_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tournament_entries_unique_entry UNIQUE(tournament_id, user_id, division_id),
  CONSTRAINT check_division_belongs_to_tournament CHECK (
    EXISTS (
      SELECT 1 FROM tournament_divisions td
      WHERE td.id = division_id AND td.tournament_id = tournament_id
    )
  )
);

-- Matches
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  player1_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  player2_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  winner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  score TEXT,
  court_number TEXT,
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_winner CHECK (winner_id IN (player1_id, player2_id) OR winner_id IS NULL)
);

-- Chat Logs
CREATE TABLE chat_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  message TEXT NOT NULL,
  response TEXT NOT NULL,
  intent TEXT,
  entities JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Indexes
-- =============================================================================
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_organizer ON tournaments(organizer_id);
CREATE INDEX idx_tournaments_dates ON tournaments(start_date, end_date);
CREATE INDEX idx_tournament_divisions_tournament ON tournament_divisions(tournament_id);
CREATE INDEX idx_tournament_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX idx_tournament_entries_user ON tournament_entries(user_id);
CREATE INDEX idx_tournament_entries_division ON tournament_entries(division_id);
CREATE INDEX idx_tournament_entries_payment ON tournament_entries(payment_status);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_chat_logs_user ON chat_logs(user_id);
CREATE INDEX idx_chat_logs_session ON chat_logs(session_id);

-- =============================================================================
-- Functions
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'USER'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_role(user_id UUID, new_role user_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_role user_role;
BEGIN
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_user_role = 'SUPER_ADMIN' THEN
    UPDATE public.profiles
    SET role = new_role, updated_at = NOW()
    WHERE id = user_id;
  ELSE
    RAISE EXCEPTION 'Only SUPER_ADMIN can change user roles';
  END IF;
END;
$$;

-- =============================================================================
-- Triggers
-- =============================================================================
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_divisions_updated_at BEFORE UPDATE ON tournament_divisions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_entries_updated_at BEFORE UPDATE ON tournament_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- RLS
-- =============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Anyone can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Tournaments (인증 사용자 생성 허용)
CREATE POLICY "Anyone can view tournaments" ON tournaments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tournaments" ON tournaments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Organizers can update their tournaments" ON tournaments
  FOR UPDATE USING (
    organizer_id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN'))
  );

-- Tournament Divisions
CREATE POLICY "Anyone can view tournament divisions" ON tournament_divisions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create tournament divisions" ON tournament_divisions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.organizer_id = auth.uid())
  );
CREATE POLICY "Admins can update tournament divisions" ON tournament_divisions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.organizer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN'))
  );
CREATE POLICY "Admins can delete tournament divisions" ON tournament_divisions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.organizer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN'))
  );

-- Tournament Entries
CREATE POLICY "Users can view tournament entries" ON tournament_entries FOR SELECT USING (true);
CREATE POLICY "Users can create their own entries" ON tournament_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own entries" ON tournament_entries FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own entries" ON tournament_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Organizers can update entries for their tournaments" ON tournament_entries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM tournaments WHERE id = tournament_entries.tournament_id AND organizer_id = auth.uid())
  );

-- Matches
CREATE POLICY "Anyone can view matches" ON matches FOR SELECT USING (true);
CREATE POLICY "Admins can manage matches" ON matches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM tournaments t WHERE t.id = tournament_id AND t.organizer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN'))
  );

-- Chat Logs
CREATE POLICY "Users can view their own chat logs" ON chat_logs FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
CREATE POLICY "Anyone can insert chat logs" ON chat_logs FOR INSERT WITH CHECK (true);

-- =============================================================================
-- Comments
-- =============================================================================
COMMENT ON TABLE public.profiles IS 'User profiles with extended information beyond auth.users';
COMMENT ON COLUMN public.profiles.role IS 'User role: SUPER_ADMIN, ADMIN, MANAGER, USER';
COMMENT ON COLUMN public.profiles.start_year IS '테니스 입문 년도 (예: 2026, 2025, 2016년 이전)';
COMMENT ON COLUMN public.profiles.rating IS '실력 점수 (1 ~ 9999)';
COMMENT ON COLUMN public.profiles.gender IS '성별 (M: 남성, F: 여성)';
COMMENT ON COLUMN public.profiles.club_city IS '클럽 소재지 - 시도';
COMMENT ON COLUMN public.profiles.club_district IS '클럽 소재지 - 시군구';
COMMENT ON TABLE tournament_divisions IS '대회 참가부서 정보';
COMMENT ON COLUMN tournament_divisions.notes IS '기타 사항 (HTML 형식 지원)';
COMMENT ON COLUMN tournament_entries.division_id IS '참가 부서 ID';
COMMENT ON COLUMN tournament_entries.phone IS '참가자 전화번호';
COMMENT ON COLUMN tournament_entries.player_name IS '참가자 이름';
COMMENT ON COLUMN tournament_entries.player_rating IS '참가자 점수/레이팅';
COMMENT ON COLUMN tournament_entries.club_name IS '클럽명 (단체전용)';
COMMENT ON COLUMN tournament_entries.team_order IS '팀 순서 (단체전용, 예: 가/나/다)';
COMMENT ON COLUMN tournament_entries.partner_data IS '파트너 정보 (개인전 복식용, JSON)';
COMMENT ON COLUMN tournament_entries.team_members IS '팀원 정보 (단체전용, JSON 배열)';
COMMENT ON COLUMN tournament_entries.payment_status IS '결제 상태';
COMMENT ON COLUMN tournament_entries.payment_confirmed_at IS '결제 확인 시간';
COMMENT ON FUNCTION public.set_user_role IS 'Change user role - only SUPER_ADMIN can execute';
