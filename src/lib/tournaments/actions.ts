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
  const tournamentData = {
    title: title.trim(),
    description: (formData.get('description') as string) || null,
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
    format: 'SINGLE_ELIMINATION' as const,
    organizer_id: profile.id,
    status: 'OPEN' as const,
  }

  // Use supabaseAdmin
  const { data: tournament, error: insertError } = await supabaseAdmin
    .from('tournaments')
    .insert(tournamentData)
    .select('id')
    .single()

  if (insertError) {
    console.error('Error creating tournament:', insertError)
    return { success: false, error: '대회 생성에 실패했습니다. 다시 시도해주세요.' }
  }

  // 5. 참가부서 생성
  const divisionsJson = formData.get('divisions') as string
  if (divisionsJson) {
    try {
      const divisions: DivisionInput[] = JSON.parse(divisionsJson)
      if (divisions.length > 0) {
        const divisionData = divisions.map(div => ({
          tournament_id: tournament.id,
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

        if (divisionError) {
          console.error('Error creating divisions:', divisionError)
          // 참가부서 생성 실패해도 대회는 이미 생성됨
        }
      }
    } catch (e) {
      console.error('Error parsing divisions:', e)
    }
  }

  // 6. 캐시 무효화
  revalidatePath('/tournaments')

  return { success: true, tournamentId: tournament.id }
}
