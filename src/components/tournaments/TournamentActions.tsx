'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteTournament } from '@/lib/tournaments/actions';
import Link from 'next/link';

interface TournamentActionsProps {
    tournamentId: string;
}

export default function TournamentActions({ tournamentId }: TournamentActionsProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

    const handleDelete = async () => {
        setLoading(true);
        const result = await deleteTournament(tournamentId);

        if (result.success) {
            router.push('/tournaments');
            router.refresh();
        } else {
            alert(result.error);
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col sm:flex-row gap-3">
            <Link
                href={`/tournaments/${tournamentId}/edit`}
                className="w-full sm:w-auto bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 px-6 py-2.5 rounded-xl font-medium text-center transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                수정
            </Link>
            <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={loading}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-medium transition-all shadow-sm hover:shadow disabled:opacity-50 flex items-center justify-center gap-2"
            >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                삭제
            </button>

            {/* 삭제 확인 모달 */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                            대회 삭제
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 mb-6">
                            정말로 이 대회를 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 모든 참가 부서 정보도 함께 삭제됩니다.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={loading}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                취소
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={loading}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                            >
                                {loading ? '삭제 중...' : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
