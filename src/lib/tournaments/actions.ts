'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { MatchType, UserRole } from '@/lib/supabase/types'

// 대회 생성 권한이 있는 역할
const ALLOWED_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER']

export type CreateTournamentResult =
  | { success: true; tournamentId: string }
  | { success: false; error: string }

export type DivisionInput = {
  id?: string  // 기존 부서는 id 포함, 새 부서는 id 없음
  name: string
  max_teams: number | null
  team_member_limit: number | null
  match_date: string | null
  match_location: string | null
  prize_winner: string | null
  prize_runner_up: string | null
  prize_third: string | null
  notes: string | null
}

// 대회 데이터 타입 (DB Insert/Update용)
type TournamentData = {
  title: string
  description: string | null
  poster_url: string | null
  start_date: string
  end_date: string
  location: string
  address: string | null
  host: string | null
  organizer_name: string | null
  ball_type: string | null
  entry_start_date: string | null
  entry_end_date: string | null
  opening_ceremony: string | null
  match_type: MatchType | null
  bank_account: string | null
  eligibility: string | null
  max_participants: number
  entry_fee: number
  team_match_count?: number | null
  requirements: { team_match_count: number | null }
  format?: 'SINGLE_ELIMINATION' | 'DOUBLE_ELIMINATION' | 'LEAGUE' | 'MIXED'
  organizer_id?: string
  status?: 'DRAFT' | 'OPEN' | 'CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
}

