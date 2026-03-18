import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'

export const metadata = {
  title: '관리자 | 마포구테니스협회',
  description: '마포구테니스협회 관리자 페이지',
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/not-found')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, name, email, avatar_url')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role && ['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(profile.role)

  // 관리자가 아닌 경우 코치 여부 확인 (RLS 우회를 위해 admin client 사용)
  let isCoach = false
  if (!isAdmin) {
    const adminClient = createAdminClient()
    const { data: coach } = await adminClient
      .from('coaches')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()
    isCoach = !!coach
  }

  if (!isAdmin && !isCoach) {
    redirect('/not-found')
  }

  return (
    <div className="fixed inset-0 z-50 bg-(--bg-primary) overflow-hidden">
      <div className="flex h-full">
        <AdminSidebar currentRole={profile?.role ?? 'USER'} isCoach={isCoach && !isAdmin} />
        <div className="flex-1 lg:ml-64 flex flex-col h-full overflow-hidden">
          <AdminHeader
            userName={profile.name}
            userEmail={profile.email}
            userAvatar={profile.avatar_url}
            userRole={profile.role}
          />
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
