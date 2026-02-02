import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * 클라이언트 컴포넌트에서 사용하는 Supabase 클라이언트
 * 브라우저에서 실행되며, 사용자 인증 상태를 관리합니다.
 */
let client: SupabaseClient | null = null

export function createClient() {
  if (typeof window === 'undefined') {
    // SSR 환경에서는 매번 새 클라이언트 생성
    return createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  if (client) return client

  client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  )

  return client
}
