'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTournament } from '@/lib/tournaments/actions';
import { useAuth } from '../AuthProvider';
import { UserRole } from '@/lib/supabase/types';
import RichTextEditor from '@/components/ui/RichTextEditor';

const ALLOWED_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

export default function TournamentForm() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [description, setDescription] = useState('');

    const canCreateTournament = profile?.role && ALLOWED_ROLES.includes(profile.role);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!user) {
            setError('로그인이 필요합니다.');
            setLoading(false);
            return;
        }

        if (!canCreateTournament) {
            setError('대회를 생성할 권한이 없습니다.');
            setLoading(false);
            return;
        }

        const formData = new FormData(e.currentTarget);
        const result = await createTournament(formData);

        if (result.success) {
            router.push('/tournaments');
            router.refresh();
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    // 로그인하지 않은 경우
    if (!user) {
        return (
            <div className="max-w-2xl mx-auto p-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 p-4 rounded-lg">
                    대회를 만들려면 로그인이 필요합니다.
                </div>
            </div>
        );
    }

    // 권한이 없는 경우
    if (!canCreateTournament) {
        return (
            <div className="max-w-2xl mx-auto p-6">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
                    대회를 생성할 권한이 없습니다. 관리자(ADMIN) 이상의 권한이 필요합니다.
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto p-6">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">대회 만들기</h2>
                <p className="text-gray-500">새로운 테니스 대회를 개설합니다.</p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">대회명</label>
                    <input
                        name="title"
                        required
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                        placeholder="예: 2024 봄맞이 테니스 대회"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">시작 일시</label>
                        <input
                            type="datetime-local"
                            name="start_date"
                            required
                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">종료 일시</label>
                        <input
                            type="datetime-local"
                            name="end_date"
                            required
                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">장소</label>
                    <input
                        name="location"
                        required
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                        placeholder="예: 올림픽공원 테니스장"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">주소 (선택)</label>
                    <input
                        name="address"
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                        placeholder="상세 주소 입력"
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">최대 참가 인원</label>
                        <input
                            type="number"
                            name="max_participants"
                            required
                            min="2"
                            defaultValue="16"
                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">참가비 (원)</label>
                        <input
                            type="number"
                            name="entry_fee"
                            required
                            min="0"
                            defaultValue="0"
                            step="1000"
                            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">경기 방식</label>
                    <select
                        name="format"
                        required
                        className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 appearance-none"
                    >
                        <option value="SINGLE_ELIMINATION">싱글 엘리미네이션 (토너먼트)</option>
                        <option value="DOUBLE_ELIMINATION">더블 엘리미네이션</option>
                        <option value="LEAGUE">리그전 (풀리그)</option>
                        <option value="MIXED">혼합 (조별예선 + 토너먼트)</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1">상세 설명</label>
                    <input type="hidden" name="description" value={description} />
                    <RichTextEditor
                        value={description}
                        onChange={setDescription}
                        placeholder="대회 규정, 상품 등 상세 내용을 입력하세요."
                    />
                </div>
            </div>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                    {loading ? '생성 중...' : '대회 생성하기'}
                </button>
            </div>
        </form>
    );
}
