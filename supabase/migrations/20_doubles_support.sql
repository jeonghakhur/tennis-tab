-- 복식 지원: club_match_results에 컬럼 추가
ALTER TABLE club_match_results
  ADD COLUMN IF NOT EXISTS match_type TEXT DEFAULT 'singles' CHECK (match_type IN ('singles', 'doubles_men', 'doubles_women', 'doubles_mixed')),
  ADD COLUMN IF NOT EXISTS player1b_member_id UUID REFERENCES club_members(id),
  ADD COLUMN IF NOT EXISTS player2b_member_id UUID REFERENCES club_members(id);

CREATE INDEX IF NOT EXISTS idx_club_match_results_player1b ON club_match_results(player1b_member_id) WHERE player1b_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_club_match_results_player2b ON club_match_results(player2b_member_id) WHERE player2b_member_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_club_match_results_match_type ON club_match_results(match_type);
