-- Migration 63: tournaments 공개 범위(visibility) 컬럼 추가
--   PUBLIC   : 메인·대회 목록·사이트맵·챗봇 검색 모두 노출 (기본값)
--   UNLISTED : 목록에서 제외, 링크로 직접 접근·신청 가능
--   HIDDEN   : 관리자(MANAGER 이상)만 조회 가능, 일반 사용자는 404

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'PUBLIC'
    CHECK (visibility IN ('PUBLIC', 'UNLISTED', 'HIDDEN'));

COMMENT ON COLUMN public.tournaments.visibility
  IS '공개 범위: PUBLIC(전체 노출) / UNLISTED(링크로만 접근) / HIDDEN(관리자 전용)';

-- 목록 조회는 항상 visibility 필터를 타므로 부분 인덱스로 공개 대회만 커버
CREATE INDEX IF NOT EXISTS idx_tournaments_visibility_public
  ON public.tournaments (start_date DESC)
  WHERE visibility = 'PUBLIC';
