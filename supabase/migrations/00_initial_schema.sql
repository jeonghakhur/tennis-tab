-- Tennis Tab 초기 데이터베이스 스키마
-- PRD.md 섹션 5 기반

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums 생성
CREATE TYPE skill_level AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL');
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER', 'USER');
CREATE TYPE tournament_status AS ENUM ('DRAFT', 'OPEN', 'CLOSED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE tournament_format AS ENUM ('SINGLE_ELIMINATION', 'DOUBLE_ELIMINATION', 'LEAGUE', 'MIXED');
CREATE TYPE entry_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Profiles 테이블 (공식 문서 권장 방식)
-- auth.users를 참조하며, 사용자 프로필 정보 저장
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  skill_level skill_level,
  dominant_hand TEXT CHECK (dominant_hand IN ('LEFT', 'RIGHT', 'BOTH')),
  club TEXT,
  role user_role DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tournaments 테이블
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
  requirements JSONB,
  poster_url TEXT,
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_dates CHECK (end_date >= start_date)
);

-- Tournament Entries 테이블
CREATE TABLE tournament_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status entry_status NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

-- Matches 테이블
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

-- Chat Logs 테이블
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

-- Indexes 생성
CREATE INDEX idx_tournaments_status ON tournaments(status);
CREATE INDEX idx_tournaments_organizer ON tournaments(organizer_id);
CREATE INDEX idx_tournaments_dates ON tournaments(start_date, end_date);
CREATE INDEX idx_tournament_entries_tournament ON tournament_entries(tournament_id);
CREATE INDEX idx_tournament_entries_user ON tournament_entries(user_id);
CREATE INDEX idx_matches_tournament ON matches(tournament_id);
CREATE INDEX idx_chat_logs_user ON chat_logs(user_id);
CREATE INDEX idx_chat_logs_session ON chat_logs(session_id);

-- Updated_at 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated_at 트리거 설정
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournaments_updated_at BEFORE UPDATE ON tournaments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tournament_entries_updated_at BEFORE UPDATE ON tournament_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) 활성화
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Profiles: 자신의 정보만 수정 가능, 모두 읽기 가능
CREATE POLICY "Anyone can view all profiles" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Tournaments: 모두 읽기 가능, 관리자만 생성/수정
CREATE POLICY "Anyone can view tournaments" ON tournaments
  FOR SELECT USING (true);

CREATE POLICY "Admins can create tournaments" ON tournaments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Organizers can update their tournaments" ON tournaments
  FOR UPDATE USING (
    organizer_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN')
    )
  );

-- Tournament Entries: 참가자와 관리자만 조회/관리
CREATE POLICY "Users can view tournament entries" ON tournament_entries
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own entries" ON tournament_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entries" ON tournament_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Matches: 모두 읽기 가능, 관리자만 생성/수정
CREATE POLICY "Anyone can view matches" ON matches
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage matches" ON matches
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('ADMIN', 'MANAGER', 'SUPER_ADMIN')
    )
  );

-- Chat Logs: 자신의 로그만 조회 가능
CREATE POLICY "Users can view their own chat logs" ON chat_logs
  FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Anyone can insert chat logs" ON chat_logs
  FOR INSERT WITH CHECK (true);

-- Function: 사용자 프로필 자동 생성 (회원가입 시)
-- Supabase 공식 문서 권장 방식
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
    'USER' -- 기본 권한은 USER
  );
  RETURN NEW;
END;
$$;

-- Trigger: 새 사용자 생성 시 프로필 자동 생성
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function: 특정 사용자에게 권한 부여 (SUPER_ADMIN만 실행 가능)
CREATE OR REPLACE FUNCTION public.set_user_role(user_id UUID, new_role user_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_role user_role;
BEGIN
  -- 현재 사용자의 권한 확인
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  -- SUPER_ADMIN만 권한 변경 가능
  IF current_user_role = 'SUPER_ADMIN' THEN
    UPDATE public.profiles
    SET role = new_role, updated_at = NOW()
    WHERE id = user_id;
  ELSE
    RAISE EXCEPTION 'Only SUPER_ADMIN can change user roles';
  END IF;
END;
$$;

-- Comment 추가 (문서화)
COMMENT ON TABLE public.profiles IS 'User profiles with extended information beyond auth.users';
COMMENT ON COLUMN public.profiles.role IS 'User role: SUPER_ADMIN (전체 관리), ADMIN (대회 관리), MANAGER (대회 운영), USER (일반 사용자)';
COMMENT ON FUNCTION public.set_user_role IS 'Change user role - only SUPER_ADMIN can execute this function';
