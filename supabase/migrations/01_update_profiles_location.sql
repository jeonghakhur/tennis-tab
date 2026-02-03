-- 프로필 테이블 업데이트: dominant_hand 삭제, 클럽 지역 필드 추가
-- dominant_hand 컬럼 삭제
ALTER TABLE public.profiles DROP COLUMN IF EXISTS dominant_hand;

-- 클럽 지역 필드 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS club_city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS club_district TEXT;

-- 컬럼 코멘트 추가
COMMENT ON COLUMN public.profiles.club_city IS '클럽 소재지 - 시도 (예: 서울특별시, 경기도)';
COMMENT ON COLUMN public.profiles.club_district IS '클럽 소재지 - 시군구 (예: 강남구, 성남시)';
