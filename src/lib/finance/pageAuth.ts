import { redirect } from 'next/navigation'
import { createClient, getVerifiedUser } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/roles'
import type { UserRole } from '@/lib/supabase/types'

/** 재정 관리 페이지 공통 인증 — SUPER_ADMIN 아니면 /admin 으로 */
export async function requireFinanceAdminPage(): Promise<{ userId: string; role: UserRole }> {
  const supabase = await createClient()
  const user = await getVerifiedUser(supabase)
  if (!user) redirect('/not-found')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile?.role ?? 'USER') as UserRole
  if (!isSuperAdmin(role)) redirect('/admin')
  return { userId: user.id, role }
}
