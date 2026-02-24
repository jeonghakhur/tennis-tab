'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import type { UserRole } from '@/lib/supabase/types'
import type { Faq, FaqInput, FaqCategoryItem, FaqCategoryInput } from './types'

// ============================================================================
// 검증 헬퍼
// ============================================================================

function validateFaqInput(data: FaqInput): string | null {
  if (!data.category) return '카테고리를 선택해주세요.'
  if (!data.question?.trim()) return '질문을 입력해주세요.'
  if (data.question.length > 200) return '질문은 200자 이내로 입력해주세요.'
  if (!data.answer?.trim()) return '답변을 입력해주세요.'
  if (data.answer.length > 2000) return '답변은 2000자 이내로 입력해주세요.'
  return null
}

async function checkAdminAuth(): Promise<{ error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const supabase = createAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !hasMinimumRole(profile.role as UserRole, 'ADMIN')) {
    return { error: '관리자 권한이 필요합니다.' }
  }
  return {}
}

function revalidateFaqPaths() {
  revalidatePath('/support')
  revalidatePath('/admin/faq')
}

// ============================================================================
// 카테고리 — 공개
// ============================================================================

/** 활성 카테고리 조회 (정렬 순서) */
export async function getFaqCategories(): Promise<{
  data: FaqCategoryItem[]
  error?: string
}> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('faq_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  if (error) return { data: [], error: error.message }
  return { data: data as FaqCategoryItem[] }
}

// ============================================================================
// 카테고리 — 어드민
// ============================================================================

/** 전체 카테고리 조회 (비활성 포함) */
export async function getFaqCategoriesAdmin(): Promise<{
  data: FaqCategoryItem[]
  error?: string
}> {
  const auth = await checkAdminAuth()
  if (auth.error) return { data: [], error: auth.error }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('faq_categories')
    .select('*')
    .order('sort_order')

  if (error) return { data: [], error: error.message }
  return { data: data as FaqCategoryItem[] }
}

