-- clubs 테이블에 is_recruiting 컬럼 추가
-- 클럽 관리자가 모집 중일 때만 공개 목록에서 가입 문의 버튼 활성화
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS is_recruiting boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN clubs.is_recruiting IS '회원 모집 중 여부 — true일 때만 공개 목록에서 가입 문의 버튼 표시';
