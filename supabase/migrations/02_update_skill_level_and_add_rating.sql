-- 프로필 테이블 업데이트: skill_level을 start_year로 변경, NTRP 점수 필드 추가

-- 1. start_year 컬럼 추가 (입문 년도)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS start_year TEXT;

-- 2. 기존 skill_level 데이터를 start_year로 복사 및 변환
UPDATE public.profiles
SET start_year = CASE
  WHEN skill_level = '1_YEAR' THEN '2025'
  WHEN skill_level = '2_YEARS' THEN '2024'
  WHEN skill_level = '3_YEARS' THEN '2023'
  WHEN skill_level = '4_YEARS' THEN '2022'
  WHEN skill_level = '5_YEARS' THEN '2021'
  WHEN skill_level = '6_YEARS' THEN '2020'
  WHEN skill_level = '7_YEARS' THEN '2019'
  WHEN skill_level = '8_YEARS' THEN '2018'
  WHEN skill_level = '9_YEARS' THEN '2017'
  WHEN skill_level = '10_PLUS_YEARS' THEN '2016년 이전'
  WHEN skill_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL') THEN '2023'
  ELSE skill_level
END
WHERE skill_level IS NOT NULL;

-- 3. skill_level 컬럼 삭제 (더 이상 사용하지 않음)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS skill_level;

-- 4. NTRP 점수 필드 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ntrp_rating DECIMAL(2,1) CHECK (ntrp_rating >= 1.0 AND ntrp_rating <= 7.0);

-- 5. 컬럼 코멘트 추가
COMMENT ON COLUMN public.profiles.start_year IS '테니스 입문 년도 (예: 2026, 2025, 2016년 이전)';
COMMENT ON COLUMN public.profiles.ntrp_rating IS 'NTRP 점수 (1.0 ~ 7.0)';
