'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sanitizeInput, validateEmail, validateMinLength } from '@/lib/utils/validation'

// Supabase 에러 메시지 → 한국어 변환
function translateAuthError(message: string): string {
  if (message.includes('already') && message.includes('registered')) {
    return '이미 가입된 이메일입니다.'
  }
  if (message.includes('Invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.'
  }
  if (message.includes('Email not confirmed')) {
    return '이메일 인증이 완료되지 않았습니다. 이메일을 확인해주세요.'
  }
  if (message.includes('Password should be at least')) {
    return '비밀번호는 최소 6자 이상이어야 합니다.'
  }
  if (message.includes('Email rate limit exceeded')) {
    return '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
  return message
}

/**
 * 이메일 회원가입
 */
export async function signUpWithEmail(email: string, password: string, name: string) {
  const sanitizedEmail = sanitizeInput(email)
  const sanitizedName = sanitizeInput(name)

  // 검증
  const nameErr = validateMinLength(sanitizedName, 2, '이름')
  if (nameErr) return { error: nameErr }

  const emailErr = validateEmail(sanitizedEmail, '이메일')
  if (emailErr) return { error: emailErr }
  if (!sanitizedEmail) return { error: '이메일을 입력해주세요.' }

  const pwErr = validateMinLength(password, 6, '비밀번호')
  if (pwErr) return { error: pwErr }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: sanitizedEmail,
    password,
    options: {
      data: { name: sanitizedName },
    },
  })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  // Supabase는 이메일 열거 공격 방지를 위해 중복 이메일에도 200을 반환.
  // identities가 빈 배열이면 이미 등록된 이메일 (user_repeated_signup)
  if (data.user && data.user.identities?.length === 0) {
    return { error: '이미 가입된 이메일입니다.' }
  }

  return { success: true, message: '인증 이메일을 발송했습니다. 이메일을 확인해주세요.' }
}

/**
 * 이메일 로그인
 */
export async function signInWithEmail(email: string, password: string) {
  const sanitizedEmail = sanitizeInput(email)

  const emailErr = validateEmail(sanitizedEmail, '이메일')
  if (emailErr) return { error: emailErr }
  if (!sanitizedEmail) return { error: '이메일을 입력해주세요.' }

  if (!password) return { error: '비밀번호를 입력해주세요.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: sanitizedEmail,
    password,
  })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * 비밀번호 재설정 이메일 발송
 */
export async function resetPassword(email: string) {
  const sanitizedEmail = sanitizeInput(email)

  const emailErr = validateEmail(sanitizedEmail, '이메일')
  if (emailErr) return { error: emailErr }
  if (!sanitizedEmail) return { error: '이메일을 입력해주세요.' }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail, {
    redirectTo: `${origin}/auth/reset-password`,
  })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  return { success: true, message: '비밀번호 재설정 이메일을 발송했습니다.' }
}

/**
 * 비밀번호 변경 (재설정 링크 클릭 후)
 */
export async function updatePassword(newPassword: string) {
  const pwErr = validateMinLength(newPassword, 6, '새 비밀번호')
  if (pwErr) return { error: pwErr }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: newPassword })

  if (error) {
    return { error: translateAuthError(error.message) }
  }

  return { success: true }
}

/**
 * 소셜 로그인 (구글, 카카오, 네이버)
 */
export async function signInWithOAuth(provider: 'google' | 'kakao' | 'naver', redirectTo?: string) {
  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  const callbackUrl = redirectTo
    ? `${origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`
    : `${origin}/auth/callback`

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as any,
    options: {
      redirectTo: callbackUrl,
    },
  })

  if (error) {
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}

/**
 * 로그아웃
 */
export async function signOut() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * 회원 탈퇴
 * - 대회 주최, 협회 생성, 클럽 생성 이력이 있으면 차단
 * - RESTRICT FK 사전 정리 후 auth.users 삭제 → profiles CASCADE 삭제
 */
export async function deleteAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const adminClient = createAdminClient()

  // 차단 조건 확인: NOT NULL FK로 삭제 불가능한 소유 항목
  const [tournaments, associations, clubs] = await Promise.all([
    adminClient.from('tournaments').select('id', { count: 'exact', head: true }).eq('organizer_id', user.id),
    adminClient.from('associations').select('id', { count: 'exact', head: true }).eq('created_by', user.id),
    adminClient.from('clubs').select('id', { count: 'exact', head: true }).eq('created_by', user.id),
  ])

  const blockers: string[] = []
  if ((tournaments.count ?? 0) > 0) blockers.push('주최한 대회')
  if ((associations.count ?? 0) > 0) blockers.push('생성한 협회')
  if ((clubs.count ?? 0) > 0) blockers.push('생성한 클럽')

  if (blockers.length > 0) {
    return { error: `${blockers.join(', ')}이(가) 있어 탈퇴할 수 없습니다.\n해당 항목을 먼저 삭제하거나 양도해주세요.` }
  }

  // RESTRICT FK 사전 정리 (admin client로 RLS 우회)
  await adminClient.from('association_admins').delete().eq('assigned_by', user.id)
  await adminClient.from('club_members').update({ invited_by: null }).eq('invited_by', user.id)

  // auth.users 삭제 → profiles CASCADE → 나머지 자동 처리
  const { error } = await adminClient.auth.admin.deleteUser(user.id)
  if (error) return { error: '회원 탈퇴 처리 중 오류가 발생했습니다.' }

  revalidatePath('/', 'layout')
  return { success: true }
}

/**
 * 현재 로그인한 사용자 정보 가져오기
 */
export async function getCurrentUser() {
  const supabase = await createClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return null
  }

  // profiles 테이블에서 프로필 정보 가져오기
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

/**
 * 사용자 프로필 업데이트
 */
export async function updateProfile(data: {
  name?: string
  phone?: string
  start_year?: string
  rating?: number
  gender?: string
  birth_year?: string
}) {
  const supabase = await createClient()
  const profile = await getCurrentUser()

  if (!profile) {
    return { error: '로그인이 필요합니다.' }
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      ...data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', profile.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/my/profile')
  revalidatePath('/my/profile/edit')
  return { success: true }
}
