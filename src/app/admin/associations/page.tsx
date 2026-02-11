import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Building2, Users, Shield } from 'lucide-react'

export default async function AdminAssociationsPage() {
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

  // 내 협회 조회
  const { data: association } = await admin
    .from('associations')
    .select('*')
    .eq('created_by', user.id)
    .maybeSingle()

  // 협회가 있으면 매니저 수, 클럽 수 조회
  let managerCount = 0
  let clubCount = 0
  if (association) {
    const [managers, clubs] = await Promise.all([
      admin
        .from('association_managers')
        .select('*', { count: 'exact', head: true })
        .eq('association_id', association.id),
      admin
        .from('clubs')
        .select('*', { count: 'exact', head: true })
        .eq('association_id', association.id),
    ])
    managerCount = managers.count || 0
    clubCount = clubs.count || 0
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-(--text-primary)">
          협회 관리
        </h1>
        <p className="text-(--text-secondary) mt-1">
          나의 협회를 관리하고 매니저를 지정할 수 있습니다.
        </p>
      </div>

      {association ? (
        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-(--text-primary)">
                {association.name}
              </h2>
              {(association.region || association.district) && (
                <p className="text-(--text-secondary) mt-1">
                  {[association.region, association.district].filter(Boolean).join(' ')}
                </p>
              )}
              {association.description && (
                <p className="text-(--text-muted) mt-2 text-sm">
                  {association.description}
                </p>
              )}
            </div>
          </div>

          {/* 통계 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-(--bg-primary)">
              <Users className="w-5 h-5 text-(--accent-color)" />
              <div>
                <p className="text-sm text-(--text-muted)">매니저</p>
                <p className="text-lg font-bold text-(--text-primary)">{managerCount}명</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-(--bg-primary)">
              <Shield className="w-5 h-5 text-(--accent-color)" />
              <div>
                <p className="text-sm text-(--text-muted)">소속 클럽</p>
                <p className="text-lg font-bold text-(--text-primary)">{clubCount}개</p>
              </div>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <Link
              href={`/admin/associations/${association.id}`}
              className="btn-secondary btn-sm"
            >
              협회 수정
            </Link>
            <Link
              href={`/admin/associations/${association.id}/managers`}
              className="btn-primary btn-sm"
            >
              매니저 관리
            </Link>
          </div>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <Building2 className="w-12 h-12 mx-auto text-(--text-muted)" />
          <div>
            <p className="text-(--text-primary) font-medium">
              아직 협회를 생성하지 않았습니다.
            </p>
            <p className="text-(--text-muted) text-sm mt-1">
              협회를 생성하고 매니저를 지정하여 클럽을 관리하세요.
            </p>
          </div>
          <Link href="/admin/associations/new" className="btn-primary btn-sm inline-block">
            협회 생성하기
          </Link>
        </div>
      )}
    </div>
  )
}
