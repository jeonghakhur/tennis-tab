import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsersTable } from '@/components/admin/UsersTable'
import { isAdmin } from '@/lib/auth/roles'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/not-found')
  }

  const { data: currentProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // ADMIN 이상만 접근 가능
  if (!isAdmin(currentProfile?.role)) {
    redirect('/admin')
  }

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-(--text-primary)">
          회원 관리
        </h1>
        <p className="text-(--text-secondary) mt-1">
          등록된 회원을 조회하고 관리할 수 있습니다.
        </p>
      </div>

      {/* Users Table */}
      <UsersTable
        users={users ?? []}
        currentUserId={user.id}
        currentUserRole={currentProfile?.role ?? 'USER'}
      />
    </div>
  )
}
