'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createTournament, updateTournament, DivisionInput } from '@/lib/tournaments/actions';
import { useAuth } from '../AuthProvider';
import { UserRole, MatchType } from '@/lib/supabase/types';
import RichTextEditor from '@/components/ui/RichTextEditor';
import ImageUpload from '@/components/ui/ImageUpload';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Modal } from '@/components/common/Modal';

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

// 날짜를 datetime-local input 형식으로 변환
const formatDateTimeLocal = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// 날짜 선택 시 시간을 00:00으로 설정하는 헬퍼
const normalizeDateTime = (value: string) => {
    if (!value) return value;
    // 날짜만 있고 시간이 없는 경우 (YYYY-MM-DD 형식)
    if (value.length === 10) {
        return `${value}T00:00`;
    }
    // 이미 시간이 포함된 경우 그대로 반환
    return value;
};

export interface TournamentFormData {
    id: string;
    title: string;
    description: string | null;
    poster_url: string | null;
    start_date: string;
    end_date: string;
    location: string;
    address: string | null;
    host: string | null;
    organizer_name: string | null;
    ball_type: string | null;
    entry_start_date: string | null;
    entry_end_date: string | null;
    opening_ceremony: string | null;
    match_type: MatchType | null;
    team_match_count: number | null;
    bank_account: string | null;
    eligibility: string | null;
    max_participants: number;
    entry_fee: number;
    tournament_divisions?: Array<{
        id?: string;  // 기존 부서는 id 포함
        name: string;
        max_teams: number | null;
        team_member_limit: number | null;
        match_date: string | null;
        match_location: string | null;
        prize_winner: string | null;
        prize_runner_up: string | null;
        prize_third: string | null;
        notes: string | null;
    }>;
}

interface TournamentFormProps {
    mode?: 'create' | 'edit';
    initialData?: TournamentFormData;
}

