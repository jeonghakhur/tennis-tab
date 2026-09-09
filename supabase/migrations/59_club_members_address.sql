-- 클럽 회원 주소 컬럼 추가 (관리자 회원관리에서 입력/표시)
ALTER TABLE public.club_members ADD COLUMN IF NOT EXISTS address TEXT;

-- 200자 제한 (clubs.address 검증 기준과 동일)
ALTER TABLE public.club_members DROP CONSTRAINT IF EXISTS club_members_address_length;
ALTER TABLE public.club_members ADD CONSTRAINT club_members_address_length
  CHECK (address IS NULL OR char_length(address) <= 200);

COMMENT ON COLUMN public.club_members.address IS '회원 주소 (선택, 최대 200자)';
