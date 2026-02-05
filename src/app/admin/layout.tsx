import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminHeader } from '@/components/admin/AdminHeader'

export const metadata = {
  title: '관리자 | Tennis Tab',
  description: 'Tennis Tab 관리자 페이지',
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

  if (!profile?.role || !['ADMIN', 'MANAGER', 'SUPER_ADMIN'].includes(profile.role)) {
    redirect('/not-found')
  }

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-primary)] overflow-hidden">
      <div className="flex h-full">
        <AdminSidebar currentRole={profile.role} />
        <div className="flex-1 lg:ml-64 flex flex-col h-full overflow-hidden">
          <AdminHeader
            userName={profile.name}
            userEmail={profile.email}
            userAvatar={profile.avatar_url}
            userRole={profile.role}
          />
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}
