import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasMinimumRole } from '@/lib/auth/roles'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Plus, Shield, Users, MapPin } from 'lucide-react'
import type { ClubJoinType } from '@/lib/clubs/types'

const JOIN_TYPE_LABELS: Record<ClubJoinType, string> = {
  OPEN: '자유 가입',
  APPROVAL: '승인제',
  INVITE_ONLY: '초대 전용',
}

export default async function AdminClubsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/not-found')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!hasMinimumRole(profile?.role, 'MANAGER')) redirect('/admin')

  const admin = createAdminClient()

  // 내가 OWNER/ADMIN인 클럽 ID 조회
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN'

  let clubIds: string[] = []
  if (!isSuperAdmin) {
    const { data: memberships } = await admin
      .from('club_members')
      .select('club_id')
      .eq('user_id', user.id)
      .in('role', ['OWNER', 'ADMIN'])
      .eq('status', 'ACTIVE')

    clubIds = memberships?.map((m) => m.club_id) || []
  }

  // 클럽 목록 조회
  let clubsQuery = admin
    .from('clubs')
    .select(`
      *,
      associations:association_id (name)
    `)
    .order('created_at', { ascending: false })

  if (!isSuperAdmin && clubIds.length > 0) {
    clubsQuery = clubsQuery.in('id', clubIds)
  } else if (!isSuperAdmin && clubIds.length === 0) {
    // 소속 클럽이 없으면 빈 배열
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-(--text-primary)">클럽 관리</h1>
            <p className="text-(--text-secondary) mt-1">나의 클럽을 관리할 수 있습니다.</p>
          </div>
          <Link href="/admin/clubs/new" className="btn-primary btn-sm flex items-center gap-1">
            <Plus className="w-4 h-4" />
            클럽 생성
          </Link>
        </div>
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <Shield className="w-12 h-12 mx-auto text-(--text-muted)" />
          <div>
            <p className="text-(--text-primary) font-medium">관리 중인 클럽이 없습니다.</p>
            <p className="text-(--text-muted) text-sm mt-1">새 클럽을 생성하여 회원을 관리하세요.</p>
          </div>
        </div>
      </div>
    )
  }

  const { data: clubs } = await clubsQuery

  // 클럽별 회원 수 조회
  const memberCounts = new Map<string, number>()
  if (clubs && clubs.length > 0) {
    const ids = clubs.map((c) => c.id)
    const { data: counts } = await admin
      .from('club_members')
      .select('club_id')
      .in('club_id', ids)
      .eq('status', 'ACTIVE')

    if (counts) {
      for (const row of counts) {
        memberCounts.set(row.club_id, (memberCounts.get(row.club_id) || 0) + 1)
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">클럽 관리</h1>
          <p className="text-(--text-secondary) mt-1">
            {isSuperAdmin ? '모든 클럽을 관리할 수 있습니다.' : '나의 클럽을 관리할 수 있습니다.'}
          </p>
        </div>
        <Link href="/admin/clubs/new" className="btn-primary btn-sm flex items-center gap-1">
          <Plus className="w-4 h-4" />
          클럽 생성
        </Link>
      </div>

      {!clubs || clubs.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <Shield className="w-12 h-12 mx-auto text-(--text-muted)" />
          <p className="text-(--text-muted)">관리 중인 클럽이 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clubs.map((club) => {
            const assocName = (club.associations as { name: string } | null)?.name
            return (
              <div key={club.id} className="glass-card rounded-xl p-5 space-y-3">
                <div>
                  <h3 className="text-lg font-bold text-(--text-primary)">{club.name}</h3>
                  {(club.city || club.district) && (
                    <p className="text-sm text-(--text-secondary) flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      {[club.city, club.district].filter(Boolean).join(' ')}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-(--text-muted)">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    회원 {memberCounts.get(club.id) || 0}명
                  </span>
                  <span>·</span>
                  <span>{assocName || '독립 클럽'}</span>
                  <span>·</span>
                  <span>{JOIN_TYPE_LABELS[club.join_type as ClubJoinType] || club.join_type}</span>
                </div>
                <Link
                  href={`/admin/clubs/${club.id}`}
                  className="btn-secondary btn-sm inline-block text-center"
                >
                  관리
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
