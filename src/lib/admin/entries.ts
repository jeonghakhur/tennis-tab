'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { EntryStatus, PaymentStatus } from '@/lib/supabase/types'
import { canManageTournaments } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'

/** Map UI status to DB enum (remote may only have PENDING, CONFIRMED, WAITLISTED, CANCELLED) */
function toDbEntryStatus(status: EntryStatus): 'PENDING' | 'CONFIRMED' | 'WAITLISTED' | 'CANCELLED' {
  if (status === 'APPROVED') return 'CONFIRMED'
  if (status === 'REJECTED') return 'CANCELLED'
  if (status === 'PENDING' || status === 'CONFIRMED' || status === 'WAITLISTED' || status === 'CANCELLED') {
    return status
  }
  return 'PENDING'
}

/**
 * 참가 신청 상태 변경
 */
export async function updateEntryStatus(entryId: string, status: EntryStatus) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canManageTournaments(profile?.role)) {
    return { error: '권한이 없습니다.' }
  }

  const { data: entry } = await supabase
    .from('tournament_entries')
    .select('tournament_id, tournaments!inner(organizer_id)')
    .eq('id', entryId)
    .single()

  if (!entry) {
    return { error: '참가 신청을 찾을 수 없습니다.' }
  }

  const isAdminOrHigher = ['ADMIN', 'SUPER_ADMIN'].includes(profile?.role ?? '')
  const tournament = entry.tournaments as unknown as { organizer_id: string }

  if (!isAdminOrHigher && tournament.organizer_id !== user.id) {
    return { error: '이 대회의 참가 신청을 관리할 권한이 없습니다.' }
  }

  // RLS: UPDATE는 본인/주최자만 허용. ADMIN·SUPER_ADMIN은 주최자가 아니면 0건 갱신되므로 Service Role로 실행
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { error: '서버 설정 오류입니다. SUPABASE_SERVICE_ROLE_KEY를 확인하세요.' }
  }
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )
  const dbStatus = toDbEntryStatus(status)
  const { error } = await supabaseAdmin
    .from('tournament_entries')
    .update({ status: dbStatus, updated_at: new Date().toISOString() })
    .eq('id', entryId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/admin/tournaments/${entry.tournament_id}/entries`)
  return { success: true }
}

/**
 * 결제 상태 변경
 */
export async function updatePaymentStatus(
  entryId: string,
  paymentStatus: PaymentStatus
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canManageTournaments(profile?.role)) {
    return { error: '권한이 없습니다.' }
  }

  const { data: entry } = await supabase
    .from('tournament_entries')
    .select('tournament_id, tournaments!inner(organizer_id)')
    .eq('id', entryId)
    .single()

  if (!entry) {
    return { error: '참가 신청을 찾을 수 없습니다.' }
  }

  const isAdminOrHigher = ['ADMIN', 'SUPER_ADMIN'].includes(profile?.role ?? '')
  const tournament = entry.tournaments as unknown as { organizer_id: string }

  if (!isAdminOrHigher && tournament.organizer_id !== user.id) {
    return { error: '이 대회의 참가 신청을 관리할 권한이 없습니다.' }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { error: '서버 설정 오류입니다. SUPABASE_SERVICE_ROLE_KEY를 확인하세요.' }
  }
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )
  const { error } = await supabaseAdmin
    .from('tournament_entries')
    .update({
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/admin/tournaments/${entry.tournament_id}/entries`)
  return { success: true }
}

/**
 * 참가 신청 일괄 상태 변경
 */
export async function bulkUpdateEntryStatus(
  entryIds: string[],
  status: EntryStatus
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 사용자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canManageTournaments(profile?.role)) {
    return { error: '권한이 없습니다.' }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { error: '서버 설정 오류입니다. SUPABASE_SERVICE_ROLE_KEY를 확인하세요.' }
  }
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )
  const dbStatus = toDbEntryStatus(status)
  const { error } = await supabaseAdmin
    .from('tournament_entries')
    .update({ status: dbStatus, updated_at: new Date().toISOString() })
    .in('id', entryIds)

  if (error) {
    return { error: error.message }
  }

  return { success: true }
}

/**
 * 참가 신청 삭제
 */
export async function deleteEntry(entryId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: '로그인이 필요합니다.' }
  }

  // 현재 사용자 권한 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canManageTournaments(profile?.role)) {
    return { error: '권한이 없습니다.' }
  }

  // 엔트리 조회 및 권한 확인
  const { data: entry } = await supabase
    .from('tournament_entries')
    .select('tournament_id, tournaments!inner(organizer_id)')
    .eq('id', entryId)
    .single()

  if (!entry) {
    return { error: '참가 신청을 찾을 수 없습니다.' }
  }

  // MANAGER는 자신이 만든 대회만, ADMIN 이상은 모든 대회
  const isAdminOrHigher = ['ADMIN', 'SUPER_ADMIN'].includes(profile?.role ?? '')
  const tournament = entry.tournaments as unknown as { organizer_id: string }

  if (!isAdminOrHigher && tournament.organizer_id !== user.id) {
    return { error: '이 대회의 참가 신청을 관리할 권한이 없습니다.' }
  }

  // 삭제 (RLS에 주최자/관리자 DELETE 정책이 없어 Service Role로 실행)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return { error: '서버 설정 오류입니다. SUPABASE_SERVICE_ROLE_KEY를 확인하세요.' }
  }
  const supabaseAdmin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )
  const { error } = await supabaseAdmin
    .from('tournament_entries')
    .delete()
    .eq('id', entryId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/admin/tournaments/${entry.tournament_id}/entries`)
  return { success: true }
}
