import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { Shield, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import type { ClubMemberRole } from '@/lib/clubs/types'

const CLUB_ROLE_LABEL: Record<string, string> = {
  OWNER: '회장',
  ADMIN: '총무',
  MATCH_DIRECTOR: '경기이사',
}

const CLUB_ROLE_VARIANT: Record<string, 'warning' | 'info' | 'success'> = {
  OWNER: 'warning',
  ADMIN: 'info',
  MATCH_DIRECTOR: 'success',
}

/** 임원 역할 (클럽 관리 권한이 있는 역할) */
const OFFICER_ROLES: ClubMemberRole[] = ['OWNER', 'ADMIN', 'MATCH_DIRECTOR']

export const metadata = {
  title: '내 클럽 관리 | 마포구테니스협회',
  description: '소속 클럽을 관리합니다.',
}

export default async function MyClubsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/not-found')

  const admin = createAdminClient()

  // 사용자가 임원(OWNER/ADMIN/MATCH_DIRECTOR)인 활성 클럽 조회
  const { data: memberships } = await admin
    .from('club_members')
    .select('club_id, role')
    .eq('user_id', user.id)
    .in('role', OFFICER_ROLES)
    .eq('status', 'ACTIVE')

  if (!memberships || memberships.length === 0) {
    return (
      <div className="max-w-[1920px] mx-auto px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-(--text-primary) mb-6">
          내 클럽 관리
        </h1>
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <Shield className="w-12 h-12 mx-auto text-(--text-muted)" />
          <div>
            <p className="text-(--text-primary) font-medium">관리 중인 클럽이 없습니다.</p>
            <p className="text-(--text-muted) text-sm mt-1">
              클럽에서 회장, 총무, 경기이사 역할을 부여받으면 여기에서 관리할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 클럽별 역할 맵
  const roleMap = new Map(memberships.map((m) => [m.club_id, m.role]))
  const clubIds = memberships.map((m) => m.club_id)

  // 클럽 정보 조회
  const { data: clubs } = await admin
    .from('clubs')
    .select(`
      id, name, city, district, is_active,
      associations:association_id (name)
    `)
    .in('id', clubIds)
    .order('name')

  // 클럽별 활성 회원 수 조회
  const memberCounts = new Map<string, number>()
  const { data: counts } = await admin
    .from('club_members')
    .select('club_id')
    .in('club_id', clubIds)
    .eq('status', 'ACTIVE')

  if (counts) {
    for (const row of counts) {
      memberCounts.set(row.club_id, (memberCounts.get(row.club_id) || 0) + 1)
    }
  }

  return (
    <div className="max-w-[1920px] mx-auto px-4 py-8">
      <h1 className="font-display text-2xl font-bold text-(--text-primary) mb-6">
        내 클럽 관리
      </h1>

      <div className="space-y-3">
        {(clubs || []).map((club) => {
          const role = roleMap.get(club.id) as string
          const assocName = (club.associations as unknown as { name: string } | null)?.name
          const count = memberCounts.get(club.id) || 0

          return (
            <Link
              key={club.id}
              href={`/my/clubs/${club.id}`}
              className={`glass-card rounded-xl p-4 flex items-center justify-between gap-3 hover:bg-(--bg-card-hover) transition-colors ${
                !club.is_active ? 'opacity-50' : ''
              }`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-(--text-primary) truncate">
                    {club.name}
                  </span>
                  <Badge variant={CLUB_ROLE_VARIANT[role] || 'secondary'}>
                    {CLUB_ROLE_LABEL[role] || role}
                  </Badge>
                  {!club.is_active && (
                    <Badge variant="secondary">비활성</Badge>
                  )}
                </div>
                <p className="text-sm text-(--text-muted) mt-0.5">
                  {assocName || '독립 클럽'}
                  {club.city && ` · ${[club.city, club.district].filter(Boolean).join(' ')}`}
                  {` · 회원 ${count}명`}
                </p>
              </div>
              <ChevronRight className="w-5 h-5 text-(--text-muted) shrink-0" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
