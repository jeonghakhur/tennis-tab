'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser } from '@/lib/auth/actions'
import { hasMinimumRole } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'
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

// ============================================================================
// 클럽 CRUD
// ============================================================================

/** 클럽 생성 (MANAGER — 협회 소속이면 해당 협회 아래, 미소속이면 독립 클럽) */
export async function createClub(data: CreateClubInput): Promise<{ error?: string }> {
  const { error: authError, user } = await checkManagerAuth()
  if (authError || !user) return { error: authError || '로그인이 필요합니다.' }

  if (!data.name?.trim()) return { error: '클럽 이름을 입력해주세요.' }

  const admin = createAdminClient()

  // 협회 소속 매니저인지 확인
  const { data: managerAssoc } = await admin
    .from('association_managers')
    .select('association_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const associationId = managerAssoc?.association_id ?? null

  // 클럽 생성
  const { data: club, error } = await admin
    .from('clubs')
    .insert({
      name: data.name.trim(),
      description: data.description?.trim() || null,
      city: data.city?.trim() || null,
      district: data.district?.trim() || null,
      address: data.address?.trim() || null,
      contact_phone: data.contact_phone?.trim() || null,
      contact_email: data.contact_email?.trim() || null,
      join_type: data.join_type || 'APPROVAL',
      max_members: data.max_members || null,
      association_id: associationId,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !club) return { error: '클럽 생성에 실패했습니다.' }

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
  })

  revalidatePath('/admin/clubs')
  return {}
}

/** 클럽 수정 (owner/admin) */
export async function updateClub(clubId: string, data: UpdateClubInput): Promise<{ error?: string }> {
  const idError = validateId(clubId, '클럽 ID')
  if (idError) return { error: idError }

  const { error: authError } = await checkClubOwnerAuth(clubId)
  if (authError) return { error: authError }

  const admin = createAdminClient()
  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (data.name !== undefined) updateData.name = data.name.trim()
  if (data.description !== undefined) updateData.description = data.description?.trim() || null
  if (data.city !== undefined) updateData.city = data.city?.trim() || null
  if (data.district !== undefined) updateData.district = data.district?.trim() || null
  if (data.address !== undefined) updateData.address = data.address?.trim() || null
  if (data.contact_phone !== undefined) updateData.contact_phone = data.contact_phone?.trim() || null
  if (data.contact_email !== undefined) updateData.contact_email = data.contact_email?.trim() || null
  if (data.join_type !== undefined) updateData.join_type = data.join_type
  if (data.max_members !== undefined) updateData.max_members = data.max_members

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
    .in('status', ['ACTIVE', 'PENDING', 'INVITED'])
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

  if (!data.name?.trim()) return { error: '이름을 입력해주세요.' }

  // rating 범위 검증
  if (data.rating !== undefined && data.rating !== null) {
    if (data.rating < 1 || data.rating > 9999) {
      return { error: '레이팅은 1~9999 범위여야 합니다.' }
    }
  }

  const admin = createAdminClient()
  const { error } = await admin.from('club_members').insert({
    club_id: clubId,
    user_id: null,
    is_registered: false,
    name: data.name.trim(),
    birth_date: data.birth_date?.trim() || null,
    gender: data.gender || null,
    phone: data.phone?.trim() || null,
    start_year: data.start_year?.trim() || null,
    rating: data.rating || null,
    role: 'MEMBER',
    status: 'ACTIVE',
  })

  if (error) return { error: '회원 등록에 실패했습니다.' }

  revalidatePath(`/admin/clubs/${clubId}`)
  return {}
}

/** 가입 회원 클럽 가입 (프로필에서 클럽 선택 → profiles 데이터로 자동 채움) */
export async function joinClubAsRegistered(clubId: string): Promise<{ error?: string }> {
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
  })

  if (error) {
    if (error.code === '23505') return { error: '이미 가입된 클럽입니다.' }
    return { error: '클럽 가입에 실패했습니다.' }
  }

  // profiles.club 등 하위 호환 필드 업데이트 (OPEN 방식으로 즉시 가입된 경우만)
  if (status === 'ACTIVE') {
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
    const { error } = await admin
      .from('club_members')
      .update({
        status: 'ACTIVE',
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)

    if (error) return { error: '초대 수락에 실패했습니다.' }

    // profiles.club 하위 호환 업데이트
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
    const { error } = await admin
      .from('club_members')
      .update({
        status: 'ACTIVE',
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)

    if (error) return { error: '승인 처리에 실패했습니다.' }

    // profiles.club 하위 호환 업데이트
    if (member.user_id) {
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
    .select('id, club_id, role, user_id')
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
      status_reason: reason.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId)

  if (error) return { error: '회원 제거에 실패했습니다.' }

  // 가입 회원인 경우 profiles.club 초기화
  if (member.user_id) {
    await admin
      .from('profiles')
      .update({
        club: null,
        club_city: null,
        club_district: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', member.user_id)
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
    .select('id, role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .single()

  if (!member) return { error: '해당 클럽의 회원이 아닙니다.' }
  if (member.role === 'OWNER') return { error: '클럽 소유자는 탈퇴할 수 없습니다. 클럽을 삭제하거나 소유권을 이전해주세요.' }

  const { error } = await admin
    .from('club_members')
    .update({
      status: 'LEFT',
      updated_at: new Date().toISOString(),
    })
    .eq('id', member.id)

  if (error) return { error: '탈퇴 처리에 실패했습니다.' }

  // profiles.club 초기화
  await admin
    .from('profiles')
    .update({
      club: null,
      club_city: null,
      club_district: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

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

/** 사용자의 현재 클럽 멤버십 조회 (프로필용) */
export async function getMyClubMembership(): Promise<{
  data: { club: Club; membership: ClubMember } | null
  error?: string
}> {
  const user = await getCurrentUser()
  if (!user) return { data: null }

  const admin = createAdminClient()

  // ACTIVE 상태인 클럽 멤버십 조회 (1개만)
  const { data: member } = await admin
    .from('club_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'ACTIVE')
    .limit(1)
    .maybeSingle()

  if (!member) return { data: null }

  // 해당 클럽 정보 조회
  const { data: club } = await admin
    .from('clubs')
    .select(`*, associations:association_id (name)`)
    .eq('id', member.club_id)
    .single()

  if (!club) return { data: null }

  return { data: { club: club as Club, membership: member as ClubMember } }
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
