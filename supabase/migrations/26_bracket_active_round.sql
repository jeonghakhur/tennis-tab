-- =============================================================================
-- bracket_configs에 경기 진행 라운드 관리 컬럼 추가
-- 부서별·페이즈별·라운드별 점수 입력 활성화 제어
-- =============================================================================

-- active_phase: 현재 진행 중인 페이즈 (NULL = 비활성)
-- active_round: 현재 진행 중인 라운드 번호 (NULL = 해당 페이즈 전체)
ALTER TABLE bracket_configs
  ADD COLUMN IF NOT EXISTS active_phase TEXT NULL,
  ADD COLUMN IF NOT EXISTS active_round INT NULL;

-- Realtime Publication에 bracket_configs 추가 (active_phase/active_round 변경 실시간 전파)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE bracket_configs;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE bracket_configs REPLICA IDENTITY FULL;
