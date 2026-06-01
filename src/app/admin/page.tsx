import { formatKoreanDate, formatKoreanDateTime } from '@/lib/utils/formatDate'
import { createClient } from '@/lib/supabase/server'
import { Users, Trophy, UserCheck, Calendar } from 'lucide-react'
import Link from 'next/link'
import { Badge, type BadgeVariant } from '@/components/common/Badge'

interface StatCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  href?: string
  description?: string
}

function StatCard({ title, value, icon, href, description }: StatCardProps) {
  const content = (
    <div className="glass-card rounded-xl p-6 transition-all duration-300 hover:border-(--border-accent)">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-(--text-secondary)">{title}</p>
          <p className="font-display text-3xl font-bold text-(--text-primary)">
            {value}
          </p>
          {description && (
            <p className="text-xs text-(--text-muted)">{description}</p>
          )}
        </div>
        <div className="p-3 rounded-lg bg-(--accent-color)/10 text-(--accent-color)">
          {icon}
        </div>
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  // 통계 데이터 조회
  const [
    { count: totalUsers },
    { count: totalTournaments },
    { count: activeTournaments },
    { count: pendingEntries },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('tournaments').select('*', { count: 'exact', head: true }),
    supabase
      .from('tournaments')
      .select('*', { count: 'exact', head: true })
      .in('status', ['OPEN', 'IN_PROGRESS']),
    supabase
      .from('tournament_entries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING'),
  ])

  // 최근 대회 조회
  const { data: recentTournaments } = await supabase
    .from('tournaments')
    .select('id, title, status, start_date, location')
    .order('created_at', { ascending: false })
    .limit(5)

  // 최근 가입 회원 조회
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, name, email, created_at, role')
    .order('created_at', { ascending: false })
    .limit(5)

  const statusLabels: Record<string, { label: string; variant: BadgeVariant }> = {
    DRAFT:       { label: '초안',  variant: 'secondary' },
    UPCOMING:    { label: '대기중', variant: 'purple' },
    OPEN:        { label: '모집중', variant: 'success' },
    CLOSED:      { label: '마감',  variant: 'danger' },
    IN_PROGRESS: { label: '진행중', variant: 'info' },
    COMPLETED:   { label: '완료',  variant: 'secondary' },
    CANCELLED:   { label: '취소',  variant: 'danger' },
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-(--text-primary)">
          대시보드
        </h1>
        <p className="text-(--text-secondary) mt-1">
          마포구테니스협회 서비스 현황을 한눈에 확인하세요.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="전체 회원"
          value={totalUsers ?? 0}
          icon={<Users className="w-6 h-6" />}
          href="/admin/users"
          description="등록된 전체 회원 수"
        />
        <StatCard
          title="전체 대회"
          value={totalTournaments ?? 0}
          icon={<Trophy className="w-6 h-6" />}
          href="/admin/tournaments"
          description="등록된 전체 대회 수"
        />
        <StatCard
          title="진행중 대회"
          value={activeTournaments ?? 0}
          icon={<Calendar className="w-6 h-6" />}
          href="/admin/tournaments"
          description="모집중 또는 진행중인 대회"
        />
        <StatCard
          title="승인 대기"
          value={pendingEntries ?? 0}
          icon={<UserCheck className="w-6 h-6" />}
          href="/admin/tournaments"
          description="참가 승인 대기중인 신청"
        />
      </div>

      {/* Recent Data */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Tournaments */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-(--text-primary)">
              최근 대회
            </h2>
            <Link
              href="/admin/tournaments"
              className="text-sm text-(--accent-color) hover:underline"
            >
              전체보기
            </Link>
          </div>
          <div className="space-y-3">
            {recentTournaments && recentTournaments.length > 0 ? (
              recentTournaments.map((tournament) => (
                <Link
                  key={tournament.id}
                  href={`/admin/tournaments/${tournament.id}/entries`}
                  className="flex items-center justify-between p-3 rounded-lg bg-(--bg-card) hover:bg-(--bg-card-hover) transition-colors"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-(--text-primary)">
                      {tournament.title}
                    </p>
                    <p className="text-xs text-(--text-muted)">
                      {tournament.location} · {formatKoreanDate(tournament.start_date)}
                    </p>
                  </div>
                  <Badge variant={statusLabels[tournament.status]?.variant ?? 'secondary'}>
                    {statusLabels[tournament.status]?.label}
                  </Badge>
                </Link>
              ))
            ) : (
              <p className="text-center py-8 text-(--text-muted)">
                등록된 대회가 없습니다.
              </p>
            )}
          </div>
        </div>

        {/* Recent Users */}
        <div className="glass-card rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold text-(--text-primary)">
              최근 가입 회원
            </h2>
            <Link
              href="/admin/users"
              className="text-sm text-(--accent-color) hover:underline"
            >
              전체보기
            </Link>
          </div>
          <div className="space-y-3">
            {recentUsers && recentUsers.length > 0 ? (
              recentUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-(--bg-card)"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-(--accent-color)/20 flex items-center justify-center text-(--accent-color) font-display font-bold">
                      {user.name?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div className="space-y-0.5">
                      <p className="font-medium text-(--text-primary)">
                        {user.name}
                      </p>
                      <p className="text-xs text-(--text-muted)">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-(--text-muted)">
                    {formatKoreanDate(user.created_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-(--text-muted)">
                가입한 회원이 없습니다.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
