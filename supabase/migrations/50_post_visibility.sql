-- 커뮤니티 글 공개/비공개 설정
-- 기존 글은 DEFAULT true로 자동 공개 유지

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN posts.is_published IS '공개 여부. false = 작성자 + ADMIN+ 만 조회 가능';
