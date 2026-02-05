import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware에서 사용하는 Supabase 클라이언트
 * 인증 상태를 확인하고 쿠키를 업데이트합니다.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // 세션 갱신 (만료 체크)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 로그인이 필요한 페이지 보호
  const protectedPaths = ['/my', '/admin']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtectedPath && !user) {
    // 로그인 페이지로 리다이렉트
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  // 관리자 페이지 보호 (보안: 권한 없으면 404로 리다이렉트하여 페이지 존재 자체를 숨김)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      // 비로그인 사용자는 404로 리다이렉트 (페이지 존재 숨김)
      return NextResponse.rewrite(new URL('/not-found', request.url))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile?.role || !['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(profile.role)) {
      // 권한 없는 사용자는 404로 리다이렉트 (페이지 존재 숨김)
      return NextResponse.rewrite(new URL('/not-found', request.url))
    }
  }

  return supabaseResponse
}