export async function createTournament(formData: FormData): Promise<CreateTournamentResult> {
  const supabase = await createClient()

  // 1. 현재 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  // 2. 프로필 및 역할 확인
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return { success: false, error: '프로필을 찾을 수 없습니다.' }
  }

  /*
  if (!profile.role || !ALLOWED_ROLES.includes(profile.role)) {
    return { success: false, error: '대회를 생성할 권한이 없습니다.' }
  }
  */

  // 3. 폼 데이터 유효성 검사
  const title = formData.get('title') as string
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  const location = formData.get('location') as string
  const matchType = formData.get('match_type') as MatchType | null
  const entryFee = parseInt(formData.get('entry_fee') as string || '0')
  const teamMatchCountRaw = formData.get('team_match_count') as string
  const teamMatchCount = teamMatchCountRaw ? parseInt(teamMatchCountRaw) : null
  const validatedTeamMatchCount = isNaN(teamMatchCount as number) ? null : teamMatchCount

  if (!title || title.trim().length === 0) {
    return { success: false, error: '대회명을 입력해주세요.' }
  }

  if (!startDate) {
    return { success: false, error: '시작 일시를 선택해주세요.' }
  }

  if (!endDate) {
    return { success: false, error: '종료 일시를 선택해주세요.' }
  }

  if (new Date(startDate) > new Date(endDate)) {
    return { success: false, error: '종료 일시는 시작 일시 이후여야 합니다.' }
  }

  if (!location || location.trim().length === 0) {
    return { success: false, error: '장소를 입력해주세요.' }
  }

  if (isNaN(entryFee) || entryFee < 0) {
    return { success: false, error: '참가비는 0 이상이어야 합니다.' }
  }

  // 날짜 변환 헬퍼
  const toISOStringOrNull = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toISOString()
  }

  // Admin Client 생성 (Service Role Key 사용)
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3' // fallback for dev
  )

  // 4. 대회 생성
  const posterUrl = formData.get('poster_url') as string
  const tournamentData: TournamentData = {
    title: title.trim(),
    description: (formData.get('description') as string) || null,
    poster_url: posterUrl || null,
    start_date: new Date(startDate).toISOString(),
    end_date: new Date(endDate).toISOString(),
    location: location.trim(),
    address: (formData.get('address') as string) || null,
    host: (formData.get('host') as string) || null,
    organizer_name: (formData.get('organizer_name') as string) || null,
    ball_type: (formData.get('ball_type') as string) || null,
    entry_start_date: toISOStringOrNull(formData.get('entry_start_date') as string),
    entry_end_date: toISOStringOrNull(formData.get('entry_end_date') as string),
    opening_ceremony: toISOStringOrNull(formData.get('opening_ceremony') as string),
    match_type: matchType || null,
    bank_account: (formData.get('bank_account') as string) || null,
    eligibility: (formData.get('eligibility') as string) || null,
    max_participants: parseInt(formData.get('max_participants') as string) || 32,
    entry_fee: entryFee,
    team_match_count: validatedTeamMatchCount,
    // requirements JSONB 필드에 백업 저장
    requirements: {
      team_match_count: validatedTeamMatchCount
    },
    format: 'SINGLE_ELIMINATION' as const,
    organizer_id: profile.id,
    status: 'OPEN' as const,
  }

  // Use supabaseAdmin
  let { data: tournament, error: insertError } = await supabaseAdmin
    .from('tournaments')
    .insert(tournamentData)
    .select('id')
    .single()

  // team_match_count 컬럼이 없는 경우 재시도
  if (insertError && insertError.message.includes('team_match_count')) {
    const { team_match_count, ...fallbackData } = tournamentData
    const { data: retryData, error: retryError } = await supabaseAdmin
      .from('tournaments')
      .insert(fallbackData)
      .select('id')
      .single()
    tournament = retryData
    insertError = retryError
  }

  if (insertError) {
    return { success: false, error: '대회 생성에 실패했습니다. 다시 시도해주세요.' }
  }

  // 5. 참가부서 생성
  const divisionsJson = formData.get('divisions') as string
  if (divisionsJson) {
    try {
      const divisions: DivisionInput[] = JSON.parse(divisionsJson)
      if (divisions.length > 0) {
        const divisionData = divisions.map(div => ({
          tournament_id: tournament!.id,
          name: div.name,
          max_teams: div.max_teams,
          team_member_limit: div.team_member_limit,
          match_date: div.match_date ? new Date(div.match_date).toISOString() : null,
          match_location: div.match_location,
          prize_winner: div.prize_winner,
          prize_runner_up: div.prize_runner_up,
          prize_third: div.prize_third,
          notes: div.notes,
        }))

        // Use supabaseAdmin
        const { error: divisionError } = await supabaseAdmin
          .from('tournament_divisions')
          .insert(divisionData)

        // 참가부서 생성 실패해도 대회는 이미 생성됨
        void divisionError
      }
    } catch {
      // JSON 파싱 실패 시 무시
    }
  }

  // 6. 캐시 무효화
  revalidatePath('/tournaments')

  return { success: true, tournamentId: tournament!.id }
}

export type UpdateTournamentResult =
  | { success: true; tournamentId: string }
  | { success: false; error: string }

