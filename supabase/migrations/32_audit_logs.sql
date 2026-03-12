-- ============================================================
-- 32. 감사 로그 (Audit Logs)
-- 모든 주요 테이블의 상태 변경 이력 추적
-- 관리자 + 사용자 + 시스템(크론) 변경 모두 기록
-- ============================================================

-- 1. 감사 로그 테이블
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name  TEXT NOT NULL,
  record_id   UUID NOT NULL,
  action      TEXT NOT NULL DEFAULT 'UPDATE',  -- INSERT, UPDATE, DELETE
  field_name  TEXT NOT NULL DEFAULT 'status',  -- 변경된 필드명
  old_value   TEXT,
  new_value   TEXT,
  changed_by  UUID REFERENCES auth.users(id),  -- NULL = 시스템/크론/서비스롤
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  context     JSONB                            -- 추가 메타데이터 (IP, user-agent 등)
);

-- 인덱스: 테이블+레코드 기준 조회 (특정 레코드의 변경 이력)
CREATE INDEX IF NOT EXISTS idx_audit_logs_record
  ON public.audit_logs (table_name, record_id, changed_at DESC);

-- 인덱스: 변경자 기준 조회 (특정 사용자의 변경 이력)
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_by
  ON public.audit_logs (changed_by, changed_at DESC)
  WHERE changed_by IS NOT NULL;

-- 인덱스: 시간 기준 조회 (최근 변경 이력)
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at
  ON public.audit_logs (changed_at DESC);

-- RLS 활성화 (관리자만 조회 가능)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 관리자(admin/superadmin)만 감사 로그 조회 가능
CREATE POLICY "audit_logs_admin_read" ON public.audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'superadmin')
    )
  );

-- 서비스 롤은 INSERT 가능 (트리거에서 SECURITY DEFINER로 실행)
-- 일반 사용자는 INSERT/UPDATE/DELETE 불가


-- ============================================================
-- 2. 범용 상태 변경 로깅 함수
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    field_name,
    old_value,
    new_value,
    changed_by,
    context
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    'status',
    OLD.status::TEXT,
    NEW.status::TEXT,
    auth.uid(),
    jsonb_build_object(
      'trigger', TG_NAME,
      'old_updated_at', OLD.updated_at,
      'new_updated_at', NEW.updated_at
    )
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_audit_status_change() IS
  '상태(status) 변경 시 audit_logs에 자동 기록하는 트리거 함수. changed_by=NULL이면 시스템/크론 변경.';


-- ============================================================
-- 3. 트리거 등록 — 주요 테이블
-- ============================================================

-- 3-1. tournaments (대회 상태)
CREATE TRIGGER trg_audit_tournament_status
  AFTER UPDATE OF status ON public.tournaments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();

-- 3-2. tournament_entries (참가 신청 상태: PENDING → CONFIRMED → CANCELLED 등)
CREATE TRIGGER trg_audit_entry_status
  AFTER UPDATE OF status ON public.tournament_entries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();

-- 3-3. club_sessions (클럽 모임 상태: OPEN → CLOSED → COMPLETED 등)
CREATE TRIGGER trg_audit_club_session_status
  AFTER UPDATE OF status ON public.club_sessions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();

-- 3-4. bracket_configs (대진표 상태: DRAFT → PRELIMINARY → MAIN → COMPLETED)
CREATE TRIGGER trg_audit_bracket_config_status
  AFTER UPDATE OF status ON public.bracket_configs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();

-- 3-5. bracket_matches (경기 상태: SCHEDULED → IN_PROGRESS → COMPLETED)
CREATE TRIGGER trg_audit_bracket_match_status
  AFTER UPDATE OF status ON public.bracket_matches
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.fn_audit_status_change();


-- ============================================================
-- 4. INSERT 시에도 초기 상태 기록 (선택적 — 생성 이력 추적)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_audit_status_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    field_name,
    old_value,
    new_value,
    changed_by,
    context
  ) VALUES (
    TG_TABLE_NAME,
    NEW.id,
    'INSERT',
    'status',
    NULL,
    NEW.status::TEXT,
    auth.uid(),
    jsonb_build_object('trigger', TG_NAME)
  );
  RETURN NEW;
END;
$$;

-- 대회 생성 시 초기 상태 기록
CREATE TRIGGER trg_audit_tournament_insert
  AFTER INSERT ON public.tournaments
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_status_insert();

-- 참가 신청 생성 시 초기 상태 기록
CREATE TRIGGER trg_audit_entry_insert
  AFTER INSERT ON public.tournament_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_audit_status_insert();