export default function TournamentForm({ mode = 'create', initialData }: TournamentFormProps) {
    const router = useRouter();
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pendingRemove, setPendingRemove] = useState<{ index: number; name: string } | null>(null);
    const [removeConfirmInput, setRemoveConfirmInput] = useState('');
    const [description, setDescription] = useState(initialData?.description || '');
    const [posterUrl, setPosterUrl] = useState<string | null>(initialData?.poster_url || null);
    const [matchType, setMatchType] = useState<MatchType | ''>(initialData?.match_type || '');
    const [divisions, setDivisions] = useState<DivisionInput[]>(
        initialData?.tournament_divisions?.map(div => ({
            id: div.id,  // 기존 부서 id 보존
            name: div.name,
            max_teams: div.max_teams,
            team_member_limit: div.team_member_limit,
            match_date: div.match_date,
            match_location: div.match_location,
            prize_winner: div.prize_winner,
            prize_runner_up: div.prize_runner_up,
            prize_third: div.prize_third,
            notes: div.notes,
        })) || []
    );

    const isEditMode = mode === 'edit';

    const canCreateTournament = profile?.role && ALLOWED_ROLES.includes(profile.role);
    const isTeamMatch = matchType === 'TEAM_SINGLES' || matchType === 'TEAM_DOUBLES';

    const addDivision = () => {
        // 기존 부서가 있으면 마지막 부서를 복사, 없으면 빈 부서
        const template = divisions.length > 0
            ? { ...divisions[divisions.length - 1], id: undefined, name: '' }  // 마지막 부서 복사 (id와 이름은 비움)
            : { ...emptyDivision };
        setDivisions([...divisions, template]);
    };

    const removeDivision = (index: number) => {
        const div = divisions[index];
        // 신규 부서(id 없음): DB에 저장된 데이터 없으므로 즉시 제거
        if (!div.id) {
            setDivisions(divisions.filter((_, i) => i !== index));
            return;
        }
        // 기존 부서(id 있음): 참가자 CASCADE 삭제 위험 → 이름 입력 확인
        setPendingRemove({ index, name: div.name });
        setRemoveConfirmInput('');
    };

    const confirmRemoveDivision = () => {
        if (!pendingRemove) return;
        setDivisions(divisions.filter((_, i) => i !== pendingRemove.index));
        setPendingRemove(null);
        setRemoveConfirmInput('');
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

        if (!canCreateTournament && !isEditMode) {
            setError('대회를 생성할 권한이 없습니다.');
            setLoading(false);
            return;
        }

        const formData = new FormData(e.currentTarget);
        formData.set('divisions', JSON.stringify(divisions));
        formData.set('poster_url', posterUrl || '');
        // shadcn Select는 실제 DOM select가 아니므로 FormData에 수동 추가
        formData.set('match_type', matchType || '');

        const result = isEditMode && initialData
            ? await updateTournament(initialData.id, formData)
            : await createTournament(formData);

        if (result.success) {
            if (isEditMode && initialData) {
                router.push(`/tournaments/${initialData.id}`);
            } else {
                router.push(`/tournaments/${result.tournamentId}`);
            }
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

    const inputClass = "w-full bg-(--bg-input) border border-(--border-color) rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none";
    const labelClass = "block text-sm font-medium mb-1";

    return (
        <form onSubmit={handleSubmit} className="space-y-8 max-w-4xl mx-auto p-6">
            <div className="space-y-2">
                <h2 className="text-2xl font-bold">{isEditMode ? '대회 수정' : '대회 만들기'}</h2>
                <p className="text-gray-500">
                    {isEditMode ? '대회 정보를 수정합니다.' : '대회를 초안으로 저장합니다. 저장 후 상태를 변경하여 공개할 수 있습니다.'}
                </p>
            </div>

            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-md text-sm">
                    {error}
                </div>
            )}

            {/* 대표 이미지 섹션 */}
            <section className="space-y-4 p-6 bg-(--bg-secondary) rounded-xl">
                <h3 className="text-lg font-semibold border-b border-(--border-color) pb-2">대표 이미지</h3>
                <ImageUpload
                    value={posterUrl}
                    onChange={setPosterUrl}
                    bucket="tournaments"
                    folder="posters"
                />
                <p className="text-xs text-gray-500">대회 목록 및 상세 페이지에 표시될 대표 이미지입니다.</p>
            </section>

            {/* 기본 정보 섹션 */}
            <section className="space-y-4 p-6 bg-(--bg-secondary) rounded-xl">
                <h3 className="text-lg font-semibold border-b border-(--border-color) pb-2">기본 정보</h3>

                <div>
                    <label className={labelClass}>대회명 *</label>
                    <input
                        name="title"
                        required
                        defaultValue={initialData?.title || ''}
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
                            defaultValue={initialData?.location || ''}
                            className={inputClass}
                            placeholder="예: 올림픽공원 테니스장"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>주소</label>
                        <input
                            name="address"
                            defaultValue={initialData?.address || ''}
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
                            defaultValue={initialData?.host || ''}
                            className={inputClass}
                            placeholder="주최 기관/단체명"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>주관</label>
                        <input
                            name="organizer_name"
                            defaultValue={initialData?.organizer_name || ''}
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
                            defaultValue={initialData?.ball_type || ''}
                            className={inputClass}
                            placeholder="예: 던롭 포트"
                        />
                    </div>
                    <div>
                        <label className={labelClass}>경기 방식</label>
                        <Select value={matchType || undefined} onValueChange={(v) => setMatchType(v as MatchType | '')}>
                            <SelectTrigger name="match_type" className={inputClass}>
                                <SelectValue placeholder="선택해주세요" />
                            </SelectTrigger>
                            <SelectContent>
                                {MATCH_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {isTeamMatch && (
                    <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                        <label className={labelClass}>단체전 방식 (단체전용) *</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            name="team_match_count"
                            required={isTeamMatch}
                            defaultValue={initialData?.team_match_count || '3'}
                            className={inputClass}
                            placeholder="예: 3 (3복식/3단식 등)"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            단체전 승패를 결정하기 위해 한 팀 매치당 진행되는 총 참가팀(단식/복식) 수를 입력하세요.
                        </p>
                    </div>
                )}
            </section>

            {/* 일정 섹션 */}
            <section className="space-y-4 p-6 bg-(--bg-secondary) rounded-xl">
                <h3 className="text-lg font-semibold border-b border-(--border-color) pb-2">대회 일정</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>대회 시작일 *</label>
                        <input
                            type="datetime-local"
                            name="start_date"
                            required
                            defaultValue={formatDateTimeLocal(initialData?.start_date || null)}
                            onBlur={(e) => {
                                if (e.target.value && !e.target.value.includes('T')) {
                                    e.target.value = normalizeDateTime(e.target.value);
                                }
                            }}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>대회 종료일 *</label>
                        <input
                            type="datetime-local"
                            name="end_date"
                            required
                            defaultValue={formatDateTimeLocal(initialData?.end_date || null)}
                            onBlur={(e) => {
                                if (e.target.value && !e.target.value.includes('T')) {
                                    e.target.value = normalizeDateTime(e.target.value);
                                }
                            }}
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
                            defaultValue={formatDateTimeLocal(initialData?.entry_start_date || null)}
                            onBlur={(e) => {
                                if (e.target.value && !e.target.value.includes('T')) {
                                    e.target.value = normalizeDateTime(e.target.value);
                                }
                            }}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>참가 신청 마감일</label>
                        <input
                            type="datetime-local"
                            name="entry_end_date"
                            defaultValue={formatDateTimeLocal(initialData?.entry_end_date || null)}
                            onBlur={(e) => {
                                if (e.target.value && !e.target.value.includes('T')) {
                                    e.target.value = normalizeDateTime(e.target.value);
                                }
                            }}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>개회식</label>
                    <input
                        type="datetime-local"
                        name="opening_ceremony"
                        defaultValue={formatDateTimeLocal(initialData?.opening_ceremony || null)}
                        onBlur={(e) => {
                            if (e.target.value && !e.target.value.includes('T')) {
                                e.target.value = normalizeDateTime(e.target.value);
                            }
                        }}
                        className={inputClass}
                    />
                </div>
            </section>

            {/* 참가 정보 섹션 */}
            <section className="space-y-4 p-6 bg-(--bg-secondary) rounded-xl">
                <h3 className="text-lg font-semibold border-b border-(--border-color) pb-2">참가 정보</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className={labelClass}>최대 참가 인원</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            name="max_participants"
                            defaultValue={initialData?.max_participants?.toString() || '32'}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>참가비 (원)</label>
                        <input
                            type="text"
                            inputMode="numeric"
                            name="entry_fee"
                            defaultValue={initialData?.entry_fee?.toString() || '0'}
                            className={inputClass}
                        />
                    </div>
                </div>

                <div>
                    <label className={labelClass}>입금 계좌</label>
                    <input
                        name="bank_account"
                        defaultValue={initialData?.bank_account || ''}
                        className={inputClass}
                        placeholder="예: 국민은행 123-456-789012 홍길동"
                    />
                </div>

                <div>
                    <label className={labelClass}>참가 자격</label>
                    <input
                        name="eligibility"
                        defaultValue={initialData?.eligibility || ''}
                        className={inputClass}
                        placeholder="예: NTRP 3.0 이상"
                    />
                </div>
            </section>

            {/* 참가부서 섹션 */}
            <section className="space-y-4 p-6 bg-(--bg-secondary) rounded-xl">
                <div className="flex items-center justify-between border-b border-(--border-color) pb-2">
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
                            <div key={index} className="p-4 bg-(--bg-input) rounded-lg border border-(--border-color) space-y-4">
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
                                        <label className={labelClass}>모집 팀 수</label>
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
                                            value={division.match_date ? formatDateTimeLocal(division.match_date) : ''}
                                            onChange={(e) => updateDivision(index, 'match_date', e.target.value || null)}
                                            onBlur={(e) => {
                                                if (e.target.value && !e.target.value.includes('T')) {
                                                    const normalized = normalizeDateTime(e.target.value);
                                                    updateDivision(index, 'match_date', normalized);
                                                }
                                            }}
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
            <section className="space-y-4 p-6 bg-(--bg-secondary) rounded-xl">
                <h3 className="text-lg font-semibold border-b border-(--border-color) pb-2">상세 설명</h3>
                <input type="hidden" name="description" value={description} />
                <RichTextEditor
                    value={description}
                    onChange={setDescription}
                    placeholder="대회 규정, 상품 등 상세 내용을 입력하세요."
                />
            </section>

            <div className="flex justify-end gap-3 pt-4">
                {isEditMode && (
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-(--text-primary) font-medium py-3 px-8 rounded-lg transition-colors"
                    >
                        취소
                    </button>
                )}
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-8 rounded-lg transition-colors disabled:opacity-50"
                >
                    {loading ? (isEditMode ? '수정 중...' : '저장 중...') : (isEditMode ? '대회 수정하기' : '초안으로 저장하기')}
                </button>
            </div>

            {/* 부서 삭제 확인 모달 — 부서명 직접 입력 */}
            <Modal
                isOpen={pendingRemove !== null}
                onClose={() => { setPendingRemove(null); setRemoveConfirmInput(''); }}
                title="부서 삭제"
                closeOnOverlayClick={false}
                size="sm"
            >
                <Modal.Body>
                    <p className="text-sm text-red-600 dark:text-red-400 mb-3">
                        이 부서를 삭제하면 참가 신청 데이터가 모두 영구 삭제됩니다.
                    </p>
                    <p className="text-sm mb-2">
                        확인을 위해 부서명 <strong>{pendingRemove?.name}</strong>을(를) 정확히 입력하세요.
                    </p>
                    <input
                        value={removeConfirmInput}
                        onChange={(e) => setRemoveConfirmInput(e.target.value)}
                        className={inputClass}
                        placeholder={pendingRemove?.name}
                        autoFocus
                    />
                </Modal.Body>
                <Modal.Footer>
                    <button
                        type="button"
                        onClick={() => { setPendingRemove(null); setRemoveConfirmInput(''); }}
                        className="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-(--text-primary)"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={confirmRemoveDivision}
                        disabled={removeConfirmInput !== pendingRemove?.name}
                        className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        삭제
                    </button>
                </Modal.Footer>
            </Modal>
        </form>
    );
}
