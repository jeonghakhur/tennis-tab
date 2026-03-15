'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { revalidatePath } from 'next/cache'
import { sanitizeObject } from '@/lib/utils/validation'
import type { Coach, CreateCoachInput, UpdateCoachInput } from '@/lib/lessons/types'

// ============================================================================
// 검증 헬퍼
// ============================================================================

function validateId(id: string, fieldName: string): string | null {
  if (!id || typeof id !== 'string' || id.trim().length === 0) {
    return `${fieldName}이(가) 유효하지 않습니다.`
  }
  return null
}

/** 클럽 OWNER/ADMIN 권한 확인 */
async function checkClubAdminAuth(clubId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null }

  // 시스템 관리자는 모든 클럽 접근 가능
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return { error: null, user }
  }

  const admin = createAdminClient()
  const { data: member } = await admin
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member || !['OWNER', 'ADMIN'].includes(member.role)) {
    return { error: '클럽 관리 권한이 없습니다.', user: null }
  }

  return { error: null, user }
}

// ============================================================================
// 코치 CRUD
// ============================================================================

/** 코치 등록 */
export async function createCoach(
  clubId: string,
  data: CreateCoachInput
): Promise<{ error: string | null; data?: Coach }> {
  const idErr = validateId(clubId, '클럽 ID')
  if (idErr) return { error: idErr }

  const { error: authErr, user } = await checkClubAdminAuth(clubId)
  if (authErr || !user) return { error: authErr || '권한이 없습니다.' }

  if (!data.name || data.name.trim().length < 2) {
    return { error: '코치 이름은 2자 이상이어야 합니다.' }
  }

  const sanitized = sanitizeObject(data)
  const admin = createAdminClient()

  const { data: coach, error } = await admin
    .from('coaches')
    .insert({
      club_id: clubId,
      name: sanitized.name,
      bio: sanitized.bio || null,
      experience: sanitized.experience || null,
      certifications: sanitized.certifications || [],
      profile_image_url: sanitized.profile_image_url || null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return { error: '코치 등록에 실패했습니다.' }

  revalidatePath(`/clubs/${clubId}`)
  return { error: null, data: coach }
}

/** 코치 수정 */
export async function updateCoach(
  coachId: string,
  data: UpdateCoachInput
): Promise<{ error: string | null }> {
  const idErr = validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  // 코치 소속 클럽 확인
  const { data: coach } = await admin
    .from('coaches')
    .select('club_id')
    .eq('id', coachId)
    .single()

  if (!coach) return { error: '코치를 찾을 수 없습니다.' }

  const { error: authErr } = await checkClubAdminAuth(coach.club_id)
  if (authErr) return { error: authErr }

  const sanitized = sanitizeObject(data)
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (sanitized.name !== undefined) updateData.name = sanitized.name
  if (sanitized.bio !== undefined) updateData.bio = sanitized.bio || null
  if (sanitized.experience !== undefined) updateData.experience = sanitized.experience || null
  if (sanitized.certifications !== undefined) updateData.certifications = sanitized.certifications
  if (sanitized.profile_image_url !== undefined) updateData.profile_image_url = sanitized.profile_image_url || null

  const { error } = await admin
    .from('coaches')
    .update(updateData)
    .eq('id', coachId)

  if (error) return { error: '코치 수정에 실패했습니다.' }

  revalidatePath(`/clubs/${coach.club_id}`)
  return { error: null }
}

/** 코치 비활성화 */
export async function deactivateCoach(
  coachId: string
): Promise<{ error: string | null }> {
  const idErr = validateId(coachId, '코치 ID')
  if (idErr) return { error: idErr }

  const admin = createAdminClient()

  const { data: coach } = await admin
    .from('coaches')
    .select('club_id')
    .eq('id', coachId)
    .single()

  if (!coach) return { error: '코치를 찾을 수 없습니다.' }

  const { error: authErr } = await checkClubAdminAuth(coach.club_id)
  if (authErr) return { error: authErr }

  const { error } = await admin
    .from('coaches')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', coachId)

  if (error) return { error: '코치 비활성화에 실패했습니다.' }

  revalidatePath(`/clubs/${coach.club_id}`)
  return { error: null }
}

/** 클럽 코치 목록 조회 */
export async function getCoachesByClub(
  clubId: string
): Promise<{ error: string | null; data: Coach[] }> {
  const idErr = validateId(clubId, '클럽 ID')
  if (idErr) return { error: idErr, data: [] }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('coaches')
    .select('*')
    .eq('club_id', clubId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) return { error: '코치 목록 조회에 실패했습니다.', data: [] }

  return { error: null, data: data || [] }
}
