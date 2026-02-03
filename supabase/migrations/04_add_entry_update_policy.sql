-- tournament_entries 테이블에 UPDATE 정책 추가
-- 사용자가 자신의 신청 내용을 수정할 수 있도록 허용

CREATE POLICY "Users can update their own entries" ON tournament_entries
  FOR UPDATE USING (auth.uid() = user_id);

-- 주최자가 신청 상태를 변경할 수 있도록 정책 추가
CREATE POLICY "Organizers can update entries for their tournaments" ON tournament_entries
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM tournaments
      WHERE id = tournament_entries.tournament_id 
      AND organizer_id = auth.uid()
    )
  );
