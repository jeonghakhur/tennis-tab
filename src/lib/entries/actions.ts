'use server';

import { createClient, getUserWithTimeout } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { createNotification } from '@/lib/notifications/actions'
import { NotificationType } from '@/lib/notifications/types'
import { sendTournamentApplyAlimtalk, sendPaymentConfirmAlimtalk } from '@/lib/solapi/alimtalk'

// 파트너 검색 결과 타입
export interface PartnerSearchResult {
    id: string
    name: string
    rating: number | null
    club: string | null
    birthYear: string | null
}

// 결과 타입 정의
export interface CreateEntryResult {
    success: boolean;
    error?: string;
    entryId?: string;
}

export interface UpdateEntryResult {
    success: boolean;
    error?: string;
}

export interface DeleteEntryResult {
    success: boolean;
    error?: string;
}

/**
 * 대회 참가 신청 생성 (확장된 버전)
 */
export interface ClubMemberInfo {
    name: string;
    rating: number | null;
}

/**
 * 클럽명으로 ACTIVE 회원 목록 조회 (단체전 팀원 검증 + rating 자동 채우기용)
 * - 시스템에 등록되지 않은 클럽이면 빈 배열 반환 → 검증 skip
 */
export async function getClubMembersByClubName(clubName: string): Promise<ClubMemberInfo[]> {
    if (!clubName.trim()) return [];
    const admin = createAdminClient();

    const { data: club } = await admin
        .from('clubs')
        .select('id')
        .ilike('name', clubName.trim())
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

    if (!club) return [];

    const { data: members } = await admin
        .from('club_members')
        .select('name, rating')
        .eq('club_id', club.id)
        .eq('status', 'ACTIVE');

    return (members ?? []).map((m) => ({
        name: m.name,
        rating: m.rating !== null ? Number(m.rating) : null,
    }));
}

/**
 * 이름으로 파트너 검색 (복식 신청 시 시스템 사용자 검색용)
 */
export async function searchPartnerByName(name: string): Promise<PartnerSearchResult[]> {
    if (!name || name.trim().length < 2) return []

    const admin = createAdminClient()
    const { data } = await admin
        .from('profiles')
        .select('id, name, rating, club, birth_year')
        .ilike('name', `%${name.trim()}%`)
        .limit(10)

    return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name ?? '',
        rating: p.rating,
        club: p.club,
        birthYear: p.birth_year,
    }))
}

