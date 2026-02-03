# 데이터베이스 마이그레이션 SQL #2

## ⚠️ 중요: 수동으로 실행 필요

Supabase 대시보드에서 다음 SQL을 실행해야 합니다.

## 실행 방법

1. [Supabase 대시보드](https://supabase.com/dashboard/project/tigqwrehpzwaksnvcrrx) 접속
2. 좌측 메뉴에서 **SQL Editor** 클릭
3. **New Query** 버튼 클릭
4. 아래 SQL 전체를 복사하여 붙여넣기
5. **Run** 버튼 클릭 (또는 Ctrl/Cmd + Enter)

## SQL

```sql
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
```

## 실행 후 확인

SQL 실행 후 다음 쿼리로 확인:

```sql
-- 컬럼 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 데이터 확인
SELECT id, name, skill_level, ntrp_rating
FROM public.profiles
LIMIT 5;
```

## 예상 결과

- `skill_level` 컬럼이 TEXT 타입으로 변경되어야 함
- `ntrp_rating` 컬럼이 추가되어야 함 (NUMERIC(2,1) 타입)
- 기존 데이터가 년도 형식으로 변환되어야 함

## 변경 사항 요약

### Before
- `skill_level`: ENUM ('1_YEAR', '2_YEARS', ..., '10_PLUS_YEARS')
- 구력: 연차 기반 (1년, 2년, ..., 10년 이상)

### After
- `skill_level`: TEXT (입문 년도: '2026', '2025', ..., '2016년 이전')
- `ntrp_rating`: DECIMAL(2,1) (NTRP 점수: 1.0 ~ 7.0)
- 입문 년도: 현재 년도부터 10년 전까지 선택 가능

## 롤백 방법 (필요한 경우)

혹시 문제가 발생하면 다음 SQL로 롤백할 수 있습니다:

```sql
-- NTRP 점수 필드 제거
ALTER TABLE public.profiles DROP COLUMN IF EXISTS ntrp_rating;

-- 데이터 복원 (백업이 있는 경우)
-- skill_level을 다시 ENUM으로 변경하려면 기존 스키마를 재생성해야 합니다
```

⚠️ **주의**: ENUM 타입으로 되돌리는 것은 복잡하므로, 테스트 환경에서 먼저 확인하는 것을 권장합니다.
