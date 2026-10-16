-- Migration 64: 개인 접수 부서 복식 페어 편성
--   개인 접수(solo_entry) 부서의 복식 대회에서 참가자 2명을 1팀으로 묶는다.
--   - 대표(A) 행: partner_data 에 파트너(B)의 이름·클럽·점수 복사 → 기존 복식 표시 로직 재사용
--   - 파트너(B) 행: paired_into_entry_id = A.id → 조편성 풀에서 제외
--   partner_user_id 는 사용하지 않음 (대리 등록으로 user_id 가 본인이 아닐 수 있음)

ALTER TABLE public.tournament_entries
  ADD COLUMN IF NOT EXISTS paired_into_entry_id UUID NULL
    REFERENCES public.tournament_entries(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.tournament_entries.paired_into_entry_id
  IS '개인 접수 복식 페어: 이 엔트리가 파트너로 합쳐진 대표 엔트리 id (NULL = 미편성 또는 대표)';

CREATE INDEX IF NOT EXISTS idx_tournament_entries_paired_into
  ON public.tournament_entries (paired_into_entry_id)
  WHERE paired_into_entry_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 공통 검증: 부서 잠금 + 개인 접수 복식 + 조편성 전 상태 확인
--   조건 위반 시 RAISE EXCEPTION → 호출 트랜잭션 전체 롤백
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_solo_pairing_editable(p_division_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_division public.tournament_divisions%ROWTYPE;
  v_match_type TEXT;
  v_tournament_status TEXT;
  v_config_status TEXT;
  v_group_count INT;
BEGIN
  -- 부서 행 잠금: 동시 편성/해제 요청 직렬화
  SELECT * INTO v_division
  FROM public.tournament_divisions
  WHERE id = p_division_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '부서를 찾을 수 없습니다.';
  END IF;

  IF v_division.solo_entry IS NOT TRUE THEN
    RAISE EXCEPTION '개인 접수 부서에서만 페어 편성을 사용할 수 있습니다.';
  END IF;

  SELECT match_type::TEXT, status::TEXT
    INTO v_match_type, v_tournament_status
  FROM public.tournaments
  WHERE id = v_division.tournament_id;

  IF v_match_type IS DISTINCT FROM 'INDIVIDUAL_DOUBLES' THEN
    RAISE EXCEPTION '복식 대회에서만 페어 편성을 사용할 수 있습니다.';
  END IF;

  IF v_tournament_status IN ('COMPLETED', 'CANCELLED') THEN
    RAISE EXCEPTION '마감된 대회는 페어를 변경할 수 없습니다.';
  END IF;

  -- 조편성이 생성된 뒤에는 변경 불가 (group_teams 가 엔트리 id 를 참조)
  SELECT bc.status::TEXT,
         (SELECT COUNT(*) FROM public.preliminary_groups pg WHERE pg.bracket_config_id = bc.id)
    INTO v_config_status, v_group_count
  FROM public.bracket_configs bc
  WHERE bc.division_id = p_division_id;

  IF v_config_status IS NOT NULL
     AND (v_config_status <> 'DRAFT' OR COALESCE(v_group_count, 0) > 0) THEN
    RAISE EXCEPTION '조편성이 생성된 후에는 페어를 변경할 수 없습니다. 조편성을 삭제한 뒤 수정하세요.';
  END IF;
END;
$$;

-- ----------------------------------------------------------------------------
-- 페어 일괄 편성
--   p_pairs: [{"captain_id": "...", "partner_id": "..."}, ...]
--   반환: 편성된 쌍 수. 하나라도 조건 위반이면 전체 롤백.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pair_solo_entries_batch(p_division_id UUID, p_pairs JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pair JSONB;
  v_captain_id UUID;
  v_partner_id UUID;
  v_captain public.tournament_entries%ROWTYPE;
  v_partner public.tournament_entries%ROWTYPE;
  v_count INT := 0;
BEGIN
  IF p_pairs IS NULL OR jsonb_typeof(p_pairs) <> 'array' OR jsonb_array_length(p_pairs) = 0 THEN
    RAISE EXCEPTION '편성할 페어가 없습니다.';
  END IF;

  PERFORM public.assert_solo_pairing_editable(p_division_id);

  FOR v_pair IN SELECT * FROM jsonb_array_elements(p_pairs) LOOP
    v_captain_id := (v_pair->>'captain_id')::UUID;
    v_partner_id := (v_pair->>'partner_id')::UUID;

    IF v_captain_id IS NULL OR v_partner_id IS NULL THEN
      RAISE EXCEPTION '페어 정보가 올바르지 않습니다.';
    END IF;

    IF v_captain_id = v_partner_id THEN
      RAISE EXCEPTION '같은 참가자를 페어로 묶을 수 없습니다.';
    END IF;

    -- 두 엔트리 잠금 (id 순으로 잠가 데드락 방지)
    IF v_captain_id < v_partner_id THEN
      SELECT * INTO v_captain FROM public.tournament_entries WHERE id = v_captain_id FOR UPDATE;
      SELECT * INTO v_partner FROM public.tournament_entries WHERE id = v_partner_id FOR UPDATE;
    ELSE
      SELECT * INTO v_partner FROM public.tournament_entries WHERE id = v_partner_id FOR UPDATE;
      SELECT * INTO v_captain FROM public.tournament_entries WHERE id = v_captain_id FOR UPDATE;
    END IF;

    IF v_captain.id IS NULL OR v_partner.id IS NULL THEN
      RAISE EXCEPTION '참가 신청을 찾을 수 없습니다.';
    END IF;

    IF v_captain.division_id <> p_division_id OR v_partner.division_id <> p_division_id THEN
      RAISE EXCEPTION '다른 부서의 참가자는 페어로 묶을 수 없습니다.';
    END IF;

    IF v_captain.status <> 'CONFIRMED' OR v_partner.status <> 'CONFIRMED' THEN
      RAISE EXCEPTION '승인(CONFIRMED)된 참가자만 페어로 묶을 수 있습니다. (%, %)',
        v_captain.player_name, v_partner.player_name;
    END IF;

    IF v_captain.partner_data IS NOT NULL OR v_captain.paired_into_entry_id IS NOT NULL
       OR v_partner.partner_data IS NOT NULL OR v_partner.paired_into_entry_id IS NOT NULL THEN
      RAISE EXCEPTION '이미 페어가 편성된 참가자입니다. (%, %)',
        v_captain.player_name, v_partner.player_name;
    END IF;

    -- 대표 행: 파트너 정보 복사 (club/rating 미입력은 빈값/0 — PartnerData 타입 호환)
    UPDATE public.tournament_entries
    SET partner_data = jsonb_build_object(
          'name', v_partner.player_name,
          'club', COALESCE(v_partner.club_name, ''),
          'rating', COALESCE(v_partner.player_rating, 0)
        ),
        updated_at = NOW()
    WHERE id = v_captain.id;

    -- 파트너 행: 대표 엔트리 참조
    UPDATE public.tournament_entries
    SET paired_into_entry_id = v_captain.id,
        updated_at = NOW()
    WHERE id = v_partner.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- ----------------------------------------------------------------------------
-- 페어 해제
--   p_captain_ids: 해제할 대표 엔트리 id 배열. NULL 이면 부서 전체 해제.
--   반환: 해제된 쌍 수
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.unpair_solo_entries(p_division_id UUID, p_captain_ids UUID[] DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INT := 0;
BEGIN
  PERFORM public.assert_solo_pairing_editable(p_division_id);

  -- 파트너 행 참조 해제
  WITH released AS (
    UPDATE public.tournament_entries
    SET paired_into_entry_id = NULL,
        updated_at = NOW()
    WHERE division_id = p_division_id
      AND paired_into_entry_id IS NOT NULL
      AND (p_captain_ids IS NULL OR paired_into_entry_id = ANY(p_captain_ids))
    RETURNING paired_into_entry_id
  )
  SELECT COUNT(*) INTO v_count FROM released;

  -- 대표 행 partner_data 제거
  UPDATE public.tournament_entries
  SET partner_data = NULL,
      updated_at = NOW()
  WHERE division_id = p_division_id
    AND partner_data IS NOT NULL
    AND (p_captain_ids IS NULL OR id = ANY(p_captain_ids));

  RETURN v_count;
END;
$$;

-- 서비스 롤(Server Action)만 호출 가능
REVOKE ALL ON FUNCTION public.assert_solo_pairing_editable(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pair_solo_entries_batch(UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unpair_solo_entries(UUID, UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_solo_pairing_editable(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.pair_solo_entries_batch(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.unpair_solo_entries(UUID, UUID[]) TO service_role;
