-- 회원 탈퇴 시 FK 위반 방지
-- club_sessions.created_by, club_match_results.dispute_resolved_by|reported_by 를
-- NOT NULL + RESTRICT → nullable + ON DELETE SET NULL 으로 변경

-- club_sessions.created_by
ALTER TABLE club_sessions ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE club_sessions
  DROP CONSTRAINT IF EXISTS club_sessions_created_by_fkey;
ALTER TABLE club_sessions
  ADD CONSTRAINT club_sessions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- club_match_results.dispute_resolved_by (이미 nullable, ON DELETE 추가)
ALTER TABLE club_match_results
  DROP CONSTRAINT IF EXISTS club_match_results_dispute_resolved_by_fkey;
ALTER TABLE club_match_results
  ADD CONSTRAINT club_match_results_dispute_resolved_by_fkey
  FOREIGN KEY (dispute_resolved_by) REFERENCES profiles(id) ON DELETE SET NULL;

-- club_match_results.reported_by (이미 nullable, ON DELETE 추가)
ALTER TABLE club_match_results
  DROP CONSTRAINT IF EXISTS club_match_results_reported_by_fkey;
ALTER TABLE club_match_results
  ADD CONSTRAINT club_match_results_reported_by_fkey
  FOREIGN KEY (reported_by) REFERENCES profiles(id) ON DELETE SET NULL;
