-- =============================================================================
-- 17: UPCOMING 상태 추가 + 날짜 기반 자동 전환 함수
-- =============================================================================

-- 1. ENUM에 UPCOMING 추가 (DRAFT 다음)
ALTER TYPE tournament_status ADD VALUE IF NOT EXISTS 'UPCOMING' AFTER 'DRAFT';

-- 2. 자동 전환 함수
--    entry_start_date IS NULL → skip (수동 관리)
--    DRAFT, CANCELLED → skip
CREATE OR REPLACE FUNCTION public.auto_transition_tournament_status()
RETURNS TABLE(
  id         UUID,
  title      TEXT,
  old_status tournament_status,
  new_status tournament_status
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT
      t.id,
      t.title,
      t.status AS old_status,
      CASE
        WHEN now_ts < t.entry_start_date                                         THEN 'UPCOMING'::tournament_status
        WHEN now_ts >= t.entry_start_date AND now_ts <= t.entry_end_date         THEN 'OPEN'::tournament_status
        WHEN now_ts > t.entry_end_date   AND now_ts < t.start_date               THEN 'CLOSED'::tournament_status
        WHEN now_ts >= t.start_date      AND now_ts <= t.end_date                THEN 'IN_PROGRESS'::tournament_status
        WHEN now_ts > t.end_date                                                 THEN 'COMPLETED'::tournament_status
      END AS new_status
    FROM public.tournaments t
    WHERE
      t.entry_start_date IS NOT NULL
      AND t.entry_end_date IS NOT NULL
      AND t.status NOT IN ('DRAFT', 'CANCELLED')
  ),
  updated AS (
    UPDATE public.tournaments t
    SET
      status     = c.new_status,
      updated_at = NOW()
    FROM candidates c
    WHERE
      t.id = c.id
      AND c.new_status IS NOT NULL
      AND t.status <> c.new_status   -- 이미 올바른 상태면 UPDATE 생략
    RETURNING t.id, t.title, c.old_status, c.new_status
  )
  SELECT u.id, u.title, u.old_status, u.new_status FROM updated u;
END;
$$;

-- 3. 인덱스: 자동 전환 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_tournaments_auto_transition
  ON public.tournaments (status, entry_start_date)
  WHERE entry_start_date IS NOT NULL;

-- 4. 초기 실행: 마이그레이션 직후 기존 대회 상태 동기화
SELECT auto_transition_tournament_status();

COMMENT ON FUNCTION public.auto_transition_tournament_status() IS
  '날짜 기반 대회 상태 자동 전환 (Vercel Cron: /api/cron/tournament-status, 매시간).
   entry_start_date/entry_end_date IS NULL이면 수동 관리. DRAFT/CANCELLED 제외.';
