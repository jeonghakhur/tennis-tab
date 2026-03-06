-- cancel_flow_sessions: 채팅 참가 취소 플로우 세션 (DB 기반, 서버리스 인스턴스 공유)
CREATE TABLE IF NOT EXISTS public.cancel_flow_sessions (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_data JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS: Service Role만 접근 (Server Action에서 admin client 사용)
ALTER TABLE public.cancel_flow_sessions ENABLE ROW LEVEL SECURITY;

-- TTL 인덱스: updated_at 기준 만료 쿼리 최적화
CREATE INDEX IF NOT EXISTS idx_cancel_flow_sessions_updated_at
  ON public.cancel_flow_sessions (updated_at);

COMMENT ON TABLE public.cancel_flow_sessions IS
  '채팅 참가 취소 플로우 세션. TTL 10분, updated_at > now()-10min 쿼리로 soft-expire.';
