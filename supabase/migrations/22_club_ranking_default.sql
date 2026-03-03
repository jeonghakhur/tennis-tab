-- 22. 클럽 순위 기본 조회 기간 설정
ALTER TABLE clubs
  ADD COLUMN IF NOT EXISTS default_ranking_period TEXT DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS default_ranking_from   TEXT,   -- YYYY-MM-DD
  ADD COLUMN IF NOT EXISTS default_ranking_to     TEXT;   -- YYYY-MM-DD