export async function createEntry(
    tournamentId: string,
    entryData: {
        divisionId: string;
        phone: string;
        playerName: string;
        playerRating: number | null;
        clubName?: string | null;
        teamOrder?: string | null;
        partnerData?: { name: string; club: string; rating: number } | null;
        partnerUserId?: string | null;
        teamMembers?: Array<{ name: string; rating: number }> | null;
        applicantParticipates?: boolean;
        refundBank?: string | null;
        refundAccount?: string | null;
        refundHolder?: string | null;
    }
): Promise<CreateEntryResult> {
    try {
        const supabase = await createClient();

        // 1. 사용자 인증 확인
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: '로그인이 필요합니다.' };
        }

        // 2. 대회 정보 확인
        const { data: tournament, error: tournamentError } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (tournamentError || !tournament) {
            return { success: false, error: '대회를 찾을 수 없습니다.' };
        }

        // 3. 대회 상태 확인 (OPEN 상태에서만 신청 가능)
        if (tournament.status !== 'OPEN') {
            return { success: false, error: '현재 접수 기간이 아닙니다.' };
        }

        // 4. 부서 정보 확인
        const { data: division, error: divisionError } = await supabase
            .from('tournament_divisions')
            .select('*')
            .eq('id', entryData.divisionId)
            .eq('tournament_id', tournamentId)
            .single();

        if (divisionError || !division) {
            return { success: false, error: '참가 부서를 찾을 수 없습니다.' };
        }

        // 5. 정원 체크: CONFIRMED 수가 max_teams 이상이면 WAITLISTED 처리
        let initialStatus: 'PENDING' | 'WAITLISTED' = 'PENDING';
        if (division.max_teams) {
            const { count } = await supabase
                .from('tournament_entries')
                .select('*', { count: 'exact', head: true })
                .eq('division_id', entryData.divisionId)
                .eq('status', 'CONFIRMED');

            if ((count ?? 0) >= division.max_teams) {
                initialStatus = 'WAITLISTED';
            }
        }

        // 6. 팀 순서 자동 설정 (단체전이고 teamOrder가 없는 경우)
        // 같은 클럽 팀들을 신청일 오름차순으로 재정렬하여 가/나/다... 재부여
        // → 두 번째 팀 등록 시 첫 번째 팀이 '가'로 자동 수정됨
        const admin = createAdminClient();
        let finalTeamOrder = entryData.teamOrder;
        if ((tournament.match_type === 'TEAM_SINGLES' || tournament.match_type === 'TEAM_DOUBLES') &&
            entryData.clubName && !entryData.teamOrder) {

            const orders = ['가', '나', '다', '라', '마', '바', '사', '아'];

            // 같은 클럽의 기존 등록 팀들 조회 (취소 제외, 신청일 오름차순)
            const { data: existingClubEntries } = await admin
                .from('tournament_entries')
                .select('id, team_order')
                .eq('tournament_id', tournamentId)
                .eq('division_id', entryData.divisionId)
                .eq('club_name', entryData.clubName)
                .neq('status', 'CANCELLED')
                .order('created_at', { ascending: true });

            if (existingClubEntries && existingClubEntries.length > 0) {
                // 기존 팀들 순서 재할당: null이거나 잘못된 순서는 정정
                for (let i = 0; i < existingClubEntries.length; i++) {
                    const expectedOrder = orders[i];
                    if (existingClubEntries[i].team_order !== expectedOrder) {
                        await admin
                            .from('tournament_entries')
                            .update({ team_order: expectedOrder })
                            .eq('id', existingClubEntries[i].id);
                    }
                }
                // 새 팀은 그 다음 순서
                finalTeamOrder = orders[existingClubEntries.length] ?? null;
            }
            // 기존 팀 없으면 첫 번째 팀 → team_order null 유지
            // (두 번째 팀 등록 시 위 로직에서 '가'로 소급 수정됨)
        }

        // 7. 참가 신청 생성 (Service Role로 INSERT → RLS 우회, 이미 본인 user_id로 검증됨)
        const insertPayload: Record<string, unknown> = {
            tournament_id: tournamentId,
            user_id: user.id,
            division_id: entryData.divisionId,
            phone: entryData.phone ?? '',
            player_name: entryData.playerName ?? '',
            player_rating: entryData.playerRating ?? null,
            club_name: entryData.clubName ?? null,
            team_order: finalTeamOrder ?? null,
            partner_data: entryData.partnerData ?? null,
            partner_user_id: entryData.partnerUserId ?? null,
            team_members: entryData.teamMembers ?? null,
            applicant_participates: entryData.applicantParticipates ?? true,
            status: initialStatus,
            payment_status: 'PENDING',
            refund_bank: entryData.refundBank ?? null,
            refund_account: entryData.refundAccount ?? null,
            refund_holder: entryData.refundHolder ?? null,
        };
        const { data: newEntry, error: insertError } = await admin
            .from('tournament_entries')
            .insert(insertPayload)
            .select('id')
            .single();

        if (insertError) {
            console.error('Insert error:', insertError);
            return {
                success: false,
                error: insertError.message || '참가 신청에 실패했습니다.',
            };
        }

        if (!newEntry?.id) {
            return { success: false, error: '참가 신청 처리 후 결과를 확인할 수 없습니다.' };
        }

        // 알림: 주최자에게 참가 신청 접수 알림
        try {
            await createNotification({
                user_id: tournament.organizer_id,
                type: NotificationType.ENTRY_SUBMITTED,
                title: '참가 신청 접수',
                message: `${entryData.playerName}님이 참가 신청했습니다.`,
                tournament_id: tournamentId,
                entry_id: newEntry.id,
                metadata: { link: `/admin/tournaments/${tournamentId}/entries` },
            })
        } catch { /* 알림 실패가 메인 기능을 막지 않음 */ }

        // 알림톡: 참가자에게 신청 완료 알림 (fire-and-forget)
        if (initialStatus !== 'WAITLISTED' && entryData.phone) {
            const alimtalkResult = await sendTournamentApplyAlimtalk({
                playerPhone: entryData.phone,
                playerName: entryData.playerName,
                tournamentName: tournament.title ?? '',
                divisionName: division.name ?? '',
                tournamentDate: tournament.start_date ?? '-',
                venue: tournament.location ?? '-',
                tournamentId,
            })
            if (!alimtalkResult.success) {
                console.error('[Alimtalk] 대회 참가 신청 발송 실패:', alimtalkResult.error)
            }
        }

        // 8. 캐시 무효화
        revalidatePath(`/tournaments/${tournamentId}`);
        revalidatePath('/tournaments');
        revalidatePath('/my/entries');

        return { success: true, entryId: newEntry.id };
    } catch (error) {
        console.error('Create entry error:', error);
        return { success: false, error: '참가 신청 중 오류가 발생했습니다.' };
    }
}


