-- tournament_divisions에 정렬 순서와 개인 접수 옵션 추가
-- display_order: 작은 값일수록 먼저 노출 (NULL/0은 뒤로 배치)
-- solo_entry: 개인전 복식(INDIVIDUAL_DOUBLES) 대회에서 파트너 없이 본인만 신청 가능한 부서 표시

ALTER TABLE tournament_divisions
  ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS solo_entry BOOLEAN NOT NULL DEFAULT false;

-- 부서 목록 조회 시 정렬 인덱스
CREATE INDEX IF NOT EXISTS idx_tournament_divisions_display_order
  ON tournament_divisions(tournament_id, display_order);

COMMENT ON COLUMN tournament_divisions.display_order IS '부서 표시 순서 — 작은 값일수록 먼저 노출, 0/null은 뒤로, 동률은 이름순';
COMMENT ON COLUMN tournament_divisions.solo_entry IS '개인 접수 부서 — INDIVIDUAL_DOUBLES 대회에서 파트너 없이 본인만 신청 가능';
