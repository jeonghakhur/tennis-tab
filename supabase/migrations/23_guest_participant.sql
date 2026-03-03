-- Migration 23: Guest Participant Support for Club Sessions
-- Adds club_session_guests table and extends club_match_results for guest players

-- ============================================================================
-- 신규 테이블: club_session_guests
-- ============================================================================
CREATE TABLE club_session_guests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES club_sessions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  gender      TEXT CHECK (gender IN ('MALE', 'FEMALE')),
  notes       TEXT,
  created_by  UUID NOT NULL REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS 활성화
ALTER TABLE club_session_guests ENABLE ROW LEVEL SECURITY;

-- SELECT: 해당 세션 클럽의 ACTIVE 멤버만 조회 가능
CREATE POLICY "club_session_guests_select" ON club_session_guests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM club_sessions cs
      JOIN club_members cm ON cm.club_id = cs.club_id
      WHERE cs.id = session_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'ACTIVE'
    )
  );

-- INSERT/DELETE: Server Action에서 admin client (service role) 사용 → RLS bypass

-- ============================================================================
-- 변경 테이블: club_match_results — 게스트 FK 컬럼 추가
-- ============================================================================
ALTER TABLE club_match_results
  ADD COLUMN player1_guest_id  UUID REFERENCES club_session_guests(id) ON DELETE SET NULL,
  ADD COLUMN player2_guest_id  UUID REFERENCES club_session_guests(id) ON DELETE SET NULL,
  ADD COLUMN player1b_guest_id UUID REFERENCES club_session_guests(id) ON DELETE SET NULL,
  ADD COLUMN player2b_guest_id UUID REFERENCES club_session_guests(id) ON DELETE SET NULL;

-- 슬롯 XOR 제약: member_id와 guest_id 동시 설정 불가
ALTER TABLE club_match_results
  ADD CONSTRAINT chk_player1_exclusive
    CHECK (NOT (player1_member_id IS NOT NULL AND player1_guest_id IS NOT NULL)),
  ADD CONSTRAINT chk_player2_exclusive
    CHECK (NOT (player2_member_id IS NOT NULL AND player2_guest_id IS NOT NULL)),
  ADD CONSTRAINT chk_player1b_exclusive
    CHECK (NOT (player1b_member_id IS NOT NULL AND player1b_guest_id IS NOT NULL)),
  ADD CONSTRAINT chk_player2b_exclusive
    CHECK (NOT (player2b_member_id IS NOT NULL AND player2b_guest_id IS NOT NULL));

-- 기존 NOT NULL 제약 완화 (player1/2는 member 또는 guest 중 하나면 충분)
ALTER TABLE club_match_results
  ALTER COLUMN player1_member_id DROP NOT NULL,
  ALTER COLUMN player2_member_id DROP NOT NULL;

-- player1/2 슬롯 필수 보장 (member 또는 guest 중 하나는 반드시 설정)
ALTER TABLE club_match_results
  ADD CONSTRAINT chk_player1_required
    CHECK (player1_member_id IS NOT NULL OR player1_guest_id IS NOT NULL),
  ADD CONSTRAINT chk_player2_required
    CHECK (player2_member_id IS NOT NULL OR player2_guest_id IS NOT NULL);
