import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Trophy } from 'lucide-react'
import { BracketView } from '@/components/tournaments/BracketView'
import { TournamentRealtimeRefresher } from '@/components/tournaments/TournamentRealtimeRefresher'
import { getPlayerEntryIds } from '@/lib/bracket/actions'
import type { MatchType, TournamentStatus } from '@/lib/supabase/types'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { KakaoShareButton } from '@/components/common/KakaoShareButton'
import { sortDivisions } from '@/lib/tournaments/divisionSort'

const STATUS_BADGE: Record<string, { label: string; variant: BadgeVariant; className?: string }> = {
  DRAFT: { label: '작성 중', variant: 'secondary' },
  OPEN: { label: '모집 중', variant: 'success' },
  CLOSED: { label: '마감', variant: 'orange' },
  IN_PROGRESS: { label: '진행 중', variant: 'info' },
  COMPLETED: { label: '종료', variant: 'secondary' },
  CANCELLED: { label: '취소', variant: 'danger', className: 'line-through' },
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ divisionId?: string }>
}

export default async function TournamentBracketPage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { divisionId } = await searchParams
  const supabase = await createClient()

  // 대회 정보 조회
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .select(`
      *,
      tournament_divisions (
        id,
        name,
        max_teams
      )
    `)
    .eq('id', id)
    .single()

  if (error || !tournament) {
    notFound()
  }

  const divisions = sortDivisions(
    (tournament.tournament_divisions || []) as Array<{ id: string; name: string; max_teams: number | null }>
  )

  // 로그인 유저의 참가 entry_ids 조회 (본인 경기 하이라이트용)
  const { entryIds } = await getPlayerEntryIds(id)

  return (
    <div className="max-w-content mx-auto px-4 py-8">
      {/* 대회 상태 변경 실시간 감지 */}
      <TournamentRealtimeRefresher tournamentIds={[tournament.id]} />

      {/* Breadcrumb */}
      <Link
        href={`/tournaments/${id}`}
        className="inline-flex items-center gap-1 text-sm text-(--text-secondary) hover:text-(--accent-color) transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        대회 정보로 돌아가기
      </Link>

      {/* Header */}
      <div className="glass-card rounded-xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-(--text-primary) flex items-center gap-3">
            <Trophy className="w-8 h-8 text-(--accent-color)" />
            {tournament.title}
          </h1>
          {(() => {
            const badge = STATUS_BADGE[tournament.status] || STATUS_BADGE.DRAFT
            return (
              <Badge variant={badge.variant} className={`shrink-0${badge.className ? ` ${badge.className}` : ''}`}>
                {badge.label}
              </Badge>
            )
          })()}
        </div>
        <div className="flex items-center gap-3 ml-11">
          <p className="text-(--text-secondary)">대진표</p>
          <KakaoShareButton
            title={`${tournament.title} 대진표`}
            description={[
              tournament.start_date
                ? new Date(tournament.start_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
                : '',
              tournament.location,
            ].filter(Boolean).join(' · ')}
            imageUrl={tournament.poster_url ?? undefined}
            pageUrl={`/tournaments/${tournament.id}/bracket`}
          />
        </div>
      </div>

      {/* Bracket View */}
      <BracketView
        tournamentId={tournament.id}
        divisions={divisions}
        initialDivisionId={divisionId}
        currentUserEntryIds={entryIds.length > 0 ? entryIds : undefined}
        matchType={tournament.match_type as MatchType | null}
        teamMatchCount={tournament.team_match_count}
        tournamentStatus={tournament.status}
      />
    </div>
  )
}
