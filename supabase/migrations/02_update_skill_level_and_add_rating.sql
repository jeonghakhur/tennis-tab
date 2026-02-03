-- 프로필 테이블 업데이트: skill_level을 입문 년도로 변경, NTRP 점수 필드 추가

-- 1. skill_level 타입 변경 (TEXT로 변경하여 년도 저장)
-- 기존 ENUM 타입 제약 제거
ALTER TABLE public.profiles ALTER COLUMN skill_level TYPE TEXT;

-- 2. NTRP 점수 필드 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ntrp_rating DECIMAL(2,1) CHECK (ntrp_rating >= 1.0 AND ntrp_rating <= 7.0);

-- 3. 컬럼 코멘트 추가
COMMENT ON COLUMN public.profiles.skill_level IS '테니스 입문 년도 (예: 2024, 2023, 2016년 이전)';
COMMENT ON COLUMN public.profiles.ntrp_rating IS 'NTRP 점수 (1.0 ~ 7.0)';

-- 4. 기존 데이터 마이그레이션 (있는 경우)
-- 기존 연차 기반 값을 년도로 변환
UPDATE public.profiles
SET skill_level = CASE
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
  WHEN skill_level IN ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'PROFESSIONAL') THEN '2023' -- 기본값
  ELSE skill_level
END
WHERE skill_level IS NOT NULL;
