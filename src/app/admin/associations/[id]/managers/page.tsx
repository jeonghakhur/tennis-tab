import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import { ManagerList } from '@/components/associations/ManagerList'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { AssociationManager } from '@/lib/associations/types'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ManagersPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/not-found')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isAdmin(profile?.role)) redirect('/admin')

  const admin = createAdminClient()

  // 협회 조회
  const { data: association } = await admin
    .from('associations')
    .select('id, name, created_by')
    .eq('id', id)
    .single()

  if (!association) notFound()

  // 소유자 확인
  if (profile?.role !== 'SUPER_ADMIN' && association.created_by !== user.id) {
    redirect('/admin/associations')
  }

  // 매니저 목록 조회
  const { data: managers } = await admin
    .from('association_managers')
    .select(`
      *,
      profiles:user_id (name, email, phone)
    `)
    .eq('association_id', id)
    .order('assigned_at', { ascending: false })

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/associations"
          className="p-2 rounded-lg hover:bg-(--bg-card) text-(--text-secondary)"
        >
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">
            매니저 관리
          </h1>
          <p className="text-(--text-secondary) mt-1">
            {association.name} · 매니저를 검색하여 지정하거나 해제할 수 있습니다.
          </p>
        </div>
      </div>

      <ManagerList
        associationId={id}
        initialManagers={(managers || []) as AssociationManager[]}
      />
    </div>
  )
}
