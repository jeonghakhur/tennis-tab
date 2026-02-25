-- =============================================================================
-- 보안 어드바이저 경고 수정
-- 1. Function search_path 고정 (schema injection 방어)
-- 2. RLS 과잉 허용 정책 → MANAGER+ 제한
-- =============================================================================

-- =============================================================================
-- 1. Function search_path 수정
-- =============================================================================

-- update_updated_at_column: TRIGGER 함수 — search_path 고정
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- set_user_role: SECURITY DEFINER — search_path 고정 (테이블은 이미 public. 접두어 사용)
CREATE OR REPLACE FUNCTION public.set_user_role(user_id UUID, new_role public.user_role)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_role public.user_role;
BEGIN
  SELECT role INTO current_user_role
  FROM public.profiles
  WHERE id = auth.uid();

  IF current_user_role = 'SUPER_ADMIN' THEN
    UPDATE public.profiles
    SET role = new_role, updated_at = NOW()
    WHERE id = user_id;
  ELSE
    RAISE EXCEPTION 'Only SUPER_ADMIN can change user roles';
  END IF;
END;
$$;

-- get_waitlist_number: SQL STABLE — search_path 고정
CREATE OR REPLACE FUNCTION public.get_waitlist_number(p_entry_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT CASE
    WHEN me.status <> 'WAITLISTED' THEN NULL
    ELSE (
      SELECT COUNT(*)::INT + 1
      FROM public.tournament_entries others
      WHERE others.tournament_id = me.tournament_id
        AND others.division_id = me.division_id
        AND others.status = 'WAITLISTED'
        AND others.created_at < me.created_at
    )
  END
  FROM public.tournament_entries me
  WHERE me.id = p_entry_id;
$$;

-- =============================================================================
-- 2. bracket_configs RLS 정책 교체 (MANAGER+ 제한)
-- 모든 쓰기는 Server Action → Admin Client 경유 (RLS 우회)
-- 직접 클라이언트 접근 시에만 RLS가 적용됨
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can create bracket configs" ON public.bracket_configs;
CREATE POLICY "Managers can create bracket configs" ON public.bracket_configs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can update bracket configs" ON public.bracket_configs;
CREATE POLICY "Managers can update bracket configs" ON public.bracket_configs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can delete bracket configs" ON public.bracket_configs;
CREATE POLICY "Managers can delete bracket configs" ON public.bracket_configs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- =============================================================================
-- 3. bracket_matches RLS 정책 교체 (MANAGER+ 제한)
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can manage bracket matches" ON public.bracket_matches;
CREATE POLICY "Managers can manage bracket matches" ON public.bracket_matches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- =============================================================================
-- 4. preliminary_groups RLS 정책 교체 (MANAGER+ 제한)
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can manage preliminary groups" ON public.preliminary_groups;
CREATE POLICY "Managers can manage preliminary groups" ON public.preliminary_groups
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- =============================================================================
-- 5. group_teams RLS 정책 교체 (MANAGER+ 제한)
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users can manage group teams" ON public.group_teams;
CREATE POLICY "Managers can manage group teams" ON public.group_teams
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('MANAGER', 'ADMIN', 'SUPER_ADMIN')
    )
  );

-- =============================================================================
-- 참고: chat_logs INSERT USING (true) 는 의도된 설계
-- AI 챗봇은 비인증 사용자도 이용 가능 → 변경하지 않음
--
-- 참고: Leaked Password Protection은 코드가 아닌 Supabase 대시보드에서 활성화
-- Authentication > Settings > Password protection > Enable leaked password protection
-- =============================================================================
