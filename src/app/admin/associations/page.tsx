import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isAdmin, isSuperAdmin } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Building2, Users, Shield, MapPin } from 'lucide-react'
import { DeleteAssociationButton } from '@/components/associations/DeleteAssociationButton'

type AssociationWithCounts = {
  id: string
  name: string
  region: string | null
  district: string | null
  description: string | null
  is_active: boolean
  created_by: string
  manager_count: number
  club_count: number
}

/** 협회 1개에 대한 매니저/클럽 수 조회 */
async function getAssociationCounts(
  admin: ReturnType<typeof createAdminClient>,
  associationId: string,
): Promise<{ managerCount: number; clubCount: number }> {
  const [managers, clubs] = await Promise.all([
    admin
      .from('association_managers')
      .select('*', { count: 'exact', head: true })
      .eq('association_id', associationId),
    admin
      .from('clubs')
      .select('*', { count: 'exact', head: true })
      .eq('association_id', associationId),
  ])
  return {
    managerCount: managers.count || 0,
    clubCount: clubs.count || 0,
  }
}

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
  const superAdmin = isSuperAdmin(profile?.role)

  // SUPER_ADMIN: 전체 협회 목록 / ADMIN: 내 협회만
  if (superAdmin) {
    const { data: associations } = await admin
      .from('associations')
      .select('*')
      .order('created_at', { ascending: false })

    // 각 협회의 매니저/클럽 수 병렬 조회
    const list: AssociationWithCounts[] = await Promise.all(
      (associations || []).map(async (a) => {
        const { managerCount, clubCount } = await getAssociationCounts(admin, a.id)
        return { ...a, manager_count: managerCount, club_count: clubCount }
      }),
    )

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-(--text-primary)">
              전체 협회 관리
            </h1>
            <p className="text-(--text-secondary) mt-1">
              시스템에 등록된 모든 협회를 관리합니다.
            </p>
          </div>
          <Link href="/admin/associations/new" className="btn-primary btn-sm">
            협회 생성
          </Link>
        </div>

        {list.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center space-y-4">
            <Building2 className="w-12 h-12 mx-auto text-(--text-muted)" />
            <p className="text-(--text-muted)">등록된 협회가 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((a) => (
              <div key={a.id} className="glass-card rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-(--text-primary)">
                      {a.name}
                    </h2>
                    {(a.region || a.district) && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <MapPin className="w-3.5 h-3.5 text-(--text-muted)" />
                        <span className="text-sm text-(--text-secondary)">
                          {[a.region, a.district].filter(Boolean).join(' ')}
                        </span>
                      </div>
                    )}
                    {a.description && (
                      <p className="text-(--text-muted) mt-1.5 text-sm line-clamp-2">
                        {a.description}
                      </p>
                    )}
                  </div>
                  {!a.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                      비활성
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-sm text-(--text-muted)">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    매니저 {a.manager_count}명
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4" />
                    클럽 {a.club_count}개
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/associations/${a.id}/managers`}
                    className="btn-primary btn-sm text-xs"
                  >
                    매니저 관리
                  </Link>
                  <Link
                    href={`/admin/associations/${a.id}`}
                    className="btn-warning btn-sm text-xs"
                  >
                    수정
                  </Link>
                  <DeleteAssociationButton
                    associationId={a.id}
                    associationName={a.name}
                    className="btn-danger btn-sm text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ── ADMIN: 내 협회 1개만 표시 ──
  const { data: association } = await admin
    .from('associations')
    .select('*')
    .eq('created_by', user.id)
    .maybeSingle()

  let managerCount = 0
  let clubCount = 0
  if (association) {
    const counts = await getAssociationCounts(admin, association.id)
    managerCount = counts.managerCount
    clubCount = counts.clubCount
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
