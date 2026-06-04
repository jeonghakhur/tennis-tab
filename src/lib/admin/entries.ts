'use server'

import { createClient } from '@/lib/supabase/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { EntryStatus, PaymentStatus } from '@/lib/supabase/types'
import { canManageTournaments, isSuperAdmin } from '@/lib/auth/roles'
import { unformatPhoneNumber } from '@/lib/utils/phone'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { sendTournamentConfirmAlimtalk } from '@/lib/solapi/alimtalk'
import { formatKoreanDateTime } from '@/lib/utils/formatDate'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdminClient = ReturnType<typeof createSupabaseClient<any>>

/** 대기자 자동 승격: 해당 부서에서 가장 오래된 WAITLISTED를 CONFIRMED로 변경 */
async function autoPromoteWaitlisted(
  supabaseAdmin: SupabaseAdminClient,
  divisionId: string,
) {
  const { data: waitlisted } = await supabaseAdmin
    .from('tournament_entries')
    .select('id')
    .eq('division_id', divisionId)
    .eq('status', 'WAITLISTED')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (waitlisted) {
    await supabaseAdmin
      .from('tournament_entries')
      .update({ status: 'CONFIRMED' as const, updated_at: new Date().toISOString() })
      .eq('id', waitlisted.id)
  }
}

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
    .select('tournament_id, division_id, status, phone, player_name, tournaments!inner(organizer_id, title, location, start_date), tournament_divisions!inner(name, match_date, match_location)')
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

  let dbStatus = toDbEntryStatus(status)
  const previousStatus = entry.status as string

  // 승인(CONFIRMED) 시 정원 체크: max_teams 초과이면 WAITLISTED로 전환
  if (dbStatus === 'CONFIRMED' && entry.division_id) {
    const [{ data: division }, { count }] = await Promise.all([
      supabaseAdmin
        .from('tournament_divisions')
        .select('max_teams')
        .eq('id', entry.division_id)
        .single(),
      supabaseAdmin
        .from('tournament_entries')
        .select('*', { count: 'exact', head: true })
        .eq('division_id', entry.division_id)
        .eq('status', 'CONFIRMED'),
    ])

    if (division?.max_teams && (count ?? 0) >= division.max_teams) {
      dbStatus = 'WAITLISTED'
    }
  }

  const { error } = await supabaseAdmin
    .from('tournament_entries')
    .update({ status: dbStatus, updated_at: new Date().toISOString() })
    .eq('id', entryId)

  if (error) {
    return { error: error.message }
  }

  // CONFIRMED → CANCELLED 변경 시 대기자 자동 승격
  if (previousStatus === 'CONFIRMED' && dbStatus === 'CANCELLED') {
    await autoPromoteWaitlisted(supabaseAdmin, entry.division_id)
  }

  // 참가 확정 시 알림톡 발송 (fire-and-forget)
  if (dbStatus === 'CONFIRMED' && entry.phone) {
    const t = entry.tournaments as unknown as { title: string; location: string; start_date: string }
    const d = entry.tournament_divisions as unknown as { name: string; match_date: string | null; match_location: string | null }
    // 부서별 경기 일시 우선, 없으면 대회 전체 시작일 fallback
    const rawDate = d.match_date ?? t.start_date
    const tournamentDate = rawDate ? formatKoreanDateTime(rawDate) : '-'
    const alimtalkResult = await sendTournamentConfirmAlimtalk({
      playerPhone:    entry.phone,
      playerName:     entry.player_name,
      tournamentName: t.title ?? '',
      divisionName:   d.name ?? '',
      tournamentDate,
      venue:          (d.match_location ?? t.location) ?? '-',
      detailUrl:      `https://mapo-tennis.com/tournaments/${entry.tournament_id}`,
    })
    if (alimtalkResult.success) {
      await supabaseAdmin
        .from('tournament_entries')
        .update({ confirm_alimtalk_sent_at: new Date().toISOString() })
        .eq('id', entryId)
    } else {
      console.error('[Alimtalk] 대회 참가 확정 발송 실패:', alimtalkResult.error)
    }
  }

  revalidatePath(`/admin/tournaments/${entry.tournament_id}/entries`)
  return { success: true, actualStatus: dbStatus }
}

/**
 * 대회 참가 확정 알림톡 재발송 (단건)
 * 상태 변경 없이 CONFIRMED 참가자에게만 발송
 */