/** 카테고리 생성 */
export async function createFaqCategory(
  input: FaqCategoryInput,
): Promise<{ data: FaqCategoryItem | null; error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { data: null, error: auth.error }

  if (!input.slug?.trim()) return { data: null, error: 'slug를 입력해주세요.' }
  if (!input.name?.trim()) return { data: null, error: '카테고리 이름을 입력해주세요.' }
  if (input.name.length > 50) return { data: null, error: '이름은 50자 이내로 입력해주세요.' }

  // slug: 영문 대문자 + 언더스코어만 허용
  const slug = input.slug.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_')

  const supabase = createAdminClient()

  // sort_order 미지정 시 마지막 + 1
  let sortOrder = input.sort_order ?? 0
  if (!input.sort_order) {
    const { data: maxRow } = await supabase
      .from('faq_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    sortOrder = (maxRow?.sort_order ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('faq_categories')
    .insert({
      slug,
      name: input.name.trim(),
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { data: null, error: '이미 존재하는 slug입니다.' }
    return { data: null, error: error.message }
  }
  revalidateFaqPaths()
  return { data: data as FaqCategoryItem }
}

/** 카테고리 수정 */
export async function updateFaqCategory(
  slug: string,
  input: Partial<FaqCategoryInput>,
): Promise<{ error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { error: auth.error }

  if (!slug) return { error: '유효하지 않은 카테고리입니다.' }
  if (input.name !== undefined && !input.name.trim()) return { error: '이름을 입력해주세요.' }

  const supabase = createAdminClient()
  const updateData: Record<string, unknown> = {}
  if (input.name !== undefined) updateData.name = input.name.trim()
  if (input.sort_order !== undefined) updateData.sort_order = input.sort_order
  if (input.is_active !== undefined) updateData.is_active = input.is_active

  const { error } = await supabase
    .from('faq_categories')
    .update(updateData)
    .eq('slug', slug)

  if (error) return { error: error.message }
  revalidateFaqPaths()
  return {}
}

/** 카테고리 삭제 (해당 카테고리에 FAQ가 있으면 불가) */
export async function deleteFaqCategory(slug: string): Promise<{ error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { error: auth.error }

  if (!slug) return { error: '유효하지 않은 카테고리입니다.' }

  const supabase = createAdminClient()

  // 해당 카테고리에 FAQ가 있는지 확인
  const { count } = await supabase
    .from('faqs')
    .select('id', { count: 'exact', head: true })
    .eq('category', slug)

  if (count && count > 0) {
    return { error: `이 카테고리에 FAQ ${count}개가 있어 삭제할 수 없습니다. FAQ를 먼저 이동하거나 삭제해주세요.` }
  }

  const { error } = await supabase.from('faq_categories').delete().eq('slug', slug)
  if (error) return { error: error.message }
  revalidateFaqPaths()
  return {}
}

// ============================================================================
// FAQ — 사용자용 (공개)
// ============================================================================

/** 활성 FAQ 전체 조회 (카테고리별 정렬) */
export async function getFaqs(): Promise<{ data: Faq[]; error?: string }> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .eq('is_active', true)
    .order('category')
    .order('sort_order')

  if (error) return { data: [], error: error.message }
  return { data: data as Faq[] }
}

// ============================================================================
// FAQ — 어드민용
// ============================================================================

/** FAQ 전체 조회 (비활성 포함) */
export async function getFaqsAdmin(): Promise<{ data: Faq[]; error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { data: [], error: auth.error }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('faqs')
    .select('*')
    .order('category')
    .order('sort_order')

  if (error) return { data: [], error: error.message }
  return { data: data as Faq[] }
}

/** FAQ 생성 */
export async function createFaq(
  input: FaqInput,
): Promise<{ data: Faq | null; error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { data: null, error: auth.error }

  const validationError = validateFaqInput(input)
  if (validationError) return { data: null, error: validationError }

  const supabase = createAdminClient()

  // sort_order 미지정 시 해당 카테고리의 마지막 순서 + 1
  let sortOrder = input.sort_order ?? 0
  if (!input.sort_order) {
    const { data: maxRow } = await supabase
      .from('faqs')
      .select('sort_order')
      .eq('category', input.category)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    sortOrder = (maxRow?.sort_order ?? 0) + 1
  }

  const { data, error } = await supabase
    .from('faqs')
    .insert({
      category: input.category,
      question: input.question.trim(),
      answer: input.answer.trim(),
      sort_order: sortOrder,
      is_active: input.is_active ?? true,
    })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  revalidateFaqPaths()
  return { data: data as Faq }
}

/** FAQ 수정 */
export async function updateFaq(
  id: string,
  input: Partial<FaqInput>,
): Promise<{ error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { error: auth.error }

  if (!id) return { error: '유효하지 않은 FAQ ID입니다.' }

  if (input.question !== undefined) {
    if (!input.question.trim()) return { error: '질문을 입력해주세요.' }
    if (input.question.length > 200) return { error: '질문은 200자 이내로 입력해주세요.' }
  }
  if (input.answer !== undefined) {
    if (!input.answer.trim()) return { error: '답변을 입력해주세요.' }
    if (input.answer.length > 2000) return { error: '답변은 2000자 이내로 입력해주세요.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('faqs')
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return { error: error.message }
  revalidateFaqPaths()
  return {}
}

/** FAQ 삭제 */
export async function deleteFaq(id: string): Promise<{ error?: string }> {
  const auth = await checkAdminAuth()
  if (auth.error) return { error: auth.error }

  if (!id) return { error: '유효하지 않은 FAQ ID입니다.' }

  const supabase = createAdminClient()
  const { error } = await supabase.from('faqs').delete().eq('id', id)

  if (error) return { error: error.message }
  revalidateFaqPaths()
  return {}
}

/** FAQ 활성/비활성 토글 */
export async function toggleFaqActive(
  id: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  return updateFaq(id, { is_active: isActive } as Partial<FaqInput>)
}
