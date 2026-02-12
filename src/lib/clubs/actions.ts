'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
import {
  sanitizeInput,
  sanitizeObject,
  validateClubInput,
  validateMemberInput,
  hasValidationErrors,
} from '@/lib/utils/validation'
import type {
  Club,
  ClubMember,
  ClubFilters,
  ClubJoinType,
  CreateClubInput,
  UpdateClubInput,
  UnregisteredMemberInput,
  ClubMemberRole,
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

/** MANAGER 이상 권한 확인 */
async function checkManagerAuth() {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null }
  if (!hasMinimumRole(user.role, 'MANAGER')) {
    return { error: 'MANAGER 이상 권한이 필요합니다.', user: null }
  }
  return { error: null, user }
}

/** 클럽 owner/admin 권한 확인 */
async function checkClubOwnerAuth(clubId: string) {
  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.', user: null, clubRole: null }

  // SUPER_ADMIN은 모든 클럽 접근 가능
  if (user.role === 'SUPER_ADMIN') {
    return { error: null, user, clubRole: 'OWNER' as ClubMemberRole }
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
    return { error: '클럽 관리 권한이 없습니다.', user: null, clubRole: null }
  }

  return { error: null, user, clubRole: member.role as ClubMemberRole }
}

/**
 * 대표 클럽 재지정 헬퍼 (탈퇴/제거 시 사용)
 * 남은 ACTIVE 멤버십 중 가장 먼저 가입한 클럽을 대표로 설정.
 * 남은 멤버십이 없으면 profiles.club을 null로 초기화.
 */
