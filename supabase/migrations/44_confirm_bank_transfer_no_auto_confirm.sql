-- confirm_bank_transfer RPC 수정
-- 입금확인 시 자동 CONFIRMED 제거 → payment_status만 COMPLETED로 변경
-- 관리자가 자격 확인 후 직접 확정하는 구조로 변경

CREATE OR REPLACE FUNCTION confirm_bank_transfer(p_entry_id UUID, p_user_id UUID)
RETURNS TABLE(success BOOLEAN, entry_status TEXT, error_message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_entry tournament_entries%ROWTYPE;
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

  -- 3. payment_status만 COMPLETED로 변경, status는 PENDING 유지
  --    관리자가 자격 확인 후 직접 CONFIRMED 처리
  UPDATE tournament_entries
  SET
    payment_status = 'COMPLETED',
    payment_confirmed_at = NOW()
  WHERE id = p_entry_id;

  RETURN QUERY SELECT TRUE, v_entry.status::TEXT, NULL::TEXT;
END;
$$;
