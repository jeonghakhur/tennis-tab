'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import type { Association, AssociationManager, CreateAssociationInput, UpdateAssociationInput } from './types'
import {
  sanitizeObject,
  validateAssociationInput,
  hasValidationErrors,
} from '@/lib/utils/validation'

// ============================================================================
// 검증 헬퍼
// ============================================================================

function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

/** ADMIN 이상 권한 확인 */
async function checkAdminAuth() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null }
  if (!hasMinimumRole(user.role, 'ADMIN')) {
    return { error: 'ADMIN 권한이 필요합니다.', user: null }
  }
  return { error: null, user }
}

/** 협회 소유자(해당 ADMIN) 확인 */
async function checkAssociationOwnerAuth(associationId: string) {
  const { error, user } = await checkAdminAuth()
  if (error || !user) return { error: error || '로그인이 필요합니다.', user: null }

  // SUPER_ADMIN은 모든 협회 접근 가능
  if (user.role === 'SUPER_ADMIN') return { error: null, user }

  const admin = createAdminClient()
  const { data: association } = await admin
    .from('associations')
    .select('created_by')
    .eq('id', associationId)
    .single()

  if (!association || association.created_by !== user.id) {
    return { error: '해당 협회의 관리자가 아닙니다.', user: null }
  }

  return { error: null, user }
}

// ============================================================================
// 협회 CRUD
// ============================================================================

