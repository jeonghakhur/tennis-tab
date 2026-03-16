'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeObject } from '@/lib/utils/validation'
import type { Coach, CreateCoachInput, UpdateCoachInput } from '@/lib/lessons/types'

function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

async function checkAdminAuth() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null }
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    return { error: '관리자 권한이 필요합니다.', user: null }
  }
  return { error: null, user }
}

// ============================================================================
// 코치 CRUD
// ============================================================================

/** 코치 목록 조회 (활성 코치만) */
export async function getCoaches(): Promise<{ error: string | null; data: Coach[] }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coaches')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) return { error: '코치 목록 조회에 실패했습니다.', data: [] }
  return { error: null, data: data || [] }
}

/** 전체 코치 목록 (관리자용 — 비활성 포함) */
export async function getAllCoaches(): Promise<{ error: string | null; data: Coach[] }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('coaches')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) return { error: '코치 목록 조회에 실패했습니다.', data: [] }
  return { error: null, data: data || [] }
}

/** 코치 등록 */
export async function createCoach(
  data: CreateCoachInput
): Promise<{ error: string | null; data?: Coach }> {
  const { error: authErr, user } = await checkAdminAuth()
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  if (!data.name || data.name.trim().length < 2) {
    return { error: '코치 이름은 2자 이상이어야 합니다.' }
  }

  const sanitized = sanitizeObject(data)
  const admin = createAdminClient()

  const { data: coach, error } = await admin
    .from('coaches')
    .insert({
      name: sanitized.name,
      bio: sanitized.bio || null,
      experience: sanitized.experience || null,
      certifications: sanitized.certifications || [],
      certification_files: data.certification_files || [],
      profile_image_url: sanitized.profile_image_url || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: '코치 등록에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null, data: coach }
}

/** 코치 정보 수정 */
export async function updateCoach(
  coachId: string,
  data: UpdateCoachInput
): Promise<{ error: string | null }> {
  const idErr = validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const sanitized = sanitizeObject(data)
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (sanitized.name !== undefined) updateData.name = sanitized.name
  if (sanitized.bio !== undefined) updateData.bio = sanitized.bio || null
  if (sanitized.experience !== undefined) updateData.experience = sanitized.experience || null
  if (sanitized.certifications !== undefined) updateData.certifications = sanitized.certifications
  if (data.certification_files !== undefined) updateData.certification_files = data.certification_files
  if (sanitized.profile_image_url !== undefined) updateData.profile_image_url = sanitized.profile_image_url || null

  const admin = createAdminClient()
  const { error } = await admin
    .from('coaches')
    .update(updateData)
    .eq('id', coachId)

  if (error) return { error: '코치 정보 수정에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null }
}

/** 코치 비활성화 */
export async function deactivateCoach(coachId: string): Promise<{ error: string | null }> {
  const idErr = validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr }

  const { error: authErr } = await checkAdminAuth()
  if (authErr) return { error: authErr }

  const admin = createAdminClient()
  const { error } = await admin
    .from('coaches')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', coachId)

  if (error) return { error: '코치 비활성화에 실패했습니다.' }

  revalidatePath('/lessons')
  return { error: null }
}
