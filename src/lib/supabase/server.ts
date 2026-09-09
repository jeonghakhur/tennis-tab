import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getCachedJwks } from './jwks'

/**
 * 서버 컴포넌트 및 Server Actions에서 사용하는 Supabase 클라이언트
 * 쿠키를 통해 사용자 세션을 관리합니다.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서는 쿠키 설정 불가
            // Middleware나 Server Action에서만 가능
          }
        },
      },
    }
  )
}

/** JWT 클레임에서 추출한 최소 사용자 정보 */
export interface VerifiedUser {
  id: string
  email: string | null
}

/**
 * 쿠키 세션의 JWT를 로컬(JWKS)에서 검증해 사용자 ID를 반환합니다.
 *
 * `auth.getUser()`는 매 호출마다 Auth 서버(원격 리전)와 왕복하지만,
 * `auth.getClaims()`는 캐시된 JWKS로 서명을 로컬 검증하므로 네트워크 왕복이 없습니다.
 * (세션 만료 시에만 refresh 네트워크 호출 발생, HS256 서명 프로젝트는 자동으로 getUser fallback)
 *
 * timeoutMs 초과 또는 네트워크 오류 시 null(미인증)로 처리합니다.
 */
export async function getVerifiedUser(
  client: Awaited<ReturnType<typeof createClient>> | import('@supabase/supabase-js').SupabaseClient,
  timeoutMs = 5000,
): Promise<VerifiedUser | null> {
  const verify = async (): Promise<VerifiedUser | null> => {
    const jwks = await getCachedJwks()
    const { data, error } = await client.auth.getClaims(undefined, jwks ? { jwks } : undefined)
    if (error || !data?.claims?.sub) return null
    const email = typeof data.claims.email === 'string' ? data.claims.email : null
    return { id: data.claims.sub, email }
  }

  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })
  try {
    return await Promise.race([verify().catch(() => null), timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * getUser()를 타임아웃과 함께 실행합니다.
 * AbortError를 방지하기 위해 명시적으로 abort reason을 지정합니다.
 */
export async function getUserWithTimeout(client: Awaited<ReturnType<typeof createClient>>, timeoutMs = 3000) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort('auth_timeout'), timeoutMs)

  try {
    return await client.auth.getUser()
  } catch (error) {
    // 타임아웃 또는 네트워크 오류
    return { data: { user: null }, error }
  } finally {
    clearTimeout(timeoutId)
  }
}
