-- match_type check constraint에 'doubles' 값 추가
ALTER TABLE club_match_results
  DROP CONSTRAINT club_match_results_match_type_check;

ALTER TABLE club_match_results
  ADD CONSTRAINT club_match_results_match_type_check
  CHECK (match_type = ANY (ARRAY['singles'::text, 'doubles'::text, 'doubles_men'::text, 'doubles_women'::text, 'doubles_mixed'::text]));
