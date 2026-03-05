-- =============================================================================
-- tournaments 테이블 Realtime 활성화
-- 관리자가 tournament.status(IN_PROGRESS 등)를 변경하면 참가자 화면에 실시간 반영
-- =============================================================================

-- Realtime Publication에 tournaments 추가
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tournaments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE 이벤트에서 전체 row 데이터를 전송
ALTER TABLE tournaments REPLICA IDENTITY FULL;
