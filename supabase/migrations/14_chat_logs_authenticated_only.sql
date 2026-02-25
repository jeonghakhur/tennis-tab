-- =============================================================================
-- chat_logs: 비인증 INSERT 차단 → authenticated 전용
-- =============================================================================

DROP POLICY IF EXISTS "Anyone can insert chat logs" ON public.chat_logs;
CREATE POLICY "Authenticated users can insert chat logs" ON public.chat_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
