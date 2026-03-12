-- =============================================================================
-- tournament_entries 테이블 Realtime 활성화
-- 참가 신청 상태/결제 상태 변경 시 어드민/프론트 실시간 반영
-- =============================================================================

-- Realtime Publication에 tournament_entries 추가
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tournament_entries;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE 이벤트에서 전체 row 데이터를 전송하도록 설정
ALTER TABLE tournament_entries REPLICA IDENTITY FULL;
