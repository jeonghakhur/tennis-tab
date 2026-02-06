import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TournamentForm, { TournamentFormData } from '@/components/tournaments/TournamentForm';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function TournamentEditPage({ params }: Props) {
    const { id } = await params;
    const supabase = await createClient();

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        redirect('/auth/login');
    }

    // 대회 정보 가져오기
    const { data: tournament, error } = await supabase
        .from('tournaments')
        .select(`
      *,
      tournament_divisions (*)
    `)
        .eq('id', id)
        .single();

    if (error || !tournament) {
        notFound();
    }

    // 주최자 본인인지 확인
    if (tournament.organizer_id !== user.id) {
        redirect(`/tournaments/${id}`);
    }

    // TournamentFormData 타입으로 변환
    const formData: TournamentFormData = {
        id: tournament.id,
        title: tournament.title,
        description: tournament.description,
        poster_url: tournament.poster_url,
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
        tournament_divisions: tournament.tournament_divisions || [],
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <TournamentForm mode="edit" initialData={formData} />
        </div>
    );
}
