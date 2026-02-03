# 데이터베이스 마이그레이션 SQL

## ⚠️ 중요: 수동으로 실행 필요

Supabase CLI의 RPC 기능이 제한되어 있어, **반드시 Supabase 대시보드에서 직접 실행**해야 합니다.

## 실행 방법

1. [Supabase 대시보드](https://supabase.com/dashboard/project/tigqwrehpzwaksnvcrrx) 접속
2. 좌측 메뉴에서 **SQL Editor** 클릭
3. **New Query** 버튼 클릭
4. 아래 SQL 전체를 복사하여 붙여넣기
5. **Run** 버튼 클릭 (또는 Ctrl/Cmd + Enter)

## SQL

```sql
-- 프로필 테이블 업데이트: dominant_hand 삭제, 클럽 지역 필드 추가

-- 1. dominant_hand 컬럼 삭제
ALTER TABLE public.profiles DROP COLUMN IF EXISTS dominant_hand;

-- 2. 클럽 지역 필드 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS club_city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS club_district TEXT;

-- 3. 컬럼 코멘트 추가
COMMENT ON COLUMN public.profiles.club_city IS '클럽 소재지 - 시도 (예: 서울특별시, 경기도)';
COMMENT ON COLUMN public.profiles.club_district IS '클럽 소재지 - 시군구 (예: 강남구, 성남시)';
```

## 실행 후 확인

SQL 실행 후 다음 쿼리로 확인:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
ORDER BY ordinal_position;
```

예상 결과:
- `dominant_hand` 컬럼이 삭제되어야 함
- `club_city` 컬럼이 추가되어야 함
- `club_district` 컬럼이 추가되어야 함
