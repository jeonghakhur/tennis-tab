import { createAdminClient } from '@/lib/supabase/admin'
import { decryptProfile } from '@/lib/crypto/profileCrypto'
import type { DivisionInfo, TournamentSearchResult } from './types'

/** LIKE 패턴의 특수문자 이스케이프 */
function escapeLike(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&')
}

/**
 * 참가 신청 가능한 대회 검색
 * status=OPEN이 접수 가능의 source of truth (관리자가 직접 상태 관리)
 * tournamentName이 없으면 전체 조회
 */
export async function searchTournamentForEntry(
  tournamentName?: string,
): Promise<TournamentSearchResult[]> {
  const admin = createAdminClient()

  let query = admin
    .from('tournaments')
    .select('id, title, status, match_type, start_date, entry_fee, bank_account, team_match_count')
    .eq('status', 'OPEN')
    .order('start_date', { ascending: true })
    .limit(5)

  if (tournamentName) {
    query = query.ilike('title', `%${escapeLike(tournamentName)}%`)
  }

  const { data: tournaments, error } = await query

  if (error || !tournaments) return []

  return tournaments.map((t) => ({
    id: t.id,
    title: t.title,
    matchType: t.match_type,
    startDate: t.start_date,
    entryFee: t.entry_fee,
    bankAccount: t.bank_account,
    teamMatchCount: (t as unknown as { team_match_count: number | null }).team_match_count,
  }))
}

/** 대회의 부서 목록 + 각 부서 현재 참가 인원 */
export async function getDivisionsWithCounts(
  tournamentId: string,
): Promise<DivisionInfo[]> {
  const admin = createAdminClient()

  const { data: divisions, error } = await admin
    .from('tournament_divisions')
    .select('id, name, max_teams')
    .eq('tournament_id', tournamentId)

  if (error || !divisions) return []

  // 각 부서의 취소 제외 참가 인원 조회
  const results = await Promise.all(
    divisions.map(async (div) => {
      const { count } = await admin
        .from('tournament_entries')
        .select('*', { count: 'exact', head: true })
        .eq('division_id', div.id)
        .neq('status', 'CANCELLED')

      return {
        id: div.id,
        name: div.name,
        maxTeams: div.max_teams,
        currentCount: count ?? 0,
      }
    }),
  )

  return results
}

/** 사용자 프로필 조회 */
export async function getUserProfile(
  userId: string,
): Promise<{ name: string; phone: string | null; rating: number | null; club: string | null } | null> {
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('profiles')
    .select('name, phone, rating, club')
    .eq('id', userId)
    .single()

  if (error || !data) return null

  // phone이 암호화되어 있을 수 있음 → 복호화 후 반환
  return decryptProfile(data)
}

/** 대회명으로 대회 현재 상태 조회 (OPEN 여부와 무관하게) */
export async function getTournamentStatus(
  tournamentName: string,
): Promise<{ title: string; status: string } | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tournaments')
    .select('title, status')
    .ilike('title', `%${escapeLike(tournamentName)}%`)
    .not('status', 'in', '("DRAFT","CANCELLED")')
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** 특정 대회+부서에 사용자가 이미 신청했는지 확인 */
export async function checkExistingEntry(
  tournamentId: string,
  userId: string,
  divisionId: string,
): Promise<boolean> {
  const admin = createAdminClient()

  const { data } = await admin
    .from('tournament_entries')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
    .eq('division_id', divisionId)
    .neq('status', 'CANCELLED')
    .maybeSingle()

  return !!data
}
