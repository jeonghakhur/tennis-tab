import type { ChatEntities, HandlerResult } from '../types'
import { searchTournamentForEntry, getDivisionsWithCounts, getUserProfile, getTournamentStatus } from '../entryFlow/queries'
import { setSession } from '../entryFlow/sessionStore'
import { buildDivisionListMessage, formatDate } from '../entryFlow/steps'
import type { EntryFlowSession } from '../entryFlow/types'

/**
 * APPLY_TOURNAMENT 핸들러 — 참가 신청 플로우 진입점
 *
 * 접근 권한 분리:
 * - 대회 목록 조회 → 비로그인 OK (공개 데이터)
 * - 부서 선택·신청 진행 → 로그인 필요 (프로필 + 엔트리)
 */
export async function handleApplyTournament(
  entities: ChatEntities,
  userId?: string,
): Promise<HandlerResult> {
  // 1. 신청 가능한 대회 검색 (공개 데이터 — 로그인 불필요)
  const tournamentName = entities.tournament_name
  let tournaments = await searchTournamentForEntry(tournamentName ?? undefined)

  // Gemini가 "대회", "경기" 등 일반 명사를 대회명에 포함했을 경우 폴백 재시도
  if (tournaments.length === 0 && tournamentName) {
    const stripped = tournamentName.replace(/\s*(대회|경기|선수권대회|선수권)$/, '').trim()
    if (stripped && stripped !== tournamentName) {
      tournaments = await searchTournamentForEntry(stripped)
    }
  }

  if (tournaments.length === 0) {
    // 대회명을 지정했을 때: 대회가 존재하지만 OPEN이 아닌 경우 상태 안내
    if (tournamentName) {
      const STATUS_LABEL: Record<string, string> = {
        UPCOMING: '접수 예정',
        CLOSED: '접수 마감',
        IN_PROGRESS: '대회 진행 중',
        COMPLETED: '대회 종료',
      }
      const found = await getTournamentStatus(tournamentName)
      if (found) {
        const statusText = STATUS_LABEL[found.status] ?? found.status
        return {
          success: true,
          message: `"${found.title}"은(는) 현재 신청할 수 없습니다.\n현재 상태: ${statusText}\n\n접수 중인 다른 대회를 찾으시려면 "신청 가능한 대회 알려줘"라고 말씀해 주세요.`,
          links: [{ label: '대회 목록', href: '/tournaments' }],
        }
      }
    }
    const noResultMsg = tournamentName
      ? `"${tournamentName}" 대회를 찾을 수 없습니다.\n현재 접수 중인 대회만 신청 가능합니다.`
      : '현재 참가 신청 가능한 대회가 없습니다.'
    return {
      success: true,
      message: noResultMsg,
      links: [{ label: '대회 목록', href: '/tournaments' }],
    }
  }

  // 2. 대회 목록 포맷
  const lines = tournaments.map((t, i) =>
    `${i + 1}. ${t.title} (${formatDate(t.startDate)})`,
  )
  const header = tournamentName
    ? `"${tournamentName}" 검색 결과:`
    : '현재 참가 신청 가능한 대회:'

  // 3. 비로그인 → 목록은 보여주되, 신청 진행은 로그인 안내
  if (!userId) {
    return {
      success: true,
      message: `${header}\n${lines.join('\n')}\n\n참가 신청을 하려면 로그인이 필요합니다.`,
      links: [
        { label: '로그인', href: '/auth/login' },
        ...tournaments.map((t) => ({ label: `${t.title} 상세`, href: `/tournaments/${t.id}` })),
      ],
    }
  }

  // 4. 로그인 상태 → 프로필 조회
  const profile = await getUserProfile(userId)
  if (!profile) {
    return {
      success: false,
      message: '프로필 정보를 불러올 수 없습니다. 프로필을 먼저 설정해주세요.',
      links: [{ label: '프로필 설정', href: '/my/profile' }],
    }
  }

  // 5. 대회 1개 → 바로 부서 선택
  if (tournaments.length === 1) {
    return createSessionAndShowDivisions(userId, tournaments[0], profile)
  }

  // 6. 복수 대회 → SELECT_TOURNAMENT 단계 (세션 시작)
  const session: EntryFlowSession = {
    userId,
    step: 'SELECT_TOURNAMENT',
    data: {
      tournamentId: '',
      tournamentTitle: '',
      matchType: null,
      entryFee: 0,
      bankAccount: null,
      teamMatchCount: null,
      playerName: profile.name,
      phone: profile.phone ?? '',
      playerRating: profile.rating,
      divisions: [],
      searchResults: tournaments,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await setSession(userId, session)

  return {
    success: true,
    message: `${header}\n${lines.join('\n')}\n\n번호 또는 대회명으로 선택해주세요. (취소: "취소")`,
    flow_active: true,
  }
}

/** 대회 하나 확정 → 부서 목록 조회 → 세션 생성 */
async function createSessionAndShowDivisions(
  userId: string,
  tournament: { id: string; title: string; matchType: import('@/lib/supabase/types').MatchType | null; startDate: string; entryFee: number; bankAccount: string | null; teamMatchCount: number | null },
  profile: { name: string; phone: string | null; rating: number | null },
): Promise<HandlerResult> {
  const divisions = await getDivisionsWithCounts(tournament.id)
  if (divisions.length === 0) {
    return {
      success: true,
      message: `${tournament.title}에 참가 가능한 부서가 없습니다.`,
      links: [{ label: '대회 상세', href: `/tournaments/${tournament.id}` }],
    }
  }

  const session: EntryFlowSession = {
    userId,
    step: 'SELECT_DIVISION',
    data: {
      tournamentId: tournament.id,
      tournamentTitle: tournament.title,
      matchType: tournament.matchType,
      entryFee: tournament.entryFee,
      bankAccount: tournament.bankAccount,
      teamMatchCount: tournament.teamMatchCount,
      playerName: profile.name,
      phone: profile.phone ?? '',
      playerRating: profile.rating,
      divisions,
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  await setSession(userId, session)

  return {
    success: true,
    message: buildDivisionListMessage(tournament.title, tournament.entryFee, divisions),
    flow_active: true,
  }
}
