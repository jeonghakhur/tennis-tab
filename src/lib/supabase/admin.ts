import { createClient } from '@supabase/supabase-js'

/**
 * Supabase Admin Client
 * Service Role Key를 사용하여 RLS를 우회하는 관리자 클라이언트
 * 서버 사이드에서만 사용해야 함
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3'

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
