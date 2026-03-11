-- 클럽 모임 댓글 기능

-- 1. club_session_comments 테이블
CREATE TABLE IF NOT EXISTS club_session_comments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  created_at  TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. 인덱스
CREATE INDEX IF NOT EXISTS idx_club_session_comments_session_id ON club_session_comments(session_id);
CREATE INDEX IF NOT EXISTS idx_club_session_comments_author_id  ON club_session_comments(author_id);

-- 3. updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_club_session_comments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_club_session_comments_updated_at
  BEFORE UPDATE ON club_session_comments
  FOR EACH ROW EXECUTE FUNCTION update_club_session_comments_updated_at();

-- 4. RLS 활성화
ALTER TABLE club_session_comments ENABLE ROW LEVEL SECURITY;

-- 5. SELECT: 해당 세션이 속한 클럽의 ACTIVE 멤버만 조회 가능
CREATE POLICY "session_comments_select" ON club_session_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = club_session_comments.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
    )
  );

-- 6. INSERT: ACTIVE 클럽 멤버만 댓글 작성 가능
CREATE POLICY "session_comments_insert" ON club_session_comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = club_session_comments.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
    )
  );

-- 7. DELETE: 본인 댓글 또는 해당 클럽 임원(OWNER/ADMIN/MATCH_DIRECTOR)
CREATE POLICY "session_comments_delete" ON club_session_comments
  FOR DELETE USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = club_session_comments.session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
        AND cm.role IN ('OWNER', 'ADMIN', 'MATCH_DIRECTOR')
    )
  );