export interface RefundInfo {
    bank: string
    account: string
    holder: string
}

/**
 * 내부 취소 헬퍼 — 인증 없이 entryId + userId로 소프트 삭제 + 대기자 승격
 * deleteEntry(사용자 Server Action)와 cancelFlow(채팅 핸들러) 양쪽에서 재사용
 * 환불 계좌는 신청 시 이미 저장되어 있으므로 별도 전달 불필요
 */
export async function cancelEntryByAdmin(
    entryId: string,
    userId: string,
): Promise<DeleteEntryResult> {
    const admin = createAdminClient();

    // 1. 신청 정보 조회 (상태/division_id/payment_status/refund_bank 필요)
    const { data: entry, error: entryError } = await admin
        .from('tournament_entries')
        .select('id, user_id, status, division_id, tournament_id, payment_status, refund_bank')
        .eq('id', entryId)
        .eq('user_id', userId)
        .single();

    if (entryError || !entry) {
        return { success: false, error: '신청 정보를 찾을 수 없습니다.' };
    }

    // 2. 대진표 배정 여부 확인
    const { count: bracketCount } = await admin
        .from('bracket_matches')
        .select('id', { count: 'exact', head: true })
        .or(`team1_entry_id.eq.${entryId},team2_entry_id.eq.${entryId}`);

    if ((bracketCount ?? 0) > 0) {
        return { success: false, error: '대진표에 배정된 참가 신청은 취소할 수 없습니다. 주최자에게 문의하세요.' };
    }

    const wasConfirmed = entry.status === 'CONFIRMED';
    // 입금 완료 + 환불 계좌 보유 시 REQUESTED, 그 외 NONE
    const needsRefund = entry.payment_status === 'COMPLETED' && !!(entry as Record<string, unknown>).refund_bank;
    const now = new Date().toISOString();

    // 3. 소프트 삭제: CANCELLED + 환불 상태 설정
    const { error: cancelError } = await admin
        .from('tournament_entries')
        .update({
            status: 'CANCELLED',
            updated_at: now,
            cancelled_at: now,
            refund_status: needsRefund ? 'REQUESTED' : 'NONE',
        })
        .eq('id', entryId)
        .eq('user_id', userId);

    if (cancelError) {
        return { success: false, error: cancelError.message || '신청 취소에 실패했습니다.' };
    }

    // 알림: 주최자에게 참가 취소 알림
    try {
        const { data: tournament } = await admin
            .from('tournaments')
            .select('organizer_id')
            .eq('id', entry.tournament_id)
            .single()
        if (tournament) {
            await createNotification({
                user_id: tournament.organizer_id,
                type: NotificationType.ENTRY_CANCELLED,
                title: '참가 취소',
                message: '참가자가 신청을 취소했습니다.',
                tournament_id: entry.tournament_id,
                entry_id: entryId,
                metadata: { link: `/admin/tournaments/${entry.tournament_id}/entries` },
            })
        }
    } catch { /* 알림 실패가 메인 기능을 막지 않음 */ }

    // 4. CONFIRMED 취소 시 대기자 자동 승격
    if (wasConfirmed) {
        const { data: waitlisted } = await admin
            .from('tournament_entries')
            .select('id')
            .eq('division_id', entry.division_id)
            .eq('status', 'WAITLISTED')
            .order('created_at', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (waitlisted) {
            await admin
                .from('tournament_entries')
                .update({ status: 'CONFIRMED', updated_at: now })
                .eq('id', waitlisted.id);
        }
    }

    revalidatePath(`/tournaments/${entry.tournament_id}`);
    revalidatePath('/tournaments');
    revalidatePath('/my/entries');

    return { success: true };
}

/**
 * 참가 신청 취소 (본인용) — 환불 계좌는 신청 시 이미 저장됨
 */
export async function deleteEntry(entryId: string): Promise<DeleteEntryResult> {
    try {
        const supabase = await createClient();

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: '로그인이 필요합니다.' };
        }

        const { data: entry, error: entryError } = await supabase
            .from('tournament_entries')
            .select('id, user_id')
            .eq('id', entryId)
            .single();

        if (entryError || !entry) {
            return { success: false, error: '신청 정보를 찾을 수 없습니다.' };
        }

        if (entry.user_id !== user.id) {
            return { success: false, error: '본인의 신청만 취소할 수 있습니다.' };
        }

        return cancelEntryByAdmin(entryId, user.id);
    } catch (error) {
        console.error('Delete entry error:', error);
        return { success: false, error: '신청 취소 중 오류가 발생했습니다.' };
    }
}

