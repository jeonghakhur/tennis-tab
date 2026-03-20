-- 코치 테이블에 레슨 장소 필드 추가
ALTER TABLE coaches ADD COLUMN IF NOT EXISTS lesson_location TEXT;
