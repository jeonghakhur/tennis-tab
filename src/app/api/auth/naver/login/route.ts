import { NextResponse } from 'next/server'

/**
 * 네이버 OAuth 로그인 시작
 * 사용자를 네이버 로그인 페이지로 리다이렉트
 */
export async function GET() {
  const clientId = process.env.NAVER_CLIENT_ID
  const redirectUri = encodeURIComponent(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/auth/naver/callback`
  )
  
  // CSRF 방지를 위한 state 생성
  const state = Math.random().toString(36).substring(2, 15)

  // 네이버 로그인 URL
  const naverAuthUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}`

  return NextResponse.redirect(naverAuthUrl)
}
