// 커뮤니티 포스트 관련 타입

export type PostCategory = 'NOTICE' | 'FREE' | 'INFO' | 'REVIEW'

export const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
  NOTICE: '공지사항',
  FREE: '자유게시판',
  INFO: '정보공유',
  REVIEW: '대회후기',
}

export interface Post {
  id: string
  category: PostCategory
  title: string
  content: string
  author_id: string
  view_count: number
  comment_count: number
  is_pinned: boolean
  created_at: string
  updated_at: string
  // JOIN 결과
  author?: { name: string; avatar_url: string | null }
}

export interface PostComment {
  id: string
  post_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  // JOIN 결과
  author?: { name: string; avatar_url: string | null }
}

export interface CreatePostInput {
  category: PostCategory
  title: string
  content: string
}

export interface UpdatePostInput {
  title?: string
  content?: string
  category?: PostCategory
}

export interface CreateCommentInput {
  post_id: string
  content: string
}
