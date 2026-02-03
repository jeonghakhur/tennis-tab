-- tournament_entries 테이블 확장
-- 참가 신청 시 필요한 상세 정보 저장

-- 결제 상태 enum 추가
CREATE TYPE payment_status AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- tournament_entries 테이블에 컬럼 추가
ALTER TABLE tournament_entries
  -- 참가 부서 (어떤 부서에 신청했는지)
  ADD COLUMN division_id UUID REFERENCES tournament_divisions(id) ON DELETE CASCADE,
  
  -- 참가자 기본 정보 (프로필에서 복사)
  ADD COLUMN phone TEXT NOT NULL DEFAULT '',
  ADD COLUMN player_name TEXT NOT NULL DEFAULT '',
  ADD COLUMN player_rating INTEGER,
  
  -- 단체전용 필드
  ADD COLUMN club_name TEXT,
  ADD COLUMN team_order TEXT, -- '가', '나', '다' 등
  
  -- 파트너 정보 (개인전 복식용, JSONB)
  -- {name: string, club: string, rating: number}
  ADD COLUMN partner_data JSONB,
  
  -- 팀원 정보 (단체전용, JSONB 배열)
  -- [{name: string, rating: number}, ...]
  ADD COLUMN team_members JSONB,
  
  -- 결제 정보
  ADD COLUMN payment_status payment_status DEFAULT 'PENDING',
  ADD COLUMN payment_confirmed_at TIMESTAMPTZ;

-- division_id에 인덱스 추가
CREATE INDEX idx_tournament_entries_division ON tournament_entries(division_id);

-- payment_status에 인덱스 추가
CREATE INDEX idx_tournament_entries_payment ON tournament_entries(payment_status);

-- division_id를 NOT NULL로 변경하기 전에 기존 데이터 업데이트
-- (기존 데이터가 있다면 첫 번째 division으로 설정)
UPDATE tournament_entries e
SET division_id = (
  SELECT d.id 
  FROM tournament_divisions d 
  WHERE d.tournament_id = e.tournament_id 
  ORDER BY d.created_at 
  LIMIT 1
)
WHERE division_id IS NULL;

-- 이제 division_id를 NOT NULL로 변경
ALTER TABLE tournament_entries
  ALTER COLUMN division_id SET NOT NULL;

-- 참가 신청 시 division_id 체크하는 제약조건 추가
ALTER TABLE tournament_entries
  ADD CONSTRAINT check_division_belongs_to_tournament
  CHECK (
    EXISTS (
      SELECT 1 FROM tournament_divisions td
      WHERE td.id = division_id 
      AND td.tournament_id = tournament_id
    )
  );

-- UNIQUE 제약조건 수정 (tournament_id + user_id + division_id)
-- 같은 사용자가 같은 대회의 다른 부서에는 신청 가능하도록
ALTER TABLE tournament_entries
  DROP CONSTRAINT tournament_entries_tournament_id_user_id_key;

ALTER TABLE tournament_entries
  ADD CONSTRAINT tournament_entries_unique_entry
  UNIQUE(tournament_id, user_id, division_id);

-- 코멘트 추가
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
