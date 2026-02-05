import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Trophy, Users } from 'lucide-react'
import { BracketView } from '@/components/tournaments/BracketView'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TournamentBracketPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createClient()

  // 대회 정보 조회
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select(`
      *,
      tournament_divisions (
        id,
        name,
        max_teams,
        bracket_configs (
          id,
          has_preliminaries,
          third_place_match,
          bracket_size,
          status
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !tournament) {
    notFound()
  }

  // 대진표가 있는 부서 필터링
  const divisionsWithBracket = tournament.tournament_divisions?.filter(
    (d: any) => d.bracket_configs && d.bracket_configs.length > 0
  ) || []

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <Link
        href={`/tournaments/${id}`}
        className="inline-flex items-center gap-1 text-sm text-[var(--text-secondary)] hover:text-[var(--accent-color)] transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        대회 정보로 돌아가기
      </Link>

      {/* Header */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <h1 className="font-display text-2xl md:text-3xl font-bold text-[var(--text-primary)] flex items-center gap-3">
          <Trophy className="w-8 h-8 text-[var(--accent-color)]" />
          {tournament.title}
        </h1>
        <p className="text-[var(--text-secondary)] mt-2">대진표</p>
      </div>

      {/* Bracket View */}
      {divisionsWithBracket.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Users className="w-16 h-16 mx-auto text-[var(--text-muted)] mb-4" />
          <h2 className="font-display text-xl font-semibold text-[var(--text-primary)] mb-2">
            대진표가 아직 없습니다
          </h2>
          <p className="text-[var(--text-secondary)]">
            대진표가 생성되면 이곳에서 확인할 수 있습니다.
          </p>
        </div>
      ) : (
        <BracketView
          tournamentId={tournament.id}
          divisions={tournament.tournament_divisions || []}
        />
      )}
    </div>
  )
}