export async function resendConfirmAlimtalk(
  entryId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canManageTournaments(profile?.role)) {
    return { success: false, error: '권한이 없습니다.' }
  }

  const { data: entry } = await supabase
    .from('tournament_entries')
    .select('tournament_id, status, phone, player_name, tournaments!inner(title, location, start_date), tournament_divisions!inner(name, match_date, match_location)')
    .eq('id', entryId)
    .single()

  if (!entry) return { success: false, error: '참가 신청을 찾을 수 없습니다.' }
  if (entry.status !== 'CONFIRMED') return { success: false, error: '승인된 참가자에게만 발송할 수 있습니다.' }
  if (!entry.phone) return { success: false, error: '전화번호가 없어 발송할 수 없습니다.' }

  const t = entry.tournaments as unknown as { title: string; location: string; start_date: string }
  const d = entry.tournament_divisions as unknown as { name: string; match_date: string | null; match_location: string | null }
  const rawDate = d.match_date ?? t.start_date
  const tournamentDate = rawDate ? formatKoreanDateTime(rawDate) : '-'

  const result = await sendTournamentConfirmAlimtalk({
    playerPhone:    entry.phone,
    playerName:     entry.player_name,
    tournamentName: t.title ?? '',
    divisionName:   d.name ?? '',
    tournamentDate,
    venue:          (d.match_location ?? t.location) ?? '-',
    detailUrl:      `https://mapo-tennis.com/tournaments/${entry.tournament_id}`,
  })

  if (!result.success) return { success: false, error: result.error ?? '발송 실패' }

  const admin = createAdminClient()
  await admin
    .from('tournament_entries')
    .update({ confirm_alimtalk_sent_at: new Date().toISOString() })
    .eq('id', entryId)

  return { success: true }
}

/**
 * 대회 참가 확정 알림톡 일괄 발송
 * 전달된 entryId 중 CONFIRMED + 전화번호 있는 건만 발송
 */
export async function bulkSendConfirmAlimtalk(
  entryIds: string[],
): Promise<{ success: boolean; sent: number; skipped: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, sent: 0, skipped: 0, error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canManageTournaments(profile?.role)) {
    return { success: false, sent: 0, skipped: 0, error: '권한이 없습니다.' }
  }

  const { data: confirmedEntries } = await supabase
    .from('tournament_entries')
    .select('id, tournament_id, status, phone, player_name, tournaments!inner(title, location, start_date), tournament_divisions!inner(name, match_date, match_location)')
    .in('id', entryIds)
    .eq('status', 'CONFIRMED')

  const eligible = (confirmedEntries ?? []).filter((e) => !!e.phone)
  const skipped = entryIds.length - eligible.length

  const admin = createAdminClient()
  const sentAt = new Date().toISOString()

  let sent = 0
  for (const entry of eligible) {
    const t = entry.tournaments as unknown as { title: string; location: string; start_date: string }
    const d = entry.tournament_divisions as unknown as { name: string; match_date: string | null; match_location: string | null }
    const rawDate = d.match_date ?? t.start_date
    const tournamentDate = rawDate ? formatKoreanDateTime(rawDate) : '-'

    const result = await sendTournamentConfirmAlimtalk({
      playerPhone:    entry.phone!,
      playerName:     entry.player_name,
      tournamentName: t.title ?? '',
      divisionName:   d.name ?? '',
      tournamentDate,
      venue:          (d.match_location ?? t.location) ?? '-',
      detailUrl:      `https://mapo-tennis.com/tournaments/${entry.tournament_id}`,
    })
    if (result.success) {
      sent++
      await admin
        .from('tournament_entries')
        .update({ confirm_alimtalk_sent_at: sentAt })
        .eq('id', entry.id)
    }
  }

  return { success: true, sent, skipped }
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

// ────────────────────────────────────────────────────────────
// SUPER_ADMIN 전용 — 참가자 정보 수정
// ────────────────────────────────────────────────────────────

type AdminEntryData = {
  divisionId: string
  playerName: string
  phone: string
  clubName?: string | null
  playerRating?: number | null
  partnerData?: { name: string; club: string; rating: number } | null
  teamMembers?: Array<{ name: string; rating: number; club?: string | null }> | null
  applicantParticipates?: boolean
}