/**
 * 관리자: 환불 완료 처리 (하위 호환)
 */
export async function markRefundComplete(entryId: string): Promise<{ success: boolean; error?: string }> {
    return updateRefundStatus(entryId, 'COMPLETED')
}

/**
 * 관리자: 환불 상태 변경 (양방향, REQUESTED ↔ COMPLETED)
 */
export async function updateRefundStatus(
    entryId: string,
    status: 'REQUESTED' | 'COMPLETED'
): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return { success: false, error: '로그인이 필요합니다.' }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (!['ADMIN', 'SUPER_ADMIN', 'MANAGER'].includes(profile?.role ?? '')) {
            return { success: false, error: '권한이 없습니다.' }
        }

        const admin = createAdminClient()
        const { data: entry } = await admin
            .from('tournament_entries')
            .select('tournament_id, user_id')
            .eq('id', entryId)
            .single()

        const { error } = await admin
            .from('tournament_entries')
            .update({ refund_status: status, updated_at: new Date().toISOString() })
            .eq('id', entryId)

        if (error) return { success: false, error: error.message }

        // 알림: 환불 완료 시 참가자에게 알림
        if (status === 'COMPLETED' && entry?.user_id) {
            try {
                await createNotification({
                    user_id: entry.user_id,
                    type: NotificationType.REFUND_COMPLETED,
                    title: '환불 완료',
                    message: '환불이 완료되었습니다.',
                    tournament_id: entry.tournament_id,
                    entry_id: entryId,
                    metadata: { link: '/my/entries' },
                })
            } catch { /* 알림 실패가 메인 기능을 막지 않음 */ }
        }

        if (entry?.tournament_id) {
            revalidatePath(`/admin/tournaments/${entry.tournament_id}/entries`)
        }
        return { success: true }
    } catch (error) {
        console.error('updateRefundStatus error:', error)
        return { success: false, error: '환불 상태 변경 중 오류가 발생했습니다.' }
    }
}

/**
 * 계좌이체 입금 확인
 * - 참가자가 이체 후 직접 호출
 * - payment_status = COMPLETED + 정원 이내 → CONFIRMED, 초과 → WAITLISTED
 */
