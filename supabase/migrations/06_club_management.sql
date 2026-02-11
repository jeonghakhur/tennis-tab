-- ============================================================================
-- 06. 협회/클럽 관리 시스템
-- ============================================================================

-- 테니스 협회 테이블
CREATE TABLE IF NOT EXISTS associations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  region TEXT,
  district TEXT,
  description TEXT,
  president_name TEXT,
  president_phone TEXT,
  president_email TEXT,
  secretary_name TEXT,
  secretary_phone TEXT,
  secretary_email TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(created_by)  -- ADMIN 1인당 1협회 제한
);

-- 협회 매니저 테이블
CREATE TABLE IF NOT EXISTS association_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id UUID NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID NOT NULL REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(association_id, user_id)
);

-- ENUM 타입 생성
DO $$ BEGIN
  CREATE TYPE club_join_type AS ENUM ('OPEN', 'APPROVAL', 'INVITE_ONLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE club_member_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE club_member_status AS ENUM ('PENDING', 'INVITED', 'ACTIVE', 'LEFT', 'REMOVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM ('MALE', 'FEMALE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 클럽 테이블
CREATE TABLE IF NOT EXISTS clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  representative_name TEXT,
  description TEXT,
  city TEXT,
  district TEXT,
  address TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  join_type club_join_type NOT NULL DEFAULT 'APPROVAL',
  association_id UUID REFERENCES associations(id),
  max_members INT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 클럽 회원 테이블
CREATE TABLE IF NOT EXISTS club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  is_registered BOOLEAN NOT NULL DEFAULT false,

  name TEXT NOT NULL,
  birth_date TEXT,
  gender gender_type,
  phone TEXT,
  start_year TEXT,
  rating NUMERIC,

  role club_member_role NOT NULL DEFAULT 'MEMBER',
  status club_member_status NOT NULL DEFAULT 'ACTIVE',
  status_reason TEXT,
  invited_by UUID REFERENCES profiles(id),
  joined_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(club_id, user_id)
);

-- ============================================================================
-- 인덱스
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_associations_created_by ON associations(created_by);
CREATE INDEX IF NOT EXISTS idx_association_managers_association_id ON association_managers(association_id);
CREATE INDEX IF NOT EXISTS idx_association_managers_user_id ON association_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_clubs_city_district ON clubs(city, district);
CREATE INDEX IF NOT EXISTS idx_clubs_created_by ON clubs(created_by);
CREATE INDEX IF NOT EXISTS idx_clubs_association_id ON clubs(association_id);
CREATE INDEX IF NOT EXISTS idx_club_members_club_id ON club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user_id ON club_members(user_id);
CREATE INDEX IF NOT EXISTS idx_club_members_status ON club_members(status);

-- ============================================================================
-- RLS 정책
-- ============================================================================

ALTER TABLE associations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "associations_select" ON associations FOR SELECT USING (true);
CREATE POLICY "associations_insert" ON associations FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "associations_update" ON associations FOR UPDATE
  USING (auth.uid() = created_by);
CREATE POLICY "associations_delete" ON associations FOR DELETE
  USING (auth.uid() = created_by);

ALTER TABLE association_managers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "association_managers_select" ON association_managers FOR SELECT
  USING (true);
CREATE POLICY "association_managers_insert" ON association_managers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM associations
      WHERE id = association_id AND created_by = auth.uid()
    )
  );
CREATE POLICY "association_managers_delete" ON association_managers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM associations
      WHERE id = association_id AND created_by = auth.uid()
    )
  );

ALTER TABLE clubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clubs_select" ON clubs FOR SELECT USING (true);
CREATE POLICY "clubs_insert" ON clubs FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "clubs_update" ON clubs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_members
      WHERE club_id = clubs.id
        AND user_id = auth.uid()
        AND role IN ('OWNER', 'ADMIN')
        AND status = 'ACTIVE'
    )
  );

ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "club_members_select" ON club_members FOR SELECT
  USING (true);

-- ============================================================================
-- 기존 gender 데이터 마이그레이션 (M→MALE, F→FEMALE)
-- club_members.gender 컬럼이 TEXT인 경우 ENUM 값으로 변환
-- ============================================================================

UPDATE club_members SET gender = 'MALE' WHERE gender::text = 'M';
UPDATE club_members SET gender = 'FEMALE' WHERE gender::text = 'F';
