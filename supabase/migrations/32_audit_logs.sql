-- 1. 감사 로그 테이블
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  action      TEXT NOT NULL DEFAULT 'UPDATE',
  field_name  TEXT NOT NULL DEFAULT 'status',
  old_value   TEXT,
  new_value   TEXT,
  changed_by  UUID REFERENCES auth.users(id),
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context     JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_record
  ON public.audit_logs (table_name, record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by
  ON public.audit_logs (changed_by, changed_at DESC)
  WHERE changed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at
  ON public.audit_logs (changed_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN', 'SUPER_ADMIN')
    )
  );

-- 2. 상태 변경 로깅 함수
CREATE OR REPLACE FUNCTION public.fn_audit_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    table_name, record_id, action, field_name,
    old_value, new_value, changed_by, context
  ) VALUES (
    TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), TG_OP, 'status',
    OLD.status::TEXT, NEW.status::TEXT, auth.uid(),
    jsonb_build_object('trigger', TG_NAME, 'old_updated_at', OLD.updated_at, 'new_updated_at', NEW.updated_at)
  );
  RETURN NEW;
END;
$$;

-- 3. 트리거: 상태 변경
CREATE TRIGGER trg_audit_tournament_status
  AFTER UPDATE OF status ON public.tournaments
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();

CREATE TRIGGER trg_audit_entry_status
  AFTER UPDATE OF status ON public.tournament_entries
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();

CREATE TRIGGER trg_audit_club_session_status
  AFTER UPDATE OF status ON public.club_sessions
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();

CREATE TRIGGER trg_audit_bracket_config_status
  AFTER UPDATE OF status ON public.bracket_configs
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();

CREATE TRIGGER trg_audit_bracket_match_status
  AFTER UPDATE OF status ON public.bracket_matches
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();

-- 4. INSERT 트리거
CREATE OR REPLACE FUNCTION public.fn_audit_status_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    table_name, record_id, action, field_name,
    old_value, new_value, changed_by, context
  ) VALUES (
    TG_TABLE_NAME, NEW.id, 'INSERT', 'status',
    NULL, NEW.status::TEXT, auth.uid(),
    jsonb_build_object('trigger', TG_NAME)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_audit_tournament_insert
  AFTER INSERT ON public.tournaments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_status_insert();

CREATE TRIGGER trg_audit_entry_insert
  AFTER INSERT ON public.tournament_entries
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_status_insert();
