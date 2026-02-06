-- =============================================================================
-- 단체전 팀당 경기 수 필드 추가
-- =============================================================================

BEGIN;

-- tournaments 테이블에 team_match_count 필드 추가
ALTER TABLE tournaments 
ADD COLUMN IF NOT EXISTS team_match_count INTEGER;

-- 컬럼 설명 추가
COMMENT ON COLUMN tournaments.team_match_count IS '단체전 진행 시 팀별 경기 수 (예: 3복식의 경우 3)';

COMMIT;
