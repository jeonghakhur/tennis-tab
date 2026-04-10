import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { createNotification } from '@/lib/notifications/actions'
import { NotificationType } from '@/lib/notifications/types'
import { encryptProfile } from '@/lib/crypto/profileCrypto'
import { unformatPhoneNumber } from '@/lib/utils/phone'

/**
 * 네이버 OAuth 콜백 핸들러
 * 네이버에서 인증 코드를 받아 토큰으로 교환하고 사용자 정보를 가져옴
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  // state에서 redirect 정보 추출
  let redirectTo = '/'
  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      redirectTo = stateData.redirect || '/'
    } catch {
      // state 파싱 실패 시 기본값 사용
    }
  }

  // 에러 처리
  if (error || !code) {
    console.error('Naver OAuth Error:', error)
    return NextResponse.redirect(
      new URL('/auth/error?provider=naver', request.url)
    )
  }

  try {
    // 1. Access Token 받기
    const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token')
    tokenUrl.searchParams.append('grant_type', 'authorization_code')
    tokenUrl.searchParams.append('client_id', process.env.NAVER_CLIENT_ID!)
    tokenUrl.searchParams.append(
      'client_secret',
      process.env.NAVER_CLIENT_SECRET!
    )
    tokenUrl.searchParams.append('code', code)
    tokenUrl.searchParams.append('state', state!)

    const tokenResponse = await fetch(tokenUrl.toString())
    const tokenData = await tokenResponse.json()

    if (tokenData.error) {
      throw new Error(tokenData.error_description)
    }

    const accessToken = tokenData.access_token

    // 2. 사용자 정보 가져오기
    const userResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })
    const userData = await userResponse.json()

    if (userData.resultcode !== '00') {
      throw new Error(userData.message)
    }

    const naverProfile = userData.response
    const email = naverProfile.email
    const name = naverProfile.name || naverProfile.nickname
    const avatarUrl = naverProfile.profile_image
    // 네이버 추가 프로필 정보 (profiles.gender CHECK: 'MALE' | 'FEMALE')
    const gender: string | undefined = naverProfile.gender === 'M' ? 'MALE'
      : naverProfile.gender === 'F' ? 'FEMALE'
      : undefined
    const birthYear: string | undefined = naverProfile.birthyear || undefined
    // 공용 유틸로 정규화 (하이픈/공백/점 등 비숫자 전부 제거)
    const phone: string | undefined = naverProfile.mobile
      ? unformatPhoneNumber(naverProfile.mobile) || undefined
      : undefined

    if (!email) {
      throw new Error('이메일 정보를 가져올 수 없습니다.')
    }

    // 민감 필드 암호화 — profiles.phone/birth_year는 암호화 저장 필수
    // (gender는 'MALE'/'FEMALE' 두 값뿐이라 profileCrypto 정책상 암호화 제외)
    const encryptedSensitive = encryptProfile({
      phone,
      birth_year: birthYear,
    })

    // 3. Supabase Service Role 클라이언트 생성
    const { createClient: createServiceClient } = await import(
      '@supabase/supabase-js'
    )
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // 4. 기존 사용자 확인 (profiles 테이블에서 이메일로 조회)
    const { data: existingProfile } = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    let userId: string

    if (existingProfile) {
      userId = existingProfile.id
    } else {
      // 신규 사용자 생성 (트리거가 profiles 행을 자동 생성)
      // 주의: handle_new_user 트리거는 email/name/avatar_url/role만 profiles에 복사하므로
      //       phone/birth_year는 아래 explicit UPDATE에서 암호화된 값으로 확정된다.
      //       user_metadata에는 평문을 저장하지 않기 위해 phone/birth_year 제외.
      const { data: newUser, error: createError } =
        await serviceSupabase.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            name,
            avatar_url: avatarUrl,
            gender,
            provider: 'naver',
          },
        })

      if (createError || !newUser.user) {
        throw createError || new Error('사용자 생성 실패')
      }

      userId = newUser.user.id

      // 신규 회원 가입 → SUPER_ADMIN에게 앱 내 알림 (fire-and-forget)
      try {
        const { data: superAdmins } = await serviceSupabase
          .from('profiles')
          .select('id')
          .eq('role', 'SUPER_ADMIN')
        if (superAdmins && superAdmins.length > 0) {
          await Promise.all(superAdmins.map((admin) =>
            createNotification({
              user_id: admin.id,
              type: NotificationType.NEW_MEMBER_JOINED,
              title: '신규 회원 가입',
              message: `${name || email}님이 새로 가입했습니다.`,
              metadata: { link: `/admin/users/${userId}`, newUserId: userId },
            })
          ))
        }
      } catch { /* 알림 실패가 로그인을 막지 않음 */ }
    }

    // 신규/기존 모두: 네이버 프로필 정보로 명시적 업데이트
    // 민감 필드(phone, birth_year)는 암호화된 값으로 저장
    const updateData: Record<string, string> = {
      updated_at: new Date().toISOString(),
    }
    if (name) updateData.name = name
    if (avatarUrl) updateData.avatar_url = avatarUrl
    if (gender) updateData.gender = gender
    if (encryptedSensitive.birth_year) updateData.birth_year = encryptedSensitive.birth_year
    if (encryptedSensitive.phone) updateData.phone = encryptedSensitive.phone

    await serviceSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', userId)

    // 5. 세션 생성 (매직 링크 방식)
    const { data: linkData, error: linkError } =
      await serviceSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email,
      })

    if (linkError || !linkData) {
      throw linkError || new Error('로그인 링크 생성 실패')
    }

    // 6. 매직 링크에서 토큰 추출하여 세션 설정
    const actionLink = linkData.properties.action_link
    const url = new URL(actionLink)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type')

    if (token && type === 'magiclink') {
      // 클라이언트용 Supabase로 세션 설정
      const supabase = await createClient()
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: token,
        type: 'magiclink',
      })

      if (verifyError) {
        console.error('Verify error:', verifyError)
      }
    }

    // 7. 원래 페이지로 리다이렉트
    return NextResponse.redirect(new URL(redirectTo, request.url))
  } catch (error) {
    console.error('Naver OAuth Callback Error:', error)
    return NextResponse.redirect(
      new URL(
        `/auth/error?provider=naver&error=${encodeURIComponent(
          error instanceof Error ? error.message : 'Unknown error'
        )}`,
        request.url
      )
    )
  }
}
