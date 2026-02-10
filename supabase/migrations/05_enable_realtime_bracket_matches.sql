-- =============================================================================
-- bracket_matches 테이블 Realtime 활성화
-- 점수 입력/수정 시 모든 클라이언트에 실시간 반영
-- =============================================================================

-- Realtime Publication에 bracket_matches 추가
-- (이미 추가되어 있으면 에러 무시)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE bracket_matches;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- UPDATE 이벤트에서 전체 row 데이터를 전송하도록 설정
-- (기본값 DEFAULT는 PK만 전송하므로 점수 등 변경된 필드가 누락됨)
ALTER TABLE bracket_matches REPLICA IDENTITY FULL;
