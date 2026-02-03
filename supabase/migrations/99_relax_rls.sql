-- Tournaments 테이블 RLS 완화 (개발용)
DROP POLICY IF EXISTS "Admins can create tournaments" ON tournaments;
CREATE POLICY "Authenticated users can create tournaments" ON tournaments
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Tournament Divisions 테이블 RLS 완화 (개발용)
DROP POLICY IF EXISTS "Admins can create tournament divisions" ON tournament_divisions;
CREATE POLICY "Authenticated users can create tournament divisions" ON tournament_divisions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      WHERE t.id = tournament_id AND t.organizer_id = auth.uid()
    )
  );
