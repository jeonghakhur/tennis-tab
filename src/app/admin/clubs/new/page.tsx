import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasMinimumRole } from '@/lib/auth/roles'
import { ClubForm } from '@/components/clubs/ClubForm'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

export default async function NewClubPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/not-found')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!hasMinimumRole(profile?.role, 'MANAGER')) redirect('/admin')

  // 협회 목록 fetch (SUPER_ADMIN: 전체, 기타: 자신의 협회만)
  const admin = createAdminClient()
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN'
  let associations: { id: string; name: string }[] = []

  if (isSuperAdmin) {
    const { data } = await admin.from('associations').select('id, name').order('name')
    associations = data || []
  } else {
    const { data: mgr } = await admin
      .from('association_managers')
      .select('association_id, associations:association_id(id, name)')
      .eq('user_id', user.id)
      .maybeSingle()
    if (mgr?.associations) {
      associations = [mgr.associations as unknown as { id: string; name: string }]
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/clubs"
          className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">
            클럽 생성
          </h1>
          <p className="text-(--text-secondary) mt-1">
            새로운 클럽을 생성합니다.
          </p>
        </div>
      </div>

      <ClubForm associations={associations} />
    </div>
  )
}
