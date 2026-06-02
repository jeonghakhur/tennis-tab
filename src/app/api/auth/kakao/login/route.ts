import { NextRequest, NextResponse } from 'next/server'

/**
 * 카카오 OAuth 로그인 시작
 * 사용자를 카카오 로그인 페이지로 리다이렉트
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.KAKAO_REST_API_KEY
  const redirectTo = request.nextUrl.searchParams.get('redirect') || '/'
  const redirectUri = encodeURIComponent(
    `${request.nextUrl.origin}/api/auth/callback/kakao`
  )

  // CSRF 방지용 state에 redirect 정보 포함
  const stateData = JSON.stringify({ redirect: redirectTo, csrf: Math.random().toString(36).substring(2, 15) })
  const state = Buffer.from(stateData).toString('base64')

  // phone_number 스코프 포함 (카카오 비즈니스 앱 심사 완료 필요)
  const scope = encodeURIComponent('profile_nickname,account_email,phone_number')

  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}`

  return NextResponse.redirect(kakaoAuthUrl)
}
