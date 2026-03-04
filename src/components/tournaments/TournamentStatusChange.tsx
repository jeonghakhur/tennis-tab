'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateTournamentStatus } from '@/lib/tournaments/actions';
import { AlertDialog } from '@/components/common/AlertDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toast } from '@/components/common/Toast';

type TournamentStatus = 'DRAFT' | 'UPCOMING' | 'OPEN' | 'CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const STATUS_LABELS: Record<TournamentStatus, string> = {
    DRAFT: '준비 중',
    UPCOMING: '접수 예정',
    OPEN: '접수 중',
    CLOSED: '접수 마감',
    IN_PROGRESS: '진행 중',
    COMPLETED: '종료',
    CANCELLED: '취소',
};

const STATUS_COLORS: Record<TournamentStatus, string> = {
    DRAFT: 'var(--text-muted)',
    UPCOMING: '#7c3aed',
    OPEN: '#059669',
    CLOSED: '#d97706',
    IN_PROGRESS: '#2563eb',
    COMPLETED: 'var(--text-muted)',
    CANCELLED: '#dc2626',
};

interface Props {
    tournamentId: string;
    currentStatus: TournamentStatus;
}

export default function TournamentStatusChange({ tournamentId, currentStatus }: Props) {
    const router = useRouter();
    const [status, setStatus] = useState<TournamentStatus>(currentStatus);
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const });
    const [alertDialog, setAlertDialog] = useState({ isOpen: false, message: '' });

    const isDirty = status !== currentStatus;

    const handleSave = async () => {
        setSaving(true);
        const result = await updateTournamentStatus(tournamentId, status);
        setSaving(false);

        if (result.success) {
            setToast({ isOpen: true, message: '대회 상태가 변경되었습니다.', type: 'success' });
            router.refresh();
        } else {
            setAlertDialog({ isOpen: true, message: result.error || '상태 변경에 실패했습니다.' });
            setStatus(currentStatus); // 롤백
        }
    };

    return (
        <>
            <div
                className="rounded-2xl p-6 mb-6"
                style={{
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                }}
            >
                <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                    대회 상태
                </h2>
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <Select value={status} onValueChange={(v) => setStatus(v as TournamentStatus)}>
                            <SelectTrigger>
                                <SelectValue>
                                    <span style={{ color: STATUS_COLORS[status], fontWeight: 600 }}>
                                        {STATUS_LABELS[status]}
                                    </span>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                {(Object.entries(STATUS_LABELS) as [TournamentStatus, string][]).map(([val, label]) => (
                                    <SelectItem key={val} value={val}>
                                        <span style={{ color: STATUS_COLORS[val] }}>{label}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={!isDirty || saving}
                        className="px-5 py-2 rounded-xl font-medium text-sm transition-all disabled:opacity-40"
                        style={{
                            backgroundColor: isDirty ? 'var(--accent-color)' : 'var(--bg-card)',
                            color: isDirty ? 'var(--bg-primary)' : 'var(--text-muted)',
                        }}
                    >
                        {saving ? '저장 중...' : '변경'}
                    </button>
                </div>
            </div>

            <Toast
                isOpen={toast.isOpen}
                onClose={() => setToast({ ...toast, isOpen: false })}
                message={toast.message}
                type={toast.type}
                duration={3000}
            />
            <AlertDialog
                isOpen={alertDialog.isOpen}
                onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
                title="변경 실패"
                message={alertDialog.message}
                type="error"
            />
        </>
    );
}
