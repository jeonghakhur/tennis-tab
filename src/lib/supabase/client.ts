import { createBrowserClient } from '@supabase/ssr'

/**
 * 클라이언트 컴포넌트에서 사용하는 Supabase 클라이언트
 * 브라우저에서 실행되며, 사용자 인증 상태를 관리합니다.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
