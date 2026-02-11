'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateTournamentStatus } from '@/lib/tournaments/actions'
import { AlertDialog } from '@/components/common/AlertDialog'
import type { TournamentStatus } from '@/lib/supabase/types'

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
    className: 'bg-(--bg-card-hover) text-(--text-muted)',
  },
  OPEN: {
    label: '모집중',
    className: 'bg-(--color-success-subtle) text-(--color-success)',
  },
  CLOSED: {
    label: '마감',
    className: 'bg-(--color-orange-subtle) text-(--color-orange)',
  },
  IN_PROGRESS: {
    label: '진행중',
    className: 'bg-(--color-info-subtle) text-(--color-info)',
  },
  COMPLETED: {
    label: '완료',
    className: 'bg-(--bg-card-hover) text-(--text-muted)',
  },
  CANCELLED: {
    label: '취소',
    className: 'bg-(--color-danger-subtle) text-(--color-danger)',
  },
}

export function TournamentStatusSelector({
  tournamentId,
  currentStatus,
}: TournamentStatusSelectorProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
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

  const handleStatusChange = async (newStatus: TournamentStatus) => {
    if (newStatus === currentStatus || isLoading) return

    setIsLoading(true)

    try {
      const result = await updateTournamentStatus(tournamentId, newStatus)

      if (result.success) {
        setAlertDialog({
          isOpen: true,
          title: '상태 변경 완료',
          message: `대회 상태가 "${statusConfig[newStatus].label}"(으)로 변경되었습니다.`,
          type: 'success',
        })
        router.refresh()
      } else {
        setAlertDialog({
          isOpen: true,
          title: '상태 변경 실패',
          message: result.error,
          type: 'error',
        })
      }
    } catch {
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
      <select
        value={currentStatus}
        onChange={(e) => handleStatusChange(e.target.value as TournamentStatus)}
        disabled={isLoading}
        className={`px-4 py-2 rounded-lg text-sm font-semibold border-2 border-transparent hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:border-gray-400 dark:focus:border-gray-500 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          statusConfig[currentStatus].className
        }`}
      >
        {Object.entries(statusConfig).map(([key, { label }]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

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
