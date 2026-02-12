-- 클럽 가입 신청 자기소개 컬럼 추가
ALTER TABLE club_members ADD COLUMN introduction TEXT;

-- 500자 제한
ALTER TABLE club_members ADD CONSTRAINT club_members_introduction_length
  CHECK (introduction IS NULL OR char_length(introduction) <= 500);
