'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Ban } from 'lucide-react'
import { closeTournament } from '@/lib/tournaments/actions'
import { ConfirmDialog, AlertDialog } from '@/components/common/AlertDialog'
import type { TournamentStatus } from '@/lib/supabase/types'

interface TournamentCloseButtonProps {
  tournamentId: string
  currentStatus: TournamentStatus
}

export function TournamentCloseButton({
  tournamentId,
  currentStatus,
}: TournamentCloseButtonProps) {
  const router = useRouter()
  const [confirmDialog, setConfirmDialog] = useState(false)
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
  const [isLoading, setIsLoading] = useState(false)

  // 이미 마감된 경우 버튼 비활성화
  const isClosed = currentStatus === 'CLOSED'

  const handleConfirm = async () => {
    setIsLoading(true)
    setConfirmDialog(false)

    try {
      const result = await closeTournament(tournamentId)

      if (result.success) {
        setAlertDialog({
          isOpen: true,
          title: '참가 신청 마감 완료',
          message: '참가 신청이 마감되었습니다.',
          type: 'success',
        })
        router.refresh()
      } else {
        setAlertDialog({
          isOpen: true,
          title: '마감 실패',
          message: result.error,
          type: 'error',
        })
      }
    } catch {
      setAlertDialog({
        isOpen: true,
        title: '오류',
        message: '참가 신청 마감 중 오류가 발생했습니다.',
        type: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setConfirmDialog(true)}
        disabled={isClosed || isLoading}
        className="btn-secondary btn-sm inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
        title={isClosed ? '이미 마감된 대회입니다' : '참가 신청 마감'}
      >
        <Ban className="w-4 h-4" />
        <span className="relative z-10">
          {isClosed ? '마감됨' : '참가 마감'}
        </span>
      </button>

      <ConfirmDialog
        isOpen={confirmDialog}
        onClose={() => setConfirmDialog(false)}
        onConfirm={handleConfirm}
        title="참가 신청 마감"
        message="참가 신청을 마감하시겠습니까? 마감 후에는 추가 신청을 받을 수 없습니다."
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
