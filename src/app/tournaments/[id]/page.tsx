import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { TournamentStatus, MatchType } from '@/lib/supabase/types';
import TournamentActions from '@/components/tournaments/TournamentActions';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function TournamentDetailPage({ params }: Props) {
    const { id } = await params;
    const supabase = await createClient();

    // 현재 사용자 정보 가져오기
    const { data: { user } } = await supabase.auth.getUser();

    const { data: tournament, error } = await supabase
        .from('tournaments')
        .select(`
      *,
      profiles (name, email),
      tournament_divisions (*)
    `)
        .eq('id', id)
        .single();

    if (error || !tournament) {
        notFound();
    }

    // 주최자 본인인지 확인
    const isOrganizer = user && tournament.organizer_id === user.id;

    const organizerName = tournament.profiles
        // @ts-ignore: Supabase types join
        ? (tournament.profiles.name || 'Unknown Organizer')
        : 'Unknown';

    // Date formatter helper
    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const formatSimpleDate = (dateStr: string | null) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });
    };

    const formatCurrency = (amount: number) => {
        return amount === 0 ? '무료' : `${amount.toLocaleString()}원`;
    };

    const MATCH_TYPE_LABELS: Record<string, string> = {
        'INDIVIDUAL_SINGLES': '개인전 단식',
        'INDIVIDUAL_DOUBLES': '개인전 복식',
        'TEAM_SINGLES': '단체전 단식',
        'TEAM_DOUBLES': '단체전 복식'
    };

    const formattedMatchType = tournament.match_type ? MATCH_TYPE_LABELS[tournament.match_type] || tournament.match_type : '';

    return (
        <div className="container mx-auto px-4 py-8 max-w-7xl">
            {/* Header / Breadcrumb */}
            <div className="mb-6">
                <Link href="/tournaments" className="text-sm text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1 mb-4">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    목록으로 돌아가기
                </Link>

                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-sm font-medium border
                ${tournament.status === 'OPEN' ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800' :
                                    tournament.status === 'CLOSED' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800' :
                                        'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'}`}>
                                {tournament.status === 'OPEN' ? '접수중' :
                                    tournament.status === 'CLOSED' ? '마감' :
                                        tournament.status === 'IN_PROGRESS' ? '진행중' : tournament.status}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400 text-sm">
                                {formattedMatchType}
                            </span>
                        </div>
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2 leading-tight">
                            {tournament.title}
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-gray-200">{tournament.host || organizerName}</span>
                            {tournament.organizer_name && (
                                <>
                                    <span className="text-gray-300 dark:text-gray-600">|</span>
                                    <span>주관: {tournament.organizer_name}</span>
                                </>
                            )}
                        </p>
                    </div>

                    <div className="flex-shrink-0 flex flex-col gap-3">
                        {isOrganizer && (
                            <TournamentActions tournamentId={tournament.id} />
                        )}
                        <button className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-xl font-bold text-lg transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2">
                            <span>참가 신청하기</span>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content Column */}
                <div className="lg:col-span-2 space-y-8">

                    {/* Key Info Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">대회 일시</h3>
                            <p className="font-semibold text-gray-900 dark:text-white text-lg">
                                {formatSimpleDate(tournament.start_date)}
                            </p>
                            <p className="text-sm text-gray-500">
                                {tournament.start_date && tournament.end_date && tournament.start_date !== tournament.end_date && `~ ${formatSimpleDate(tournament.end_date)}`}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">장소</h3>
                            <p className="font-semibold text-gray-900 dark:text-white text-lg">
                                {tournament.location}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{tournament.address}</p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">접수 기간</h3>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {formatSimpleDate(tournament.entry_start_date)} ~
                            </p>
                            <p className="font-medium text-gray-900 dark:text-white">
                                {formatSimpleDate(tournament.entry_end_date)}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm">
                            <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">참가비 / 계좌</h3>
                            <p className="font-semibold text-gray-900 dark:text-white text-lg">
                                {formatCurrency(tournament.entry_fee)}
                            </p>
                            <p className="text-sm text-gray-500 truncate">{tournament.bank_account || '-'}</p>
                        </div>
                    </div>

                    {/* Divisions List */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                            참가 부서
                        </h2>

                        {tournament.tournament_divisions && tournament.tournament_divisions.length > 0 ? (
                            <div className="grid gap-4">
                                {tournament.tournament_divisions.map((division: any) => (
                                    <div key={division.id} className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors shadow-sm">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                                                    {division.name}
                                                </h3>
                                                <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                                    {division.max_teams && <span>{division.max_teams}팀 모집</span>}
                                                    {division.team_member_limit && <span>• 팀당 {division.team_member_limit}명</span>}
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-sm text-gray-500">우승 상금</span>
                                                <span className="font-bold text-blue-600 dark:text-blue-400 text-lg">{division.prize_winner || '-'}</span>
                                            </div>
                                        </div>

                                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                            <div className="flex gap-2">
                                                <span className="text-gray-500 min-w-16">경기 일시</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-200">
                                                    {formatDate(division.match_date)}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <span className="text-gray-500 min-w-16">경기 장소</span>
                                                <span className="font-medium text-gray-900 dark:text-gray-200">
                                                    {division.match_location || tournament.location}
                                                </span>
                                            </div>
                                            {division.prize_runner_up && (
                                                <div className="flex gap-2">
                                                    <span className="text-gray-500 min-w-16">준우승</span>
                                                    <span className="text-gray-900 dark:text-gray-200">{division.prize_runner_up}</span>
                                                </div>
                                            )}
                                            {division.prize_third && (
                                                <div className="flex gap-2">
                                                    <span className="text-gray-500 min-w-16">3위</span>
                                                    <span className="text-gray-900 dark:text-gray-200">{division.prize_third}</span>
                                                </div>
                                            )}
                                        </div>

                                        {division.notes && (
                                            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none"
                                                dangerouslySetInnerHTML={{ __html: division.notes }} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-8 text-center text-gray-500 dark:text-gray-400">
                                등록된 참가 부서가 없습니다.
                            </div>
                        )}
                    </section>

                    {/* Detailed Info */}
                    <section>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                            대회 요강
                        </h2>

                        <div className="space-y-6">
                            {/* Metadata Table */}
                            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <dl className="divide-y divide-gray-200 dark:divide-gray-700">
                                    <div className="grid grid-cols-3 gap-4 px-6 py-4">
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">사용구</dt>
                                        <dd className="text-sm text-gray-900 dark:text-white col-span-2">{tournament.ball_type || '-'}</dd>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">참가 자격</dt>
                                        <dd className="text-sm text-gray-900 dark:text-white col-span-2">{tournament.eligibility || '-'}</dd>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 px-6 py-4">
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">개회식</dt>
                                        <dd className="text-sm text-gray-900 dark:text-white col-span-2">{formatDate(tournament.opening_ceremony)}</dd>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-gray-50 dark:bg-gray-900/50">
                                        <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">문의</dt>
                                        <dd className="text-sm text-gray-900 dark:text-white col-span-2">{tournament.host} / {organizerName}</dd>
                                    </div>
                                </dl>
                            </div>

                            {/* Description Content */}
                            {tournament.description ? (
                                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border border-gray-200 dark:border-gray-700 shadow-sm">
                                    <div className="prose dark:prose-invert max-w-none prose-headings:font-bold prose-a:text-blue-600"
                                        dangerouslySetInnerHTML={{ __html: tournament.description }} />
                                </div>
                            ) : (
                                <div className="text-center py-12 text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-xl">
                                    등록된 상세 내용이 없습니다.
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    <div className="sticky top-24 space-y-6">
                        {/* Status Card */}
                        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg">
                            <h3 className="font-bold text-gray-900 dark:text-white mb-4 text-lg">참가 신청 현황</h3>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-500">현재 참가</span>
                                    <span className="font-semibold text-gray-900 dark:text-white">0명 / {tournament.max_participants}명</span>
                                </div>
                                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                                    <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: '0%' }}></div>
                                </div>
                                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-bold transition-all shadow hover:shadow-lg">
                                    참가 신청하기
                                </button>
                                <p className="text-xs text-center text-gray-500">
                                    로그인 후 신청할 수 있습니다.
                                </p>
                            </div>
                        </div>

                        {/* Map Placeholder */}
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl h-64 flex items-center justify-center text-gray-400 border border-gray-200 dark:border-gray-700">
                            <div className="text-center">
                                <span className="text-4xl block mb-2">🗺️</span>
                                <span className="text-sm">지도 보기 (준비중)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
