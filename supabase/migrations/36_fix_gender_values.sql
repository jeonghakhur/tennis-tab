-- gender 컬럼 값 'M'/'F' → 'MALE'/'FEMALE' 마이그레이션
-- 코드(GenderType)는 'MALE'/'FEMALE'을 사용하지만 DB CHECK 제약과 기존 데이터가
-- 'M'/'F'로 저장되어 있어 UPDATE 시 CHECK constraint violation 발생

-- profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;
UPDATE profiles SET gender = 'MALE' WHERE gender = 'M';
UPDATE profiles SET gender = 'FEMALE' WHERE gender = 'F';
ALTER TABLE profiles ADD CONSTRAINT profiles_gender_check
  CHECK (gender = ANY (ARRAY['MALE'::text, 'FEMALE'::text]));

-- club_members
ALTER TABLE club_members DROP CONSTRAINT IF EXISTS club_members_gender_check;
UPDATE club_members SET gender = 'MALE' WHERE gender = 'M';
UPDATE club_members SET gender = 'FEMALE' WHERE gender = 'F';
ALTER TABLE club_members ADD CONSTRAINT club_members_gender_check
  CHECK (gender = ANY (ARRAY['MALE'::text, 'FEMALE'::text]));
