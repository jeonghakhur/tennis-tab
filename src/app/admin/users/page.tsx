import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsersTable } from '@/components/admin/UsersTable'
import { isAdmin } from '@/lib/auth/roles'
import { decryptProfile } from '@/lib/crypto/profileCrypto'

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

  const { data: rawUsers } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  // 암호화된 phone, birth_year 복호화
  const users = rawUsers?.map((u) => decryptProfile(u)) ?? []

  // 클럽 회장/총무 정보 조회
  const { data: clubRoles } = await supabase
    .from('club_members')
    .select('user_id, role, clubs(name)')
    .in('role', ['OWNER', 'ADMIN', 'VICE_PRESIDENT', 'ADVISOR', 'MATCH_DIRECTOR'])
    .eq('is_registered', true)
    .not('user_id', 'is', null)

  // user_id → [{club_name, role}] 맵 생성
  const clubRoleMap: Record<string, Array<{ clubName: string; role: string }>> = {}
  for (const cr of clubRoles ?? []) {
    if (!cr.user_id) continue
    const clubs = cr.clubs as unknown as { name: string } | null
    const clubName = clubs?.name ?? ''
    if (!clubRoleMap[cr.user_id]) clubRoleMap[cr.user_id] = []
    clubRoleMap[cr.user_id].push({ clubName, role: cr.role })
  }

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
        users={users}
        currentUserId={user.id}
        currentUserRole={currentProfile?.role ?? 'USER'}
        clubRoleMap={clubRoleMap}
      />
    </div>
  )
}