export async function confirmBankTransfer(entryId: string): Promise<{
    success: boolean
    error?: string
    status?: 'CONFIRMED' | 'WAITLISTED'
}> {
    try {
        const supabase = await createClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        if (authError || !user) return { success: false, error: '로그인이 필요합니다.' }

        // revalidatePath용 tournament_id 조회 (권한 체크는 RPC 내부에서 수행)
        const { data: entry } = await supabase
            .from('tournament_entries')
            .select('tournament_id')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { success: false, error: '신청 정보를 찾을 수 없습니다.' }

        // 정원 체크 + 상태 업데이트를 DB 트랜잭션 내에서 원자적으로 처리 (race condition 방지)
        const admin = createAdminClient()
        const { data, error: rpcError } = await admin.rpc('confirm_bank_transfer', {
            p_entry_id: entryId,
            p_user_id: user.id,
        })

        if (rpcError) return { success: false, error: '입금 확인 처리에 실패했습니다.' }

        const result = data?.[0]
        if (!result?.success) {
            return { success: false, error: result?.error_message ?? '입금 확인 처리에 실패했습니다.' }
        }

        // 알림: 주최자에게 결제 확인 알림
        try {
            const { data: entryDetail } = await admin
                .from('tournament_entries')
                .select('profiles(name), tournament_divisions(name, tournaments(title, organizer_id))')
                .eq('id', entryId)
                .single()

            const playerName = (entryDetail?.profiles as unknown as { name: string } | null)?.name ?? '참가자'
            const division = entryDetail?.tournament_divisions as unknown as { name: string; tournaments: { title: string; organizer_id: string } | null } | null
            const tournamentName = division?.tournaments?.title ?? '대회'
            const divisionName = division?.name ?? '부서'
            const organizerId = division?.tournaments?.organizer_id

            if (organizerId) {
                await createNotification({
                    user_id: organizerId,
                    type: NotificationType.PAYMENT_COMPLETED,
                    title: '입금 확인',
                    message: `${playerName}이(가) 입금 확인을 요청했습니다.`,
                    tournament_id: entry.tournament_id,
                    entry_id: entryId,
                    metadata: { link: `/admin/tournaments/${entry.tournament_id}/entries` },
                })
            }

            // 관리자 알림톡 발송
            await sendPaymentConfirmAlimtalk({
                playerName,
                tournamentName,
                divisionName,
            })
        } catch { /* 알림 실패가 메인 기능을 막지 않음 */ }

        revalidatePath(`/tournaments/${entry.tournament_id}`)
        revalidatePath('/my/entries')

        return { success: true, status: result.entry_status as 'CONFIRMED' | 'WAITLISTED' }
    } catch (error) {
        console.error('Confirm bank transfer error:', error)
        return { success: false, error: '입금 확인 중 오류가 발생했습니다.' }
    }
}

/**
 * 참가 신청 수정 (본인용)
 */
