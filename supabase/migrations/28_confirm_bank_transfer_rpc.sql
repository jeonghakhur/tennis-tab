-- confirm_bank_transfer RPC
-- 부서 정원 체크 + 입금 확인을 원자적으로 처리 (race condition 방지)
-- division row를 FOR UPDATE로 잠가 동시 요청을 직렬화함

CREATE OR REPLACE FUNCTION confirm_bank_transfer(p_entry_id UUID, p_user_id UUID)
RETURNS TABLE(success BOOLEAN, entry_status TEXT, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry tournament_entries%ROWTYPE;
  v_max_teams INT;
  v_confirmed_count INT;
  v_new_status TEXT;
BEGIN
  -- 1. 신청 조회 (본인 확인)
  SELECT * INTO v_entry
  FROM tournament_entries
  WHERE id = p_entry_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::TEXT, '신청 정보를 찾을 수 없습니다.'::TEXT;
    RETURN;
  END IF;

  -- 2. 멱등성: 이미 입금 확인된 경우 현재 상태 그대로 반환
  IF v_entry.payment_status = 'COMPLETED' THEN
    RETURN QUERY SELECT TRUE, v_entry.status::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  -- 3. 부서 row를 FOR UPDATE로 잠금 → 동일 부서 동시 요청 직렬화
  SELECT max_teams INTO v_max_teams
  FROM tournament_divisions
  WHERE id = v_entry.division_id
  FOR UPDATE;

  -- 4. 잠긴 상태에서 CONFIRMED 인원 카운트 (정확한 값 보장)
  SELECT COUNT(*) INTO v_confirmed_count
  FROM tournament_entries
  WHERE division_id = v_entry.division_id AND status = 'CONFIRMED';

  -- 5. 정원 판단
  IF v_max_teams IS NULL OR v_confirmed_count < v_max_teams THEN
    v_new_status := 'CONFIRMED';
  ELSE
    v_new_status := 'WAITLISTED';
  END IF;

  -- 6. 원자적 업데이트
  UPDATE tournament_entries
  SET
    payment_status = 'COMPLETED',
    payment_confirmed_at = NOW(),
    status = v_new_status
  WHERE id = p_entry_id;

  RETURN QUERY SELECT TRUE, v_new_status, NULL::TEXT;
END;
$$;
