-- 1. posts 테이블에 like_count 컬럼 추가
ALTER TABLE posts ADD COLUMN IF NOT EXISTS like_count INTEGER DEFAULT 0 NOT NULL;

-- 2. post_likes 테이블 생성
CREATE TABLE IF NOT EXISTS post_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);

-- 4. RLS 활성화
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

-- 5. RLS 정책: 누구나 조회 가능
CREATE POLICY "post_likes_select" ON post_likes
  FOR SELECT USING (true);

-- 6. RLS 정책: 로그인 유저만 자신의 좋아요 삽입
CREATE POLICY "post_likes_insert" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 7. RLS 정책: 자신의 좋아요만 삭제
CREATE POLICY "post_likes_delete" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);