export async function updateEntry(
    entryId: string,
    entryData: {
        divisionId: string;
        phone: string;
        playerName: string;
        playerRating: number | null;
        clubName?: string | null;
        teamOrder?: string | null;
        partnerData?: { name: string; club: string; rating: number } | null;
        partnerUserId?: string | null;
        teamMembers?: Array<{ name: string; rating: number }> | null;
        applicantParticipates?: boolean;
        refundBank?: string | null;
        refundAccount?: string | null;
        refundHolder?: string | null;
    }
): Promise<UpdateEntryResult> {
    try {
        const supabase = await createClient();

        // 1. 사용자 인증 확인
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: '로그인이 필요합니다.' };
        }

        // 2. 신청 정보 조회 (권한 확인용)
        const { data: entry, error: entryError } = await supabase
            .from('tournament_entries')
            .select('*, tournaments!inner(status, match_type)')
            .eq('id', entryId)
            .single();

        if (entryError || !entry) {
            return { success: false, error: '신청 정보를 찾을 수 없습니다.' };
        }

        // 3. 본인 신청인지 확인
        if (entry.user_id !== user.id) {
            return { success: false, error: '본인의 신청만 수정할 수 있습니다.' };
        }

        // 4. 대회 상태 확인 (OPEN 상태에서만 수정 가능)
        if (entry.tournaments.status !== 'OPEN') {
            return { success: false, error: '접수 기간에만 수정할 수 있습니다.' };
        }

        // 5. 부서 정보 확인
        const { data: division, error: divisionError } = await supabase
            .from('tournament_divisions')
            .select('*')
            .eq('id', entryData.divisionId)
            .eq('tournament_id', entry.tournament_id)
            .single();

        if (divisionError || !division) {
            return { success: false, error: '참가 부서를 찾을 수 없습니다.' };
        }

        // 6. 부서 변경 시 중복 체크 (다른 부서로 변경하는 경우)
        if (entryData.divisionId !== entry.division_id) {
            const { data: existingEntry } = await supabase
                .from('tournament_entries')
                .select('id')
                .eq('tournament_id', entry.tournament_id)
                .eq('user_id', user.id)
                .eq('division_id', entryData.divisionId)
                .neq('id', entryId)
                .maybeSingle();

            if (existingEntry) {
                return { success: false, error: '이미 해당 부서에 참가 신청을 하셨습니다.' };
            }
        }

        // 7. 팀 순서 자동 설정 (단체전이고 teamOrder가 없는 경우)
        let finalTeamOrder = entryData.teamOrder;
        const matchType = entry.tournaments.match_type;
        if ((matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES') &&
            entryData.clubName && !entryData.teamOrder) {
            // 같은 클럽이 이미 등록되어 있는지 확인 (자기 자신 제외)
            const { data: existingClubEntries } = await supabase
                .from('tournament_entries')
                .select('team_order')
                .eq('tournament_id', entry.tournament_id)
                .eq('division_id', entryData.divisionId)
                .eq('club_name', entryData.clubName)
                .neq('id', entryId)
                .order('team_order', { ascending: false })
                .limit(1);

            if (existingClubEntries && existingClubEntries.length > 0) {
                const lastOrder = existingClubEntries[0].team_order;
                const orders = ['가', '나', '다', '라', '마', '바', '사', '아'];
                const lastIndex = lastOrder ? orders.indexOf(lastOrder) : -1;
                finalTeamOrder = orders[lastIndex + 1] || '가';
            }
        }

        // 8. 신청 정보 업데이트 (Service Role로 RLS 우회, 이미 본인 신청 검증됨)
        const admin = createAdminClient();
        const { error: updateError } = await admin
            .from('tournament_entries')
            .update({
                division_id: entryData.divisionId,
                phone: entryData.phone,
                player_name: entryData.playerName,
                player_rating: entryData.playerRating,
                club_name: entryData.clubName ?? null,
                team_order: finalTeamOrder ?? null,
                partner_data: entryData.partnerData ?? null,
                partner_user_id: entryData.partnerUserId ?? null,
                team_members: entryData.teamMembers ?? null,
                applicant_participates: entryData.applicantParticipates ?? true,
                refund_bank: entryData.refundBank ?? null,
                refund_account: entryData.refundAccount ?? null,
                refund_holder: entryData.refundHolder ?? null,
            })
            .eq('id', entryId)
            .eq('user_id', user.id);

        if (updateError) {
            console.error('Update error:', updateError);
            return { success: false, error: updateError.message || '신청 수정에 실패했습니다.' };
        }

        // 9. 캐시 무효화
        revalidatePath(`/tournaments/${entry.tournament_id}`);
        revalidatePath('/my/entries');

        return { success: true };
    } catch (error) {
        console.error('Update entry error:', error);
        return { success: false, error: '신청 수정 중 오류가 발생했습니다.' };
    }
}

/**
 * 사용자의 특정 대회 신청 정보 조회 (순위 포함)
 */
export async function getUserEntry(tournamentId: string) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await getUserWithTimeout(supabase, 3000);

        if (authError || !user) {
            return null;
        }

        // 순위 계산을 위한 쿼리 — 여러 팀 등록 시 최신 신청 1건 반환
        const { data: entries, error } = await supabase
            .from('tournament_entries')
            .select('*')
            .eq('tournament_id', tournamentId)
            .eq('user_id', user.id)
            .neq('status', 'CANCELLED')
            .order('created_at', { ascending: false })
            .limit(1)

        if (error || !entries || entries.length === 0) {
            return null;
        }
        const entry = entries[0];

        // 현재 순위 계산 (취소되지 않은 신청 중 created_at 기준)
        const { count } = await supabase
            .from('tournament_entries')
            .select('*', { count: 'exact', head: true })
            .eq('tournament_id', tournamentId)
            .eq('division_id', entry.division_id)
            .neq('status', 'CANCELLED')
            .lte('created_at', entry.created_at);

        return {
            ...entry,
            current_rank: count ?? 1,
        };
    } catch (error) {
        console.error('Get user entry error:', error);
        return null;
    }
}

/**
 * 신청 수정 폼에 필요한 데이터를 한 번에 조회 (엔트리 + 대회 + 부서 목록)
 * 프로필 신청 현황 탭에서 바로 수정하기 위해 사용
 */
