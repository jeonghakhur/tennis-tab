# Design: 커뮤니티 포스트 & 1:1 문의

> Plan: `docs/01-plan/features/community-and-inquiry.plan.md`

---

## 1. DB 마이그레이션

### 파일: Supabase Migration (MCP apply_migration으로 적용)

```sql
-- ============================================================================
-- 1. posts (커뮤니티 포스트)
-- ============================================================================
CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('NOTICE', 'FREE', 'INFO', 'REVIEW')),
  title text NOT NULL CHECK (char_length(title) <= 100),
  content text NOT NULL CHECK (char_length(content) <= 5000),
  author_id uuid NOT NULL REFERENCES profiles(id),
  view_count integer NOT NULL DEFAULT 0,
  comment_count integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE posts IS '커뮤니티 포스트';

-- 목록 조회 성능: 카테고리 필터 + 최신순 정렬
CREATE INDEX idx_posts_category_created ON posts(category, created_at DESC);
-- 작성자별 조회
CREATE INDEX idx_posts_author ON posts(author_id);

-- RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- SELECT: 전체 허용
CREATE POLICY "posts_select_all" ON posts
  FOR SELECT USING (true);

-- INSERT: 로그인 사용자 (카테고리별 권한은 Server Action에서 검증)
CREATE POLICY "posts_insert_auth" ON posts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 본인 작성 글
CREATE POLICY "posts_update_own" ON posts
  FOR UPDATE USING (auth.uid() = author_id);

-- DELETE: 본인 작성 글
CREATE POLICY "posts_delete_own" ON posts
  FOR DELETE USING (auth.uid() = author_id);

-- ============================================================================
-- 2. post_comments (댓글)
-- ============================================================================
CREATE TABLE post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL CHECK (char_length(content) <= 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE post_comments IS '포스트 댓글';

-- 포스트별 댓글 조회
CREATE INDEX idx_post_comments_post ON post_comments(post_id, created_at ASC);

-- RLS
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_all" ON post_comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert_auth" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "comments_update_own" ON post_comments
  FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "comments_delete_own" ON post_comments
  FOR DELETE USING (auth.uid() = author_id);

-- ============================================================================
-- 3. inquiries (1:1 문의)
-- ============================================================================
CREATE TABLE inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('SERVICE', 'TOURNAMENT', 'ACCOUNT', 'ETC')),
  title text NOT NULL CHECK (char_length(title) <= 100),
  content text NOT NULL CHECK (char_length(content) <= 3000),
  author_id uuid NOT NULL REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED')),
  reply_content text,
  reply_by uuid REFERENCES profiles(id),
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE inquiries IS '1:1 문의';

-- 작성자별 내 문의 조회
CREATE INDEX idx_inquiries_author ON inquiries(author_id, created_at DESC);
-- 관리자용 상태별 조회
CREATE INDEX idx_inquiries_status ON inquiries(status, created_at DESC);

-- RLS
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

-- SELECT: 본인 문의만
CREATE POLICY "inquiries_select_own" ON inquiries
  FOR SELECT USING (auth.uid() = author_id);

-- INSERT: 로그인 사용자
CREATE POLICY "inquiries_insert_auth" ON inquiries
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE/DELETE: 없음 (Admin은 Service Role Key로 우회)
```

> **참고**: ADMIN+ 사용자의 포스트/댓글 삭제, 문의 전체 조회/답변은 기존 패턴대로 `createAdminClient()` (Service Role Key)로 RLS 우회.

---

## 2. 타입 정의

### 파일: `src/lib/community/types.ts` (신규)

```typescript
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
```

### 파일: `src/lib/support/types.ts` (신규)

```typescript
// 1:1 문의 관련 타입

export type InquiryCategory = 'SERVICE' | 'TOURNAMENT' | 'ACCOUNT' | 'ETC'
export type InquiryStatus = 'PENDING' | 'IN_PROGRESS' | 'RESOLVED'

export const INQUIRY_CATEGORY_LABELS: Record<InquiryCategory, string> = {
  SERVICE: '서비스 이용',
  TOURNAMENT: '대회 관련',
  ACCOUNT: '계정/인증',
  ETC: '기타',
}

export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  PENDING: '대기중',
  IN_PROGRESS: '처리중',
  RESOLVED: '완료',
}

export interface Inquiry {
  id: string
  category: InquiryCategory
  title: string
  content: string
  author_id: string
  status: InquiryStatus
  reply_content: string | null
  reply_by: string | null
  replied_at: string | null
  created_at: string
  updated_at: string
  // JOIN 결과
  author?: { name: string; email: string }
  replier?: { name: string }
}

export interface CreateInquiryInput {
  category: InquiryCategory
  title: string
  content: string
}

export interface ReplyInquiryInput {
  inquiry_id: string
  reply_content: string
}
```

