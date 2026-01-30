'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

/**
 * 네이버 OAuth 사용자 정보로 Supabase 세션 생성
 * Admin API를 사용하여 사용자를 생성하고 세션을 발급
 */
export async function createNaverSession(
  email: string,
  name: string,
  avatarUrl?: string
) {
  const supabase = await createClient()

  try {
    // 1. 기존 사용자 확인
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    let userId: string

    if (existingProfile) {
      // 기존 사용자
      userId = existingProfile.id

      // 프로필 정보 업데이트
      await supabase
        .from('profiles')
        .update({
          name,
          avatar_url: avatarUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
    } else {
      // 2. 신규 사용자 생성 (Service Role 사용)
      const serviceSupabase = await createClient()

      const { data: newUser, error: createError } =
        await serviceSupabase.auth.admin.createUser({
          email,
          email_confirm: true, // 이메일 인증 생략
          user_metadata: {
            name,
            avatar_url: avatarUrl,
            provider: 'naver',
          },
        })

      if (createError || !newUser.user) {
        throw createError
      }

      userId = newUser.user.id

      // profiles 테이블은 트리거로 자동 생성되지만
      // 혹시 모르니 확인 후 수동 생성
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single()

      if (!profile) {
        await supabase.from('profiles').insert({
          id: userId,
          email,
          name,
          avatar_url: avatarUrl,
          role: 'USER',
        })
      }
    }

    // 3. Access Token 생성 (Service Role 사용)
    const { data: sessionData, error: sessionError } =
      await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })

    if (sessionError || !sessionData) {
      throw sessionError
    }

    return {
      success: true,
      userId,
      redirectUrl: sessionData.properties.action_link,
    }
  } catch (error) {
    console.error('Create Naver Session Error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
