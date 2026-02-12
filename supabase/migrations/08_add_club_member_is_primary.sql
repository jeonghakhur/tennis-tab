-- 다중 클럽 소속 + 대표 클럽 지정 기능
-- club_members.is_primary 컬럼 추가 + partial unique index

-- 1. is_primary 컬럼 추가 (기본값 false)
ALTER TABLE public.club_members
  ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- 2. 동일 user_id에 대해 is_primary = true는 1개만 허용 (partial unique index)
CREATE UNIQUE INDEX idx_club_members_user_primary
  ON public.club_members (user_id)
  WHERE is_primary = true AND status = 'ACTIVE';

-- 3. 기존 ACTIVE 멤버십 중 가장 먼저 가입한 것을 대표 클럽으로 설정
UPDATE public.club_members cm
SET is_primary = true
FROM (
  SELECT DISTINCT ON (user_id) id
  FROM public.club_members
  WHERE status = 'ACTIVE' AND user_id IS NOT NULL
  ORDER BY user_id, joined_at ASC NULLS LAST, created_at ASC
) first_club
WHERE cm.id = first_club.id;
