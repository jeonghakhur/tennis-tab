'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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
