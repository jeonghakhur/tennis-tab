'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { TournamentFormat, UserRole } from '@/lib/supabase/types'

// 대회 생성 권한이 있는 역할
const ALLOWED_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER']

export type CreateTournamentResult =
  | { success: true; tournamentId: string }
  | { success: false; error: string }

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

  if (!profile.role || !ALLOWED_ROLES.includes(profile.role)) {
    return { success: false, error: '대회를 생성할 권한이 없습니다.' }
  }

  // 3. 폼 데이터 유효성 검사
  const title = formData.get('title') as string
  const startDate = formData.get('start_date') as string
  const endDate = formData.get('end_date') as string
  const location = formData.get('location') as string
  const format = formData.get('format') as TournamentFormat
  const maxParticipants = parseInt(formData.get('max_participants') as string)
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

  if (!format) {
    return { success: false, error: '경기 방식을 선택해주세요.' }
  }

  if (isNaN(maxParticipants) || maxParticipants < 2) {
    return { success: false, error: '최대 참가 인원은 2명 이상이어야 합니다.' }
  }

  if (isNaN(entryFee) || entryFee < 0) {
    return { success: false, error: '참가비는 0 이상이어야 합니다.' }
  }

  // 4. 대회 생성
  const tournamentData = {
    title: title.trim(),
    description: (formData.get('description') as string) || null,
    start_date: new Date(startDate).toISOString(),
    end_date: new Date(endDate).toISOString(),
    location: location.trim(),
    address: (formData.get('address') as string) || null,
    max_participants: maxParticipants,
    entry_fee: entryFee,
    format,
    organizer_id: profile.id,
    status: 'OPEN' as const,
  }

  const { data: tournament, error: insertError } = await supabase
    .from('tournaments')
    .insert(tournamentData)
    .select('id')
    .single()

  if (insertError) {
    console.error('Error creating tournament:', insertError)
    return { success: false, error: '대회 생성에 실패했습니다. 다시 시도해주세요.' }
  }

  // 5. 캐시 무효화
  revalidatePath('/tournaments')

  return { success: true, tournamentId: tournament.id }
}
