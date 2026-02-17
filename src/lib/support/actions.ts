'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import {
  sanitizeInput,
  sanitizeObject,
  validateInquiryInput,
  hasValidationErrors,
} from '@/lib/utils/validation'
import type { UserRole } from '@/lib/supabase/types'
import type {
  Inquiry,
  CreateInquiryInput,
  ReplyInquiryInput,
  InquiryStatus,
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
  if (!hasMinimumRole(user.role as UserRole, 'ADMIN')) {
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
  if (!hasMinimumRole(user.role as UserRole, 'ADMIN')) {
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

/** 문의 답변 작성 (ADMIN+) — 상태를 RESOLVED로 자동 변경 */
export async function replyInquiry(
  input: ReplyInquiryInput
): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }
  if (!hasMinimumRole(user.role as UserRole, 'ADMIN')) {
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
      reply_content: sanitizeInput(input.reply_content.trim()),
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
  if (!hasMinimumRole(user.role as UserRole, 'ADMIN')) {
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
