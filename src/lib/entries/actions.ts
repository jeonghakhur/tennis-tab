'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { EntryStatus } from '@/lib/supabase/types';

// 파트너 검색 결과 타입
export interface PartnerSearchResult {
    id: string
    name: string
    rating: number | null
    club: string | null
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
/**
 * 이름으로 파트너 검색 (복식 신청 시 시스템 사용자 검색용)
 */
export async function searchPartnerByName(name: string): Promise<PartnerSearchResult[]> {
    if (!name || name.trim().length < 2) return []

    const admin = createAdminClient()
    const { data } = await admin
        .from('profiles')
        .select('id, name, rating, club')
        .ilike('name', `%${name.trim()}%`)
        .limit(10)

    return (data ?? []).map((p) => ({
        id: p.id,
        name: p.name ?? '',
        rating: p.rating,
        club: p.club,
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

        // 6. 이미 신청했는지 확인 (같은 부서에 중복 신청 방지, 취소된 신청 제외)
        const { data: existingEntry, error: checkError } = await supabase
            .from('tournament_entries')
            .select('id')
            .eq('tournament_id', tournamentId)
            .eq('user_id', user.id)
            .eq('division_id', entryData.divisionId)
            .neq('status', 'CANCELLED')
            .maybeSingle();

        if (checkError) {
            console.error('Entry check error:', checkError);
            return { success: false, error: '신청 확인 중 오류가 발생했습니다.' };
        }

        if (existingEntry) {
            return { success: false, error: '이미 해당 부서에 참가 신청을 하셨습니다.' };
        }

        // 7. 팀 순서 자동 설정 (단체전이고 teamOrder가 없는 경우)
        let finalTeamOrder = entryData.teamOrder;
        if ((tournament.match_type === 'TEAM_SINGLES' || tournament.match_type === 'TEAM_DOUBLES') && 
            entryData.clubName && !entryData.teamOrder) {
            // 같은 클럽이 이미 등록되어 있는지 확인
            const { data: existingClubEntries } = await supabase
                .from('tournament_entries')
                .select('team_order')
                .eq('tournament_id', tournamentId)
                .eq('division_id', entryData.divisionId)
                .eq('club_name', entryData.clubName)
                .order('team_order', { ascending: false })
                .limit(1);

            if (existingClubEntries && existingClubEntries.length > 0) {
                // 자동으로 순서 부여
                const lastOrder = existingClubEntries[0].team_order;
                const orders = ['가', '나', '다', '라', '마', '바', '사', '아'];
                const lastIndex = lastOrder ? orders.indexOf(lastOrder) : -1;
                finalTeamOrder = orders[lastIndex + 1] || '가';
            }
        }

        // 8. 참가 신청 생성 (Service Role로 INSERT → RLS 우회, 이미 본인 user_id로 검증됨)
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
        };
        const admin = createAdminClient();
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

        // 9. 캐시 무효화
        revalidatePath(`/tournaments/${tournamentId}`);
        revalidatePath('/tournaments');
        revalidatePath('/my/entries');

        return { success: true, entryId: newEntry.id };
    } catch (error) {
        console.error('Create entry error:', error);
        return { success: false, error: '참가 신청 중 오류가 발생했습니다.' };
    }
}

/**
 * 참가 신청 상태 업데이트 (주최자용)
 */
export async function updateEntryStatus(
    entryId: string,
    newStatus: EntryStatus
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

        // 2. 신청 정보 조회 (주최자 권한 확인용)
        const { data: entry, error: entryError } = await supabase
            .from('tournament_entries')
            .select(
                `
                *,
                tournaments!inner(organizer_id)
            `
            )
            .eq('id', entryId)
            .single();

        if (entryError || !entry) {
            return { success: false, error: '신청 정보를 찾을 수 없습니다.' };
        }

        // 3. 주최자 권한 확인
        if (entry.tournaments.organizer_id !== user.id) {
            return { success: false, error: '권한이 없습니다.' };
        }

        // 4. 상태 업데이트
        const { error: updateError } = await supabase
            .from('tournament_entries')
            .update({ status: newStatus })
            .eq('id', entryId);

        if (updateError) {
            console.error('Update error:', updateError);
            return { success: false, error: '상태 업데이트에 실패했습니다.' };
        }

        // 5. 캐시 무효화
        revalidatePath(`/tournaments/${entry.tournament_id}`);
        revalidatePath('/my/entries');

        return { success: true };
    } catch (error) {
        console.error('Update entry status error:', error);
        return { success: false, error: '상태 업데이트 중 오류가 발생했습니다.' };
    }
}

/**
 * 내부 취소 헬퍼 — 인증 없이 entryId + userId로 소프트 삭제 + 대기자 승격
 * deleteEntry(사용자 Server Action)와 cancelFlow(채팅 핸들러) 양쪽에서 재사용
 */
export async function cancelEntryByAdmin(
    entryId: string,
    userId: string
): Promise<DeleteEntryResult> {
    const admin = createAdminClient();

    // 1. 신청 정보 조회 (상태/division_id 필요)
    const { data: entry, error: entryError } = await admin
        .from('tournament_entries')
        .select('id, user_id, status, division_id, tournament_id')
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

    // 3. 소프트 삭제: CANCELLED 상태로 변경 (취소 이력 보존)
    const { error: cancelError } = await admin
        .from('tournament_entries')
        .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
        .eq('id', entryId)
        .eq('user_id', userId);

    if (cancelError) {
        return { success: false, error: cancelError.message || '신청 취소에 실패했습니다.' };
    }

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
                .update({ status: 'CONFIRMED', updated_at: new Date().toISOString() })
                .eq('id', waitlisted.id);
        }
    }

    revalidatePath(`/tournaments/${entry.tournament_id}`);
    revalidatePath('/tournaments');
    revalidatePath('/my/entries');

    return { success: true };
}

