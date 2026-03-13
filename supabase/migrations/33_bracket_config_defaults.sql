-- =============================================================================
-- 33: bracket_configs 기본값 변경
--     예선전 진행 ON, 3/4위전 진행 ON, 조당 팀 수 3팀 (예선 OFF 시 코드에서 2로 자동 변경)
-- =============================================================================

ALTER TABLE bracket_configs
  ALTER COLUMN has_preliminaries SET DEFAULT true,
  ALTER COLUMN third_place_match SET DEFAULT true,
  ALTER COLUMN group_size        SET DEFAULT 3;
