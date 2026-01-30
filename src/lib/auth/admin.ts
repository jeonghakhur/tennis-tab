'use server'

import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/supabase/types'
import { isSuperAdmin } from './roles'
import { revalidatePath } from 'next/cache'

/**
 * 사용자 권한 변경 (SUPER_ADMIN만 가능)
 */
export async function changeUserRole(userId: string, newRole: UserRole) {
  const supabase = await createClient()

  // 현재 사용자 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 사용자 권한 확인
  const { data: currentUserProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isSuperAdmin(currentUserProfile?.role)) {
    return { error: 'SUPER_ADMIN 권한이 필요합니다.' }
  }

  // 대상 사용자 권한 확인
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  // SUPER_ADMIN은 다른 SUPER_ADMIN의 권한을 변경할 수 없음
  if (targetProfile?.role === 'SUPER_ADMIN' && userId !== user.id) {
    return { error: '다른 SUPER_ADMIN의 권한은 변경할 수 없습니다.' }
  }

  // 권한 변경
  const { error } = await supabase
    .from('profiles')
    .update({ role: newRole })
    .eq('id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/users')
  return { success: true }
}

/**
 * 모든 사용자 목록 조회 (ADMIN 이상)
 */
export async function getAllUsers() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile?.role || !['ADMIN', 'SUPER_ADMIN'].includes(profile.role)) {
    return { error: 'ADMIN 권한이 필요합니다.' }
  }

  const { data: users, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { users }
}

/**
 * 사용자 검색
 */
export async function searchUsers(query: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(10)

  if (error) {
    return { error: error.message }
  }

  return { users: data }
}