export async function updateTournament(
  tournamentId: string,
  formData: FormData
): Promise<UpdateTournamentResult> {
  const supabase = await createClient()

  // 1. 현재 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  // 2. 대회 확인 및 권한 체크
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('organizer_id')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { success: false, error: '대회를 찾을 수 없습니다.' }
  }

  // 3. 주최자 본인인지 확인
  if (tournament.organizer_id !== user.id) {
    return { success: false, error: '대회를 수정할 권한이 없습니다.' }
  }

  // 4. 폼 데이터 유효성 검사
  const title = formData.get('title') as string
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  const location = formData.get('location') as string
  const matchType = formData.get('match_type') as MatchType | null
  const entryFee = parseInt(formData.get('entry_fee') as string || '0')
  const teamMatchCountRaw = formData.get('team_match_count') as string
  const teamMatchCount = teamMatchCountRaw ? parseInt(teamMatchCountRaw) : null
  const validatedTeamMatchCount = isNaN(teamMatchCount as number) ? null : teamMatchCount

  if (!title || title.trim().length === 0) {
    return { success: false, error: '대회명을 입력해주세요.' }
  }

  if (!startDate) {
    return { success: false, error: '시작 일시를 선택해주세요.' }
  }

  if (!endDate) {
    return { success: false, error: '종료 일시를 선택해주세요.' }
  }

  if (new Date(startDate) > new Date(endDate)) {
    return { success: false, error: '종료 일시는 시작 일시 이후여야 합니다.' }
  }

  if (!location || location.trim().length === 0) {
    return { success: false, error: '장소를 입력해주세요.' }
  }

  if (isNaN(entryFee) || entryFee < 0) {
    return { success: false, error: '참가비는 0 이상이어야 합니다.' }
  }

  // 날짜 변환 헬퍼
  const toISOStringOrNull = (dateStr: string | null) => {
    if (!dateStr) return null
    return new Date(dateStr).toISOString()
  }

  // Admin Client 생성
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3'
  )

  // 5. 대회 업데이트
  const posterUrl = formData.get('poster_url') as string
  const tournamentData: TournamentData = {
    title: title.trim(),
    description: (formData.get('description') as string) || null,
    poster_url: posterUrl || null,
    start_date: new Date(startDate).toISOString(),
    end_date: new Date(endDate).toISOString(),
    location: location.trim(),
    address: (formData.get('address') as string) || null,
    host: (formData.get('host') as string) || null,
    organizer_name: (formData.get('organizer_name') as string) || null,
    ball_type: (formData.get('ball_type') as string) || null,
    entry_start_date: toISOStringOrNull(formData.get('entry_start_date') as string),
    entry_end_date: toISOStringOrNull(formData.get('entry_end_date') as string),
    opening_ceremony: toISOStringOrNull(formData.get('opening_ceremony') as string),
    match_type: matchType || null,
    bank_account: (formData.get('bank_account') as string) || null,
    eligibility: (formData.get('eligibility') as string) || null,
    max_participants: parseInt(formData.get('max_participants') as string) || 32,
    entry_fee: entryFee,
    team_match_count: validatedTeamMatchCount,
    // requirements JSONB 필드에 백업 저장
    requirements: {
      team_match_count: validatedTeamMatchCount
    },
  }

  let { error: updateError } = await supabaseAdmin
    .from('tournaments')
    .update(tournamentData)
    .eq('id', tournamentId)

  // team_match_count 컬럼이 없는 경우 재시도
  if (updateError && updateError.message.includes('team_match_count')) {
    const { team_match_count, ...fallbackData } = tournamentData
    const { error: retryError } = await supabaseAdmin
      .from('tournaments')
      .update(fallbackData)
      .eq('id', tournamentId)
    updateError = retryError
  }

  if (updateError) {
    const errorMsg = updateError.message || '대회 수정에 실패했습니다.'
    return { success: false, error: errorMsg }
  }

  // 6. 참가부서 처리 (기존 부서 업데이트, 삭제된 부서 제거, 새 부서 추가)
  const divisionsJson = formData.get('divisions') as string
  if (divisionsJson) {
    try {
      const divisions: DivisionInput[] = JSON.parse(divisionsJson)

      // 기존 부서 ID 목록 가져오기
      const { data: existingDivisions } = await supabaseAdmin
        .from('tournament_divisions')
        .select('id')
        .eq('tournament_id', tournamentId)

      const existingIds = existingDivisions?.map(d => d.id) || []
      const submittedIds = divisions.filter(d => d.id).map(d => d.id as string)

      // 삭제할 부서 ID (기존에 있지만 제출된 목록에 없는 것)
      const idsToDelete = existingIds.filter(id => !submittedIds.includes(id))

      // 기존 부서 삭제 (ON DELETE CASCADE로 관련 참가 신청도 함께 삭제됨)
      if (idsToDelete.length > 0) {
        const { error: deleteError } = await supabaseAdmin
          .from('tournament_divisions')
          .delete()
          .in('id', idsToDelete)

        // 부서 삭제 실패 시 무시
        void deleteError
      }

      // 기존 부서 업데이트 및 새 부서 추가
      for (const div of divisions) {
        const divisionData = {
          tournament_id: tournamentId,
          name: div.name,
          max_teams: div.max_teams,
          team_member_limit: div.team_member_limit,
          match_date: div.match_date ? new Date(div.match_date).toISOString() : null,
          match_location: div.match_location,
          prize_winner: div.prize_winner,
          prize_runner_up: div.prize_runner_up,
          prize_third: div.prize_third,
          notes: div.notes,
        }

        if (div.id && existingIds.includes(div.id)) {
          // 기존 부서 업데이트
          await supabaseAdmin
            .from('tournament_divisions')
            .update(divisionData)
            .eq('id', div.id)
        } else {
          // 새 부서 추가
          await supabaseAdmin
            .from('tournament_divisions')
            .insert(divisionData)
        }
      }
    } catch {
      // JSON 파싱 실패 시 무시
    }
  }

  // 8. 캐시 무효화
  revalidatePath('/tournaments')
  revalidatePath(`/tournaments/${tournamentId}`)

  return { success: true, tournamentId }
}

