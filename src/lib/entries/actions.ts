'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';
import { EntryStatus } from '@/lib/supabase/types';

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
        teamMembers?: Array<{ name: string; rating: number }> | null;
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
            team_members: entryData.teamMembers ?? null,
            status: initialStatus,
            payment_status: 'UNPAID',
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

        // 4. 신청 삭제 (Service Role로 RLS 우회, 이미 본인 신청 검증됨)
        const admin = createAdminClient();
        const { error: deleteError } = await admin
            .from('tournament_entries')
            .delete()
            .eq('id', entryId)
            .eq('user_id', user.id);

        if (deleteError) {
            console.error('Delete error:', deleteError);
            return { success: false, error: deleteError.message || '신청 취소에 실패했습니다.' };
        }

        // 5. 캐시 무효화
        revalidatePath(`/tournaments/${entry.tournament_id}`);
        revalidatePath('/tournaments');
        revalidatePath('/my/entries');

        return { success: true };
    } catch (error) {
        console.error('Delete entry error:', error);
        return { success: false, error: '신청 취소 중 오류가 발생했습니다.' };
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
        teamMembers?: Array<{ name: string; rating: number }> | null;
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
                team_members: entryData.teamMembers ?? null,
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
        } = await supabase.auth.getUser();

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
