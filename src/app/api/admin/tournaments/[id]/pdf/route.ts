import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { createClient } from '@/lib/supabase/server'
import { canManageTournaments } from '@/lib/auth/roles'
import { decrypt } from '@/lib/crypto/encryption'
import { TournamentPdfDocument } from '@/components/admin/TournamentPdf'
import type { PdfDivision, PdfEntry, PdfTournament } from '@/components/admin/TournamentPdf'
import type { PartnerData, TeamMember } from '@/lib/supabase/types'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id: tournamentId } = await context.params
  const supabase = await createClient()

  // 인증 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canManageTournaments(profile?.role)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 대회 정보 + 부서 조회
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select(`
      id, title, organizer_id, match_type, team_match_count,
      start_date, end_date, location, host, organizer_name,
      ball_type, eligibility, opening_ceremony,
      entry_start_date, entry_end_date, entry_fee, bank_account,
      tournament_divisions (
        id, name, max_teams, prize_winner, prize_runner_up, prize_third
      )
    `)
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return NextResponse.json({ error: '대회를 찾을 수 없습니다.' }, { status: 404 })
  }

  // MANAGER는 자신이 만든 대회만
  const isAdminOrHigher = ['ADMIN', 'SUPER_ADMIN'].includes(profile?.role ?? '')
  if (!isAdminOrHigher && tournament.organizer_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 승인된 참가자만 조회 (CONFIRMED = 승인됨, APPROVED는 UI 정규화용으로 실제 DB에는 CONFIRMED로 저장)
  const { data: rawEntries, error: entriesError } = await supabase
    .from('tournament_entries')
    .select(`
      id, division_id, player_name, club_name, phone,
      partner_data, team_members, applicant_participates,
      profiles:user_id (name, phone, club),
      tournament_divisions:division_id (name)
    `)
    .eq('tournament_id', tournamentId)
    .eq('status', 'CONFIRMED')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (entriesError) {
    return NextResponse.json({ error: '데이터 조회 실패' }, { status: 500 })
  }

  // profiles 관계 조회 결과 정규화 + phone 복호화
  // Supabase join은 타입이 배열로 추론될 수 있으므로 단일 객체로 정규화
  type RawProfile = { name: string | null; phone: string | null; club: string | null }
  const entries = (rawEntries ?? []).map((entry) => {
    const rawProfile = Array.isArray(entry.profiles)
      ? (entry.profiles[0] as RawProfile | undefined) ?? null
      : (entry.profiles as RawProfile | null)
    const profile: RawProfile | null = rawProfile
      ? {
          name: rawProfile.name,
          // phone은 암호화 저장 → 복호화 (decrypt는 null 반환 시 원본 유지)
          phone: rawProfile.phone ? (decrypt(rawProfile.phone) ?? rawProfile.phone) : null,
          club: rawProfile.club,
        }
      : null

    return { ...entry, profiles: profile }
  })

  const isTeamMatch =
    tournament.match_type === 'TEAM_SINGLES' ||
    tournament.match_type === 'TEAM_DOUBLES'
  const isDoubles = tournament.match_type === 'INDIVIDUAL_DOUBLES'

  // 부서별 승인 팀수 + 참가자수 집계
  const confirmedCountByDivision: Record<string, number> = {}
  const participantCountByDivision: Record<string, number> = {}

  for (const e of entries) {
    const divId = e.division_id
    confirmedCountByDivision[divId] = (confirmedCountByDivision[divId] ?? 0) + 1

    let personCount = 1 // 개인전 기본
    if (isDoubles) {
      // 복식: 신청자 + 파트너 = 2명
      personCount = 2
    } else if (isTeamMatch) {
      // 단체전: 팀원 수 + (본인 참가 시 +1)
      const members = (e.team_members as TeamMember[] | null) ?? []
      const applicantPlays = e.applicant_participates !== false
      personCount = members.length + (applicantPlays ? 1 : 0)
    }
    participantCountByDivision[divId] = (participantCountByDivision[divId] ?? 0) + personCount
  }

  // 부서 정렬은 DB 조회 순서 유지 (admin 페이지와 동일하게 sortDivisions 적용 필요 시 추가)
  const divisions: PdfDivision[] = (tournament.tournament_divisions ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    max_teams: d.max_teams,
    prize_winner: d.prize_winner,
    prize_runner_up: d.prize_runner_up,
    prize_third: d.prize_third,
    confirmedCount: confirmedCountByDivision[d.id] ?? 0,
    participantCount: participantCountByDivision[d.id] ?? 0,
  }))

  // PDF용 엔트리 변환
  const pdfEntries: PdfEntry[] = entries.map((entry) => {
    const partnerData = entry.partner_data as PartnerData | null
    const teamMembers = entry.team_members as TeamMember[] | null

    // tournament_divisions join도 배열로 추론될 수 있으므로 정규화
    const rawDivision = Array.isArray(entry.tournament_divisions)
      ? (entry.tournament_divisions[0] as { name: string } | undefined) ?? null
      : (entry.tournament_divisions as { name: string } | null)

    return {
      id: entry.id,
      divisionId: entry.division_id,
      divisionName: rawDivision?.name ?? '-',
      playerName: entry.player_name || entry.profiles?.name || '-',
      clubName: entry.club_name || entry.profiles?.club || null,
      // 복식
      partnerName: isDoubles ? (partnerData?.name ?? null) : null,
      partnerClub: isDoubles ? (partnerData?.club ?? null) : null,
      // 단체전: null/undefined/true → 참가, false → 불참
      teamMembers: isTeamMatch ? (teamMembers ?? []) : null,
      applicantParticipates: entry.applicant_participates !== false,
      matchType: tournament.match_type ?? '',
    }
  })

  // PDF 데이터 조립
  const pdfData: PdfTournament = {
    title: tournament.title,
    startDate: tournament.start_date,
    endDate: tournament.end_date,
    location: tournament.location,
    host: tournament.host,
    organizerName: tournament.organizer_name,
    matchType: tournament.match_type,
    teamMatchCount: tournament.team_match_count,
    ballType: tournament.ball_type,
    eligibility: tournament.eligibility,
    openingCeremony: tournament.opening_ceremony,
    entryStartDate: tournament.entry_start_date,
    entryEndDate: tournament.entry_end_date,
    entryFee: tournament.entry_fee,
    bankAccount: tournament.bank_account,
    divisions,
    entries: pdfEntries,
  }

  // PDF 렌더링
  // createElement 반환 타입을 renderToBuffer가 요구하는 타입으로 캐스팅
  const element = React.createElement(
    TournamentPdfDocument,
    { t: pdfData }
  ) as unknown as Parameters<typeof renderToBuffer>[0]
  const pdfBuffer = await renderToBuffer(element)

  // 파일명
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const safeTitle = tournament.title.replace(/[/\\?%*:|"<>]/g, '_')
  const filename = `${safeTitle}_대회요강_${today}.pdf`

  return new NextResponse(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
