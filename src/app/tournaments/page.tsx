import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import TournamentCard from '@/components/tournaments/TournamentCard';
import { TournamentRealtimeRefresher } from '@/components/tournaments/TournamentRealtimeRefresher';
import { UserRole } from '@/lib/supabase/types';

const ALLOWED_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

export default async function TournamentsPage() {
    const supabase = await createClient();

    // 현재 사용자 및 역할 확인
    const { data: { user } } = await supabase.auth.getUser();
    let canCreateTournament = false;

    if (user) {
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        canCreateTournament = !!profile?.role && ALLOWED_ROLES.includes(profile.role);
    }

    const { data: tournaments, error } = await supabase
        .from('tournaments')
        .select('*')
        .order('start_date', { ascending: false });

    if (error) {
        console.error('Error fetching tournaments:', error);
    }

    return (
        <div className="max-w-content mx-auto px-4 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">대회 일정</h1>
                    <p className="text-gray-500">참가 가능한 테니스 대회를 확인하세요.</p>
                </div>
                {canCreateTournament && (
                    <Link
                        href="/tournaments/new"
                        className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
                    >
                        대회 만들기
                    </Link>
                )}
            </div>

            {/* 대회 상태 변경 실시간 감지 */}
            {tournaments && tournaments.length > 0 && (
                <TournamentRealtimeRefresher
                    tournamentIds={tournaments.map((t) => t.id)}
                />
            )}

            {(!tournaments || tournaments.length === 0) ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                    <div className="text-4xl mb-4">🎾</div>
                    <h3 className="text-lg font-medium mb-2">등록된 대회가 없습니다</h3>
                    <p className="text-gray-500 mb-6">참가 가능한 대회가 곧 등록될 예정입니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {tournaments.map((tournament) => (
                        <TournamentCard key={tournament.id} tournament={tournament} />
                    ))}
                </div>
            )}
        </div>
    );
}