/**
 * 참가 신청 취소/삭제
 */
export async function deleteEntry(entryId: string): Promise<DeleteEntryResult> {
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
            .select('*')
            .eq('id', entryId)
            .single();

        if (entryError || !entry) {
            return { success: false, error: '신청 정보를 찾을 수 없습니다.' };
        }

        // 3. 본인 신청인지 확인
        if (entry.user_id !== user.id) {
            return { success: false, error: '본인의 신청만 취소할 수 있습니다.' };
        }

        // 4~7. 공유 헬퍼로 위임 (대진표 체크 + 소프트 삭제 + 대기자 승격 + 캐시 무효화)
        return cancelEntryByAdmin(entryId, user.id);
    } catch (error) {
        console.error('Delete entry error:', error);
        return { success: false, error: '신청 취소 중 오류가 발생했습니다.' };
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

        // 본인 신청인지 확인
        const { data: entry } = await supabase
            .from('tournament_entries')
            .select('id, user_id, division_id, status, payment_status, tournament_id')
            .eq('id', entryId)
            .eq('user_id', user.id)
            .single()

        if (!entry) return { success: false, error: '신청 정보를 찾을 수 없습니다.' }

        // 이미 입금 확인된 경우 멱등성 처리 — 실제 status 그대로 반환
        if (entry.payment_status === 'COMPLETED') {
            const currentStatus = entry.status as 'CONFIRMED' | 'WAITLISTED'
            return { success: true, status: currentStatus }
        }

        const admin = createAdminClient()

        // 부서 정원 체크
        const [{ data: division }, { count }] = await Promise.all([
            admin.from('tournament_divisions').select('max_teams').eq('id', entry.division_id).single(),
            admin
                .from('tournament_entries')
                .select('*', { count: 'exact', head: true })
                .eq('division_id', entry.division_id)
                .eq('status', 'CONFIRMED'),
        ])

        // 정원 없거나 빈 자리 있으면 CONFIRMED, 아니면 WAITLISTED
        const newStatus: 'CONFIRMED' | 'WAITLISTED' =
            !division?.max_teams || (count ?? 0) < division.max_teams ? 'CONFIRMED' : 'WAITLISTED'

        const { error } = await admin
            .from('tournament_entries')
            .update({
                payment_status: 'COMPLETED',
                payment_confirmed_at: new Date().toISOString(),
                status: newStatus,
            })
            .eq('id', entryId)
            .eq('user_id', user.id)

        if (error) return { success: false, error: '입금 확인 처리에 실패했습니다.' }

        revalidatePath(`/tournaments/${entry.tournament_id}`)
        revalidatePath('/my/entries')

        return { success: true, status: newStatus }
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

        const authFallback = { data: { user: null }, error: null } as const;
        const {
            data: { user },
            error: authError,
        } = await Promise.race([
            supabase.auth.getUser().catch(() => authFallback),
            new Promise<typeof authFallback>((resolve) => setTimeout(() => resolve(authFallback), 3000)),
        ]);

        if (authError || !user) {
            return null;
        }

        // 순위 계산을 위한 RPC 호출 또는 직접 쿼리
        const { data: entry, error } = await supabase
            .from('tournament_entries')
            .select('*')
            .eq('tournament_id', tournamentId)
            .eq('user_id', user.id)
            .maybeSingle();

        if (error || !entry) {
            return null;
        }

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
