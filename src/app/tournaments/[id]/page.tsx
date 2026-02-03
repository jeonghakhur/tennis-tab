import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

interface Props {
    params: Promise<{ id: string }>;
}

export default async function TournamentDetailPage({ params }: Props) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: tournament, error } = await supabase
        .from('tournaments')
        .select('*, profiles(name, email)')
        .eq('id', id)
        .single();

    if (error || !tournament) {
        notFound();
    }

    const organizerName = tournament.profiles
        // @ts-ignore: Supabase types might be slightly off for join logic alias
        ? (tournament.profiles.name || 'Unknown Organizer')
        : 'Unknown';

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="container mx-auto px-4 py-8">
            {/* Header */}
            <div className="mb-8">
                <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-300 mb-4 inline-block">
                    &larr; 목록으로 돌아가기
                </Link>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">{tournament.title}</h1>
                        <div className="flex items-center gap-4 text-gray-600 dark:text-gray-400">
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full dark:bg-blue-900 dark:text-blue-300">
                                {tournament.status}
                            </span>
                            <span>{tournament.format}</span>
                        </div>
                    </div>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-colors shadow-lg">
                        참가 신청하기
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Info Card */}
                    <section className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            📅 대회 정보
                        </h2>
                        <div className="space-y-4">
                            <div className="flex">
                                <span className="w-24 text-gray-500">일시</span>
                                <div>
                                    <p>{formatDate(tournament.start_date)}</p>
                                    <p className="text-sm text-gray-500">~ {formatDate(tournament.end_date)}</p>
                                </div>
                            </div>
                            <div className="flex">
                                <span className="w-24 text-gray-500">장소</span>
                                <div>
                                    <p className="font-medium">{tournament.location}</p>
                                    {tournament.address && <p className="text-gray-500 text-sm">{tournament.address}</p>}
                                </div>
                            </div>
                            <div className="flex">
                                <span className="w-24 text-gray-500">주최자</span>
                                <p>{organizerName}</p>
                            </div>
                            <div className="flex">
                                <span className="w-24 text-gray-500">참가비</span>
                                <p>{tournament.entry_fee.toLocaleString()}원</p>
                            </div>
                            <div className="flex">
                                <span className="w-24 text-gray-500">모집 인원</span>
                                <p>{tournament.max_participants}명</p>
                            </div>
                        </div>
                    </section>

                    {/* Description */}
                    <section className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800 shadow-sm">
                        <h2 className="text-xl font-bold mb-4">📝 상세 내용</h2>
                        {tournament.description ? (
                            <div
                                className="prose dark:prose-invert max-w-none prose-table:border-collapse prose-th:border prose-th:border-gray-300 prose-th:p-2 prose-th:bg-gray-100 dark:prose-th:border-gray-600 dark:prose-th:bg-gray-800 prose-td:border prose-td:border-gray-300 prose-td:p-2 dark:prose-td:border-gray-600"
                                dangerouslySetInnerHTML={{ __html: tournament.description }}
                            />
                        ) : (
                            <p className="text-gray-500">상세 설명이 없습니다.</p>
                        )}
                    </section>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Map Placeholder */}
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-6 h-64 flex items-center justify-center text-gray-400">
                        지도 (구현 예정)
                    </div>

                    {/* Participants Placeholder */}
                    <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-800">
                        <h3 className="font-bold mb-4">참가자 현황</h3>
                        <p className="text-gray-500 text-sm">아직 참가자가 없습니다.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
