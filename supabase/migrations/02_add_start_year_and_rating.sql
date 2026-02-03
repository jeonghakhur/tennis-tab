-- 프로필 테이블 업데이트: 입문 년도 및 실력 점수 필드 추가

-- start_year 컬럼 추가 (테니스 입문 년도)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS start_year TEXT;

-- rating 컬럼 추가 (실력 점수, 정수만 가능, 1~100 범위)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating INTEGER 
CHECK (rating >= 1 AND rating <= 100);

-- 컬럼 코멘트 추가
COMMENT ON COLUMN public.profiles.start_year IS '테니스 입문 년도 (예: 2026, 2025, 2016년 이전)';
COMMENT ON COLUMN public.profiles.rating IS '실력 점수 (1 ~ 100)';
