import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { TournamentsTable } from '@/components/admin/TournamentsTable'
import { canManageTournaments } from '@/lib/auth/roles'

export default async function AdminTournamentsPage() {
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

  // MANAGER 이상만 접근 가능
  if (!canManageTournaments(currentProfile?.role)) {
    redirect('/admin')
  }

  // MANAGER는 자신이 만든 대회만, ADMIN 이상은 모든 대회
  const isAdminOrHigher = ['ADMIN', 'SUPER_ADMIN'].includes(currentProfile?.role ?? '')

  let query = supabase
    .from('tournaments')
    .select(`
      *,
      profiles:organizer_id (name, email),
      tournament_entries (id, status, payment_status, division_id),
      tournament_divisions (id, name, max_teams)
    `)
    .order('start_date', { ascending: false })

  if (!isAdminOrHigher) {
    query = query.eq('organizer_id', user.id)
  }

  const { data: tournaments } = await query

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-display text-2xl font-bold text-(--text-primary)">
            대회 관리
          </h1>
          <p className="text-(--text-secondary) mt-1">
            {isAdminOrHigher
              ? '모든 대회를 조회하고 관리할 수 있습니다.'
              : '내가 등록한 대회를 조회하고 관리할 수 있습니다.'}
          </p>
        </div>
        <Link
          href="/tournaments/new"
          className="px-4 py-2 rounded-lg text-sm font-medium text-white whitespace-nowrap hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--accent-color)' }}
        >
          대회 생성
        </Link>
      </div>

      {/* Tournaments Table */}
      <TournamentsTable
        tournaments={tournaments ?? []}
        showOrganizer={isAdminOrHigher}
        showDelete
      />
    </div>
  )
}
