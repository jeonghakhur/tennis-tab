import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 클라이언트 컴포넌트에서 사용하는 Supabase 클라이언트
 * @supabase/ssr의 createBrowserClient 사용 → PKCE verifier를 cookie에 저장
 * → 서버 callback의 exchangeCodeForSession과 호환
 */
let client: SupabaseClient | null = null

export function createClient() {
  if (client) return client

  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  return client
}
