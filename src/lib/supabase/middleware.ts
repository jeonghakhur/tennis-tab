import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware에서 사용하는 Supabase 클라이언트
 * 인증 상태를 확인하고 쿠키를 업데이트합니다.
 *
 * 주의: NextResponse.redirect/rewrite로 새 응답을 만들면 supabaseResponse에 설정된
 * 갱신 쿠키(refresh된 access_token 등)가 손실되어 다음 요청에서 만료된 토큰으로
 * 다시 시도하다 로그아웃 루프가 발생할 수 있다. 그래서 setAll 콜백에서 쿠키를
 * 별도로 추적하고, redirect/rewrite 응답에도 동일 쿠키를 복사한다.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // setAll에서 호출된 쿠키를 추적 — redirect/rewrite 응답에 복사용
  const refreshedCookies: { name: string; value: string; options: CookieOptions }[] = []

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
            refreshedCookies.push({ name, value, options })
          })
        },
      },
    }
  )

  // redirect/rewrite 응답에 갱신된 쿠키 복사 헬퍼
  const withRefreshedCookies = (res: NextResponse) => {
    refreshedCookies.forEach(({ name, value, options }) => {
      res.cookies.set(name, value, options)
    })
    return res
  }

  // 세션 갱신 (만료 체크)
  // 타임아웃 시 fallback으로 user=null 처리하지만, 보호 경로에서 redirect 대신
  // 그대로 통과시킴 — 일시적 네트워크 지연으로 정상 사용자가 로그아웃되지 않도록
  type AuthResult = { data: { user: { id: string } | null }; timedOut: boolean }
  const fallback: AuthResult = { data: { user: null }, timedOut: false }
  const authPromise: Promise<AuthResult> = supabase.auth
    .getUser()
    .then((r) => ({ data: { user: r.data.user }, timedOut: false }))
    .catch(() => fallback)
  const timeoutPromise = new Promise<AuthResult>((resolve) =>
    setTimeout(() => resolve({ data: { user: null }, timedOut: true }), 3000),
  )

  const result = await Promise.race([authPromise, timeoutPromise])
  const user = result.data.user
  const timedOut = result.timedOut

  // 로그인이 필요한 페이지 보호
  const protectedPaths = ['/my', '/admin']
  const isProtectedPath = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  // 타임아웃 시에는 보호 경로 검사를 건너뜀 — 페이지 단에서 다시 인증 시도
  if (isProtectedPath && !user && !timedOut) {
    // 로그인 페이지로 리다이렉트
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname)
    return withRefreshedCookies(NextResponse.redirect(redirectUrl))
  }

  // 관리자 페이지 보호 (보안: 권한 없으면 404로 리다이렉트하여 페이지 존재 자체를 숨김)
  if (request.nextUrl.pathname.startsWith('/admin')) {
    if (!user) {
      if (timedOut) {
        // 타임아웃 시엔 통과 — 페이지 단 권한 체크에 위임
        return supabaseResponse
      }
      // 비로그인 사용자는 404로 리다이렉트 (페이지 존재 숨김)
      return withRefreshedCookies(NextResponse.rewrite(new URL('/not-found', request.url)))
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const isAdmin = profile?.role && ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(profile.role)

    // /admin/lessons는 코치도 접근 가능 — 세부 권한은 layout에서 처리
    const isLessonsPath = request.nextUrl.pathname.startsWith('/admin/lessons')

    if (!isAdmin && !isLessonsPath) {
      // 권한 없는 사용자는 404로 리다이렉트 (페이지 존재 숨김)
      return withRefreshedCookies(NextResponse.rewrite(new URL('/not-found', request.url)))
    }
  }

  return supabaseResponse
}