export interface EntryEditData {
    entry: {
        divisionId: string;
        phone: string;
        playerName: string;
        playerRating: number | null;
        clubName: string | null;
        teamOrder: string | null;
        partnerData: { name: string; club?: string | null; rating: number } | null;
        partnerUserId: string | null;
        teamMembers: Array<{ name: string; rating: number }> | null;
        applicantParticipates: boolean;
    };
    tournament: {
        id: string;
        title: string;
        matchType: string | null;
        teamMatchCount: number | null;
        entryFee: number;
        bankAccount: string | null;
    };
    divisions: Array<{
        id: string;
        name: string;
        max_teams: number | null;
        team_member_limit: number | null;
    }>;
}

export async function getEntryEditData(
    entryId: string
): Promise<{ data: EntryEditData } | { error: string }> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return { error: '로그인이 필요합니다.' };

        // 엔트리 + 대회 정보 조회 (본인 것만)
        const { data: entry, error: entryError } = await supabase
            .from('tournament_entries')
            .select(`
                division_id, phone, player_name, player_rating, club_name,
                team_order, partner_data, partner_user_id, team_members, applicant_participates,
                tournament:tournaments!inner(id, title, match_type, team_match_count, entry_fee, bank_account)
            `)
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single();

        if (entryError || !entry) return { error: '신청 정보를 찾을 수 없습니다.' };

        const t = entry.tournament as unknown as {
            id: string; title: string; match_type: string | null;
            team_match_count: number | null; entry_fee: number; bank_account: string | null;
        };

        // 해당 대회의 부서 목록 조회
        const { data: divisions, error: divError } = await supabase
            .from('tournament_divisions')
            .select('id, name, max_teams, team_member_limit')
            .eq('tournament_id', t.id)
            .order('name');

        if (divError || !divisions) return { error: '부서 정보를 불러올 수 없습니다.' };

        return {
            data: {
                entry: {
                    divisionId: entry.division_id,
                    phone: entry.phone,
                    playerName: entry.player_name,
                    playerRating: entry.player_rating,
                    clubName: entry.club_name,
                    teamOrder: entry.team_order,
                    partnerData: entry.partner_data as EntryEditData['entry']['partnerData'],
                    partnerUserId: entry.partner_user_id,
                    teamMembers: entry.team_members as EntryEditData['entry']['teamMembers'],
                    applicantParticipates: entry.applicant_participates ?? true,
                },
                tournament: {
                    id: t.id,
                    title: t.title,
                    matchType: t.match_type,
                    teamMatchCount: t.team_match_count,
                    entryFee: t.entry_fee,
                    bankAccount: t.bank_account,
                },
                divisions,
            },
        };
    } catch (error) {
        console.error('Get entry edit data error:', error);
        return { error: '데이터를 불러오는 중 오류가 발생했습니다.' };
    }
}

/**
 * 사용자의 특정 대회 신청 목록 전체 조회 (취소 제외, 신청일 오름차순)
 * 여러 팀 신청 UI에서 모든 팀을 나열하기 위해 사용
 */
export async function getUserTournamentEntries(tournamentId: string) {
    try {
        const supabase = await createClient();

        const {
            data: { user },
            error: authError,
        } = await getUserWithTimeout(supabase, 3000);

        if (authError || !user) {
            return [];
        }

        // 내 entries + 전체 대회 entries(순번 계산용) 병렬 조회
        const [myResult, allResult] = await Promise.all([
            supabase
                .from('tournament_entries')
                .select('*')
                .eq('tournament_id', tournamentId)
                .eq('user_id', user.id)
                .neq('status', 'CANCELLED')
                .order('created_at', { ascending: true }),
            supabase
                .from('tournament_entries')
                .select('id, created_at')
                .eq('tournament_id', tournamentId)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true }),
        ]);

        if (myResult.error || !myResult.data) {
            return [];
        }

        // 전체 entries ID 순서 맵 (1-based)
        const allIds = allResult.data?.map((e) => e.id) ?? [];
        const rankMap = new Map(allIds.map((id, idx) => [id, idx + 1]));

        // 내 entries에 current_rank 추가
        return myResult.data.map((entry) => ({
            ...entry,
            current_rank: rankMap.get(entry.id) ?? null,
        }));
    } catch (error) {
        console.error('Get user tournament entries error:', error);
        return [];
    }
}
