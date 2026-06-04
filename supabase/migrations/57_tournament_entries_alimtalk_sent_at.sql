-- 대회 참가 확정 알림톡 발송 시각 기록
ALTER TABLE tournament_entries
  ADD COLUMN IF NOT EXISTS confirm_alimtalk_sent_at TIMESTAMPTZ;
