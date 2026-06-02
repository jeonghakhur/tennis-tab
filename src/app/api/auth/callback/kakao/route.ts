import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/lib/notifications/actions'
import { NotificationType } from '@/lib/notifications/types'
import { encryptProfile } from '@/lib/crypto/profileCrypto'
import { sendWelcomeAlimtalk } from '@/lib/solapi/alimtalk'

/**
 * 카카오 전화번호 정규화
 * "+82 10-1234-5678" → "01012345678"
 */
function normalizeKakaoPhone(phone: string): string | undefined {
  // +82로 시작하면 국가코드 제거 후 0 추가
  const normalized = phone.startsWith('+82')
    ? '0' + phone.slice(3).replace(/\D/g, '')
    : phone.replace(/\D/g, '')

  // 유효한 한국 휴대폰 번호인지 확인 (010/011/016/017/018/019)
  if (/^01[016789]\d{7,8}$/.test(normalized)) return normalized
  return undefined
}

/**
 * 카카오 OAuth 콜백 핸들러
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  let redirectTo = '/'
  if (state) {
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      redirectTo = stateData.redirect || '/'
    } catch { /* state 파싱 실패 시 기본값 */ }
  }

  if (error || !code) {
    console.error('Kakao OAuth Error:', error)
    return NextResponse.redirect(new URL('/auth/error?provider=kakao', request.url))
  }

  try {
    const clientId = process.env.KAKAO_REST_API_KEY!
    const clientSecret = process.env.KAKAO_CLIENT_SECRET // 선택사항
    const redirectUri = `${request.nextUrl.origin}/api/auth/callback/kakao`

    // 1. Access Token 발급
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
      ...(clientSecret ? { client_secret: clientSecret } : {}),
    })

    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenParams.toString(),
    })
    const tokenData = await tokenRes.json()

    if (tokenData.error) throw new Error(tokenData.error_description)

    // 2. 사용자 정보 조회
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    })
    const userData = await userRes.json()

    const account = userData.kakao_account ?? {}
    const email: string | undefined = account.email
    const name: string | undefined = account.name ?? account.profile?.nickname
    const avatarUrl: string | undefined = account.profile?.profile_image_url
    const phone: string | undefined = account.phone_number
      ? normalizeKakaoPhone(account.phone_number)
      : undefined

    if (!email) throw new Error('이메일 정보를 가져올 수 없습니다.')

    // 3. Supabase Service Role 클라이언트
    const { createClient: createServiceClient } = await import('@supabase/supabase-js')
    const serviceSupabase = createServiceClient(
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
      const { data: newUser, error: createError } = await serviceSupabase.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          name,
          avatar_url: avatarUrl,
          provider: 'kakao',
        },
      })

      if (createError || !newUser.user) throw createError || new Error('사용자 생성 실패')
      userId = newUser.user.id

      // SUPER_ADMIN 앱 내 알림 (fire-and-forget)
      try {
        const { data: superAdmins } = await serviceSupabase
          .from('profiles')
          .select('id')
          .eq('role', 'SUPER_ADMIN')
        if (superAdmins?.length) {
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

    // 5. 프로필 업데이트 (신규/기존 공통)
    const encryptedSensitive = encryptProfile({ phone })
    const updateData: Record<string, string> = { updated_at: new Date().toISOString() }
    if (name) updateData.name = name
    if (avatarUrl) updateData.avatar_url = avatarUrl
    if (encryptedSensitive.phone) updateData.phone = encryptedSensitive.phone

    await serviceSupabase.from('profiles').update(updateData).eq('id', userId)

    // 6. 신규 회원 + 전화번호 있을 때만 환영 알림톡 (fire-and-forget)
    if (!existingProfile && phone) {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://mapo-tennis.com'
      const isNameKorean = /^[가-힣]{2,4}$/.test(name || '')

      sendWelcomeAlimtalk({
        phone,
        name: name || '',
        missingFields: ['클럽', '출생년도', '성별'], // 카카오는 성별/생년 스코프 미포함
        isNameKorean,
        profileEditUrl: `${siteUrl}/my/profile/edit`,
      }).catch((err) => console.error('[Alimtalk] 회원가입 환영 발송 실패:', err))
    }

    // 7. 세션 생성 (매직 링크 방식 — Naver와 동일)
    const { data: linkData, error: linkError } = await serviceSupabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })
    if (linkError || !linkData) throw linkError || new Error('로그인 링크 생성 실패')

    const actionLink = linkData.properties.action_link
    const url = new URL(actionLink)
    const token = url.searchParams.get('token')
    const type = url.searchParams.get('type')

    if (token && type === 'magiclink') {
      const supabase = await createClient()
      await supabase.auth.verifyOtp({ token_hash: token, type: 'magiclink' })
    }

    return NextResponse.redirect(new URL(redirectTo, request.url))
  } catch (error) {
    console.error('Kakao OAuth Callback Error:', error)
    return NextResponse.redirect(
      new URL(
        `/auth/error?provider=kakao&error=${encodeURIComponent(
          error instanceof Error ? error.message : 'Unknown error'
        )}`,
        request.url
      )
    )
  }
}
