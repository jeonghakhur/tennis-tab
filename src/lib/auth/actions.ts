'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sanitizeInput, validateEmail, validateMinLength } from '@/lib/utils/validation'

// Supabase 에러 메시지 → 한국어 변환
function translateAuthError(message: string): string {
  if (message.includes('User already registered')) {
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
  const { error } = await supabase.auth.signUp({
    email: sanitizedEmail,
    password,
    options: {
      data: { name: sanitizedName },
    },
  })

  if (error) {
    return { error: translateAuthError(error.message) }
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
  club?: string
  club_city?: string
  club_district?: string
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
