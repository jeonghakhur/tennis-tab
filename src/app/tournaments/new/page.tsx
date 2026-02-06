import TournamentForm, { TournamentFormData } from '@/components/tournaments/TournamentForm';
import { createClient } from '@/lib/supabase/server';

interface Props {
    searchParams: Promise<{ template?: string }>;
}

export default async function NewTournamentPage({ searchParams }: Props) {
    const params = await searchParams;
    const templateId = params.template;

    let templateData: TournamentFormData | undefined = undefined;

    // 템플릿 ID가 있으면 해당 대회 정보를 가져옴
    if (templateId) {
        const supabase = await createClient();
        const { data: tournament } = await supabase
            .from('tournaments')
            .select(`
                *,
                tournament_divisions (*)
            `)
            .eq('id', templateId)
            .single();

        if (tournament) {
            // 템플릿 데이터 생성 (ID 제외, 날짜 포함)
            templateData = {
                id: '', // 새 대회이므로 ID는 비워둠
                title: `${tournament.title} (복사본)`,
                description: tournament.description,
                poster_url: tournament.poster_url, // 포스터 이미지도 복사
                start_date: tournament.start_date,
                end_date: tournament.end_date,
                location: tournament.location,
                address: tournament.address,
                host: tournament.host,
                organizer_name: tournament.organizer_name,
                ball_type: tournament.ball_type,
                entry_start_date: tournament.entry_start_date,
                entry_end_date: tournament.entry_end_date,
                opening_ceremony: tournament.opening_ceremony,
                match_type: tournament.match_type,
                bank_account: tournament.bank_account,
                eligibility: tournament.eligibility,
                max_participants: tournament.max_participants,
                entry_fee: tournament.entry_fee,
                team_match_count: tournament.team_match_count,
                tournament_divisions: tournament.tournament_divisions?.map((div: any) => ({
                    name: div.name,
                    max_teams: div.max_teams,
                    team_member_limit: div.team_member_limit,
                    match_date: div.match_date,
                    match_location: div.match_location,
                    prize_winner: div.prize_winner,
                    prize_runner_up: div.prize_runner_up,
                    prize_third: div.prize_third,
                    notes: div.notes,
                })) || [],
            };
        }
    }

    return (
        <div className="container mx-auto py-8 px-4">
            {templateId && templateData && (
                <div className="max-w-4xl mx-auto mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">
                                템플릿 사용 중
                            </h3>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                이전 대회의 정보를 불러왔습니다. 필요한 내용을 수정하세요.
                            </p>
                        </div>
                    </div>
                </div>
            )}
            <TournamentForm mode="create" initialData={templateData} />
        </div>
    );
}