---

## 3. 입력 검증

### 파일: `src/lib/utils/validation.ts` (추가)

```typescript
// ============================================================================
// 포스트 검증
// ============================================================================

export interface PostValidationErrors {
  category?: string
  title?: string
  content?: string
}

const VALID_POST_CATEGORIES = ['NOTICE', 'FREE', 'INFO', 'REVIEW']

export function validatePostInput(data: {
  category?: string
  title?: string
  content?: string
}): PostValidationErrors {
  const errors: PostValidationErrors = {}

  if (!data.category || !VALID_POST_CATEGORIES.includes(data.category)) {
    errors.category = '카테고리를 선택해주세요.'
  }
  if (!data.title || data.title.trim().length === 0) {
    errors.title = '제목을 입력해주세요.'
  } else if (data.title.trim().length > 100) {
    errors.title = '제목은 100자 이내로 입력해주세요.'
  }
  if (!data.content || data.content.trim().length === 0) {
    errors.content = '내용을 입력해주세요.'
  } else if (data.content.trim().length > 5000) {
    errors.content = '내용은 5000자 이내로 입력해주세요.'
  }

  return errors
}

// ============================================================================
// 댓글 검증
// ============================================================================

export interface CommentValidationErrors {
  content?: string
}

export function validateCommentInput(data: {
  content?: string
}): CommentValidationErrors {
  const errors: CommentValidationErrors = {}

  if (!data.content || data.content.trim().length === 0) {
    errors.content = '댓글 내용을 입력해주세요.'
  } else if (data.content.trim().length > 1000) {
    errors.content = '댓글은 1000자 이내로 입력해주세요.'
  }

  return errors
}

// ============================================================================
// 문의 검증
// ============================================================================

export interface InquiryValidationErrors {
  category?: string
  title?: string
  content?: string
}

const VALID_INQUIRY_CATEGORIES = ['SERVICE', 'TOURNAMENT', 'ACCOUNT', 'ETC']

export function validateInquiryInput(data: {
  category?: string
  title?: string
  content?: string
}): InquiryValidationErrors {
  const errors: InquiryValidationErrors = {}

  if (!data.category || !VALID_INQUIRY_CATEGORIES.includes(data.category)) {
    errors.category = '문의 유형을 선택해주세요.'
  }
  if (!data.title || data.title.trim().length === 0) {
    errors.title = '제목을 입력해주세요.'
  } else if (data.title.trim().length > 100) {
    errors.title = '제목은 100자 이내로 입력해주세요.'
  }
  if (!data.content || data.content.trim().length === 0) {
    errors.content = '내용을 입력해주세요.'
  } else if (data.content.trim().length > 3000) {
    errors.content = '내용은 3000자 이내로 입력해주세요.'
  }

  return errors
}
```

---

## 4. Server Actions

### 4.1 파일: `src/lib/community/actions.ts` (신규)

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import {
  sanitizeObject,
  validatePostInput,
  validateCommentInput,
  hasValidationErrors,
} from '@/lib/utils/validation'
import type {
  Post,
  PostComment,
  PostCategory,
  CreatePostInput,
  UpdatePostInput,
  CreateCommentInput,
} from './types'

// ============================================================================
// 검증 헬퍼
// ============================================================================

function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

/** 카테고리별 작성 권한 검증 */
function canWriteCategory(category: PostCategory, userRole: string): boolean {
  if (category === 'NOTICE') {
    return hasMinimumRole(userRole as UserRole, 'ADMIN')
  }
  return hasMinimumRole(userRole as UserRole, 'MANAGER')
}

// ============================================================================
// 포스트 CRUD
// ============================================================================

