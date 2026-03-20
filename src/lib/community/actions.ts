'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import {
  sanitizeInput,
  sanitizeObject,
  validatePostInput,
  validateCommentInput,
  hasValidationErrors,
} from '@/lib/utils/validation'
import type { UserRole } from '@/lib/supabase/types'
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

  // 조회수 증가 + 포스트 상세 조회 + 현재 유저 병렬 처리
  const [{ data: current }, { data, error }, currentUser] = await Promise.all([
    admin.from('posts').select('view_count').eq('id', id).single(),
    admin.from('posts').select('*, author:profiles!author_id(name, avatar_url)').eq('id', id).single(),
    getCurrentUser().catch(() => null),
  ])

  if (error || !data) return { data: null, error: '게시글을 찾을 수 없습니다.' }

  const post = data as Post

  // 비공개 글: 작성자 본인 또는 ADMIN+만 조회 가능
  if (!post.is_published) {
    const isAdmin = currentUser ? hasMinimumRole(currentUser.role as UserRole, 'ADMIN') : false
    const isAuthor = currentUser?.id === post.author_id
    if (!isAdmin && !isAuthor) {
      return { data: null, error: '접근 권한이 없습니다.' }
    }
  }

  // 조회수 업데이트 (fire-and-forget)
  if (current) {
    admin.from('posts').update({ view_count: current.view_count + 1 }).eq('id', id).then(() => {})
  }

  return { data: post }
}

/** 포스트 작성 (MANAGER+, 공지사항은 ADMIN+) */
export async function createPost(
  input: CreatePostInput
): Promise<{ data: Post | null; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { data: null, error: '로그인이 필요합니다.' }

  // 카테고리별 권한 검증
  if (input.category === 'NOTICE') {
    if (!hasMinimumRole(user.role as UserRole, 'ADMIN')) {
      return { data: null, error: '공지사항은 관리자만 작성할 수 있습니다.' }
    }
  } else {
    if (!hasMinimumRole(user.role as UserRole, 'MANAGER')) {
      return { data: null, error: '운영자 이상 권한이 필요합니다.' }
    }
  }

  // 입력 검증: content는 HTML이므로 sanitizeObject 대신 title만 sanitize
  const sanitizedTitle = sanitizeInput(input.title)
  const sanitizedCategory = input.category
  const errors = validatePostInput({
    category: sanitizedCategory,
    title: sanitizedTitle,
    content: input.content,
  })
  if (hasValidationErrors(errors)) {
    const firstError = Object.values(errors).find(Boolean)
    return { data: null, error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('posts')
    .insert({
      category: sanitizedCategory,
      title: sanitizedTitle.trim(),
      content: input.content,
      attachments: input.attachments ?? [],
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
  if (!hasMinimumRole(user.role as UserRole, 'ADMIN')) {
    const { data: post } = await admin
      .from('posts')
      .select('author_id')
      .eq('id', id)
      .single()

    if (!post || post.author_id !== user.id) {
      return { error: '수정 권한이 없습니다.' }
    }
  }

  // content는 HTML이므로 sanitizeObject 대신 개별 sanitize
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (input.title) updateData.title = sanitizeInput(input.title).trim()
  if (input.content) updateData.content = input.content
  if (input.category) updateData.category = input.category
  if (input.attachments !== undefined) updateData.attachments = input.attachments
  if (input.is_published !== undefined) updateData.is_published = input.is_published

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
  if (!hasMinimumRole(user.role as UserRole, 'ADMIN')) {
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
  if (!hasMinimumRole(user.role as UserRole, 'ADMIN')) {
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

  // comment_count 동기화: 직접 카운트
  const { count } = await admin
    .from('post_comments')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', sanitized.post_id)

  await admin
    .from('posts')
    .update({ comment_count: count ?? 0 })
    .eq('id', sanitized.post_id)

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
  if (!hasMinimumRole(user.role as UserRole, 'ADMIN')) {
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

  // comment_count 동기화: 직접 카운트
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

// ============================================================================
// 피드 (무한 스크롤) + 좋아요
// ============================================================================

/** cursor 기반 피드 조회 (무한 스크롤) */
export async function getPostsFeed(options?: {
  cursor?: string // 마지막 포스트의 created_at
  limit?: number
  search?: string
}): Promise<{ data: Post[]; nextCursor: string | null; error?: string }> {
  const admin = createAdminClient()
  const limit = options?.limit ?? 5

  // 현재 로그인 유저 (좋아요 여부 + 비공개 필터용, 비로그인도 허용)
  const user = await getCurrentUser().catch(() => null)
  const isAdmin = user ? hasMinimumRole(user.role as UserRole, 'ADMIN') : false

  let query = admin
    .from('posts')
    .select('*, author:profiles!author_id(name, avatar_url)')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  // 비공개 필터: ADMIN+는 전체 조회, 그 외는 공개 글 + 본인 글만
  if (!isAdmin) {
    if (user) {
      query = query.or(`is_published.eq.true,author_id.eq.${user.id}`)
    } else {
      query = query.eq('is_published', true)
    }
  }

  if (options?.cursor) {
    query = query.lt('created_at', options.cursor)
  }

  if (options?.search) {
    query = query.or(`title.ilike.%${options.search}%,content.ilike.%${options.search}%`)
  }

  const { data, error } = await query

  if (error) return { data: [], nextCursor: null, error: error.message }

  const posts = (data ?? []) as Post[]

  // 좋아요 여부 조회 (로그인 유저만)
  if (user && posts.length > 0) {
    const postIds = posts.map((p) => p.id)
    const { data: likes } = await admin
      .from('post_likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds)

    const likedSet = new Set((likes ?? []).map((l) => l.post_id))
    for (const post of posts) {
      post.is_liked = likedSet.has(post.id)
    }
  }

  // 다음 cursor: 마지막 포스트의 created_at (limit만큼 가져왔으면 더 있을 수 있음)
  const nextCursor = posts.length === limit ? posts[posts.length - 1].created_at : null

  return { data: posts, nextCursor }
}

/** 좋아요 토글 */
export async function toggleLike(
  postId: string
): Promise<{ liked: boolean; likeCount: number; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { liked: false, likeCount: 0, error: '로그인이 필요합니다.' }

  const idErr = validateId(postId, '포스트 ID')
  if (idErr) return { liked: false, likeCount: 0, error: idErr }

  const admin = createAdminClient()

  // 현재 좋아요 여부 확인
  const { data: existing } = await admin
    .from('post_likes')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    // 좋아요 취소
    await admin.from('post_likes').delete().eq('id', existing.id)
  } else {
    // 좋아요 추가
    await admin.from('post_likes').insert({ post_id: postId, user_id: user.id })
  }

  // like_count 동기화: 실제 카운트
  const { count } = await admin
    .from('post_likes')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId)

  const likeCount = count ?? 0
  await admin.from('posts').update({ like_count: likeCount }).eq('id', postId)

  return { liked: !existing, likeCount }
}
