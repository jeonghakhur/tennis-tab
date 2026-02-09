import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { canManageTournaments } from '@/lib/auth/roles'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { BracketManager } from '@/components/admin/BracketManager'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TournamentBracketPage({ params }: PageProps) {
  const { id } = await params
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

  if (!canManageTournaments(currentProfile?.role)) {
    redirect('/admin')
  }

  // 대회 정보 조회
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select(`
      *,
      profiles:organizer_id (name, email),
      tournament_divisions (id, name, max_teams)
    `)
    .eq('id', id)
    .single()

  if (tournamentError || !tournament) {
    notFound()
  }

  // MANAGER는 자신이 만든 대회만
  const isAdminOrHigher = ['ADMIN', 'SUPER_ADMIN'].includes(currentProfile?.role ?? '')
  if (!isAdminOrHigher && tournament.organizer_id !== user.id) {
    redirect('/admin/tournaments')
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href="/admin/tournaments"
        className="inline-flex items-center gap-1 text-sm text-(--text-secondary) hover:text-(--accent-color) transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        대회 목록으로
      </Link>

      {/* Header */}
      <div className="glass-card rounded-xl p-6">
        <h1 className="font-display text-2xl font-bold text-(--text-primary)">
          {tournament.title} - 대진표 관리
        </h1>
        <p className="text-(--text-secondary) mt-1">
          부서별 대진표를 설정하고 경기 결과를 입력하세요.
        </p>
      </div>

      {/* Bracket Manager */}
      <BracketManager
        tournamentId={tournament.id}
        divisions={tournament.tournament_divisions ?? []}
        teamMatchCount={tournament.team_match_count ?? null}
        matchType={tournament.match_type ?? null}
      />
    </div>
  )
}