/** 포스트 목록 조회 (카테고리 필터, 페이지네이션) */
export async function getPosts(options?: {
  category?: PostCategory
  page?: number
  limit?: number
  search?: string
}): Promise<{ data: Post[]; total: number; error?: string }> {
  const admin = createAdminClient()
  const page = options?.page ?? 1
  const limit = options?.limit ?? 20
  const offset = (page - 1) * limit

  let query = admin
    .from('posts')
    .select('*, author:profiles!author_id(name, avatar_url)', { count: 'exact' })

  if (options?.category) {
    query = query.eq('category', options.category)
  }
  if (options?.search) {
    query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%`)
  }

  // 고정 글 먼저, 그 다음 최신순
  const { data, count, error } = await query
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return { data: [], total: 0, error: error.message }
  return { data: (data ?? []) as Post[], total: count ?? 0 }
}

/** 포스트 상세 조회 + 조회수 증가 */
export async function getPost(id: string): Promise<{ data: Post | null; error?: string }> {
  const idErr = validateId(id, '포스트 ID')
  if (idErr) return { data: null, error: idErr }

  const admin = createAdminClient()

  // 조회수 증가
  await admin.rpc('increment_view_count', { post_id: id }).catch(() => {
    // rpc 없으면 직접 업데이트 (fallback)
  })

  // 직접 업데이트 (rpc 대신)
  await admin
    .from('posts')
    .update({ view_count: admin.rpc ? undefined : 0 }) // rpc 사용 시 skip
    .eq('id', id)

  const { data, error } = await admin
    .from('posts')
    .select('*, author:profiles!author_id(name, avatar_url)')
    .eq('id', id)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Post }
}

/** 포스트 작성 (MANAGER+, 공지사항은 ADMIN+) */
export async function createPost(
  input: CreatePostInput
): Promise<{ data: Post | null; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: '로그인이 필요합니다.' }

  // 카테고리별 권한 검증
  if (input.category === 'NOTICE') {
    if (!hasMinimumRole(user.role, 'ADMIN')) {
      return { data: null, error: '공지사항은 관리자만 작성할 수 있습니다.' }
    }
  } else {
    if (!hasMinimumRole(user.role, 'MANAGER')) {
      return { data: null, error: '운영자 이상 권한이 필요합니다.' }
    }
  }

  // 입력 검증
  const sanitized = sanitizeObject(input)
  const errors = validatePostInput(sanitized)
  if (hasValidationErrors(errors)) {
    const firstError = Object.values(errors).find(Boolean)
    return { data: null, error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('posts')
    .insert({
      category: sanitized.category,
      title: sanitized.title.trim(),
      content: sanitized.content.trim(),
      author_id: user.id,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/community')
  return { data: data as Post }
}

/** 포스트 수정 (본인 글 또는 ADMIN+) */
export async function updatePost(
  id: string,
  input: UpdatePostInput
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const idErr = validateId(id, '포스트 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  // 본인 글 확인 (ADMIN+는 통과)
  if (!hasMinimumRole(user.role, 'ADMIN')) {
    const { data: post } = await admin
      .from('posts')
      .select('author_id')
      .eq('id', id)
      .single()

    if (!post || post.author_id !== user.id) {
      return { error: '수정 권한이 없습니다.' }
    }
  }

  const sanitized = sanitizeObject(input)
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (sanitized.title) updateData.title = sanitized.title.trim()
  if (sanitized.content) updateData.content = sanitized.content.trim()
  if (sanitized.category) updateData.category = sanitized.category

  const { error } = await admin.from('posts').update(updateData).eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/community')
  revalidatePath(`/community/${id}`)
  return {}
}

/** 포스트 삭제 (본인 글 또는 ADMIN+) */
export async function deletePost(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const idErr = validateId(id, '포스트 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  // 본인 글 확인 (ADMIN+는 통과)
  if (!hasMinimumRole(user.role, 'ADMIN')) {
    const { data: post } = await admin
      .from('posts')
      .select('author_id')
      .eq('id', id)
      .single()

    if (!post || post.author_id !== user.id) {
      return { error: '삭제 권한이 없습니다.' }
    }
  }

  const { error } = await admin.from('posts').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/community')
  return {}
}

/** 포스트 고정/해제 (ADMIN+) */
export async function togglePinPost(
  id: string,
  isPinned: boolean
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }
  if (!hasMinimumRole(user.role, 'ADMIN')) {
    return { error: '관리자 권한이 필요합니다.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('posts')
    .update({ is_pinned: isPinned, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/community')
  return {}
}

// ============================================================================
// 댓글 CRUD
// ============================================================================

/** 댓글 목록 조회 (포스트별) */
export async function getComments(
  postId: string
): Promise<{ data: PostComment[]; error?: string }> {
  const idErr = validateId(postId, '포스트 ID')
  if (idErr) return { data: [], error: idErr }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('post_comments')
    .select('*, author:profiles!author_id(name, avatar_url)')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as PostComment[] }
}

/** 댓글 작성 (로그인 사용자) */
export async function createComment(
  input: CreateCommentInput
): Promise<{ data: PostComment | null; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: '로그인이 필요합니다.' }

  const sanitized = sanitizeObject(input)
  const errors = validateCommentInput({ content: sanitized.content })
  if (hasValidationErrors(errors)) {
    const firstError = Object.values(errors).find(Boolean)
    return { data: null, error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()

  // 댓글 삽입
  const { data, error } = await admin
    .from('post_comments')
    .insert({
      post_id: sanitized.post_id,
      author_id: user.id,
      content: sanitized.content.trim(),
    })
    .select('*, author:profiles!author_id(name, avatar_url)')
    .single()

  if (error) return { data: null, error: error.message }

  // comment_count 증가
  await admin.rpc('increment_comment_count', { target_post_id: sanitized.post_id }).catch(async () => {
    // fallback: 직접 카운트 업데이트
    const { count } = await admin
      .from('post_comments')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', sanitized.post_id)

    await admin
      .from('posts')
      .update({ comment_count: count ?? 0 })
      .eq('id', sanitized.post_id)
  })

  revalidatePath(`/community/${sanitized.post_id}`)
  return { data: data as PostComment }
}

/** 댓글 삭제 (본인 또는 ADMIN+) */
export async function deleteComment(
  commentId: string,
  postId: string
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 본인 댓글 확인 (ADMIN+는 통과)
  if (!hasMinimumRole(user.role, 'ADMIN')) {
    const { data: comment } = await admin
      .from('post_comments')
      .select('author_id')
      .eq('id', commentId)
      .single()

    if (!comment || comment.author_id !== user.id) {
      return { error: '삭제 권한이 없습니다.' }
    }
  }

  const { error } = await admin.from('post_comments').delete().eq('id', commentId)
  if (error) return { error: error.message }

  // comment_count 감소 (직접 카운트)
  const { count } = await admin
    .from('post_comments')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)

  await admin
    .from('posts')
    .update({ comment_count: count ?? 0 })
    .eq('id', postId)

  revalidatePath(`/community/${postId}`)
  return {}
}
```

### 4.2 파일: `src/lib/support/actions.ts` (신규)

```typescript
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import {
  sanitizeObject,
  validateInquiryInput,
  hasValidationErrors,
} from '@/lib/utils/validation'
import type {
  Inquiry,
  CreateInquiryInput,
  ReplyInquiryInput,
  InquiryStatus,
} from './types'

function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

// ============================================================================
// 사용자용 (로그인 회원)
// ============================================================================

/** 1:1 문의 작성 */
export async function createInquiry(
  input: CreateInquiryInput
): Promise<{ data: Inquiry | null; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: '로그인이 필요합니다.' }

  const sanitized = sanitizeObject(input)
  const errors = validateInquiryInput(sanitized)
  if (hasValidationErrors(errors)) {
    const firstError = Object.values(errors).find(Boolean)
    return { data: null, error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('inquiries')
    .insert({
      category: sanitized.category,
      title: sanitized.title.trim(),
      content: sanitized.content.trim(),
      author_id: user.id,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }

  revalidatePath('/support/inquiry/history')
  return { data: data as Inquiry }
}

/** 내 문의 목록 조회 */
export async function getMyInquiries(): Promise<{ data: Inquiry[]; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { data: [], error: '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('inquiries')
    .select('*')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as Inquiry[] }
}

/** 내 문의 상세 조회 */
export async function getMyInquiry(
  id: string
): Promise<{ data: Inquiry | null; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: '로그인이 필요합니다.' }

  const idErr = validateId(id, '문의 ID')
  if (idErr) return { data: null, error: idErr }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('inquiries')
    .select('*, replier:profiles!reply_by(name)')
    .eq('id', id)
    .eq('author_id', user.id)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Inquiry }
}

// ============================================================================
// 관리자용 (ADMIN+)
// ============================================================================

/** 전체 문의 목록 (ADMIN+) */
export async function getAllInquiries(options?: {
  status?: InquiryStatus
}): Promise<{ data: Inquiry[]; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { data: [], error: '로그인이 필요합니다.' }
  if (!hasMinimumRole(user.role, 'ADMIN')) {
    return { data: [], error: '관리자 권한이 필요합니다.' }
  }

  const admin = createAdminClient()
  let query = admin
    .from('inquiries')
    .select('*, author:profiles!author_id(name, email)')
    .order('created_at', { ascending: false })

  if (options?.status) {
    query = query.eq('status', options.status)
  }

  const { data, error } = await query

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as Inquiry[] }
}

/** 문의 상세 조회 (ADMIN+) */
export async function getInquiryForAdmin(
  id: string
): Promise<{ data: Inquiry | null; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: '로그인이 필요합니다.' }
  if (!hasMinimumRole(user.role, 'ADMIN')) {
    return { data: null, error: '관리자 권한이 필요합니다.' }
  }

  const idErr = validateId(id, '문의 ID')
  if (idErr) return { data: null, error: idErr }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('inquiries')
    .select('*, author:profiles!author_id(name, email), replier:profiles!reply_by(name)')
    .eq('id', id)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Inquiry }
}

/** 문의 답변 작성 (ADMIN+) */
export async function replyInquiry(
  input: ReplyInquiryInput
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }
  if (!hasMinimumRole(user.role, 'ADMIN')) {
    return { error: '관리자 권한이 필요합니다.' }
  }

  const idErr = validateId(input.inquiry_id, '문의 ID')
  if (idErr) return { error: idErr }

  if (!input.reply_content || input.reply_content.trim().length === 0) {
    return { error: '답변 내용을 입력해주세요.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('inquiries')
    .update({
      reply_content: sanitizeObject({ t: input.reply_content.trim() }).t,
      reply_by: user.id,
      replied_at: new Date().toISOString(),
      status: 'RESOLVED',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.inquiry_id)

  if (error) return { error: error.message }

  revalidatePath('/admin/inquiries')
  revalidatePath(`/admin/inquiries/${input.inquiry_id}`)
  return {}
}

/** 문의 상태 변경 (ADMIN+) */
export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }
  if (!hasMinimumRole(user.role, 'ADMIN')) {
    return { error: '관리자 권한이 필요합니다.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('inquiries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/inquiries')
  return {}
}
```

---

## 5. 페이지 컴포넌트 구조

### 5.1 커뮤니티 (`/community`)

```
src/app/community/
├── page.tsx                    # 포스트 목록 (카테고리 탭 + 검색 + 페이지네이션)
├── [id]/
│   ├── page.tsx                # 포스트 상세 + 댓글 목록 + 댓글 작성
│   └── edit/
│       └── page.tsx            # 포스트 수정 (작성자만)
└── new/
    └── page.tsx                # 포스트 작성 (MANAGER+)

src/components/community/
├── PostList.tsx                # 포스트 목록 컴포넌트
├── PostCard.tsx                # 포스트 카드 (목록 아이템)
├── PostForm.tsx                # 포스트 작성/수정 폼 (공용)
└── CommentSection.tsx          # 댓글 영역 (목록 + 작성 폼)
```

### 5.2 고객센터 (`/support`)

```
src/app/support/
├── page.tsx                    # 고객센터 메인 (FAQ + 문의하기 링크)
└── inquiry/
    ├── page.tsx                # 1:1 문의 작성 폼
    ├── history/
    │   └── page.tsx            # 내 문의 내역 목록
    └── [id]/
        └── page.tsx            # 문의 상세 + 답변 확인

src/components/support/
├── InquiryForm.tsx             # 문의 작성 폼
└── InquiryCard.tsx             # 문의 카드 (목록 아이템)
```

### 5.3 관리자 문의 관리 (`/admin/inquiries`)

```
src/app/admin/inquiries/
├── page.tsx                    # 문의 목록 (상태 필터)
└── [id]/
    └── page.tsx                # 문의 상세 + 답변 작성
```

---

## 6. 주요 UI 설계

### 6.1 커뮤니티 목록 페이지 (`/community/page.tsx`)

- **Navigation** 포함 (기존 패턴)
- 상단: 헤더 ("커뮤니티") + 글쓰기 버튼 (MANAGER+ 조건부 표시)
- 카테고리 탭: 전체 | 공지사항 | 자유게시판 | 정보공유 | 대회후기
- 검색: 제목+내용 검색 (디바운스 300ms)
- 포스트 목록: PostCard 반복 (고정 글은 상단 + 핀 아이콘)
- 페이지네이션: 하단 페이지 번호
- 빈 상태: "아직 작성된 글이 없습니다"

### 6.2 포스트 상세 페이지 (`/community/[id]/page.tsx`)

- 상단: 카테고리 Badge + 제목 + 작성자 + 작성일 + 조회수
- 본문: `whitespace-pre-wrap`으로 줄바꿈 보존
- 작성자 액션: 수정/삭제 버튼 (본인 또는 ADMIN+)
- 하단: CommentSection (댓글 목록 + 댓글 작성 폼)

### 6.3 PostForm (작성/수정 공용)

- 카테고리 `<select>` (공지사항은 ADMIN+만 선택 가능)
- 제목 `<input>` (maxLength 100)
- 내용 `<textarea>` (maxLength 5000, 글자수 카운터)
- DEV 더미 데이터 버튼 (개발 환경)
- 순차 검증 + AlertDialog 패턴 (CLAUDE.md 규칙)

### 6.4 고객센터 메인 (`/support/page.tsx`)

- 간단한 안내 페이지
- 1:1 문의하기 버튼 → `/support/inquiry`
- 내 문의 내역 보기 → `/support/inquiry/history` (로그인 시)

### 6.5 관리자 문의 목록 (`/admin/inquiries/page.tsx`)

- 상태 필터 탭: 전체 | 대기중 | 처리중 | 완료
- 문의 카드: 제목 + 작성자 + 상태 Badge + 작성일
- 클릭 → 상세 + 답변 작성 페이지

---

## 7. Navigation/Footer 변경

### 7.1 `src/components/Navigation.tsx`

**변경**: 커뮤니티 링크 href

```tsx
// 현재
<Link href="/#community" className="nav-link text-sm tracking-wide">
  커뮤니티
</Link>

// 변경
<Link href="/community" className="nav-link text-sm tracking-wide">
  커뮤니티
</Link>
```

### 7.2 `src/components/Footer.tsx`

**변경**: 서비스 섹션 커뮤니티, 지원 섹션 링크

```tsx
// 커뮤니티: /posts → /community
<Link href="/community" className="footer-link text-sm">커뮤니티</Link>

// 고객센터: /help → /support
<Link href="/support" className="footer-link text-sm">고객센터</Link>

// 문의하기: /contact → /support/inquiry
<Link href="/support/inquiry" className="footer-link text-sm">문의하기</Link>
```

### 7.3 `src/components/admin/AdminSidebar.tsx`

**추가**: 문의 관리 메뉴 아이템

```typescript
import { MessageSquare } from 'lucide-react'

// menuItems 배열에 추가 (클럽 관리 뒤에)
{
  name: '문의 관리',
  href: '/admin/inquiries',
  icon: MessageSquare,
  roles: ['SUPER_ADMIN', 'ADMIN'] as UserRole[],
},
```

---

## 8. 조회수 증가 전략

RPC 함수 대신 단순 업데이트로 구현 (MVP 단계):

```typescript
// getPost 내부에서 조회수 증가
export async function getPost(id: string) {
  const admin = createAdminClient()

  // 조회수 1 증가 (race condition 가능하지만 MVP에서는 허용)
  const { data: current } = await admin
    .from('posts')
    .select('view_count')
    .eq('id', id)
    .single()

  if (current) {
    await admin
      .from('posts')
      .update({ view_count: current.view_count + 1 })
      .eq('id', id)
  }

  // 포스트 상세 조회
  const { data, error } = await admin
    .from('posts')
    .select('*, author:profiles!author_id(name, avatar_url)')
    .eq('id', id)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as Post }
}
```

> 향후 개선: Supabase RPC `increment_view_count` 또는 Redis 기반 중복 방지.

---

## 9. 수정 파일 목록 (구현 순서)

| 순서 | 파일 | 유형 | 내용 |
|------|------|------|------|
| 1 | Supabase Migration | 신규 | posts, post_comments, inquiries + 인덱스 + RLS |
| 2 | `src/lib/community/types.ts` | 신규 | Post, PostComment, 카테고리 타입 |
| 3 | `src/lib/support/types.ts` | 신규 | Inquiry, 카테고리/상태 타입 |
| 4 | `src/lib/utils/validation.ts` | 수정 | validatePostInput, validateCommentInput, validateInquiryInput 추가 |
| 5 | `src/lib/community/actions.ts` | 신규 | 포스트 CRUD + 댓글 CRUD Server Actions |
| 6 | `src/lib/support/actions.ts` | 신규 | 문의 CRUD + 답변 Server Actions |
| 7 | `src/components/community/PostCard.tsx` | 신규 | 포스트 카드 컴포넌트 |
| 8 | `src/components/community/PostForm.tsx` | 신규 | 포스트 작성/수정 폼 |
| 9 | `src/components/community/CommentSection.tsx` | 신규 | 댓글 영역 |
| 10 | `src/app/community/page.tsx` | 신규 | 커뮤니티 목록 페이지 |
| 11 | `src/app/community/[id]/page.tsx` | 신규 | 포스트 상세 페이지 |
| 12 | `src/app/community/new/page.tsx` | 신규 | 포스트 작성 페이지 |
| 13 | `src/app/community/[id]/edit/page.tsx` | 신규 | 포스트 수정 페이지 |
| 14 | `src/components/support/InquiryForm.tsx` | 신규 | 문의 작성 폼 |
| 15 | `src/components/support/InquiryCard.tsx` | 신규 | 문의 카드 컴포넌트 |
| 16 | `src/app/support/page.tsx` | 신규 | 고객센터 메인 |
| 17 | `src/app/support/inquiry/page.tsx` | 신규 | 문의 작성 페이지 |
| 18 | `src/app/support/inquiry/history/page.tsx` | 신규 | 내 문의 내역 |
| 19 | `src/app/support/inquiry/[id]/page.tsx` | 신규 | 문의 상세 |
| 20 | `src/app/admin/inquiries/page.tsx` | 신규 | 관리자 문의 목록 |
| 21 | `src/app/admin/inquiries/[id]/page.tsx` | 신규 | 관리자 문의 답변 |
| 22 | `src/components/Navigation.tsx` | 수정 | 커뮤니티 링크 변경 |
| 23 | `src/components/Footer.tsx` | 수정 | 커뮤니티/고객센터 링크 변경 |
| 24 | `src/components/admin/AdminSidebar.tsx` | 수정 | 문의 관리 메뉴 추가 |

---

## 10. 검증 체크리스트

### 커뮤니티 포스트
- [ ] 마이그레이션 적용 후 posts, post_comments 테이블 존재 확인
- [ ] 비회원 — 포스트 목록/상세 조회 가능
- [ ] USER — 글쓰기 버튼 미표시, 댓글 작성 가능
- [ ] MANAGER — 자유게시판/정보공유/대회후기 글쓰기 가능, 공지사항 불가
- [ ] ADMIN — 공지사항 포함 모든 카테고리 글쓰기 + 타인 글 삭제 가능
- [ ] 본인 포스트 수정/삭제 정상 동작
- [ ] 카테고리 필터, 검색, 페이지네이션 정상 동작
- [ ] 고정 글이 상단에 표시
- [ ] 댓글 작성/삭제 시 comment_count 동기화
- [ ] XSS 입력 → sanitize 처리

### 1:1 문의
- [ ] 로그인 회원 — 문의 작성 가능
- [ ] 내 문의 내역에서 상태 확인 가능
- [ ] 관리자 — 전체 문의 목록 조회, 상태 필터
- [ ] 관리자 답변 작성 → 상태 RESOLVED 자동 변경
- [ ] 비회원/USER — /admin/inquiries 접근 차단

### 공통
- [ ] Navigation 커뮤니티 링크 → `/community` 이동
- [ ] Footer 링크 정상 연결
- [ ] AdminSidebar 문의 관리 메뉴 표시 (ADMIN+)
- [ ] 모바일 반응형 정상
- [ ] `tsc --noEmit` 통과
