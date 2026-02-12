-- club_members 테이블에 Realtime 활성화
-- UPDATE 시 전체 row를 전송해야 old/new 비교 가능
ALTER TABLE public.club_members REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.club_members;
