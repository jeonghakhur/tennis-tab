import { formatKoreanDate } from '@/lib/utils/formatDate'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import { canManageTournaments } from '@/lib/auth/roles'
import { EntriesManager } from '@/components/admin/EntriesManager'
import { TournamentStatusSelector } from '@/components/admin/TournamentStatusSelector'
import { decryptProfile } from '@/lib/crypto/profileCrypto'
import type { PartnerData } from '@/lib/supabase/types'
import Link from 'next/link'
import { ChevronLeft, Calendar, MapPin, Users, ListTree } from 'lucide-react'

import { sortDivisions } from '@/lib/tournaments/divisionSort'

type ActiveClubLite = { id: string; name: string }

/**
 * 어드민 뷰 전용: 엔트리 clubName 기준으로 ACTIVE 회원 이름 맵 생성.
 * - 키: 소문자 정규화된 클럽명 (대소문자/공백 무시 매칭용)
 * - clubs 테이블에 없는 클럽은 키 자체가 없음 → 조회 측에서 "검증 skip" 처리
 *
 * clubs는 호출자가 entries와 병렬로 미리 fetch하여 전달 (RTT 절약).
 */
async function buildClubMembersMap(
  clubs: ActiveClubLite[],
  clubNames: string[]
): Promise<Record<string, string[]>> {
  const uniqueLowerNames = new Set(
    clubNames.map((n) => n.trim().toLowerCase()).filter(Boolean)
  )
  if (uniqueLowerNames.size === 0 || clubs.length === 0) return {}

  const clubIdToLowerName = new Map<string, string>()
  for (const c of clubs) {
    const key = c.name.trim().toLowerCase()
    if (uniqueLowerNames.has(key)) clubIdToLowerName.set(c.id, key)
  }
  if (clubIdToLowerName.size === 0) return {}

  const admin = createAdminClient()
  const { data: members } = await admin
    .from('club_members')
    .select('club_id, name')
    .in('club_id', Array.from(clubIdToLowerName.keys()))
    .eq('status', 'ACTIVE')

  const result: Record<string, string[]> = {}
  for (const m of members ?? []) {
    const key = clubIdToLowerName.get(m.club_id)
    if (!key) continue
    if (!result[key]) result[key] = []
    result[key].push(m.name)
  }
  return result
}

interface PageProps {
  params: Promise<{ id: string }>
}

export const dynamic = 'force-dynamic'

export default async function TournamentEntriesPage({ params }: PageProps) {
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

  // entries와 clubs를 병렬 조회 — clubs는 entries에 의존하지 않으므로 RTT 1회 절약
  const adminForClubs = createAdminClient()
  const [{ data: rawEntries }, { data: activeClubs }] = await Promise.all([
    supabase
      .from('tournament_entries')
      .select(`
        *,
        profiles:user_id (name, email, phone, avatar_url, club),
        tournament_divisions:division_id (name)
      `)
      .eq('tournament_id', id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    adminForClubs
      .from('clubs')
      .select('id, name')
      .eq('is_active', true),
  ])

  const entries = (rawEntries ?? []).map((entry) => ({
    ...entry,
    profiles: entry.profiles ? decryptProfile(entry.profiles) : null,
  }))

  // 엔트리 clubName을 기준으로 ACTIVE 회원 맵 생성 (profiles.club은 판정 대상 아님 — club_name만 사용)
  const clubNamesInEntries: string[] = []
  for (const e of entries) {
    if (e.club_name) clubNamesInEntries.push(e.club_name)
    const partner = e.partner_data as PartnerData | null
    if (partner?.club) clubNamesInEntries.push(partner.club)
  }
  const clubMembersMap = await buildClubMembersMap(
    activeClubs ?? [],
    clubNamesInEntries
  )

  const statusConfig: Record<string, { label: string; className: string }> = {
    DRAFT: { label: '초안', className: 'bg-gray-500/20 text-gray-400' },
    UPCOMING: { label: '대기중', className: 'bg-purple-500/20 text-purple-400' },
    OPEN: { label: '모집중', className: 'bg-green-500/20 text-green-400' },
    CLOSED: { label: '마감', className: 'bg-yellow-500/20 text-yellow-400' },
    IN_PROGRESS: { label: '진행중', className: 'bg-blue-500/20 text-blue-400' },
    COMPLETED: { label: '완료', className: 'bg-gray-500/20 text-gray-500' },
    CANCELLED: { label: '취소', className: 'bg-red-500/20 text-red-400' },
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

      {/* Tournament Info Header */}
      <div className="glass-card rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl font-bold text-(--text-primary)">
                {tournament.title}
              </h1>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  statusConfig[tournament.status]?.className
                }`}
              >
                {statusConfig[tournament.status]?.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-(--text-secondary)">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>
                  {formatKoreanDate(tournament.start_date)}
                  {tournament.start_date !== tournament.end_date &&
                    ` ~ ${formatKoreanDate(tournament.end_date)}`}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4" />
                <span>{tournament.location}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span>
                  총 {entries.length}팀 신청
                </span>
              </div>
            </div>

            {tournament.profiles && (
              <p className="text-xs text-(--text-muted)">
                주최: {tournament.profiles.name} ({tournament.profiles.email})
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <TournamentStatusSelector
              tournamentId={tournament.id}
              currentStatus={tournament.status}
            />
            <Link
              href={`/admin/tournaments/${tournament.id}/bracket`}
              className="btn-primary btn-sm inline-flex items-center gap-1.5"
            >
              <ListTree className="w-4 h-4" />
              <span className="relative z-10">대진표 작성</span>
            </Link>
            <Link
              href={`/tournaments/${tournament.id}`}
              target="_blank"
              className="btn-secondary btn-sm"
            >
              <span className="relative z-10">대회 상세</span>
            </Link>
            <Link
              href={`/tournaments/${tournament.id}/edit`}
              className="btn-secondary btn-sm"
            >
              <span className="relative z-10">대회 수정</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Entries Manager */}
      <EntriesManager
        tournamentId={tournament.id}
        entries={entries}
        divisions={sortDivisions(tournament.tournament_divisions ?? [])}
        clubMembersMap={clubMembersMap}
      />
    </div>
  )
}
