// 커뮤니티 포스트 관련 타입

export type PostCategory = 'NOTICE' | 'FREE' | 'INFO' | 'REVIEW'

export const POST_CATEGORY_LABELS: Record<PostCategory, string> = {
  NOTICE: '공지사항',
  FREE: '자유게시판',
  INFO: '정보공유',
  REVIEW: '대회후기',
}

/** 첨부파일 메타 (JSONB 배열로 DB 저장) */
export interface PostAttachment {
  url: string
  name: string
  size: number
  type: 'image' | 'document'
}

export interface Post {
  id: string
  category: PostCategory
  title: string
  content: string
  attachments: PostAttachment[]
  author_id: string
  view_count: number
  comment_count: number
  like_count: number
  is_pinned: boolean
  is_published: boolean
  created_at: string
  updated_at: string
  // JOIN 결과
  author?: { name: string; avatar_url: string | null }
  // 현재 유저 좋아요 여부 (피드 조회 시)
  is_liked?: boolean
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
  attachments?: PostAttachment[]
}

export interface UpdatePostInput {
  title?: string
  content?: string
  category?: PostCategory
  attachments?: PostAttachment[]
  is_published?: boolean
}

export interface CreateCommentInput {
  post_id: string
  content: string
}