export type DeleteTournamentResult =
  | { success: true }
  | { success: false; error: string }

export async function deleteTournament(tournamentId: string): Promise<DeleteTournamentResult> {
  const supabase = await createClient()

  // 1. 현재 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  // 2. 대회 확인 및 권한 체크
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('organizer_id')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { success: false, error: '대회를 찾을 수 없습니다.' }
  }

  // 3. 주최자 본인인지 확인
  if (tournament.organizer_id !== user.id) {
    return { success: false, error: '대회를 삭제할 권한이 없습니다.' }
  }

  // Admin Client 생성
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3'
  )

  // 4. 참가부서 먼저 삭제 (외래키 제약조건)
  await supabaseAdmin
    .from('tournament_divisions')
    .delete()
    .eq('tournament_id', tournamentId)

  // 5. 대회 삭제
  const { error: deleteError } = await supabaseAdmin
    .from('tournaments')
    .delete()
    .eq('id', tournamentId)

  if (deleteError) {
    return { success: false, error: '대회 삭제에 실패했습니다. 다시 시도해주세요.' }
  }

  // 6. 캐시 무효화
  revalidatePath('/tournaments')

  return { success: true }
}

export type CloseTournamentResult =
  | { success: true }
  | { success: false; error: string }

export async function closeTournament(tournamentId: string): Promise<CloseTournamentResult> {
  const supabase = await createClient()

  // 1. 현재 사용자 확인
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: '로그인이 필요합니다.' }
  }

  // 2. 대회 확인 및 권한 체크
  const { data: tournament, error: tournamentError } = await supabase
    .from('tournaments')
    .select('organizer_id, status')
    .eq('id', tournamentId)
    .single()

  if (tournamentError || !tournament) {
    return { success: false, error: '대회를 찾을 수 없습니다.' }
  }

  // 3. 주최자 본인인지 확인
  if (tournament.organizer_id !== user.id) {
    return { success: false, error: '대회를 마감할 권한이 없습니다.' }
  }

  // 4. 이미 마감 상태인지 확인
  if (tournament.status === 'CLOSED') {
    return { success: false, error: '이미 마감된 대회입니다.' }
  }

  // Admin Client 생성
  const supabaseAdmin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3'
  )

  // 5. 대회 상태를 CLOSED로 변경
  const { error: updateError } = await supabaseAdmin
    .from('tournaments')
    .update({ status: 'CLOSED' })
    .eq('id', tournamentId)

  if (updateError) {
    return { success: false, error: '대회 마감에 실패했습니다. 다시 시도해주세요.' }
  }

  // 6. 캐시 무효화
  revalidatePath('/tournaments')
  revalidatePath(`/tournaments/${tournamentId}`)

  return { success: true }
}
