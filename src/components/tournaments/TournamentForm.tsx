'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTournament, DivisionInput } from '@/lib/tournaments/actions';
import { useAuth } from '../AuthProvider';
import { UserRole, MatchType } from '@/lib/supabase/types';
import RichTextEditor from '@/components/ui/RichTextEditor';

const ALLOWED_ROLES: UserRole[] = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

const MATCH_TYPES: { value: MatchType; label: string }[] = [
    { value: 'INDIVIDUAL_SINGLES', label: '개인전 단식' },
    { value: 'INDIVIDUAL_DOUBLES', label: '개인전 복식' },
    { value: 'TEAM_SINGLES', label: '단체전 단식' },
    { value: 'TEAM_DOUBLES', label: '단체전 복식' },
];

const emptyDivision: DivisionInput = {
    name: '',
    max_teams: null,
    team_member_limit: null,
    match_date: null,
    match_location: null,
    prize_winner: null,
    prize_runner_up: null,
    prize_third: null,
    notes: null,
};

export default function TournamentForm() {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [description, setDescription] = useState('');
    const [matchType, setMatchType] = useState<MatchType | ''>('');
    const [divisions, setDivisions] = useState<DivisionInput[]>([]);

    const canCreateTournament = profile?.role && ALLOWED_ROLES.includes(profile.role);
    const isTeamMatch = matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES';

    const addDivision = () => {
        setDivisions([...divisions, { ...emptyDivision }]);
    };

    const removeDivision = (index: number) => {
        setDivisions(divisions.filter((_, i) => i !== index));
    };

    const updateDivision = (index: number, field: keyof DivisionInput, value: any) => {
        const updated = [...divisions];
        updated[index] = { ...updated[index], [field]: value };
        setDivisions(updated);
    };

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
        formData.set('divisions', JSON.stringify(divisions));

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
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 p-4 rounded-lg">
                    대회를 만들려면 로그인이 필요합니다.
                </div>
            </div>
        );
    }

    // 권한이 없는 경우
    if (!canCreateTournament) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-lg">
                    대회를 생성할 권한이 없습니다. 관리자(ADMIN) 이상의 권한이 필요합니다.
                </div>
            </div>
        );
    }

    const inputClass = "w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none";
    const labelClass = "block text-sm font-medium mb-1";

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto p-6">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">대회 만들기</h2>
                <p className="text-gray-500">새로운 테니스 대회를 개설합니다.</p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
                    {error}
                </div>
            )}

            {/* 기본 정보 섹션 */}
            <section className="space-y-4 p-6 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <h3 className="text-lg font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">기본 정보</h3>

                <div>
                    <label className={labelClass}>대회명 *</label>
                    <input
                        name="title"
                        required
                        className={inputClass}
                        placeholder="예: 2024 봄맞이 테니스 대회"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>장소 *</label>
                        <input
                            name="location"
                            required
                            className={inputClass}
                            placeholder="예: 올림픽공원 테니스장"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>주소</label>
                        <input
                            name="address"
                            className={inputClass}
                            placeholder="상세 주소 입력"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>주최</label>
                        <input
                            name="host"
                            className={inputClass}
                            placeholder="주최 기관/단체명"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>주관</label>
                        <input
                            name="organizer_name"
                            className={inputClass}
                            placeholder="주관 기관/단체명"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>대회 사용구</label>
                        <input
                            name="ball_type"
                            className={inputClass}
                            placeholder="예: 던롭 포트"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>경기 방식</label>
                        <select
                            name="match_type"
                            value={matchType}
                            onChange={(e) => setMatchType(e.target.value as MatchType | '')}
                            className={inputClass}
                        >
                            <option value="">선택해주세요</option>
                            {MATCH_TYPES.map((type) => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </section>

            {/* 일정 섹션 */}
            <section className="space-y-4 p-6 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <h3 className="text-lg font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">대회 일정</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>대회 시작일 *</label>
                        <input
                            type="datetime-local"
                            name="start_date"
                            required
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>대회 종료일 *</label>
                        <input
                            type="datetime-local"
                            name="end_date"
                            required
                            className={inputClass}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>참가 신청 시작일</label>
                        <input
                            type="datetime-local"
                            name="entry_start_date"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>참가 신청 마감일</label>
                        <input
                            type="datetime-local"
                            name="entry_end_date"
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>개회식</label>
                    <input
                        type="datetime-local"
                        name="opening_ceremony"
                        className={inputClass}
                    />
                </div>
            </section>

            {/* 참가 정보 섹션 */}
            <section className="space-y-4 p-6 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <h3 className="text-lg font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">참가 정보</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>최대 참가 인원</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            name="max_participants"
                            defaultValue="32"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>참가비 (원)</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            name="entry_fee"
                            defaultValue="0"
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>입금 계좌</label>
                    <input
                        name="bank_account"
                        className={inputClass}
                        placeholder="예: 국민은행 123-456-789012 홍길동"
                    />
                </div>

                <div>
                    <label className={labelClass}>참가 자격</label>
                    <input
                        name="eligibility"
                        className={inputClass}
                        placeholder="예: NTRP 3.0 이상"
                    />
                </div>
            </section>

            {/* 참가부서 섹션 */}
            <section className="space-y-4 p-6 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
                    <h3 className="text-lg font-semibold">참가 부서</h3>
                    <button
                        type="button"
                        onClick={addDivision}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                    >
                        + 부서 추가
                    </button>
                </div>

                {divisions.length === 0 ? (
                    <p className="text-gray-500 text-sm py-4 text-center">
                        참가 부서를 추가해주세요.
                    </p>
                ) : (
                    <div className="space-y-6">
                        {divisions.map((division, index) => (
                            <div key={index} className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">부서 {index + 1}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeDivision(index)}
                                        className="text-red-500 hover:text-red-700 text-sm"
                                    >
                                        삭제
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>부서명 *</label>
                                        <input
                                            value={division.name}
                                            onChange={(e) => updateDivision(index, 'name', e.target.value)}
                                            className={inputClass}
                                            placeholder="예: 남자 A조"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>참가팀 수</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={division.max_teams || ''}
                                            onChange={(e) => updateDivision(index, 'max_teams', e.target.value ? parseInt(e.target.value) : null)}
                                            className={inputClass}
                                            placeholder="예: 16"
                                        />
                                    </div>
                                </div>

                                {isTeamMatch && (
                                    <div>
                                        <label className={labelClass}>팀당 선수 제한</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            value={division.team_member_limit || ''}
                                            onChange={(e) => updateDivision(index, 'team_member_limit', e.target.value ? parseInt(e.target.value) : null)}
                                            className={inputClass}
                                            placeholder="예: 5"
                                        />
                                    </div>
                                )}

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>시합 일시</label>
                                        <input
                                            type="datetime-local"
                                            value={division.match_date || ''}
                                            onChange={(e) => updateDivision(index, 'match_date', e.target.value || null)}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>시합 장소</label>
                                        <input
                                            value={division.match_location || ''}
                                            onChange={(e) => updateDivision(index, 'match_location', e.target.value || null)}
                                            className={inputClass}
                                            placeholder="시합 장소"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className={labelClass}>우승 시상</label>
                                        <input
                                            value={division.prize_winner || ''}
                                            onChange={(e) => updateDivision(index, 'prize_winner', e.target.value || null)}
                                            className={inputClass}
                                            placeholder="예: 상금 50만원"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>준우승 시상</label>
                                        <input
                                            value={division.prize_runner_up || ''}
                                            onChange={(e) => updateDivision(index, 'prize_runner_up', e.target.value || null)}
                                            className={inputClass}
                                            placeholder="예: 상금 30만원"
                                        />
                                    </div>
                                    <div>
                                        <label className={labelClass}>3위 시상</label>
                                        <input
                                            value={division.prize_third || ''}
                                            onChange={(e) => updateDivision(index, 'prize_third', e.target.value || null)}
                                            className={inputClass}
                                            placeholder="예: 상금 10만원"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={labelClass}>기타 사항</label>
                                    <RichTextEditor
                                        value={division.notes || ''}
                                        onChange={(value) => updateDivision(index, 'notes', value || null)}
                                        placeholder="부서별 기타 사항을 입력하세요."
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* 상세 설명 섹션 */}
            <section className="space-y-4 p-6 bg-gray-50 dark:bg-gray-900 rounded-xl">
                <h3 className="text-lg font-semibold border-b border-gray-200 dark:border-gray-700 pb-2">상세 설명</h3>
                <input type="hidden" name="description" value={description} />
                <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="대회 규정, 상품 등 상세 내용을 입력하세요."
                />
            </section>

            <div className="flex justify-end pt-4">
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors disabled:opacity-50"
                >
                    {loading ? '생성 중...' : '대회 생성하기'}
                </button>
            </div>
        </form>
    );
}
