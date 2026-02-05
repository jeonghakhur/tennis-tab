'use server'

import { createClient } from '@/lib/supabase/server'
import type { EntryStatus, PaymentStatus } from '@/lib/supabase/types'
import { canManageTournaments } from '@/lib/auth/roles'
import { revalidatePath } from 'next/cache'

/**
 * 참가 신청 상태 변경
 */
export async function updateEntryStatus(entryId: string, status: EntryStatus) {
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

  // 상태 변경
  const { error } = await supabase
    .from('tournament_entries')
    .update({ status, updated_at: new Date().toISOString() })
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

  // 결제 상태 변경
  const updateData: { payment_status: PaymentStatus; updated_at: string; payment_confirmed_at?: string } = {
    payment_status: paymentStatus,
    updated_at: new Date().toISOString(),
  }

  if (paymentStatus === 'COMPLETED') {
    updateData.payment_confirmed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('tournament_entries')
    .update(updateData)
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

  // 상태 변경
  const { error } = await supabase
    .from('tournament_entries')
    .update({ status, updated_at: new Date().toISOString() })
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

  // 삭제
  const { error } = await supabase
    .from('tournament_entries')
    .delete()
    .eq('id', entryId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath(`/admin/tournaments/${entry.tournament_id}/entries`)
  return { success: true }
}
