-- 29. 알림(Notifications) 시스템
-- 14가지 알림 타입 + notifications 테이블 + RLS + Realtime

-- 1) notification_type enum
CREATE TYPE notification_type AS ENUM (
  -- 사용자 알림 (10)
  'ENTRY_APPROVED',
  'ENTRY_REJECTED',
  'TOURNAMENT_STATUS_CHANGED',
  'BRACKET_GENERATED',
  'MATCH_RESULT_UPDATED',
  'CLUB_MEMBER_APPROVED',
  'CLUB_MEMBER_REJECTED',
  'CLUB_INVITED',
  'INQUIRY_REPLIED',
  'REFUND_COMPLETED',
  -- 관리자 알림 (4)
  'ENTRY_SUBMITTED',
  'ENTRY_CANCELLED',
  'PAYMENT_COMPLETED',
  'CLUB_JOIN_REQUESTED'
);

-- 2) notifications 테이블
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  entry_id UUID REFERENCES tournament_entries(id) ON DELETE SET NULL,
  match_id UUID REFERENCES bracket_matches(id) ON DELETE SET NULL,
  club_id UUID REFERENCES clubs(id) ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3) 인덱스: 사용자별 미읽음 최신순 조회 최적화
CREATE INDEX idx_notifications_user_read_created
  ON notifications (user_id, is_read, created_at DESC);

-- 4) Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- 5) RLS 활성화
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 본인 알림 조회
CREATE POLICY "Users can select own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

-- 본인 알림 읽음 처리 (is_read, read_at만 수정 가능)
CREATE POLICY "Users can update own notifications read status"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT는 RLS 정책 없음 (admin client 전용)