/** SUPER_ADMIN 전용: 기존 참가자 정보 수정 */
export async function adminUpdateEntry(
  entryId: string,
  tournamentId: string,
  data: AdminEntryData
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isSuperAdmin(profile?.role)) {
    return { success: false, error: '최고 관리자만 사용할 수 있습니다.' }
  }

  const admin = createAdminClient()

  const { error } = await admin
    .from('tournament_entries')
    .update({
      division_id: data.divisionId,
      player_name: data.playerName.trim(),
      phone: unformatPhoneNumber(data.phone),
      club_name: data.clubName?.trim() || null,
      player_rating: data.playerRating ?? null,
      partner_data: data.partnerData ?? null,
      team_members: data.teamMembers ?? null,
      applicant_participates: data.applicantParticipates ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', entryId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/admin/tournaments/${tournamentId}/entries`)
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

  // 승인(CONFIRMED) 시 부서별 정원 체크
  if (dbStatus === 'CONFIRMED') {
    // 대상 엔트리들의 부서 정보 조회
    const { data: entries } = await supabaseAdmin
      .from('tournament_entries')
      .select('id, division_id, status')
      .in('id', entryIds)

    if (!entries) {
      return { error: '엔트리 조회에 실패했습니다.' }
    }

    // 부서별로 그룹화
    const byDivision = new Map<string, string[]>()
    for (const e of entries) {
      const ids = byDivision.get(e.division_id) ?? []
      ids.push(e.id)
      byDivision.set(e.division_id, ids)
    }

    const confirmIds: string[] = []
    const waitlistIds: string[] = []

    for (const [divisionId, ids] of byDivision) {
      const [{ data: division }, { count }] = await Promise.all([
        supabaseAdmin
          .from('tournament_divisions')
          .select('max_teams')
          .eq('id', divisionId)
          .single(),
        supabaseAdmin
          .from('tournament_entries')
          .select('*', { count: 'exact', head: true })
          .eq('division_id', divisionId)
          .eq('status', 'CONFIRMED'),
      ])

      if (!division?.max_teams) {
        // 정원 제한 없음 — 모두 CONFIRMED
        confirmIds.push(...ids)
      } else {
        const availableSlots = Math.max(0, division.max_teams - (count ?? 0))
        confirmIds.push(...ids.slice(0, availableSlots))
        waitlistIds.push(...ids.slice(availableSlots))
      }
    }

    const now = new Date().toISOString()
    const updates: PromiseLike<unknown>[] = []

    if (confirmIds.length > 0) {
      updates.push(
        supabaseAdmin
          .from('tournament_entries')
          .update({ status: 'CONFIRMED', updated_at: now })
          .in('id', confirmIds)
      )
    }
    if (waitlistIds.length > 0) {
      updates.push(
        supabaseAdmin
          .from('tournament_entries')
          .update({ status: 'WAITLISTED', updated_at: now })
          .in('id', waitlistIds)
      )
    }

    if (updates.length > 0) {
      await Promise.all(updates)
    }

    // 확정된 항목에 알림톡 일괄 발송
    if (confirmIds.length > 0) {
      const { data: alimtalkEntries } = await supabaseAdmin
        .from('tournament_entries')
        .select('id, tournament_id, phone, player_name, tournaments!inner(title, location, start_date), tournament_divisions!inner(name, match_date, match_location)')
        .in('id', confirmIds)

      const sentAt = new Date().toISOString()
      const sentIds: string[] = []

      for (const ae of (alimtalkEntries ?? []).filter((e) => !!e.phone)) {
        const t = ae.tournaments as unknown as { title: string; location: string; start_date: string }
        const d = ae.tournament_divisions as unknown as { name: string; match_date: string | null; match_location: string | null }
        const rawDate = d.match_date ?? t.start_date
        const tournamentDate = rawDate ? formatKoreanDateTime(rawDate) : '-'

        const result = await sendTournamentConfirmAlimtalk({
          playerPhone:    ae.phone!,
          playerName:     ae.player_name,
          tournamentName: t.title ?? '',
          divisionName:   d.name ?? '',
          tournamentDate,
          venue:          (d.match_location ?? t.location) ?? '-',
          detailUrl:      `https://mapo-tennis.com/tournaments/${ae.tournament_id}`,
        })
        if (result.success) sentIds.push(ae.id)
      }

      if (sentIds.length > 0) {
        await supabaseAdmin
          .from('tournament_entries')
          .update({ confirm_alimtalk_sent_at: sentAt })
          .in('id', sentIds)
      }
    }

    return { success: true }
  }

  // CANCELLED 일괄 변경: CONFIRMED 엔트리 취소 시 부서별 대기자 자동 승격
  if (dbStatus === 'CANCELLED') {
    const { data: entries } = await supabaseAdmin
      .from('tournament_entries')
      .select('id, division_id, status')
      .in('id', entryIds)

    const { error } = await supabaseAdmin
      .from('tournament_entries')
      .update({ status: dbStatus, updated_at: new Date().toISOString() })
      .in('id', entryIds)

    if (error) {
      return { error: error.message }
    }

    // 취소된 CONFIRMED 엔트리의 부서별 대기자 자동 승격
    if (entries) {
      const confirmedDivisions = new Set(
        entries.filter((e) => e.status === 'CONFIRMED').map((e) => e.division_id)
      )
      await Promise.all(
        [...confirmedDivisions].map((divId) => autoPromoteWaitlisted(supabaseAdmin, divId))
      )
    }

    return { success: true }
  }

  // 기타 상태 변경 (PENDING 등)
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
 * 결제 상태 일괄 변경
 */
export async function bulkUpdatePaymentStatus(
  entryIds: string[],
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
