import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

/**
 * getUser()를 타임아웃과 함께 실행합니다.
 * AbortError를 방지하기 위해 명시적으로 abort reason을 지정합니다.
 */
export async function getUserWithTimeout(client: ReturnType<typeof createClient> | Awaited<ReturnType<typeof createClient>>, timeoutMs = 3000) {
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
