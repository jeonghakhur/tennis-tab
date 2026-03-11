import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * 모바일 앱용 네이버 OAuth 엔드포인트
 * POST { code } → 네이버 토큰 교환 → Supabase 세션 생성 → { access_token, refresh_token } 반환
 */
export async function POST(request: NextRequest) {
  const { code } = await request.json()

  if (!code) {
    return NextResponse.json(
      { error: 'Authorization code is required' },
      { status: 400 }
    )
  }

  try {
    // 1. 네이버 Access Token 받기
    const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token')
    tokenUrl.searchParams.append('grant_type', 'authorization_code')
    tokenUrl.searchParams.append('client_id', process.env.NAVER_CLIENT_ID!)
    tokenUrl.searchParams.append(
      'client_secret',
      process.env.NAVER_CLIENT_SECRET!
    )
    tokenUrl.searchParams.append('code', code)
    tokenUrl.searchParams.append('state', 'mobile')

    const tokenResponse = await fetch(tokenUrl.toString())
    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      throw new Error(tokenData.error_description || '네이버 토큰 교환 실패')
    }

    const accessToken = tokenData.access_token

    // 2. 네이버 사용자 정보 가져오기
    const userResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const userData = await userResponse.json()

    if (userData.resultcode !== '00') {
      throw new Error(userData.message || '네이버 프로필 조회 실패')
    }

    const naverProfile = userData.response
    const email = naverProfile.email
    const name = naverProfile.name || naverProfile.nickname
    const avatarUrl = naverProfile.profile_image
    const gender: string | undefined =
      naverProfile.gender === 'M' || naverProfile.gender === 'F'
        ? naverProfile.gender
        : undefined
    const birthYear: string | undefined = naverProfile.birthyear || undefined
    const phone: string | undefined = naverProfile.mobile
      ? naverProfile.mobile.replace(/[^0-9]/g, '')
      : undefined

    if (!email) {
      throw new Error('이메일 정보를 가져올 수 없습니다.')
    }

    // 3. Supabase Service Role 클라이언트
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // 4. 기존 사용자 확인
    const { data: existingProfile } = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    let userId: string

    if (existingProfile) {
      userId = existingProfile.id
    } else {
      // 신규 사용자 생성
      const { data: newUser, error: createError } =
        await serviceSupabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            name,
            avatar_url: avatarUrl,
            gender,
            birth_year: birthYear,
            phone,
            provider: 'naver',
          },
        })

      if (createError || !newUser.user) {
        throw createError || new Error('사용자 생성 실패')
      }

      userId = newUser.user.id
    }

    // 프로필 업데이트
    const updateData: Record<string, string> = {
      updated_at: new Date().toISOString(),
    }
    if (name) updateData.name = name
    if (avatarUrl) updateData.avatar_url = avatarUrl
    if (gender) updateData.gender = gender
    if (birthYear) updateData.birth_year = birthYear
    if (phone) updateData.phone = phone

    await serviceSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    // 5. 매직 링크 생성 → 토큰 추출
    const { data: linkData, error: linkError } =
      await serviceSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })

    if (linkError || !linkData) {
      throw linkError || new Error('로그인 링크 생성 실패')
    }

    const actionLink = linkData.properties.action_link
    const url = new URL(actionLink)
    const tokenHash = url.searchParams.get('token')

    if (!tokenHash) {
      throw new Error('토큰 추출 실패')
    }

    // 6. OTP 검증으로 세션 토큰 획득
    const anonSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: verifyData, error: verifyError } =
      await anonSupabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      })

    if (verifyError || !verifyData.session) {
      throw verifyError || new Error('세션 생성 실패')
    }

    // 7. 세션 토큰 반환
    return NextResponse.json({
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token,
      user: verifyData.session.user,
    })
  } catch (error) {
    console.error('Naver Mobile Auth Error:', error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : '네이버 로그인 실패',
      },
      { status: 500 }
    )
  }
}