async function reassignPrimaryClub(
  admin: ReturnType<typeof createAdminClient>,
  userId: string
) {
  // 남은 ACTIVE 멤버십 중 가장 먼저 가입한 클럽
  const { data: nextPrimary } = await admin
    .from('club_members')
    .select('id, club_id')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .order('joined_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (nextPrimary) {
    await admin
      .from('club_members')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('id', nextPrimary.id)

    // profiles.club 레거시 필드 동기화
    const { data: club } = await admin
      .from('clubs')
      .select('name, city, district')
      .eq('id', nextPrimary.club_id)
      .single()

    if (club) {
      await admin
        .from('profiles')
        .update({
          club: club.name,
          club_city: club.city,
          club_district: club.district,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
    }
  } else {
    // 남은 클럽 없음 → profiles.club 초기화
    await admin
      .from('profiles')
      .update({
        club: null,
        club_city: null,
        club_district: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
  }
}

// ============================================================================
// 클럽 CRUD
// ============================================================================

/** 클럽 생성 (MANAGER — 협회 소속이면 해당 협회 아래, 미소속이면 독립 클럽) */
export async function createClub(data: CreateClubInput): Promise<{ error?: string }> {
  const { error: authError, user } = await checkManagerAuth()
  if (authError || !user) return { error: authError || '로그인이 필요합니다.' }

  // 입력값 살균 (XSS 방지) + 검증
  const sanitized = sanitizeObject(data)
  const validationErrors = validateClubInput(sanitized)
  if (hasValidationErrors(validationErrors)) {
    const firstError = Object.values(validationErrors).find(Boolean)
    return { error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()

  // association_id 결정: 명시 전달 > 이름으로 찾기/생성 > 자동 감지
  let associationId: string | null = null
  if (sanitized.association_id !== undefined) {
    // 명시적으로 전달된 경우 — 권한 검증
    if (sanitized.association_id && user.role !== 'SUPER_ADMIN') {
      const { data: mgr } = await admin
        .from('association_managers')
        .select('association_id')
        .eq('user_id', user.id)
        .eq('association_id', sanitized.association_id)
        .maybeSingle()
      if (!mgr) return { error: '해당 협회의 관리자가 아닙니다.' }
    }
    associationId = sanitized.association_id || null
  } else if (sanitized.association_name?.trim()) {
    // 직접 입력: 이름으로 기존 협회 찾기 → 없으면 생성 (SUPER_ADMIN만)
    const trimmedName = sanitized.association_name.trim()
    const { data: found } = await admin
      .from('associations')
      .select('id')
      .eq('name', trimmedName)
      .maybeSingle()
    if (found) {
      associationId = found.id
    } else if (user.role === 'SUPER_ADMIN') {
      const { data: created } = await admin
        .from('associations')
        .insert({ name: trimmedName, created_by: user.id })
        .select('id')
        .single()
      if (created) associationId = created.id
    } else {
      return { error: '해당 이름의 협회를 찾을 수 없습니다.' }
    }
  } else if (sanitized.association_name === undefined) {
    // 하위 호환: 미전달 시 자동 감지
    const { data: managerAssoc } = await admin
      .from('association_managers')
      .select('association_id')
      .eq('user_id', user.id)
      .maybeSingle()
    associationId = managerAssoc?.association_id ?? null
  }

  // 클럽 생성
  const { data: club, error } = await admin
    .from('clubs')
    .insert({
      name: sanitized.name.trim(),
      representative_name: sanitized.representative_name.trim(),
      description: sanitized.description?.trim() || null,
      city: sanitized.city?.trim() || null,
      district: sanitized.district?.trim() || null,
      address: sanitized.address?.trim() || null,
      contact_phone: sanitized.contact_phone.trim(),
      contact_email: sanitized.contact_email.trim(),
      join_type: sanitized.join_type || 'APPROVAL',
      max_members: sanitized.max_members || null,
      association_id: associationId,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !club) return { error: '클럽 생성에 실패했습니다.' }

  // 기존 ACTIVE 멤버십 유무 확인 (대표 클럽 자동 지정용)
  const { count: activeCount } = await admin
    .from('club_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  const isFirstClub = (activeCount ?? 0) === 0

  // 생성자를 OWNER로 등록
  await admin.from('club_members').insert({
    club_id: club.id,
    user_id: user.id,
    is_registered: true,
    name: user.name,
    phone: user.phone,
    start_year: user.start_year,
    rating: user.rating,
    gender: user.gender || null,
    role: 'OWNER',
    status: 'ACTIVE',
    is_primary: isFirstClub,
  })

  // 첫 클럽이면 profiles.club 레거시 필드 동기화
  if (isFirstClub) {
    const clubName = sanitized.name.trim()
    await admin
      .from('profiles')
      .update({
        club: clubName,
        club_city: sanitized.city?.trim() || null,
        club_district: sanitized.district?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
  }

  revalidatePath('/admin/clubs')
  return {}
}

/** 클럽 수정 (owner/admin) */
export async function updateClub(clubId: string, data: UpdateClubInput): Promise<{ error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { error: idError }

  const { error: authError } = await checkClubOwnerAuth(clubId)
  if (authError) return { error: authError }

  // 입력값 살균 (XSS 방지) + 검증
  const sanitized = sanitizeObject(data)
  // 수정 시 필수 필드가 미전달될 수 있으므로, placeholder로 검증 우회 후 실제 전달된 필드만 별도 검증
  const validationData = {
    ...sanitized,
    name: sanitized.name || 'placeholder',
    representative_name: sanitized.representative_name || 'placeholder',
    contact_phone: sanitized.contact_phone || '01000000000',
    contact_email: sanitized.contact_email || 'placeholder@email.com',
  }
  const validationErrors = validateClubInput(validationData)
  // 실제 전달된 필수 필드는 원본 값으로 개별 검증
  const fullErrors = validateClubInput(sanitized)
  if (sanitized.name !== undefined && fullErrors.name) return { error: fullErrors.name }
  if (sanitized.representative_name !== undefined && fullErrors.representative_name) return { error: fullErrors.representative_name }
  if (sanitized.contact_phone !== undefined && fullErrors.contact_phone) return { error: fullErrors.contact_phone }
  if (sanitized.contact_email !== undefined && fullErrors.contact_email) return { error: fullErrors.contact_email }
  // 나머지 선택 필드 검증
  const fieldErrors = { ...validationErrors }
  delete fieldErrors.name
  delete fieldErrors.representative_name
  delete fieldErrors.contact_phone
  delete fieldErrors.contact_email
  if (hasValidationErrors(fieldErrors)) {
    const firstError = Object.values(fieldErrors).find(Boolean)
    return { error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()
  const user = await getCurrentUser()

  // association_id / association_name 처리
  let resolvedAssociationId: string | null | undefined = undefined
  if (sanitized.association_id !== undefined) {
    // 기존 협회 선택 — 권한 검증
    if (sanitized.association_id && user?.role !== 'SUPER_ADMIN') {
      const { data: mgr } = await admin
        .from('association_managers')
        .select('association_id')
        .eq('user_id', user!.id)
        .eq('association_id', sanitized.association_id)
        .maybeSingle()
      if (!mgr) return { error: '해당 협회의 관리자가 아닙니다.' }
    }
    resolvedAssociationId = sanitized.association_id || null
  } else if (sanitized.association_name?.trim()) {
    // 직접 입력: 이름으로 찾기 → 없으면 생성 (SUPER_ADMIN만)
    const trimmedName = sanitized.association_name.trim()
    const { data: found } = await admin
      .from('associations')
      .select('id')
      .eq('name', trimmedName)
      .maybeSingle()
    if (found) {
      resolvedAssociationId = found.id
    } else if (user?.role === 'SUPER_ADMIN') {
      const { data: created } = await admin
        .from('associations')
        .insert({ name: trimmedName, created_by: user.id })
        .select('id')
        .single()
      resolvedAssociationId = created?.id ?? null
    } else {
      return { error: '해당 이름의 협회를 찾을 수 없습니다.' }
    }
  } else if (sanitized.association_name === '') {
    // 빈 문자열 = 독립 클럽으로 전환
    resolvedAssociationId = null
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (sanitized.name !== undefined) updateData.name = sanitized.name.trim()
  if (sanitized.representative_name !== undefined) updateData.representative_name = sanitized.representative_name?.trim() || null
  if (sanitized.description !== undefined) updateData.description = sanitized.description?.trim() || null
  if (sanitized.city !== undefined) updateData.city = sanitized.city?.trim() || null
  if (sanitized.district !== undefined) updateData.district = sanitized.district?.trim() || null
  if (sanitized.address !== undefined) updateData.address = sanitized.address?.trim() || null
  if (sanitized.contact_phone !== undefined) updateData.contact_phone = sanitized.contact_phone?.trim() || null
  if (sanitized.contact_email !== undefined) updateData.contact_email = sanitized.contact_email?.trim() || null
  if (sanitized.join_type !== undefined) updateData.join_type = sanitized.join_type
  if (sanitized.max_members !== undefined) updateData.max_members = sanitized.max_members
  if (resolvedAssociationId !== undefined) updateData.association_id = resolvedAssociationId

  const { error } = await admin
    .from('clubs')
    .update(updateData)
    .eq('id', clubId)

  if (error) return { error: '클럽 수정에 실패했습니다.' }

  revalidatePath('/admin/clubs')
  revalidatePath(`/admin/clubs/${clubId}`)
  return {}
}

/** 클럽 삭제 (OWNER만) */
export async function deleteClub(clubId: string): Promise<{ error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { error: idError }

  const { error: authError, clubRole } = await checkClubOwnerAuth(clubId)
  if (authError) return { error: authError }

  if (clubRole !== 'OWNER') return { error: '클럽 소유자만 삭제할 수 있습니다.' }

  const admin = createAdminClient()

  // CASCADE로 club_members도 삭제됨
  const { error } = await admin.from('clubs').delete().eq('id', clubId)
  if (error) return { error: '클럽 삭제에 실패했습니다.' }

  revalidatePath('/admin/clubs')
  return {}
}

// ============================================================================
// 클럽 조회 (공개)
// ============================================================================

/** 클럽 목록 조회 (공개 — 필터 + 검색) */
export async function getClubs(
  filters?: ClubFilters
): Promise<{ data: Club[]; error?: string }> {
  const admin = createAdminClient()

  let query = admin
    .from('clubs')
    .select(`
      *,
      associations:association_id (name)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (filters?.search) {
    query = query.ilike('name', `%${filters.search}%`)
  }
  if (filters?.city) {
    query = query.eq('city', filters.city)
  }
  if (filters?.district) {
    query = query.eq('district', filters.district)
  }
  if (filters?.association_id) {
    query = query.eq('association_id', filters.association_id)
  }

  const { data, error } = await query
  if (error) return { data: [], error: '클럽 목록 조회에 실패했습니다.' }
  return { data: (data || []) as Club[] }
}

/** 클럽 상세 조회 (공개) */
export async function getClub(clubId: string): Promise<{ data: Club | null; error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { data: null, error: idError }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('clubs')
    .select(`
      *,
      associations:association_id (name)
    `)
    .eq('id', clubId)
    .single()

  if (error) return { data: null, error: '클럽 조회에 실패했습니다.' }
  return { data: data as Club }
}

/** 내 클럽 목록 (MANAGER — 내가 OWNER/ADMIN인 클럽) */
export async function getMyClubs(): Promise<{ data: Club[]; error?: string }> {
  const user = await getCurrentUser()
  if (!user) return { data: [], error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 내가 OWNER/ADMIN으로 소속된 클럽 ID 조회
  const { data: memberships } = await admin
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id)
    .in('role', ['OWNER', 'ADMIN'])
    .eq('status', 'ACTIVE')

  if (!memberships || memberships.length === 0) return { data: [] }

  const clubIds = memberships.map((m) => m.club_id)

  const { data: clubs, error } = await admin
    .from('clubs')
    .select(`
      *,
      associations:association_id (name)
    `)
    .in('id', clubIds)
    .order('created_at', { ascending: false })

  if (error) return { data: [], error: '클럽 목록 조회에 실패했습니다.' }
  return { data: (clubs || []) as Club[] }
}

// ============================================================================
// 회원 관리
// ============================================================================

/** 클럽 회원 목록 조회 */
export async function getClubMembers(
  clubId: string,
  filter?: 'all' | 'registered' | 'unregistered'
): Promise<{ data: ClubMember[]; error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { data: [], error: idError }

  const admin = createAdminClient()

  let query = admin
    .from('club_members')
    .select('*')
    .eq('club_id', clubId)
    .order('role', { ascending: true }) // OWNER, ADMIN, MEMBER 순
    .order('name', { ascending: true })

  if (filter === 'registered') {
    query = query.eq('is_registered', true)
  } else if (filter === 'unregistered') {
    query = query.eq('is_registered', false)
  }

  const { data, error } = await query
  if (error) return { data: [], error: '회원 목록 조회에 실패했습니다.' }
  return { data: (data || []) as ClubMember[] }
}

/** 비가입 회원 직접 등록 (owner/admin) */
export async function addUnregisteredMember(
  clubId: string,
  data: UnregisteredMemberInput
): Promise<{ error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { error: idError }

  const { error: authError } = await checkClubOwnerAuth(clubId)
  if (authError) return { error: authError }

  // 입력값 살균 (XSS 방지) + 검증
  const sanitized = sanitizeObject(data)
  const validationErrors = validateMemberInput(sanitized)
  if (hasValidationErrors(validationErrors)) {
    const firstError = Object.values(validationErrors).find(Boolean)
    return { error: firstError || '입력값을 확인해주세요.' }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('club_members').insert({
    club_id: clubId,
    user_id: null,
    is_registered: false,
    name: sanitized.name!.trim(),
    birth_date: sanitized.birth_date?.trim() || null,
    gender: sanitized.gender || null,
    phone: sanitized.phone?.trim() || null,
    start_year: sanitized.start_year?.trim() || null,
    rating: sanitized.rating || null,
    role: 'MEMBER',
    status: 'ACTIVE',
  })

  if (error) return { error: '회원 등록에 실패했습니다.' }

  revalidatePath(`/admin/clubs/${clubId}`)
  return {}
}

/** 가입 회원 클럽 가입 (프로필에서 클럽 선택 → profiles 데이터로 자동 채움) */
export async function joinClubAsRegistered(clubId: string, introduction?: string): Promise<{ error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { error: idError }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 클럽 존재 확인 + join_type 확인
  const { data: club } = await admin
    .from('clubs')
    .select('id, name, join_type, city, district, is_active')
    .eq('id', clubId)
    .single()

  if (!club) return { error: '클럽을 찾을 수 없습니다.' }
  if (!club.is_active) return { error: '비활성화된 클럽입니다.' }

  // 가입 방식에 따른 상태 결정
  let status: 'ACTIVE' | 'PENDING'
  if (club.join_type === 'INVITE_ONLY') {
    return { error: '이 클럽은 초대로만 가입할 수 있습니다.' }
  }
  status = club.join_type === 'OPEN' ? 'ACTIVE' : 'PENDING'

  // 자기소개 검증 + 살균
  let sanitizedIntro: string | null = null
  if (introduction && introduction.trim()) {
    sanitizedIntro = sanitizeInput(introduction.trim())
    if (sanitizedIntro.length > 500) {
      return { error: '자기소개는 500자 이내로 작성해주세요.' }
    }
  }

  // 기존 ACTIVE 멤버십 유무 확인 (대표 클럽 자동 지정용)
  const { count: activeCount } = await admin
    .from('club_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')

  const isFirstClub = (activeCount ?? 0) === 0
  const shouldBePrimary = isFirstClub && status === 'ACTIVE'

  // profiles 데이터로 club_members 자동 채움
  const { error } = await admin.from('club_members').insert({
    club_id: clubId,
    user_id: user.id,
    is_registered: true,
    name: user.name,
    phone: user.phone,
    start_year: user.start_year,
    rating: user.rating,
    gender: user.gender || null,
    role: 'MEMBER',
    status,
    is_primary: shouldBePrimary,
    introduction: sanitizedIntro,
  })

  if (error) {
    if (error.code === '23505') return { error: '이미 가입된 클럽입니다.' }
    return { error: '클럽 가입에 실패했습니다.' }
  }

  // 첫 클럽이면 profiles.club 레거시 필드 동기화
  if (shouldBePrimary) {
    await admin
      .from('profiles')
      .update({
        club: club.name,
        club_city: club.city,
        club_district: club.district,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
  }

  revalidatePath('/my/profile')
  revalidatePath(`/clubs/${clubId}`)
  return {}
}

/** 가입 회원 초대 (owner/admin) */
export async function inviteMember(clubId: string, userId: string): Promise<{ error?: string }> {
  const idError = validateId(clubId, '클럽 ID') || validateId(userId, '사용자 ID')
  if (idError) return { error: idError }

  const { error: authError, user } = await checkClubOwnerAuth(clubId)
  if (authError || !user) return { error: authError || '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 대상 사용자 확인
  const { data: targetProfile } = await admin
    .from('profiles')
    .select('id, name, phone, start_year, rating, gender')
    .eq('id', userId)
    .single()

  if (!targetProfile) return { error: '사용자를 찾을 수 없습니다.' }

  const { error } = await admin.from('club_members').insert({
    club_id: clubId,
    user_id: userId,
    is_registered: true,
    name: targetProfile.name,
    phone: targetProfile.phone,
    start_year: targetProfile.start_year,
    rating: targetProfile.rating,
    gender: targetProfile.gender || null,
    role: 'MEMBER',
    status: 'INVITED',
    invited_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { error: '이미 해당 클럽에 등록된 사용자입니다.' }
    return { error: '회원 초대에 실패했습니다.' }
  }

  revalidatePath(`/admin/clubs/${clubId}`)
  return {}
}

/** 초대 수락/거절 (초대받은 본인) */
export async function respondInvitation(
  memberId: string,
  accept: boolean
): Promise<{ error?: string }> {
  const idError = validateId(memberId, '회원 ID')
  if (idError) return { error: idError }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 초대 확인 (본인 + INVITED 상태)
  const { data: member } = await admin
    .from('club_members')
    .select('id, club_id, user_id, status')
    .eq('id', memberId)
    .single()

  if (!member) return { error: '초대 정보를 찾을 수 없습니다.' }
  if (member.user_id !== user.id) return { error: '본인의 초대만 응답할 수 있습니다.' }
  if (member.status !== 'INVITED') return { error: '대기 중인 초대가 아닙니다.' }

  if (accept) {
    // 기존 ACTIVE 멤버십 유무 확인 (대표 클럽 자동 지정용)
    const { count: activeCount } = await admin
      .from('club_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')

    const isFirstClub = (activeCount ?? 0) === 0

    const { error } = await admin
      .from('club_members')
      .update({
        status: 'ACTIVE',
        is_primary: isFirstClub,
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)

    if (error) return { error: '초대 수락에 실패했습니다.' }

    // 첫 클럽이면 profiles.club 레거시 필드 동기화
    if (isFirstClub) {
      const { data: club } = await admin
        .from('clubs')
        .select('name, city, district')
        .eq('id', member.club_id)
        .single()

      if (club) {
        await admin
          .from('profiles')
          .update({
            club: club.name,
            club_city: club.city,
            club_district: club.district,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
      }
    }
  } else {
    // 거절 시 레코드 삭제
    await admin.from('club_members').delete().eq('id', memberId)
  }

  revalidatePath('/my/profile')
  return {}
}

/** 가입 신청 승인/거절 (owner/admin — APPROVAL 모드) */
export async function respondJoinRequest(
  memberId: string,
  approve: boolean
): Promise<{ error?: string }> {
  const idError = validateId(memberId, '회원 ID')
  if (idError) return { error: idError }

  const admin = createAdminClient()

  // 신청 정보 조회
  const { data: member } = await admin
    .from('club_members')
    .select('id, club_id, user_id, status')
    .eq('id', memberId)
    .single()

  if (!member) return { error: '가입 신청을 찾을 수 없습니다.' }
  if (member.status !== 'PENDING') return { error: '대기 중인 신청이 아닙니다.' }

  const { error: authError } = await checkClubOwnerAuth(member.club_id)
  if (authError) return { error: authError }

  if (approve) {
    // 기존 ACTIVE 멤버십 유무 확인 (대표 클럽 자동 지정용)
    let isFirstClub = false
    if (member.user_id) {
      const { count: activeCount } = await admin
        .from('club_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', member.user_id)
        .eq('status', 'ACTIVE')
      isFirstClub = (activeCount ?? 0) === 0
    }

    const { error } = await admin
      .from('club_members')
      .update({
        status: 'ACTIVE',
        is_primary: isFirstClub,
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)

    if (error) return { error: '승인 처리에 실패했습니다.' }

    // 첫 클럽이면 profiles.club 레거시 필드 동기화
    if (isFirstClub && member.user_id) {
      const { data: club } = await admin
        .from('clubs')
        .select('name, city, district')
        .eq('id', member.club_id)
        .single()

      if (club) {
        await admin
          .from('profiles')
          .update({
            club: club.name,
            club_city: club.city,
            club_district: club.district,
            updated_at: new Date().toISOString(),
          })
          .eq('id', member.user_id)
      }
    }
  } else {
    // 거절 시 레코드 삭제
    await admin.from('club_members').delete().eq('id', memberId)
  }

  revalidatePath(`/admin/clubs/${member.club_id}`)
  return {}
}

/** 회원 역할 변경 (OWNER만 가능) */
export async function updateMemberRole(
  memberId: string,
  newRole: ClubMemberRole
): Promise<{ error?: string }> {
  const idError = validateId(memberId, '회원 ID')
  if (idError) return { error: idError }

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('club_members')
    .select('id, club_id, role, status')
    .eq('id', memberId)
    .single()

  if (!member) return { error: '회원을 찾을 수 없습니다.' }
  if (member.status !== 'ACTIVE') return { error: '활성 회원만 역할을 변경할 수 있습니다.' }
  if (member.role === 'OWNER') return { error: '소유자의 역할은 변경할 수 없습니다.' }

  const { error: authError, clubRole } = await checkClubOwnerAuth(member.club_id)
  if (authError) return { error: authError }

  // OWNER만 역할 변경 가능
  if (clubRole !== 'OWNER') return { error: '클럽 소유자만 역할을 변경할 수 있습니다.' }
  if (newRole === 'OWNER') return { error: '소유자 역할로 변경할 수 없습니다.' }

  const { error } = await admin
    .from('club_members')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', memberId)

  if (error) return { error: '역할 변경에 실패했습니다.' }

  revalidatePath(`/admin/clubs/${member.club_id}`)
  return {}
}

/** 회원 제거 (owner/admin — 사유 필수) */
export async function removeMember(memberId: string, reason: string): Promise<{ error?: string }> {
  const idError = validateId(memberId, '회원 ID')
  if (idError) return { error: idError }

  if (!reason?.trim()) return { error: '제거 사유를 입력해주세요.' }

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('club_members')
    .select('id, club_id, role, user_id, is_primary')
    .eq('id', memberId)
    .single()

  if (!member) return { error: '회원을 찾을 수 없습니다.' }
  if (member.role === 'OWNER') return { error: '클럽 소유자는 제거할 수 없습니다.' }

  const { error: authError } = await checkClubOwnerAuth(member.club_id)
  if (authError) return { error: authError }

  const { error } = await admin
    .from('club_members')
    .update({
      status: 'REMOVED',
      is_primary: false,
      status_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)

  if (error) return { error: '회원 제거에 실패했습니다.' }

  // 가입 회원인 경우 대표 클럽 재지정
  if (member.user_id && member.is_primary) {
    await reassignPrimaryClub(admin, member.user_id)
  }

  revalidatePath(`/admin/clubs/${member.club_id}`)
  return {}
}

/** 제거/탈퇴 회원 원복 (owner/admin) */
export async function restoreMember(memberId: string): Promise<{ error?: string }> {
  const idError = validateId(memberId, '회원 ID')
  if (idError) return { error: idError }

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('club_members')
    .select('id, club_id, user_id, status')
    .eq('id', memberId)
    .single()

  if (!member) return { error: '회원을 찾을 수 없습니다.' }
  if (member.status !== 'REMOVED' && member.status !== 'LEFT') {
    return { error: '제거/탈퇴 상태의 회원만 원복할 수 있습니다.' }
  }

  const { error: authError } = await checkClubOwnerAuth(member.club_id)
  if (authError) return { error: authError }

  // 가입 회원인 경우 기존 ACTIVE 멤버십 유무 확인 (대표 클럽 자동 지정용)
  let shouldBePrimary = false
  if (member.user_id) {
    const { count: activeCount } = await admin
      .from('club_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', member.user_id)
      .eq('status', 'ACTIVE')
    shouldBePrimary = (activeCount ?? 0) === 0
  }

  const { error } = await admin
    .from('club_members')
    .update({
      status: 'ACTIVE',
      is_primary: shouldBePrimary,
      status_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)

  if (error) return { error: '회원 원복에 실패했습니다.' }

  // 첫 클럽이면 profiles.club 레거시 필드 동기화
  if (shouldBePrimary && member.user_id) {
    const { data: club } = await admin
      .from('clubs')
      .select('name, city, district')
      .eq('id', member.club_id)
      .single()

    if (club) {
      await admin
        .from('profiles')
        .update({
          club: club.name,
          club_city: club.city,
          club_district: club.district,
          updated_at: new Date().toISOString(),
        })
        .eq('id', member.user_id)
    }
  }

  revalidatePath(`/admin/clubs/${member.club_id}`)
  return {}
}

/** 자발적 탈퇴 (본인) */
export async function leaveClub(clubId: string): Promise<{ error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { error: idError }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  const { data: member } = await admin
    .from('club_members')
    .select('id, role, is_primary')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member) return { error: '해당 클럽의 회원이 아닙니다.' }
  if (member.role === 'OWNER') return { error: '클럽 소유자는 탈퇴할 수 없습니다. 클럽을 삭제하거나 소유권을 이전해주세요.' }

  const wasPrimary = member.is_primary

  const { error } = await admin
    .from('club_members')
    .update({
      status: 'LEFT',
      is_primary: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', member.id)

  if (error) return { error: '탈퇴 처리에 실패했습니다.' }

  // 대표 클럽이었으면 남은 클럽 중 자동 재지정
  if (wasPrimary) {
    await reassignPrimaryClub(admin, user.id)
  }

  revalidatePath('/my/profile')
  revalidatePath(`/clubs/${clubId}`)
  return {}
}

/** 사용자 검색 (회원 초대용) */
export async function searchUsersForInvite(
  clubId: string,
  query: string
): Promise<{ data: Array<{ id: string; name: string; email: string }>; error?: string }> {
  if (!query || query.trim().length < 2) {
    return { data: [], error: '검색어를 2글자 이상 입력해주세요.' }
  }

  const { error: authError } = await checkClubOwnerAuth(clubId)
  if (authError) return { data: [], error: authError }

  const admin = createAdminClient()
  const searchTerm = `%${query.trim()}%`

  // 이미 클럽에 등록된 사용자 ID 제외
  const { data: existingMembers } = await admin
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId)
    .not('user_id', 'is', null)

  const excludeIds = existingMembers?.map((m) => m.user_id).filter(Boolean) || []

  let profileQuery = admin
    .from('profiles')
    .select('id, name, email')
    .or(`name.ilike.${searchTerm},email.ilike.${searchTerm}`)
    .limit(20)

  if (excludeIds.length > 0) {
    profileQuery = profileQuery.not('id', 'in', `(${excludeIds.join(',')})`)
  }

  const { data, error } = await profileQuery
  if (error) return { data: [], error: '사용자 검색에 실패했습니다.' }
  return { data: data || [] }
}

/** 클럽 공개 회원 목록 (이름, 역할만 — 상세 페이지용) */
export async function getClubPublicMembers(
  clubId: string
): Promise<{ data: Array<{ id: string; name: string; role: ClubMemberRole; is_registered: boolean }>; error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { data: [], error: idError }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('club_members')
    .select('id, name, role, is_registered')
    .eq('club_id', clubId)
    .eq('status', 'ACTIVE')
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  if (error) return { data: [], error: '회원 목록 조회에 실패했습니다.' }
  return { data: data || [] }
}

/** 사용자의 현재 클럽 멤버십 조회 (프로필용 — 하위 호환) */
export async function getMyClubMembership(): Promise<{
  data: { club: Club; membership: ClubMember } | null
  error?: string
}> {
  const result = await getMyClubMemberships()
  if (!result.data || result.data.length === 0) return { data: null }

  // 대표 클럽 우선, 없으면 첫 번째
  const primary = result.data.find((m) => m.membership.is_primary) || result.data[0]
  return { data: { club: primary.club, membership: primary.membership } }
}

/** 사용자의 모든 ACTIVE 클럽 멤버십 조회 (다중 클럽용) */
export async function getMyClubMemberships(): Promise<{
  data: Array<{ club: Club; membership: ClubMember }>
  error?: string
}> {
  const user = await getCurrentUser()
  if (!user) return { data: [] }

  const admin = createAdminClient()

  // 모든 ACTIVE 멤버십 조회
  const { data: members } = await admin
    .from('club_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .order('is_primary', { ascending: false }) // 대표 클럽 먼저
    .order('joined_at', { ascending: true, nullsFirst: false })

  if (!members || members.length === 0) return { data: [] }

  // 클럽 정보 일괄 조회
  const clubIds = members.map((m) => m.club_id)
  const { data: clubs } = await admin
    .from('clubs')
    .select(`*, associations:association_id (name)`)
    .in('id', clubIds)

  if (!clubs) return { data: [] }

  const clubMap = new Map(clubs.map((c) => [c.id, c as Club]))

  return {
    data: members
      .map((m) => {
        const club = clubMap.get(m.club_id)
        if (!club) return null
        return { club, membership: m as ClubMember }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null),
  }
}

/** 대표 클럽 지정 */
export async function setPrimaryClub(clubId: string): Promise<{ error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { error: idError }

  const user = await getCurrentUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const admin = createAdminClient()

  // 해당 클럽의 ACTIVE 멤버십 확인
  const { data: targetMember } = await admin
    .from('club_members')
    .select('id')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!targetMember) return { error: '해당 클럽의 활성 회원이 아닙니다.' }

  // 기존 대표 해제
  await admin
    .from('club_members')
    .update({ is_primary: false, updated_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .eq('is_primary', true)

  // 새 대표 지정
  const { error } = await admin
    .from('club_members')
    .update({ is_primary: true, updated_at: new Date().toISOString() })
    .eq('id', targetMember.id)

  if (error) return { error: '대표 클럽 지정에 실패했습니다.' }

  // profiles.club 레거시 필드 동기화
  const { data: club } = await admin
    .from('clubs')
    .select('name, city, district')
    .eq('id', clubId)
    .single()

  if (club) {
    await admin
      .from('profiles')
      .update({
        club: club.name,
        club_city: club.city,
        club_district: club.district,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
  }

  revalidatePath('/my/profile')
  return {}
}

/** 클럽 검색 (프로필에서 클럽 선택용 — INVITE_ONLY 제외) */
export async function searchClubsForJoin(
  query: string
): Promise<{ data: Array<{ id: string; name: string; city: string | null; district: string | null; join_type: ClubJoinType; association_name: string | null }>; error?: string }> {
  if (!query || query.trim().length < 1) return { data: [] }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('clubs')
    .select(`id, name, city, district, join_type, associations:association_id (name)`)
    .eq('is_active', true)
    .neq('join_type', 'INVITE_ONLY')
    .ilike('name', `%${query.trim()}%`)
    .limit(20)

  if (error) return { data: [], error: '클럽 검색에 실패했습니다.' }

  return {
    data: (data || []).map((c) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      district: c.district,
      join_type: c.join_type as ClubJoinType,
      association_name: (c.associations as unknown as { name: string } | null)?.name ?? null,
    })),
  }
}

/** 클럽 회원 수 조회 */
export async function getClubMemberCount(clubId: string): Promise<number> {
  const admin = createAdminClient()
  const { count } = await admin
    .from('club_members')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId)
    .eq('status', 'ACTIVE')

  return count || 0
}
