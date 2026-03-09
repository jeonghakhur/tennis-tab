'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTournamentStatus } from '@/lib/tournaments/actions'
import { AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import type { TournamentStatus } from '@/lib/supabase/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface TournamentStatusSelectorProps {
  tournamentId: string
  currentStatus: TournamentStatus
}

const statusConfig: Record<
  TournamentStatus,
  { label: string; className: string }
> = {
  DRAFT: {
    label: '초안',
    className: 'bg-subtle-secondary',
  },
  UPCOMING: {
    label: '대기중',
    className: 'bg-subtle-purple',
  },
  OPEN: {
    label: '모집중',
    className: 'bg-subtle-success',
  },
  CLOSED: {
    label: '마감',
    className: 'bg-subtle-orange',
  },
  IN_PROGRESS: {
    label: '진행중',
    className: 'bg-subtle-info',
  },
  COMPLETED: {
    label: '완료',
    className: 'bg-subtle-secondary',
  },
  CANCELLED: {
    label: '취소',
    className: 'bg-subtle-danger',
  },
}

export function TournamentStatusSelector({
  tournamentId,
  currentStatus,
}: TournamentStatusSelectorProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<TournamentStatus | null>(null)
  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    type: 'info' | 'warning' | 'error' | 'success'
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
  })

  const handleStatusChange = (newStatus: TournamentStatus) => {
    if (newStatus === currentStatus || isLoading) return
    // 변경 전 확인 다이얼로그 표시
    setPendingStatus(newStatus)
  }

  const handleConfirmChange = async () => {
    if (!pendingStatus) return

    setIsLoading(true)

    try {
      const result = await updateTournamentStatus(tournamentId, pendingStatus)

      if (result.success) {
        setPendingStatus(null)
        setAlertDialog({
          isOpen: true,
          title: '상태 변경 완료',
          message: `대회 상태가 "${statusConfig[pendingStatus].label}"(으)로 변경되었습니다.`,
          type: 'success',
        })
        router.refresh()
      } else {
        setPendingStatus(null)
        setAlertDialog({
          isOpen: true,
          title: '상태 변경 실패',
          message: result.error,
          type: 'error',
        })
      }
    } catch {
      setPendingStatus(null)
      setAlertDialog({
        isOpen: true,
        title: '오류',
        message: '대회 상태 변경 중 오류가 발생했습니다.',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <Select
        value={currentStatus}
        onValueChange={(v) => handleStatusChange(v as TournamentStatus)}
        disabled={isLoading}
      >
        <SelectTrigger className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:border-gray-400 dark:focus:border-gray-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${statusConfig[currentStatus].className}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(statusConfig).map(([key, { label }]) => (
            <SelectItem key={key} value={key}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ConfirmDialog
        isOpen={pendingStatus !== null}
        onClose={() => setPendingStatus(null)}
        onConfirm={handleConfirmChange}
        title="상태 변경"
        message={pendingStatus ? `대회 상태를 "${statusConfig[pendingStatus].label}"(으)로 변경하시겠습니까?` : ''}
        confirmText="변경"
        type="warning"
        isLoading={isLoading}
      />

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        title={alertDialog.title}
        message={alertDialog.message}
        type={alertDialog.type}
      />
    </>
  )
}
