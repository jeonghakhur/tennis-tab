-- 조당 팀 수 설정 (2팀 또는 3팀, 기본 3)
ALTER TABLE bracket_configs ADD COLUMN IF NOT EXISTS group_size INTEGER DEFAULT 3 CHECK (group_size IN (2, 3));