/** 협회 생성 (ADMIN: 1인 1협회 제한, SUPER_ADMIN: 제한 없음) */
export async function createAssociation(data: CreateAssociationInput): Promise<{ error?: string }> {
  const { error: authError, user } = await checkAdminAuth()
  if (authError || !user) return { error: authError || '로그인이 필요합니다.' }

  // 입력값 살균 (XSS 방지) + 검증
  const sanitized = sanitizeObject(data)
  const validationErrors = validateAssociationInput(sanitized)
  if (hasValidationErrors(validationErrors)) {
    // 첫 번째 에러 메시지 반환
    const firstError = Object.values(validationErrors).find(Boolean)
    return { error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()

  // ADMIN만 1인 1협회 제한 (SUPER_ADMIN은 제한 없음)
  if (user.role !== 'SUPER_ADMIN') {
    const { data: existing } = await admin
      .from('associations')
      .select('id')
      .eq('created_by', user.id)
      .maybeSingle()

    if (existing) {
      return { error: '이미 협회를 보유하고 있습니다. (1인 1협회 제한)' }
    }
  }

  const { error } = await admin.from('associations').insert({
    name: sanitized.name.trim(),
    region: sanitized.region?.trim() || null,
    district: sanitized.district?.trim() || null,
    description: sanitized.description?.trim() || null,
    president_name: sanitized.president_name?.trim() || null,
    president_phone: sanitized.president_phone?.trim() || null,
    president_email: sanitized.president_email?.trim() || null,
    secretary_name: sanitized.secretary_name?.trim() || null,
    secretary_phone: sanitized.secretary_phone?.trim() || null,
    secretary_email: sanitized.secretary_email?.trim() || null,
    created_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { error: '이미 동일한 이름의 협회가 존재합니다.' }
    return { error: '협회 생성에 실패했습니다.' }
  }

  revalidatePath('/admin/associations')
  return {}
}

/** 내 협회 조회 (ADMIN) */
export async function getMyAssociation(): Promise<{ data: Association | null; error?: string }> {
  const { error: authError, user } = await checkAdminAuth()
  if (authError || !user) return { data: null, error: authError || '로그인이 필요합니다.' }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('associations')
    .select('*')
    .eq('created_by', user.id)
    .maybeSingle()

  if (error) return { data: null, error: '협회 조회에 실패했습니다.' }
  return { data: data as Association | null }
}

/** 협회 상세 조회 (ADMIN — 소유자 검증) */
export async function getAssociation(associationId: string): Promise<{ data: Association | null; error?: string }> {
  const idError = validateId(associationId, '협회 ID')
  if (idError) return { data: null, error: idError }

  const { error: authError } = await checkAssociationOwnerAuth(associationId)
  if (authError) return { data: null, error: authError }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('associations')
    .select('*')
    .eq('id', associationId)
    .single()

  if (error) return { data: null, error: '협회 조회에 실패했습니다.' }
  return { data: data as Association }
}

/** 협회 수정 (소유 ADMIN) */
export async function updateAssociation(
  associationId: string,
  data: UpdateAssociationInput
): Promise<{ error?: string }> {
  const idError = validateId(associationId, '협회 ID')
  if (idError) return { error: idError }

  const { error: authError } = await checkAssociationOwnerAuth(associationId)
  if (authError) return { error: authError }

  // 입력값 살균 (XSS 방지) + 검증
  const sanitized = sanitizeObject(data)
  const validationErrors = validateAssociationInput({ ...sanitized, name: sanitized.name || 'placeholder' })
  // 수정 시에는 name이 없을 수 있으므로, name 필드가 실제로 변경될 때만 검증
  if (sanitized.name !== undefined) {
    const fullErrors = validateAssociationInput(sanitized)
    if (fullErrors.name) return { error: fullErrors.name }
  }
  // name 외 필드 검증
  const fieldErrors = { ...validationErrors }
  delete fieldErrors.name
  if (hasValidationErrors(fieldErrors)) {
    const firstError = Object.values(fieldErrors).find(Boolean)
    return { error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('associations')
    .update({
      ...(sanitized.name !== undefined && { name: sanitized.name.trim() }),
      ...(sanitized.region !== undefined && { region: sanitized.region?.trim() || null }),
      ...(sanitized.district !== undefined && { district: sanitized.district?.trim() || null }),
      ...(sanitized.description !== undefined && { description: sanitized.description?.trim() || null }),
      ...(sanitized.president_name !== undefined && { president_name: sanitized.president_name?.trim() || null }),
      ...(sanitized.president_phone !== undefined && { president_phone: sanitized.president_phone?.trim() || null }),
      ...(sanitized.president_email !== undefined && { president_email: sanitized.president_email?.trim() || null }),
      ...(sanitized.secretary_name !== undefined && { secretary_name: sanitized.secretary_name?.trim() || null }),
      ...(sanitized.secretary_phone !== undefined && { secretary_phone: sanitized.secretary_phone?.trim() || null }),
      ...(sanitized.secretary_email !== undefined && { secretary_email: sanitized.secretary_email?.trim() || null }),
      updated_at: new Date().toISOString(),
    })
    .eq('id', associationId)

  if (error) {
    if (error.code === '23505') return { error: '이미 동일한 이름의 협회가 존재합니다.' }
    return { error: '협회 수정에 실패했습니다.' }
  }

  revalidatePath('/admin/associations')
  return {}
}

/** 협회 삭제 (소유 ADMIN — 소속 클럽은 독립 클럽으로 전환) */
export async function deleteAssociation(associationId: string): Promise<{ error?: string }> {
  const idError = validateId(associationId, '협회 ID')
  if (idError) return { error: idError }

  const { error: authError } = await checkAssociationOwnerAuth(associationId)
  if (authError) return { error: authError }

  const admin = createAdminClient()

  // 소속 클럽의 association_id를 null로 전환 (독립 클럽화)
  await admin
    .from('clubs')
    .update({ association_id: null, updated_at: new Date().toISOString() })
    .eq('association_id', associationId)

  // 매니저 역할 강등 (association_managers에 등록된 매니저 → USER)
  const { data: managers } = await admin
    .from('association_managers')
    .select('user_id')
    .eq('association_id', associationId)

  if (managers && managers.length > 0) {
    const managerIds = managers.map((m) => m.user_id)
    await admin
      .from('profiles')
      .update({ role: 'USER', updated_at: new Date().toISOString() })
      .in('id', managerIds)
  }

  // 협회 삭제 (CASCADE로 association_managers도 삭제됨)
  const { error } = await admin
    .from('associations')
    .delete()
    .eq('id', associationId)

  if (error) return { error: '협회 삭제에 실패했습니다.' }

  revalidatePath('/admin/associations')
  return {}
}

// ============================================================================
// 매니저 관리
// ============================================================================

/** 매니저 목록 조회 */
export async function getAssociationManagers(
  associationId: string
): Promise<{ data: AssociationManager[]; error?: string }> {
  const idError = validateId(associationId, '협회 ID')
  if (idError) return { data: [], error: idError }

  const { error: authError } = await checkAssociationOwnerAuth(associationId)
  if (authError) return { data: [], error: authError }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('association_managers')
    .select(`
      *,
      profiles:user_id (name, email, phone)
    `)
    .eq('association_id', associationId)
    .order('assigned_at', { ascending: false })

  if (error) return { data: [], error: '매니저 목록 조회에 실패했습니다.' }
  return { data: (data || []) as AssociationManager[] }
}

/** 매니저 지정 (대상 USER → MANAGER 승격) */
export async function assignManager(
  associationId: string,
  userId: string
): Promise<{ error?: string }> {
  const idError = validateId(associationId, '협회 ID') || validateId(userId, '사용자 ID')
  if (idError) return { error: idError }

  const { error: authError, user } = await checkAssociationOwnerAuth(associationId)
  if (authError || !user) return { error: authError || '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 대상 사용자 프로필 확인
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (!targetProfile) return { error: '사용자를 찾을 수 없습니다.' }

  // 이미 ADMIN 이상인 경우
  if (hasMinimumRole(targetProfile.role, 'ADMIN')) {
    return { error: 'ADMIN 이상의 사용자는 매니저로 지정할 수 없습니다.' }
  }

  // profiles.role을 MANAGER로 변경
  await admin
    .from('profiles')
    .update({ role: 'MANAGER', updated_at: new Date().toISOString() })
    .eq('id', userId)

  // association_managers에 추가
  const { error } = await admin.from('association_managers').insert({
    association_id: associationId,
    user_id: userId,
    assigned_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { error: '이미 해당 협회의 매니저입니다.' }
    return { error: '매니저 지정에 실패했습니다.' }
  }

  revalidatePath(`/admin/associations/${associationId}/managers`)
  return {}
}

/** 매니저 해제 (MANAGER → USER 강등) */
export async function removeManager(
  associationId: string,
  userId: string
): Promise<{ error?: string }> {
  const idError = validateId(associationId, '협회 ID') || validateId(userId, '사용자 ID')
  if (idError) return { error: idError }

  const { error: authError } = await checkAssociationOwnerAuth(associationId)
  if (authError) return { error: authError }

  const admin = createAdminClient()

  // association_managers에서 제거
  const { error } = await admin
    .from('association_managers')
    .delete()
    .eq('association_id', associationId)
    .eq('user_id', userId)

  if (error) return { error: '매니저 해제에 실패했습니다.' }

  // 다른 협회 소속 매니저가 아닌 경우에만 USER로 강등
  const { data: otherAssoc } = await admin
    .from('association_managers')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (!otherAssoc || otherAssoc.length === 0) {
    await admin
      .from('profiles')
      .update({ role: 'USER', updated_at: new Date().toISOString() })
      .eq('id', userId)
  }

  revalidatePath(`/admin/associations/${associationId}/managers`)
  return {}
}

/** 사용자 검색 (매니저 지정용 — 이름/이메일로 검색) */
export async function searchUsersForManager(
  query: string
): Promise<{ data: Array<{ id: string; name: string; email: string; role: string | null }>; error?: string }> {
  if (!query || query.trim().length < 2) {
    return { data: [], error: '검색어를 2글자 이상 입력해주세요.' }
  }

  const { error: authError } = await checkAdminAuth()
  if (authError) return { data: [], error: authError }

  const admin = createAdminClient()
  const searchTerm = `%${query.trim()}%`

  const { data, error } = await admin
    .from('profiles')
    .select('id, name, email, role')
    .or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`)
    .limit(20)

  if (error) return { data: [], error: '사용자 검색에 실패했습니다.' }
  return { data: data || [] }
}
